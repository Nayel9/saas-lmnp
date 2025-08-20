#!/usr/bin/env tsx
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { buildSeedData, SEED_SUFFIX } from '../src/lib/seedDemoCore';

const adminEmail = process.env.ADMIN_SEED_EMAIL;
const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'ChangeMe123!';
const dryRun = process.env.DRY_RUN === '1';

function assertEnv() {
  const missing: string[] = [];
  if (!adminEmail) missing.push('ADMIN_SEED_EMAIL');
  if (missing.length) {
    console.error('Variables manquantes:', missing.join(', '));
    process.exit(1);
  }
}

// Ici, tu peux ajouter la logique de seed sans Supabase, ou supprimer ce script si inutile.
console.log('Ce script nécessite une adaptation ou peut être supprimé si Supabase n’est plus utilisé.');
