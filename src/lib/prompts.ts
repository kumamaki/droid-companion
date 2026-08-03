import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { promptsDir, resolveContractPath } from "./paths";
import type { Profile, ReplyFormat } from "./types";

export const FINDINGS_FORMAT_INSTRUCTION = [
  "Reply format: FINDINGS.",
  "Use a flat list only. Each finding one line:",
  "`severity` · `path:line` · claim",
  "Severity one of: critical | high | medium | low | info | note.",
  "After findings, optional residual risks as plain lines.",
  "No preamble. No nested bullets.",
].join(" ");

export const LITE_INSTRUCTION = [
  "LITE profile: pure analysis/critique.",
  "Do not load skills or MCP.",
  "Do not edit files or run mutating commands.",
  "Prefer short, high-signal answers grounded in provided paths/context.",
].join(" ");

export function loadContractText(): string {
  const path = resolveContractPath();
  if (!path) {
    throw new Error(
      "Companion contract missing. Expected contract/contract.md in the install or repo. Run doctor.",
    );
  }
  return readFileSync(path, "utf-8").trim();
}

export function resolveBriefPath(brief: string, cwd?: string): string {
  const resolved = brief.startsWith("/")
    ? brief
    : join(cwd ?? process.cwd(), brief);
  if (!existsSync(resolved)) {
    throw new Error(`Brief file not found: <${resolved}>`);
  }
  return resolved;
}

export function resolveCwd(cwd?: string): string | undefined {
  if (!cwd) return undefined;
  const resolved = resolve(cwd);
  if (!existsSync(resolved)) {
    throw new Error(`Working directory not found: <${resolved}>`);
  }
  return resolved;
}

export function buildBriefInstruction(briefPath: string, mode: "spawn" | "send"): string {
  if (mode === "spawn") {
    return [
      `Read the brief at ${briefPath} using your Read tool.`,
      "Internalize Goal, Constraints, Artifacts, and Ask.",
      "Acknowledge readiness in one short sentence. Do not answer the Ask yet.",
    ].join(" ");
  }
  return [
    `Read the brief at ${briefPath} using your Read tool if it is not already in your context.`,
    "Treat Goal / Constraints / Artifacts as ground truth for this turn.",
  ].join(" ");
}

export function withBrief(
  message: string,
  briefPath?: string,
  mode: "spawn" | "send" = "send",
): string {
  if (!briefPath) return message;
  const instruction = buildBriefInstruction(briefPath, mode);
  if (!message.trim()) return instruction;
  return `${instruction}\n\n${message}`;
}

export function withFormat(message: string, format?: ReplyFormat): string {
  if (!format || format === "prose") return message;
  return `${FINDINGS_FORMAT_INSTRUCTION}\n\n${message}`;
}

export function buildPromptWithImages(message: string, images?: string[]): string {
  if (!images || images.length === 0) return message;
  const imageList = images.map((p) => `  - ${p}`).join("\n");
  return `${message}\n\nPlease read and analyze the following image file(s) using your Read tool:\n${imageList}`;
}

export function composeSystemPrompt(parts: Array<string | undefined>): string | undefined {
  const joined = parts.filter(Boolean).join("\n\n").trim();
  return joined || undefined;
}

export function inferDefaultAuto(roleText?: string, profile?: Profile): string | undefined {
  if (profile === "lite") return undefined;
  if (!roleText) return undefined;
  const text = roleText.toLowerCase();
  if (/\b(implement|fix|patch|refactor|write code|edit|ship|code changes?)\b/.test(text)) {
    return "low";
  }
  return undefined;
}

/** Write system prompt to a state-dir file for --append-system-prompt-file. */
export function writeSystemPromptFile(name: string, contents: string): string {
  const safe = name.replace(/[^\w.-]+/g, "_").slice(0, 64);
  const path = join(promptsDir(), `${safe}-system-${Date.now()}.md`);
  writeFileSync(path, contents.endsWith("\n") ? contents : contents + "\n");
  return path;
}

/**
 * Built-in max characters for a positional send message.
 * Longer content must use --message-file (interface: files for paragraphs).
 * Overridable via config [defaults.send].max_positional_chars.
 */
export const MAX_POSITIONAL_MESSAGE_CHARS = 4000;

export function assertPositionalMessageSize(
  message: string,
  maxChars: number = MAX_POSITIONAL_MESSAGE_CHARS,
): void {
  if (message.length <= maxChars) return;
  throw new Error(
    `Positional message too long (<${message.length}> chars; max <${maxChars}>). ` +
      `Put paragraphs in a file and pass --message-file PATH (or --message-file - for stdin).`,
  );
}

export function readMessageInput(
  positional: string | undefined,
  messageFile: string | undefined,
  cwd?: string,
  maxPositionalChars: number = MAX_POSITIONAL_MESSAGE_CHARS,
): string {
  if (messageFile) {
    const path =
      messageFile === "-"
        ? null
        : messageFile.startsWith("/")
          ? messageFile
          : join(cwd ?? process.cwd(), messageFile);
    if (path === null) {
      const text = readFileSync(0, "utf-8");
      if (!text.trim()) throw new Error("Empty message on stdin");
      return text.replace(/\n$/, "");
    }
    if (!existsSync(path)) throw new Error(`Message file not found: <${path}>`);
    const text = readFileSync(path, "utf-8");
    if (!text.trim()) throw new Error(`Message file empty: <${path}>`);
    return text.replace(/\n$/, "");
  }
  if (positional !== undefined && positional !== "") {
    assertPositionalMessageSize(positional, maxPositionalChars);
    return positional;
  }
  throw new Error(
    "Message required (short positional, --message-file PATH, or --message-file - for stdin)",
  );
}
