import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
vi.mock('@/lib/prisma', () => {
  interface MockUser { id: string; email: string; password?: string; role?: string }
  const users: MockUser[] = [];
  function create({ data }: { data: Omit<MockUser,'id'> & { id?: string } }): Promise<MockUser> {
    const user: MockUser = { id: data.id || `u_${users.length}`, email: data.email, password: data.password, role: data.role };
    users.push(user);
    return Promise.resolve(user);
  }
  function findUnique({ where: { email } }: { where: { email: string } }): Promise<MockUser | null> {
    return Promise.resolve(users.find(u => u.email === email) || null);
  }
  function deleteMany({ where: { email } }: { where: { email: string } }): Promise<{ count: number }> {
    const before = users.length;
    for (let i = users.length - 1; i >= 0; i--) if (users[i].email === email) users.splice(i,1);
    return Promise.resolve({ count: before - users.length });
  }
  return { prisma: { user: { create, findUnique, deleteMany } } };
});
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validateCredentials } from './options';

const email = `cred-test-${Date.now()}@local.test`;
const password = 'Passw0rd!';

describe('validateCredentials (Credentials Provider)', () => {
  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, password: hash, role: 'user' } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });
  it('retourne user pour credentials valides', async () => {
    const user = await validateCredentials(email, password);
    expect(user).toBeTruthy();
    expect(user?.email).toBe(email);
  });
  it('retourne null pour mauvais mot de passe', async () => {
    const user = await validateCredentials(email, 'Wrong123!');
    expect(user).toBeNull();
  });
  it('retourne null pour email inconnu', async () => {
    const user = await validateCredentials('unknown-'+email, password);
    expect(user).toBeNull();
  });
});
