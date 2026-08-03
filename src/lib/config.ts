import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parsePreset, type PresetName } from "./presets";
import { DEFAULT_STALE_MS, parseDurationMs } from "./roster";
import { MAX_POSITIONAL_MESSAGE_CHARS } from "./prompts";
import type { Profile, ReplyFormat, SpawnOptions } from "./types";

/** Built-in defaults when config is missing or a key is omitted. */
export const BUILTIN_STALE_AFTER = "7d";
export const BUILTIN_MAX_POSITIONAL_CHARS = MAX_POSITIONAL_MESSAGE_CHARS;

export type ConfigSpawnBundle = {
  preset?: PresetName;
  format?: ReplyFormat;
  /** Tool surface: full | lite */
  toolProfile?: Profile;
  systemPrompt?: string;
  role?: string;
  model?: string;
  auto?: string;
  cwd?: string;
  brief?: string;
  reasoningEffort?: string;
  noContract?: boolean;
  tag?: string;
};

export type CompanionConfig = {
  path: string | null;
  exists: boolean;
  staleAfter: string;
  staleAfterMs: number;
  maxPositionalChars: number;
  defaults: ConfigSpawnBundle;
  profiles: Record<string, ConfigSpawnBundle>;
};

type RawTable = Record<string, unknown>;

function isPlainObject(value: unknown): value is RawTable {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function configPath(): string {
  const override = process.env.DROID_COMPANION_CONFIG?.trim();
  if (override) return override;
  return join(homedir(), ".config", "droid-companion", "config.toml");
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error(`Config ${label} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalBool(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`Config ${label} must be a boolean`);
  }
  return value;
}

function optionalPositiveInt(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`Config ${label} must be a positive integer`);
  }
  return value;
}

function parseFormatField(value: unknown, label: string): ReplyFormat | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "prose" || value === "findings") return value;
  throw new Error(`Config ${label} must be prose|findings`);
}

function parseToolProfile(value: unknown, label: string): Profile | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "full" || value === "lite") return value;
  throw new Error(`Config ${label} must be full|lite (tool surface)`);
}

function parseSpawnBundle(raw: RawTable, label: string): ConfigSpawnBundle {
  const presetRaw = optionalString(raw.preset, `${label}.preset`);
  const preset = presetRaw ? parsePreset(presetRaw) : undefined;
  const systemPrompt =
    optionalString(raw.system_prompt, `${label}.system_prompt`) ??
    optionalString(raw.systemPrompt, `${label}.systemPrompt`);
  const role = optionalString(raw.role, `${label}.role`);
  const format = parseFormatField(raw.format, `${label}.format`);
  const toolProfile = parseToolProfile(raw.profile, `${label}.profile`);
  const noContract =
    optionalBool(raw.no_contract, `${label}.no_contract`) ??
    optionalBool(raw.noContract, `${label}.noContract`);

  return {
    preset,
    format,
    toolProfile,
    systemPrompt,
    role,
    model: optionalString(raw.model, `${label}.model`),
    auto: optionalString(raw.auto, `${label}.auto`),
    cwd: optionalString(raw.cwd, `${label}.cwd`),
    brief: optionalString(raw.brief, `${label}.brief`),
    reasoningEffort:
      optionalString(raw.reasoning_effort, `${label}.reasoning_effort`) ??
      optionalString(raw.reasoningEffort, `${label}.reasoningEffort`),
    noContract,
    tag: optionalString(raw.tag, `${label}.tag`),
  };
}

function emptyConfig(path: string | null, exists: boolean): CompanionConfig {
  return {
    path,
    exists,
    staleAfter: BUILTIN_STALE_AFTER,
    staleAfterMs: DEFAULT_STALE_MS,
    maxPositionalChars: BUILTIN_MAX_POSITIONAL_CHARS,
    defaults: {},
    profiles: {},
  };
}

/**
 * Parse and validate a TOML config document (already parsed object).
 * Pure helper for unit tests.
 */
export function parseConfigObject(
  raw: unknown,
  path: string | null,
): CompanionConfig {
  if (!isPlainObject(raw)) {
    throw new Error(
      `Config must be a TOML table${path ? ` at <${path}>` : ""}`,
    );
  }

  const defaultsRaw = raw.defaults;
  if (defaultsRaw !== undefined && !isPlainObject(defaultsRaw)) {
    throw new Error("Config [defaults] must be a table");
  }

  const defaultsTable = defaultsRaw ?? {};
  const sendRaw = isPlainObject(defaultsTable)
    ? (defaultsTable as RawTable).send
    : undefined;
  if (sendRaw !== undefined && !isPlainObject(sendRaw)) {
    throw new Error("Config [defaults.send] must be a table");
  }

  const defaultsBundle = isPlainObject(defaultsTable)
    ? parseSpawnBundle(defaultsTable as RawTable, "[defaults]")
    : {};

  const staleAfter =
    optionalString(
      isPlainObject(defaultsTable) ? (defaultsTable as RawTable).stale_after : undefined,
      "[defaults].stale_after",
    ) ??
    optionalString(
      isPlainObject(defaultsTable) ? (defaultsTable as RawTable).staleAfter : undefined,
      "[defaults].staleAfter",
    ) ??
    BUILTIN_STALE_AFTER;

  let staleAfterMs: number;
  try {
    staleAfterMs = parseDurationMs(staleAfter);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Config [defaults].stale_after: ${msg}`, { cause: err });
  }

  const maxPositionalChars =
    optionalPositiveInt(
      isPlainObject(sendRaw)
        ? (sendRaw as RawTable).max_positional_chars
        : undefined,
      "[defaults.send].max_positional_chars",
    ) ??
    optionalPositiveInt(
      isPlainObject(sendRaw)
        ? (sendRaw as RawTable).maxPositionalChars
        : undefined,
      "[defaults.send].maxPositionalChars",
    ) ??
    BUILTIN_MAX_POSITIONAL_CHARS;

  const profiles: Record<string, ConfigSpawnBundle> = {};
  const profilesRaw = raw.profiles;
  if (profilesRaw !== undefined) {
    if (!isPlainObject(profilesRaw)) {
      throw new Error("Config [profiles] must be a table of named bundles");
    }
    for (const [name, body] of Object.entries(profilesRaw)) {
      if (!name.trim()) {
        throw new Error("Config profile name must be non-empty");
      }
      if (/\s/.test(name)) {
        throw new Error(`Config profile name must not contain whitespace: <${name}>`);
      }
      if (!isPlainObject(body)) {
        throw new Error(`Config [profiles.${name}] must be a table`);
      }
      profiles[name] = parseSpawnBundle(body, `[profiles.${name}]`);
    }
  }

  return {
    path,
    exists: true,
    staleAfter,
    staleAfterMs,
    maxPositionalChars,
    defaults: defaultsBundle,
    profiles,
  };
}

/** Load config from disk. Missing file → built-ins. Bad TOML/schema → throws. */
export function loadConfig(path: string = configPath()): CompanionConfig {
  if (!existsSync(path)) {
    return emptyConfig(path, false);
  }
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read config <${path}>: ${msg}`, { cause: err });
  }
  if (!text.trim()) {
    return emptyConfig(path, true);
  }
  let parsed: unknown;
  try {
    parsed = Bun.TOML.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid TOML in config <${path}>: ${msg}`, { cause: err });
  }
  try {
    return parseConfigObject(parsed, path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${msg} (config <${path}>)`, { cause: err });
  }
}

export function getNamedProfile(
  config: CompanionConfig,
  name: string,
): ConfigSpawnBundle {
  const key = name.trim();
  const found = config.profiles[key];
  if (!found) {
    const known = Object.keys(config.profiles);
    throw new Error(
      `Unknown config profile <${key}>` +
        (known.length ? `. Known: ${known.join(", ")}` : ". No [profiles.*] in config.") +
        (config.path ? ` (${config.path})` : ""),
    );
  }
  return found;
}

/**
 * Resolve tool-surface lite flag.
 * true = force lite; false = force full (preset must not re-enable lite);
 * undefined = leave to built-in preset.
 */
function pickToolLite(
  cliLite: boolean | undefined,
  named: ConfigSpawnBundle | undefined,
  defaults: ConfigSpawnBundle,
): boolean | undefined {
  if (cliLite === true) return true;
  if (cliLite === false) return false;
  const fromNamed = named?.toolProfile;
  if (fromNamed === "lite") return true;
  if (fromNamed === "full") return false;
  const fromDefaults = defaults.toolProfile;
  if (fromDefaults === "lite") return true;
  if (fromDefaults === "full") return false;
  return undefined;
}

/**
 * Merge layers into spawn options.
 * Precedence: CLI > named profile > [defaults] > left empty for built-in preset later.
 *
 * `cli` should only contain fields the user actually set (undefined = not set).
 */
export function mergeSpawnOptions(
  cli: SpawnOptions,
  config: CompanionConfig,
  namedProfile?: ConfigSpawnBundle,
): SpawnOptions {
  const d = config.defaults;
  const n = namedProfile;

  const lite = pickToolLite(cli.lite, n, d);

  return {
    ...cli,
    preset: cli.preset ?? n?.preset ?? d.preset,
    format: cli.format ?? n?.format ?? d.format,
    lite,
    systemPrompt:
      cli.systemPrompt ??
      n?.systemPrompt ??
      n?.role ??
      d.systemPrompt ??
      d.role,
    role:
      cli.role ??
      n?.role ??
      n?.systemPrompt ??
      d.role ??
      d.systemPrompt,
    model: cli.model ?? n?.model ?? d.model,
    auto: cli.auto ?? n?.auto ?? d.auto,
    cwd: cli.cwd ?? n?.cwd ?? d.cwd,
    brief: cli.brief ?? n?.brief ?? d.brief,
    reasoningEffort:
      cli.reasoningEffort ?? n?.reasoningEffort ?? d.reasoningEffort,
    noContract:
      cli.noContract === true
        ? true
        : n?.noContract === true
          ? true
          : d.noContract === true
            ? true
            : cli.noContract,
    tag: cli.tag ?? n?.tag ?? d.tag,
  };
}

/** Effective older-than string for list when CLI omits --older-than. */
export function effectiveStaleAfter(
  config: CompanionConfig,
  olderThanCli?: string,
): string {
  return olderThanCli?.trim() || config.staleAfter;
}
