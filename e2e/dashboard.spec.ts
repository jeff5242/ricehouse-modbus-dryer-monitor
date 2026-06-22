import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads and shows header", async ({ page }) => {
    await page.goto("/", { timeout: 60_000 });
    await expect(page.locator("h1")).toHaveText("大橋米烘乾監控");
  });

  test("shows online and drying counts in header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=台連線")).toBeVisible();
    await expect(page.locator("text=台乾燥中")).toBeVisible();
  });

  test("renders device rows", async ({ page }) => {
    await page.goto("/");
    const rows = page.locator(".rounded-lg.border-2");
    await expect(rows.first()).toBeVisible();
  });

  test("has manual poll button", async ({ page }) => {
    await page.goto("/");
    const btn = page.getByRole("button", { name: "更新" });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("trend button opens chart overlay", async ({ page }) => {
    await page.goto("/");
    const trendBtn = page.locator("button", { hasText: "趨勢" }).first();
    await trendBtn.click();
    await page.waitForSelector("text=載入中...", { state: "hidden", timeout: 15_000 }).catch(() => {});
    await expect(
      page.locator("h3", { hasText: "溫度曲線" })
    ).toBeVisible({ timeout: 10_000 });
  });
});
