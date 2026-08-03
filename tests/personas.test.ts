import { describe, expect, test } from "bun:test";
import {
  BUILTIN_PERSONA_NAMES,
  getBuiltinPersona,
  mergePersonaPackage,
  personaSummary,
} from "../src/lib/personas";

describe("built-in personas", () => {
  test("four sealed packages", () => {
    expect(BUILTIN_PERSONA_NAMES).toEqual([
      "critic",
      "auditor",
      "fixer",
      "advisor",
    ]);
    const critic = getBuiltinPersona("critic")!;
    expect(critic.toolProfile).toBe("lite");
    expect(critic.format).toBe("findings");
    expect(critic.auto).toBeUndefined();

    const fixer = getBuiltinPersona("fixer")!;
    expect(fixer.toolProfile).toBe("full");
    expect(fixer.format).toBe("prose");
    expect(fixer.auto).toBe("low");
  });

  test("summary lists all", () => {
    const s = personaSummary();
    for (const n of BUILTIN_PERSONA_NAMES) {
      expect(s).toContain(n);
    }
  });

  test("mergePersonaPackage replaces role", () => {
    const base = getBuiltinPersona("critic")!;
    const merged = mergePersonaPackage(base, {
      name: "mine",
      source: "config",
      role: "new voice",
      format: "prose",
    });
    expect(merged.role).toBe("new voice");
    expect(merged.format).toBe("prose");
    expect(merged.toolProfile).toBe("lite");
    expect(merged.name).toBe("mine");
  });
});
