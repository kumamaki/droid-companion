import { writeFileSync } from "fs";
import { DroidExecError, droidExec } from "../lib/droid-exec";
import {
  loadJob,
  saveJob,
  writeOutFile,
  type JobRecord,
} from "../lib/jobs";
import {
  buildPromptWithImages,
  withBrief,
  withFormat,
} from "../lib/prompts";
import { touchSession } from "../lib/state";

/**
 * Internal worker: companion _run-job <jobId>
 * No kill timeout. Writes result file + updates job record. Optional --on-done shell.
 */
export async function cmdRunJob(jobId: string): Promise<void> {
  const job = loadJob(jobId);
  if (!job) {
    console.error(JSON.stringify({ error: `Job not found: <${jobId}>` }));
    process.exit(1);
  }
  if (job.status !== "running") {
    // Idempotent re-entry
    process.exit(job.status === "done" ? 0 : 1);
  }

  const format = job.format ?? "prose";
  const prompt = withFormat(
    buildPromptWithImages(withBrief(job.message, job.brief, "send"), job.images),
    format,
  );

  const args: string[] = ["--session-id", job.sessionId];
  if (job.model) args.push("--model", job.model);
  if (job.auto) args.push("--auto", job.auto);
  if (job.cwd) args.push("--cwd", job.cwd);
  args.push(prompt);

  try {
    const result = await droidExec(args, {
      sessionId: job.sessionId,
      name: job.name,
    });

    const response = result.result ?? "";
    let responseFile = job.responseFile ?? null;
    if (responseFile) {
      writeFileSync(
        responseFile,
        response.endsWith("\n") ? response : response + "\n",
      );
    }

    const envelope = {
      sessionId: result.session_id ?? job.sessionId,
      name: job.name,
      response: responseFile ? "" : response,
      responseFile,
      isError: false,
      durationMs: result.duration_ms ?? null,
      brief: job.brief ?? null,
      cwd: job.cwd ?? null,
      auto: job.auto ?? null,
      format,
      jobId: job.jobId,
    };

    writeOutFile(job.outPath, envelope);
    touchSession(job.sessionId, {
      lastResponse: response,
      lastDurationMs: result.duration_ms,
      lastResponseFile: responseFile ?? undefined,
    });

    const done: JobRecord = {
      ...job,
      status: "done",
      finishedAt: new Date().toISOString(),
      result: envelope,
      error: null,
      responseFile,
    };
    saveJob(done);
    await runOnDone(done);
    process.exit(0);
  } catch (err) {
    const structured =
      err instanceof DroidExecError
        ? { ...err.structured }
        : {
            error: err instanceof Error ? err.message : String(err),
          };

    const failEnvelope = {
      ...structured,
      jobId: job.jobId,
      name: job.name,
      sessionId: job.sessionId,
      isError: true,
    };
    writeOutFile(job.outPath, failEnvelope);

    const failed: JobRecord = {
      ...job,
      status: "failed",
      finishedAt: new Date().toISOString(),
      result: null,
      error: failEnvelope,
    };
    saveJob(failed);
    await runOnDone(failed);
    process.exit(1);
  }
}

async function runOnDone(job: JobRecord): Promise<void> {
  if (!job.onDone?.trim()) return;
  try {
    const proc = Bun.spawn(["/bin/zsh", "-c", job.onDone], {
      cwd: job.cwd ?? process.cwd(),
      env: {
        ...process.env,
        COMPANION_JOB_ID: job.jobId,
        COMPANION_NAME: job.name,
        COMPANION_STATUS: job.status,
        COMPANION_OUT_PATH: job.outPath,
        COMPANION_SESSION_ID: job.sessionId,
        COMPANION_RESPONSE_FILE: job.responseFile ?? "",
      },
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
  } catch {
    // Hook failures must not crash the job outcome
  }
}
