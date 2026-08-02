import type { JobRecord } from "./jobs";

/** Pure helpers for job mutex / idempotency selection (unit-tested). */

export function findRunningAmong(
  jobs: JobRecord[],
  name: string,
): JobRecord | undefined {
  const needle = name.trim().toLowerCase();
  return jobs.find(
    (j) => j.name.toLowerCase() === needle && j.status === "running",
  );
}

/** Newest job matching idempotency key (by startedAt desc). */
export function findByIdempotencyAmong(
  jobs: JobRecord[],
  key: string,
): JobRecord | undefined {
  const needle = key.trim();
  if (!needle) return undefined;
  const matches = jobs
    .filter((j) => j.idempotencyKey === needle)
    .toSorted((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return matches[0];
}

/** Newest job for companion name (any status). */
export function findLatestByNameAmong(
  jobs: JobRecord[],
  name: string,
): JobRecord | undefined {
  const needle = name.trim().toLowerCase();
  const matches = jobs
    .filter((j) => j.name.toLowerCase() === needle)
    .toSorted((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return matches[0];
}
