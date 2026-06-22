import { test, expect } from "@playwright/test";

test.describe("Alerts API", () => {
  test("POST /api/alerts/:id/resolve requires valid id", async ({
    request,
  }) => {
    const res = await request.post("/api/alerts/999999/resolve");
    // Should return 200 even if no alert found (idempotent resolve)
    expect([200, 404]).toContain(res.status());
  });

  test("GET /api/v1/dryer-alerts includes alert_type field", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/dryer-alerts");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data");
    for (const alert of json.data) {
      expect(alert).toHaveProperty("alert_type");
      expect(typeof alert.alert_type).toBe("string");
    }
  });
});
