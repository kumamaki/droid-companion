import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  effectiveStaleAfter,
  getNamedProfile,
  loadConfig,
  mergeSpawnOptions,
  parseConfigObject,
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
    expect(cfg.profiles).toEqual({});
  });

  test("parses defaults + profiles", () => {
    const cfg = parseConfigObject(
      {
        defaults: {
          stale_after: "24h",
          preset: "advisor",
          format: "prose",
          tool_profile: "full",
          send: { max_positional_chars: 100 },
        },
        profiles: {
          review: {
            preset: "critic",
            format: "findings",
            tool_profile: "lite",
            system_prompt: "be mean",
          },
        },
      },
      "/tmp/c.toml",
    );
    expect(cfg.staleAfter).toBe("24h");
    expect(cfg.staleAfterMs).toBe(24 * 3_600_000);
    expect(cfg.maxPositionalChars).toBe(100);
    expect(cfg.defaults.preset).toBe("advisor");
    expect(cfg.defaults.toolProfile).toBe("full");
    expect(cfg.profiles.review.preset).toBe("critic");
    expect(cfg.profiles.review.toolProfile).toBe("lite");
    expect(cfg.profiles.review.systemPrompt).toBe("be mean");
  });

  test("legacy profile= still means tool_profile", () => {
    const cfg = parseConfigObject(
      { defaults: { profile: "lite" } },
      null,
    );
    expect(cfg.defaults.toolProfile).toBe("lite");
  });

  test("rejects bad format / stale / profile name", () => {
    expect(() =>
      parseConfigObject({ defaults: { format: "json" } }, null),
    ).toThrow(/prose\|findings/);
    expect(() =>
      parseConfigObject({ defaults: { stale_after: "week" } }, null),
    ).toThrow(/stale_after/);
    expect(() =>
      parseConfigObject({ profiles: { "bad name": { preset: "critic" } } }, null),
    ).toThrow(/whitespace/);
  });
});

describe("loadConfig", () => {
  test("missing file is ok", () => {
    const cfg = loadConfig(join(tmpdir(), "no-such-droid-companion-config.toml"));
    expect(cfg.exists).toBe(false);
    expect(cfg.staleAfter).toBe("7d");
  });

  test("reads real TOML file", () => {
    const dir = mkdtempSync(join(tmpdir(), "dc-cfg-"));
    const path = join(dir, "config.toml");
    writeFileSync(
      path,
      `
[defaults]
stale_after = "30m"
preset = "fixer"

[profiles.review]
preset = "critic"
tool_profile = "lite"
`,
    );
    const cfg = loadConfig(path);
    expect(cfg.exists).toBe(true);
    expect(cfg.staleAfterMs).toBe(30 * 60_000);
    expect(cfg.defaults.preset).toBe("fixer");
    expect(getNamedProfile(cfg, "review").preset).toBe("critic");
  });

  test("bad TOML fails hard", () => {
    const dir = mkdtempSync(join(tmpdir(), "dc-cfg-bad-"));
    const path = join(dir, "config.toml");
    writeFileSync(path, "[[[not toml");
    expect(() => loadConfig(path)).toThrow(/Invalid TOML|config/);
  });
});

describe("mergeSpawnOptions", () => {
  const cfg = parseConfigObject(
    {
      defaults: {
        preset: "advisor",
        format: "prose",
        tool_profile: "full",
        cwd: "/default",
      },
      profiles: {
        review: {
          preset: "critic",
          format: "findings",
          tool_profile: "lite",
          system_prompt: "reviewer",
        },
      },
    },
    null,
  );

  test("defaults fill when no profile/CLI", () => {
    const m = mergeSpawnOptions(baseCli(), cfg);
    expect(m.preset).toBe("advisor");
    expect(m.format).toBe("prose");
    expect(m.lite).toBe(false); // full → force not-lite
    expect(m.cwd).toBe("/default");
  });

  test("named profile beats defaults", () => {
    const m = mergeSpawnOptions(
      baseCli(),
      cfg,
      getNamedProfile(cfg, "review"),
    );
    expect(m.preset).toBe("critic");
    expect(m.format).toBe("findings");
    expect(m.lite).toBe(true);
    expect(m.systemPrompt).toBe("reviewer");
    expect(m.cwd).toBe("/default"); // still from defaults
  });

  test("CLI beats named profile", () => {
    const m = mergeSpawnOptions(
      baseCli({ format: "prose", lite: false, preset: "fixer" }),
      cfg,
      getNamedProfile(cfg, "review"),
    );
    expect(m.preset).toBe("fixer");
    expect(m.format).toBe("prose");
    expect(m.lite).toBe(false);
  });
});

describe("effectiveStaleAfter", () => {
  test("CLI wins over config", () => {
    const cfg = parseConfigObject({ defaults: { stale_after: "7d" } }, null);
    expect(effectiveStaleAfter(cfg, "1h")).toBe("1h");
    expect(effectiveStaleAfter(cfg, undefined)).toBe("7d");
  });
});
