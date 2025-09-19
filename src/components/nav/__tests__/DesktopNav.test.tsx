import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

// Mocks
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
  signOut: () => Promise.resolve(),
}));

// next/image peut être problématique en test, on le mocke par un simple wrapper
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return React.createElement("img", props);
  },
}));

import DesktopNav from "../DesktopNav";

describe("DesktopNav", () => {
  it("affiche le lien Connexion quand non connecté", () => {
    render(<DesktopNav />);

    expect(screen.getByTestId("desktop-nav")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /connexion/i })).toBeInTheDocument();
  });

  it("affiche le menu compte avec les initiales quand connecté", async () => {
    // Remocker useSession pour simuler un utilisateur
    vi.mocked = (vi as any).mocked ?? vi;
    vi.unstub && vi.unstub();

    // remock localement
    vi.doMock("next-auth/react", () => ({
      useSession: () => ({ data: { user: { id: "u1", name: "Jean Dupont", email: "jean@example.com", plan: "pro" } } }),
      signOut: () => Promise.resolve(),
    }));

    // Remock pathname pour settings
    vi.doMock("next/navigation", () => ({
      usePathname: () => "/settings/accounts",
    }));

    // Re-require le composant pour prendre en compte les mocks dynamiques
    const DesktopNavAuth = (await import("../DesktopNav")).default;

    render(<DesktopNavAuth />);

    expect(screen.getByTestId("desktop-nav")).toBeInTheDocument();
    const button = screen.getByTestId("account-menu-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("JD");

    // Le lien paramètres (settings) doit être présent
    expect(screen.getByText(/paramètres/i)).toBeInTheDocument();
  });
});

