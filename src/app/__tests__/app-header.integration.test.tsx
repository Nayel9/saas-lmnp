import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("AppHeader intégration", () => {
  it("rend la navbar quand authentifié", async () => {
    vi.resetModules();
    vi.doMock("next-auth/react", () => ({
      useSession: () => ({ data: { user: { id: "u1", email: "u@test", plan: "pro" } }, status: "authenticated" }),
      signOut: vi.fn(),
    }));
    const { default: AppHeader } = await import("@/components/nav/AppHeader");
    render(<AppHeader />);
    const navs = screen.getAllByRole("navigation", { name: /navigation principale/i });
    expect(navs.length).toBeGreaterThan(0);
  }, 20000);

  it("ne crashe pas quand non authentifié avec ProtectedRoute", async () => {
    vi.resetModules();
    vi.doMock("next-auth/react", () => ({
      useSession: () => ({ data: null, status: "unauthenticated" }),
      signOut: vi.fn(),
    }));
    const { default: AppHeader } = await import("@/components/nav/AppHeader");
    const { ProtectedRoute } = await import("@/components/ProtectedRoute");

    render(
      <div>
        <AppHeader />
        <ProtectedRoute>
          <div>Contenu</div>
        </ProtectedRoute>
      </div>,
    );
    const navs = screen.getAllByRole("navigation", { name: /navigation principale/i });
    expect(navs.length).toBeGreaterThan(0);
    expect(screen.queryByText("Contenu")).not.toBeInTheDocument();
  }, 20000);

  it("logo présent pour utilisateurs non auth", async () => {
    vi.resetModules();
    vi.doMock("next-auth/react", () => ({
      useSession: () => ({ data: null, status: "unauthenticated" }),
      signOut: vi.fn(),
    }));
    const { default: AppHeader } = await import("@/components/nav/AppHeader");

    render(
      <div>
        <AppHeader />
      </div>,
    );
    const logos = screen.getAllByRole("img", { name: /lmnp app/i });
    expect(logos.length).toBeGreaterThan(0);
  }, 20000);
});
