import type { ReplyFormat, ToolProfile } from "./types";

/** Built-in persona names. */
export type BuiltinPersonaName = "critic" | "auditor" | "fixer" | "advisor";

export const BUILTIN_PERSONA_NAMES: BuiltinPersonaName[] = [
  "critic",
  "auditor",
  "fixer",
  "advisor",
];

/**
 * Sealed persona package.
 * role = full specialist voice (not stacked with another system prompt).
 * format = default reply shape (CLI may override).
 * toolProfile = default tool surface.
 * auto = optional sticky autonomy.
 */
export type PersonaPackage = {
  name: string;
  source: "builtin" | "config";
  role: string;
  toolProfile: ToolProfile;
  format: ReplyFormat;
  auto?: string;
  model?: string;
  cwd?: string;
  brief?: string;
  reasoningEffort?: string;
  noContract?: boolean;
  tag?: string;
};

const BUILTINS: Record<BuiltinPersonaName, PersonaPackage> = {
  critic: {
    name: "critic",
    source: "builtin",
    role:
      "You are a ruthless code reviewer. Prefer concrete findings with paths and severity. Challenge weak designs. No fluff.",
    toolProfile: "lite",
    format: "findings",
  },
  auditor: {
    name: "auditor",
    source: "builtin",
    role:
      "You are a senior security auditor. Focus on auth, injection, secrets, TOCTOU, privilege boundaries, and data exposure. Be precise and skeptical.",
    toolProfile: "lite",
    format: "findings",
  },
  fixer: {
    name: "fixer",
    source: "builtin",
    role:
      "You implement focused fixes. Smallest correct change. Read before you edit. Verify with the narrowest check you can run.",
    toolProfile: "full",
    format: "prose",
    auto: "low",
  },
  advisor: {
    name: "advisor",
    source: "builtin",
    role:
      "You are a pragmatic senior engineer advisor. Clarify tradeoffs, recommend a path, and push back on bad framing. Prefer analysis over edits unless asked to implement.",
    toolProfile: "full",
    format: "prose",
  },
};

export function isBuiltinPersonaName(name: string): name is BuiltinPersonaName {
  return (BUILTIN_PERSONA_NAMES as string[]).includes(name.trim().toLowerCase());
}

export function getBuiltinPersona(name: string): PersonaPackage | undefined {
  const key = name.trim().toLowerCase() as BuiltinPersonaName;
  if (!isBuiltinPersonaName(key)) return undefined;
  return { ...BUILTINS[key] };
}

export function listBuiltinPersonas(): PersonaPackage[] {
  return BUILTIN_PERSONA_NAMES.map((n) => ({ ...BUILTINS[n] }));
}

export function personaSummary(): string {
  return BUILTIN_PERSONA_NAMES.map((n) => {
    const p = BUILTINS[n];
    const flags = [
      p.toolProfile,
      p.format,
      p.auto ? `auto=${p.auto}` : "read-only-default",
    ].join(", ");
    return `  ${n.padEnd(8)} ${flags}`;
  }).join("\n");
}

/**
 * Apply optional field overrides onto a base package (config extends / CLI gaps).
 * Does not stack roles — override.role replaces base.role when set.
 */
export function mergePersonaPackage(
  base: PersonaPackage,
  override: Partial<PersonaPackage> & { name?: string; source?: "builtin" | "config" },
): PersonaPackage {
  return {
    name: override.name ?? base.name,
    source: override.source ?? base.source,
    role: override.role ?? base.role,
    toolProfile: override.toolProfile ?? base.toolProfile,
    format: override.format ?? base.format,
    auto: override.auto ?? base.auto,
    model: override.model ?? base.model,
    cwd: override.cwd ?? base.cwd,
    brief: override.brief ?? base.brief,
    reasoningEffort: override.reasoningEffort ?? base.reasoningEffort,
    noContract: override.noContract ?? base.noContract,
    tag: override.tag ?? base.tag,
  };
}
