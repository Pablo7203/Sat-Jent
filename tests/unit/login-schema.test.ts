import { describe, expect, it } from "vitest";
import { loginSchema } from "@/features/auth/schema";

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    expect(
      loginSchema.safeParse({
        email: "staff@satjent.example",
        password: "secure-passphrase",
      }).success,
    ).toBe(true);
  });
  it("rejects invalid credentials", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});
