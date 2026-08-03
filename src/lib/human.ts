/** Shared human/TTY output helpers (setup, config show, list). */

import { homedir } from "os";

export function isTty(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Human mode: TTY by default, or --text.
 * Machine mode: --json, or non-TTY without --text.
 */
export function useHumanUi(opts: { json?: boolean; text?: boolean }): boolean {
  if (opts.json) return false;
  if (opts.text) return true;
  return isTty();
}

/** Collapse $HOME to ~ for human display. */
export function homePath(path: string): string {
  const home = homedir();
  if (path === home) return "~";
  if (path.startsWith(home + "/")) return "~" + path.slice(home.length);
  return path;
}

/** Compact idle/age phrasing for rosters: just now · 5m · 3h · 7d. */
export function humanDuration(ms: number): string {
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const CODES = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
} as const;

export type Tone = keyof typeof CODES;

/**
 * Colors only on a real terminal. NO_COLOR (any value) and TERM=dumb win;
 * piped/--text output stays clean so redirecting never captures escapes.
 */
export function colorEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.TERM === "dumb") return false;
  return Boolean(process.stdout.isTTY);
}

export function paint(tone: Tone, text: string): string {
  if (!colorEnabled()) return text;
  return `${CODES[tone]}${text}${CODES.reset}`;
}
