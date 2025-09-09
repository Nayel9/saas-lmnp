import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export interface DepositsSummaryParams {
  userId: string;
  from?: Date;
  to?: Date;
}
export interface DepositsSummary {
  sum: number;
  count: number;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function getDepositsSummary(
  params: DepositsSummaryParams,
): Promise<DepositsSummary> {
  const { userId, from, to } = params;
  const where: Prisma.JournalEntryWhereInput = {
    user_id: userId,
    type: "vente",
    isDeposit: true,
  } as Prisma.JournalEntryWhereInput;
  if (from || to)
    (where.date as Prisma.DateTimeFilter | undefined) =
      {} as Prisma.DateTimeFilter;
  if (from) (where.date as Prisma.DateTimeFilter).gte = from;
  if (to) (where.date as Prisma.DateTimeFilter).lte = to;
  const [agg, count] = await Promise.all([
    prisma.journalEntry.aggregate({ _sum: { amount: true }, where }),
    prisma.journalEntry.count({ where }),
  ]);
  return { sum: round2(Number(agg._sum.amount || 0)), count };
}
