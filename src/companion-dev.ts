#!/usr/bin/env bun
/**
 * Dev entry: same CLI as companion.ts with isolated config + state.
 * Paths default to:
 *   ~/.config/droid-companion-dev/config.toml
 *   ~/.local/share/droid-companion-dev/
 *
 * Force via env: DROID_COMPANION_FLAVOR=dev
 * Or invoke this binary / script (basename droid-companion-dev | companion-dev).
 *
 * Note: static `import` is hoisted before statements, so env is set first and
 * companion is loaded via dynamic import. Basename detection is a second line
 * of defense when the env set is skipped.
 */
export const isDevEntry = true;

process.env.DROID_COMPANION_FLAVOR = "dev";
await import("./companion");
