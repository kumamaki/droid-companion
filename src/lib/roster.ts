import type { JobRecord } from "./jobs";
import type { SessionRecord } from "./types";

/** Default idle age before list --stale / --prune considers a companion stale. */
export const DEFAULT_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export interface RosterEntry {
  name: string;
  role: string | null;
  cwd: string | null;
  auto: string | null;
  toolProfile: string | null;
  format: string | null;
  job: "idle" | "running";
  jobId: string | null;
  lastUsedAt: string;
  lastDurationMs: number | null;
  lastResponsePreview: string | null;
  lastResponseFile: string | null;
  idleForMs: number;
  ageMs: number;
  stale: boolean;
  sessionId: string;
}

/**
 * Parse duration for --older-than.
 * Accepts plain milliseconds (`604800000`) or `30m` / `12h` / `7d` / `90s` / `500ms`.
 */
export function parseDurationMs(input: string): number {
  const raw = input.trim().toLowerCase();
  if (!raw) {
    throw new Error(
      "Empty --older-than. Use e.g. 7d, 24h, 30m, or milliseconds.",
    );
  }
  if (/^\d+$/.test(raw)) {
    const ms = Number(raw);
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error(`Invalid --older-than milliseconds: <${input}>`);
    }
    return ms;
  }
  const match = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(
      `Invalid --older-than <${input}>. Use 7d, 24h, 30m, 90s, 500ms, or raw ms.`,
    );
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Invalid --older-than amount: <${input}>`);
  }
  const unit = match[2];
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return Math.floor(amount * multipliers[unit]);
}

export function lastUsedIso(session: SessionRecord): string {
  return session.lastUsedAt ?? session.createdAt;
}

export function isSessionStale(
  session: SessionRecord,
  nowMs: number,
  olderThanMs: number,
  hasRunningJob: boolean,
): boolean {
  if (hasRunningJob) return false;
  const last = Date.parse(lastUsedIso(session));
  if (!Number.isFinite(last)) return false;
  return nowMs - last >= olderThanMs;
}

/**
 * Build one roster row. `runningJob` should already be reconciled when provided.
 */
export function buildRosterEntry(
  session: SessionRecord,
  runningJob: JobRecord | undefined,
  nowMs: number,
  olderThanMs: number,
): RosterEntry {
  const lastUsedAt = lastUsedIso(session);
  const lastUsedMs = Date.parse(lastUsedAt);
  const createdMs = Date.parse(session.createdAt);
  const jobRunning = runningJob?.status === "running";
  const idleForMs = Number.isFinite(lastUsedMs)
    ? Math.max(0, nowMs - lastUsedMs)
    : 0;
  const ageMs = Number.isFinite(createdMs)
    ? Math.max(0, nowMs - createdMs)
    : 0;

  return {
    name: session.name,
    role: session.role ?? null,
    cwd: session.cwd ?? null,
    auto: session.auto ?? null,
    toolProfile: session.toolProfile ?? session.profile ?? null,
    format: session.format ?? null,
    job: jobRunning ? "running" : "idle",
    jobId: jobRunning ? (runningJob?.jobId ?? null) : null,
    lastUsedAt,
    lastDurationMs: session.lastDurationMs ?? null,
    lastResponsePreview: session.lastResponse
      ? session.lastResponse.slice(0, 120)
      : null,
    lastResponseFile: session.lastResponseFile ?? null,
    idleForMs,
    ageMs,
    stale: isSessionStale(session, nowMs, olderThanMs, jobRunning),
    sessionId: session.sessionId,
  };
}

export function selectStaleEntries(roster: RosterEntry[]): RosterEntry[] {
  return roster.filter((entry) => entry.stale);
}
