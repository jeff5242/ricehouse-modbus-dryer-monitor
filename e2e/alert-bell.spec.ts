import { test, expect } from "@playwright/test";

const PHONE_WIDTH = 390;

test.describe("Alert bell dropdown", () => {
  test.use({ viewport: { width: PHONE_WIDTH, height: 844 } });

  test("dropdown stays inside the viewport on a phone-width screen", async ({ page }) => {
    // Arrange
    await page.goto("/", { timeout: 60_000 });
    const bell = page.getByLabel("通知", { exact: true });

    // Act
    await bell.click();
    const panel = bell.locator("xpath=following-sibling::div");
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();

    // Assert
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE_WIDTH);
  });
});
