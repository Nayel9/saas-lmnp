import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  cleanup();
});

// Mocks
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
  signOut: () => Promise.resolve(),
}));

// next/image mock: supprimer les props non valides pour <img>, comme priority
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const rest: Record<string, unknown> = { ...props };
    delete (rest as { priority?: boolean }).priority;
    return React.createElement("img", rest as React.ImgHTMLAttributes<HTMLImageElement>);
  },
}));

import DesktopNav from "../DesktopNav";

describe("DesktopNav", () => {
  it("affiche le lien Connexion quand non connecté", () => {
    render(<DesktopNav />);

    expect(screen.getByTestId("desktop-nav")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /se connecter/i })).toBeInTheDocument();
  });

  it("affiche le menu compte avec les initiales quand connecté", async () => {
    vi.resetModules();
    vi.doMock("next-auth/react", () => ({
      useSession: () => ({ data: { user: { id: "u1", name: "Jean Dupont", email: "jean@example.com", plan: "pro" } } }),
      signOut: () => Promise.resolve(),
    }));

    vi.doMock("next/navigation", () => ({
      usePathname: () => "/settings/accounts",
    }));

    const DesktopNavAuth = (await import("../DesktopNav")).default;

    render(<DesktopNavAuth />);

    expect(screen.getByTestId("desktop-nav")).toBeInTheDocument();
    const button = screen.getByTestId("account-menu-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("JD");

    // cible uniquement le lien Paramètres (pas le summary)
    const settingsLink = screen.getByRole("link", { name: /param/i });
    expect(settingsLink).toBeInTheDocument();
  });
});
