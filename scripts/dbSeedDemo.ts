#!/usr/bin/env tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../src/lib/prisma';
import { buildSeedData, SEED_SUFFIX } from '../src/lib/seedDemoCore';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_SEED_EMAIL;
const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'ChangeMe123!';
const dryRun = process.env.DRY_RUN === '1';

function assertEnv() {
  const missing: string[] = [];
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!adminEmail) missing.push('ADMIN_SEED_EMAIL');
  if (missing.length) {
    console.error('Variables manquantes:', missing.join(', '));
    process.exit(1);
  }
}

async function ensureAdmin(): Promise<string> {
  const supabase = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  // Pagination simple (perPage 200)
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;
  let user = list.users.find(u => u.email?.toLowerCase() === adminEmail!.toLowerCase());
  if (!user) {
    if (dryRun) {
      console.log('[dry-run] Création admin simulée');
      return 'dry-run-user-id';
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email: adminEmail!,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: 'admin' },
      app_metadata: { role: 'admin' }
    });
    if (error) throw error;
    user = data.user;
    console.log('Admin créé:', user.id);
  } else {
    // S'assure du rôle
    if (!dryRun) {
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata||{}), role: 'admin' },
        app_metadata: { ...(user.app_metadata||{}), role: 'admin' }
      });
    }
    console.log('Admin existant:', user.id);
  }
  return user.id;
}

async function upsertJournal(userId: string) {
  const data = buildSeedData();
  let inserted = 0; let updated = 0;
  for (const j of data.journal) {
    const designation = j.designation + SEED_SUFFIX;
    if (dryRun) { console.log('[dry-run] journal', j.date, j.type, j.account_code, designation, j.amount); continue; }
    const existing = await prisma.journalEntry.findFirst({ where: { user_id: userId, type: j.type, date: new Date(j.date), account_code: j.account_code, designation } });
    if (existing) {
      // Optionnel: mise à jour montant si différent
      if (Number(existing.amount) !== j.amount) {
        await prisma.journalEntry.update({ where: { id: existing.id }, data: { amount: j.amount } });
        updated++;
      }
    } else {
      await prisma.journalEntry.create({ data: { user_id: userId, type: j.type, date: new Date(j.date), designation, tier: j.tier, account_code: j.account_code, amount: j.amount, currency: j.currency } });
      inserted++;
    }
  }
  return { inserted, updated };
}

async function upsertAssets(userId: string) {
  const data = buildSeedData();
  let inserted = 0; let updated = 0;
  for (const a of data.assets) {
    const label = a.label + SEED_SUFFIX;
    if (dryRun) { console.log('[dry-run] asset', a.acquisition_date, label, a.amount_ht); continue; }
    const existing = await prisma.asset.findFirst({ where: { user_id: userId, label, acquisition_date: new Date(a.acquisition_date) } });
    if (existing) {
      if (Number(existing.amount_ht) !== a.amount_ht || existing.duration_years !== a.duration_years) {
        await prisma.asset.update({ where: { id: existing.id }, data: { amount_ht: a.amount_ht, duration_years: a.duration_years } });
        updated++;
      }
    } else {
      await prisma.asset.create({ data: { user_id: userId, label, amount_ht: a.amount_ht, duration_years: a.duration_years, acquisition_date: new Date(a.acquisition_date), account_code: a.account_code } });
      inserted++;
    }
  }
  return { inserted, updated };
}

(async () => {
  try {
    assertEnv();
    const userId = await ensureAdmin();
    const jr = await upsertJournal(userId);
    const ar = await upsertAssets(userId);
    console.log('\nRésumé seed demo');
    console.log('Utilisateur:', userId);
    console.log(`Journal: ${jr.inserted} insérés, ${jr.updated} mis à jour`);
    console.log(`Assets: ${ar.inserted} insérés, ${ar.updated} mis à jour`);
    console.log('\nTests conseillés:');
    console.log('- /journal/achats?from=2025-01-01&to=2025-12-31');
    console.log('- /reports/2033c?from=2025-01-01&to=2025-12-31');
    console.log('- /reports/2033e?year=2025');
    console.log('- /reports/2033a?year=2025');
    if (dryRun) console.log('(dry-run: aucune écriture/asset créé)');
  } catch (e:any) {
    console.error('Seed demo échec:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();

