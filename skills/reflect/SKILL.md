---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/pstack:reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Before fanning out, find this conversation's transcript. Claude Code writes it to `~/.claude/projects/<cwd-slug>/${CLAUDE_SESSION_ID}.jsonl`. `<cwd-slug>` is the session's absolute working directory with every character other than a letter, digit, or `-` replaced by `-`, so `/Users/you/my_proj` becomes `-Users-you-my-proj`. Do not glob across other `~/.claude/projects/*/` directories. That crosses workspace boundaries and reads private chats from unrelated projects.

```bash
ls -t ~/.claude/projects/<cwd-slug>/${CLAUDE_SESSION_ID}.jsonl ~/.claude/projects/<cwd-slug>/${CLAUDE_SESSION_ID}/subagents/*.jsonl 2>/dev/null | head -10
```

That covers the session (`<session-id>.jsonl`) and its subagents (`<session-id>/subagents/agent-<id>.jsonl`). If the session file is missing, list `~/.claude/projects/<cwd-slug>/*.jsonl` newest first and take the file whose first `"type":"user"` line contains the conversation's opening user prompt. If none matches, pass a tight digest of the session instead.

## 2. Spawn three reviewers in parallel

One message, three `Agent` calls, `subagent_type: general-purpose`. Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references, and `pstack:readonly-agent` and `Explore` carry no MCP tools.

Each reviewer and the synthesizer name a role line in the `pstack-models.md` file and a default. Set `model` and `effort` from that line's value, or from the default if the file or the line is missing. Leave both unset when the value is `auto` or `inherit-parent`. If the Agent tool rejects a value, use the default and say so.

| Lens | Role line | Default `model` | Prompt template |
|---|---|---|---|
| Judgment | `reflect judgment, divergent, synthesizer` | `opus xhigh` | `references/judgment-reviewer.md` |
| Tooling | `reflect tooling` | `sonnet high` | `references/tooling-reviewer.md` |
| Divergent | `reflect judgment, divergent, synthesizer` | `opus xhigh` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings in the `Agent` response body.

## 3. Synthesize

One `Agent` call, `subagent_type: general-purpose`, `model` from the `reflect judgment, divergent, synthesizer` line (default `opus xhigh`). It spot-verifies citations through MCP, so it stays `general-purpose`. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle (`${CLAUDE_PLUGIN_ROOT}/skills/principle-encode-lessons-in-structure/SKILL.md`).

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker without waiting. Only the Accepted list waits for approval.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to the `skill-creator` skill and run its draft / test / iterate loop.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to `skill-creator` and run its description-optimization loop.
- `new skill via skill-creator: <kebab-name>`: hand creation to `skill-creator`. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.

**Model configuration.** Read the project file `.claude/pstack-models.md` when it exists, otherwise the user file `~/.claude/pstack-models.md`. The project file replaces the user file, with no per-line merge. A line is `<role>: <model> <effort>`, and a panel role lists comma-separated entries. Pass the model and the effort as the Agent tool's separate `model` and `effort` parameters.
