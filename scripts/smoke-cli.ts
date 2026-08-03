#!/usr/bin/env bun
/**
 * CLI smoke without live droid exec (no spawn/send to models).
 * Uses a temp DROID_COMPANION_HOME so it never touches real session state.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const ROOT = join(import.meta.dir, "..");
const ENTRY = join(ROOT, "src", "companion.ts");
const HOME = mkdtempSync(join(tmpdir(), "droid-companion-smoke-"));

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function run(
  args: string[],
  opts: { expectCode?: number } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", ENTRY, ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      DROID_COMPANION_HOME: HOME,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  const expectCode = opts.expectCode ?? 0;
  if (code !== expectCode) {
    throw new Error(
      `command <${args.join(" ")}> exit <${code}> expected <${expectCode}>\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }
  return { code, stdout, stderr };
}

async function main(): Promise<void> {
  try {
    const help = await run(["--help"]);
    assert(help.stdout.includes("setup"), "help should list setup");
    assert(help.stdout.includes("droid-companion"), "help should name binary");
    console.log("ok: --help");

    const version = await run(["--version"]);
    assert(/^\d+\.\d+\.\d+/.test(version.stdout.trim()), `version: ${version.stdout}`);
    console.log(`ok: --version <${version.stdout.trim()}>`);

    const doctor = await run(["doctor"]);
    const doctorJson = JSON.parse(doctor.stdout) as { ok: boolean; version: string };
    assert(typeof doctorJson.ok === "boolean", "doctor.ok boolean");
    assert(doctorJson.version === version.stdout.trim(), "doctor version matches --version");
    console.log(`ok: doctor ok=<${doctorJson.ok}>`);

    // non-TTY defaults to machine JSON; --json makes it explicit
    const setup = await run(["setup", "--yes", "--skip-skill", "--json"]);
    const setupJson = JSON.parse(setup.stdout) as {
      ok: boolean;
      command: string;
      skill: { action: string };
    };
    assert(setupJson.command === "setup", "setup.command");
    assert(setupJson.skill.action === "skipped", "skip-skill action");
    assert(!setup.stdout.includes("Named multi-turn"), "json mode has no human banner");
    console.log("ok: setup --yes --skip-skill --json");

    const setupText = await run(["setup", "--yes", "--skip-skill", "--text"]);
    assert(setupText.stdout.includes("Environment"), "text mode has Environment");
    assert(setupText.stdout.includes("Next"), "text mode has Next");
    assert(setupText.stdout.includes("Ready.") || setupText.stdout.includes("Not ready"), "text mode footer");
    assert(!setupText.stdout.trimStart().startsWith("{"), "text mode is not JSON");
    console.log("ok: setup --yes --skip-skill --text");

    const skillTarget = join(HOME, "skills-out");
    mkdirSync(skillTarget, { recursive: true });
    const install = await run(["install-skill", "--target", skillTarget]);
    const installJson = JSON.parse(install.stdout) as { ok: boolean; skill?: string };
    assert(installJson.ok === true, "install-skill ok");
    console.log(`ok: install-skill → <${skillTarget}>`);

    const list = await run(["list"]);
    const listJson = JSON.parse(list.stdout) as {
      roster?: unknown[];
      sessions?: unknown[];
      olderThanMs?: number;
    };
    assert(listJson !== null && typeof listJson === "object", "list JSON object");
    assert(typeof listJson.olderThanMs === "number", "list.olderThanMs");
    console.log("ok: list");

    // Seed one stale + one fresh session for list --stale / --prune
    const now = Date.now();
    writeFileSync(
      join(HOME, "sessions.json"),
      JSON.stringify(
        [
          {
            sessionId: "sess-stale",
            name: "stale-one",
            createdAt: new Date(now - 20 * 86400000).toISOString(),
            lastUsedAt: new Date(now - 14 * 86400000).toISOString(),
            role: "old critic",
            lastResponse: "dusty answer",
          },
          {
            sessionId: "sess-fresh",
            name: "fresh-one",
            createdAt: new Date(now - 3600000).toISOString(),
            lastUsedAt: new Date(now - 60000).toISOString(),
            role: "new advisor",
          },
        ],
        null,
        2,
      ) + "\n",
    );

    const staleList = await run(["list", "--stale"]);
    const staleJson = JSON.parse(staleList.stdout) as {
      staleCount: number;
      stale: Array<{ name: string }>;
      roster: Array<{ name: string; jobId: string | null; idleForMs: number; stale: boolean }>;
      pruned: boolean;
    };
    assert(staleJson.staleCount === 1, `staleCount expected 1 got <${staleJson.staleCount}>`);
    assert(staleJson.stale[0]?.name === "stale-one", "stale name");
    assert(staleJson.pruned === false, "stale view does not prune");
    const staleRow = staleJson.roster.find((r) => r.name === "stale-one");
    assert(staleRow?.stale === true, "roster marks stale");
    assert(typeof staleRow?.idleForMs === "number", "roster.idleForMs");
    assert(staleRow?.jobId === null, "idle jobId null");
    console.log("ok: list --stale");

    const pruned = await run(["list", "--prune", "--older-than", "7d"]);
    const pruneJson = JSON.parse(pruned.stdout) as {
      pruned: boolean;
      prunedCount: number;
      prunedNames: string[];
      count: number;
      staleCount: number;
    };
    assert(pruneJson.pruned === true, "pruned true");
    assert(pruneJson.prunedCount === 1, "prunedCount 1");
    assert(pruneJson.prunedNames.includes("stale-one"), "prunedNames");
    assert(pruneJson.count === 1, "one session remains");
    console.log("ok: list --prune");

    // Unknown command → non-zero + JSON error
    const bad = await run(["not-a-command"], { expectCode: 1 });
    assert(bad.stderr.includes("Unknown command") || bad.stderr.includes("error"), "unknown cmd stderr");
    console.log("ok: unknown command fails");

    // Empty state file still listable
    writeFileSync(join(HOME, "sessions.json"), "[]\n");
    await run(["list"]);
    console.log("ok: list with empty sessions");

    console.log("all cli smoke checks passed");
  } finally {
    try {
      rmSync(HOME, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
