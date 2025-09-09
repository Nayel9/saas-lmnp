#!/usr/bin/env tsx
import "dotenv/config";

const adminEmail = process.env.ADMIN_SEED_EMAIL;
const adminPassword = process.env.ADMIN_SEED_PASSWORD || "ChangeMe123!";
const dryRun = process.env.DRY_RUN === "1";

function assertEnv() {
  const missing: string[] = [];
  if (!adminEmail) missing.push("ADMIN_SEED_EMAIL");
  if (missing.length) {
    console.error("Variables manquantes:", missing.join(", "));
    process.exit(1);
  }
}

