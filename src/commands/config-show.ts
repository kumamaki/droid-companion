import { loadConfig, type CompanionConfig } from "../lib/config";
import { colorEnabled, homePath, paint, useHumanUi } from "../lib/human";
import {
  PACKAGE_NAME,
  VERSION,
  appSlug,
  cliBinaryName,
  resolveFlavor,
  stateDir,
} from "../lib/paths";
import { listBuiltinPersonas, type PersonaPackage } from "../lib/personas";

type ShowOptions = {
  /** Force JSON control-plane output. */
  json?: boolean;
  /** Force human text even when non-TTY. */
  text?: boolean;
};

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

function personaLine(persona: PersonaPackage, color: boolean): string {
  const traits: string[] = [persona.toolProfile, persona.format];
  if (persona.auto) traits.push(`auto ${persona.auto}`);
  return `${paint("bold", persona.name.padEnd(9), color)}${paint("dim", traits.join(" · "), color)}`;
}

/**
 * Human rendering as a pure function.
 * Pass `color: false` in tests so host TTY cannot inject ANSI.
 */
export function renderConfigHuman(
  config: CompanionConfig,
  flavor: string,
  opts: { color?: boolean } = {},
): string[] {
  const color = opts.color ?? colorEnabled();
  const lines: string[] = [];
  lines.push(`${PACKAGE_NAME} ${VERSION} · ${flavor}`);
  lines.push("");

  lines.push(paint("cyan", "Files", color));
  const configLabel = config.path ? homePath(config.path) : "(unknown path)";
  const configNote = config.created
    ? " (created with starter defaults)"
    : config.exists
      ? ""
      : " (missing — using built-ins)";
  lines.push(`  config   ${paint("dim", configLabel + configNote, color)}`);
  lines.push(`  state    ${paint("dim", homePath(stateDir()), color)}`);
  lines.push("");

  lines.push(paint("cyan", "Defaults", color));
  lines.push(`  stale_after            ${config.staleAfter}`);
  lines.push(`  max_positional_chars   ${config.maxPositionalChars}`);
  for (const [key, value] of Object.entries(config.defaults)) {
    if (value === undefined) continue;
    lines.push(`  ${key.padEnd(23)}${String(value)}`);
  }
  lines.push("");

  lines.push(paint("cyan", "Personas", color));
  const names = Object.keys(config.personas);
  if (names.length === 0) {
    lines.push(paint("dim", "  none — add [personas.NAME] to config.toml", color));
  } else {
    for (const name of names) {
      lines.push(`  ${personaLine(config.personas[name], color)}`);
    }
  }
  lines.push("");

  lines.push(paint("cyan", "Built-in personas", color));
  for (const persona of listBuiltinPersonas()) {
    lines.push(`  ${personaLine(persona, color)}`);
  }
  return lines;
}

/**
 * Print resolved config.
 * Human (TTY or --text): rendered sections. Machine (non-TTY or --json): JSON.
 */
export async function cmdConfigShow(opts: ShowOptions = {}): Promise<void> {
  const config = loadConfig();
  const flavor = resolveFlavor();

  if (useHumanUi(opts)) {
    console.log(renderConfigHuman(config, flavor).join("\n"));
    return;
  }

  output({
    flavor,
    binary: cliBinaryName(flavor),
    appSlug: appSlug(flavor),
    stateDir: stateDir(),
    path: config.path,
    exists: config.exists,
    created: config.created,
    staleAfter: config.staleAfter,
    staleAfterMs: config.staleAfterMs,
    maxPositionalChars: config.maxPositionalChars,
    defaults: config.defaults,
    personas: config.personas,
    personaNames: Object.keys(config.personas),
    builtinPersonas: listBuiltinPersonas().map((p) => ({
      name: p.name,
      toolProfile: p.toolProfile,
      format: p.format,
      auto: p.auto ?? null,
    })),
  });
}
