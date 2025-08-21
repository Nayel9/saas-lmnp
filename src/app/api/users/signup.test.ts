import { describe, it, expect, afterAll, vi } from 'vitest';
vi.mock('@/lib/prisma', () => {
  interface MockUser { id: string; email: string; password?: string; role?: string; emailVerified?: Date | null; firstName?: string | null; lastName?: string | null; phone?: string | null }
  interface MockVerificationToken { identifier: string; token: string; expires: Date }
  const users: MockUser[] = [];
  const vTokens: MockVerificationToken[] = [];
  function findUnique({ where: { email } }: { where: { email: string } }): Promise<MockUser | null> { return Promise.resolve(users.find(u => u.email === email) || null); }
  function create({ data }: { data: Omit<MockUser, 'id'> & { id?: string } }): Promise<MockUser> { const user: MockUser = { id: data.id || `u_${users.length}`, email: data.email, password: data.password, role: data.role, emailVerified: data.emailVerified ?? null, firstName: data.firstName, lastName: data.lastName, phone: data.phone }; users.push(user); return Promise.resolve(user); }
  function deleteMany({ where: { email } }: { where: { email: string } }): Promise<{ count: number }> { const before = users.length; for (let i = users.length - 1; i >= 0; i--) if (users[i].email === email) users.splice(i, 1); return Promise.resolve({ count: before - users.length }); }
  const verificationToken = { deleteMany: ({ where: { identifier } }: { where: { identifier: string } }) => { const before = vTokens.length; for (let i=vTokens.length-1;i>=0;i--) if (vTokens[i].identifier===identifier) vTokens.splice(i,1); return Promise.resolve({ count: before - vTokens.length }); }, create: ({ data }: { data: MockVerificationToken }) => { vTokens.push(data); return Promise.resolve(data); } };
  return { prisma: { user: { findUnique, create, deleteMany }, verificationToken } };
});
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { POST } from './route';
import { NextRequest } from 'next/server';

function makeReq(body: unknown, ip = '127.0.0.1') { return new NextRequest('http://localhost/api/users', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip } }); }

const email = `signup-test-${Date.now()}@local.test`;
const password = 'Passw0rd!';
const firstName = 'Jean';
const lastName = 'Dupont';
const phone = '+33123456789';

describe('POST /api/users (signup)', () => {
  afterAll(async () => { await prisma.user.deleteMany({ where: { email } }); });
  it('crée un utilisateur avec hash bcrypt', async () => {
    const res = await POST(makeReq({ email, password, firstName, lastName, phone }));
    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();
    expect(user?.password).toBeTruthy();
    expect(user?.password).not.toBe(password);
    const ok = await bcrypt.compare(password, user!.password!);
    expect(ok).toBe(true);
  });
  it('retourne 409 si email déjà existant', async () => {
    const res = await POST(makeReq({ email, password, firstName, lastName, phone }, '127.0.0.2'));
    expect(res.status).toBe(409);
  });
  it('retourne 400 si payload invalide', async () => {
    const res = await POST(makeReq({ email: 'not-an-email', password: 'short', firstName: '', lastName: '', phone: 'abc' }, '127.0.0.3'));
    expect(res.status).toBe(400);
  });
  it('retourne 400 si champs profil requis manquants', async () => {
    const res = await POST(makeReq({ email: `x-${email}`, password }, '127.0.0.4'));
    expect(res.status).toBe(400);
  });
  it('normalise un téléphone FR vers E.164', async () => {
    const emailNorm = `norm-${Date.now()}@local.test`;
    const res = await POST(makeReq({ email: emailNorm, password, firstName, lastName, phone: '06 12 34 56 78' }, '10.0.0.1'));
    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    expect(user?.phone).toMatch(/^\+33[0-9]{9}$/);
  });
  it('rate-limit: deuxième création rapide même IP retourne 429', async () => {
    const e1 = `rate-${Date.now()}@local.test`;
    const e2 = `rate2-${Date.now()}@local.test`;
    const ip = '10.10.10.10';
    const r1 = await POST(makeReq({ email: e1, password, firstName, lastName }, ip));
    expect(r1.status).toBe(201);
    const r2 = await POST(makeReq({ email: e2, password, firstName, lastName }, ip));
    expect(r2.status).toBe(429);
  });
});
