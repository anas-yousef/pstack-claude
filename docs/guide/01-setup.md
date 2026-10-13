# Set up pstack

In this page you install the plugin, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install the plugin

In a Claude Code session, add the marketplace:

```text
/plugin marketplace add anas-yousef/pstack-claude
```

Then install the plugin from your shell:

```bash
claude plugin install pstack@pstack-claude
```

`/plugin install pstack@pstack-claude` inside a session does the same. `claude plugin marketplace add anas-yousef/pstack-claude` is the shell form of the first step. Claude Code confirms the plugin is installed.

## Allow pstack to read its own files

pstack's skills read their own files with the Read tool. That covers the playbooks and the principle files. Claude Code installs the plugin under `~/.claude/plugins/`, which is outside your working directory, so it asks permission for each read. Allow it once with a permission rule in `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["Read(~/.claude/plugins/**)"]
  }
}
```

Adding `~/.claude/plugins` to `permissions.additionalDirectories` works too.

## Pick your models

Run:

```text
/pstack:setup-pstack
```

[`/pstack:setup-pstack`](../../skills/setup-pstack/SKILL.md) detects the models you have access to, asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `pstack-models.md`, a small file every pstack skill reads. A project file at `.claude/pstack-models.md` replaces a user file at `~/.claude/pstack-models.md` as a whole, and either one overrides the skill defaults line by line.

Each line reads `<role>: <model> <effort>`, for example `bug-fix: sonnet high`. Models are Claude aliases (`opus`, `sonnet`, `haiku`), and effort is `low`, `medium`, `high`, `xhigh`, or `max`. The defaults put Opus on judgment at `xhigh`, Sonnet on code at `high`, and Haiku on the cheap exploration roles at `high`. `large` keeps those defaults. `unlimited` moves every entry one effort step up, so Opus goes to `max`. `medium` and `small` move every entry one or two steps down, never below `medium`, and spend fewer tokens.

You only override what you care about. A role with no line in the file keeps the skill's default. To restore a default, delete that role's line. A rerun of `/pstack:setup-pstack` keeps any role whose model differs from the default. When a default changes, a file written before the change still pins the old default, so delete those role lines, or delete the file, then run `/pstack:setup-pstack` again.

You might be wondering how to keep a role on the model you picked for the session. Set a role to `inherit-parent` or `auto` and pstack omits the subagent `model` and `effort` fields, so the subagent inherits your parent chat model. Both values mean the same thing, and neither is a model alias. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every `/pstack:swarm` worker unless a race names a model for each arm.

## Accept the verification offer, or don't

At the end of setup, `/pstack:setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/pstack:create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.claude/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/pstack:create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

pstack skills read the file each time they spawn a subagent, so a change applies from the next spawn.

## Keep the cost in check

pstack spends extra tokens on subagents and review panels. That's the price of the rigor. To spend fewer:

- Rerun `/pstack:setup-pstack` and pick a smaller reasoning budget or cheaper models. A strong model in the main chat with cheaper, faster models in the code roles is a good split.
- Set a role to `auto` or `inherit-parent` so it runs on the chat's own model.
- Shorten a panel list. Each entry runs one subagent.
- Save `/pstack:poteto-mode` for work that needs rigor. A small, obvious edit doesn't.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/pstack:poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt. If `/pstack:poteto-mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. Claude Code has no custom modes, so `/pstack:poteto-mode` does not stay on by itself. Start each new task with it, or add one line to your project's `CLAUDE.md` so the router applies to every non-trivial task:

```text
For non-trivial work, apply the pstack:poteto-mode skill.
```

Without that line, the skill applies to the one message you invoke it on, and it fades as the chat moves on.

Next: [Route work through `/pstack:poteto-mode`](./02-poteto-mode.md).
