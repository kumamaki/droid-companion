import { droidExec } from "../lib/droid-exec";
import { ensureStateDir, resolveContractPath } from "../lib/paths";
import {
  FINDINGS_FORMAT_INSTRUCTION,
  LITE_INSTRUCTION,
  composeSystemPrompt,
  inferDefaultAuto,
  loadContractText,
  resolveBriefPath,
  resolveCwd,
  withBrief,
  writeSystemPromptFile,
} from "../lib/prompts";
import { assertNameAvailable, trackSession } from "../lib/state";
import type { Profile, SessionRecord, SpawnOptions } from "../lib/types";
import { validateName } from "../lib/args";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

export async function cmdSpawn(opts: SpawnOptions): Promise<void> {
  ensureStateDir();
  const name = validateName(opts.name);
  assertNameAvailable(name);

  const cwd = resolveCwd(opts.cwd);
  const briefPath = opts.brief ? resolveBriefPath(opts.brief, cwd) : undefined;
  const profile: Profile = opts.lite ? "lite" : "full";
  const format = opts.format ?? "prose";
  const role = opts.role ?? opts.systemPrompt;
  const auto = opts.auto ?? inferDefaultAuto(role, profile);

  const args: string[] = [];
  if (opts.model) args.push("--model", opts.model);
  if (auto) args.push("--auto", auto);
  if (cwd) args.push("--cwd", cwd);
  if (opts.reasoningEffort) args.push("--reasoning-effort", opts.reasoningEffort);
  args.push("--tag", opts.tag ?? name);

  if (profile === "lite") {
    args.push("--disabled-tools", "Task,GenerateDroid,Skill");
  }

  const contractBlock = opts.noContract ? undefined : loadContractText();
  const liteBlock = profile === "lite" ? LITE_INSTRUCTION : undefined;
  const formatBlock = format === "findings" ? FINDINGS_FORMAT_INSTRUCTION : undefined;
  const identityLine = `Your companion name is ${name}. Introduce yourself by that name and keep using it.`;
  const rolePrompt = composeSystemPrompt([
    contractBlock,
    liteBlock,
    formatBlock,
    opts.systemPrompt,
    identityLine,
  ]);
  if (rolePrompt) {
    const promptFile = writeSystemPromptFile(name, rolePrompt);
    args.push("--append-system-prompt-file", promptFile);
  }

  const readyLine = `State that you are ready. Open with your companion name <${name}>. One short sentence.`;
  args.push(withBrief(readyLine, briefPath, "spawn"));

  const result = await droidExec(args, { name });
  if (!result.session_id) throw new Error("No session_id returned from droid exec");

  const now = new Date().toISOString();
  const record: SessionRecord = {
    sessionId: result.session_id,
    name,
    tag: opts.tag ?? name,
    model: opts.model,
    brief: briefPath,
    cwd,
    auto,
    format,
    profile,
    role,
    lastResponse: result.result ?? "",
    lastDurationMs: result.duration_ms,
    createdAt: now,
    lastUsedAt: now,
  };
  trackSession(record);

  output({
    sessionId: result.session_id,
    name,
    response: result.result ?? "",
    isError: result.is_error ?? false,
    durationMs: result.duration_ms ?? null,
    brief: briefPath ?? null,
    cwd: cwd ?? null,
    auto: auto ?? null,
    format,
    profile,
    contract: !opts.noContract,
    contractPath: opts.noContract ? null : resolveContractPath(),
    announce: `Companion ready: ${name} (${result.session_id}). Call with: send ${name} "…"`,
  });
}
