import { effectiveStaleAfter, loadConfig } from "../lib/config";
import { homePath, humanDuration, paint, useHumanUi } from "../lib/human";
import { findRunningJobForName, reconcileJob } from "../lib/jobs";
import {
  buildRosterEntry,
  parseDurationMs,
  selectStaleEntries,
  type RosterEntry,
} from "../lib/roster";
import { loadSessions, removeSessions } from "../lib/state";
import type { SessionRecord } from "../lib/types";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

function currentRoster(
  sessions: SessionRecord[],
  nowMs: number,
  olderThanMs: number,
): RosterEntry[] {
  return sessions.map((session) => {
    const found = findRunningJobForName(session.name);
    const reconciled = found ? reconcileJob(found) : undefined;
    const running = reconciled?.status === "running" ? reconciled : undefined;
    return buildRosterEntry(session, running, nowMs, olderThanMs);
  });
}

function truncateRole(role: string | null): string | null {
  if (!role) return null;
  const firstLine = role.split("\n")[0].trim();
  if (!firstLine) return null;
  return firstLine.length > 40 ? `${firstLine.slice(0, 39)}…` : firstLine;
}

function rosterLine(entry: RosterEntry, nameWidth: number): string {
  const name = paint("bold", entry.name.padEnd(nameWidth));
  const identity = entry.persona ?? truncateRole(entry.role) ?? "custom";
  const shape = [entry.toolProfile, entry.format].filter(Boolean).join("/");
  const identityCell = paint(
    "dim",
    `${identity}${shape ? ` · ${shape}` : ""}${entry.auto ? ` · auto ${entry.auto}` : ""}`,
  );
  const jobCell =
    entry.job === "running"
      ? paint(
          "yellow",
          `running ${entry.jobId ? entry.jobId.slice(0, 8) : ""}`.trim(),
        )
      : paint("dim", "idle");
  const trailing = [`last ${humanDuration(entry.idleForMs)}`];
  if (entry.cwd) trailing.push(homePath(entry.cwd));
  const trailingCell = paint("dim", trailing.join(" · "));
  const staleCell = entry.stale ? ` ${paint("red", "stale")}` : "";
  return `${name}  ${identityCell}  ${jobCell}  ${trailingCell}${staleCell}`;
}

/** Human roster rendering as a pure function so tests can run without a TTY. */
export function renderRosterHuman(
  roster: RosterEntry[],
  opts: { olderThanMs: number; prunedNames?: string[] },
): string[] {
  const lines: string[] = [];
  if (opts.prunedNames && opts.prunedNames.length > 0) {
    lines.push(
      `Pruned ${opts.prunedNames.length}: ${opts.prunedNames.join(", ")}`,
    );
    lines.push("");
  }
  if (roster.length === 0) {
    lines.push("No companions tracked.");
    lines.push(
      paint(
        "dim",
        "Spawn one: droid-companion spawn --name smoke --persona advisor",
      ),
    );
    return lines;
  }
  const plural = roster.length === 1 ? "" : "s";
  lines.push(
    paint(
      "cyan",
      `${roster.length} companion${plural} · stale after ${humanDuration(opts.olderThanMs)}`,
    ),
  );
  lines.push("");
  const nameWidth = Math.max(...roster.map((entry) => entry.name.length));
  for (const entry of roster) {
    lines.push(`  ${rosterLine(entry, nameWidth)}`);
  }
  return lines;
}

/**
 * list / list --stale / list --prune
 * Cheap health only: no model pong.
 * Stale = idle longer than --older-than (config defaults.stale_after or 7d).
 * Running jobs are never stale.
 *
 * Human (TTY or --text): rendered roster. Machine (non-TTY or --json): JSON.
 */
export async function cmdList(opts: {
  stale?: boolean;
  prune?: boolean;
  deep?: boolean;
  olderThan?: string;
  json?: boolean;
  text?: boolean;
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
  const roster = currentRoster(sessions, nowMs, olderThanMs);
  const human = useHumanUi(opts);

  const wantStaleView = opts.stale === true || opts.prune === true;
  if (!wantStaleView) {
    if (human) {
      console.log(renderRosterHuman(roster, { olderThanMs }).join("\n"));
      return;
    }
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
    ? currentRoster(remainingSessions, nowMs, olderThanMs)
    : roster;

  if (human) {
    console.log(
      renderRosterHuman(remainingRoster, {
        olderThanMs,
        prunedNames: opts.prune ? pruned : undefined,
      }).join("\n"),
    );
    return;
  }

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
