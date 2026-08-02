import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { ensureStateDir, stateDir } from "./paths";
import { withStateLock } from "./state";
import type { ReplyFormat } from "./types";

export type JobStatus = "running" | "done" | "failed";

export interface JobRecord {
  jobId: string;
  name: string;
  sessionId: string;
  status: JobStatus;
  pid?: number;
  outPath: string;
  responseFile?: string | null;
  idempotencyKey?: string | null;
  onDone?: string | null;
  startedAt: string;
  finishedAt?: string;
  message: string;
  images?: string[];
  model?: string;
  auto?: string;
  cwd?: string;
  brief?: string;
  format?: ReplyFormat;
  /** Final success envelope (send-shaped JSON). */
  result?: Record<string, unknown> | null;
  /** Structured failure payload. */
  error?: Record<string, unknown> | null;
}

export function jobsDir(): string {
  return join(stateDir(), "jobs");
}

export function jobFilePath(jobId: string): string {
  return join(jobsDir(), `${jobId}.json`);
}

function writeJsonAtomic(path: string, data: unknown): void {
  mkdirSync(jobsDir(), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  renameSync(tmp, path);
}

export function newJobId(): string {
  return crypto.randomUUID();
}

export function defaultOutPath(jobId: string): string {
  return join(jobsDir(), `${jobId}.out.json`);
}

export function loadJob(jobId: string): JobRecord | undefined {
  const path = jobFilePath(jobId);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as JobRecord;
  } catch {
    return undefined;
  }
}

export function saveJob(job: JobRecord): void {
  withStateLock(() => {
    writeJsonAtomic(jobFilePath(job.jobId), job);
  });
}

export function listJobs(): JobRecord[] {
  ensureStateDir();
  const dir = jobsDir();
  if (!existsSync(dir)) return [];
  const out: JobRecord[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json") || file.endsWith(".out.json") || file.includes(".tmp.")) {
      continue;
    }
    // job files are <uuid>.json; skip *.out.json already
    if (file.endsWith(".out.json")) continue;
    try {
      const job = JSON.parse(readFileSync(join(dir, file), "utf-8")) as JobRecord;
      if (job?.jobId) out.push(job);
    } catch {
      /* skip */
    }
  }
  return out;
}

export function findRunningJobForName(name: string): JobRecord | undefined {
  const needle = name.trim().toLowerCase();
  return listJobs().find(
    (j) => j.name.toLowerCase() === needle && j.status === "running",
  );
}

export function findJobByIdempotencyKey(key: string): JobRecord | undefined {
  const needle = key.trim();
  if (!needle) return undefined;
  // Prefer newest match
  const matches = listJobs()
    .filter((j) => j.idempotencyKey === needle)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return matches[0];
}

export function resolveJobRef(ref: string): JobRecord {
  const byId = loadJob(ref);
  if (byId) return byId;
  const needle = ref.trim().toLowerCase();
  const forName = listJobs()
    .filter((j) => j.name.toLowerCase() === needle)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  if (forName[0]) return forName[0];
  throw new Error(`No job for <${ref}> (jobId or companion name). Run list / status.`);
}

export function isPidAlive(pid: number | undefined): boolean {
  if (pid === undefined || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** If marked running but pid is dead, mark failed (cheap health). */
export function reconcileJob(job: JobRecord): JobRecord {
  if (job.status !== "running") return job;
  if (isPidAlive(job.pid)) return job;
  // Worker may have finished between checks — re-read disk
  const fresh = loadJob(job.jobId);
  if (fresh && fresh.status !== "running") return fresh;
  const failed: JobRecord = {
    ...(fresh ?? job),
    status: "failed",
    finishedAt: new Date().toISOString(),
    error: {
      error: `Job process not running (pid <${job.pid ?? "unknown"}> gone) without a completed result.`,
      hint: "Do not re-send blindly; inspect outPath or close + respawn if the session is wedged.",
    },
  };
  saveJob(failed);
  return failed;
}

export function removeJobsForSession(sessionId: string, opts: { onlyRunning?: boolean } = {}): number {
  let n = 0;
  for (const job of listJobs()) {
    if (job.sessionId !== sessionId) continue;
    if (opts.onlyRunning && job.status !== "running") continue;
    if (job.status === "running" && job.pid && isPidAlive(job.pid)) {
      try {
        process.kill(job.pid, "SIGTERM");
      } catch {
        /* ignore */
      }
    }
    try {
      unlinkSync(jobFilePath(job.jobId));
      n++;
    } catch {
      /* ignore */
    }
    if (job.outPath && existsSync(job.outPath)) {
      try {
        unlinkSync(job.outPath);
      } catch {
        /* ignore */
      }
    }
  }
  return n;
}

export function writeOutFile(outPath: string, payload: unknown): void {
  mkdirSync(jobsDir(), { recursive: true });
  const tmp = `${outPath}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n");
  renameSync(tmp, outPath);
}

/** Build argv to re-invoke this CLI as a detached worker. */
export function companionSelfArgv(extra: string[]): string[] {
  const entry = process.argv[1];
  // bun src/companion.ts …  OR  compiled binary
  if (entry && (entry.endsWith(".ts") || entry.endsWith(".js"))) {
    return [process.execPath, entry, ...extra];
  }
  return [process.execPath, ...extra];
}

export function spawnDetachedWorker(jobId: string): number {
  const argv = companionSelfArgv(["_run-job", jobId]);
  // Bun.spawn(string[]) form; unref so agent tool timeouts don't kill the worker.
  const proc = Bun.spawn(argv, {
    cwd: process.cwd(),
    env: process.env,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  proc.unref();
  if (typeof proc.pid !== "number") {
    throw new Error("Failed to spawn background job worker (no pid)");
  }
  return proc.pid;
}
