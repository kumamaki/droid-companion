import { validateName } from "../lib/args";
import { loadConfig, resolveSpawnPlan } from "../lib/config";
import { droidExec } from "../lib/droid-exec";
import { ensureStateDir, resolveContractPath } from "../lib/paths";
import {
  FINDINGS_FORMAT_INSTRUCTION,
  LITE_INSTRUCTION,
  composeSystemPrompt,
  loadContractText,
  resolveBriefPath,
  resolveCwd,
  withBrief,
  writeSystemPromptFile,
} from "../lib/prompts";
import { assertNameAvailable, trackSession } from "../lib/state";
import type { SessionRecord, SpawnOptions } from "../lib/types";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

export async function cmdSpawn(raw: SpawnOptions): Promise<void> {
  ensureStateDir();

  const config = loadConfig();
  const plan = resolveSpawnPlan(raw, config);

  const name = validateName(plan.name);
  assertNameAvailable(name);

  const cwd = resolveCwd(plan.cwd);
  const briefPath = plan.brief ? resolveBriefPath(plan.brief, cwd) : undefined;
  const { toolProfile, format, auto, role } = plan;

  const args: string[] = [];
  if (plan.model) args.push("--model", plan.model);
  if (auto) args.push("--auto", auto);
  if (cwd) args.push("--cwd", cwd);
  if (plan.reasoningEffort) {
    args.push("--reasoning-effort", plan.reasoningEffort);
  }
  args.push("--tag", plan.tag ?? name);

  if (toolProfile === "lite") {
    args.push("--disabled-tools", "Task,GenerateDroid,Skill");
  }

  const contractBlock = plan.noContract ? undefined : loadContractText();
  const liteBlock = toolProfile === "lite" ? LITE_INSTRUCTION : undefined;
  // Reply-shape instruction is separate from role text (format override stays useful).
  const formatBlock =
    format === "findings" ? FINDINGS_FORMAT_INSTRUCTION : undefined;
  const identityLine = `Your companion name is ${name}. Introduce yourself by that name and keep using it.`;
  // Role is a single voice — never stacked with a second system prompt layer.
  const rolePrompt = composeSystemPrompt([
    contractBlock,
    liteBlock,
    formatBlock,
    role,
    identityLine,
  ]);
  if (rolePrompt) {
    const promptFile = writeSystemPromptFile(name, rolePrompt);
    args.push("--append-system-prompt-file", promptFile);
  }

  const readyLine = `State that you are ready. Open with your companion name <${name}>. One short sentence.`;
  args.push(withBrief(readyLine, briefPath, "spawn"));

  const result = await droidExec(args, { name });
  if (!result.session_id) {
    throw new Error("No session_id returned from droid exec");
  }

  const now = new Date().toISOString();
  const record: SessionRecord = {
    sessionId: result.session_id,
    name,
    tag: plan.tag ?? name,
    model: plan.model,
    brief: briefPath,
    cwd,
    auto,
    format,
    toolProfile,
    persona: plan.persona ?? undefined,
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
    toolProfile,
    persona: plan.persona,
    personaSource: plan.personaSource,
    contract: !plan.noContract,
    contractPath: plan.noContract ? null : resolveContractPath(),
    announce: `Companion ready: ${name} (${result.session_id}). Call with: droid-companion send ${name} "…"`,
  });
}
