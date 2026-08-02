import { findRunningJobForName, reconcileJob } from "../lib/jobs";
import { loadSessions } from "../lib/state";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

/**
 * list / list --stale / list --prune
 * Cheap health only: no model pong (41g.10).
 * job: idle|running from job registry + pid.
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
  const roster = sessions.map((s) => {
    let jobState: "idle" | "running" = "idle";
    const running = findRunningJobForName(s.name);
    if (running) {
      const j = reconcileJob(running);
      if (j.status === "running") jobState = "running";
    }
    return {
      name: s.name,
      role: s.role ?? null,
      cwd: s.cwd ?? null,
      auto: s.auto ?? null,
      profile: s.profile ?? null,
      format: s.format ?? null,
      job: jobState,
      lastUsedAt: s.lastUsedAt ?? s.createdAt,
      lastDurationMs: s.lastDurationMs ?? null,
      lastResponsePreview: s.lastResponse
        ? s.lastResponse.slice(0, 120)
        : null,
      sessionId: s.sessionId,
    };
  });

  if (!opts.stale && !opts.prune) {
    output({
      sessions,
      count: sessions.length,
      roster,
    });
    return;
  }

  output({
    sessions,
    count: sessions.length,
    stale: [],
    staleCount: 0,
    pruned: false,
    roster,
    note:
      "Cheap health only: no model pong. stale[] empty for droid session liveness; job busy shown via roster.job.",
  });
}
