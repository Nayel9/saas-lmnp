import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireSession, requirePropertyAccess, withAuth, withPropertyScope } from "./guards";
import { UnauthorizedError, ForbiddenError } from "./errors";

// ---- Mocks ----
vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { property: { findUnique: vi.fn() } } }));

const { auth } = await import("@/lib/auth/core");
const { prisma } = await import("@/lib/prisma");

const USER = { id: "user-1", email: "u@test" } as const;
const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";

describe("guards", () => {
  it("requireSession retourne user si authentifié", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: USER });
    const { user } = await requireSession();
    expect(user.id).toBe(USER.id);
  });
  it("requireSession lève UnauthorizedError si pas de session", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(() => requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("requirePropertyAccess autorise owner", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: USER });
    (prisma.property.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: P1, user_id: USER.id });
    const { propertyId } = await requirePropertyAccess(P1);
    expect(propertyId).toBe(P1);
  });
  it("requirePropertyAccess refuse propriété autre user", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: USER });
    (prisma.property.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: P2, user_id: "other" });
    await expect(() => requirePropertyAccess(P2)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("withAuth renvoie 401 sans session", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const handler = withAuth(async () => new Response("ok"));
    const res = await handler(new NextRequest("http://test/api/x"));
    expect(res.status).toBe(401);
  });
  it("withAuth passe user", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: USER });
    const handler = withAuth(async ({ user }) => new Response(user.id));
    const res = await handler(new NextRequest("http://test/api/x"));
    expect(await res.text()).toBe(USER.id);
  });
  it("withPropertyScope détecte manque property -> 400", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: USER });
    const handler = withPropertyScope(async () => new Response("ok"));
    const res = await handler(new NextRequest("http://test/api/x"));
    expect(res.status).toBe(400);
  });
  it("withPropertyScope 403 si propriété étrangère", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: USER });
    (prisma.property.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: P2, user_id: "other" });
    const handler = withPropertyScope(async () => new Response("ok"));
    const res = await handler(new NextRequest(`http://test/api/x?property=${P2}`));
    expect(res.status).toBe(403);
  });
  it("withPropertyScope 200 si owner", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: USER });
    (prisma.property.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: P1, user_id: USER.id });
    const handler = withPropertyScope(async ({ propertyId }) => new Response(propertyId));
    const res = await handler(new NextRequest(`http://test/api/x?property=${P1}`));
    expect(await res.text()).toBe(P1);
  });
});

