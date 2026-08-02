import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import { REPO_ROOT, resolveContractPath } from "../lib/paths";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

/**
 * Copy public skill + contract into ~/.factory/skills/droid-companion/
 * so the main Droid can load the skill.
 *
 * Refuses to overwrite when a legacy private companion.ts is present
 * unless --force (avoids clobbering a hand-maintained private skill).
 */
export async function cmdInstallSkill(opts: {
  target?: string;
  force?: boolean;
}): Promise<void> {
  const skillSrc = join(REPO_ROOT, "skill", "SKILL.md");
  const contractSrc =
    resolveContractPath() ?? join(REPO_ROOT, "contract", "contract.md");

  if (!existsSync(skillSrc)) {
    throw new Error(`Skill file not found: <${skillSrc}>`);
  }
  if (!existsSync(contractSrc)) {
    throw new Error(`Contract file not found: <${contractSrc}>`);
  }

  const targetDir =
    opts.target ?? join(homedir(), ".factory", "skills", "droid-companion");
  mkdirSync(targetDir, { recursive: true });

  const skillDest = join(targetDir, "SKILL.md");
  const contractDest = join(targetDir, "contract.md");
  const legacyCli = join(targetDir, "companion.ts");
  const legacyPresent = existsSync(legacyCli);

  if (legacyPresent && !opts.force) {
    console.error(
      JSON.stringify({
        error:
          "Refusing to overwrite skill dir that contains legacy companion.ts (private layout).",
        targetDir,
        legacyCompanionTs: legacyCli,
        hint: "Pass --force to install public SKILL.md/contract.md anyway, or --target DIR for a separate path.",
      }),
    );
    process.exit(1);
  }

  let skillBody = readFileSync(skillSrc, "utf-8");
  skillBody = skillBody.replace(
    /bun \/path\/to\/droid-companion\/src\/companion\.ts/g,
    `bun ${join(REPO_ROOT, "src", "companion.ts")}`,
  );

  writeFileSync(skillDest, skillBody.endsWith("\n") ? skillBody : skillBody + "\n");
  copyFileSync(contractSrc, contractDest);

  writeFileSync(
    join(targetDir, "INSTALL_SOURCE.txt"),
    `Installed from <${REPO_ROOT}> at ${new Date().toISOString()}\n` +
      `Binary: droid-companion (or bun ${join(REPO_ROOT, "src", "companion.ts")})\n` +
      (legacyPresent ? `Legacy companion.ts left in place (force install).\n` : ""),
  );

  output({
    ok: true,
    targetDir,
    skill: skillDest,
    contract: contractDest,
    legacyCompanionTs: legacyPresent ? legacyCli : null,
    forced: opts.force === true,
    warnings: legacyPresent
      ? [
          "Legacy companion.ts present; public SKILL.md installed with --force. Prefer PATH `droid-companion` from this repo for new work.",
        ]
      : [],
    note: "Main Droid should pick up skill/droid-companion.",
  });
}
