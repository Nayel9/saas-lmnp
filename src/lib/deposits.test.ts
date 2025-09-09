import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("./prisma", () => {
  interface Entry {
    user_id: string;
    type: "vente" | "achat";
    date: Date;
    amount: number;
    isDeposit?: boolean;
  }
  interface Where {
    user_id?: string;
    type?: string;
    isDeposit?: boolean;
    date?: { gte?: Date; lte?: Date };
  }
  const data: Entry[] = [];
  function matchWhere(e: Entry, where?: Where) {
    if (!where) return true;
    if (where.user_id && e.user_id !== where.user_id) return false;
    if (where.type && e.type !== where.type) return false;
    if (
      typeof where.isDeposit === "boolean" &&
      !!e.isDeposit !== where.isDeposit
    )
      return false;
    if (where.date?.gte && e.date < where.date.gte) return false;
    return !(where.date?.lte && e.date > where.date.lte);
  }
  return {
    prisma: {
      journalEntry: {
        aggregate: ({ where }: { where?: Where }) => {
          const sum = data
            .filter((e) => matchWhere(e, where))
            .reduce((a, e) => a + e.amount, 0);
          return Promise.resolve({ _sum: { amount: sum } });
        },
        count: ({ where }: { where?: Where }) =>
          Promise.resolve(data.filter((e) => matchWhere(e, where)).length),
        _data: data,
      },
    },
  };
});

import { prisma } from "./prisma";
import { getDepositsSummary } from "./deposits";

const userId = "user-dep-0001";

beforeAll(() => {
  const d = (s: string) => new Date(s);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma.journalEntry as any)._data.push(
    {
      user_id: userId,
      type: "vente",
      date: d("2025-01-10"),
      amount: 100,
      isDeposit: true,
    },
    {
      user_id: userId,
      type: "vente",
      date: d("2025-02-01"),
      amount: 200,
      isDeposit: true,
    },
    {
      user_id: userId,
      type: "vente",
      date: d("2025-03-01"),
      amount: 300,
      isDeposit: false,
    },
    {
      user_id: "other",
      type: "vente",
      date: d("2025-01-10"),
      amount: 999,
      isDeposit: true,
    },
  );
});

afterAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma.journalEntry as any)._data.length = 0;
});

describe("getDepositsSummary", () => {
  it("retourne somme et nombre pour user", async () => {
    const r = await getDepositsSummary({ userId });
    expect(r.sum).toBe(300);
    expect(r.count).toBe(2);
  });
  it("filtre par période", async () => {
    const r = await getDepositsSummary({
      userId,
      from: new Date("2025-02-01"),
      to: new Date("2025-12-31"),
    });
    expect(r.sum).toBe(200);
    expect(r.count).toBe(1);
  });
});
