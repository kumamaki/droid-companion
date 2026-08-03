import { resolve } from "path";
import { droidExec } from "../lib/droid-exec";
import {
  defaultOutPath,
  findJobByIdempotencyKey,
  findRunningJobForName,
  newJobId,
  reconcileJob,
  saveJob,
  spawnDetachedWorker,
  type JobRecord,
} from "../lib/jobs";
import { ensureStateDir } from "../lib/paths";
import {
  buildPromptWithImages,
  resolveBriefPath,
  resolveCwd,
  withBrief,
  withFormat,
} from "../lib/prompts";
import { resolveSessionRef, touchSession } from "../lib/state";
import type { SendOptions } from "../lib/types";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

export async function cmdSend(
  ref: string,
  message: string,
  opts: SendOptions,
): Promise<void> {
  ensureStateDir();
  const tracked = resolveSessionRef(ref);
  const sessionId = tracked.sessionId;
  const name = tracked.name;
  const cwd = opts.cwd ? resolveCwd(opts.cwd) : tracked.cwd;
  const auto = opts.auto ?? tracked.auto;
  const format = opts.format ?? tracked.format ?? "prose";
  const briefPath = opts.brief
    ? resolveBriefPath(opts.brief, cwd)
    : tracked.brief;

  // Idempotency: return existing job/result for same key
  if (opts.idempotencyKey) {
    const existing = findJobByIdempotencyKey(opts.idempotencyKey);
    if (existing) {
      const job = reconcileJob(existing);
      if (job.status === "running") {
        output({
          jobId: job.jobId,
          name: job.name,
          sessionId: job.sessionId,
          pid: job.pid ?? null,
          outPath: job.outPath,
          responseFile: job.responseFile ?? null,
          status: "running",
          idempotencyKey: job.idempotencyKey,
          reused: true,
        });
        return;
      }
      if (job.status === "done" && job.result) {
        output({ ...job.result, reused: true, jobId: job.jobId });
        return;
      }
      if (job.status === "failed") {
        console.error(
          JSON.stringify({
            ...(job.error ?? { error: "Job failed" }),
            reused: true,
            jobId: job.jobId,
          }),
        );
        process.exit(1);
      }
    }
  }

  // Mutex: one running job per name
  const running = findRunningJobForName(name);
  if (running && !opts.force) {
    const job = reconcileJob(running);
    if (job.status === "running") {
      console.error(
        JSON.stringify({
          error: `Job already running for companion <${name}>`,
          jobId: job.jobId,
          name: job.name,
          sessionId: job.sessionId,
          pid: job.pid ?? null,
          status: "running",
          hint: "Use status/result (or result --wait). Pass --force only if you intentionally want a second concurrent send.",
        }),
      );
      process.exit(1);
    }
  }

  const patch: Parameters<typeof touchSession>[1] = {};
  if (opts.brief && briefPath) patch.brief = briefPath;
  if (opts.cwd && cwd) patch.cwd = cwd;
  if (opts.auto) patch.auto = opts.auto;
  if (opts.format) patch.format = opts.format;
  touchSession(sessionId, patch);

  if (opts.bg) {
    const jobId = newJobId();
    const outPath = opts.out
      ? opts.out.startsWith("/")
        ? opts.out
        : resolve(process.cwd(), opts.out)
      : defaultOutPath(jobId);
    const responseFile = opts.responseFile
      ? opts.responseFile.startsWith("/")
        ? opts.responseFile
        : resolve(process.cwd(), opts.responseFile)
      : null;

    const job: JobRecord = {
      jobId,
      name,
      sessionId,
      status: "running",
      outPath,
      responseFile,
      idempotencyKey: opts.idempotencyKey ?? null,
      onDone: opts.onDone ?? null,
      startedAt: new Date().toISOString(),
      message,
      images: opts.images,
      model: opts.model,
      auto,
      cwd,
      brief: briefPath,
      format,
      result: null,
      error: null,
    };
    saveJob(job);

    const pid = spawnDetachedWorker(jobId);
    const withPid: JobRecord = { ...job, pid };
    saveJob(withPid);

    output({
      jobId,
      name,
      sessionId,
      pid,
      outPath,
      responseFile,
      status: "running",
      idempotencyKey: opts.idempotencyKey ?? null,
    });
    return;
  }

  // Foreground
  const prompt = withFormat(
    buildPromptWithImages(withBrief(message, briefPath, "send"), opts.images),
    format,
  );

  const args: string[] = ["--session-id", sessionId];
  if (opts.model) args.push("--model", opts.model);
  if (auto) args.push("--auto", auto);
  if (cwd) args.push("--cwd", cwd);
  args.push(prompt);

  const result = await droidExec(args, {
    sessionId,
    name,
  });

  const response = result.result ?? "";
  let responseFile: string | null = null;
  if (opts.responseFile) {
    responseFile = opts.responseFile.startsWith("/")
      ? opts.responseFile
      : resolve(process.cwd(), opts.responseFile);
    const { writeFileSync } = await import("fs");
    writeFileSync(
      responseFile,
      response.endsWith("\n") ? response : response + "\n",
    );
  }

  touchSession(sessionId, {
    lastResponse: response,
    lastDurationMs: result.duration_ms,
    lastResponseFile: responseFile ?? undefined,
  });

  output({
    sessionId: result.session_id ?? sessionId,
    name,
    response: responseFile ? "" : response,
    responseFile,
    isError: result.is_error ?? false,
    durationMs: result.duration_ms ?? null,
    brief: briefPath ?? null,
    cwd: cwd ?? null,
    auto: auto ?? null,
    format,
  });
}
