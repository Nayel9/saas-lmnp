#!/usr/bin/env tsx
/*
  Backfill propertyId pour JournalEntry et Asset.
  Usage:
    tsx scripts/backfill-propertyId.ts --user <USER_ID> --property <PROPERTY_ID> [--apply]
  - Dry-run par défaut (ne modifie rien).
  - Vérifie que le propertyId appartient bien au user.
*/
import 'dotenv/config';
import { prisma } from "@/lib/prisma";

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (!val || val.startsWith('--')) throw new Error(`Valeur manquante pour --${key}`);
      args[key] = val;
      i++;
    }
  }
  return args as { user?: string; property?: string; apply?: boolean };
}

async function main() {
  const { user: userId, property: propertyId, apply } = parseArgs(process.argv);
  if (!userId || !propertyId) {
    console.error('Args requis: --user <USER_ID> --property <PROPERTY_ID> [--apply]');
    process.exit(1);
  }
  const prop = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!prop) throw new Error('Property introuvable');
  if (prop.user_id !== userId) throw new Error('Property n’appartient pas à ce user');

  const missingEntries = await prisma.journalEntry.count({ where: { user_id: userId, propertyId: null } });
  const missingAssets = await prisma.asset.count({ where: { user_id: userId, propertyId: null } });

  console.log(`Dry-run: ${!apply ? 'OUI' : 'NON'}`);
  console.log(`User: ${userId}`);
  console.log(`Property: ${propertyId} (${prop.label})`);
  console.log(`Écritures sans propertyId: ${missingEntries}`);
  console.log(`Immobilisations sans propertyId: ${missingAssets}`);

  if (!apply) {
    console.log('Aucune modification appliquée. Ajoutez --apply pour écrire.');
    return;
  }

  const upd1 = await prisma.journalEntry.updateMany({
    where: { user_id: userId, propertyId: null },
    data: { propertyId },
  });
  const upd2 = await prisma.asset.updateMany({
    where: { user_id: userId, propertyId: null },
    data: { propertyId },
  });
  console.log(`JournalEntries mis à jour: ${upd1.count}`);
  console.log(`Assets mis à jour: ${upd2.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

