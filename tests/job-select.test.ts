import { describe, expect, test } from "bun:test";
import type { JobRecord } from "../src/lib/jobs";
import {
  findByIdempotencyAmong,
  findLatestByNameAmong,
  findRunningAmong,
} from "../src/lib/job-select";

function job(partial: Partial<JobRecord> & Pick<JobRecord, "jobId" | "name" | "status">): JobRecord {
  return {
    sessionId: "s1",
    outPath: "/tmp/out.json",
    startedAt: "2026-01-01T00:00:00.000Z",
    message: "m",
    ...partial,
  };
}

describe("findRunningAmong", () => {
  test("mutex: only running job for name", () => {
    const jobs = [
      job({
        jobId: "1",
        name: "audit",
        status: "done",
        startedAt: "2026-01-01T00:00:00.000Z",
      }),
      job({
        jobId: "2",
        name: "audit",
        status: "running",
        startedAt: "2026-01-02T00:00:00.000Z",
      }),
      job({
        jobId: "3",
        name: "other",
        status: "running",
        startedAt: "2026-01-03T00:00:00.000Z",
      }),
    ];
    expect(findRunningAmong(jobs, "audit")?.jobId).toBe("2");
    expect(findRunningAmong(jobs, "AUDIT")?.jobId).toBe("2");
    expect(findRunningAmong(jobs, "missing")).toBeUndefined();
  });
});

describe("findByIdempotencyAmong", () => {
  test("prefers newest matching key", () => {
    const jobs = [
      job({
        jobId: "old",
        name: "a",
        status: "done",
        idempotencyKey: "k1",
        startedAt: "2026-01-01T00:00:00.000Z",
      }),
      job({
        jobId: "new",
        name: "a",
        status: "done",
        idempotencyKey: "k1",
        startedAt: "2026-01-03T00:00:00.000Z",
      }),
      job({
        jobId: "other",
        name: "a",
        status: "done",
        idempotencyKey: "k2",
        startedAt: "2026-01-04T00:00:00.000Z",
      }),
    ];
    expect(findByIdempotencyAmong(jobs, "k1")?.jobId).toBe("new");
    expect(findByIdempotencyAmong(jobs, "  ")).toBeUndefined();
  });
});

describe("findLatestByNameAmong", () => {
  test("newest by name regardless of status", () => {
    const jobs = [
      job({
        jobId: "old",
        name: "r1",
        status: "failed",
        startedAt: "2026-01-01T00:00:00.000Z",
      }),
      job({
        jobId: "new",
        name: "r1",
        status: "done",
        startedAt: "2026-01-05T00:00:00.000Z",
      }),
    ];
    expect(findLatestByNameAmong(jobs, "r1")?.jobId).toBe("new");
  });
});
