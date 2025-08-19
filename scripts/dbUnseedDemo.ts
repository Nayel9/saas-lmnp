#!/usr/bin/env tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../src/lib/prisma';
import { SEED_SUFFIX } from '../src/lib/seedDemoCore';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_SEED_EMAIL;

function assertEnv() {
  const missing: string[] = [];
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!adminEmail) missing.push('ADMIN_SEED_EMAIL');
  if (missing.length) { console.error('Variables manquantes:', missing.join(', ')); process.exit(1); }
}

async function findAdminId(): Promise<string | null> {
  const supabase = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: list, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const user = list.users.find(u => u.email?.toLowerCase() === adminEmail!.toLowerCase());
  return user?.id || null;
}

(async () => {
  try {
    assertEnv();
    const userId = await findAdminId();
    if (!userId) {
      console.log('Admin introuvable – rien à faire.');
      process.exit(0);
    }
    const delJournal = await prisma.journalEntry.deleteMany({ where: { user_id: userId, designation: { endsWith: SEED_SUFFIX } } });
    const delAssets  = await prisma.asset.deleteMany({ where: { user_id: userId, label: { endsWith: SEED_SUFFIX } } });
    console.log('Unseed terminé');
    console.log('Journal supprimé:', delJournal.count);
    console.log('Assets supprimés:', delAssets.count);
  } catch (e: any) {
    console.error('Unseed échec:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();

