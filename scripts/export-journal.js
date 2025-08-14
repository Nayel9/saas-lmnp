#!/usr/bin/env node
/*
Usage:
  node scripts/export-journal.js achats csv > achats.csv
  node scripts/export-journal.js ventes xlsx > ventes.xlsx (rediriger vers fichier binaire PAS conseillé en stdout)

Arguments:
  type: achats | ventes
  format: csv | xlsx
Optionnel via env:
  FROM=2024-01-01 TO=2024-12-31 TIER=Fournisseur SEARCH=mot
*/
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');

async function main(){
  const [,, typeArg, format] = process.argv;
  if(!['achats','ventes'].includes(typeArg)|| !['csv','xlsx'].includes(format)){
    console.error('Args invalides. Exemple: node scripts/export-journal.js achats csv');
    process.exit(1);
  }
  const entryType = typeArg === 'achats' ? 'achat' : 'vente';
  const where = { type: entryType };
  const { FROM, TO, TIER, SEARCH } = process.env;
  if (FROM || TO) where.date = {};
  if (FROM) where.date.gte = new Date(FROM);
  if (TO) where.date.lte = new Date(TO);
  if (TIER) where.tier = { contains: TIER, mode: 'insensitive' };
  if (SEARCH) where.OR = [
    { designation: { contains: SEARCH, mode: 'insensitive' } },
    { tier: { contains: SEARCH, mode: 'insensitive' } },
    { account_code: { contains: SEARCH, mode: 'insensitive' } },
  ];
  const rows = await prisma.journalEntry.findMany({ where, orderBy: { date: 'desc' } });
  if (format === 'csv') {
    const header = 'date;designation;tier;account_code;amount;currency\n';
    const body = rows.map(r => [r.date.toISOString().slice(0,10), r.designation, r.tier||'', r.account_code, r.amount, r.currency].join(';')).join('\n');
    process.stdout.write(header+body+ (body? '\n':''));
  } else {
    const data = rows.map(r => ({
      Date: r.date.toISOString().slice(0,10),
      Designation: r.designation,
      Tier: r.tier || '',
      Compte: r.account_code,
      Montant: r.amount,
      Devise: r.currency,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, typeArg);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    process.stdout.write(buf);
  }
}
main().catch(e=>{ console.error(e); process.exit(1); }).finally(()=> prisma.$disconnect());

