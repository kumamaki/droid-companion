import { removeSession, resolveSessionRef } from "../lib/state";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

export async function cmdClose(ref: string, opts: { purge?: boolean } = {}): Promise<void> {
  const tracked = resolveSessionRef(ref);
  removeSession(tracked.sessionId);

  // --purge: job cleanup lands with background jobs (41g.4 / 41g.14).
  const purged = false;
  if (opts.purge) {
    // No in-flight job registry yet; untrack is the available action.
  }

  output({
    sessionId: tracked.sessionId,
    name: tracked.name,
    closed: true,
    purged,
    note: opts.purge
      ? "Untracked. Job purge not fully implemented yet (no job registry). Droid may still retain session data."
      : "Removed from companion tracking (untrack). Droid may still retain session data.",
  });
}
