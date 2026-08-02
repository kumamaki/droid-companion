import { loadJob, reconcileJob, resolveJobRef } from "../lib/jobs";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

export async function cmdStatus(ref: string): Promise<void> {
  let job = resolveJobRef(ref);
  job = reconcileJob(job);
  // re-load after reconcile
  job = loadJob(job.jobId) ?? job;

  output({
    jobId: job.jobId,
    name: job.name,
    sessionId: job.sessionId,
    status: job.status,
    pid: job.pid ?? null,
    outPath: job.outPath,
    responseFile: job.responseFile ?? null,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt ?? null,
    idempotencyKey: job.idempotencyKey ?? null,
  });
}
