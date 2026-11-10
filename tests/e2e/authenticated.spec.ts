import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const activeEmail = process.env.E2E_ACTIVE_EMAIL;
const activePassword = process.env.E2E_ACTIVE_PASSWORD;
const inactiveEmail = process.env.E2E_INACTIVE_EMAIL;
const inactivePassword = process.env.E2E_INACTIVE_PASSWORD;

test("active employee logs in, sees the protected shell, and logs out", async ({
  page,
}) => {
  test.skip(
    !activeEmail || !activePassword,
    "Prepared local Supabase employee credentials are required.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(activeEmail!);
  await page.getByLabel("Password").fill(activePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
  await expect(
    page.getByRole("heading", { name: /Good morning/i }),
  ).toBeVisible();
  const desktopSignOut = page
    .locator("aside")
    .getByRole("button", { name: "Sign out" });
  if (await desktopSignOut.isVisible()) {
    await desktopSignOut.click();
  } else {
    await page.getByLabel("Open navigation").click();
    await page
      .getByRole("navigation", { name: "Mobile application navigation" })
      .locator("xpath=..")
      .getByRole("button", { name: "Sign out" })
      .click();
  }
  await expect(page).toHaveURL(/\/login$/);
});

test("inactive employee is denied internal access", async ({ page }) => {
  test.skip(
    !inactiveEmail || !inactivePassword,
    "Prepared local Supabase inactive credentials are required.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(inactiveEmail!);
  await page.getByLabel("Password").fill(inactivePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/access-denied/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/access-denied/);
});

test("Super Admin sees employee management controls", async ({ page }) => {
  test.skip(
    !activeEmail || !activePassword,
    "Prepared local Supabase employee credentials are required.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(activeEmail!);
  await page.getByLabel("Password").fill(activePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
  await page.goto("/app/admin/users");
  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Invite employee" }),
  ).toBeVisible();
});

test("Super Admin filters a report and exports the same scoped CSV", async ({
  page,
}) => {
  test.skip(
    !activeEmail || !activePassword,
    "Prepared local Supabase employee credentials are required.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(activeEmail!);
  await page.getByLabel("Password").fill(activePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
  await page.goto("/app/reports/sales?from=2026-08-01&to=2026-08-31");
  await expect(
    page.getByRole("heading", { name: "Sales report" }),
  ).toBeVisible();
  await expect(page.getByText("Africa/Accra", { exact: false })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "sat-j-sales-2026-08-01-2026-08-31.csv",
  );
});

test("Super Admin creates an atomic draft product", async ({
  page,
}, testInfo) => {
  test.skip(
    !activeEmail || !activePassword,
    "Prepared local Supabase employee credentials are required.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(activeEmail!);
  await page.getByLabel("Password").fill(activePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
  await page.goto("/app/products/new");
  const name = `E2E Kettle ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Product name").fill(name);
  await page.getByLabel("Sellable variant description").fill("Standard");
  await page
    .getByLabel("Item Code")
    .fill(`E2E-${testInfo.project.name}-${Date.now()}`);
  await page.getByLabel("Retail price (GHS)").fill("149.95");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page).toHaveURL(/\/app\/products\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(/Item Code E2E-/)).toBeVisible();
  await expect(page.getByText("GH₵149.95", { exact: true })).toBeVisible();
});

test("Super Admin searches stock by Item Code at a selected branch", async ({
  page,
}) => {
  test.skip(
    !activeEmail || !activePassword,
    "Prepared local Supabase employee credentials are required.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(activeEmail!);
  await page.getByLabel("Password").fill(activePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
  await page.goto("/app/inventory");
  await page.getByLabel("Branch").selectOption({ label: "SAT-J MAIN" });
  await page
    .getByRole("combobox", { name: "Search products" })
    .fill("E2E-INV-DESKTOP");
  const firstResult = page.getByRole("listbox").getByRole("option").first();
  await expect(firstResult).toContainText("Item Code E2E-INV-DESKTOP");
  await expect(firstResult).toContainText("E2E Inventory Tile");
  await expect(firstResult).toContainText("Desktop");
  await expect(firstResult).toContainText("IN STOCK");
  await firstResult.click();
  await expect(page).toHaveURL(/\/app\/inventory\/[0-9a-f-]+$/);
});

test("Super Admin posts opening stock and sees its ledger balance", async ({
  page,
}, testInfo) => {
  test.skip(
    !activeEmail || !activePassword,
    "Prepared local Supabase credentials are required.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(activeEmail!);
  await page.getByLabel("Password").fill(activePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
  await page.goto("/app/inventory/opening-stock");
  const desktop = testInfo.project.name === "chromium",
    sku = desktop ? "E2E-INV-DESKTOP" : "E2E-INV-MOBILE",
    variantId = desktop
      ? "65000000-0000-4000-8000-000000000001"
      : "65000000-0000-4000-8000-000000000002";
  await page.getByLabel("Variant 1").selectOption(variantId);
  await page.getByLabel("Quantity 1").fill("25");
  await page.getByLabel("Minimum 1").fill("5");
  await page
    .getByLabel("Confirmation note")
    .fill("Verified physical E2E opening balance");
  await page
    .getByRole("button", { name: "Confirm and post opening stock" })
    .press("Enter");
  await expect(page.getByRole("status")).toContainText(
    /Posted opening stock|already been posted/,
  );
  await page.goto(`/app/inventory?q=${sku}`);
  const productRow = page.getByRole("link").filter({ hasText: sku }).first();
  await expect(productRow).toBeVisible();
  await expect(productRow).toContainText(/\d+(?:\.\d+)?\s*pc/i);
  await page.goto("/app/inventory/movements?type=OPENING_STOCK");
  await expect(page.getByText(sku, { exact: false }).first()).toBeVisible();
  await expect(
    page.getByText("OPENING STOCK", { exact: true }).first(),
  ).toBeVisible();
});

test("Super Admin completes a paid Walk-In sale and receives a receipt", async ({
  page,
}, testInfo) => {
  test.skip(
    !activeEmail || !activePassword,
    "Prepared local Supabase credentials are required.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(activeEmail!);
  await page.getByLabel("Password").fill(activePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
  await page.goto("/app/sales/new");
  const itemCode =
    testInfo.project.name === "chromium" ? "E2E-INV-DESKTOP" : "E2E-INV-MOBILE";
  const result = page
    .getByRole("listbox", { name: "Product search results" })
    .getByRole("option")
    .filter({ hasText: itemCode });
  await page.getByRole("combobox", { name: "Search products" }).fill(itemCode);
  await expect(result).toBeVisible();
  await result.click();
  const quantity = page.getByLabel("Quantity", { exact: true });
  await quantity.fill("2");
  await quantity.press("Enter");
  await expect(page.getByText("1 item", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save draft sale" }).click();
  await expect(page).toHaveURL(/\/app\/sales\/[0-9a-f-]+$/);
  await page.getByLabel("Payment now").fill("250");
  await page.getByLabel("Payment method").selectOption("CASH");
  await page
    .getByLabel("Deposit to account")
    .selectOption({ label: "E2E Cash Account · CASH" });
  await page.getByRole("button", { name: "Complete sale" }).click();
  await expect(
    page.getByText("COMPLETED · PAID", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Print receipt" })).toBeVisible();
});

test("Super Admin dispatches and receives an inter-branch transfer", async ({
  page,
}, testInfo) => {
  test.skip(
    !activeEmail || !activePassword,
    "Prepared local Supabase credentials are required.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(activeEmail!);
  await page.getByLabel("Password").fill(activePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
  const variantId =
    testInfo.project.name === "chromium"
      ? "65000000-0000-4000-8000-000000000007"
      : "65000000-0000-4000-8000-000000000008";
  await page.goto("/app/inventory/opening-stock");
  await page
    .locator('select[name="branchId"]')
    .selectOption({ label: "SAT-J MAIN" });
  await page.getByLabel("Variant 1").selectOption(variantId);
  await page.getByLabel("Quantity 1").fill("1000");
  await page.getByLabel("Minimum 1").fill("2");
  await page.getByLabel("Confirmation note").fill("Transfer E2E opening stock");
  await page
    .getByRole("button", { name: "Confirm and post opening stock" })
    .press("Enter");
  await expect(page.getByRole("status")).toContainText(
    /Posted opening stock|already been posted/,
  );
  await page.goto("/app/transfers/new");
  const sourceBranch = page.locator('select[name="sourceBranchId"]');
  const sourceMain = await sourceBranch
    .locator("option")
    .filter({ hasText: "SAT-J MAIN" })
    .first()
    .getAttribute("value");
  const destinationBranch = page.locator('select[name="destinationBranchId"]');
  const destinationOyibi = await destinationBranch
    .locator("option")
    .filter({ hasText: "SAT-J OYIBI" })
    .first()
    .getAttribute("value");
  expect(sourceMain).toBeTruthy();
  expect(destinationOyibi).toBeTruthy();
  await sourceBranch.selectOption(sourceMain!);
  await destinationBranch.selectOption(destinationOyibi!);
  await page.getByLabel("Product variant 1").selectOption(variantId);
  await page.getByLabel("Quantity 1").fill("5");
  await page
    .getByRole("button", { name: "Save and submit request" })
    .press("Enter");
  await expect(page).toHaveURL(/\/app\/transfers\/[0-9a-f-]+$/);
  await expect(page.getByText("REQUESTED", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Approve requested quantities" })
    .click();
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm full dispatch" }).click();
  await expect(page.getByText("DISPATCHED", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "5", exact: true }).last(),
  ).toBeVisible();
  await page.goto("/app/finance");
  await expect(
    page.getByRole("heading", { name: "Stock in transit valuation" }),
  ).toBeVisible();
  await expect(
    page.getByText("UNVALUED", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Unvalued", { exact: true }).first(),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Confirm full receipt" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm full receipt" }).click();
  await expect(page.getByText("RECEIVED", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "0", exact: true }).last(),
  ).toBeVisible();
});
