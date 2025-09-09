// src/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string; // string garanti côté session
      name?: string | null;
      role?: string;
      plan?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      needsProfile?: boolean;
      isSso?: boolean;
    };
  }

  interface User {
    role?: string;
    plan?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    userId?: string;
    email?: string | null; // ← optionnel + nullable (important)
    role?: string;
    plan?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    needsProfile?: boolean;
    isSso?: boolean;
  }
}
