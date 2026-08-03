#!/usr/bin/env bun
/**
 * Dev entry: same CLI as companion.ts with isolated config + state.
 * Paths default to:
 *   ~/.config/droid-companion-dev/config.toml
 *   ~/.local/share/droid-companion-dev/
 *
 * Force via env: DROID_COMPANION_FLAVOR=dev
 * Or invoke this binary / script (basename droid-companion-dev).
 */
process.env.DROID_COMPANION_FLAVOR = "dev";
import "./companion";
