import { describe, it, expect, afterAll, vi } from 'vitest';
/* Refactor mock sans any */
vi.mock('@/lib/prisma', () => {
  interface MockUser { id: string; email: string; password?: string; role?: string }
  const users: MockUser[] = [];
  function findUnique({ where: { email } }: { where: { email: string } }): Promise<MockUser | null> {
    return Promise.resolve(users.find(u => u.email === email) || null);
  }
  function create({ data }: { data: Omit<MockUser, 'id'> & { id?: string } }): Promise<MockUser> {
    const user: MockUser = { id: data.id || `u_${users.length}`, email: data.email, password: data.password, role: data.role };
    users.push(user);
    return Promise.resolve(user);
  }
  function deleteMany({ where: { email } }: { where: { email: string } }): Promise<{ count: number }> {
    const before = users.length;
    for (let i = users.length - 1; i >= 0; i--) if (users[i].email === email) users.splice(i, 1);
    return Promise.resolve({ count: before - users.length });
  }
  return { prisma: { user: { findUnique, create, deleteMany } } };
});
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { POST } from './route';
import { NextRequest } from 'next/server';

function makeReq(body: unknown) {
  // Mock NextRequest for test
  return new NextRequest('http://localhost/api/users', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  });
}

const email = `signup-test-${Date.now()}@local.test`;
const password = 'Passw0rd!';

describe('POST /api/users (signup)', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });
  it('crée un utilisateur avec hash bcrypt', async () => {
    const res = await POST(makeReq({ email, password }));
    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();
    expect(user?.password).toBeTruthy();
    expect(user?.password).not.toBe(password);
    const ok = await bcrypt.compare(password, user!.password!);
    expect(ok).toBe(true);
  });
  it('retourne 409 si email déjà existant', async () => {
    const res = await POST(makeReq({ email, password }));
    expect(res.status).toBe(409);
  });
  it('retourne 400 si payload invalide', async () => {
    const res = await POST(makeReq({ email: 'not-an-email', password: 'short' }));
    expect(res.status).toBe(400);
  });
});
