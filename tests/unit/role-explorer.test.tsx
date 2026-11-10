import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { RoleExplorer } from "@/app/app/admin/access/role-explorer";

afterEach(cleanup);

const roles = [
  {
    id: "manager",
    name: "Branch Manager",
    code: "BRANCH_MANAGER",
    scope: "BRANCH",
    permissions: [
      { code: "sales.cancel", description: "Cancel eligible sales" },
      { code: "inventory.read", description: "Read branch inventory" },
    ],
  },
  {
    id: "cashier",
    name: "Sales / Cashier",
    code: "SALES",
    scope: "BRANCH",
    permissions: [{ code: "sales.read", description: "Read sales" }],
  },
];

it("collapses roles initially and toggles individual and all roles", () => {
  render(<RoleExplorer roles={roles} />);
  const manager = screen.getByRole("button", { name: /Branch Manager/ });
  expect(manager).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(manager);
  expect(screen.getByText("Cancel eligible sales")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
  expect(screen.getByText("Read sales")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
  expect(screen.getByText("Read sales")).not.toBeVisible();
});

it("combines case-insensitive permission search and module filtering, then clears", () => {
  render(<RoleExplorer roles={roles} />);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "CANCEL" },
  });
  expect(screen.getByRole("status")).toHaveTextContent("1 of 2 roles");
  expect(screen.getByText("Cancel eligible sales")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /Sales \/ Cashier/ }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "inventory" },
  });
  expect(screen.getByText("No matching permissions")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByRole("status")).toHaveTextContent("2 of 2 roles");
  expect(screen.getByRole("searchbox")).toHaveValue("");
  expect(screen.getByRole("combobox")).toHaveValue("");
});
