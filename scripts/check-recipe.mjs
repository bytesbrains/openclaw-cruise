#!/usr/bin/env node
/**
 * Recipe-only repository: there is no compile step yet.
 * Fail closed if the checked-in OpenClaw starter is missing or empty.
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const recipe = resolve("examples/openclaw.json5");

try {
  const st = statSync(recipe);
  if (!st.isFile() || st.size === 0) {
    console.error(`build: ${recipe} is missing or empty`);
    process.exit(1);
  }
  const text = readFileSync(recipe, "utf8");
  if (!text.includes("cruise") || !text.includes("baseUrl")) {
    console.error(`build: ${recipe} does not look like a Cruise provider recipe`);
    process.exit(1);
  }
  console.log(`build: ok — ${recipe} (${st.size} bytes)`);
} catch (err) {
  console.error(`build: cannot read ${recipe}: ${err.message}`);
  process.exit(1);
}
