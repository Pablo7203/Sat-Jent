import { expect, test } from "@playwright/test";

const activeEmail = process.env.E2E_ACTIVE_EMAIL;
const activePassword = process.env.E2E_ACTIVE_PASSWORD;
const purchasingMutationsEnabled =
  process.env.E2E_PURCHASING_MUTATIONS === "true";
const itemCode = process.env.E2E_PURCHASING_ITEM_CODE ?? "E2E-INV-DESKTOP";

test("Super Admin drafts, confirms, and partially receives a purchase", async ({
  page,
}) => {
  test.skip(
    !purchasingMutationsEnabled,
    "Run only against a dedicated, isolated E2E database because this flow creates a goods receipt and stock movement.",
  );
  test.skip(
    !activeEmail || !activePassword,
    "Prepared local Supabase employee credentials are required.",
  );
  test.skip(
    test.info().project.name !== "chromium",
    "Keep this stateful purchasing workflow to one browser project.",
  );

  await page.goto("/login");
  await page.getByLabel("Email address").fill(activeEmail!);
  await page.getByLabel("Password").fill(activePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);

  await page.goto("/app/purchases/new");
  await page.locator('select[name="supplierId"]').selectOption({ index: 0 });
  await page.locator('select[name="branchId"]').selectOption({ index: 0 });
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/purchases\/[0-9a-f-]+$/);
  await expect(page.getByText(/ · DRAFT · UNPAID$/)).toBeVisible();

  await page.getByRole("link", { name: "Edit draft" }).click();
  await page.getByRole("combobox", { name: "Search products" }).fill(itemCode);
  const item = page
    .getByRole("listbox")
    .getByRole("option")
    .filter({
      hasText: `Item Code ${itemCode}`,
    });
  await expect(item).toBeVisible();
  await item.click();
  await page.getByLabel(`Quantity for Item Code ${itemCode}`).fill("2");
  await page.getByLabel(`Buying price for Item Code ${itemCode}`).fill("10");
  await page.getByRole("button", { name: "Save and confirm order" }).click();
  await expect(page).toHaveURL(/\/app\/purchases\/[0-9a-f-]+$/);
  await expect(page.getByText(/ · ORDERED · UNPAID$/)).toBeVisible();

  await page.getByRole("link", { name: "Receive goods" }).click();
  await page
    .getByRole("spinbutton", {
      name: new RegExp(`^Receive Item Code ${itemCode}`),
    })
    .fill("1");
  await page
    .getByRole("spinbutton", {
      name: new RegExp(`^Actual buying price for Item Code ${itemCode}`),
    })
    .fill("12");
  await page
    .getByRole("button", { name: "Review and post goods receipt" })
    .click();
  await expect(page).toHaveURL(/\/app\/purchases\/[0-9a-f-]+$/);
  await expect(page.getByText(/ · PARTIALLY_RECEIVED · UNPAID$/)).toBeVisible();
  await expect(
    page.getByText("GH₵12.00", { exact: true }).first(),
  ).toBeVisible();
});
