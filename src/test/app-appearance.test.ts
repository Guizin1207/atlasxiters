import { describe, expect, it } from "vitest";
import { APP_THEMES, DEFAULT_APPEARANCE, normalizeAppearance, prepareAppLogo } from "@/lib/app-appearance";

describe("App appearance", () => {
  it("offers the requested holidays", () => {
    expect(APP_THEMES.map((t) => t.id)).toEqual(expect.arrayContaining(["halloween", "christmas", "independence", "new-year", "children", "easter"]));
  });
  it("restores default for an unknown theme", () => {
    expect(normalizeAppearance({ theme: "unknown", logo: "" })).toEqual(DEFAULT_APPEARANCE);
  });
  it("keeps a saved theme and PNG logo", () => {
    expect(normalizeAppearance({ theme: "christmas", logo: "data:image/png;base64,aGVsbG8=" })).toEqual({ theme: "christmas", logo: "data:image/png;base64,aGVsbG8=" });
  });
  it("rejects executable and external logo payloads", () => {
    expect(normalizeAppearance({ theme: "easter", logo: "data:image/svg+xml,<svg/>" }).logo).toBe("");
    expect(normalizeAppearance({ logo: "https://example.com/logo.png" }).logo).toBe("");
  });
  it("rejects unsupported upload formats", async () => {
    await expect(prepareAppLogo(new File(["svg"], "logo.svg", { type: "image/svg+xml" }))).rejects.toThrow();
  });
});