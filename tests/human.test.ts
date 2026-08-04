import { describe, expect, test } from "bun:test";
import { homedir } from "os";
import { renderConfigHuman } from "../src/commands/config-show";
import { renderRosterHuman } from "../src/commands/list";
import type { CompanionConfig } from "../src/lib/config";
import {
  colorEnabled,
  homePath,
  humanDuration,
  paint,
  useHumanUi,
} from "../src/lib/human";
import type { RosterEntry } from "../src/lib/roster";

describe("homePath", () => {
  test("collapses $HOME to ~", () => {
    expect(homePath(homedir())).toBe("~");
    expect(homePath(`${homedir()}/.config/x.toml`)).toBe("~/.config/x.toml");
  });

  test("leaves other paths alone", () => {
    expect(homePath("/tmp/x")).toBe("/tmp/x");
  });
});

describe("humanDuration", () => {
  test("compacts idle ages", () => {
    expect(humanDuration(5_000)).toBe("just now");
    expect(humanDuration(5 * 60_000)).toBe("5m");
    expect(humanDuration(3 * 3_600_000)).toBe("3h");
    expect(humanDuration(7 * 86_400_000)).toBe("7d");
  });
});

describe("useHumanUi", () => {
  test("--json always wins", () => {
    expect(useHumanUi({ json: true, text: true, tty: true })).toBe(false);
    expect(useHumanUi({ json: true, text: true, tty: false })).toBe(false);
  });

  test("--text forces human", () => {
    expect(useHumanUi({ text: true, tty: false })).toBe(true);
  });

  test("non-TTY default is machine", () => {
    expect(useHumanUi({ tty: false })).toBe(false);
  });

  test("TTY default is human", () => {
    expect(useHumanUi({ tty: true })).toBe(true);
  });
});

describe("colorEnabled / paint", () => {
  test("NO_COLOR disables color even on TTY", () => {
    expect(
      colorEnabled({ noColorSet: true, term: "xterm-256color", stdoutIsTty: true }),
    ).toBe(false);
  });

  test("TERM=dumb disables color even on TTY", () => {
    expect(
      colorEnabled({ noColorSet: false, term: "dumb", stdoutIsTty: true }),
    ).toBe(false);
  });

  test("non-TTY disables color", () => {
    expect(
      colorEnabled({
        noColorSet: false,
        term: "xterm-256color",
        stdoutIsTty: false,
      }),
    ).toBe(false);
  });

  test("TTY with normal term enables color", () => {
    expect(
      colorEnabled({
        noColorSet: false,
        term: "xterm-256color",
        stdoutIsTty: true,
      }),
    ).toBe(true);
  });

  test("paint is pass-through when color is false", () => {
    expect(paint("cyan", "hello", false)).toBe("hello");
  });

  test("paint wraps when color is true", () => {
    expect(paint("cyan", "hello", true)).toBe("\x1b[36mhello\x1b[0m");
  });
});

function fixtureConfig(overrides: Partial<CompanionConfig> = {}): CompanionConfig {
  return {
    path: `${homedir()}/.config/droid-companion/config.toml`,
    exists: true,
    created: false,
    staleAfter: "7d",
    staleAfterMs: 604_800_000,
    maxPositionalChars: 4000,
    defaults: {},
    personas: {},
    ...overrides,
  };
}

describe("renderConfigHuman", () => {
  test("renders sections without JSON or ANSI when monochrome", () => {
    const lines = renderConfigHuman(fixtureConfig(), "prod", { color: false });
    const text = lines.join("\n");
    expect(text).toContain("Files");
    expect(text).toContain("Defaults");
    expect(text).toContain("Built-in personas");
    expect(text).toContain("~/.config/droid-companion/config.toml");
    expect(text).toContain("stale_after");
    expect(text).toContain("critic");
    expect(text).toContain("none — add [personas.NAME]");
    expect(text).not.toContain("{");
    expect(text).not.toContain("\u001b");
  });

  test("lists user personas and defaults overrides", () => {
    const config = fixtureConfig({
      defaults: { persona: "critic" },
      personas: {
        review: {
          name: "review",
          source: "config",
          role: "r",
          toolProfile: "lite",
          format: "findings",
        },
      },
    });
    const text = renderConfigHuman(config, "prod", { color: false }).join("\n");
    expect(text).toContain("review");
    expect(text).toContain("lite · findings");
    expect(text).toContain("persona");
    expect(text).toContain("critic");
  });

  test("notes a freshly created config", () => {
    const text = renderConfigHuman(fixtureConfig({ created: true }), "prod", {
      color: false,
    }).join("\n");
    expect(text).toContain("created with starter defaults");
  });
});

function fixtureEntry(overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    name: "smoke",
    role: null,
    persona: "advisor",
    cwd: null,
    auto: null,
    toolProfile: "full",
    format: "prose",
    job: "idle",
    jobId: null,
    lastUsedAt: new Date().toISOString(),
    lastDurationMs: null,
    lastResponsePreview: null,
    lastResponseFile: null,
    idleForMs: 5 * 60_000,
    ageMs: 3_600_000,
    stale: false,
    sessionId: "sess-1",
    ...overrides,
  };
}

describe("renderRosterHuman", () => {
  test("renders roster lines without JSON or ANSI when monochrome", () => {
    const lines = renderRosterHuman([fixtureEntry()], {
      olderThanMs: 604_800_000,
      color: false,
    });
    const text = lines.join("\n");
    expect(text).toContain("1 companion · stale after 7d");
    expect(text).toContain("smoke");
    expect(text).toContain("advisor · full/prose");
    expect(text).toContain("idle");
    expect(text).toContain("last 5m");
    expect(text).not.toContain("{");
    expect(text).not.toContain("\u001b");
  });

  test("marks running jobs and stale companions", () => {
    const running = fixtureEntry({
      name: "busy",
      job: "running",
      jobId: "98f44da2-af24-43dd",
    });
    const stale = fixtureEntry({ name: "old", stale: true, idleForMs: 14 * 86_400_000 });
    const text = renderRosterHuman([running, stale], {
      olderThanMs: 604_800_000,
      color: false,
    }).join("\n");
    expect(text).toContain("running 98f44da2");
    expect(text).toContain("stale");
    expect(text).toContain("last 14d");
  });

  test("empty roster points at spawn", () => {
    const text = renderRosterHuman([], {
      olderThanMs: 604_800_000,
      color: false,
    }).join("\n");
    expect(text).toContain("No companions tracked.");
    expect(text).toContain("spawn --name smoke");
  });

  test("prune note lists removed names", () => {
    const text = renderRosterHuman([fixtureEntry()], {
      olderThanMs: 604_800_000,
      prunedNames: ["stale-one"],
      color: false,
    }).join("\n");
    expect(text).toContain("Pruned 1: stale-one");
  });
});
