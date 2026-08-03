#!/usr/bin/env bun
/**
 * CLI smoke without live droid exec (no spawn/send to models).
 * Uses a temp DROID_COMPANION_HOME so it never touches real session state.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
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
      // Keep auto-materialized config inside the smoke temp dir
      DROID_COMPANION_CONFIG: join(HOME, "config.toml"),
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
    const doctorJson = JSON.parse(doctor.stdout) as {
      ok: boolean;
      version: string;
      flavor?: string;
      binary?: string;
    };
    assert(typeof doctorJson.ok === "boolean", "doctor.ok boolean");
    assert(doctorJson.version === version.stdout.trim(), "doctor version matches --version");
    assert(doctorJson.flavor === "prod", `doctor.flavor expected prod got <${doctorJson.flavor}>`);
    assert(
      doctorJson.binary === "droid-companion",
      `doctor.binary expected droid-companion got <${doctorJson.binary}>`,
    );
    // doctor loads config → materializes default config.toml under smoke home
    assert(
      existsSync(join(HOME, "config.toml")),
      "doctor should create config.toml via loadConfig",
    );
    console.log(`ok: doctor ok=<${doctorJson.ok}> flavor=<${doctorJson.flavor}>`);

    // Dev flavor via env on prod entry
    {
      const proc = Bun.spawn(["bun", ENTRY, "doctor"], {
        cwd: ROOT,
        env: {
          ...process.env,
          DROID_COMPANION_HOME: join(HOME, "dev-home"),
          DROID_COMPANION_CONFIG: join(HOME, "dev-config.toml"),
          DROID_COMPANION_FLAVOR: "dev",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const code = await proc.exited;
      if (code !== 0) {
        throw new Error(`dev doctor exit <${code}>\n${stdout}\n${stderr}`);
      }
      const devDoctor = JSON.parse(stdout) as {
        flavor: string;
        binary: string;
        checks: { stateDir: string; configPath: string };
      };
      assert(devDoctor.flavor === "dev", "dev doctor.flavor");
      assert(devDoctor.binary === "droid-companion-dev", "dev doctor.binary");
      assert(
        devDoctor.checks.stateDir.includes("dev-home"),
        `dev stateDir <${devDoctor.checks.stateDir}>`,
      );
      assert(
        devDoctor.checks.configPath.endsWith("dev-config.toml"),
        `dev configPath <${devDoctor.checks.configPath}>`,
      );
      assert(
        existsSync(join(HOME, "dev-config.toml")),
        "dev doctor materializes its own config",
      );
      console.log("ok: doctor with DROID_COMPANION_FLAVOR=dev");
    }

    // Dev entry file (just run-dev) — basename + env, no HOME override needed for flavor
    {
      const DEV_ENTRY = join(ROOT, "src", "companion-dev.ts");
      const proc = Bun.spawn(["bun", DEV_ENTRY, "--help"], {
        cwd: ROOT,
        env: {
          ...process.env,
          DROID_COMPANION_HOME: join(HOME, "dev-entry-home"),
          DROID_COMPANION_CONFIG: join(HOME, "dev-entry-config.toml"),
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const code = await proc.exited;
      if (code !== 0) {
        throw new Error(`dev entry --help exit <${code}>\n${stdout}\n${stderr}`);
      }
      assert(
        stdout.includes("Binary: droid-companion-dev"),
        `dev entry help binary line missing:\n${stdout.slice(0, 400)}`,
      );
      assert(
        stdout.includes("droid-companion-dev/config.toml"),
        `dev entry help config path missing:\n${stdout.slice(0, 800)}`,
      );
      console.log("ok: companion-dev.ts --help shows dev binary");
    }

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

    const cfgShow = await run(["config", "show"]);
    const cfgJson = JSON.parse(cfgShow.stdout) as {
      exists: boolean;
      created: boolean;
      staleAfter: string;
      maxPositionalChars: number;
      path: string;
    };
    // File was already created by doctor; this load must not rewrite it
    assert(cfgJson.exists === true, "config present");
    assert(cfgJson.created === false, "later load does not re-create");
    assert(typeof cfgJson.staleAfter === "string", "config show shape");
    assert(typeof cfgJson.maxPositionalChars === "number", "config maxPositionalChars");
    assert(cfgJson.path.includes(HOME), "config path under smoke home");
    console.log("ok: config show");

    const cfgText = await run(["config", "show", "--text"]);
    assert(cfgText.stdout.includes("Built-in personas"), "config --text human sections");
    assert(cfgText.stdout.includes("Defaults"), "config --text has Defaults");
    assert(!cfgText.stdout.trimStart().startsWith("{"), "config --text is not JSON");
    assert(!cfgText.stdout.includes("\u001b"), "config --text piped has no color escapes");
    console.log("ok: config show --text");

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

    const listText = await run(["list", "--text"]);
    assert(listText.stdout.includes("2 companions"), `list --text header: ${listText.stdout.slice(0, 200)}`);
    assert(listText.stdout.includes("stale-one"), "list --text shows names");
    assert(listText.stdout.includes("stale"), "list --text marks stale");
    assert(!listText.stdout.trimStart().startsWith("{"), "list --text is not JSON");
    assert(!listText.stdout.includes("\u001b"), "list --text piped has no color escapes");
    console.log("ok: list --text");

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
