import { describe, expect, test } from "bun:test";
import {
  appSlug,
  cliBinaryName,
  resolveFlavor,
} from "../src/lib/flavor";

describe("resolveFlavor", () => {
  test("defaults to prod", () => {
    expect(resolveFlavor({}, ["/usr/bin/bun", "/app/src/companion.ts"])).toBe(
      "prod",
    );
  });

  test("DROID_COMPANION_FLAVOR=dev wins", () => {
    expect(
      resolveFlavor(
        { DROID_COMPANION_FLAVOR: "dev" },
        ["/usr/bin/bun", "/app/src/companion.ts"],
      ),
    ).toBe("dev");
  });

  test("DROID_COMPANION_FLAVOR=prod forces prod even when basename is dev", () => {
    expect(
      resolveFlavor(
        { DROID_COMPANION_FLAVOR: "prod" },
        ["/usr/local/bin/droid-companion-dev"],
      ),
    ).toBe("prod");
  });

  test("basename droid-companion-dev is dev", () => {
    expect(
      resolveFlavor({}, ["/Users/x/bin/droid-companion-dev", "doctor"]),
    ).toBe("dev");
  });

  test("compiled path basename detects dev", () => {
    expect(
      resolveFlavor(
        {},
        ["unused"],
        "/Users/x/Work/droid-companion/dist/droid-companion-dev",
      ),
    ).toBe("dev");
  });

  test("companion-dev.ts basename is not enough without env (entry sets FLAVOR)", () => {
    // Intentional: only exact droid-companion-dev name or env. Source entry
    // companion-dev.ts sets DROID_COMPANION_FLAVOR=dev before import.
    expect(
      resolveFlavor({}, ["/usr/bin/bun", "/app/src/companion-dev.ts"]),
    ).toBe("prod");
  });

  test("production alias maps to prod", () => {
    expect(resolveFlavor({ DROID_COMPANION_FLAVOR: "production" }, [])).toBe(
      "prod",
    );
  });
});

describe("appSlug / cliBinaryName", () => {
  test("prod slug", () => {
    expect(appSlug("prod")).toBe("droid-companion");
    expect(cliBinaryName("prod")).toBe("droid-companion");
  });

  test("dev slug", () => {
    expect(appSlug("dev")).toBe("droid-companion-dev");
    expect(cliBinaryName("dev")).toBe("droid-companion-dev");
  });
});
