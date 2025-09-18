#!/usr/bin/env tsx
import { prisma } from '@/lib/prisma';
import { LedgerAccount } from '@prisma/client';
import { guessAccountCode } from '@/lib/accounting/guessAccountCode';
async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`[backfill] Start (apply=${apply})`);
  const globals = await prisma.ledgerAccount.findMany({ where: { propertyId: null } });
  const globalByCode = new Map(globals.map(a => [a.code, a]));
  let updated = 0;
  const batch = 250;
  for (;;) {
    const entries = await prisma.journalEntry.findMany({ where: { accountId: null }, take: batch, orderBy: { created_at: 'asc' } });
    if (!entries.length) break;
    for (const e of entries) {
      const guess = guessAccountCode({ type: e.type as any, isDeposit: e.isDeposit, designation: e.designation });
      const chosen: LedgerAccount | undefined = globalByCode.get(guess.code);
      if (!chosen) continue;
      if (apply) {
        await prisma.journalEntry.update({ where: { id: e.id }, data: { accountId: chosen.id, accountCode: chosen.code, accountLabel: chosen.label } });
      } else {
        console.log(`DRY id=${e.id} -> ${guess.code} (${guess.reason})`);
      }
      updated++;
    }
    if (!apply) break; // un batch en dry-run
  }
  console.log(`[backfill] Fini. ${updated} écritures ${apply ? 'mises à jour' : 'proposées'}.`);
  if (!apply) console.log('Relancer avec --apply pour écrire.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
