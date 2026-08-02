import { removeJobsForSession } from "../lib/jobs";
import { removeSession, resolveSessionRef } from "../lib/state";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

export async function cmdClose(ref: string, opts: { purge?: boolean } = {}): Promise<void> {
  const tracked = resolveSessionRef(ref);
  let purgedJobs = 0;
  if (opts.purge) {
    purgedJobs = removeJobsForSession(tracked.sessionId);
  }
  removeSession(tracked.sessionId);

  output({
    sessionId: tracked.sessionId,
    name: tracked.name,
    closed: true,
    purged: opts.purge === true,
    purgedJobs,
    note: opts.purge
      ? "Untracked and attempted job cleanup (SIGTERM running workers + remove job files). Droid may still retain session data."
      : "Removed from companion tracking (untrack). Droid may still retain session data.",
  });
}
