# Background jobs

## Why this exists

Companions often take longer than a host agent's shell tool timeout (commonly ~60s). If the caller stops waiting and **re-sends** the same message, the companion session gets a **duplicate turn** and looks stuck.

`droid-companion` never kills or times out `droid exec`. Callers must not block forever either. The answer is **background + poll/wait**, with locks so retries are safe.

## Layers

| Layer | Timeout? | Correct behavior |
|-------|----------|------------------|
| `droid-companion` / `droid exec` | **No kill timeout** | Await process exit only; never SIGKILL for “took too long” |
| Main agent `Execute` / shell | Often yes | Prefer `--bg` for long work |
| After wait abort | — | **Never re-send** the same ask; use `status` / `result` or the same `--idempotency-key` |
| “Unstick” temptation | — | **Never kill** companion / `droid` PIDs |

## Notify model (locked)

| Mechanism | v0.1 |
|-----------|------|
| Job state + result files under state dir | **Yes** — source of truth |
| `status` / `result` / `result --wait` | **Yes** |
| Optional `--on-done 'shell command'` | **Yes** — local only |
| Optional `--response-file` for long prose | **Yes** — JSON points at path |
| Push a message into the main Droid chat | **No** — not in v0.1 |

“Ready” means: job status is `done` or `failed`, and the result file (and optional response file) is written. Anything that wants chat-style notify must watch those files or run `--on-done` (e.g. macOS notification, append a log, hit localhost). That watcher is outside companion.

## API (v0.1 target)

### Start a job

```sh
droid-companion send audit --bg --message-file ask.md
# optional:
#   --out /path/to/envelope.json
#   --response-file /path/to/answer.md
#   --idempotency-key ask-42
#   --on-done 'afplay /System/Library/Sounds/Glass.aiff'
```

Immediate JSON (control plane):

```json
{
  "jobId": "…",
  "name": "audit",
  "sessionId": "…",
  "pid": 12345,
  "outPath": "/Users/you/.local/share/droid-companion/jobs/….json",
  "responseFile": null,
  "status": "running"
}
```

Content of the ask lives in `ask.md` (content plane), not in argv novels.

### Poll

```sh
droid-companion status audit
# or: droid-companion status <jobId>
```

```json
{
  "jobId": "…",
  "name": "audit",
  "status": "running|done|failed",
  "pid": 12345
}
```

### Collect

```sh
droid-companion result audit
droid-companion result audit --wait
```

- `result` — final send JSON when `done`; error if still running or failed (failed includes error fields).
- `result --wait` — block until terminal status, then print the same final JSON. **Does not kill the job** if the waiter is interrupted; the job keeps running.

Foreground result / completed job envelope (illustrative):

```json
{
  "sessionId": "…",
  "name": "audit",
  "response": "…",
  "responseFile": null,
  "isError": false,
  "durationMs": 1234,
  "format": "prose"
}
```

If `--response-file` was set, long prose is in that file and `response` may be empty or a short summary; agents should `Read` the file when present.

## Mutex and retries

| Rule | Behavior |
|------|----------|
| One in-flight job per **name** | Second `send` while `running` → error with existing `jobId` (unless `--force`, rare) |
| `--idempotency-key KEY` | Same key again → return existing job/result; do not start a new turn |
| After host tool timeout | Poll or `result --wait`; do **not** fire a new send without a key / without checking status |

## Semantics

- Job metadata + result files live under `$DROID_COMPANION_HOME` or `~/.local/share/droid-companion/jobs/`.
- Detached work is preferably the same binary (`droid-companion` worker), not a hand-rolled shell string.
- Foreground `send` remains for short consults (cheap reviews, pings).
- Companion never injects into the main Droid session. The main agent always pulls.

## Agent policy

1. If the turn might exceed the host tool timeout → **`--bg`**.
2. Prefer `result --wait` or poll `status` until terminal.
3. **Never** re-send the same message after a wait abort; use status/result or the same idempotency key.
4. **Never** kill companion / `droid` PIDs to recover.
5. Attribute the final relay by companion **name**.
6. Put long asks in `--message-file`; put long answers in `--response-file` when useful.

## Implementation notes

- Worker: same CLI via `droid-companion _run-job <jobId>` (detached, no kill timeout).
- Job files: `~/.local/share/droid-companion/jobs/<jobId>.json` (+ `.out.json`).
- `close --purge` SIGTERMs running workers for that session and removes job files.
