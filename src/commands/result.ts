import { loadJob, reconcileJob, resolveJobRef } from "../lib/jobs";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function cmdResult(
  ref: string,
  opts: { wait?: boolean; pollMs?: number } = {},
): Promise<void> {
  const pollMs = opts.pollMs && opts.pollMs > 0 ? opts.pollMs : 500;
  let job = resolveJobRef(ref);
  job = reconcileJob(job);
  job = loadJob(job.jobId) ?? job;

  if (opts.wait) {
    while (job.status === "running") {
      await sleep(pollMs);
      const fresh = loadJob(job.jobId);
      if (!fresh) {
        throw new Error(`Job disappeared: <${job.jobId}>`);
      }
      job = reconcileJob(fresh);
      job = loadJob(job.jobId) ?? job;
    }
  }

  if (job.status === "running") {
    console.error(
      JSON.stringify({
        error: `Job still running: <${job.jobId}> name <${job.name}>`,
        jobId: job.jobId,
        name: job.name,
        status: "running",
        hint: "Use result --wait, or poll status. Do not re-send the same ask.",
      }),
    );
    process.exit(1);
  }

  if (job.status === "done") {
    output(job.result ?? { jobId: job.jobId, name: job.name, status: "done" });
    return;
  }

  // failed
  console.error(
    JSON.stringify(
      job.error ?? {
        error: `Job failed: <${job.jobId}>`,
        jobId: job.jobId,
        name: job.name,
        status: "failed",
      },
    ),
  );
  process.exit(1);
}
