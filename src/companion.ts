#!/usr/bin/env bun
/**
 * droid-companion — named multi-turn companion sessions for Factory Droid.
 *
 * Core: spawn / send / list / close / doctor / setup / install-skill
 * Jobs: send --bg / status / result / result --wait / _run-job
 * Recipes deferred.
 */

import { parseArgs, parseFormat, positionalNonFlags, validateName } from "./lib/args";
import { DroidExecError } from "./lib/droid-exec";
import { PACKAGE_NAME, VERSION } from "./lib/paths";
import { PRESET_NAMES, presetSummary } from "./lib/presets";
import { readMessageInput } from "./lib/prompts";
import { cmdClose } from "./commands/close";
import { cmdDoctor } from "./commands/doctor";
import { cmdInstallSkill } from "./commands/install-skill";
import { cmdList } from "./commands/list";
import { cmdResult } from "./commands/result";
import { cmdRunJob } from "./commands/run-job";
import { cmdSend } from "./commands/send";
import { cmdSetup } from "./commands/setup";
import { cmdSpawn } from "./commands/spawn";
import { cmdStatus } from "./commands/status";

function die(payload: string | Record<string, unknown>, exitCode = 1): never {
  if (typeof payload === "string") {
    console.error(JSON.stringify({ error: payload }));
  } else {
    console.error(JSON.stringify(payload));
  }
  process.exit(exitCode);
}

function printHelp(): void {
  console.log(`${PACKAGE_NAME} ${VERSION}

Named multi-turn companion sessions for Factory Droid.
Binary name: droid-companion

Usage:
  droid-companion <command> [options]
  droid-companion --help
  droid-companion --version

Commands:
  setup                  First-run wizard (doctor → skill → cheat sheet)
  doctor                 Check droid, contract, and state directory
  install-skill          Copy skill + contract into ~/.factory/skills
  spawn --name NAME      Create a named companion
  send <name> …          Message a companion
  list [--stale|--prune] Roster / sessions (cheap health; no model pong)
  close <name> [--purge] Untrack a companion
  status <jobId|name>    Background job status
  result <jobId|name>    Background job result [--wait]

setup options:
  --yes                  Non-interactive (install skill if missing and safe)
  --skip-skill           Doctor + cheat sheet only
  --target DIR           Skill install directory
  --json                 Machine output (JSON on stdout; default when non-TTY)
  --text                 Force human text (default on TTY)

Interface:
  JSON for verbs/state. Files for paragraphs (--message-file, --brief).
  Short pings may be positional; long content must use --message-file.
  No internal kill timeout. Long work: send --bg → status / result --wait.

spawn options:
  --name NAME (required)  --preset ${PRESET_NAMES.join("|")}
  --model ID  --auto LEVEL  --cwd PATH
  --system-prompt TEXT    --role TEXT  --tag NAME  --reasoning-effort L
  --brief PATH  --format prose|findings  --lite  --no-contract

presets:
${presetSummary()}

send options:
  send <name> "short message"   # short positional ok (max 4000 chars)
  --message-file PATH|-         # required for long / multi-line content
  --images PATHS  --model ID  --auto LEVEL
  --cwd PATH  --brief PATH  --format prose|findings
  --bg  --out PATH  --response-file PATH  --idempotency-key KEY
  --on-done CMD  --force

list options:
  --stale                 Show companions idle longer than --older-than
  --prune                 Untrack stale companions (never kills running jobs)
  --older-than DUR        Stale threshold (default 7d; e.g. 24h, 30m, ms)

result options:
  --wait  --poll-ms N

close options:
  --purge                 Stop running jobs + remove job files for that session

Docs: README.md · docs/ · examples/
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const rest = argv.slice(1);

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    process.exit(0);
  }

  if (command === "--version" || command === "-V" || command === "version") {
    console.log(VERSION);
    process.exit(0);
  }

  try {
    switch (command) {
      case "setup": {
        const opts = parseArgs(rest);
        await cmdSetup({
          yes: opts.yes === true,
          skipSkill: opts["skip-skill"] === true,
          target: opts.target as string | undefined,
          json: opts.json === true,
          text: opts.text === true,
        });
        break;
      }

      case "doctor":
        await cmdDoctor();
        break;

      case "install-skill": {
        const opts = parseArgs(rest);
        try {
          await cmdInstallSkill({
            target: opts.target as string | undefined,
            force: opts.force === true,
          });
        } catch (err) {
          // install-skill already wrote JSON error to stderr when refusing legacy
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes("legacy companion.ts")) {
            die({ error: msg }, 1);
          }
          process.exit(1);
        }
        break;
      }

      case "spawn": {
        const opts = parseArgs(rest);
        if (!opts.name || typeof opts.name !== "string") {
          die("Usage: spawn --name NAME [--preset critic|auditor|fixer|advisor] [options]");
        }
        // Detect explicit format/lite/auto so preset doesn't fight unknown — applyPreset
        // only fills undefined. parseFormat(undefined) is fine.
        const explicitFormat = parseFormat(opts.format);
        await cmdSpawn({
          name: validateName(opts.name),
          model: opts.model as string | undefined,
          auto: opts.auto as string | undefined,
          cwd: opts.cwd as string | undefined,
          systemPrompt:
            (opts["system-prompt"] as string | undefined) ??
            (opts.role as string | undefined),
          tag: opts.tag as string | undefined,
          reasoningEffort: opts["reasoning-effort"] as string | undefined,
          brief: opts.brief as string | undefined,
          noContract: opts["no-contract"] === true,
          lite: opts.lite === true ? true : undefined,
          format: explicitFormat,
          role:
            (opts.role as string | undefined) ??
            (opts["system-prompt"] as string | undefined),
          preset: opts.preset as string | undefined,
        });
        break;
      }

      case "send": {
        const opts = parseArgs(rest);
        const positionals = positionalNonFlags(rest);
        const ref = positionals[0];
        if (!ref) die("Usage: send <name|sessionId> [message] [--message-file PATH] [--bg]");
        const message = readMessageInput(
          positionals[1],
          opts["message-file"] as string | undefined,
          opts.cwd as string | undefined,
        );
        await cmdSend(ref, message, {
          images: opts.images as string[] | undefined,
          model: opts.model as string | undefined,
          auto: opts.auto as string | undefined,
          cwd: opts.cwd as string | undefined,
          brief: opts.brief as string | undefined,
          format: parseFormat(opts.format),
          bg: opts.bg === true,
          out: opts.out as string | undefined,
          responseFile: opts["response-file"] as string | undefined,
          idempotencyKey: opts["idempotency-key"] as string | undefined,
          onDone: opts["on-done"] as string | undefined,
          force: opts.force === true,
        });
        break;
      }

      case "list": {
        const opts = parseArgs(rest);
        await cmdList({
          stale: opts.stale === true || opts.prune === true,
          prune: opts.prune === true,
          deep: opts.deep === true,
          olderThan: opts["older-than"] as string | undefined,
        });
        break;
      }

      case "close": {
        const opts = parseArgs(rest);
        const ref = positionalNonFlags(rest)[0];
        if (!ref) die("Usage: close <name|sessionId> [--purge]");
        await cmdClose(ref, { purge: opts.purge === true });
        break;
      }

      case "status": {
        const ref = positionalNonFlags(rest)[0];
        if (!ref) die("Usage: status <jobId|name>");
        await cmdStatus(ref);
        break;
      }

      case "result": {
        const opts = parseArgs(rest);
        const ref = positionalNonFlags(rest)[0];
        if (!ref) die("Usage: result <jobId|name> [--wait] [--poll-ms N]");
        const pollMs = opts["poll-ms"]
          ? parseInt(String(opts["poll-ms"]), 10)
          : undefined;
        await cmdResult(ref, {
          wait: opts.wait === true,
          pollMs: Number.isFinite(pollMs) ? pollMs : undefined,
        });
        break;
      }

      case "_run-job": {
        const jobId = positionalNonFlags(rest)[0];
        if (!jobId) die("Usage: _run-job <jobId>");
        await cmdRunJob(jobId);
        break;
      }

      case "discuss":
      case "jury":
      case "vision":
        die(
          `Recipe <${command}> is post-v0.1. Core product is named spawn/send/list/close.`,
        );
        break;

      default:
        die(`Unknown command: <${command}>. Run droid-companion --help.`);
    }
  } catch (err) {
    if (err instanceof DroidExecError) {
      die({ ...err.structured }, 1);
    }
    const msg = err instanceof Error ? err.message : String(err);
    die({ error: msg }, 1);
  }
}

main();
