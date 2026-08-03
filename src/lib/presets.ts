/**
 * Compatibility shims for the old "preset" name.
 * Product term is now **persona** — see personas.ts.
 */
import {
  BUILTIN_PERSONA_NAMES,
  isBuiltinPersonaName,
  personaSummary,
  type BuiltinPersonaName,
} from "./personas";

/** @deprecated use BuiltinPersonaName */
export type PresetName = BuiltinPersonaName;

/** @deprecated use BUILTIN_PERSONA_NAMES */
export const PRESET_NAMES = BUILTIN_PERSONA_NAMES;

/** @deprecated use isBuiltinPersonaName / resolvePersona */
export function parsePreset(value: unknown): BuiltinPersonaName | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`Invalid persona. Use: ${BUILTIN_PERSONA_NAMES.join("|")}`);
  }
  const key = value.trim().toLowerCase();
  if (!isBuiltinPersonaName(key)) {
    throw new Error(
      `Unknown persona <${value}>. Use: ${BUILTIN_PERSONA_NAMES.join("|")}`,
    );
  }
  return key;
}

/** @deprecated use personaSummary */
export function presetSummary(): string {
  return personaSummary();
}
