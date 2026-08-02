import { describe, expect, test } from "bun:test";
import { classifyDroidFailure } from "../src/lib/droid-exec";

describe("classifyDroidFailure", () => {
  test("progress on stdout + transport on stderr → error is transport, lastResult is progress", () => {
    const f = classifyDroidFailure(
      1,
      JSON.stringify({
        result: "Docs confirmed lying about X…",
        session_id: "abc",
      }),
      "Unable to reach api.factory.ai",
      { name: "audit", sessionId: "abc" },
    );
    expect(f.error).toMatch(/Unable to reach|api\.factory/i);
    expect(f.lastResult).toContain("Docs confirmed");
    expect(f.hint).toBeTruthy();
  });

  test("progress-only result does not become sole error string", () => {
    const f = classifyDroidFailure(
      1,
      JSON.stringify({ result: "Still reading files…" }),
      "",
    );
    expect(f.error).toMatch(/exit/);
    expect(f.lastResult).toContain("Still reading");
  });

  test("errors field preferred over progress result", () => {
    const f = classifyDroidFailure(
      1,
      JSON.stringify({ result: "progress", errors: { message: "boom" } }),
      "",
    );
    expect(f.error).toMatch(/boom|message/);
  });

  test("transport in lastResult alone is primary error", () => {
    const f = classifyDroidFailure(
      1,
      JSON.stringify({ result: "ECONNREFUSED api.factory.ai" }),
      "",
    );
    expect(f.error).toMatch(/ECONNREFUSED|api\.factory/i);
    expect(f.hint).toMatch(/Transport|re-send/i);
  });
});
