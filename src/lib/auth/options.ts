import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthConfig } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Adapter } from 'next-auth/adapters';

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
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        await prisma.user.update({
          where: { email: user.email ?? '' },
          data: { emailVerified: new Date() },
        });
      }
      return true;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId ?? '';
        session.user.role = token.role;
        session.user.plan = token.plan;
        session.user.firstName = token.firstName ?? null;
        session.user.lastName = token.lastName ?? null;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.plan = user.plan;
        token.firstName = user.firstName ?? null;
        token.lastName = user.lastName ?? null;
      }
      return token;
    },
  },
  pages: { signIn: '/login' },
  trustHost: true,
};
