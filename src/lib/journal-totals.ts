export interface JournalEntryLike {
  amount: number | string | null | undefined;
}

export interface JournalVisibleTotals {
  count: number;
  sum: number;
}

export function computeVisibleTotals(
  entries: JournalEntryLike[],
): JournalVisibleTotals {
  let sum = 0;
  for (const e of entries) {
    const n =
      typeof e.amount === "number"
        ? e.amount
        : e.amount
          ? parseFloat(e.amount as string)
          : 0;
    if (!isNaN(n)) sum += n;
  }
  return { count: entries.length, sum: Math.round(sum * 100) / 100 };
}
