/** Shared human/TTY output helpers (setup, config show, list). */

import { homedir } from "os";

/** Optional stream probe so tests never couple to the host TTY. */
export type TtyProbe = {
  stdinIsTty?: boolean;
  stdoutIsTty?: boolean;
};

/**
 * Color decision inputs. Omit fields to read the live process.
 * Pass every field in tests so host env/TTY cannot flake ship.
 */
export type ColorProbe = {
  /** When true, color is off (NO_COLOR present). */
  noColorSet?: boolean;
  term?: string | undefined;
  stdoutIsTty?: boolean;
};

export function isTty(probe?: TtyProbe): boolean {
  const stdinIsTty = probe?.stdinIsTty ?? Boolean(process.stdin.isTTY);
  const stdoutIsTty = probe?.stdoutIsTty ?? Boolean(process.stdout.isTTY);
  return stdinIsTty && stdoutIsTty;
}

/**
 * Human mode: TTY by default, or --text.
 * Machine mode: --json, or non-TTY without --text.
 * `tty` overrides live detection (tests inject both branches).
 */
export function useHumanUi(opts: {
  json?: boolean;
  text?: boolean;
  /** Override isTty(); omit to probe process streams. */
  tty?: boolean;
}): boolean {
  if (opts.json) return false;
  if (opts.text) return true;
  return opts.tty ?? isTty();
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
export function colorEnabled(probe?: ColorProbe): boolean {
  const noColorSet =
    probe?.noColorSet ?? process.env.NO_COLOR !== undefined;
  if (noColorSet) return false;
  const term = probe && "term" in probe ? probe.term : process.env.TERM;
  if (term === "dumb") return false;
  const stdoutIsTty = probe?.stdoutIsTty ?? Boolean(process.stdout.isTTY);
  return stdoutIsTty;
}

/**
 * Paint with live color policy, or an explicit boolean / probe.
 * Render helpers pass a boolean so tests can force monochrome lines.
 */
export function paint(
  tone: Tone,
  text: string,
  color: boolean | ColorProbe = colorEnabled(),
): string {
  const on = typeof color === "boolean" ? color : colorEnabled(color);
  if (!on) return text;
  return `${CODES[tone]}${text}${CODES.reset}`;
}
