#!/usr/bin/env node
// Seed de démonstration: insère quelques propriétés, écritures comptables et immobilisations
// Conditions:
//  - SUPABASE_SERVICE_ROLE_KEY (pour récupérer l'utilisateur de seed via l'API Admin)
//  - NEXT_PUBLIC_SUPABASE_URL
//  - ADMIN_SEED_EMAIL (sinon on prend le premier utilisateur retourné)
// Utilisation: pnpm db:seed:demo

require('dotenv/config');
const fetch = global.fetch || require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resolveUserId() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises pour le seed.');
  }
  const targetEmail = process.env.ADMIN_SEED_EMAIL;
  const listRes = await fetch(`${url}/auth/v1/admin/users?per_page=100`, {
    headers: { 'Authorization': `Bearer ${key}`, 'apikey': key },
  });
  if (!listRes.ok) throw new Error('Echec récupération users: ' + listRes.status);
  const data = await listRes.json();
  let user = null;
  if (targetEmail) user = data.users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
  if (!user) user = data.users[0];
  if (!user) throw new Error('Aucun utilisateur trouvé pour seed. Créez un compte via /login.');
  return { id: user.id, email: user.email };
}

async function main() {
  const { id: userId, email } = await resolveUserId();
  console.log('Seed pour user:', email, userId);

  // Créer une propriété de test si aucune
  let property = await prisma.property.findFirst({ where: { user_id: userId } });
  if (!property) {
    property = await prisma.property.create({ data: { user_id: userId, label: 'Appartement Demo', address: '1 rue de la Paix' } });
    console.log('Property créée:', property.id);
  }

  // Immobilisations (assets)
  const assetsCount = await prisma.asset.count({ where: { user_id: userId } });
  if (assetsCount === 0) {
    await prisma.asset.createMany({ data: [
      { user_id: userId, label: 'Chauffe-eau', amount_ht: 800.00, duration_years: 10, acquisition_date: new Date('2024-06-01'), account_code: '215' },
      { user_id: userId, label: 'Mobilier', amount_ht: 1500.00, duration_years: 7, acquisition_date: new Date('2024-07-15'), account_code: '2183' },
    ]});
    console.log('Assets insérés');
  }

  // Journal entries
  const journalCount = await prisma.journalEntry.count({ where: { user_id: userId } });
  if (journalCount === 0) {
    await prisma.journalEntry.createMany({ data: [
      { user_id: userId, type: 'achat', date: new Date('2024-07-01'), designation: 'Achat fournitures', tier: 'Fournisseur X', account_code: '606', amount: 120.50, currency: 'EUR' },
      { user_id: userId, type: 'achat', date: new Date('2024-07-10'), designation: 'Honoraires comptable', tier: 'Cabinet Y', account_code: '622', amount: 300.00, currency: 'EUR' },
      { user_id: userId, type: 'vente', date: new Date('2024-07-20'), designation: 'Loyer Juillet', tier: 'Locataire A', account_code: '706', amount: 750.00, currency: 'EUR' },
    ]});
    console.log('Journal entries insérées');
  }

  console.log('Seed terminé.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

