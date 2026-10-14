// Rule table for port.mjs. Data only. The engine in port.mjs applies it.
//
// Order of operations per file: route (drop / move) -> text rules (in array
// order) -> frontmatter policy -> patches (port/patches/*.patch, applied last).
// Judgment edits that a regex can't express safely live in the patches.

export const UPSTREAM = "upstream";

// Output paths the codemod owns. Each run deletes and regenerates them.
export const MANAGED = [".claude-plugin", "skills", "agents", "scripts", "docs/guide"];

// Upstream paths (prefix match) that are not ported.
export const DROP = [
  { path: "automations/", why: "benny is a Cursor Automations bot (port decision: drop)" },
  { path: "skills/make-bot-ui/", why: "drives a Grok Bot webhook UI (port decision: drop)" },
  { path: ".cursor-plugin/", why: "Cursor manifest; replaced by .claude-plugin/" },
  { path: "plugin.json", why: "agent-plugins.org manifest; replaced by .claude-plugin/plugin.json" },
  { path: "README.md", why: "upstream README; the port has its own README.md" },
  { path: "LICENSE", why: "the repo root already carries LICENSE and NOTICE" },
  { path: ".gitignore", why: "the repo root has its own .gitignore" },
  { path: "assets/", why: "logo.png is only referenced by the Cursor manifest" },
];

// Upstream prefix -> output prefix. First match wins. Unlisted paths keep their path.
export const MOVE = [
  { from: "skills/poteto-mode/scripts/", to: "scripts/", why: "port layout: scripts/ at the plugin root" },
];

// Skill frontmatter policy. `disable-model-invocation` per class (see README, Skill visibility).
export const HIDDEN_USER_RUN = ["poteto-help", "ketchup", "bro", "automate-me", "setup-pstack"];
export const isPrinciple = (dir) => dir.startsWith("principle-");
// Not one of the named classes. Upstream hides it, and its description would fire on every .ts edit.
export const HIDDEN_KEPT = ["typescript-best-practices"];
export const hideSkill = (dir) => isPrinciple(dir) || HIDDEN_USER_RUN.includes(dir) || HIDDEN_KEPT.includes(dir);

// Cursor-only frontmatter keys. Claude Code has no custom modes; see README.
export const DROP_FRONTMATTER_KEYS = ["mode", "icon", "color", "reminder"];

// Agent frontmatter key renames.
export const AGENT_KEY_RENAME = { is_background: "background" };

// Files the codemod adds that have no upstream source. Contents in port/templates/.
export const ADD = [
  { template: "agents/readonly-agent.md", why: "maps Cursor `readonly: true` subagents" },
];

const P = (dir) => "`${CLAUDE_PLUGIN_ROOT}/skills/" + dir + "/SKILL.md`";

// Text rules. `files` (optional) is a RegExp tested against the OUTPUT path.
// `min` is the minimum hit count across the tree; a lower count fails the run,
// so upstream drift that silently disables a rule is caught on re-sync.
// The pstack skill-name list is injected by the engine as `ctx.skills`.
export const TEXT_RULES = [
  // Tools.
  { id: "ask-question", find: /\bAskQuestion\b/g, replace: "AskUserQuestion", min: 6 },
  { id: "task-tool", find: /\bthe Task tool\b/g, replace: "the Agent tool", min: 6 },
  { id: "task-backticked", find: /`Task`/g, replace: "`Agent`", min: 8 },
  { id: "task-spawn", find: /\bevery Task spawn\b/g, replace: "every Agent spawn", min: 1 },
  { id: "task-subagent", find: /\ba Task subagent\b/g, replace: "an Agent tool subagent", min: 1 },
  { id: "task-model", find: /\bomit Task `model`/g, replace: "omit the Agent `model` and `effort`", min: 2 },
  { id: "task-schema", find: /\bthe full Task schema\b/g, replace: "the full Agent tool schema", min: 1 },

  { id: "an-agent", find: /\ba `Agent`/g, replace: "an `Agent`", min: 3 },
  { id: "skill-used", find: /A skill counts as used when the transcript shows a `Read` of its `SKILL\.md`/g, replace: "A skill counts as used when the transcript shows a `Skill` tool call loading it, a `Read` of its `SKILL.md`", min: 3 },
  { id: "shell-tool", find: /\(Shell, Grep, MCP, etc\.\)/g, replace: "(Bash, Grep, MCP, etc.)", min: 3 },

  // Subagent types.
  { id: "general-purpose", find: /`?subagent_type: generalPurpose`?/g, replace: "`subagent_type: general-purpose`", min: 4 },
  { id: "general-purpose-bare", find: /`generalPurpose`/g, replace: "`general-purpose`", min: 2 },
  { id: "poteto-agent-type", find: /subagent_type: "poteto-agent"/g, replace: 'subagent_type: "pstack:poteto-agent"', min: 3 },
  { id: "comment-sicko-type", find: /subagent_type: "comment-sicko"/g, replace: 'subagent_type: "pstack:comment-sicko"', min: 1 },

  // Paths.
  { id: "dot-cursor-skills", find: /(~\/)?\.cursor\/skills\//g, replace: (_, home) => (home ?? "") + ".claude/skills/", min: 10 },
  { id: "dot-cursor-plugins", find: /~\/\.cursor\/plugins\//g, replace: "~/.claude/plugins/", min: 3 },
  { id: "models-file", find: /`~\/\.cursor\/rules\/pstack-models\.mdc`/g, replace: "`pstack-models.md`", min: 6 },
  { id: "models-rule", find: /the `pstack-models\.mdc` rule/g, replace: "the `pstack-models.md` file", min: 4 },
  { id: "models-missing", find: /If the rule or that line is missing/g, replace: "If the file or that line is missing", min: 5 },

  // Model defaults (owner decision G7). Opus everywhere it was the judgment default.
  { id: "opus-default", find: /claude-opus-5-5-xhigh/g, replace: "opus xhigh", min: 12 },
  // The fast code default splits by role.
  { id: "fast-interrogate", files: /^skills\/interrogate\//, find: /grok-4\.7-xhigh-fast/g, replace: "sonnet xhigh", min: 1 },
  { id: "fast-haiku", files: /^skills\/(swarm|why|how)\/SKILL\.md$|^skills\/poteto-mode\/playbooks\/multi-phase-plan\.md$/, find: /grok-4\.7-xhigh-fast/g, replace: "haiku high", min: 4 },
  {
    id: "fast-sonnet",
    files: /^skills\/(reflect|arena|architect)\/SKILL\.md$|^skills\/poteto-mode\/playbooks\/(bug-fix|hillclimb|feature|perf-issue|refactoring)\.md$/,
    find: /grok-4\.7-xhigh-fast/g,
    replace: "sonnet high",
    min: 9,
  },

  // Per-role model lines carry a model and an effort; the Agent tool takes them separately.
  // `model` is an alias enum, so there is no "closest slug of the same family" to fall back to.
  { id: "model-line-set", find: /Set `model` to that line's value, or to the default if the rule or the line is missing\./g, replace: "Set `model` and `effort` from that line's value, or from the default if the file or the line is missing.", min: 3 },
  { id: "model-line-alias", find: /Leave `model` unset when the value is `auto` or `inherit-parent`\./g, replace: "Leave both unset when the value is `auto` or `inherit-parent`.", min: 3 },
  { id: "model-line-omit", find: /omit `model` so the workers run on the parent model/g, replace: "omit `model` and `effort` so the workers run on the parent model", min: 1 },
  { id: "model-rejects-slug", find: /If the Agent tool rejects a slug, use the default and say so\./g, replace: "If the Agent tool rejects a value, use the default and say so.", min: 4 },
  { id: "model-closest-slug", find: / If it rejects the default, use the closest valid slug of the same family from its error message\./g, replace: "", min: 4 },

  { id: "model-family", find: /\b(different )?model family\b/g, replace: (_, d) => `${d ?? ""}model tier`, min: 2 },

  // Cursor-team-kit and Cursor built-ins.
  { id: "create-skill", find: /(?<![\w-])create-skill(?![\w-])/g, replace: "skill-creator", min: 15 },
  { id: "deslop-plugin", find: /the `deslop` skill from the `cursor-team-kit` plugin \(`\/deslop`\)/g, replace: "the built-in `/simplify` command", min: 1 },
  { id: "deslop-from-kit", find: /`\/deslop` from `cursor-team-kit`/g, replace: "the built-in `/simplify`", min: 1 },
  { id: "deslop", find: /`\/deslop`/g, replace: "`/simplify`", min: 3 },
  { id: "cursor-restart", find: /\b(a|After a) Cursor restart\b/g, replace: "$1 Claude Code restart", min: 2 },

  // Skill namespacing: `/how` -> `/pstack:how`, for pstack skills only.
  {
    id: "slash-namespace",
    find: (ctx) => new RegExp(String.raw`(?<![\w/:.\-])/(${ctx.skills.join("|")})(?![\w\-])`, "g"),
    replace: "/pstack:$1",
    min: 60,
  },

  // Principle references point at the hidden leaf SKILL.md, read with Read.
  { id: "principle-skill-pair", find: /\*\*([a-z-]+)\*\* and \*\*([a-z-]+)\*\* principle skills/g, replace: (_, a, b) => `**${a}** (${P("principle-" + a)}) and **${b}** (${P("principle-" + b)}) principles`, min: 3 },
  { id: "principle-skill-phrase", find: /\*\*([a-z-]+)\*\* principle skill\b/g, replace: (_, x) => `**${x}** principle (${P("principle-" + x)})`, min: 49 },
  // The router's Principles index keeps its `(**principle-x**)` form; check-refs reads it.
  { id: "principle-bold", files: /^(?!skills\/poteto-mode\/SKILL\.md$)/, find: /\*\*(principle-[a-z-]+)\*\*(?! \()/g, replace: (_, d) => `**${d}** (${P(d)})`, min: 13 },
  { id: "principle-bold-router", files: /^skills\/poteto-mode\/SKILL\.md$/, find: /(?<!\()\*\*(principle-[a-z-]+)\*\*(?! \()/g, replace: (_, d) => `**${d}** (${P(d)})`, min: 1 },
  { id: "principle-paren", find: /\((principle-[a-z-]+)\)/g, replace: (_, d) => `(${P(d)})`, min: 4 },

  // Scripts moved to the plugin root.
  { id: "scripts-check-plan", find: /`node pstack\/skills\/poteto-mode\/scripts\/check-plan\.mjs /g, replace: "`node ${CLAUDE_PLUGIN_ROOT}/scripts/check-plan.mjs ", min: 1 },
  { id: "scripts-root", files: /^skills\/poteto-mode\//, find: /(?<![\w/}])`(?:bun )?scripts\/(worktree-audit\.sh|watch-pr\/watch-pr|orch\/orch\.ts)/g, replace: (m, f) => m.replace(/scripts\//, "${CLAUDE_PLUGIN_ROOT}/scripts/"), min: 5 },
];

// Notes appended to a SKILL.md body, where Claude Code substitutes the variables.
// `skills` lists skill dirs; `auto` selects every skill whose other files use the
// literal CLAUDE_PLUGIN_ROOT variable, which nothing substitutes once the model Reads them.
export const NOTES = [
  {
    id: "models-file",
    skills: ["arena", "architect", "how", "interrogate", "reflect", "swarm", "why"],
    text: "**Model configuration.** Read the project file `.claude/pstack-models.md` when it exists, otherwise the user file `~/.claude/pstack-models.md`. The project file replaces the user file, with no per-line merge. A line is `<role>: <model> <effort>`, and a panel role lists comma-separated entries. Pass the model and the effort as the Agent tool's separate `model` and `effort` parameters.",
  },
  {
    id: "plugin-root",
    auto: true,
    exclude: ["poteto-mode"],
    text: "**Paths.** Files in this skill's folder write the pstack plugin root as the CLAUDE_PLUGIN_ROOT variable. It is `${CLAUDE_PLUGIN_ROOT}`. The shell does not set that variable, so write the absolute path into every command and into every prompt you pass to a subagent.",
  },
];

// Fails the full build when one of these survives outside its allowlist.
export const FORBIDDEN = {
  pattern: /\bcursor\b|cursor-team-kit|grok|generalPurpose|\bAskQuestion\b|is_background|\.cursor\/|agent-transcripts|principle skills?\b|environment: ?"|cloud_base_branch|readonly: (true|false)/gi,
  allow: [{ file: "skills/poteto-help/SKILL.md", match: "Cursor", why: "attribution: a port of poteto's Cursor plugin" }],
};
