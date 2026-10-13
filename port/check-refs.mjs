#!/usr/bin/env node
// Prove every skill, agent, principle, playbook, and file reference in the plugin resolves.
//
//   node port/check-refs.mjs
//
// Exits 1 and lists each unresolved reference. Checks the ported output, not upstream/.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const walk = (dir) =>
  readdirSync(dir).sort().flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const docs = ["skills", "agents", "docs"].flatMap((d) => walk(join(ROOT, d))).filter((f) => f.endsWith(".md"));

const skills = new Set(readdirSync(join(ROOT, "skills")).filter((d) => existsSync(join(ROOT, "skills", d, "SKILL.md"))));
const agents = new Set(readdirSync(join(ROOT, "agents")).map((f) => f.replace(/\.md$/, "")));
// Skills, agents, and commands that live outside this plugin, by name. Each is a
// deliberate mapping target from the brief; anything else unresolved is a failure.
const EXTERNAL_SKILLS = new Set(["skill-creator"]);
const EXTERNAL_AGENTS = new Set(["general-purpose", "Explore"]);

const kebab = (title) => title.toLowerCase().replace(/[^a-z0-9 -]/g, "").trim().replace(/\s+/g, "-");
const failures = [];
const counts = {};
const check = (kind, file, ref, ok) => {
  counts[kind] = (counts[kind] ?? 0) + 1;
  if (!ok) failures.push(`${relative(ROOT, file)}: ${kind} ${ref}`);
};
const skillDirOf = (file) => {
  const m = relative(ROOT, file).match(/^skills\/([^/]+)\//);
  return m && join(ROOT, "skills", m[1]);
};
const exists = (p) => existsSync(p.replace(/[#?].*$/, ""));

for (const file of docs) {
  const text = readFileSync(file, "utf8");
  const skillDir = skillDirOf(file);

  for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(href) || !/[./]/.test(href)) continue;
    check("link", file, href, exists(resolve(dirname(file), href)));
  }
  for (const [, p] of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s`'")\]]+)/g)) {
    if (p.includes("<")) continue;
    check("plugin-path", file, p, exists(join(ROOT, p)));
  }
  for (const [, p] of text.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([^\s`'")\]]+)/g)) {
    check("skill-path", file, p, skillDir && exists(join(skillDir, p)));
  }
  if (skillDir) {
    for (const [, p] of text.matchAll(/(?<![\w/.}-])`((?:playbooks|references|scripts)\/[^`\s<>*]+)/g)) {
      check("skill-relative", file, p, exists(join(skillDir, p)));
    }
  }
  for (const [, name] of text.matchAll(/(?<![\w/-])\/?pstack:([a-z][a-z0-9-]*)/g)) {
    check("pstack-name", file, name, skills.has(name) || agents.has(name));
  }
  for (const [, name] of text.matchAll(/(?<![\w/:.\-`])\/([a-z][a-z0-9-]+)(?=`|\s|[),.])/g)) {
    if (skills.has(name)) failures.push(`${relative(ROOT, file)}: un-namespaced /${name}`);
  }
  for (const [, name] of text.matchAll(/the \*\*([a-z][a-z0-9-]*)\*\* skill\b/g)) {
    check("skill", file, name, skills.has(name) || EXTERNAL_SKILLS.has(name));
  }
  for (const [, name] of text.matchAll(/the \*\*([a-z][a-z0-9-]*)\*\* principle\b/g)) {
    check("principle", file, name, skills.has(`principle-${name}`));
  }
  for (const [, name] of text.matchAll(/\*\*(principle-[a-z0-9-]+)\*\*/g)) {
    check("principle", file, name, skills.has(name));
  }
  for (const [, type] of text.matchAll(/subagent_type: "?([\w:-]+)"?/g)) {
    const [ns, name] = type.includes(":") ? type.split(":") : [null, type];
    check("subagent_type", file, type, ns === "pstack" ? agents.has(name) : EXTERNAL_AGENTS.has(type));
  }
  for (const [, list] of text.matchAll(/^skills:\s*\[([^\]]*)\]/gm)) {
    for (const s of list.split(",").map((x) => x.trim().replace(/^["']|["']$/g, ""))) {
      check("preload", file, s, skills.has(s.replace(/^pstack:/, "")));
    }
  }
}

// Router indexes: every principle title and playbook title maps to a file.
const router = readFileSync(join(ROOT, "skills/poteto-mode/SKILL.md"), "utf8");
const section = (name) => router.split(/^## /m).find((s) => s.startsWith(name)) ?? "";
for (const line of section("Principles").split("\n")) {
  const m = line.match(/^- \*\*([^*]+?)\.?\*\*(?: \(\*\*(principle-[a-z-]+)\*\*\))?/);
  if (m) check("principle-index", "skills/poteto-mode/SKILL.md", m[1], skills.has(m[2] ?? `principle-${kebab(m[1])}`));
}
for (const line of section("Playbooks").split("\n")) {
  const m = line.match(/^- \*\*([^*]+?)\.?\*\*/);
  if (!m) continue;
  const file = line.match(/File: `(playbooks\/[^`]+)`/)?.[1] ?? `playbooks/${kebab(m[1])}.md`;
  check("playbook-index", "skills/poteto-mode/SKILL.md", file, existsSync(join(ROOT, "skills/poteto-mode", file)));
}

for (const [k, n] of Object.entries(counts).sort()) console.log(`${String(n).padStart(5)}  ${k}`);
if (failures.length) {
  console.log(`\n${failures.length} unresolved:`);
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log("\nall references resolve");
