#!/usr/bin/env bun
/**
 * droid-companion — named multi-turn companion sessions for Factory Droid.
 *
 * Core: spawn / send / list / close / doctor
 * Jobs (--bg) planned next. Recipes deferred.
 */

import { parseArgs, parseFormat, positionalNonFlags, validateName } from "./lib/args";
import { DroidExecError } from "./lib/droid-exec";
import { PACKAGE_NAME, VERSION } from "./lib/paths";
import { readMessageInput } from "./lib/prompts";
import { cmdClose } from "./commands/close";
import { cmdDoctor } from "./commands/doctor";
import { cmdList } from "./commands/list";
import { cmdSend } from "./commands/send";
import { cmdSpawn } from "./commands/spawn";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

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
Binary name: companion

Usage:
  companion <command> [options]
  companion --help
  companion --version

Commands:
  doctor                 Check droid, contract, and state directory
  spawn --name NAME      Create a named companion
  send <name> …          Message a companion
  list [--stale|--prune] Roster / sessions (cheap health; no model pong)
  close <name>           Untrack a companion
  status / result        Background jobs [planned]

Interface:
  JSON for verbs/state. Files for paragraphs (--message-file, --brief).
  No internal kill timeout. Long work: --bg next (see docs/background-jobs.md).

spawn options:
  --name NAME (required)  --model ID  --auto LEVEL  --cwd PATH
  --system-prompt TEXT    --role TEXT  --tag NAME  --reasoning-effort L
  --brief PATH  --format prose|findings  --lite  --no-contract

send options:
  --message-file PATH|-  --images PATHS  --model ID  --auto LEVEL
  --cwd PATH  --brief PATH  --format prose|findings

close options:
  --purge                 Best-effort job cleanup when jobs exist

Docs: README.md · docs/
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
      case "doctor":
        await cmdDoctor();
        break;

      case "spawn": {
        const opts = parseArgs(rest);
        if (!opts.name || typeof opts.name !== "string") {
          die("Usage: spawn --name NAME [options]. --name is required.");
        }
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
          lite: opts.lite === true,
          format: parseFormat(opts.format),
          role:
            (opts.role as string | undefined) ??
            (opts["system-prompt"] as string | undefined),
        });
        break;
      }

      case "send": {
        const opts = parseArgs(rest);
        const positionals = positionalNonFlags(rest);
        const ref = positionals[0];
        if (!ref) die("Usage: send <name|sessionId> [message] [--message-file PATH]");
        if (opts.bg === true) {
          die(
            "send --bg is not implemented yet (see docs/background-jobs.md / bead 41g.4). Use foreground send or shell detach carefully without re-sending.",
          );
        }
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
        });
        break;
      }

      case "list": {
        const opts = parseArgs(rest);
        await cmdList({
          stale: opts.stale === true || opts.prune === true,
          prune: opts.prune === true,
          deep: opts.deep === true,
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

      case "status":
      case "result":
        die(
          `Command <${command}> is planned with background jobs (see docs/background-jobs.md).`,
        );
        break;

      case "discuss":
      case "jury":
      case "vision":
        die(
          `Recipe <${command}> is post-v0.1. Core product is named spawn/send/list/close.`,
        );
        break;

      default:
        die(`Unknown command: <${command}>. Run companion --help.`);
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
