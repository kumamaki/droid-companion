import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

export const VERSION = "0.1.0-dev";
export const PACKAGE_NAME = "droid-companion";

/** Repo root when running from source (`src/lib` → `../..`). */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function stateDir(): string {
  const override = process.env.DROID_COMPANION_HOME?.trim();
  if (override) return override;
  return join(homedir(), ".local", "share", "droid-companion");
}

export function sessionsPath(): string {
  return join(stateDir(), "sessions.json");
}

export function lockPath(): string {
  return join(stateDir(), ".lock");
}

export function promptsDir(): string {
  return join(stateDir(), "prompts");
}

export function ensureStateDir(): string {
  const dir = stateDir();
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "jobs"), { recursive: true });
  mkdirSync(promptsDir(), { recursive: true });
  return dir;
}

export function droidBin(): string {
  return process.env.DROID_BIN?.trim() || "droid";
}

/** Resolve contract.md for repo, state home, or common install layouts. */
export function resolveContractPath(): string | null {
  const candidates = [
    join(REPO_ROOT, "contract", "contract.md"),
    join(stateDir(), "contract.md"),
    join(stateDir(), "contract", "contract.md"),
    join(homedir(), ".local", "share", "droid-companion", "contract.md"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
