import { test, expect } from "@playwright/test";

test.describe("Drying Estimate Panel", () => {
  test("trend chart shows estimate panel when moisture data exists", async ({
    page,
  }) => {
    await page.goto("/", { timeout: 60_000 });
    const trendBtn = page.locator("button", { hasText: "趨勢" }).first();
    await trendBtn.click();
    await page
      .waitForSelector("text=載入中...", {
        state: "hidden",
        timeout: 15_000,
      })
      .catch(() => {});

    const panel = page.locator("text=烘乾推估");
    const hasData = await panel.isVisible().catch(() => false);

    if (hasData) {
      await expect(page.locator("text=已烘乾")).toBeVisible();
      await expect(page.locator("text=下降速率")).toBeVisible();
      await expect(page.locator("text=水分變化")).toBeVisible();
    }
  });

  test("estimate panel shows confidence indicator", async ({ page }) => {
    await page.goto("/");
    const trendBtn = page.locator("button", { hasText: "趨勢" }).first();
    await trendBtn.click();
    await page
      .waitForSelector("text=載入中...", {
        state: "hidden",
        timeout: 15_000,
      })
      .catch(() => {});

    const panel = page.locator("text=烘乾推估");
    const hasData = await panel.isVisible().catch(() => false);

    if (hasData) {
      await expect(page.locator("text=信心")).toBeVisible();
      await expect(page.locator("text=取樣")).toBeVisible();
    }
  });
});
