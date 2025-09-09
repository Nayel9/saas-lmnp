import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
interface MockStores {
  __stores: {
    users: {
      id: string;
      email: string;
      password?: string;
      role?: string;
      emailVerified?: Date | null;
    }[];
    vTokens: { identifier: string; token: string; expires: Date }[];
  };
}
import { generateVerificationToken, hashToken } from "@/lib/mailer/brevo";
import { requireVerifiedCredentials } from "./options";
import { GET as verifyGET } from "@/app/auth/verify/route";
import { POST as resendPOST } from "@/app/api/auth/resend-verification/route";
import { NextRequest } from "next/server";

// Mock prisma
vi.mock("@/lib/prisma", () => {
  interface MockUser {
    id: string;
    email: string;
    password?: string;
    role?: string;
    emailVerified?: Date | null;
  }
  interface MockVerificationToken {
    identifier: string;
    token: string;
    expires: Date;
  }
  const users: MockUser[] = [];
  const vTokens: MockVerificationToken[] = [];
  function findUnique({
    where: { email },
  }: {
    where: { email: string };
  }): Promise<MockUser | null> {
    return Promise.resolve(users.find((u) => u.email === email) || null);
  }
  function update({
    where: { email },
    data,
  }: {
    where: { email: string };
    data: Partial<MockUser>;
  }): Promise<MockUser> {
    const u = users.find((x) => x.email === email);
    if (!u) throw new Error("not found");
    Object.assign(u, data);
    return Promise.resolve(u);
  }
  const verificationToken = {
    findFirst: ({
      where: { identifier, token },
    }: {
      where: { identifier: string; token: string };
    }) =>
      Promise.resolve(
        vTokens.find((v) => v.identifier === identifier && v.token === token) ||
          null,
      ),
    deleteMany: ({
      where: { identifier },
    }: {
      where: { identifier: string };
    }) => {
      const before = vTokens.length;
      for (let i = vTokens.length - 1; i >= 0; i--)
        if (vTokens[i].identifier === identifier) vTokens.splice(i, 1);
      return Promise.resolve({ count: before - vTokens.length });
    },
    create: ({ data }: { data: MockVerificationToken }) => {
      vTokens.push(data);
      return Promise.resolve(data);
    },
  };
  return {
    prisma: {
      user: { findUnique, update },
      verificationToken,
      __stores: { users, vTokens },
    },
  };
});
vi.mock("bcryptjs", () => ({
  default: {
    compare: (pw: string, hash: string) => Promise.resolve(pw === hash),
  },
  compare: (pw: string, hash: string) => Promise.resolve(pw === hash),
}));

import { prisma } from "@/lib/prisma";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "1.2.3.4",
    },
  });
}
function makeGet(url: string) {
  return new NextRequest(url);
}

const email = `email-verify-${Date.now()}@test.local`;

describe("Email verification helpers", () => {
  beforeEach(() => {
    const stores = (prisma as unknown as MockStores).__stores;
    stores.users.length = 0;
    stores.vTokens.length = 0;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generateVerificationToken retourne token+hash cohérents et expiration >23h", () => {
    const { token, hash, expires } = generateVerificationToken();
    expect(token).toBeTruthy();
    expect(hash).toBe(hashToken(token));
    const diffH = (expires.getTime() - Date.now()) / 3600000;
    expect(diffH).toBeGreaterThan(23.5);
    expect(diffH).toBeLessThan(24.5);
  });

  it("requireVerifiedCredentials retourne EMAIL_NOT_VERIFIED si emailVerified null", async () => {
    const stores = (prisma as unknown as MockStores).__stores;
    stores.users.push({
      id: "u1",
      email,
      password: "Passw0rd!",
      role: "user",
      emailVerified: null,
    });
    const res = await requireVerifiedCredentials(email, "Passw0rd!");
    expect(res).toBe("EMAIL_NOT_VERIFIED");
  });

  it("requireVerifiedCredentials retourne user si vérifié", async () => {
    const stores = (prisma as unknown as MockStores).__stores;
    stores.users.push({
      id: "u2",
      email: "ok@test.local",
      password: "Passw0rd!",
      role: "user",
      emailVerified: new Date(),
    });
    const res = await requireVerifiedCredentials("ok@test.local", "Passw0rd!");
    expect(res && typeof res === "object" && "email" in res).toBe(true);
  });

  it("resend-verification crée un token puis rate-limit empêche second", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    const stores = (prisma as unknown as MockStores).__stores;
    stores.users.push({
      id: "u3",
      email: "rl@test.local",
      password: "Passw0rd!",
      emailVerified: null,
    });
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const r1 = await resendPOST(makePost({ email: "rl@test.local" }));
    expect(r1.status).toBe(200);
    expect(stores.vTokens.length).toBe(1);
    // second call same timestamp (tooSoon)
    const r2 = await resendPOST(makePost({ email: "rl@test.local" }));
    expect(r2.status).toBe(200);
    expect(stores.vTokens.length).toBe(1);
  });

  it("verify route valide token et marque emailVerified", async () => {
    const { token, hash, expires } = generateVerificationToken();
    const stores = (prisma as unknown as MockStores).__stores;
    stores.users.push({
      id: "u4",
      email: "verif@test.local",
      password: "Passw0rd!",
      emailVerified: null,
    });
    stores.vTokens.push({
      identifier: "verif@test.local",
      token: hash,
      expires,
    });
    const res = await verifyGET(
      makeGet(
        `http://localhost/auth/verify?token=${token}&email=verif@test.local`,
      ),
    );
    expect(res.status).toBe(307); // redirect
    const loc = res.headers.get("location");
    expect(loc).toContain("verified=1");
    const user = stores.users.find((u) => u.email === "verif@test.local");
    expect(user?.emailVerified).toBeInstanceOf(Date);
    expect(stores.vTokens.length).toBe(0);
  });
});
