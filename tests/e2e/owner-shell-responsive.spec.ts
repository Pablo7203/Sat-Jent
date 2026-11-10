import { expect, test } from "@playwright/test";

const activeEmail = process.env.E2E_ACTIVE_EMAIL;
const activePassword = process.env.E2E_ACTIVE_PASSWORD;

test("owner shell stays usable from narrow mobile through wide desktop", async ({
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

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
    await page.goto("/app/dashboard");
    await expect(
      page.getByRole("heading", { name: /Good morning/i }),
    ).toBeVisible();
    const documentWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(
      documentWidth,
      `Unexpected horizontal overflow at ${width}px`,
    ).toBeLessThanOrEqual(width);

    if (width < 768) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      const dialog = page.getByRole("dialog", {
        name: "Application navigation",
      });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Close navigation" }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("navigation", { name: "Mobile application navigation" })
        .getByRole("link", { name: "Dashboard" })
        .click();
      await expect(dialog).toBeHidden();
    } else {
      await expect(
        page.getByRole("navigation", { name: "Application navigation" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Open navigation" }),
      ).toBeHidden();
    }
  }
});
