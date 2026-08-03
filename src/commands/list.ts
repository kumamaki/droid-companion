import { effectiveStaleAfter, loadConfig } from "../lib/config";
import { findRunningJobForName, reconcileJob } from "../lib/jobs";
import {
  buildRosterEntry,
  parseDurationMs,
  selectStaleEntries,
  type RosterEntry,
} from "../lib/roster";
import { loadSessions, removeSessions } from "../lib/state";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

/**
 * list / list --stale / list --prune
 * Cheap health only: no model pong.
 * Stale = idle longer than --older-than (config defaults.stale_after or 7d).
 * Running jobs are never stale.
 */
export async function cmdList(opts: {
  stale?: boolean;
  prune?: boolean;
  deep?: boolean;
  olderThan?: string;
}): Promise<void> {
  if (opts.deep) {
    throw new Error(
      "list --deep (model probe) is not implemented. Default health is cheap-only (no droid exec pong).",
    );
  }

  const config = loadConfig();
  const olderThan = effectiveStaleAfter(config, opts.olderThan);
  const olderThanMs = parseDurationMs(olderThan);
  const nowMs = Date.now();
  const sessions = loadSessions();

  const roster: RosterEntry[] = sessions.map((s) => {
    const found = findRunningJobForName(s.name);
    const reconciled = found ? reconcileJob(found) : undefined;
    const running = reconciled?.status === "running" ? reconciled : undefined;
    return buildRosterEntry(s, running, nowMs, olderThanMs);
  });

  const wantStaleView = opts.stale === true || opts.prune === true;
  if (!wantStaleView) {
    output({
      sessions,
      count: sessions.length,
      roster,
      olderThanMs,
    });
    return;
  }

  const stale = selectStaleEntries(roster);
  let pruned: string[] = [];
  if (opts.prune && stale.length > 0) {
    const removed = removeSessions(stale.map((entry) => entry.sessionId));
    pruned = removed.map((s) => s.name);
  }

  const remainingSessions = opts.prune ? loadSessions() : sessions;
  const remainingRoster = opts.prune
    ? remainingSessions.map((s) => {
        const found = findRunningJobForName(s.name);
        const reconciled = found ? reconcileJob(found) : undefined;
        const running = reconciled?.status === "running" ? reconciled : undefined;
        return buildRosterEntry(s, running, nowMs, olderThanMs);
      })
    : roster;

  output({
    sessions: remainingSessions,
    count: remainingSessions.length,
    roster: remainingRoster,
    stale: stale.map((entry) => ({
      name: entry.name,
      sessionId: entry.sessionId,
      lastUsedAt: entry.lastUsedAt,
      idleForMs: entry.idleForMs,
    })),
    staleCount: stale.length,
    pruned: opts.prune === true,
    prunedNames: pruned,
    prunedCount: pruned.length,
    olderThanMs,
    note:
      "Cheap health only: no model pong. Stale = idle longer than olderThanMs with no running job. prune untracks only (does not kill droid sessions or running jobs).",
  });
}
