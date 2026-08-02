import { droidBin } from "./paths";
import type { ExecResult, StructuredFailure } from "./types";

const TRANSPORT_MARKERS = [
  /unable to reach/i,
  /econnrefused/i,
  /enotfound/i,
  /etimedout/i,
  /network/i,
  /api\.factory\.ai/i,
  /unauthorized/i,
  /forbidden/i,
  /401/,
  /403/,
  /502/,
  /503/,
  /504/,
];

export class DroidExecError extends Error {
  readonly structured: StructuredFailure;

  constructor(structured: StructuredFailure) {
    super(structured.error);
    this.name = "DroidExecError";
    this.structured = structured;
  }
}

function looksLikeTransport(text: string): boolean {
  return TRANSPORT_MARKERS.some((re) => re.test(text));
}

/**
 * Classify droid exec failure without promoting progress-only result to the primary error.
 */
export function classifyDroidFailure(
  exitCode: number,
  stdout: string,
  stderr: string,
  ctx: { sessionId?: string; name?: string } = {},
): StructuredFailure {
  let parsed: ExecResult | null = null;
  try {
    parsed = JSON.parse(stdout) as ExecResult;
  } catch {
    parsed = null;
  }

  const stderrTrim = stderr.trim() || null;
  const lastResult =
    parsed?.result !== undefined && parsed.result !== null
      ? String(parsed.result)
      : null;
  const errorsField = parsed?.errors;

  const candidates: string[] = [];
  if (stderrTrim) candidates.push(stderrTrim);
  if (errorsField !== undefined && errorsField !== null) {
    candidates.push(
      typeof errorsField === "string" ? errorsField : JSON.stringify(errorsField),
    );
  }
  if (lastResult && looksLikeTransport(lastResult)) {
    candidates.push(lastResult);
  }
  if (stdout.trim() && looksLikeTransport(stdout)) {
    candidates.push(stdout.trim().slice(0, 500));
  }

  let error =
    candidates.find((c) => c.length > 0) ??
    `droid exec failed (exit <${exitCode}>)`;

  // Never let progress-only chatter be the sole error when stderr/errors exist — already preferred above.
  // If only lastResult exists and it does NOT look like transport, still prefer a generic exit message
  // and keep progress in lastResult (04i contract).
  if (
    candidates.length === 0 &&
    lastResult &&
    !looksLikeTransport(lastResult)
  ) {
    error = `droid exec failed (exit <${exitCode}>)`;
  } else if (candidates.length === 0 && lastResult && looksLikeTransport(lastResult)) {
    error = lastResult;
  }

  const transportish =
    looksLikeTransport(error) ||
    (stderrTrim ? looksLikeTransport(stderrTrim) : false) ||
    (lastResult ? looksLikeTransport(lastResult) : false);

  return {
    error: error.length > 800 ? error.slice(0, 800) + "…" : error,
    exitCode,
    sessionId: ctx.sessionId ?? parsed?.session_id,
    name: ctx.name,
    lastResult,
    stderr: stderrTrim,
    errors: errorsField ?? null,
    hint: transportish
      ? "Transport/runtime abort — do not re-send the same ask into this turn; inspect session, or close + respawn."
      : "Do not re-send the same ask after a failed mid-turn; check lastResult vs error, or close + respawn.",
  };
}

export async function droidExec(
  args: string[],
  ctx: { sessionId?: string; name?: string } = {},
): Promise<ExecResult> {
  const bin = droidBin();
  const cmd = [bin, "exec", "--output-format", "json", ...args];
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new DroidExecError(classifyDroidFailure(exitCode, stdout, stderr, ctx));
  }

  let parsed: ExecResult;
  try {
    parsed = JSON.parse(stdout) as ExecResult;
  } catch {
    throw new DroidExecError({
      error: `droid exec returned non-JSON output: ${stdout.slice(0, 500)}`,
      exitCode: 0,
      sessionId: ctx.sessionId,
      name: ctx.name,
      lastResult: null,
      stderr: stderr.trim() || null,
      hint: "Check droid version and --output-format json support.",
    });
  }

  if (parsed.is_error) {
    throw new DroidExecError(
      classifyDroidFailure(1, stdout, stderr || "is_error flag set", {
        sessionId: ctx.sessionId ?? parsed.session_id,
        name: ctx.name,
      }),
    );
  }

  return parsed;
}
