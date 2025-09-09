import { test, expect } from "@playwright/test";

test.describe("Sécurité Auth + Headers", () => {
  test("redirect sûr: callbackUrl externe retombe sur baseUrl", async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, "BaseURL requise");
    const external = "https://evil.example.com/phish";
    // Utilise signout qui passe par le callback redirect sans nécessiter d’OAuth réel
    await page.goto(
      `/api/auth/signout?callbackUrl=${encodeURIComponent(external)}`,
    );
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    // Doit être revenu sur baseUrl (ou page /login selon config), jamais sur l’externe
    expect(url.startsWith(baseURL!)).toBeTruthy();
    expect(url.startsWith(external)).toBeFalsy();
  });

  test("en-têtes de sécurité présents", async ({ request }) => {
    const resp = await request.get("/login");
    expect(resp.ok()).toBeTruthy();
    const headers = resp.headers();
    // Clés en minuscules dans Playwright
    expect(headers["content-security-policy"]).toBeTruthy();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["x-frame-options"]).toBe("DENY");
  });
});
