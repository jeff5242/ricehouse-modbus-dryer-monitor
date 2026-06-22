import { test, expect } from "@playwright/test";

test.describe("CGI-Compatible API", () => {
  test("GET /cgi-bin/status.cgi?action=getstatus returns plain text", async ({
    request,
  }) => {
    const res = await request.get(
      "/cgi-bin/status.cgi?action=getstatus&end=end"
    );
    expect(res.status()).toBe(200);
    const contentType = res.headers()["content-type"];
    expect(contentType).toContain("text/plain");
  });

  test("response lines follow {no}:{key}={value} format", async ({
    request,
  }) => {
    const res = await request.get("/cgi-bin/status.cgi?action=getstatus");
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim().length > 0);

    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const parts = line.split(/[:|=]/).filter(Boolean);
      expect(parts.length).toBeGreaterThanOrEqual(2);

      const no = parts[0];
      expect(Number.isFinite(parseInt(no))).toBe(true);
    }
  });

  test("response includes expected keys matching old DB schema", async ({
    request,
  }) => {
    const res = await request.get("/cgi-bin/status.cgi?action=getstatus");
    const text = await res.text();

    const expectedKeys = [
      "Model",
      "Power",
      "Stat",
      "TempSet",
      "Temp",
      "SetTime",
      "ShowTime",
      "Err",
      "Stat2_0",
      "Stat2_1",
      "Stat2_2",
      "Stat2_3",
      "Stat2_4",
      "Stat2_5",
      "Stat2_6",
      "Stat2_7",
      "MoistureErr",
      "Moisture",
      "MoistureSet",
      "MoistureSetTiny",
      "CerealsType",
      "CerealsTemp",
    ];

    for (const key of expectedKeys) {
      expect(text).toContain(`:${key}=`);
    }
  });

  test("PHP-compatible parsing produces correct structure", async ({
    request,
  }) => {
    const res = await request.get("/cgi-bin/status.cgi?action=getstatus");
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim().length > 0);

    const curVal: Record<string, Record<string, string>> = {};

    for (const rec of lines) {
      const trimmed = rec.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(/:|=/);
      if (parts.length < 3) continue;
      const [no, key, ...rest] = parts;
      const val = rest.join("=");

      if (isNaN(parseInt(no)) || !key) continue;

      if (!curVal[no]) curVal[no] = {};
      curVal[no][key] = val;
    }

    const deviceIds = Object.keys(curVal);
    expect(deviceIds.length).toBeGreaterThan(0);

    for (const id of deviceIds) {
      expect(curVal[id]).toHaveProperty("Power");
      expect(curVal[id]).toHaveProperty("Stat");
      expect(curVal[id]).toHaveProperty("Temp");
      expect(curVal[id]).toHaveProperty("Moisture");
      expect(curVal[id]).toHaveProperty("Stat2_6");

      expect(["ON", "OFF"]).toContain(curVal[id]["Power"]);

      const setTime = curVal[id]["SetTime"];
      expect(setTime).toMatch(/^\d{2}:\d{2}$/);

      const showTime = curVal[id]["ShowTime"];
      expect(showTime).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  test("unknown action returns 400", async ({ request }) => {
    const res = await request.get("/cgi-bin/status.cgi?action=unknown");
    expect(res.status()).toBe(400);
  });

  test("CORS headers are present", async ({ request }) => {
    const res = await request.get("/cgi-bin/status.cgi?action=getstatus");
    expect(res.headers()["access-control-allow-origin"]).toBe("*");
  });
});
