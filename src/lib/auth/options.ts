// src/lib/auth/options.ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import LinkedInProvider from "next-auth/providers/linkedin";
import type { DefaultSession, NextAuthConfig, User as NextAuthUser } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

/* ---------------- Types ---------------- */
export interface AppUser {
    id: string;
    email: string;
    name?: string | null;
    role?: string;
    plan?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
}

type SessionUser = DefaultSession["user"] & {
    id: string;
    email: string; // Rendre l'email obligatoire et non nullable
    role?: string;
    plan?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    needsProfile?: boolean;
    isSso?: boolean;
};

type TokenExt = JWT & {
    id?: string;
    userId?: string;
    email?: string | null; // ← optionnel + nullable
    role?: string;
    plan?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    needsProfile?: boolean;
    isSso?: boolean;
};

/* -------------- Credentials schema -------------- */
const credentialsSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

/* -------------- Helpers credentials -------------- */
export async function validateCredentials(email: string, password: string): Promise<AppUser | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return null;
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return null;
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role ?? undefined,
        plan: user.plan,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
    };
}

export async function requireVerifiedCredentials(
    email: string,
    password: string,
): Promise<AppUser | null | "EMAIL_NOT_VERIFIED"> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return null;
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return null;
    if (!user.emailVerified) return "EMAIL_NOT_VERIFIED";
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role ?? undefined,
        plan: user.plan,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
    };
}

/* ---------------- NextAuth v5 config ---------------- */
const adapter: Adapter = PrismaAdapter(prisma);

export const authOptions: NextAuthConfig = {
    adapter,
    session: { strategy: "jwt" },
    providers: [
        Credentials({
            name: "Credentials",
            id: "credentials",
            credentials: {
                email: { label: "Email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(creds) {
                const parsed = credentialsSchema.safeParse(creds);
                if (!parsed.success) return null;
                const { email, password } = parsed.data;
                const res = await requireVerifiedCredentials(email, password);
                if (res === "EMAIL_NOT_VERIFIED") {
                    throw new Error("EMAIL_NOT_VERIFIED");
                }
                // On retourne un User minimal typé NextAuth
                return res as unknown as NextAuthUser;
            },
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        LinkedInProvider({
            clientId: process.env.LINKEDIN_CLIENT_ID!,
            clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
            authorization: { params: { scope: "openid profile email" } },
        }),
    ],
    callbacks: {
        // Marque le mail vérifié si SSO
        async signIn({ user, account }) {
            if ((account?.provider === "google" || account?.provider === "linkedin") && user.email) {
                await prisma.user.update({
                    where: { email: user.email },
                    data: { emailVerified: new Date() },
                });
            }
            return true;
        },

        // Enrichit la session: toujours fournir un email string
        async session({ session, token }) {
            const t = token as TokenExt;

            // Assurer l'existence d'un objet user et muter ses propriétés
            if (!session.user) {
                // Crée un objet minimal puis caste via unknown pour éviter any
                (session as unknown as { user: Partial<SessionUser> }).user = { email: "", id: "" };
            }

            const su = session.user as SessionUser;
            su.id = t.userId ?? t.id ?? su.id ?? "";
            su.email = (t.email ?? su.email ?? "") as string;
            su.role = t.role;
            su.plan = t.plan ?? null;
            su.firstName = t.firstName ?? null;
            su.lastName = t.lastName ?? null;
            su.phone = t.phone ?? null;
            su.needsProfile = Boolean(t.needsProfile);
            su.isSso = Boolean(t.isSso);

            return session;
        },

        // Enrichit le token, resync si besoin
        async jwt({ token, user, account, trigger }) {
            const t = token as TokenExt;

            if (user) {
                const u = user as unknown as AppUser;
                t.id = u.id ?? t.id;
                t.userId = u.id ?? t.userId;
                t.email = u.email ?? t.email ?? null; // ← peut rester null au 1er passage
                t.role = u.role ?? t.role;
                t.plan = u.plan ?? t.plan ?? null;
                t.firstName = u.firstName ?? t.firstName ?? null;
                t.lastName = u.lastName ?? t.lastName ?? null;
                t.phone = u.phone ?? t.phone ?? null;
            }

            // Marque SSO si provider différent de credentials lors du signIn
            if (account) {
                t.isSso = account.provider !== "credentials";
            } else if (typeof t.isSso === "undefined") {
                t.isSso = false;
            }

            // Resync après update() client ou si infos manquantes — éviter Edge (middleware)
            const isEdge = typeof globalThis !== "undefined" && "EdgeRuntime" in (globalThis as object);
            if (!isEdge && (trigger === "update" || !t.firstName || !t.lastName || !t.phone)) {
                const email = t.email ?? undefined;
                if (email) {
                    const dbUser = await prisma.user.findUnique({
                        where: { email },
                        select: { firstName: true, lastName: true, phone: true },
                    });
                    if (dbUser) {
                        t.firstName = dbUser.firstName ?? null;
                        t.lastName = dbUser.lastName ?? null;
                        t.phone = dbUser.phone ?? null;
                    }
                }
            }

            t.needsProfile = !t.firstName || !t.lastName || !t.phone;
            return t;
        },
    },
    pages: { signIn: "/login" },
    trustHost: true,
};
