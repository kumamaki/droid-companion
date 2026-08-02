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

  if (!opts.force && existsSync(skillDest)) {
    // Still overwrite skill (product updates) but note it
  }

  // Rewrite skill paths: prefer `companion` on PATH; keep bun fallback to this repo for dev.
  let skillBody = readFileSync(skillSrc, "utf-8");
  skillBody = skillBody.replace(
    /bun \/path\/to\/droid-companion\/src\/companion\.ts/g,
    `bun ${join(REPO_ROOT, "src", "companion.ts")}`,
  );

  const legacyCli = join(targetDir, "companion.ts");
  const legacyPresent = existsSync(legacyCli);

  writeFileSync(skillDest, skillBody.endsWith("\n") ? skillBody : skillBody + "\n");
  copyFileSync(contractSrc, contractDest);

  // Pointer so users know install source
  writeFileSync(
    join(targetDir, "INSTALL_SOURCE.txt"),
    `Installed from <${REPO_ROOT}> at ${new Date().toISOString()}\n` +
      `Binary: companion (or bun ${join(REPO_ROOT, "src", "companion.ts")})\n`,
  );

  output({
    ok: true,
    targetDir,
    skill: skillDest,
    contract: contractDest,
    legacyCompanionTs: legacyPresent ? legacyCli : null,
    warnings: legacyPresent
      ? [
          "Target dir already had companion.ts (private skill layout). SKILL.md now points at the public CLI; legacy companion.ts was left in place but is no longer the skill entry.",
        ]
      : [],
    note: "Main Droid should pick up skill/droid-companion. Prefer `companion` on PATH or the bun path written into the skill.",
  });
}
