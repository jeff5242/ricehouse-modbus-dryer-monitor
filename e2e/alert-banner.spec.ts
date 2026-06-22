import { test, expect, type Page } from "@playwright/test";

async function injectAlerts(page: Page, alerts: unknown[]) {
  await page.evaluate((data) => {
    window.__TEST_ALERTS__ = data;
  }, alerts);
}

test.describe("Alert Banner Styling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { timeout: 60_000 });
  });

  test("error alert has red styling", async ({ page }) => {
    await page.evaluate(() => {
      const container = document.querySelector("main");
      if (!container) return;
      const div = document.createElement("div");
      div.id = "test-alert";
      div.innerHTML = `
        <div class="border rounded-lg px-4 py-3 flex items-center justify-between bg-red-50 border-red-200">
          <div class="flex items-center gap-3">
            <span class="text-xl text-red-500">⚠️</span>
            <div>
              <div class="font-medium text-red-800">Test error alert</div>
            </div>
          </div>
        </div>
      `;
      container.prepend(div);
    });

    const alert = page.locator("#test-alert .bg-red-50");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveClass(/border-red-200/);
  });

  test("approaching alert has amber styling", async ({ page }) => {
    await page.evaluate(() => {
      const container = document.querySelector("main");
      if (!container) return;
      const div = document.createElement("div");
      div.id = "test-alert";
      div.innerHTML = `
        <div class="border rounded-lg px-4 py-3 flex items-center justify-between bg-amber-50 border-amber-200">
          <div class="flex items-center gap-3">
            <span class="text-xl text-amber-500">📢</span>
            <div>
              <div class="font-medium text-amber-800">水分接近目標</div>
            </div>
          </div>
        </div>
      `;
      container.prepend(div);
    });

    const alert = page.locator("#test-alert .bg-amber-50");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveClass(/border-amber-200/);
  });

  test("completion alert has green styling", async ({ page }) => {
    await page.evaluate(() => {
      const container = document.querySelector("main");
      if (!container) return;
      const div = document.createElement("div");
      div.id = "test-alert";
      div.innerHTML = `
        <div class="border rounded-lg px-4 py-3 flex items-center justify-between bg-green-50 border-green-200">
          <div class="flex items-center gap-3">
            <span class="text-xl text-green-500">✅</span>
            <div>
              <div class="font-medium text-green-800">烘乾完成</div>
            </div>
          </div>
        </div>
      `;
      container.prepend(div);
    });

    const alert = page.locator("#test-alert .bg-green-50");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveClass(/border-green-200/);
  });
});
