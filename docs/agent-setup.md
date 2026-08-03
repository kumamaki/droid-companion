# Agent setup guide

You are reading this because a human asked you to **install and set up droid-companion**.

**Do not jump straight to brew/clone.** Run the interactive intake below first (unless they already answered in the same message). Then install, then close with a recipe matched to their answers.

Canonical repo: https://github.com/kumamaki/droid-companion  
This file (raw): https://raw.githubusercontent.com/kumamaki/droid-companion/main/docs/agent-setup.md  
After setup, day-to-day CLI use: [agent-guide.md](agent-guide.md)

---

## 0. What you are installing (say this once, short)

In your own words, cover:

- **droid-companion** wraps Factory `droid exec` into **named multi-turn companions**.
- You spawn once by name (`audit`, `fixer`), `send` many times, `close` when done.
- **JSON** for status/jobs; **files** for long prompts. Nothing is pushed into the main chat.
- It does **not** replace `droid`. One-shot work stays `droid exec`. Companions are for specialists that should **remember prior turns**.

Then run the intake. Do not install yet.

---

## 1. Interactive intake (required)

Ask these in chat. Prefer 2–4 short questions; use the harness multi-choice tool if you have one, otherwise plain numbered options. Wait for answers before install.

If the human already stated goals in the paste message, **skip only the covered questions** and confirm in one line.

### Q1 — Primary job (pick one, or “a few”)

> What do you most want companions for?

| Option | Meaning |
|--------|---------|
| **A. Review** | Ruthless code review / findings |
| **B. Security** | Auth, injection, secrets, privilege boundaries |
| **C. Implement** | Small focused fixes that may edit the tree |
| **D. Advise** | Tradeoffs, design, “what should I do?” |
| **E. Not sure** | You will demo the four built-in personas |

Map later:

| Answer | Default persona | Notes |
|--------|-----------------|-------|
| A | `critic` | lite · findings · read-only |
| B | `auditor` | lite · findings · read-only |
| C | `fixer` | full · prose · auto=low |
| D | `advisor` | full · prose · read-only |
| E | walk through all four | start smoke with `advisor` |

### Q2 — Who drives the CLI?

> Who will call `droid-companion` day to day?

| Option | Meaning |
|--------|---------|
| **1. Main coding agent** | You (this agent) spawn/send/close; install the skill |
| **2. Human in terminal** | They type commands; skill still useful for agent later |
| **3. Both** | Install skill + show human cheat sheet |

Default if unclear: **3**.

### Q3 — Long work?

> Will any companion turn run longer than a typical host tool timeout (~1–2 min)?

| Option | Meaning |
|--------|---------|
| **Yes** | Teach `send --bg` · `result --wait` · `--idempotency-key` |
| **No / rare** | Mention bg exists; keep first demo foreground |
| **Unsure** | Mention once; demo foreground |

### Q4 — Install path (only if not obvious)

> How should I install?

| Option | When |
|--------|------|
| **Homebrew** | macOS, they use brew (default on Mac) |
| **From source** | They want latest main / already have Bun |
| **This repo** | cwd is already the droid-companion clone |
| **You choose** | Prefer brew on macOS, else source |

### Optional Q5 — First project cwd

> Path to the repo the first companion should see? (default: current workspace)

Store as `FIRST_CWD`.

### After answers

1. Restate in 3–5 bullets: primary job → persona, who drives CLI, bg or not, install path.
2. One line on **why this fits them** (not a sales pitch — concrete: “multi-turn critic so you don’t re-paste the PR each time”).
3. Ask: **Proceed with install?** Only continue on yes / implicit go-ahead.

Do **not** open a PR, bump versions, or `git push` / `just ship` unless they ask.

---

## 2. Prerequisites (check before install)

1. **`droid` on PATH** — `droid --version`
2. **Droid auth** — same login / `FACTORY_API_KEY` as host Droid
3. **Bun** ≥ 1.1 if building from source or brew formula needs it at install time

If `droid` is missing or unauthenticated, fix that **with the human** before companions. You cannot invent Factory credentials.

---

## 3. Install (pick the path they chose)

### A. Homebrew (macOS default)

```bash
brew tap kumamaki/tap
brew trust --formula kumamaki/tap/droid-companion   # Homebrew 6+
which bun || curl -fsSL https://bun.sh/install | bash
brew install droid-companion
```

### B. From source

```bash
git clone https://github.com/kumamaki/droid-companion.git
cd droid-companion
bun src/companion.ts setup --yes
# optional: alias droid-companion='bun /absolute/path/to/droid-companion/src/companion.ts'
```

### C. Already in this repo

```bash
bun src/companion.ts setup --yes
# or: just setup --yes
```

### Always finish with

```bash
droid-companion doctor
# or: bun src/companion.ts doctor

droid-companion setup --yes
# doctor + skill when safe

droid-companion --version
droid-companion config show   # creates ~/.config/droid-companion/config.toml if missing
```

If skill install was skipped or refused:

```bash
droid-companion install-skill
# --force only after they confirm overwrite of a private layout
```

Human-only TTY wizard (skip if you already ran `--yes` unless they want the text walkthrough):

```bash
droid-companion setup --text
```

Report: binary path/version, doctor `ok`, `authStatus`, config path, skill path.

---

## 4. Tailored first use (interactive close)

Do **not** dump the full CLI reference. Run a **short demo matched to Q1**, then leave them with copy-paste commands for their case.

### Smoke (always good after install)

```bash
droid-companion spawn --name smoke --persona advisor --cwd "$FIRST_CWD"
droid-companion send smoke "In one sentence: what is a named companion for?"
droid-companion list
droid-companion close smoke
```

Skip live spawn if doctor/auth is red — explain what failed.

### Recipe by Q1 answer

**A — Review (`critic`)**

```sh
droid-companion spawn --name review --persona critic --cwd .
# put the ask in a file for multi-line content
droid-companion send review --message-file ask.md
droid-companion list
# later: droid-companion close review
```

**B — Security (`auditor`)**

```sh
droid-companion spawn --name audit --persona auditor --cwd .
droid-companion send audit --message-file security-ask.md
```

**C — Implement (`fixer`)**

```sh
droid-companion spawn --name fix --persona fixer --cwd .
droid-companion send fix --message-file task.md
```

**D — Advise (`advisor`)**

```sh
droid-companion spawn --name plan --persona advisor --cwd .
droid-companion send plan "Tradeoffs of X vs Y given our constraints: …"
```

**E — Not sure** — show the persona table once, run smoke with `advisor`, invite them to pick A–D for a second spawn.

### If Q3 = long work

Add explicitly:

```sh
droid-companion send NAME --bg --message-file deep.md --idempotency-key deep-1
droid-companion result NAME --wait
# if the waiter is cut off, poll status/result — do not re-send the same ask
```

### If Q2 includes main agent

Confirm skill is installed and say you will use `droid-companion` for multi-turn specialists from here (announce name + role in the user transcript; keep a one-line roster).

---

## 5. Hard rules to leave them with (max 6 lines)

1. Always `--name` on spawn  
2. JSON for verbs/state · `--message-file` for long content  
3. Long work: `send --bg` → `result --wait` · optional `--idempotency-key`  
4. One in-flight job per name  
5. No chat push · no recipes (`discuss` / `jury` / `vision`) in v0.1  
6. `close` untracks local state; Droid may keep session data on disk  

Docs: [agent-guide](agent-guide.md) · [cli-reference](cli-reference.md) · [skill](../skill/SKILL.md)

---

## 6. Dev flavor (only if they ask)

`droid-companion-dev` / `DROID_COMPANION_FLAVOR=dev` → isolated:

- `~/.config/droid-companion-dev/config.toml`
- `~/.local/share/droid-companion-dev/`

From this repo: `just run-dev doctor`. Do not force dev on a normal install.

---

## 7. Diagnosis

| Symptom | Check |
|---------|--------|
| command not found | brew link / PATH / alias to `bun …/companion.ts` |
| doctor `droidOnPath: false` | install Factory `droid`, or set `DROID_BIN` |
| `authStatus: credentialsMissing` | `droid` login or `FACTORY_API_KEY` |
| skill install refused | private skill layout — `--force` only with confirm |
| bad config | `config show` / fix `~/.config/droid-companion/config.toml` |

More: [install.md](install.md).

---

## Session checklist (agent)

```
[ ] Intake Q1–Q4 (and Q5 if useful) — answers recorded
[ ] Restate fit + proceed confirmation
[ ] Prereqs: droid version + auth signal
[ ] Install path completed
[ ] doctor ok (or failures explained)
[ ] skill installed or deliberate skip
[ ] Tailored recipe + optional smoke
[ ] Hard rules (short)
```
