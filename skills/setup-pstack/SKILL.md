---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget. Detects your available models and writes a `pstack-models.md` file that overrides the skill defaults. Use for /pstack:setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
disable-model-invocation: true
---

# Setup pstack

Write `pstack-models.md`, the file that sets pstack's model and effort per role. pstack skills read the project file `.claude/pstack-models.md` when it exists, otherwise the user file `~/.claude/pstack-models.md`, otherwise their defaults. The project file replaces the user file, with no per-line merge.

## Steps

### 1. Detect available models

Enumerate the models you can pass to the Agent tool's `model` parameter in this session, and the levels its `effort` parameter accepts. That is the dependable source. The models are Claude Code aliases (`opus`, `sonnet`, `haiku`, `fable`). The effort ladder is `max` > `xhigh` > `high` > `medium` > `low`. If you cannot detect them, ask the user which models their plan includes. Never write a model you have not confirmed is available. The aliases `inherit-parent` and `auto` are always valid even though they are not detected models.

### 2. Load current state

The default role-to-model mapping is the file shape shown in step 5 below. Ask once whether to write the user file `~/.claude/pstack-models.md` (every project, the default) or the project file `.claude/pstack-models.md` (this repository only, and it overrides the user file). If the chosen file already exists, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from those defaults. A line whose role is not in step 5, such as `how critics`, is from a retired role. Drop it.

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Prefer AskUserQuestion over free text. Offer these four options with these exact labels, and name the current budget when the file records one. With no file, say that `large` matches the skill defaults.

- `unlimited — one step above the defaults`
- `large — the defaults`
- `medium — one step below the defaults`
- `small — two steps below the defaults, never below medium`

**(b) Apply it.** Build the working table from the skill defaults, and on a re-run keep any role you changed by model, list, or alias (`inherit-parent`, `auto`). A budget moves the effort of every real entry, panel entries included, along the ladder `low` < `medium` < `high` < `xhigh` < `max`. `unlimited` moves each one step up, `large` keeps it, `medium` moves it one step down, and `small` moves it two steps down. Stop at `max` at the top and at `medium` at the bottom, as upstream's `small` did. If a model rejects the resulting effort, use the highest effort it accepts below the target, else mark the role as needing a choice. `inherit-parent` and `auto` do not change. So `unlimited` turns `opus xhigh` into `opus max` and `sonnet high` into `sonnet xhigh`. `small` turns them into `opus medium` and `sonnet medium`.

**(c) Show the roles and confirm.** Show every role with its model and effort, marking any model not in the detected set as needing a choice. Also list each line step 2 dropped. Ask whether to accept as-is or change specific roles, offering the detected models plus `inherit-parent` and `auto` (both mean: this role runs on the parent chat model) as the options. Prefer AskUserQuestion over free text. For panel roles (arena runners, architect runners, interrogate reviewers) the value is a list, and one subagent runs per entry, alias entries included, so the list length sets the count. `arena cross-judge pool` is also a list, but Arena selects one value from it whose model tier differs from the parent's when possible. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm. `fable` is an escalation, so offer it but never put it in a default.

### 4. Validate

Every model written must be in the detected set, and every effort must be on the ladder. `inherit-parent` and `auto` always pass. If a chosen model is not available, stop and ask again.

### 5. Write the file

Write the chosen file with a `# budget` line with the chosen label, and one line per role, using the same labels poteto-mode uses. A line is `<role>: <model> <effort>`, and a panel role separates its entries with commas. Overwrite the whole file so re-runs stay idempotent. Shape:

```
# pstack model configuration. One line per role. Delete a line to fall back to the skill default.
# A value is `<model> <effort>`, passed as the Agent tool's `model` and `effort`.
# `inherit-parent` or `auto` as a value: the role runs on the parent chat model (omit Agent `model` and `effort`). Alias entries in a panel list still count toward its fan-out.
# budget: large
feature, refactoring: sonnet high
bug-fix: sonnet high
perf-issue: sonnet high
hillclimb: sonnet high
judgment and prose: opus xhigh
hardest tasks: opus xhigh
how explorer: haiku high
how explainer: opus xhigh
why investigators: haiku high
why synthesizer: opus xhigh
reflect tooling: sonnet high
reflect judgment, divergent, synthesizer: opus xhigh
arena runners: opus xhigh, sonnet high
arena cross-judge pool: opus xhigh, sonnet xhigh
swarm workers: haiku high
architect runners: opus xhigh, sonnet high
interrogate reviewers: opus xhigh, sonnet xhigh
```

### 6. Confirm

Tell the user which file was written and that pstack skills read it at their next spawn. Re-running this skill updates it.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /pstack:create-verification-skill." On yes, invoke `/pstack:create-verification-skill`. On no, move on without pushing.
