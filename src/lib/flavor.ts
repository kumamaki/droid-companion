import { basename } from "path";

/** Runtime product flavor. Dev uses isolated config + state. */
export type Flavor = "prod" | "dev";

/** Directory / binary slug for a flavor. */
export function appSlug(flavor: Flavor = resolveFlavor()): string {
  return flavor === "dev" ? "droid-companion-dev" : "droid-companion";
}

/** CLI name shown in help / doctor. */
export function cliBinaryName(flavor: Flavor = resolveFlavor()): string {
  return appSlug(flavor);
}

/**
 * Resolve flavor.
 * Precedence:
 *   1. DROID_COMPANION_FLAVOR=dev|prod (explicit win)
 *   2. Basename of argv[1] / argv[0] / execPath is `droid-companion-dev`
 *   3. prod
 *
 * Explicit env always wins so wrappers can force either flavor.
 */
export function resolveFlavor(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv,
  execPath: string = process.execPath,
): Flavor {
  const forced = env.DROID_COMPANION_FLAVOR?.trim().toLowerCase();
  if (forced === "dev") return "dev";
  if (forced === "prod" || forced === "production") return "prod";

  const candidates = [argv[1], argv[0], execPath].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  for (const candidate of candidates) {
    if (basenameLooksLikeDev(candidate)) return "dev";
  }
  return "prod";
}

function basenameLooksLikeDev(pathOrName: string): boolean {
  const base = basename(pathOrName)
    // strip common script suffixes when running from source
    .replace(/\.(ts|js|mjs|cjs)$/i, "");
  // Compiled/installed name + source entry (src/companion-dev.ts)
  return base === "droid-companion-dev" || base === "companion-dev";
}
