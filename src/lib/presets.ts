import type { ReplyFormat, SpawnOptions, ToolProfile } from "./types";

export type PresetName = "critic" | "auditor" | "fixer" | "advisor";

export const PRESET_NAMES: PresetName[] = ["critic", "auditor", "fixer", "advisor"];

interface PresetDef {
  name: PresetName;
  systemPrompt: string;
  lite: boolean;
  format: ReplyFormat;
  /** When set, forces --auto; undefined means infer / read-only. */
  auto?: string;
  toolProfile: ToolProfile;
}

const PRESETS: Record<PresetName, PresetDef> = {
  critic: {
    name: "critic",
    systemPrompt:
      "You are a ruthless code reviewer. Prefer concrete findings with paths and severity. Challenge weak designs. No fluff.",
    lite: true,
    format: "findings",
    toolProfile: "lite",
  },
  auditor: {
    name: "auditor",
    systemPrompt:
      "You are a senior security auditor. Focus on auth, injection, secrets, TOCTOU, privilege boundaries, and data exposure. Be precise and skeptical.",
    lite: true,
    format: "findings",
    toolProfile: "lite",
  },
  fixer: {
    name: "fixer",
    systemPrompt:
      "You implement focused fixes. Smallest correct change. Read before you edit. Verify with the narrowest check you can run.",
    lite: false,
    format: "prose",
    auto: "low",
    toolProfile: "full",
  },
  advisor: {
    name: "advisor",
    systemPrompt:
      "You are a pragmatic senior engineer advisor. Clarify tradeoffs, recommend a path, and push back on bad framing. Prefer analysis over edits unless asked to implement.",
    lite: false,
    format: "prose",
    toolProfile: "full",
  },
};

export function parsePreset(value: unknown): PresetName | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`Invalid --preset. Use: ${PRESET_NAMES.join("|")}`);
  }
  const key = value.trim().toLowerCase() as PresetName;
  if (!PRESET_NAMES.includes(key)) {
    throw new Error(`Unknown --preset <${value}>. Use: ${PRESET_NAMES.join("|")}`);
  }
  return key;
}

/**
 * Apply preset defaults. Explicit CLI / config values win over preset
 * (lite/format/auto/systemPrompt already set stay).
 *
 * lite semantics:
 * - true  → force lite
 * - false → force full (do not take preset.lite)
 * - undefined → preset may set lite
 */
export function applyPreset(
  opts: SpawnOptions,
  presetName: PresetName,
): SpawnOptions {
  const preset = PRESETS[presetName];
  let lite: boolean | undefined;
  if (opts.lite === true) lite = true;
  else if (opts.lite === false) lite = false;
  else lite = preset.lite ? true : undefined;

  return {
    ...opts,
    systemPrompt: opts.systemPrompt ?? preset.systemPrompt,
    role: opts.role ?? opts.systemPrompt ?? preset.systemPrompt,
    lite,
    format: opts.format ?? preset.format,
    auto: opts.auto ?? preset.auto,
  };
}

export function presetSummary(): string {
  return PRESET_NAMES.map((n) => {
    const p = PRESETS[n];
    const flags = [
      p.lite ? "lite" : "full",
      p.format,
      p.auto ? `auto=${p.auto}` : "read-only-default",
    ].join(", ");
    return `  ${n.padEnd(8)} ${flags}`;
  }).join("\n");
}
