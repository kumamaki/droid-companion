import type { ReplyFormat } from "./types";

export function parseArgs(argv: string[]): Record<string, string | string[] | boolean> {
  const parsed: Record<string, string | string[] | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        if (key === "images") {
          parsed[key] = next.split(",").map((s) => s.trim()).filter(Boolean);
        } else {
          parsed[key] = next;
        }
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }
  return parsed;
}

export function positionalNonFlags(argv: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) i++;
      continue;
    }
    out.push(arg);
  }
  return out;
}

export function parseFormat(value: unknown): ReplyFormat | undefined {
  if (value === undefined) return undefined;
  if (value === "prose" || value === "findings") return value;
  throw new Error(`Invalid --format <${value}>. Use prose|findings.`);
}

export function validateName(name: string): string {
  const normalized = name.trim();
  if (!normalized) throw new Error("Companion name must be non-empty");
  if (/\s/.test(normalized)) {
    throw new Error(`Companion name must not contain whitespace: <${normalized}>`);
  }
  if (normalized.length > 64) {
    throw new Error(`Companion name too long (max 64): <${normalized}>`);
  }
  return normalized;
}
