export type ReplyFormat = "prose" | "findings";
/** Tool surface: full tools vs cheap critique (disabled heavy tools). */
export type ToolProfile = "full" | "lite";

export interface SessionRecord {
  sessionId: string;
  name: string;
  tag?: string;
  model?: string;
  brief?: string;
  cwd?: string;
  auto?: string;
  /** Reply shape prose|findings */
  format?: ReplyFormat;
  /** Tool surface full|lite */
  toolProfile?: ToolProfile;
  /**
   * @deprecated Legacy tool-surface field; prefer toolProfile.
   */
  profile?: ToolProfile;
  /** Persona name used at spawn (builtin or config), if any. */
  persona?: string;
  /** Role text actually used (persona role or CLI --role). */
  role?: string;
  lastResponse?: string;
  /** Path from last --response-file send, if any. */
  lastResponseFile?: string;
  lastDurationMs?: number;
  lastUsedAt?: string;
  createdAt: string;
}

/**
 * CLI-facing spawn inputs (only fields the user/agent set).
 * Resolution into a concrete plan happens in resolveSpawnPlan.
 */
export interface SpawnOptions {
  name: string;
  /** Built-in or config persona name. Aliases: --preset, --profile */
  persona?: string;
  /**
   * Full role replacement (not stacked on persona role).
   * CLI: --role or --system-prompt (same field).
   */
  role?: string;
  model?: string;
  auto?: string;
  cwd?: string;
  tag?: string;
  reasoningEffort?: string;
  brief?: string;
  noContract?: boolean;
  /**
   * Tool surface. Prefer explicit toolProfile; lite=true means toolProfile lite.
   * lite=false means force full.
   */
  toolProfile?: ToolProfile;
  lite?: boolean;
  /** Reply shape override; default from persona or prose */
  format?: ReplyFormat;
}

export interface SendOptions {
  images?: string[];
  model?: string;
  auto?: string;
  cwd?: string;
  brief?: string;
  format?: ReplyFormat;
  bg?: boolean;
  out?: string;
  responseFile?: string;
  idempotencyKey?: string;
  onDone?: string;
  force?: boolean;
}

export interface ExecResult {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  session_id?: string;
  duration_ms?: number;
  num_turns?: number;
  errors?: unknown;
}

export interface StructuredFailure {
  error: string;
  exitCode: number;
  sessionId?: string;
  name?: string;
  lastResult?: string | null;
  stderr?: string | null;
  errors?: unknown;
  hint?: string;
}

/** Fully resolved spawn plan after persona + CLI merge. */
export interface SpawnPlan {
  name: string;
  persona: string | null;
  personaSource: "builtin" | "config" | null;
  role: string | undefined;
  toolProfile: ToolProfile;
  format: ReplyFormat;
  auto: string | undefined;
  model?: string;
  cwd?: string;
  brief?: string;
  tag?: string;
  reasoningEffort?: string;
  noContract: boolean;
}
