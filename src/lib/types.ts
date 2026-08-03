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
  format?: ReplyFormat;
  /** Tool surface full|lite. Prefer this over legacy `profile` if both ever appear. */
  toolProfile?: ToolProfile;
  /**
   * @deprecated Legacy session field for tool surface; read as toolProfile.
   * Kept so old sessions.json still loads.
   */
  profile?: ToolProfile;
  role?: string;
  lastResponse?: string;
  /** Path from last --response-file send, if any. */
  lastResponseFile?: string;
  lastDurationMs?: number;
  lastUsedAt?: string;
  createdAt: string;
}

export interface SpawnOptions {
  model?: string;
  auto?: string;
  cwd?: string;
  systemPrompt?: string;
  tag?: string;
  reasoningEffort?: string;
  brief?: string;
  name: string;
  noContract?: boolean;
  /** true = lite tool surface; undefined = let preset / default decide */
  lite?: boolean;
  format?: ReplyFormat;
  role?: string;
  /** Applied before spawn; explicit flags still win when already set. */
  preset?: string;
  /**
   * Named config profile (`[profiles.<name>]` in config.toml).
   * Not the tool surface — that is `lite` / `toolProfile`.
   */
  configProfile?: string;
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
