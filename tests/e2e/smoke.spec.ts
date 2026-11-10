import { expect, test } from "@playwright/test";

test("root routes visitors to staff login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Staff login" }),
  ).toBeVisible();
});

test("anonymous users cannot access the application shell", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});

test("access-denied page is clear and does not disclose internals", async ({
  page,
}) => {
  await page.goto("/access-denied");
  await expect(
    page.getByRole("heading", { name: "Access unavailable" }),
  ).toBeVisible();
  await expect(page.getByText("Row Level Security")).toHaveCount(0);
});
