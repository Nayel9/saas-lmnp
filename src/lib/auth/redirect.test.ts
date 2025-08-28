import { describe, expect, it } from "vitest";
import { authOptions } from "./options";

const redirect = authOptions.callbacks!.redirect!;

describe("NextAuth redirect callback (sécurité)", () => {
  it("accepte une URL relative", async () => {
    const baseUrl = "http://localhost:3000";
    const res = await redirect({ url: "/dashboard", baseUrl, } as {
      url: string;
      baseUrl: string;
    });
    expect(res).toBe(`${baseUrl}/dashboard`);
  });
  it("autorise une URL absolue du même origin", async () => {
    const baseUrl = "http://localhost:3000";
    const res = await redirect({
      url: "http://localhost:3000/dashboard",
      baseUrl,
    } as { url: string; baseUrl: string });
    expect(res).toBe("http://localhost:3000/dashboard");
  });
  it("rejette une URL externe et retombe sur baseUrl", async () => {
    const baseUrl = "http://localhost:3000";
    const res = await redirect({
      url: "https://evil.example.com/phish",
      baseUrl,
    } as { url: string; baseUrl: string });
    expect(res).toBe(baseUrl);
  });
});
