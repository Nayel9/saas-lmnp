import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

vi.mock("@/lib/auth/core", () => ({ auth: vi.fn() }));
const { auth } = await import("@/lib/auth/core");

function makeReq(url: string) {
  return new NextRequest(url);
}

describe("middleware auth guards", () => {
  beforeEach(() => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("redirige /dashboard vers /login avec next quand non authentifié", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await middleware(makeReq("http://localhost/dashboard"));
    expect(res?.status).toBe(302);
    const loc = res?.headers.get("location") ?? "";
    expect(loc).toMatch(/\/login\?next=%2Fdashboard/);
  });

  it("retourne 401 JSON sur API protégée si non authentifié", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await middleware(makeReq("http://localhost/api/secure-endpoint"));
    expect(res?.status).toBe(401);
    expect(res?.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("redirige /login vers /dashboard si déjà authentifié", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "u1" } });
    const res = await middleware(makeReq("http://localhost/login"));
    expect(res?.status).toBe(302);
    const loc = res?.headers.get("location") ?? "";
    expect(loc.endsWith("/dashboard")).toBe(true);
  });
});

