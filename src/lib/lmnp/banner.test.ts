import { describe, it, expect } from "vitest";
import { shouldShowLmnpBanner, ackKey } from "./banner";

describe("LMNP banner utils", () => {
  it("shouldShowLmnpBanner retourne true quand amort > (revenus - depenses)", () => {
    expect(
      shouldShowLmnpBanner({ revenues: 1000, expenses: 300, amort: 800 }),
    ).toBe(true); // 800 > 700
    expect(
      shouldShowLmnpBanner({ revenues: 1000, expenses: 300, amort: 700 }),
    ).toBe(false);
    expect(shouldShowLmnpBanner({ revenues: 0, expenses: 0, amort: 1 })).toBe(
      true,
    );
  });

  it("ackKey construit une clé par (property, year)", () => {
    const key = ackKey("prop-1", 2025);
    expect(key).toBe("lmnp_banner_ack:prop-1:2025");
  });

  it("persistance localStorage: set/get sur la clé", () => {
    const key = ackKey("p", 2025);
    window.localStorage.removeItem(key);
    expect(window.localStorage.getItem(key)).toBeNull();
    window.localStorage.setItem(key, "1");
    expect(window.localStorage.getItem(key)).toBe("1");
  });
});
