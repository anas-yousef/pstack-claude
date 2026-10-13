# pstack for Claude Code

This repository is a Claude Code port of [pstack](https://github.com/cursor/plugins/tree/main/pstack), poteto's rigorous agent workflows. pstack helps you write less code, but higher quality code, and parallelize agents with confidence. The design is poteto's. This port changes only what Claude Code needs.

The repository is a single-plugin marketplace. The plugin is named `pstack`, and its skills are `/pstack:<name>`.

## Install

In a Claude Code session, add the marketplace:

```text
/plugin marketplace add anas-yousef/pstack-claude
```

Then install the plugin from your shell:

```bash
claude plugin install pstack@pstack-claude
```

`/plugin install pstack@pstack-claude` inside a session does the same. The repository is private, so your GitHub credentials (`gh auth login`) must reach it.

### Allow pstack to read its own files

pstack's router reads its playbooks and principle files with the Read tool. Claude Code asks permission for each read outside the working directory, and a background subagent can't answer that prompt. Allow the plugin cache once in `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["Read(~/.claude/plugins/**)"]
  }
}
```

Adding `~/.claude/plugins` to `permissions.additionalDirectories` works too. With `--plugin-dir <path>`, pass `--add-dir <path>` as well.

### Keep poteto-mode on

Cursor's custom mode has no Claude Code equivalent, and this port ships no SessionStart hook. Add one line to the host project's `CLAUDE.md`:

```text
For non-trivial work, apply the pstack:poteto-mode skill.
```

Without it, start each task with `/pstack:poteto-mode`.

### Requirements

- Node runs `scripts/check-plan.mjs` (Multi-phase plan playbook).
- [Bun](https://bun.sh) runs `scripts/orch/orch.ts` (Orchestrate playbook) and `scripts/watch-pr/watch-pr` (Babysit and Shipping playbooks). Both install their one dependency on first run.
- `gh` for every PR playbook.

## Get started

1. Run `/pstack:setup-pstack`. Pick a reasoning budget and the models per role.
2. Use `/pstack:poteto-mode` for anything that needs rigor.

The [pstack guide](docs/guide/README.md) walks through a first real task. `/pstack:poteto-help` answers questions about pstack itself.

## Model configuration

`/pstack:setup-pstack` writes `pstack-models.md`. Skills read the project file `.claude/pstack-models.md` first, then the user file `~/.claude/pstack-models.md`, then their defaults. A line is `<role>: <model> <effort>`, and a panel role lists entries separated by commas. The spawn passes the model and the effort as the Agent tool's separate `model` and `effort` parameters. `inherit-parent` or `auto` runs a role on the parent session's model.

| Role | Default |
| --- | --- |
| `judgment and prose`, `hardest tasks`, `how explainer`, `why synthesizer`, `reflect judgment, divergent, synthesizer`, `arena cross-judge pool` | `opus xhigh` |
| `feature, refactoring`, `bug-fix`, `perf-issue`, `hillclimb`, `reflect tooling` | `sonnet high` |
| `swarm workers`, `how explorer`, `why investigators` | `haiku high` |
| `arena runners`, `architect runners` | `opus xhigh, sonnet high` |
| `interrogate reviewers` | `opus xhigh, sonnet xhigh` |

Upstream's cross-family review (Claude against Grok) is cross-tier review here. `fable` is never a default. It is an escalation you choose for one hard spawn. A budget moves every entry's effort along `low` < `medium` < `high` < `xhigh` < `max`. `unlimited` is one step up, `large` keeps the defaults, `medium` is one step down, and `small` is two steps down.

## What the port changes

Every change is in [`port/rules.mjs`](port/rules.mjs) (mechanical rules) or [`port/patches/`](port/patches) (judgment edits, one patch per file). `upstream/` is byte-identical to cursor/plugins at `1b6d44f`.

**Mapped.**

- Cursor's `Task` tool is the Agent tool. `generalPurpose` is `general-purpose`. A playbook delegate is `pstack:poteto-agent`, which preloads `pstack:poteto-mode` through its `skills:` frontmatter.
- `readonly: true` subagents (how, interrogate, the arena cross-judge, the maintain-verification source wave) are `pstack:readonly-agent`, a plugin agent limited to Read, Grep, Glob, and Bash whose prompt forbids writes. Skills that need MCP (why, reflect) stay `general-purpose`.
- Cloud subagents are Agent `isolation: "remote"` when the session offers it. Otherwise each worker is a local background agent in its own git worktree, one writer per worktree. `cloud_base_branch` becomes a branch named in the brief.
- `is_background: true` is agent frontmatter `background: true`. `AskQuestion` is `AskUserQuestion`.
- `~/.cursor/rules/pstack-models.mdc` and its Cursor model slugs are `pstack-models.md` with Claude aliases and a separate effort.
- `agent-transcripts/` is `~/.claude/projects/<cwd-slug>/<session-id>.jsonl`, with subagents under `<session-id>/subagents/`. `<cwd-slug>` is the working directory with every character outside `[A-Za-z0-9-]` replaced by `-`. Skills name their own transcript through `${CLAUDE_SESSION_ID}`. `scripts/worktree-audit.sh` searches both the main checkout's slug and each worktree's slug.
- `.cursor/skills/` is `.claude/skills/`. Cursor's `create-skill` is the `skill-creator` skill. `/deslop` is the built-in `/simplify`. `control-ui` is Playwright MCP or the built-in browser. `control-cli` is Bash or tmux. Cursor's `/loop` and Plan Mode are Claude Code's.
- Every "the **x** principle skill" reference names its file, `${CLAUDE_PLUGIN_ROOT}/skills/principle-x/SKILL.md`. Claude Code substitutes the variable in SKILL.md and agent bodies. In playbook and reference files it stays literal, and the router tells the model it means the plugin root.
- `skills/poteto-mode/scripts/` moved to `scripts/` at the plugin root.

**Skill visibility.** `disable-model-invocation: true` hides a skill from the model in Claude Code, so it applies per class.

| Class | Skills | Flag |
| --- | --- | --- |
| Router and routed workflows | `poteto-mode`, `how`, `why`, `architect`, `arena`, `swarm`, `interrogate`, `reflect`, `tdd`, `unslop`, `technical-writing`, `no-comments`, `benchmark-checklist`, `blast-radius`, `figure-it-out`, `show-me-your-work`, `create-verification-skill`, `maintain-verification-skill`, `recall`, `teach`, `correct`, `typescript-best-practices` | removed |
| Principles | the 24 `principle-*` skills, read by file | kept |
| User-run | `poteto-help`, `ketchup`, `bro`, `automate-me`, `setup-pstack` | kept (added to `setup-pstack`) |

`poteto-mode`'s Cursor-only frontmatter (`mode`, `icon`, `color`, `reminder`) is dropped.

**Dropped.** `automations/benny/` (a Cursor Automations bot), `skills/make-bot-ui/` (a Grok Bot webhook UI), every Grok reference, the Cursor manifests, and the logo.

**Deliberate mentions.** `grep -rniE 'cursor|grok|generalPurpose|AskQuestion|is_background|\.cursor/|agent-transcripts' skills agents docs` returns two lines. `skills/poteto-help/SKILL.md` says pstack is a port of poteto's Cursor plugin (attribution). `skills/why/SKILL.md` contains the word "precursor".

## Re-sync with upstream

1. Replace `upstream/` with a fresh copy of `cursor/plugins/pstack` and update the commit in `NOTICE`.
2. Run `node port/port.mjs`. Each rule has a minimum hit count, so a rule that upstream drift disabled fails the run by name. Each patch applies with `git apply` and no fuzz, so a patch whose context moved fails by name.
3. Fix what failed. Edit the rule in `port/rules.mjs`, or edit the output file by hand and run `node port/mkpatch.mjs` to regenerate its patch.
4. Verify.

```bash
node port/port.mjs && git diff --exit-code
```

```bash
node port/check-refs.mjs
```

```bash
claude plugin validate . --strict
```

To change the port itself, edit the output under `skills/`, `agents/`, `scripts/`, or `docs/guide/`, then run `node port/mkpatch.mjs` and commit the output and the patch together. Never run `node port/port.mjs` with uncaptured edits. It regenerates the managed directories.

## Smoke run

Four live runs on 2026-10-13, Claude Code 2.1.296, default model, each `claude --plugin-dir <this repo> --add-dir <this repo> --permission-mode acceptEdits -p "/pstack:poteto-mode <task>"` in a scratch git repo. The transcripts are on the owner's machine.

| Run | Task | Transcript |
| --- | --- | --- |
| 1 | `slugify('Hello, World!')` keeps a trailing dash | `<scratch>/smoke-repo/aaf0609c-8374-42a5-b87b-6f97ff9522a9.jsonl` |
| 2 | A memoized `loadConfig` drops env overrides (a regression across three commits) | `<scratch>/smoke-repo2/2b610c2d-73f3-41a6-8e62-e6fef853e67b.jsonl` |
| 3 | Run 2 again, after the router line that maps "the **x** skill" to `pstack:x` | `<scratch>/smoke-repo2/8dafa1e1-149c-4044-a6a4-9d203f4e01ac.jsonl` |
| 4 | Run 2, also asking for a PR description | `<scratch>/smoke-repo2/5c3452ca-1712-47d5-aabe-81c6c93d70e8.jsonl` |

Every run loaded the router, opened `playbooks/bug-fix.md`, and read 3 to 5 principle leaves with Read from the plugin root. Every run reproduced the bug, committed a failing test before the fix, fixed the root cause, and named the principles that shaped each choice. Run 2 bisected to the regressing commit. Run 1 surfaced the missed "canonical **x** principle skill" phrase, now fixed in the rules.

No run called a routed skill through the Skill tool. Each reply listed the playbook steps it skipped (the delegate, `architect`, `/simplify`, `/pstack:no-comments`) and gave the change's size as the reason. Run 4 also declined `technical-writing` by name. A probe confirmed that a slash-invoked plugin skill can chain into another through the Skill tool, so this is the model treating the router's skill triggers as advisory on small tasks, not a loading failure. It is an open question for the owner.

## Attribution

pstack is by [poteto](https://github.com/poteto) (Lauren Tan), MIT licensed, from [cursor/plugins](https://github.com/cursor/plugins/tree/main/pstack). See `LICENSE` and `NOTICE`. This port is by Anas Yousef.
