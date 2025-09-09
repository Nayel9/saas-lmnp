#!/usr/bin/env tsx
import "dotenv/config";


const adminEmail = process.env.ADMIN_SEED_EMAIL;

function assertEnv() {
  const missing: string[] = [];
  if (!adminEmail) missing.push("ADMIN_SEED_EMAIL");
  if (missing.length) {
    console.error("Variables manquantes:", missing.join(", "));
    process.exit(1);
  }
}

// Ici, tu peux ajouter la logique de suppression sans Supabase, ou supprimer ce script si inutile.
console.log(
  "Ce script nécessite une adaptation ou peut être supprimé si Supabase n’est plus utilisé.",
);
