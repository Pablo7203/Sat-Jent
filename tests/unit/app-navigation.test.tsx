import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmployeeContext, PermissionCode } from "@/lib/auth/types";
import { AppNavigation } from "@/components/layout/app-navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/dashboard" }));
vi.mock("next/link", () => ({
  default: ({ href, onClick, ...props }: ComponentProps<"a">) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    />
  ),
}));
vi.mock("@/features/auth/actions", () => ({ logout: vi.fn() }));
vi.mock("@/components/layout/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ownerContext = (
  permissions: PermissionCode[],
  scope: "COMPANY" | "BRANCH" = "COMPANY",
): EmployeeContext => ({
  user: { id: "owner-id", email: "owner@example.test" },
  profile: { fullName: "SAT-J Owner", phone: null, isActive: true },
  role: { id: "role-id", code: "OWNER", name: "Owner", scope },
  permissions,
  accessibleBranches: [
    { id: "branch-1", code: "MAIN", name: "Main", isActive: true },
  ],
});

describe("owner-focused application navigation", () => {
  it("shows authorized operational links and hides dormant or unimplemented links", () => {
    const context = ownerContext([
      "dashboard.company.read",
      "sales.read",
      "inventory.read",
      "purchases.read",
      "purchases.receive",
      "transfers.read",
      "customers.read",
      "receivables.read",
      "reports.company.read",
      "suppliers.read",
      "products.read",
      "categories.read",
      "branches.read",
      "users.read",
      "roles.read",
      "website.manage",
      "quotations.read",
      "audit.read",
    ]);
    render(<AppNavigation context={context} />);
    const desktop = within(
      screen.getByRole("navigation", { name: "Application navigation" }),
    );
    for (const label of [
      "Dashboard",
      "Sales",
      "Inventory",
      "Purchases",
      "Goods receiving",
      "Stock transfers",
      "Reports",
      "Suppliers",
      "Products",
      "Categories",
      "Branches",
      "Users & access",
      "Roles & permissions",
      "My profile",
    ]) {
      expect(desktop.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(
      desktop.queryByRole("link", { name: "Website settings" }),
    ).toBeNull();
    expect(desktop.queryByRole("link", { name: "Quotations" })).toBeNull();
    expect(desktop.queryByRole("link", { name: "Audit history" })).toBeNull();
  });

  it("keeps branch navigation scoped and hides company administration links", () => {
    render(
      <AppNavigation
        context={ownerContext(
          ["dashboard.branch.read", "sales.read", "inventory.read"],
          "BRANCH",
        )}
      />,
    );
    const desktop = within(
      screen.getByRole("navigation", { name: "Application navigation" }),
    );
    expect(
      desktop.getByRole("link", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(desktop.getByRole("link", { name: "Sales" })).toBeInTheDocument();
    expect(
      desktop.getByRole("link", { name: "Inventory" }),
    ).toBeInTheDocument();
    expect(desktop.queryByRole("link", { name: "Branches" })).toBeNull();
    expect(desktop.queryByRole("link", { name: "Users & access" })).toBeNull();
    expect(desktop.queryByRole("link", { name: "Goods receiving" })).toBeNull();
  });

  it("closes the mobile drawer after a navigation choice", () => {
    render(
      <AppNavigation
        context={ownerContext(["dashboard.company.read", "inventory.read"])}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = screen.getByRole("dialog", {
      name: "Application navigation",
    });
    fireEvent.click(within(dialog).getByRole("link", { name: "Inventory" }));
    expect(
      screen.queryByRole("dialog", { name: "Application navigation" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
