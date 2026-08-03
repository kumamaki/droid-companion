import { describe, expect, test } from "bun:test";
import type { JobRecord } from "../src/lib/jobs";
import {
  DEFAULT_STALE_MS,
  buildRosterEntry,
  isSessionStale,
  parseDurationMs,
  selectStaleEntries,
} from "../src/lib/roster";
import type { SessionRecord } from "../src/lib/types";

function session(partial: Partial<SessionRecord> & Pick<SessionRecord, "sessionId" | "name" | "createdAt">): SessionRecord {
  return partial;
}

function runningJob(partial: Partial<JobRecord> & Pick<JobRecord, "jobId" | "name" | "sessionId">): JobRecord {
  return {
    status: "running",
    outPath: "/tmp/out.json",
    startedAt: new Date().toISOString(),
    message: "hi",
    ...partial,
  };
}

describe("parseDurationMs", () => {
  test("units and raw ms", () => {
    expect(parseDurationMs("500ms")).toBe(500);
    expect(parseDurationMs("90s")).toBe(90_000);
    expect(parseDurationMs("30m")).toBe(30 * 60_000);
    expect(parseDurationMs("24h")).toBe(24 * 3_600_000);
    expect(parseDurationMs("7d")).toBe(7 * 86_400_000);
    expect(parseDurationMs("1000")).toBe(1000);
    expect(parseDurationMs("1.5h")).toBe(5_400_000);
  });

  test("rejects garbage", () => {
    expect(() => parseDurationMs("")).toThrow(/Empty/);
    expect(() => parseDurationMs("week")).toThrow(/Invalid/);
    expect(() => parseDurationMs("-1d")).toThrow(/Invalid/);
  });
});

describe("isSessionStale / buildRosterEntry", () => {
  const now = Date.parse("2026-08-03T12:00:00.000Z");

  test("fresh session is not stale", () => {
    const s = session({
      sessionId: "s1",
      name: "audit",
      createdAt: "2026-08-03T11:00:00.000Z",
      lastUsedAt: "2026-08-03T11:30:00.000Z",
    });
    expect(isSessionStale(s, now, DEFAULT_STALE_MS, false)).toBe(false);
    const row = buildRosterEntry(s, undefined, now, DEFAULT_STALE_MS);
    expect(row.stale).toBe(false);
    expect(row.job).toBe("idle");
    expect(row.jobId).toBeNull();
    expect(row.idleForMs).toBe(30 * 60_000);
    expect(row.ageMs).toBe(60 * 60_000);
  });

  test("old idle session is stale", () => {
    const s = session({
      sessionId: "s2",
      name: "old",
      createdAt: "2026-07-01T00:00:00.000Z",
      lastUsedAt: "2026-07-20T00:00:00.000Z",
      lastResponse: "hello world",
      lastResponseFile: "/tmp/answer.md",
      lastDurationMs: 42,
      role: "critic",
    });
    expect(isSessionStale(s, now, DEFAULT_STALE_MS, false)).toBe(true);
    const row = buildRosterEntry(s, undefined, now, DEFAULT_STALE_MS);
    expect(row.stale).toBe(true);
    expect(row.lastResponsePreview).toBe("hello world");
    expect(row.lastResponseFile).toBe("/tmp/answer.md");
    expect(row.lastDurationMs).toBe(42);
    expect(row.role).toBe("critic");
  });

  test("running job never counts as stale", () => {
    const s = session({
      sessionId: "s3",
      name: "busy",
      createdAt: "2026-07-01T00:00:00.000Z",
      lastUsedAt: "2026-07-01T00:00:00.000Z",
    });
    const job = runningJob({
      jobId: "job-1",
      name: "busy",
      sessionId: "s3",
    });
    expect(isSessionStale(s, now, DEFAULT_STALE_MS, true)).toBe(false);
    const row = buildRosterEntry(s, job, now, DEFAULT_STALE_MS);
    expect(row.stale).toBe(false);
    expect(row.job).toBe("running");
    expect(row.jobId).toBe("job-1");
  });

  test("custom older-than threshold", () => {
    const s = session({
      sessionId: "s4",
      name: "mid",
      createdAt: "2026-08-01T00:00:00.000Z",
      lastUsedAt: "2026-08-02T00:00:00.000Z",
    });
    // idle ~36h
    expect(isSessionStale(s, now, parseDurationMs("24h"), false)).toBe(true);
    expect(isSessionStale(s, now, parseDurationMs("48h"), false)).toBe(false);
  });

  test("falls back to createdAt when lastUsedAt missing", () => {
    const s = session({
      sessionId: "s5",
      name: "newish",
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    expect(isSessionStale(s, now, DEFAULT_STALE_MS, false)).toBe(true);
    const row = buildRosterEntry(s, undefined, now, DEFAULT_STALE_MS);
    expect(row.lastUsedAt).toBe(s.createdAt);
  });
});

describe("selectStaleEntries", () => {
  test("filters stale rows", () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    const fresh = buildRosterEntry(
      session({
        sessionId: "a",
        name: "fresh",
        createdAt: "2026-08-03T11:00:00.000Z",
        lastUsedAt: "2026-08-03T11:00:00.000Z",
      }),
      undefined,
      now,
      DEFAULT_STALE_MS,
    );
    const stale = buildRosterEntry(
      session({
        sessionId: "b",
        name: "stale",
        createdAt: "2026-07-01T00:00:00.000Z",
        lastUsedAt: "2026-07-01T00:00:00.000Z",
      }),
      undefined,
      now,
      DEFAULT_STALE_MS,
    );
    expect(selectStaleEntries([fresh, stale]).map((e) => e.name)).toEqual(["stale"]);
  });
});
