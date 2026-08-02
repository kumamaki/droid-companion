/**
 * Contract text embedded at build/load time so brew/binary installs
 * still have a contract without a git checkout.
 *
 * Bun resolves this as a text module when compiling.
 */
import contractText from "../../contract/contract.md" with { type: "text" };

export const EMBEDDED_CONTRACT: string = String(contractText).trim();
