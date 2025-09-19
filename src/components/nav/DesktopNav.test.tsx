import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/journal/ventes",
}));

describe("DesktopNav", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.resetModules();
  });

  it("rend la nav principale avec aria-label", async () => {
    vi.doMock("next-auth/react", () => ({
      useSession: () => ({
        data: { user: { id: "u1", email: "u@test", plan: "pro", name: "Test User" } },
        status: "authenticated",
      }),
      signOut: vi.fn(),
    }));
    const { DesktopNav } = await import("./DesktopNav");
    render(<DesktopNav />);
    const nav = screen.getByRole("navigation", { name: /navigation principale/i });
    expect(nav).toBeInTheDocument();
  });

  it("marque Ventes comme actif via aria-current=page", async () => {
    vi.doMock("next-auth/react", () => ({
      useSession: () => ({
        data: { user: { id: "u1", email: "u@test", plan: "pro", name: "Test User" } },
        status: "authenticated",
      }),
      signOut: vi.fn(),
    }));
    const { DesktopNav } = await import("./DesktopNav");
    render(<DesktopNav />);
    const ventes = screen.getByRole("link", { name: /ventes/i });
    expect(ventes).toHaveAttribute("aria-current", "page");
  });

  it("désactive un lien nécessitant pro quand plan=free", async () => {
    vi.doMock("next-auth/react", () => ({
      useSession: () => ({ data: { user: { id: "u1", email: "u@test", plan: "free" } }, status: "authenticated" }),
      signOut: vi.fn(),
    }));
    const { DesktopNav } = await import("./DesktopNav");
    render(<DesktopNav />);
    const imm = screen.getByText(/immobilisations/i);
    expect(imm).toHaveAttribute("aria-disabled");
  });
});
