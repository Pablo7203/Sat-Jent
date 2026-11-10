import { afterEach, describe, expect, it, vi } from "vitest";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

afterEach(() => vi.unstubAllEnvs());

describe("public website switch", () => {
  it("is enabled by default and can be explicitly disabled", () => {
    expect(isPublicWebsiteEnabled(undefined)).toBe(true);
    expect(isPublicWebsiteEnabled("false")).toBe(false);
    expect(isPublicWebsiteEnabled("TRUE")).toBe(true);
    expect(isPublicWebsiteEnabled("true")).toBe(true);
  });
});
