import { loadConfig } from "../lib/config";
import { listBuiltinPersonas } from "../lib/personas";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

/** Print resolved config (JSON control plane). */
export async function cmdConfigShow(): Promise<void> {
  const config = loadConfig();
  output({
    path: config.path,
    exists: config.exists,
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
