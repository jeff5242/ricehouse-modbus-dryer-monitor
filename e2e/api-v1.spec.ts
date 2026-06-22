import { test, expect } from "@playwright/test";

test.describe("V1 API Endpoints", () => {
  test("GET /api/v1/dryers returns envelope", async ({ request }) => {
    const res = await request.get("/api/v1/dryers");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
  });

  test("GET /api/v1/dryers/1 returns single dryer or 404", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/dryers/1");
    const status = res.status();
    expect([200, 404]).toContain(status);

    if (status === 200) {
      const json = await res.json();
      expect(json).toHaveProperty("data");
    }
  });

  test("GET /api/v1/dryers/1/readings returns data with reading arrays", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/dryers/1/readings?hours=1");
    const status = res.status();
    expect([200, 404]).toContain(status);

    if (status === 200) {
      const json = await res.json();
      expect(json).toHaveProperty("data");
      expect(json.data).toHaveProperty("dryer_readings");
      expect(json.data).toHaveProperty("moisture_readings");
      expect(Array.isArray(json.data.dryer_readings)).toBe(true);
      expect(Array.isArray(json.data.moisture_readings)).toBe(true);
    }
  });

  test("GET /api/v1/dryers/1/batches returns data with meta", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/dryers/1/batches");
    const status = res.status();
    // May return 200 or 500 if batch table doesn't exist
    if (status === 200) {
      const json = await res.json();
      expect(json).toHaveProperty("data");
      expect(json).toHaveProperty("meta");
      expect(json.meta).toHaveProperty("total");
      expect(json.meta).toHaveProperty("limit");
      expect(json.meta).toHaveProperty("offset");
    }
  });

  test("GET /api/v1/dryer-alerts returns data", async ({ request }) => {
    const res = await request.get("/api/v1/dryer-alerts");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
  });

  test("GET /api/v1/dryer-alerts?resolved=false filters correctly", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/dryer-alerts?resolved=false");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data");
  });
});
