import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  effectiveStaleAfter,
  loadConfig,
  parseConfigObject,
  resolvePersona,
  resolveSpawnPlan,
} from "../src/lib/config";
import type { SpawnOptions } from "../src/lib/types";

function baseCli(partial: Partial<SpawnOptions> = {}): SpawnOptions {
  return { name: "x", ...partial };
}

describe("parseConfigObject", () => {
  test("empty object uses built-ins", () => {
    const cfg = parseConfigObject({}, null);
    expect(cfg.staleAfter).toBe("7d");
    expect(cfg.staleAfterMs).toBe(7 * 86_400_000);
    expect(cfg.maxPositionalChars).toBe(4000);
    expect(cfg.personas).toEqual({});
  });

  test("parses defaults + personas", () => {
    const cfg = parseConfigObject(
      {
        defaults: {
          stale_after: "24h",
          persona: "advisor",
          format: "prose",
          tool_profile: "full",
          send: { max_positional_chars: 100 },
        },
        personas: {
          review: {
            role: "be mean",
            format: "findings",
            tool_profile: "lite",
          },
        },
      },
      "/tmp/c.toml",
    );
    expect(cfg.staleAfter).toBe("24h");
    expect(cfg.staleAfterMs).toBe(24 * 3_600_000);
    expect(cfg.maxPositionalChars).toBe(100);
    expect(cfg.defaults.persona).toBe("advisor");
    expect(cfg.defaults.toolProfile).toBe("full");
    expect(cfg.personas.review.role).toBe("be mean");
    expect(cfg.personas.review.toolProfile).toBe("lite");
    expect(cfg.personas.review.format).toBe("findings");
  });

  test("extends builtin persona", () => {
    const cfg = parseConfigObject(
      {
        personas: {
          fix: { extends: "fixer", cwd: "/work" },
        },
      },
      null,
    );
    const p = cfg.personas.fix;
    expect(p.role).toContain("focused fixes");
    expect(p.toolProfile).toBe("full");
    expect(p.format).toBe("prose");
    expect(p.auto).toBe("low");
    expect(p.cwd).toBe("/work");
    expect(p.source).toBe("config");
  });

  test("legacy profiles + preset still load", () => {
    const cfg = parseConfigObject(
      {
        defaults: { preset: "advisor", profile: "lite" },
        profiles: {
          old: { preset: "critic", system_prompt: "override voice" },
        },
      },
      null,
    );
    expect(cfg.defaults.persona).toBe("advisor");
    expect(cfg.defaults.toolProfile).toBe("lite");
    expect(cfg.personas.old.role).toBe("override voice");
    expect(cfg.personas.old.toolProfile).toBe("lite");
    expect(cfg.personas.old.format).toBe("findings");
  });

  test("rejects bad format / stale / persona name", () => {
    expect(() =>
      parseConfigObject({ defaults: { format: "json" } }, null),
    ).toThrow(/prose\|findings/);
    expect(() =>
      parseConfigObject({ defaults: { stale_after: "week" } }, null),
    ).toThrow(/stale_after/);
    expect(() =>
      parseConfigObject(
        { personas: { "bad name": { role: "x" } } },
        null,
      ),
    ).toThrow(/whitespace/);
  });
});

describe("loadConfig", () => {
  test("missing file is materialized once", () => {
    const dir = mkdtempSync(join(tmpdir(), "dc-cfg-miss-"));
    const path = join(dir, "nested", "config.toml");
    const first = loadConfig(path);
    expect(first.exists).toBe(true);
    expect(first.created).toBe(true);
    expect(first.staleAfter).toBe("7d");
    expect(existsSync(path)).toBe(true);

    const second = loadConfig(path);
    expect(second.exists).toBe(true);
    expect(second.created).toBe(false);
    expect(second.staleAfterMs).toBe(7 * 86_400_000);
  });

  test("does not overwrite existing file", () => {
    const dir = mkdtempSync(join(tmpdir(), "dc-cfg-keep-"));
    const path = join(dir, "config.toml");
    writeFileSync(
      path,
      `
[defaults]
stale_after = "30m"
persona = "fixer"

[personas.review]
extends = "critic"
`,
    );
    const cfg = loadConfig(path);
    expect(cfg.exists).toBe(true);
    expect(cfg.created).toBe(false);
    expect(cfg.staleAfterMs).toBe(30 * 60_000);
    expect(cfg.defaults.persona).toBe("fixer");
    expect(resolvePersona(cfg, "review").format).toBe("findings");
  });

  test("bad TOML fails hard", () => {
    const dir = mkdtempSync(join(tmpdir(), "dc-cfg-bad-"));
    const path = join(dir, "config.toml");
    writeFileSync(path, "[[[not toml");
    expect(() => loadConfig(path)).toThrow(/Invalid TOML|config/);
  });
});

describe("resolveSpawnPlan", () => {
  const cfg = parseConfigObject(
    {
      defaults: {
        persona: "advisor",
        cwd: "/default",
      },
      personas: {
        review: {
          role: "custom reviewer",
          tool_profile: "lite",
          format: "findings",
        },
      },
    },
    null,
  );

  test("defaults pick persona when CLI omits", () => {
    const plan = resolveSpawnPlan(baseCli(), cfg);
    expect(plan.persona).toBe("advisor");
    expect(plan.personaSource).toBe("builtin");
    expect(plan.toolProfile).toBe("full");
    expect(plan.format).toBe("prose");
    expect(plan.cwd).toBe("/default");
    expect(plan.role).toContain("advisor");
  });

  test("config persona beats defaults", () => {
    const plan = resolveSpawnPlan(baseCli({ persona: "review" }), cfg);
    expect(plan.persona).toBe("review");
    expect(plan.personaSource).toBe("config");
    expect(plan.role).toBe("custom reviewer");
    expect(plan.toolProfile).toBe("lite");
    expect(plan.format).toBe("findings");
  });

  test("CLI role replaces persona role (no stack)", () => {
    const plan = resolveSpawnPlan(
      baseCli({ persona: "review", role: "only this voice" }),
      cfg,
    );
    expect(plan.role).toBe("only this voice");
    expect(plan.role).not.toContain("custom reviewer");
    // package still supplies tool/format unless overridden
    expect(plan.toolProfile).toBe("lite");
    expect(plan.format).toBe("findings");
  });

  test("CLI format and tool-profile override persona", () => {
    const plan = resolveSpawnPlan(
      baseCli({
        persona: "review",
        format: "prose",
        toolProfile: "full",
      }),
      cfg,
    );
    expect(plan.format).toBe("prose");
    expect(plan.toolProfile).toBe("full");
  });

  test("builtin critic", () => {
    const plan = resolveSpawnPlan(
      baseCli({ persona: "critic" }),
      parseConfigObject({}, null),
    );
    expect(plan.persona).toBe("critic");
    expect(plan.format).toBe("findings");
    expect(plan.toolProfile).toBe("lite");
    expect(plan.auto).toBeUndefined();
  });

  test("unknown persona errors", () => {
    expect(() =>
      resolveSpawnPlan(baseCli({ persona: "nope" }), cfg),
    ).toThrow(/Unknown persona/);
  });
});

describe("effectiveStaleAfter", () => {
  test("CLI wins over config", () => {
    const cfg = parseConfigObject({ defaults: { stale_after: "7d" } }, null);
    expect(effectiveStaleAfter(cfg, "1h")).toBe("1h");
    expect(effectiveStaleAfter(cfg, undefined)).toBe("7d");
  });
});
