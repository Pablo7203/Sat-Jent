import { expect, test } from "@playwright/test";

const publicWebsiteEnabled = process.env.PUBLIC_WEBSITE_ENABLED === "true";

test("root sends visitors into the management login flow", async ({ page }) => {
  test.skip(
    publicWebsiteEnabled,
    "This check covers disabled public-site mode.",
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Staff login" }),
  ).toBeVisible();
});

test("customer-facing pages and quote entry are disabled", async ({ page }) => {
  test.skip(
    publicWebsiteEnabled,
    "This check covers disabled public-site mode.",
  );
  for (const path of [
    "/products",
    "/products/e2e-inventory-tile",
    "/categories/tiles",
    "/quote",
    "/contact",
    "/about",
    "/branches",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Staff login" }),
    ).toBeVisible();
  }
});

test("disabled website is not advertised through sitemap or robots", async ({
  request,
}) => {
  test.skip(
    publicWebsiteEnabled,
    "This check covers disabled public-site mode.",
  );
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("<loc>");
  expect(sitemap).not.toContain("/products/");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /");
  expect(robots).not.toContain("Sitemap:");
});
