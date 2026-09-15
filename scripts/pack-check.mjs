#!/usr/bin/env node
/**
 * Pack the npm artifact and fail if anything secret-shaped or out-of-`files`
 * slipped in. A merge must never publish; this is what the tag release runs.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const ALLOWED_TOP = new Set([
  "package.json",
  "package-lock.json", // sometimes included; harmless if absent
  "README.md",
  "LICENSE.txt",
  "LICENSE",
  "openclaw.plugin.json",
  "dist",
]);

const FORBIDDEN_NAME = /(?:^|\/)(?:\.env|\.env\..*|credentials\.json|.*\.(?:pem|key))$/i;
const CRUISE_KEY = /\bcru_(?:live|demo|test|svc)_[A-Za-z0-9]+\b/;

function listFiles(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const rel = prefix ? `${prefix}/${name}` : name;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) out.push(...listFiles(abs, rel));
    else out.push(rel);
  }
  return out;
}

const packName = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: ROOT,
  encoding: "utf8",
}).trim();

let packMeta;
try {
  packMeta = JSON.parse(packName);
} catch {
  // npm pack --json may print a bare filename on some versions
  packMeta = null;
}

const tarball = execFileSync("npm", ["pack"], { cwd: ROOT, encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)
  .at(-1);
if (!tarball || !tarball.endsWith(".tgz")) {
  console.error(`pack:check: unexpected pack output: ${tarball}`);
  process.exit(1);
}

const extractDir = mkdtempSync(join(tmpdir(), "openclaw-cruise-pack-"));
try {
  execFileSync("tar", ["-xzf", join(ROOT, tarball), "-C", extractDir], { stdio: "inherit" });
  const pkgRoot = join(extractDir, "package");
  const files = listFiles(pkgRoot);

  for (const rel of files) {
    const top = rel.split("/")[0] ?? rel;
    if (!ALLOWED_TOP.has(top) && top !== "package.json") {
      // dist/** is allowed via top "dist"
      if (!rel.startsWith("dist/")) {
        console.error(`pack:check: unexpected path in tarball: ${rel}`);
        process.exit(1);
      }
    }
    if (FORBIDDEN_NAME.test(rel)) {
      console.error(`pack:check: forbidden filename in tarball: ${rel}`);
      process.exit(1);
    }
    if (/\.(?:js|mjs|cjs|json|md|txt|map|ts)$/i.test(rel)) {
      const text = readFileSync(join(pkgRoot, rel), "utf8");
      if (CRUISE_KEY.test(text)) {
        console.error(`pack:check: Cruise key shape found in ${rel}`);
        process.exit(1);
      }
    }
  }

  if (!files.some((f) => f === "openclaw.plugin.json")) {
    console.error("pack:check: openclaw.plugin.json missing from artifact");
    process.exit(1);
  }
  if (!files.some((f) => f.startsWith("dist/"))) {
    console.error("pack:check: dist/ missing from artifact");
    process.exit(1);
  }
  if (files.some((f) => f.startsWith("src/") || f.startsWith("test/") || f === ".env")) {
    console.error("pack:check: source/test/.env must not ship in the artifact");
    process.exit(1);
  }

  console.log(`pack:check: ok — ${tarball} (${files.length} files)`);
  if (packMeta) {
    console.log(`pack:check: npm pack metadata present`);
  }
} finally {
  rmSync(extractDir, { recursive: true, force: true });
  try {
    rmSync(join(ROOT, tarball), { force: true });
  } catch {
    // ignore
  }
}
