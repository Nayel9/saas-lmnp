import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import type { NextAuthConfig } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Adapter } from 'next-auth/adapters';
import type { JWT } from 'next-auth/jwt';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export interface AppUser { id: string; email: string; name?: string | null; role?: string; plan?: string | null; firstName?: string | null; lastName?: string | null; phone?: string | null; }

export async function validateCredentials(email: string, password: string): Promise<AppUser | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) return null;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan, firstName: user.firstName, lastName: user.lastName, phone: user.phone };
}

export async function requireVerifiedCredentials(email: string, password: string): Promise<AppUser | null | 'EMAIL_NOT_VERIFIED'> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) return null;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  if (!user.emailVerified) return 'EMAIL_NOT_VERIFIED';
  return { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan, firstName: user.firstName, lastName: user.lastName, phone: user.phone };
}

const adapter: Adapter = PrismaAdapter(prisma);

interface ExtendedJWT extends JWT { userId?: string; role?: string; plan?: string | null; firstName?: string | null; lastName?: string | null; phone?: string | null; }

export const authOptions: NextAuthConfig = {
  adapter,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Credentials',
      id: 'credentials',
      credentials: { email: { label: 'Email' }, password: { label: 'Password', type: 'password' } },
      async authorize(creds) {
        const parsed = credentialsSchema.safeParse(creds);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const res = await requireVerifiedCredentials(email, password);
        if (res === 'EMAIL_NOT_VERIFIED') {
          throw new Error('EMAIL_NOT_VERIFIED');
        }
        return res;
      }
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as AppUser; // user retourné par authorize
        token.userId = u.id;
        token.role = u.role || 'user';
        token.plan = u.plan || null;
        token.firstName = u.firstName || null;
        token.lastName = u.lastName || null;
        token.phone = u.phone || null;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as ExtendedJWT;
      if (session.user && t.userId) {
        session.user.id = t.userId;
        if (t.role) session.user.role = t.role;
        if (t.plan !== undefined) session.user.plan = t.plan ?? null;
        if (t.firstName !== undefined) session.user.firstName = t.firstName ?? null;
        if (t.lastName !== undefined) session.user.lastName = t.lastName ?? null;
        if (t.phone !== undefined) session.user.phone = t.phone ?? null;
      }
      return session;
    }
  },
  pages: { signIn: '/login' },
  trustHost: true,
};
