import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import LoginPageClient from "./LoginPageClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "unauthenticated", data: null }),
}));

describe("LoginPage UI (NextAuth)", () => {
  it("rend les modes et champs essentiels", () => {
    const html = renderToString(<LoginPageClient />);
    expect(html).toContain("Se connecter");
    expect(html).toContain("Créer un compte");
    expect(html).toContain("Email");
    expect(html).toMatch(/type="password"/);
    expect(html).toMatch(/aria-live="polite"/);
  });
});
