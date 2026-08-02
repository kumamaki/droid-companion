import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { EMBEDDED_CONTRACT } from "./contract-embed";

export const VERSION = "0.1.1";
export const PACKAGE_NAME = "droid-companion";

/**
 * Repo root when running from source (`src/lib` → `../..`).
 * Compiled binaries may not have a real repo tree — only use paths that exist.
 */
function resolveRepoRoot(): string {
  try {
    const fromImport = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    if (
      existsSync(join(fromImport, "contract", "contract.md")) ||
      existsSync(join(fromImport, "package.json"))
    ) {
      return fromImport;
    }
  } catch {
    /* compiled / odd import.meta */
  }
  return process.cwd();
}

export const REPO_ROOT = resolveRepoRoot();

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

/** Candidate paths for contract.md (first existing wins). */
export function contractCandidates(): string[] {
  const homeShare = join(homedir(), ".local", "share", "droid-companion");
  const execDir = dirname(process.execPath);
  return [
    process.env.DROID_COMPANION_CONTRACT?.trim(),
    join(REPO_ROOT, "contract", "contract.md"),
    join(stateDir(), "contract.md"),
    join(stateDir(), "contract", "contract.md"),
    join(homeShare, "contract.md"),
    join(homeShare, "contract", "contract.md"),
    // brew-style: share next to binary prefix
    join(execDir, "..", "share", "droid-companion", "contract.md"),
    join(execDir, "share", "droid-companion", "contract.md"),
  ].filter((p): p is string => Boolean(p));
}

/**
 * Resolve contract.md for repo, state home, install layouts, or materialize embed.
 * Never returns null if embed is available — writes to stateDir when needed.
 */
export function resolveContractPath(): string | null {
  for (const candidate of contractCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  return materializeEmbeddedContract();
}

/** Write embedded contract into state dir; return path or null. */
export function materializeEmbeddedContract(): string | null {
  if (!EMBEDDED_CONTRACT) return null;
  try {
    ensureStateDir();
    const path = join(stateDir(), "contract.md");
    // Always refresh embed when missing; do not clobber a custom longer file blindly
    if (!existsSync(path)) {
      writeFileSync(path, EMBEDDED_CONTRACT.endsWith("\n") ? EMBEDDED_CONTRACT : EMBEDDED_CONTRACT + "\n");
    }
    return existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

/**
 * Cheap auth signal only — never reads secret contents into logs.
 * present: env key set OR known factory auth files exist
 * missing: neither
 * never claims "verified" without a live probe (not done by default).
 */
export function detectAuthPresence(): {
  status: "present" | "missing";
  signals: string[];
} {
  const signals: string[] = [];
  if (process.env.FACTORY_API_KEY?.trim()) {
    signals.push("FACTORY_API_KEY env set");
  }
  const factoryHome = join(homedir(), ".factory");
  const markers = [
    "auth.v2.file",
    "auth.v2.key",
    "auth.json",
    "auth.encrypted",
  ];
  for (const name of markers) {
    if (existsSync(join(factoryHome, name))) {
      signals.push(`~/.factory/${name} present`);
    }
  }
  return {
    status: signals.length > 0 ? "present" : "missing",
    signals,
  };
}
