import { describe, expect, it } from "vitest";
import { whatsappHref } from "@/lib/public-website";
describe("public website helpers", () => {
  it("creates an encoded WhatsApp message without accepting an empty number", () => {
    expect(whatsappHref(null, "hello")).toBeNull();
    expect(whatsappHref("+233 24 123 4567", "Tile & door")).toBe(
      "https://wa.me/233241234567?text=Tile%20%26%20door",
    );
  });
});
