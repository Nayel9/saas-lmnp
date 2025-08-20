import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import type { NextAuthConfig } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Adapter } from 'next-auth/adapters';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export interface AppUser { id: string; email: string; name?: string | null; role?: string; plan?: string | null; }

export async function validateCredentials(email: string, password: string): Promise<AppUser | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) return null;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan };
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
        return await validateCredentials(email, password);
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
        if (token.role) session.user.role = token.role;
        if (token.plan !== undefined) session.user.plan = token.plan as string | null;
      }
      return session;
    }
  },
  pages: { signIn: '/login' },
  trustHost: true,
};
