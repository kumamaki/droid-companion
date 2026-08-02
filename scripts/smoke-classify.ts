#!/usr/bin/env bun
/**
 * Thin entry that runs the bun:test classify suite (kept for release-checklist habits).
 * Prefer: bun run test
 */
import { spawnSync } from "child_process";
import { join } from "path";

const root = join(import.meta.dir, "..");
const result = spawnSync(
  "bun",
  ["test", join(root, "tests", "classify.test.ts")],
  { stdio: "inherit", cwd: root },
);
process.exit(result.status ?? 1);
