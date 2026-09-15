#!/usr/bin/env node
/**
 * Pack the npm artifact and fail if anything secret-shaped or out-of-`files`
 * slipped in. A merge must never publish; this is what the tag release runs.
 *
 * Uses execFileSync with argv arrays only (no shell) — inputs are fixed CLI
 * names plus the tarball basename produced by `npm pack` for this package.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const ROOT = process.cwd();

/** Must match package.json `files` (+ package.json always included by npm). */
const ALLOWED_TOP = new Set([
  "package.json",
  "README.md",
  "LICENSE.txt",
  "LICENSE",
  "openclaw.plugin.json",
  "dist",
]);

const FORBIDDEN_NAME = /(?:^|\/)(?:\.env|\.env\..*|credentials\.json|.*\.(?:pem|key))$/i;

/** Align with .gitleaks.toml cruise-key (prefix + 40 base62 chars). */
const CRUISE_KEY = /\bcru_(?:live|demo|test|svc)_[A-Za-z0-9]{40}\b/;

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

function assertSafeTarballName(name) {
  const base = basename(name);
  if (base !== name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    console.error(`pack:check: refusing unsafe tarball name: ${name}`);
    process.exit(1);
  }
  if (!/^[\w.-]+\.tgz$/.test(base)) {
    console.error(`pack:check: unexpected tarball basename: ${base}`);
    process.exit(1);
  }
  return base;
}

function isMostlyText(buf) {
  if (buf.length === 0) return true;
  let suspicious = 0;
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 7 || (b > 13 && b < 32)) suspicious += 1;
  }
  return suspicious / sample.length < 0.1;
}

function runGitleaksOnExtract(pkgRoot) {
  try {
    execFileSync(
      "gitleaks",
      [
        "detect",
        "--source",
        pkgRoot,
        "--no-git",
        "--redact",
        "--no-banner",
        "--config",
        join(ROOT, ".gitleaks.toml"),
      ],
      { stdio: "inherit" },
    );
  } catch (err) {
    if (err && typeof err === "object" && "status" in err && err.status === 1) {
      console.error("pack:check: gitleaks found secrets in the packed artifact");
      process.exit(1);
    }
    // gitleaks missing in some local shells — CI release image installs it via
    // the secrets-scan job elsewhere; here we still keep the regex scan.
    if (err && typeof err === "object" && "status" in err && err.status === 127) {
      console.warn("pack:check: gitleaks not on PATH — regex scan only");
      return;
    }
    // spawn ENOENT
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      console.warn("pack:check: gitleaks not on PATH — regex scan only");
      return;
    }
    throw err;
  }
}

execFileSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: ROOT,
  encoding: "utf8",
});

const packOut = execFileSync("npm", ["pack"], { cwd: ROOT, encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)
  .at(-1);
if (!packOut) {
  console.error("pack:check: npm pack produced no tarball name");
  process.exit(1);
}
const tarball = assertSafeTarballName(packOut);

const extractDir = mkdtempSync(join(tmpdir(), "openclaw-cruise-pack-"));
try {
  execFileSync("tar", ["-xzf", join(ROOT, tarball), "-C", extractDir], {
    stdio: "inherit",
  });
  const pkgRoot = join(extractDir, "package");
  if (!existsSync(pkgRoot)) {
    console.error("pack:check: packed archive missing package/ root");
    process.exit(1);
  }
  const files = listFiles(pkgRoot);

  for (const rel of files) {
    const top = rel.split("/")[0] ?? rel;
    if (!ALLOWED_TOP.has(top)) {
      console.error(`pack:check: unexpected path in tarball: ${rel}`);
      process.exit(1);
    }
    if (FORBIDDEN_NAME.test(rel)) {
      console.error(`pack:check: forbidden filename in tarball: ${rel}`);
      process.exit(1);
    }
    const abs = join(pkgRoot, rel);
    const buf = readFileSync(abs);
    if (!isMostlyText(buf)) continue;
    const text = buf.toString("utf8");
    if (CRUISE_KEY.test(text)) {
      console.error(`pack:check: Cruise key shape found in ${rel}`);
      process.exit(1);
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

  runGitleaksOnExtract(pkgRoot);

  console.log(`pack:check: ok — ${tarball} (${files.length} files)`);
} finally {
  rmSync(extractDir, { recursive: true, force: true });
  try {
    rmSync(join(ROOT, tarball), { force: true });
  } catch {
    // ignore
  }
}
