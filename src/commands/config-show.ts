import { loadConfig } from "../lib/config";

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
    profiles: config.profiles,
    profileNames: Object.keys(config.profiles),
  });
}
