import { describe, expect, it } from "vitest";
import { visibleAdminLinks } from "@/lib/auth/navigation";
import { accessSchema, branchSchema } from "@/features/admin/schemas";

describe("permission-aware navigation", () => {
  it("does not expose management routes to sales", () => {
    expect(
      visibleAdminLinks(["app.access", "branches.read"]).map(
        (link) => link.label,
      ),
    ).toEqual(["Branches"]);
  });
  it("shows user and branch management visibility to Super Admin permissions", () => {
    expect(
      visibleAdminLinks([
        "app.access",
        "users.read",
        "branches.read",
        "roles.read",
      ]).map((link) => link.label),
    ).toEqual(["Employees", "Branches", "Roles & access"]);
  });
});

describe("administration validation", () => {
  it("normalizes a valid branch code", () => {
    const value = branchSchema.parse({
      code: "br-01",
      name: "Main",
      address: "Accra",
      phone: "000",
      email: "",
      openingHours: "",
    });
    expect(value.code).toBe("BR-01");
  });
  it("rejects untrusted employee identifiers", () => {
    expect(
      accessSchema.safeParse({
        userId: "not-a-uuid",
        roleId: "also-invalid",
        branchIds: [],
        isActive: true,
      }).success,
    ).toBe(false);
  });
});
