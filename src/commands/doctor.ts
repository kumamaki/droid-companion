import { mkdirSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import {
  PACKAGE_NAME,
  VERSION,
  droidBin,
  ensureStateDir,
  resolveContractPath,
  stateDir,
} from "../lib/paths";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

async function checkDroid(): Promise<{
  ok: boolean;
  version?: string;
  detail?: string;
}> {
  try {
    const proc = Bun.spawn([droidBin(), "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const code = await proc.exited;
    const text = (stdout || stderr).trim();
    if (code !== 0) {
      return { ok: false, detail: text || `droid --version exited <${code}>` };
    }
    const version = text.split(/\s+/).pop() ?? text;
    return { ok: true, version, detail: text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: `droid not runnable: ${msg}` };
  }
}

function ensureWritable(dir: string): { ok: boolean; detail?: string } {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, ".write-probe");
    writeFileSync(probe, `${Date.now()}\n`);
    try {
      unlinkSync(probe);
    } catch {
      /* leave */
    }
    return { ok: true, detail: dir };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: msg };
  }
}

export async function cmdDoctor(): Promise<void> {
  const droid = await checkDroid();
  const contractPath = resolveContractPath();
  const dir = stateDir();
  const state = ensureWritable(dir);
  if (state.ok) ensureStateDir();

  // Auth is not verified by --version alone (see 41g.13).
  const authStatus = "notVerified";

  const criticalOk = droid.ok && state.ok && contractPath !== null;

  output({
    ok: criticalOk,
    version: VERSION,
    package: PACKAGE_NAME,
    checks: {
      droidOnPath: droid.ok,
      droidBin: droidBin(),
      droidVersion: droid.version ?? null,
      droidDetail: droid.detail ?? null,
      contractPresent: contractPath !== null,
      contractPath,
      stateDir: dir,
      stateDirWritable: state.ok,
      stateDirDetail: state.detail ?? null,
      authStatus,
      authNote:
        "droid --version does not prove login. A failed spawn/send with transport/auth errors means re-auth with droid.",
    },
    notes: [
      "Core: spawn / send / list / close.",
      "Background jobs (--bg) not implemented yet — see docs/background-jobs.md.",
      "Companion never applies an internal kill timeout to droid exec.",
    ],
  });

  // ok can be true while authStatus is notVerified — document honesty without hard-failing offline CI.
  process.exit(criticalOk ? 0 : 1);
}
