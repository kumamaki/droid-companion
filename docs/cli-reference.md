# CLI reference

## Interface (locked)

- **Control plane:** JSON on stdout. Errors: `{ "error": "…" }` (plus structured fields when known) on **stderr**, non-zero exit.
- **Content plane:** files — `--message-file`, `--brief`, optional `--response-file`.  
  Rule: **JSON for verbs/state. Files for paragraphs.**
- **Not supported as API:** a shared freeform markdown chat log as the only protocol.

Binary: `droid-companion`  
Version: `droid-companion --version` → plain text version string (also in doctor JSON).

## Commands (v0.1 surface)

| Command | Role | Status |
|---------|------|--------|
| `setup` | First-run wizard (doctor → skill → cheat sheet) | implemented |
| `spawn` | Create named companion | implemented |
| `send` | Message existing companion (+ `--bg`) | implemented |
| `list` | Roster + sessions | implemented |
| `close` | Untrack companion (see below) | implemented |
| `doctor` | Environment checks | implemented |
| `install-skill` | Copy skill + contract into Factory skills dir | implemented |
| `status` | Background job status | implemented |
| `result` | Background job result (`--wait`) | implemented |

Recipes (`discuss` / `jury` / `vision`) are **not** v0.1 — see [roadmap](roadmap.md).

---

## Presets

| Preset | Defaults |
|--------|----------|
| `critic` | lite + findings — ruthless code review |
| `auditor` | lite + findings — security focus |
| `fixer` | full + `--auto low` — implement focused fixes |
| `advisor` | full, read-only default — tradeoffs / recommend |

```sh
droid-companion spawn --name r1 --preset critic
```

Explicit `--system-prompt`, `--format`, `--auto`, `--lite` override or fill gaps as documented in help.

---

## `setup`

```sh
droid-companion setup [--yes] [--skip-skill] [--target DIR] [--json|--text]
```

First-run onboarding. **Human-first on a TTY** (friendly text on stdout, no JSON wall).  
**Machine mode** when non-TTY or with `--json` (JSON summary on stdout only).

1. Same environment checks as `doctor`.
2. Offer to install the agent skill (TTY prompts), or auto-install when safe with `--yes`.
3. Short cheat sheet of next commands (human mode).
4. Exit `0` / `1` from critical checks + skill failure.

| Flag | Effect |
|------|--------|
| `--yes` | No prompts. Install skill if missing and safe (refuses legacy `companion.ts` without force). |
| `--skip-skill` | Skip skill install step. |
| `--target DIR` | Passed through to skill install. |
| `--json` | Force machine JSON on stdout (no human banner). |
| `--text` | Force human text even when non-TTY. |

Default: **TTY → text**, **non-TTY → JSON**.  
Non-TTY without `--yes`: skill not installed (doctor + report only).

Human mode example:

```text
droid-companion setup 0.1.2

Environment
  ✓ droid      0.186.0
  ✓ contract   ~/…/contract.md
  ✓ state      ~/.local/share/droid-companion
  ✓ auth       credentials present (not live-verified)

Skill
  ✓ present     ~/.factory/skills/droid-companion

Next
  droid-companion spawn --name smoke --preset advisor
  …

Ready.
```

Machine summary shape (`--json`):

```json
{
  "ok": true,
  "command": "setup",
  "doctor": { "ok": true, "checks": { "…": "…" } },
  "skill": {
    "action": "installed",
    "targetDir": "/Users/you/.factory/skills/droid-companion",
    "detail": "…"
  },
  "next": ["droid-companion spawn --name smoke --preset advisor", "…"]
}
```

`skill.action`: `installed` · `reinstalled` · `already_present` · `skipped` · `refused_legacy` · `failed`.

Declining skill install is not a failure.

---

## `install-skill`

```sh
droid-companion install-skill [--target DIR] [--force]
```

Copies `skill/SKILL.md` and `contract/contract.md` into `~/.factory/skills/droid-companion/` (or `--target`).  
Refuses when legacy `companion.ts` is present unless `--force`.

Agents/scripts: prefer this (or `setup --yes`) over interactive setup.

---

## `doctor`

```sh
droid-companion doctor
```

Example shape:

```json
{
  "ok": true,
  "version": "0.1.0-dev",
  "checks": {
    "droidOnPath": true,
    "droidVersion": "0.186.0",
    "contractPresent": true,
    "contractPath": "…",
    "stateDir": "/Users/you/.local/share/droid-companion",
    "stateDirWritable": true,
    "authStatus": "credentialsPresent",
    "authVerified": false,
    "authSignals": ["~/.factory/auth.v2.file present"]
  }
}
```

Exit `0` if droid/contract/state critical checks pass; `1` otherwise.  
`ok: true` **does not** mean login is verified (`authVerified` is always false without a live probe).

---

## `spawn` (spec)

```sh
droid-companion spawn --name NAME [options]
```

| Flag | Notes |
|------|--------|
| `--name NAME` | **Required.** Unique, no whitespace, max 64 |
| `--model ID` | Model id |
| `--auto LEVEL` | `low` \| `medium` \| `high`; inferred if omitted |
| `--cwd PATH` | Working directory (tracked) |
| `--system-prompt TEXT` | Role on top of contract |
| `--role TEXT` | Alias for system-prompt / roster role |
| `--tag NAME` | Session tag (defaults to `--name`) |
| `--reasoning-effort L` | Passed through to droid |
| `--brief PATH` | Shared brief file (tracked absolute path) |
| `--format prose\|findings` | Default reply shape (tracked) |
| `--lite` | Cheap critique profile |
| `--no-contract` | Skip contract injection |
| `--preset NAME` | `critic` \| `auditor` \| `fixer` \| `advisor` — fills role/lite/format/auto defaults |

Name already in use → actionable error (name, session id / last used if known, suggest `close` or another name).

Example result shape:

```json
{
  "sessionId": "…",
  "name": "audit",
  "response": "…",
  "isError": false,
  "brief": null,
  "cwd": "/path",
  "auto": null,
  "format": "findings",
  "profile": "lite",
  "contract": true,
  "announce": "Companion ready: audit (…). Call with: droid-companion send audit \"…\""
}
```

---

## `send` (spec)

```sh
droid-companion send <name|sessionId> [message] [options]
```

Prefer **name**. Prefer **`--message-file`** for anything longer than a short line.

| Flag | Notes |
|------|--------|
| `--message-file PATH\|-` | File or stdin; prefer over shell quoting |
| `--images PATHS` | Comma-separated paths (companion Read tool) |
| `--model ID` | Override this turn |
| `--auto LEVEL` | Override (updates tracked default) |
| `--cwd PATH` | Override (updates tracked) |
| `--brief PATH` | Override (updates tracked) |
| `--format prose\|findings` | Override this turn |
| `--bg` | Detach; return job handle immediately |
| `--out PATH` | With `--bg`, where to write final JSON envelope |
| `--response-file PATH` | Write long prose to file; envelope includes path |
| `--idempotency-key KEY` | Safe retry: same key returns existing job/result |
| `--on-done CMD` | With `--bg`: local shell hook when job finishes (not chat push) |
| `--force` | Rare: allow send even if a job is running for this name |

**Mutex:** if a job is already `running` for that name, `send` fails with the existing `jobId` unless `--force`.

Foreground result:

```json
{
  "sessionId": "…",
  "name": "audit",
  "response": "…",
  "responseFile": null,
  "isError": false,
  "durationMs": 1234,
  "brief": null,
  "cwd": null,
  "auto": null,
  "format": "prose"
}
```

Background accept:

```json
{
  "jobId": "…",
  "name": "audit",
  "sessionId": "…",
  "pid": 12345,
  "outPath": "/…/jobs/….json",
  "responseFile": null,
  "status": "running"
}
```

---

## `list` (spec)

```sh
droid-companion list [--stale] [--prune] [--deep]
```

```json
{
  "sessions": [ /* SessionRecord[] */ ],
  "count": 1,
  "roster": [
    {
      "name": "audit",
      "role": "security auditor",
      "cwd": "/path",
      "auto": null,
      "profile": "lite",
      "format": "findings",
      "job": "idle",
      "lastUsedAt": "…",
      "sessionId": "…"
    }
  ]
}
```

- Default / `--stale` / `--prune`: **cheap** health only (pids, files). No model “pong” turn.
- `--deep`: optional paid probe; documented as side-effecting (planned).

With `--stale` / `--prune`, also `stale`, `staleCount`, `pruned`.

---

## `close` (spec)

```sh
droid-companion close <name|sessionId> [--purge]
```

| Mode | Meaning |
|------|---------|
| default | **Untrack** — remove from companion roster/state |
| `--purge` | Also stop in-flight job if any + clean our job artifacts for that name |

Does **not** claim to fully delete droid’s own on-disk session unless droid exposes that API.

```json
{
  "sessionId": "…",
  "name": "audit",
  "closed": true,
  "purged": false,
  "note": "Removed from companion tracking. Droid may still retain session data."
}
```

---

## `status` / `result` (spec)

```sh
droid-companion status <jobId|name>
droid-companion result <jobId|name>
droid-companion result <jobId|name> --wait
```

`status`:

```json
{ "jobId": "…", "name": "audit", "status": "running|done|failed", "pid": 12345 }
```

`result`: final send JSON when `done`; structured error if still running or failed.  
`result --wait`: block until terminal; **does not** kill the job if the waiter disconnects.

See [background-jobs.md](background-jobs.md).

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Usage / runtime / doctor failure |
