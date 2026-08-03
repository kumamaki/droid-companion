import { describe, expect, test } from "bun:test";
import {
  MAX_POSITIONAL_MESSAGE_CHARS,
  assertPositionalMessageSize,
  readMessageInput,
} from "../src/lib/prompts";
import { mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("assertPositionalMessageSize", () => {
  test("allows short messages", () => {
    expect(() => assertPositionalMessageSize("quick ping")).not.toThrow();
    expect(() =>
      assertPositionalMessageSize("x".repeat(MAX_POSITIONAL_MESSAGE_CHARS)),
    ).not.toThrow();
  });

  test("rejects oversized positional", () => {
    expect(() =>
      assertPositionalMessageSize("x".repeat(MAX_POSITIONAL_MESSAGE_CHARS + 1)),
    ).toThrow(/--message-file/);
  });

  test("respects custom max", () => {
    expect(() => assertPositionalMessageSize("hello", 3)).toThrow(/max <3>/);
    expect(() => assertPositionalMessageSize("hi", 3)).not.toThrow();
  });
});

describe("readMessageInput", () => {
  test("positional short path", () => {
    expect(readMessageInput("hello", undefined)).toBe("hello");
  });

  test("positional too long", () => {
    expect(() =>
      readMessageInput("x".repeat(MAX_POSITIONAL_MESSAGE_CHARS + 1), undefined),
    ).toThrow(/--message-file/);
  });

  test("message-file bypasses size guard", () => {
    const dir = mkdtempSync(join(tmpdir(), "droid-companion-msg-"));
    const path = join(dir, "long.md");
    const body = "y".repeat(MAX_POSITIONAL_MESSAGE_CHARS + 50);
    writeFileSync(path, body + "\n");
    expect(readMessageInput(undefined, path)).toBe(body);
  });

  test("message-file wins over positional", () => {
    const dir = mkdtempSync(join(tmpdir(), "droid-companion-msg-"));
    const path = join(dir, "ask.md");
    writeFileSync(path, "from file\n");
    expect(readMessageInput("positional ignored", path)).toBe("from file");
  });

  test("requires a message", () => {
    expect(() => readMessageInput(undefined, undefined)).toThrow(/Message required/);
  });
});
