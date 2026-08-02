# Agent guide

How the **main** Droid should use `droid-companion`. Humans can follow the same loop.

## Interface rule

> **JSON for verbs and state. Files for paragraphs.**

- Parse JSON from stdout for lifecycle (`sessionId`, `jobId`, `status`, `roster`, errors).
- Put long asks in `--message-file` (Markdown is fine).
- Optional long answers: `--response-file`; then `Read` that path.
- Do **not** invent a shared `chat.md` bus for control.

## Default workflow

1. Pick a unique **name** (no spaces): `audit`, `rust-reviewer`, `fixer`
2. Optional: write a `brief.md` (Goal · Constraints · Artifacts · Ask)
3. Spawn with role + flags
4. **Announce** name + role in the user-visible transcript
5. Keep a one-line **roster** while companions are live
6. `send` (batch questions; use `--message-file` for long content)
7. Close only when the role is finished — do **not** respawn for follow-ups

### Announce example

> Companion **audit** is up (security auditor). Call with `send audit "…"`.

### Roster line

```
audit · security auditor · cwd ~/proj · last just now
```

Refresh from `droid-companion list` → `roster` when unsure.

## Command patterns

### Cheap review

```sh
droid-companion spawn --name critic --lite --format findings \
  --system-prompt "You are a ruthless code reviewer."
droid-companion send critic --message-file ask.md
```

### Companion that edits

```sh
droid-companion spawn --name fixer --auto low --cwd . \
  --system-prompt "You implement focused fixes."
droid-companion send fixer --message-file task.md
```

### Long work (background)

```sh
droid-companion send audit --bg --message-file deep-ask.md --idempotency-key deep-1
# → { jobId, name, pid, outPath, status: "running" }

droid-companion result audit --wait
# → final JSON when done (job keeps running if this waiter is cut off)

# or poll:
droid-companion status audit
droid-companion result audit
```

Optional local notify (not chat push):

```sh
droid-companion send audit --bg --message-file deep-ask.md \
  --on-done 'echo done >> /tmp/companion-notify.log'
```

## Hard rules (non-negotiable)

1. **Always `--name` on spawn.** No anonymous UUID-first UX.
2. After spawn: **announce + roster** in the user transcript.
3. Multi-turn by default; **close only when done** (`close` = untrack; see cli-reference).
4. Prefer **`--message-file`** (or stdin) over giant shell-quoted strings.
5. **`--lite` + `--format findings`** for pure second opinions on small diffs.
6. Full profile + **`--auto low`** (or higher) when the companion must edit.
7. Relay by **name**; do not dump raw JSON to the user unless asked.
8. **`list --prune`** only with cheap health by default (no model pong).

### Timeout / hang / notify policy

| Layer | Timeout? | What to do |
|-------|----------|------------|
| `droid-companion` / `droid exec` | **No kill timeout** | Keep it that way |
| Main agent shell tool | Often yes (e.g. 60s) | Do not foreground long sends |
| After wait abort | — | **Never re-send the same message** |
| Safe retry | — | Same `--idempotency-key` or `status` / `result` |
| Second send while busy | — | Expect error (mutex); do not force unless intentional |
| “Stuck” session | — | **Never kill** companion / `droid` PIDs |
| Chat push | — | **Not available** — pull via status/result or local `--on-done` |

**Rule:** anything that might exceed the host tool timeout → `send --bg`, then `result --wait` or poll.

## Attribution

When relaying to the user:

```
**audit:** …
```

## User phrases that mean “use a companion”

- “second opinion”
- “ask audit about X”
- “keep that reviewer around”
- “have another model look at this”

## Skill file

Machine-oriented copy of this guide: [`skill/SKILL.md`](../skill/SKILL.md).

More detail: [background-jobs.md](background-jobs.md) · [overview.md](overview.md) (interface rule).
