import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/journal/ventes",
}));

const authMock = {
  useSession: () => ({
    data: { user: { id: "u1", email: "u@test", plan: "pro" } },
    status: "authenticated",
  }),
  signOut: vi.fn(),
};

vi.mock("next-auth/react", () => authMock);

describe("MobileNav", () => {
  it("ouvre le drawer et marque Ventes actif", async () => {
    const { MobileNav } = await import("./MobileNav");
    render(<MobileNav />);
    const btn = screen.getByRole("button", { name: /ouvrir le menu/i });
    fireEvent.click(btn);
    const nav = await screen.findByRole("navigation", { name: /navigation principale/i });
    expect(nav).toBeInTheDocument();
    const ventes = screen.getByRole("link", { name: /ventes/i });
    expect(ventes).toHaveAttribute("aria-current", "page");
  });

  it("affiche le groupe Compte si non authentifié", async () => {
    vi.doMock("next-auth/react", () => ({
      useSession: () => ({ data: null, status: "unauthenticated" }),
      signOut: vi.fn(),
    }));
    const { MobileNav } = await import("./MobileNav");
    render(<MobileNav />);
    fireEvent.click(screen.getByRole("button", { name: /ouvrir le menu/i }));
    const matches = await screen.findAllByText(/compte/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
