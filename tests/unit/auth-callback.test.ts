import { describe, expect, it } from "vitest";
import { safeAuthNext } from "@/features/auth/callback-handler";

describe("safeAuthNext", () => {
  it("allows local application paths", () => {
    expect(safeAuthNext("/reset-password")).toBe("/reset-password");
  });

  it.each([null, "", "https://example.com", "//example.com"])(
    "rejects an unsafe destination %j",
    (value) => {
      expect(safeAuthNext(value)).toBe("/app");
    },
  );
});
