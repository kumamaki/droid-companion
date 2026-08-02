import { createInterface } from "readline";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { runDoctorChecks, type DoctorCheckResult } from "../lib/doctor-checks";
import { PACKAGE_NAME, VERSION } from "../lib/paths";
import { cmdInstallSkill } from "./install-skill";

export type SkillAction =
  | "installed"
  | "skipped"
  | "already_present"
  | "refused_legacy"
  | "failed"
  | "reinstalled";

type SetupOptions = {
  yes?: boolean;
  skipSkill?: boolean;
  target?: string;
  /** Force JSON control-plane summary on stdout. */
  json?: boolean;
  /** Force human text even when non-TTY. */
  text?: boolean;
};

type SkillSummary = {
  action: SkillAction;
  targetDir: string;
  detail: string;
};

type SetupSummary = {
  ok: boolean;
  command: "setup";
  doctor: {
    ok: boolean;
    version: string;
    package: string;
    checks: DoctorCheckResult["checks"];
    notes: string[];
  };
  skill: {
    action: SkillAction;
    targetDir: string;
    detail: string;
  };
  next: string[];
};

/** Collapse $HOME to ~ for human display. */
function homePath(path: string): string {
  const home = homedir();
  if (path === home) return "~";
  if (path.startsWith(home + "/")) return "~" + path.slice(home.length);
  return path;
}

function isTty(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Human mode: TTY by default, or --text.
 * Machine mode: --json, or non-TTY without --text.
 */
function useHumanUi(opts: SetupOptions): boolean {
  if (opts.json) return false;
  if (opts.text) return true;
  return isTty();
}

function defaultSkillDir(target?: string): string {
  return target ?? join(homedir(), ".factory", "skills", "droid-companion");
}

function skillAlreadyInstalled(targetDir: string): boolean {
  return existsSync(join(targetDir, "SKILL.md"));
}

function legacyPresent(targetDir: string): boolean {
  return existsSync(join(targetDir, "companion.ts"));
}

function mark(ok: boolean): string {
  return ok ? "✓" : "✗";
}

/** Human lines always go to stdout so terminals don't paint them as errors. */
function out(line = ""): void {
  console.log(line);
}

async function promptYesNo(
  question: string,
  defaultYes: boolean,
): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(`${question} [${hint}] `, resolve);
    });
    const normalized = answer.trim().toLowerCase();
    if (!normalized) return defaultYes;
    if (normalized === "y" || normalized === "yes") return true;
    if (normalized === "n" || normalized === "no") return false;
    return defaultYes;
  } finally {
    rl.close();
  }
}

function printBanner(): void {
  out(`${PACKAGE_NAME} setup ${VERSION}`);
  out();
  out("Named multi-turn companion sessions for Factory Droid.");
  out("Needs the droid CLI on PATH and the same credentials as your host Droid.");
  out();
}

function printDoctorHuman(doctor: DoctorCheckResult): void {
  const c = doctor.checks;
  out("Environment");
  out(
    `  ${mark(c.droidOnPath)} droid      ${c.droidVersion ? c.droidVersion : (c.droidDetail ?? "not found")}`,
  );
  out(
    `  ${mark(c.contractPresent)} contract   ${c.contractPath ? homePath(c.contractPath) : "missing"}`,
  );
  out(
    `  ${mark(c.stateDirWritable)} state      ${homePath(c.stateDir)}${c.stateDirWritable ? "" : ` — ${c.stateDirDetail ?? "not writable"}`}`,
  );
  const authOk = c.authStatus === "credentialsPresent";
  out(
    `  ${authOk ? "✓" : "·"} auth       ${authOk ? "credentials present" : "credentials missing"} (not live-verified)`,
  );
  if (!authOk) {
    out(`             → ${c.authNote}`);
  }
  out();
  if (!doctor.ok) {
    out("Critical checks failed — fix droid / contract / state before spawn.");
    out();
  }
}

function printSkillHuman(skill: SkillSummary): void {
  out("Skill");
  const path = homePath(skill.targetDir);
  switch (skill.action) {
    case "installed":
      out(`  ✓ installed   ${path}`);
      break;
    case "reinstalled":
      out(`  ✓ reinstalled ${path}`);
      break;
    case "already_present":
      out(`  ✓ present     ${path}`);
      break;
    case "skipped":
      out(`  · skipped     ${path}`);
      if (skill.detail && !skill.detail.startsWith("Skipped via")) {
        out(`    ${skill.detail}`);
      }
      break;
    case "refused_legacy":
      out(`  ✗ blocked     ${path}`);
      out(`    ${skill.detail}`);
      break;
    case "failed":
      out(`  ✗ failed      ${path}`);
      out(`    ${skill.detail}`);
      break;
  }
  out();
}

function printCheatSheet(doctorOk: boolean): void {
  out("Next");
  if (!doctorOk) {
    out("  (spawn will fail until environment is green)");
  }
  out("  droid-companion spawn --name smoke --preset advisor");
  out('  droid-companion send smoke "What should I know about companions?"');
  out("  droid-companion list");
  out("  droid-companion close smoke");
  out();
  out("Long work:  send --bg · result --wait  (never re-send after a timeout)");
  out("Docs:       docs/agent-guide.md · skill name: droid-companion");
  out();
}

function printFooter(ok: boolean): void {
  if (ok) {
    out("Ready.");
  } else {
    out("Not ready — fix the items above, then re-run setup.");
  }
}

async function installSkillQuiet(opts: {
  target?: string;
  force?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const originalLog = console.log;
  const originalError = console.error;
  try {
    console.log = () => {};
    console.error = () => {};
    await cmdInstallSkill({ target: opts.target, force: opts.force });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "install-skill failed" };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

/** Non-interactive skill policy for `--yes`. */
async function skillAuto(opts: SetupOptions): Promise<SkillSummary> {
  const targetDir = defaultSkillDir(opts.target);
  if (opts.skipSkill) {
    return {
      action: "skipped",
      targetDir,
      detail: "Skipped via --skip-skill",
    };
  }

  const present = skillAlreadyInstalled(targetDir);
  const legacy = legacyPresent(targetDir);

  if (present) {
    return {
      action: "already_present",
      targetDir,
      detail: `Skill already installed at ${homePath(targetDir)}`,
    };
  }

  if (legacy) {
    return {
      action: "refused_legacy",
      targetDir,
      detail:
        "Legacy companion.ts present; --yes will not force-overwrite. Use interactive setup or install-skill --force.",
    };
  }

  const result = await installSkillQuiet({
    target: opts.target,
    force: false,
  });
  if (!result.ok) {
    return { action: "failed", targetDir, detail: result.error };
  }
  return {
    action: "installed",
    targetDir,
    detail: `Installed skill into ${homePath(targetDir)}`,
  };
}

async function skillInteractive(
  opts: SetupOptions,
  human: boolean,
): Promise<SkillSummary> {
  const targetDir = defaultSkillDir(opts.target);
  if (opts.skipSkill) {
    return {
      action: "skipped",
      targetDir,
      detail: "Skipped via --skip-skill",
    };
  }

  const present = skillAlreadyInstalled(targetDir);
  const legacy = legacyPresent(targetDir);
  const show = (line: string) => {
    if (human) out(line);
  };

  if (present) {
    show(`Skill already installed: ${homePath(targetDir)}`);
    const reinstall = await promptYesNo(
      "Reinstall public SKILL.md + contract?",
      false,
    );
    if (!reinstall) {
      return {
        action: "already_present",
        targetDir,
        detail: `Left existing skill at ${homePath(targetDir)}`,
      };
    }
    if (legacy) {
      show(
        "This directory has a legacy companion.ts (private layout). Force installs public SKILL.md only; does not delete companion.ts.",
      );
      const force = await promptYesNo(
        "Force reinstall public skill files?",
        false,
      );
      if (!force) {
        return {
          action: "refused_legacy",
          targetDir,
          detail: "User declined force reinstall over legacy layout",
        };
      }
      const result = await installSkillQuiet({
        target: opts.target,
        force: true,
      });
      if (!result.ok) {
        return { action: "failed", targetDir, detail: result.error };
      }
      return {
        action: "reinstalled",
        targetDir,
        detail: `Force-reinstalled public skill into ${homePath(targetDir)}`,
      };
    }
    const result = await installSkillQuiet({
      target: opts.target,
      force: false,
    });
    if (!result.ok) {
      return { action: "failed", targetDir, detail: result.error };
    }
    return {
      action: "reinstalled",
      targetDir,
      detail: `Reinstalled skill into ${homePath(targetDir)}`,
    };
  }

  if (legacy) {
    show(
      `Skill dir has legacy companion.ts but no public SKILL.md: ${homePath(targetDir)}`,
    );
    show("Install refuses without force to avoid clobbering private layouts.");
    const force = await promptYesNo(
      "Force install public SKILL.md + contract?",
      false,
    );
    if (!force) {
      return {
        action: "refused_legacy",
        targetDir,
        detail: "User declined force install over legacy companion.ts",
      };
    }
    const result = await installSkillQuiet({
      target: opts.target,
      force: true,
    });
    if (!result.ok) {
      return { action: "failed", targetDir, detail: result.error };
    }
    return {
      action: "installed",
      targetDir,
      detail: `Force-installed public skill into ${homePath(targetDir)}`,
    };
  }

  const install = await promptYesNo(
    `Install skill into ${homePath(targetDir)}?`,
    true,
  );
  if (!install) {
    return {
      action: "skipped",
      targetDir,
      detail: "User declined skill install",
    };
  }

  const result = await installSkillQuiet({
    target: opts.target,
    force: false,
  });
  if (!result.ok) {
    return { action: "failed", targetDir, detail: result.error };
  }
  return {
    action: "installed",
    targetDir,
    detail: `Installed skill into ${homePath(targetDir)}`,
  };
}

function buildSummary(
  doctor: DoctorCheckResult,
  skill: SkillSummary,
): SetupSummary {
  return {
    ok: doctor.ok && skill.action !== "failed",
    command: "setup",
    doctor: {
      ok: doctor.ok,
      version: doctor.version,
      package: doctor.package,
      checks: doctor.checks,
      notes: doctor.notes,
    },
    skill: {
      action: skill.action,
      targetDir: skill.targetDir,
      detail: skill.detail,
    },
    next: [
      "droid-companion spawn --name smoke --preset advisor",
      'droid-companion send smoke "What should I know about companions?"',
      "droid-companion list",
      "droid-companion close smoke",
    ],
  };
}

/**
 * First-run wizard: doctor → optional skill install → cheat sheet.
 *
 * Human (default on TTY): friendly text on stdout, no JSON wall.
 * Machine (--json or non-TTY): JSON summary on stdout only.
 */
export async function cmdSetup(opts: SetupOptions): Promise<void> {
  const tty = isTty();
  const human = useHumanUi(opts);
  const auto = opts.yes === true || !tty;

  if (!tty && !opts.yes && !opts.json) {
    // non-TTY default is machine JSON; still run doctor + skill policy
  }

  if (human) {
    printBanner();
  }

  const doctor = await runDoctorChecks();
  if (human) {
    printDoctorHuman(doctor);
  }

  let skill: SkillSummary;
  if (opts.skipSkill) {
    skill = {
      action: "skipped",
      targetDir: defaultSkillDir(opts.target),
      detail: "Skipped via --skip-skill",
    };
  } else if (!tty && !opts.yes) {
    const targetDir = defaultSkillDir(opts.target);
    skill = {
      action: "skipped",
      targetDir,
      detail: skillAlreadyInstalled(targetDir)
        ? `Skill already at ${homePath(targetDir)}; non-interactive without --yes did not reinstall`
        : "Non-interactive without --yes; skill not installed. Re-run with --yes or a TTY.",
    };
  } else if (auto) {
    skill = await skillAuto(opts);
  } else {
    skill = await skillInteractive(opts, human);
  }

  const summary = buildSummary(doctor, skill);

  if (human) {
    printSkillHuman(skill);
    printCheatSheet(doctor.ok);
    printFooter(summary.ok);
  } else {
    // Machine: pure JSON on stdout (no human noise)
    console.log(JSON.stringify(summary, null, 2));
  }

  process.exit(summary.ok ? 0 : 1);
}
