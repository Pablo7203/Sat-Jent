import { expect, test } from "@playwright/test";

const activeEmail = process.env.E2E_ACTIVE_EMAIL;
const activePassword = process.env.E2E_ACTIVE_PASSWORD;

async function signIn(page: import("@playwright/test").Page) {
  test.skip(
    !activeEmail || !activePassword,
    "Prepared local Supabase employee credentials are required.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(activeEmail!);
  await page.getByLabel("Password").fill(activePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
}

test.describe("Phase 6 finance UI", () => {
  test("account and profitability workspace renders for an authorized user", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/app/finance");
    await expect(
      page.getByRole("heading", { name: "Finance & accounts" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Profit & loss/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Branch accounts" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Latest account movements" }),
    ).toBeVisible();
  });

  test("expenses workspace renders the submission and register workflows", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/app/expenses");
    await expect(page.getByRole("heading", { name: "Expenses" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Submit an expense" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit for approval" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Expense register" }),
    ).toBeVisible();
    await expect(page.getByText(/No expenses recorded yet/i)).toBeVisible();
  });

  test("executive dashboard includes filtered cost-aware profitability", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/app/dashboard?from=2026-08-01&to=2026-08-31");
    await expect(
      page.getByRole("heading", { name: "Profit & loss snapshot" }),
    ).toBeVisible();
    await expect(page.getByText("Known COGS", { exact: true })).toBeVisible();
    await expect(page.getByText("Gross profit", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Approved expenses", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open finance" }),
    ).toBeVisible();
  });

  test("finance and expenses remain within a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    for (const [path, title] of [
      ["/app/finance", "Finance & accounts"],
      ["/app/expenses", "Expenses"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content - dimensions.viewport).toBeLessThanOrEqual(5);
    }
  });
});
