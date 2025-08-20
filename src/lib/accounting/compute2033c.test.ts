import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
vi.mock('../prisma', () => {
  type JEType = 'achat' | 'vente';
  interface MockJournalEntry { user_id: string; type: JEType; date: Date; designation: string; tier?: string; account_code: string; amount: number; currency: string }
  interface FieldFilter { contains: string; mode?: string }
  interface ORCond { designation?: FieldFilter; tier?: FieldFilter; account_code?: FieldFilter }
  interface DateFilter { gte?: Date; lte?: Date }
  interface JEWhereInput { user_id?: string; date?: DateFilter; account_code?: FieldFilter; OR?: ORCond[] }
  interface FindManyArgs { where?: JEWhereInput; orderBy?: { date?: 'asc'|'desc' }; skip?: number; take?: number; distinct?: string[]; select?: Record<string, boolean> }
  const journal: MockJournalEntry[] = [];
  function matchWhere(e: MockJournalEntry, where?: JEWhereInput): boolean {
    if (!where) return true;
    if (where.user_id && e.user_id !== where.user_id) return false;
    if (where.date?.gte && !(e.date >= where.date.gte)) return false;
    if (where.date?.lte && !(e.date <= where.date.lte)) return false;
    if (where.account_code?.contains && !e.account_code.toLowerCase().includes(where.account_code.contains.toLowerCase())) return false;
    return true;
  }
  function passesOR(e: MockJournalEntry, ors?: ORCond[]): boolean {
    if (!ors || !ors.length) return true;
    return ors.some(cond => {
      if (cond.designation?.contains && e.designation.toLowerCase().includes(cond.designation.contains.toLowerCase())) return true;
      if (cond.tier?.contains && (e.tier||'').toLowerCase().includes(cond.tier.contains.toLowerCase())) return true;
      if (cond.account_code?.contains && e.account_code.toLowerCase().includes(cond.account_code.contains.toLowerCase())) return true;
      return false;
    });
  }
  function findMany(args: FindManyArgs): Promise<MockJournalEntry[] | Record<string, unknown>[]> {
    const { where, orderBy, skip, take, select } = args;
    let list = journal.filter(j => matchWhere(j, where) && passesOR(j, where?.OR));
    if (orderBy?.date) {
      list = list.slice().sort((a,b)=> a.date.getTime() - b.date.getTime());
      if (orderBy.date === 'desc') list.reverse();
    }
    if (typeof skip === 'number') list = list.slice(skip);
    if (typeof take === 'number') list = list.slice(0, take);
    if (select) {
      return Promise.resolve(list.map(entry => {
        const o: Record<string, unknown> = {};
        for (const k of Object.keys(select)) if (select[k]) o[k] = (entry as unknown as Record<string, unknown>)[k];
        return o;
      }));
    }
    return Promise.resolve(list);
  }
  function deleteMany({ where }: { where?: JEWhereInput }): Promise<{ count: number }> {
    const before = journal.length;
    for (let i = journal.length - 1; i >= 0; i--) if (matchWhere(journal[i], where)) journal.splice(i,1);
    return Promise.resolve({ count: before - journal.length });
  }
  function createMany({ data }: { data: MockJournalEntry[] }): Promise<{ count: number }> { for (const d of data) journal.push(d); return Promise.resolve({ count: data.length }); }
  return { prisma: { journalEntry: { findMany, deleteMany, createMany } } };
});
import { prisma } from '../prisma';
import { compute2033C } from './compute2033c';

const userId = '00000000-0000-0000-0000-0000000002033';

beforeAll(async () => {
  await prisma.journalEntry.deleteMany({ where: { user_id: userId } });
  const baseDate = new Date('2025-01-15');
  await prisma.journalEntry.createMany({ data: [
    { user_id: userId, type: 'vente', date: baseDate, designation: 'Vente test', tier: 'ClientA', account_code: '706', amount: 1000, currency: 'EUR' },
    { user_id: userId, type: 'achat', date: baseDate, designation: 'Achat charges', tier: 'Fourn1', account_code: '606', amount: 300, currency: 'EUR' },
    { user_id: userId, type: 'achat', date: baseDate, designation: 'Assurance', tier: 'Assureur', account_code: '616', amount: 50, currency: 'EUR' },
    { user_id: userId, type: 'achat', date: baseDate, designation: 'Taxe', tier: 'Etat', account_code: '635', amount: 20, currency: 'EUR' },
    { user_id: userId, type: 'achat', date: baseDate, designation: 'Amort', tier: 'Sys', account_code: '6811', amount: 200, currency: 'EUR' },
  ]});
});

afterAll(async () => {
  await prisma.journalEntry.deleteMany({ where: { user_id: userId } });
});

describe('compute2033C', () => {
  it('calcule totaux attendus', async () => {
    const res = await compute2033C({ userId });
    expect(res.totals.produits).toBe(1000); // CA
    expect(res.totals.charges).toBe(370);   // 300 + 50 + 20
    expect(res.totals.amortissements).toBe(200);
    expect(res.totals.resultat).toBe(430);  // 1000 - 370 - 200
  });
});
