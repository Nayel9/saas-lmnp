import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  generatePasswordResetToken,
  forgotPasswordSchema,
  resetPasswordSchema,
  PASSWORD_RESET_TOKEN_TTL_MS,
  findValidPasswordResetToken,
  getPlainPasswordResetToken,
} from "./passwordReset";
import { POST as forgotPOST } from "@/app/api/auth/forgot-password/route";
import { POST as resetPOST } from "@/app/api/auth/reset-password/route";

// -------------------- Mocks Prisma --------------------
vi.mock("@/lib/prisma", () => {
  interface MockUser { id: string; email: string; password?: string | null; }
  interface MockPasswordResetToken { id: string; userId: string; token: string; expiresAt: Date; createdAt: Date; }
  const users: MockUser[] = [];
  const prTokens: MockPasswordResetToken[] = [];

  interface FindUniqueArgs { where: { email?: string; id?: string } }
  interface UpdateArgs { where: { id: string }; data: Partial<MockUser> }
  interface DeleteManyArgs { where: { userId: string } }
  interface CreateTokenArgs { data: { userId: string; token: string; expiresAt: Date } }
  interface FindManyTokenArgs { where: { expiresAt: { gt: Date } } }
  interface FindUniqueTokenArgs { where: { id: string } }

  const user = {
    findUnique: ({ where }: FindUniqueArgs): Promise<MockUser | null> => {
      const { email, id } = where;
      if (email) return Promise.resolve(users.find(u => u.email === email) || null);
      if (id) return Promise.resolve(users.find(u => u.id === id) || null);
      return Promise.resolve(null);
    },
    update: ({ where, data }: UpdateArgs): Promise<MockUser> => {
      const u = users.find(u => u.id === where.id);
      if (!u) throw new Error("not found");
      Object.assign(u, data);
      return Promise.resolve(u);
    },
  };
  const passwordResetToken = {
    deleteMany: ({ where }: DeleteManyArgs): Promise<{ count: number }> => {
      const before = prTokens.length;
      for (let i = prTokens.length - 1; i >= 0; i--) if (prTokens[i].userId === where.userId) prTokens.splice(i,1);
      return Promise.resolve({ count: before - prTokens.length });
    },
    create: ({ data }: CreateTokenArgs): Promise<MockPasswordResetToken> => {
      const rec: MockPasswordResetToken = { id: `prt_${prTokens.length}`, createdAt: new Date(), ...data } as MockPasswordResetToken;
      prTokens.push(rec);
      return Promise.resolve(rec);
    },
    findMany: ({ where }: FindManyTokenArgs): Promise<MockPasswordResetToken[]> => {
      return Promise.resolve(prTokens.filter(t => t.expiresAt > where.expiresAt.gt));
    },
    findUnique: ({ where }: FindUniqueTokenArgs): Promise<MockPasswordResetToken | null> => {
      return Promise.resolve(prTokens.find(t => t.id === where.id) || null);
    },
  };
  return { prisma: { user, passwordResetToken, __stores: { users, prTokens } } };
});

// -------------------- Mock bcrypt (deterministic) --------------------
vi.mock("bcryptjs", () => ({
  default: {
    hash: (pw: string) => Promise.resolve("hashed:" + pw),
    hashSync: (pw: string) => "hashed:" + pw,
    compare: (pw: string, hash: string) => Promise.resolve(hash === "hashed:" + pw),
    genSaltSync: () => "salt",
  },
  hash: (pw: string) => Promise.resolve("hashed:" + pw),
  hashSync: (pw: string) => "hashed:" + pw,
  compare: (pw: string, hash: string) => Promise.resolve(hash === "hashed:" + pw),
  genSaltSync: () => "salt",
}));

import { prisma } from "@/lib/prisma";

function makeRequest(url: string, body: unknown) {
  return new NextRequest(url, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.9" } });
}

// Helpers d'accès storage mock
interface MockStores { __stores: { users: { id: string; email: string; password?: string | null }[]; prTokens: { id: string; userId: string; token: string; expiresAt: Date; createdAt: Date }[] } }

// -------------------- Unit tests --------------------

describe("Password reset utils", () => {
  beforeEach(() => {
    const stores = (prisma as unknown as MockStores).__stores;
    stores.users.length = 0;
    stores.prTokens.length = 0;
  });

  it("generatePasswordResetToken produit hash et expiration ~30min", () => {
    const { token, hash, expiresAt } = generatePasswordResetToken();
    expect(token).toBeTruthy();
    expect(hash).toBe("hashed:" + token); // via mock
    const diff = expiresAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan(PASSWORD_RESET_TOKEN_TTL_MS - 5000);
    expect(diff).toBeLessThan(PASSWORD_RESET_TOKEN_TTL_MS + 5000);
  });

  it("validation forgotPasswordSchema ok / ko", () => {
    expect(() => forgotPasswordSchema.parse({ email: "test@example.com" })).not.toThrow();
    expect(() => forgotPasswordSchema.parse({ email: "bad" })).toThrow();
  });

  it("validation resetPasswordSchema", () => {
    expect(() => resetPasswordSchema.parse({ token: "abc", password: "12345678" })).not.toThrow();
    expect(() => resetPasswordSchema.parse({ token: "", password: "short" })).toThrow();
  });

  it("findValidPasswordResetToken ignore expiré", async () => {
    const stores = (prisma as unknown as MockStores).__stores;
    stores.prTokens.push({ id: "prt1", userId: "u1", token: "hashed:tok", createdAt: new Date(Date.now()-40000), expiresAt: new Date(Date.now()-1000) });
    const res = await findValidPasswordResetToken("tok");
    expect(res).toBeNull();
  });
});

// -------------------- Integration tests --------------------

describe("Password reset flow", () => {
  beforeEach(() => {
    const stores = (prisma as unknown as MockStores).__stores;
    stores.users.length = 0;
    stores.prTokens.length = 0;
  });

  it("/forgot-password génère un token (si user credentials)", async () => {
    const stores = (prisma as unknown as MockStores).__stores;
    stores.users.push({ id: "u10", email: "flow@test.local", password: "hashed:old" });
    const r = await forgotPOST(makeRequest("http://localhost/api/auth/forgot-password", { email: "flow@test.local" }));
    expect(r.status).toBe(200);
    expect(stores.prTokens.length).toBe(1);
    const plain = getPlainPasswordResetToken("u10");
    expect(plain).toBeTruthy();
    // hash correspond (mock compare implicit in route creation); ici test direct
    expect(stores.prTokens[0].token).toBe("hashed:" + plain);
  });

  it("/reset-password met à jour le mot de passe et invalide token", async () => {
    const stores = (prisma as unknown as MockStores).__stores;
    stores.users.push({ id: "u11", email: "reset@test.local", password: "hashed:old" });
    // Préparation via route forgot
    await forgotPOST(makeRequest("http://localhost/api/auth/forgot-password", { email: "reset@test.local" }));
    const plain = getPlainPasswordResetToken("u11")!;
    const r1 = await resetPOST(makeRequest("http://localhost/api/auth/reset-password", { token: plain, password: "nouveaumdp" }));
    expect(r1.status).toBe(200);
    const user = stores.users.find(u => u.id === "u11");
    expect(user?.password).toBe("hashed:nouveaumdp");
    expect(stores.prTokens.length).toBe(0);
    // tentative réutilisation
    const r2 = await resetPOST(makeRequest("http://localhost/api/auth/reset-password", { token: plain, password: "x12345678" }));
    expect(r2.status).toBe(400);
  });

  it("/reset-password refuse token expiré", async () => {
    const stores = (prisma as unknown as MockStores).__stores;
    stores.users.push({ id: "u12", email: "exp@test.local", password: "hashed:old" });
    // Insertion manuelle d'un token expiré
    stores.prTokens.push({ id: "prtE", userId: "u12", token: "hashed:tokexp", createdAt: new Date(), expiresAt: new Date(Date.now() - 1000) });
    const r = await resetPOST(makeRequest("http://localhost/api/auth/reset-password", { token: "tokexp", password: "abcdefgh" }));
    expect(r.status).toBe(400);
  });

  it("/reset-password accepte le format composite id.token", async () => {
    const stores = (prisma as unknown as MockStores).__stores;
    stores.users.push({ id: "u13", email: "comp@test.local", password: "hashed:old" });
    await forgotPOST(makeRequest("http://localhost/api/auth/forgot-password", { email: "comp@test.local" }));
    const plain = getPlainPasswordResetToken("u13")!; // plain token stocké coté dev/test
    // Récupérer l'id du token créé
    const created = stores.prTokens.find(t => t.userId === "u13")!;
    const composite = `${created.id}.${plain}`;
    const r = await resetPOST(makeRequest("http://localhost/api/auth/reset-password", { token: composite, password: "abcdefgh" }));
    expect(r.status).toBe(200);
    const user = stores.users.find(u => u.id === "u13");
    expect(user?.password).toBe("hashed:abcdefgh");
  });
});
