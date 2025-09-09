// src/app/api/profile/route.test.ts
import { POST } from "./route";
import { expect, test, vi, type Mock } from "vitest";
import { auth } from "@/lib/auth/core";

// Mocks Vitest
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn().mockResolvedValue({}) } },
}));
vi.mock("@/lib/auth/core", () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: "u@x.y" } }),
}));

test("reject unauthenticated", async () => {
  (auth as unknown as Mock).mockResolvedValueOnce(null);

  const res = await POST(
    new Request("http://test", { method: "POST", body: "{}" }),
  );
  expect(res.status).toBe(401);
});

test("ok", async () => {
  const res = await POST(
    new Request("http://test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "A",
        lastName: "B",
        phone: "+33 1 23",
      }),
    }),
  );
  expect(res.status).toBe(200);
});
