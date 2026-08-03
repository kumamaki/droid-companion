import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import {
  ensureStateDir,
  lockPath,
  sessionsPath,
  stateDir,
} from "./paths";
import type { SessionRecord } from "./types";

const LOCK_TIMEOUT_MS = 5000;
const LOCK_RETRY_MS = 20;

function writeJsonAtomic(path: string, data: unknown): void {
  mkdirSync(stateDir(), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  renameSync(tmp, path);
}

function readSessionsFile(): SessionRecord[] {
  const path = sessionsPath();
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    if (!Array.isArray(raw)) return [];
    return raw as SessionRecord[];
  } catch {
    return [];
  }
}

export function withStateLock<T>(fn: () => T): T {
  ensureStateDir();
  const lock = lockPath();
  const start = Date.now();
  while (true) {
    try {
      const fd = openSync(lock, "wx");
      try {
        return fn();
      } finally {
        closeSync(fd);
        try {
          unlinkSync(lock);
        } catch {
          /* ignore */
        }
      }
    } catch {
      if (Date.now() - start > LOCK_TIMEOUT_MS) {
        throw new Error(`State lock timeout after <${LOCK_TIMEOUT_MS}ms> at <${lock}>`);
      }
      Bun.sleepSync(LOCK_RETRY_MS);
    }
  }
}

/** Read-only: no lock (safe enough for list; writers use locked paths). */
export function loadSessions(): SessionRecord[] {
  return readSessionsFile();
}

export function saveSessions(sessions: SessionRecord[]): void {
  withStateLock(() => {
    writeJsonAtomic(sessionsPath(), sessions);
  });
}

export function trackSession(record: SessionRecord): void {
  withStateLock(() => {
    const sessions = readSessionsFile();
    sessions.push(record);
    writeJsonAtomic(sessionsPath(), sessions);
  });
}

export function findSession(sessionId: string): SessionRecord | undefined {
  return loadSessions().find((s) => s.sessionId === sessionId);
}

export function findSessionByName(name: string): SessionRecord | undefined {
  const needle = name.trim().toLowerCase();
  return loadSessions().find((s) => s.name?.toLowerCase() === needle);
}

export function resolveSessionRef(ref: string): SessionRecord {
  const byId = findSession(ref);
  if (byId) return byId;
  const byName = findSessionByName(ref);
  if (byName) return byName;
  throw new Error(`No tracked companion for <${ref}> (sessionId or name). Run list.`);
}

export function assertNameAvailable(name: string): void {
  const existing = findSessionByName(name);
  if (!existing) return;
  const last = existing.lastUsedAt ?? existing.createdAt;
  throw new Error(
    `Companion name already in use: <${name}> → session <${existing.sessionId}>` +
      (last ? ` lastUsedAt <${last}>` : "") +
      `. Run: droid-companion close ${name}  — or pick another name.`,
  );
}

export function updateSession(sessionId: string, patch: Partial<SessionRecord>): void {
  withStateLock(() => {
    const sessions = readSessionsFile();
    const index = sessions.findIndex((s) => s.sessionId === sessionId);
    if (index === -1) return;
    sessions[index] = { ...sessions[index], ...patch };
    writeJsonAtomic(sessionsPath(), sessions);
  });
}

export function touchSession(sessionId: string, patch: Partial<SessionRecord> = {}): void {
  updateSession(sessionId, { ...patch, lastUsedAt: new Date().toISOString() });
}

export function removeSession(sessionId: string): SessionRecord | undefined {
  return withStateLock(() => {
    const sessions = readSessionsFile();
    const found = sessions.find((s) => s.sessionId === sessionId);
    if (!found) return undefined;
    writeJsonAtomic(
      sessionsPath(),
      sessions.filter((s) => s.sessionId !== sessionId),
    );
    return found;
  });
}

/** Atomically untrack many sessions. Returns the removed records. */
export function removeSessions(sessionIds: string[]): SessionRecord[] {
  if (sessionIds.length === 0) return [];
  const idSet = new Set(sessionIds);
  return withStateLock(() => {
    const sessions = readSessionsFile();
    const removed = sessions.filter((s) => idSet.has(s.sessionId));
    if (removed.length === 0) return [];
    writeJsonAtomic(
      sessionsPath(),
      sessions.filter((s) => !idSet.has(s.sessionId)),
    );
    return removed;
  });
}
