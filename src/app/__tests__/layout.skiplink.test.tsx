import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/components/nav/AppHeader", () => ({ __esModule: true, default: () => null }));
vi.mock("./../providers", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

describe("RootLayout - skip link", () => {
  it("contient un lien 'Aller au contenu'", async () => {
    const { default: RootLayout } = await import("../layout");
    render(<RootLayout>{<div id="main">Main</div>}</RootLayout> as unknown as React.ReactElement);
    expect(screen.getByRole("link", { name: /aller au contenu/i })).toBeInTheDocument();
  });
});
