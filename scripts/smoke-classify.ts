#!/usr/bin/env bun
import { classifyDroidFailure } from "../src/lib/droid-exec";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// Progress-only result + network on stderr → error is network, lastResult is progress
{
  const f = classifyDroidFailure(
    1,
    JSON.stringify({ result: "Docs confirmed lying about X…", session_id: "abc" }),
    "Unable to reach api.factory.ai",
    { name: "audit", sessionId: "abc" },
  );
  assert(f.error.includes("Unable to reach") || f.error.includes("api.factory"), `error was: ${f.error}`);
  assert(f.lastResult?.includes("Docs confirmed") === true, "lastResult should keep progress");
  assert(Boolean(f.hint), "hint required");
  console.log("ok: progress not primary when stderr has transport");
}

// Only progress result, no stderr → generic exit, progress in lastResult
{
  const f = classifyDroidFailure(
    1,
    JSON.stringify({ result: "Still reading files…" }),
    "",
  );
  assert(f.error.includes("exit"), `expected generic exit, got: ${f.error}`);
  assert(f.lastResult?.includes("Still reading") === true, "lastResult kept");
  console.log("ok: progress-only does not become sole error string");
}

// errors field preferred
{
  const f = classifyDroidFailure(
    1,
    JSON.stringify({ result: "progress", errors: { message: "boom" } }),
    "",
  );
  assert(f.error.includes("boom") || f.error.includes("message"), `error: ${f.error}`);
  console.log("ok: errors field preferred");
}

console.log("all classify smoke checks passed");
