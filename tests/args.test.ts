import { describe, expect, test } from "bun:test";
import {
  parseArgs,
  parseFormat,
  positionalNonFlags,
  validateName,
} from "../src/lib/args";

describe("parseArgs", () => {
  test("boolean flags and valued flags", () => {
    const opts = parseArgs([
      "--bg",
      "--yes",
      "--skip-skill",
      "--name",
      "audit",
      "--target",
      "/tmp/x",
    ]);
    expect(opts.bg).toBe(true);
    expect(opts.yes).toBe(true);
    expect(opts["skip-skill"]).toBe(true);
    expect(opts.name).toBe("audit");
    expect(opts.target).toBe("/tmp/x");
  });

  test("images splits comma list", () => {
    const opts = parseArgs(["--images", "a.png,b.png"]);
    expect(opts.images).toEqual(["a.png", "b.png"]);
  });
});

describe("positionalNonFlags", () => {
  test("skips flag values", () => {
    expect(positionalNonFlags(["send", "--bg", "audit", "hi"])).toEqual([
      "send",
      "audit",
      "hi",
    ]);
    expect(
      positionalNonFlags(["--name", "x", "spawn", "--lite"]),
    ).toEqual(["spawn"]);
  });
});

describe("validateName", () => {
  test("accepts simple names", () => {
    expect(validateName("audit")).toBe("audit");
    expect(validateName("  r1  ")).toBe("r1");
  });

  test("rejects empty, whitespace, overlong", () => {
    expect(() => validateName("")).toThrow();
    expect(() => validateName("   ")).toThrow();
    expect(() => validateName("has space")).toThrow(/whitespace/);
    expect(() => validateName("x".repeat(65))).toThrow(/too long/);
  });
});

describe("parseFormat", () => {
  test("prose|findings|undefined", () => {
    expect(parseFormat(undefined)).toBeUndefined();
    expect(parseFormat("prose")).toBe("prose");
    expect(parseFormat("findings")).toBe("findings");
    expect(() => parseFormat("json")).toThrow(/Invalid --format/);
  });
});
