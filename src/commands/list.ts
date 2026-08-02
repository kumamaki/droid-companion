import { loadSessions } from "../lib/state";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

/**
 * list / list --stale / list --prune
 * Cheap health only: no model pong (41g.10).
 * --stale/--prune currently report empty stale sets until job pids exist;
 * they never call droid exec for a probe.
 */
export async function cmdList(opts: {
  stale?: boolean;
  prune?: boolean;
  deep?: boolean;
}): Promise<void> {
  if (opts.deep) {
    throw new Error(
      "list --deep (model probe) is not implemented. Default health is cheap-only (no droid exec pong).",
    );
  }

  const sessions = loadSessions();
  const roster = sessions.map((s) => ({
    name: s.name,
    role: s.role ?? null,
    cwd: s.cwd ?? null,
    auto: s.auto ?? null,
    profile: s.profile ?? null,
    format: s.format ?? null,
    job: "idle" as const,
    lastUsedAt: s.lastUsedAt ?? s.createdAt,
    lastDurationMs: s.lastDurationMs ?? null,
    sessionId: s.sessionId,
  }));

  if (!opts.stale && !opts.prune) {
    output({
      sessions,
      count: sessions.length,
      roster,
    });
    return;
  }

  // Cheap path: we do not know droid session liveness without a model probe.
  // Report zero stale until job-pid tracking lands; never run sessionAlive pong.
  output({
    sessions,
    count: sessions.length,
    stale: [],
    staleCount: 0,
    pruned: false,
    roster,
    note:
      "Cheap health only: no model pong. stale[] empty until job pid tracking; use --deep later for paid probe.",
  });
}
