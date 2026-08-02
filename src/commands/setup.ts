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
};

type SkillSummary = {
  action: SkillAction;
  targetDir: string;
  detail: string;
};

function human(line: string): void {
  console.error(line);
}

function mark(ok: boolean): string {
  return ok ? "✓" : "✗";
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

function isTty(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function promptYesNo(
  question: string,
  defaultYes: boolean,
): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
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
  human(`${PACKAGE_NAME} setup ${VERSION}`);
  human("");
  human(
    "Named multi-turn companion sessions for Factory Droid (droid exec + names + jobs).",
  );
  human(
    "Requires the droid CLI on PATH and the same credentials as your host Droid.",
  );
  human("");
}

function printDoctorHuman(doctor: DoctorCheckResult): void {
  const c = doctor.checks;
  human("Environment");
  human(
    `  ${mark(c.droidOnPath)} droid on PATH  ${c.droidVersion ? `(${c.droidVersion})` : c.droidDetail ?? ""}`,
  );
  human(
    `  ${mark(c.contractPresent)} contract     ${c.contractPath ?? "missing"}`,
  );
  human(
    `  ${mark(c.stateDirWritable)} state dir    ${c.stateDir}${c.stateDirWritable ? "" : ` — ${c.stateDirDetail ?? "not writable"}`}`,
  );
  human(
    `  ${c.authStatus === "credentialsPresent" ? "✓" : "·"} auth         ${c.authStatus} (not live-verified)`,
  );
  if (c.authStatus === "credentialsMissing") {
    human(`    → ${c.authNote}`);
  }
  human("");
  if (!doctor.ok) {
    human("Critical checks failed — fix droid/contract/state before spawn.");
    human("");
  }
}

function printCheatSheet(doctorOk: boolean): void {
  human("Next commands");
  if (!doctorOk) {
    human("  (spawn will fail until doctor is green)");
  }
  human("  droid-companion spawn --name smoke --preset advisor");
  human('  droid-companion send smoke "What should I know about companions?"');
  human("  droid-companion list");
  human("  droid-companion close smoke");
  human("");
  human(
    "Long work: send --bg · result --wait  (never re-send after a timeout)",
  );
  human(
    "Agent playbook: docs/agent-guide.md · skill name after install: droid-companion",
  );
  human("");
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

/** Non-interactive skill policy for `--yes` (and non-TTY without prompts). */
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
      detail: `Skill already installed at <${targetDir}>`,
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
    detail: `Installed skill into <${targetDir}>`,
  };
}

async function skillInteractive(opts: SetupOptions): Promise<SkillSummary> {
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
    human(`Skill already installed: <${targetDir}>`);
    const reinstall = await promptYesNo(
      "Reinstall public SKILL.md + contract?",
      false,
    );
    if (!reinstall) {
      return {
        action: "already_present",
        targetDir,
        detail: `Left existing skill at <${targetDir}>`,
      };
    }
    if (legacy) {
      human(
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
        detail: `Force-reinstalled public skill into <${targetDir}>`,
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
      detail: `Reinstalled skill into <${targetDir}>`,
    };
  }

  if (legacy) {
    human(
      `Skill dir has legacy companion.ts but no public SKILL.md: <${targetDir}>`,
    );
    human("Install refuses without force to avoid clobbering private layouts.");
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
      detail: `Force-installed public skill into <${targetDir}>`,
    };
  }

  const install = await promptYesNo(`Install skill into ${targetDir}?`, true);
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
    detail: `Installed skill into <${targetDir}>`,
  };
}

/**
 * Interactive (TTY) or --yes first-run wizard:
 * doctor → optional skill install → cheat sheet → JSON summary on stdout.
 */
export async function cmdSetup(opts: SetupOptions): Promise<void> {
  const tty = isTty();
  const auto = opts.yes === true || !tty;

  if (!tty && !opts.yes) {
    human(
      "Non-interactive terminal; running doctor + cheat sheet only. Re-run with --yes to install skill, or use a TTY for prompts.",
    );
    human("");
  }

  printBanner();

  const doctor = await runDoctorChecks();
  printDoctorHuman(doctor);

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
        ? `Skill already at <${targetDir}>; non-interactive without --yes did not reinstall`
        : "Non-interactive without --yes; skill not installed. Re-run with --yes or a TTY.",
    };
  } else if (auto) {
    // --yes (TTY or not): no prompts
    skill = await skillAuto(opts);
  } else {
    skill = await skillInteractive(opts);
  }

  human(`Skill: ${skill.detail}`);
  human("");

  printCheatSheet(doctor.ok);

  const summary = {
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

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.ok ? 0 : 1);
}
