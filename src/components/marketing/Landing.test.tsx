import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Landing } from "./Landing";

describe("Landing (agrégée)", () => {
  it("rend les sections principales", () => {
    const html = renderToString(<Landing authenticated={false} />);
    expect(html).toContain("La compta LMNP"); // Hero
    expect(html).toContain("Pourquoi choisir LMNP App"); // Features
    expect(html).toContain("Comment ça marche"); // Steps
    expect(html).toContain("Tarifs transparents"); // Pricing
    expect(html).toContain("Ils en parlent"); // Testimonials
    expect(html).toContain("FAQ"); // FAQ
  });
});
