#!/usr/bin/env node
// Rebuild the Claude Code plugin from upstream/.
//
//   node port/port.mjs                 regenerate the managed output in place
//   node port/port.mjs --out <dir>     write the managed output to <dir> instead
//   node port/port.mjs --no-patches    skip port/patches/ (the base that mkpatch diffs against)
//
// Deterministic: sorted walks, no timestamps. A second run gives no diff.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as R from "./rules.mjs";

const PORT = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(PORT, "..");
const SRC = join(ROOT, R.UPSTREAM);

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
if (flag("--out") && !opt("--out")?.trim()) throw new Error("--out needs a directory");
const outDir = resolve(opt("--out") ?? ROOT);
const withPatches = !flag("--no-patches");

function walk(dir, base = dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p, base) : [relative(base, p)];
    });
}

function route(path) {
  if (R.DROP.some((d) => (d.path.endsWith("/") ? path.startsWith(d.path) : path === d.path))) return null;
  const move = R.MOVE.find((m) => path.startsWith(m.from));
  return move ? move.to + path.slice(move.from.length) : path;
}

const isText = (path) => /\.md$/.test(path) && /^(skills|agents|docs)\//.test(path);

const upstreamFiles = walk(SRC);
const skills = [
  ...new Set(
    upstreamFiles
      .map(route)
      .filter(Boolean)
      .map((p) => p.match(/^skills\/([^/]+)\/SKILL\.md$/)?.[1])
      .filter((d) => d && !R.isPrinciple(d)),
  ),
].sort((a, b) => b.length - a.length || a.localeCompare(b));
const ctx = { skills };
const hits = Object.fromEntries(R.TEXT_RULES.map((r) => [r.id, 0]));

function applyTextRules(path, text) {
  for (const rule of R.TEXT_RULES) {
    if (rule.files && !rule.files.test(path)) continue;
    const find = typeof rule.find === "function" ? rule.find(ctx) : rule.find;
    text = text.replace(find, (...m) => {
      hits[rule.id]++;
      if (typeof rule.replace === "function") return rule.replace(...m);
      return rule.replace.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? "");
    });
  }
  return text;
}

// Frontmatter as an ordered list of [key, lines]. Indented continuation lines stay with their key.
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const entries = [];
  for (const line of m[1].split("\n")) {
    const key = line.match(/^([A-Za-z_][\w-]*):/)?.[1];
    if (key) entries.push([key, [line]]);
    else entries.at(-1)[1].push(line);
  }
  return { entries, body: text.slice(m[0].length) };
}

const joinFrontmatter = ({ entries, body }) => `---\n${entries.flatMap(([, lines]) => lines).join("\n")}\n---\n${body}`;

function setKey(fm, key, value, after) {
  const line = `${key}: ${value}`;
  const at = fm.entries.findIndex(([k]) => k === key);
  if (at >= 0) fm.entries[at] = [key, [line]];
  else fm.entries.splice(fm.entries.findIndex(([k]) => k === after) + 1, 0, [key, [line]]);
}

function applyFrontmatter(path, text) {
  const skill = path.match(/^skills\/([^/]+)\/SKILL\.md$/)?.[1];
  const agent = /^agents\/[^/]+\.md$/.test(path);
  if (!skill && !agent) return text;
  const fm = splitFrontmatter(text);
  if (!fm) throw new Error(`${path}: no frontmatter`);
  if (skill) {
    fm.entries = fm.entries.filter(([k]) => !R.DROP_FRONTMATTER_KEYS.includes(k));
    setKey(fm, "name", skill);
    if (R.hideSkill(skill)) setKey(fm, "disable-model-invocation", "true", "description");
    else fm.entries = fm.entries.filter(([k]) => k !== "disable-model-invocation");
  }
  if (agent) {
    fm.entries = fm.entries.map(([k, lines]) => {
      const to = R.AGENT_KEY_RENAME[k];
      return to ? [to, lines.map((l) => l.replace(new RegExp(`^${k}:`), `${to}:`))] : [k, lines];
    });
  }
  return joinFrontmatter(fm);
}

function manifests() {
  const up = JSON.parse(readFileSync(join(SRC, "plugin.json"), "utf8"));
  const repo = "https://github.com/anas-yousef/pstack-claude";
  const plugin = {
    name: up.name,
    version: up.version,
    description: up.description,
    author: up.author,
    homepage: repo,
    repository: repo,
    license: up.license,
    keywords: up.keywords,
  };
  const marketplace = {
    name: "pstack-claude",
    owner: { name: "Anas Yousef" },
    metadata: { description: "pstack (poteto's agent workflows) ported to Claude Code." },
    plugins: [{ name: up.name, source: "./", description: up.description, version: up.version, author: up.author, license: up.license }],
  };
  return {
    ".claude-plugin/plugin.json": JSON.stringify(plugin, null, 2) + "\n",
    ".claude-plugin/marketplace.json": JSON.stringify(marketplace, null, 2) + "\n",
  };
}

function build(stage) {
  for (const src of upstreamFiles) {
    const out = route(src);
    if (!out) continue;
    mkdirSync(dirname(join(stage, out)), { recursive: true });
    if (!isText(out)) {
      cpSync(join(SRC, src), join(stage, out));
      continue;
    }
    let text = readFileSync(join(SRC, src), "utf8");
    text = applyTextRules(out, text);
    text = applyFrontmatter(out, text);
    writeFileSync(join(stage, out), text);
  }
  for (const add of R.ADD) {
    mkdirSync(dirname(join(stage, add.template)), { recursive: true });
    cpSync(join(PORT, "templates", add.template), join(stage, add.template));
  }
  for (const [path, text] of Object.entries(manifests())) {
    mkdirSync(dirname(join(stage, path)), { recursive: true });
    writeFileSync(join(stage, path), text);
  }
  for (const note of R.NOTES) {
    const dirs = note.auto
      ? skills.filter((d) => !note.exclude.includes(d) && walk(join(stage, "skills", d)).some((f) => f !== "SKILL.md" && f.endsWith(".md") && readFileSync(join(stage, "skills", d, f), "utf8").includes("${CLAUDE_PLUGIN_ROOT}")))
      : note.skills;
    for (const d of [...dirs].sort()) {
      const p = join(stage, "skills", d, "SKILL.md");
      writeFileSync(p, readFileSync(p, "utf8").replace(/\n*$/, "\n") + "\n" + note.text + "\n");
    }
  }
  const low = R.TEXT_RULES.filter((r) => hits[r.id] < (r.min ?? 1));
  if (low.length) {
    throw new Error(`rules below their minimum hit count (upstream drift?):\n${low.map((r) => `  ${r.id}: ${hits[r.id]} < ${r.min ?? 1}`).join("\n")}`);
  }
  if (!withPatches) return;
  const patchDir = join(PORT, "patches");
  const patches = existsSync(patchDir) ? readdirSync(patchDir).filter((f) => f.endsWith(".patch")).sort() : [];
  for (const p of patches) {
    try {
      execFileSync("git", ["apply", "--whitespace=nowarn", join(patchDir, p)], { cwd: stage, stdio: "pipe", env: { ...process.env, GIT_DIR: join(stage, ".nogit") } });
    } catch (e) {
      throw new Error(`patch ${p} failed to apply:\n${e.stderr}`);
    }
  }
  const survivors = ["skills", "agents", "docs"].flatMap((d) => walk(join(stage, d)).map((f) => `${d}/${f}`)).filter((f) => f.endsWith(".md")).flatMap((f) =>
    [...readFileSync(join(stage, f), "utf8").matchAll(R.FORBIDDEN.pattern)]
      .map((m) => ({ file: f, match: m[0] }))
      .filter((s) => !R.FORBIDDEN.allow.some((a) => a.file === s.file && a.match === s.match)),
  );
  if (survivors.length) throw new Error(`Cursor-only text survived the port:\n${survivors.map((s) => `  ${s.file}: ${s.match}`).join("\n")}`);
}

const stage = mkdtempSync(join(tmpdir(), "pstack-port-"));
try {
  build(stage);
  for (const m of R.MANAGED) rmSync(join(outDir, m), { recursive: true, force: true });
  for (const m of R.MANAGED) if (existsSync(join(stage, m))) cpSync(join(stage, m), join(outDir, m), { recursive: true });
} finally {
  rmSync(stage, { recursive: true, force: true });
}
if (flag("--verbose")) for (const r of R.TEXT_RULES) console.log(`${String(hits[r.id]).padStart(4)}  ${r.id}`);
console.log(`ported ${R.UPSTREAM}/ -> ${relative(process.cwd(), outDir) || "."} (${withPatches ? "with" : "without"} patches)`);
