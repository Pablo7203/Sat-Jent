import { describe, expect, it } from "vitest";
import { passwordSetupCallbackUrl, resolveSiteUrl } from "@/lib/env/site-url";

describe("resolveSiteUrl", () => {
  it.each([undefined, "", "   "])(
    "falls back when NEXT_PUBLIC_SITE_URL is %j",
    (configuredSiteUrl) => {
      expect(resolveSiteUrl({ configuredSiteUrl }).toString()).toBe(
        "http://localhost:3000/",
      );
    },
  );

  it("uses the configured absolute site URL", () => {
    expect(
      resolveSiteUrl({
        configuredSiteUrl: " https://staging.example.com/path ",
      }).toString(),
    ).toBe("https://staging.example.com/path");
  });

  it("uses VERCEL_URL when the configured site URL is empty", () => {
    expect(
      resolveSiteUrl({
        configuredSiteUrl: " ",
        vercelUrl: "sat-j-ent-staging.vercel.app",
      }).toString(),
    ).toBe("https://sat-j-ent-staging.vercel.app/");
  });

  it.each(["not a url", "ftp://example.com"])(
    "fails clearly for invalid configured value %j",
    (configuredSiteUrl) => {
      expect(() => resolveSiteUrl({ configuredSiteUrl })).toThrow(
        "NEXT_PUBLIC_SITE_URL must be a valid absolute HTTP or HTTPS URL",
      );
    },
  );
});

describe("passwordSetupCallbackUrl", () => {
  it("routes hosted invitations and recovery links through password setup", () => {
    expect(
      passwordSetupCallbackUrl({
        configuredSiteUrl: "https://staging.example.com",
      }),
    ).toBe("https://staging.example.com/auth/callback?next=/reset-password");
  });
});
