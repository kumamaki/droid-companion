import { describe, expect, test } from "bun:test";
import packageJson from "../package.json";
import { PACKAGE_NAME, VERSION } from "../src/lib/paths";

describe("version single source", () => {
  test("VERSION matches package.json", () => {
    expect(VERSION).toBe(packageJson.version);
    expect(PACKAGE_NAME).toBe(packageJson.name);
  });
});
