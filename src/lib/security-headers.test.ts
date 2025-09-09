import { describe, it, expect } from "vitest";
import { buildSecurityHeaders } from "./security-headers";

function get(headers: { key: string; value: string }[], key: string) {
  return (
    headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value || ""
  );
}

function has(headers: { key: string; value: string }[], key: string) {
  return headers.some((h) => h.key.toLowerCase() === key.toLowerCase());
}

describe("buildSecurityHeaders (CSP minimale)", () => {
  it("inclut les directives essentielles en dev", () => {
    const hs = buildSecurityHeaders({ env: "development" });
    const csp = get(hs, "Content-Security-Policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("img-src 'self' data: https:");
    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    );
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https:");
    expect(csp).toContain("connect-src 'self' https:");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(get(hs, "X-Content-Type-Options")).toBe("nosniff");
    expect(get(hs, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(get(hs, "Permissions-Policy")).toContain("camera=()");
    expect(get(hs, "X-Frame-Options")).toBe("DENY");
    expect(has(hs, "Strict-Transport-Security")).toBe(false);
  });
  it("ajoute HSTS en production", () => {
    const hs = buildSecurityHeaders({ env: "production" });
    expect(has(hs, "Strict-Transport-Security")).toBe(true);
  });
});
