import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  getBuiltinPersona,
  mergePersonaPackage,
  type PersonaPackage,
} from "./personas";
import {
  inferDefaultAuto,
  MAX_POSITIONAL_MESSAGE_CHARS,
} from "./prompts";
import { DEFAULT_STALE_MS, parseDurationMs } from "./roster";
import type {
  ReplyFormat,
  SpawnOptions,
  SpawnPlan,
  ToolProfile,
} from "./types";

/** Built-in defaults when config is missing or a key is omitted. */
export const BUILTIN_STALE_AFTER = "7d";
export const BUILTIN_MAX_POSITIONAL_CHARS = MAX_POSITIONAL_MESSAGE_CHARS;

/** Sticky defaults that are not a full persona. */
export type ConfigDefaults = {
  /** Default persona name when spawn omits --persona */
  persona?: string;
  format?: ReplyFormat;
  toolProfile?: ToolProfile;
  auto?: string;
  cwd?: string;
  brief?: string;
  model?: string;
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
  defaults: ConfigDefaults;
  /** User-defined personas from [personas.*] (and legacy [profiles.*]). */
  personas: Record<string, PersonaPackage>;
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
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new Error(`Config ${label} must be a positive integer`);
  }
  return value;
}

function parseFormatField(value: unknown, label: string): ReplyFormat | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "prose" || value === "findings") return value;
  throw new Error(`Config ${label} must be prose|findings (reply shape)`);
}

function parseToolProfile(value: unknown, label: string): ToolProfile | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "full" || value === "lite") return value;
  throw new Error(`Config ${label} must be full|lite (tool surface)`);
}

function parseDefaults(raw: RawTable): ConfigDefaults {
  // persona preferred; legacy preset= maps to persona name
  const persona =
    optionalString(raw.persona, "[defaults].persona") ??
    optionalString(raw.preset, "[defaults].preset");

  const toolProfile =
    parseToolProfile(raw.tool_profile, "[defaults].tool_profile") ??
    parseToolProfile(raw.toolProfile, "[defaults].toolProfile") ??
    parseToolProfile(raw.profile, "[defaults].profile");

  return {
    persona,
    format: parseFormatField(raw.format, "[defaults].format"),
    toolProfile,
    auto: optionalString(raw.auto, "[defaults].auto"),
    cwd: optionalString(raw.cwd, "[defaults].cwd"),
    brief: optionalString(raw.brief, "[defaults].brief"),
    model: optionalString(raw.model, "[defaults].model"),
    reasoningEffort:
      optionalString(raw.reasoning_effort, "[defaults].reasoning_effort") ??
      optionalString(raw.reasoningEffort, "[defaults].reasoningEffort"),
    noContract:
      optionalBool(raw.no_contract, "[defaults].no_contract") ??
      optionalBool(raw.noContract, "[defaults].noContract"),
    tag: optionalString(raw.tag, "[defaults].tag"),
  };
}

/**
 * Parse one [personas.NAME] / legacy [profiles.NAME] table into a package.
 * Supports extends = "critic" to fork a built-in.
 */
function parsePersonaTable(
  name: string,
  raw: RawTable,
  label: string,
): PersonaPackage {
  const extendsName =
    optionalString(raw.extends, `${label}.extends`) ??
    optionalString(raw.preset, `${label}.preset`); // legacy: preset = "critic" meant base package

  const role =
    optionalString(raw.role, `${label}.role`) ??
    optionalString(raw.system_prompt, `${label}.system_prompt`) ??
    optionalString(raw.systemPrompt, `${label}.systemPrompt`);

  const toolProfile =
    parseToolProfile(raw.tool_profile, `${label}.tool_profile`) ??
    parseToolProfile(raw.toolProfile, `${label}.toolProfile`) ??
    parseToolProfile(raw.profile, `${label}.profile`);

  const format = parseFormatField(raw.format, `${label}.format`);
  const auto = optionalString(raw.auto, `${label}.auto`);
  const model = optionalString(raw.model, `${label}.model`);
  const cwd = optionalString(raw.cwd, `${label}.cwd`);
  const brief = optionalString(raw.brief, `${label}.brief`);
  const reasoningEffort =
    optionalString(raw.reasoning_effort, `${label}.reasoning_effort`) ??
    optionalString(raw.reasoningEffort, `${label}.reasoningEffort`);
  const noContract =
    optionalBool(raw.no_contract, `${label}.no_contract`) ??
    optionalBool(raw.noContract, `${label}.noContract`);
  const tag = optionalString(raw.tag, `${label}.tag`);

  let base: PersonaPackage | undefined;
  if (extendsName) {
    base = getBuiltinPersona(extendsName);
    if (!base) {
      throw new Error(
        `Config ${label}.extends unknown built-in persona <${extendsName}>. ` +
          `Use: critic|auditor|fixer|advisor`,
      );
    }
  }

  if (!base && !role) {
    throw new Error(
      `Config ${label} needs role=… or extends=<builtin persona>`,
    );
  }

  if (base) {
    return mergePersonaPackage(base, {
      name,
      source: "config",
      role,
      toolProfile,
      format,
      auto,
      model,
      cwd,
      brief,
      reasoningEffort,
      noContract,
      tag,
    });
  }

  // Pure custom persona — fill remaining defaults
  return {
    name,
    source: "config",
    role: role!,
    toolProfile: toolProfile ?? "full",
    format: format ?? "prose",
    auto,
    model,
    cwd,
    brief,
    reasoningEffort,
    noContract,
    tag,
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
    personas: {},
  };
}

function parsePersonaMap(
  raw: unknown,
  section: "personas" | "profiles",
): Record<string, PersonaPackage> {
  if (raw === undefined) return {};
  if (!isPlainObject(raw)) {
    throw new Error(`Config [${section}] must be a table of named packages`);
  }
  const out: Record<string, PersonaPackage> = {};
  for (const [name, body] of Object.entries(raw)) {
    if (!name.trim()) {
      throw new Error(`Config [${section}] name must be non-empty`);
    }
    if (/\s/.test(name)) {
      throw new Error(
        `Config [${section}.${name}] name must not contain whitespace`,
      );
    }
    if (!isPlainObject(body)) {
      throw new Error(`Config [${section}.${name}] must be a table`);
    }
    out[name] = parsePersonaTable(name, body, `[${section}.${name}]`);
  }
  return out;
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

  const defaultsTable: RawTable = isPlainObject(defaultsRaw) ? defaultsRaw : {};
  const sendRaw = defaultsTable.send;
  if (sendRaw !== undefined && !isPlainObject(sendRaw)) {
    throw new Error("Config [defaults.send] must be a table");
  }

  const defaults = parseDefaults(defaultsTable);

  const staleAfter =
    optionalString(defaultsTable.stale_after, "[defaults].stale_after") ??
    optionalString(defaultsTable.staleAfter, "[defaults].staleAfter") ??
    BUILTIN_STALE_AFTER;

  let staleAfterMs: number;
  try {
    staleAfterMs = parseDurationMs(staleAfter);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Config [defaults].stale_after: ${msg}`, { cause: err });
  }

  const sendTable = isPlainObject(sendRaw) ? sendRaw : {};
  const maxPositionalChars =
    optionalPositiveInt(
      sendTable.max_positional_chars,
      "[defaults.send].max_positional_chars",
    ) ??
    optionalPositiveInt(
      sendTable.maxPositionalChars,
      "[defaults.send].maxPositionalChars",
    ) ??
    BUILTIN_MAX_POSITIONAL_CHARS;

  // Canonical [personas.*]; legacy [profiles.*] still loads (same shape).
  const fromPersonas = parsePersonaMap(raw.personas, "personas");
  const fromProfiles = parsePersonaMap(raw.profiles, "profiles");
  const personas: Record<string, PersonaPackage> = {
    ...fromProfiles,
    ...fromPersonas, // personas win on name clash
  };

  return {
    path,
    exists: true,
    staleAfter,
    staleAfterMs,
    maxPositionalChars,
    defaults,
    personas,
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

/**
 * Resolve a persona by name: config first (so users can shadow built-ins),
 * then built-in.
 */
export function resolvePersona(
  config: CompanionConfig,
  name: string,
): PersonaPackage {
  const key = name.trim();
  if (!key) throw new Error("Persona name must be non-empty");

  const fromConfig = config.personas[key] ?? config.personas[key.toLowerCase()];
  if (fromConfig) return fromConfig;

  const builtin = getBuiltinPersona(key);
  if (builtin) return builtin;

  const known = [
    ...Object.keys(config.personas),
    ...["critic", "auditor", "fixer", "advisor"].filter(
      (b) => !config.personas[b],
    ),
  ];
  throw new Error(
    `Unknown persona <${key}>. Known: ${known.join(", ") || "(none)"}` +
      (config.path ? ` (config ${config.path})` : ""),
  );
}

function cliToolProfile(cli: SpawnOptions): ToolProfile | undefined {
  if (cli.toolProfile) return cli.toolProfile;
  if (cli.lite === true) return "lite";
  if (cli.lite === false) return "full";
  return undefined;
}

/**
 * Resolve full spawn plan.
 * Precedence: CLI > persona package > [defaults] > built-in fallbacks.
 * Role: CLI --role replaces persona role entirely (no stack).
 */
export function resolveSpawnPlan(
  cli: SpawnOptions,
  config: CompanionConfig,
): SpawnPlan {
  const personaName = cli.persona ?? config.defaults.persona;
  const persona = personaName ? resolvePersona(config, personaName) : undefined;

  // Role: CLI replaces; else persona; else nothing (contract-only possible)
  const role = cli.role ?? persona?.role;

  const toolProfile: ToolProfile =
    cliToolProfile(cli) ??
    persona?.toolProfile ??
    config.defaults.toolProfile ??
    "full";

  const format: ReplyFormat =
    cli.format ?? persona?.format ?? config.defaults.format ?? "prose";

  const auto =
    cli.auto ??
    persona?.auto ??
    config.defaults.auto ??
    inferDefaultAuto(role, toolProfile);

  return {
    name: cli.name,
    persona: persona?.name ?? null,
    personaSource: persona?.source ?? null,
    role,
    toolProfile,
    format,
    auto,
    model: cli.model ?? persona?.model ?? config.defaults.model,
    cwd: cli.cwd ?? persona?.cwd ?? config.defaults.cwd,
    brief: cli.brief ?? persona?.brief ?? config.defaults.brief,
    tag: cli.tag ?? persona?.tag ?? config.defaults.tag,
    reasoningEffort:
      cli.reasoningEffort ??
      persona?.reasoningEffort ??
      config.defaults.reasoningEffort,
    noContract:
      cli.noContract === true ||
      persona?.noContract === true ||
      config.defaults.noContract === true,
  };
}

/** Effective older-than string for list when CLI omits --older-than. */
export function effectiveStaleAfter(
  config: CompanionConfig,
  olderThanCli?: string,
): string {
  return olderThanCli?.trim() || config.staleAfter;
}

/** @deprecated use resolvePersona — kept for any stray imports during transition */
export function getNamedProfile(
  config: CompanionConfig,
  name: string,
): PersonaPackage {
  return resolvePersona(config, name);
}
