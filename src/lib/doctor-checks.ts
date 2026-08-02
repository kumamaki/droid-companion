import { mkdirSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import {
  PACKAGE_NAME,
  VERSION,
  contractCandidates,
  detectAuthPresence,
  droidBin,
  ensureStateDir,
  materializeEmbeddedContract,
  resolveContractPath,
  stateDir,
} from "./paths";

export type DoctorCheckResult = {
  ok: boolean;
  version: string;
  package: string;
  checks: {
    droidOnPath: boolean;
    droidBin: string;
    droidVersion: string | null;
    droidDetail: string | null;
    contractPresent: boolean;
    contractPath: string | null;
    contractCandidates: string[];
    contractEmbedAvailable: boolean;
    stateDir: string;
    stateDirWritable: boolean;
    stateDirDetail: string | null;
    droidCompanionHome: string | null;
    authStatus: "credentialsPresent" | "credentialsMissing";
    authVerified: false;
    authSignals: string[];
    authNote: string;
  };
  notes: string[];
};

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

/** Shared environment checks for `doctor` and `setup`. */
export async function runDoctorChecks(): Promise<DoctorCheckResult> {
  const droid = await checkDroid();
  let contractPath = resolveContractPath();
  if (!contractPath) {
    contractPath = materializeEmbeddedContract();
  }
  const dir = stateDir();
  const state = ensureWritable(dir);
  if (state.ok) ensureStateDir();

  const auth = detectAuthPresence();
  const authStatus =
    auth.status === "present" ? "credentialsPresent" : "credentialsMissing";

  const criticalOk = droid.ok && state.ok && contractPath !== null;

  return {
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
      contractCandidates: contractCandidates(),
      contractEmbedAvailable: true,
      stateDir: dir,
      stateDirWritable: state.ok,
      stateDirDetail: state.detail ?? null,
      droidCompanionHome: process.env.DROID_COMPANION_HOME ?? null,
      authStatus,
      authVerified: false,
      authSignals: auth.signals,
      authNote:
        auth.status === "present"
          ? "Auth material present (env and/or ~/.factory auth files). Not a live login probe — spawn/send can still fail if credentials are stale."
          : "No FACTORY_API_KEY and no ~/.factory auth files found. Login with droid or set credentials before spawn.",
    },
    notes: [
      "ok:true does not mean auth is verified — see authStatus / authVerified.",
      "Background: send --bg · status · result --wait · mutex · idempotency-key · --on-done.",
      "Companion never applies an internal kill timeout to droid exec.",
    ],
  };
}
