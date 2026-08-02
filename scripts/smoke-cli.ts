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

    const setup = await run(["setup", "--yes", "--skip-skill"]);
    const setupJson = JSON.parse(setup.stdout) as {
      ok: boolean;
      command: string;
      skill: { action: string };
    };
    assert(setupJson.command === "setup", "setup.command");
    assert(setupJson.skill.action === "skipped", "skip-skill action");
    assert(setup.stderr.includes("Next commands"), "cheat sheet on stderr");
    console.log("ok: setup --yes --skip-skill");

    const skillTarget = join(HOME, "skills-out");
    mkdirSync(skillTarget, { recursive: true });
    const install = await run(["install-skill", "--target", skillTarget]);
    const installJson = JSON.parse(install.stdout) as { ok: boolean; skill?: string };
    assert(installJson.ok === true, "install-skill ok");
    console.log(`ok: install-skill → <${skillTarget}>`);

    const list = await run(["list"]);
    const listJson = JSON.parse(list.stdout) as { roster?: unknown; sessions?: unknown };
    assert(listJson !== null && typeof listJson === "object", "list JSON object");
    console.log("ok: list");

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
