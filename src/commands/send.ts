import { droidExec } from "../lib/droid-exec";
import { ensureStateDir } from "../lib/paths";
import {
  buildPromptWithImages,
  resolveBriefPath,
  resolveCwd,
  withBrief,
  withFormat,
} from "../lib/prompts";
import { resolveSessionRef, touchSession } from "../lib/state";
import type { SendOptions } from "../lib/types";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

export async function cmdSend(
  ref: string,
  message: string,
  opts: SendOptions,
): Promise<void> {
  ensureStateDir();
  const tracked = resolveSessionRef(ref);
  const sessionId = tracked.sessionId;
  const cwd = opts.cwd ? resolveCwd(opts.cwd) : tracked.cwd;
  const auto = opts.auto ?? tracked.auto;
  const format = opts.format ?? tracked.format ?? "prose";
  const briefPath = opts.brief
    ? resolveBriefPath(opts.brief, cwd)
    : tracked.brief;

  const patch: Parameters<typeof touchSession>[1] = {};
  if (opts.brief && briefPath) patch.brief = briefPath;
  if (opts.cwd && cwd) patch.cwd = cwd;
  if (opts.auto) patch.auto = opts.auto;
  if (opts.format) patch.format = opts.format;
  touchSession(sessionId, patch);

  const prompt = withFormat(
    buildPromptWithImages(withBrief(message, briefPath, "send"), opts.images),
    format,
  );

  const args: string[] = ["--session-id", sessionId];
  if (opts.model) args.push("--model", opts.model);
  if (auto) args.push("--auto", auto);
  if (cwd) args.push("--cwd", cwd);
  args.push(prompt);

  // Keep tracking on failure (04i) — touch already applied; only update last* on success.
  const result = await droidExec(args, {
    sessionId,
    name: tracked.name,
  });

  touchSession(sessionId, {
    lastResponse: result.result ?? "",
    lastDurationMs: result.duration_ms,
  });

  output({
    sessionId: result.session_id ?? sessionId,
    name: tracked.name,
    response: result.result ?? "",
    responseFile: null,
    isError: result.is_error ?? false,
    durationMs: result.duration_ms ?? null,
    brief: briefPath ?? null,
    cwd: cwd ?? null,
    auto: auto ?? null,
    format,
  });
}
