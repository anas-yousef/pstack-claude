#!/usr/bin/env node
// Capture hand edits to the managed output as port/patches/*.patch.
//
//   node port/mkpatch.mjs
//
// Builds the codemod output without patches into a temp dir, diffs every managed
// file against the working tree, and writes one patch per differing file. Stale
// patches are removed. Afterwards `node port/port.mjs` reproduces the working tree.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MANAGED } from "./rules.mjs";

const PORT = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(PORT, "..");
const PATCHES = join(PORT, "patches");

const walk = (dir, base) =>
  existsSync(dir)
    ? readdirSync(dir).sort().flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n), base) : [relative(base, join(dir, n))]))
    : [];
const files = (root) => MANAGED.flatMap((m) => walk(join(root, m), root));

const base = mkdtempSync(join(tmpdir(), "pstack-base-"));
try {
  execFileSync("node", [join(PORT, "port.mjs"), "--no-patches", "--out", base], { stdio: "pipe" });
  const paths = [...new Set([...files(base), ...files(ROOT)])].sort();
  const want = new Map();
  for (const p of paths) {
    const a = existsSync(join(base, p)) ? join(base, p) : "/dev/null";
    const b = existsSync(join(ROOT, p)) ? join(ROOT, p) : "/dev/null";
    const labels = ["--label", a === "/dev/null" ? "/dev/null" : `a/${p}`, "--label", b === "/dev/null" ? "/dev/null" : `b/${p}`];
    const r = spawnSync("diff", ["-u", ...labels, a, b], { encoding: "utf8" });
    if (r.status === 0) continue;
    if (r.status !== 1) throw new Error(`diff failed for ${p}: ${r.stderr}`);
    want.set(p.replaceAll("/", "__") + ".patch", r.stdout);
  }
  for (const f of existsSync(PATCHES) ? readdirSync(PATCHES) : []) if (f.endsWith(".patch") && !want.has(f)) rmSync(join(PATCHES, f));
  for (const [f, text] of want) writeFileSync(join(PATCHES, f), text);
  console.log(`${want.size} patches in port/patches/`);
} finally {
  rmSync(base, { recursive: true, force: true });
}
