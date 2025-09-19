import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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

// Mock Sheet pour éviter les portals/animations en test
vi.mock("@/components/ui/sheet", () => {
  const Pass: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => (
    <>{children}</>
  );
  const Box: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => (
    <div>{children}</div>
  );
  return {
    __esModule: true,
    Sheet: Box,
    SheetContent: Box,
    SheetTrigger: Pass,
    SheetClose: Pass,
    SheetTitle: Pass,
    SheetDescription: Pass,
  };
});

afterEach(() => {
  cleanup();
});

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
