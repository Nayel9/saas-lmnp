-- Migration: ledger accounts & category mapping & journal denormalization
-- Create enum AccountKind
DO $$ BEGIN
  CREATE TYPE "AccountKind" AS ENUM ('REVENUE','EXPENSE','ASSET','LIABILITY','TREASURY','TAX');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new nullable columns to journal_entries if not exists
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "accountId" text;
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "accountCode" text;
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "accountLabel" text;
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "categoryKey" text;

-- Create table ledger_accounts
CREATE TABLE IF NOT EXISTS "ledger_accounts" (
  "id" text PRIMARY KEY,
  "propertyId" text NULL,
  "code" text NOT NULL,
  "label" text NOT NULL,
  "kind" "AccountKind" NOT NULL,
  "isEditable" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now()
);

-- Unique constraint (propertyId, code)
DO $$ BEGIN
  ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_propertyId_code_key" UNIQUE ("propertyId", "code");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- FK to Property
DO $$ BEGIN
  ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create table category_to_account
CREATE TABLE IF NOT EXISTS "category_to_account" (
  "id" text PRIMARY KEY,
  "propertyId" text NOT NULL,
  "categoryKey" text NOT NULL,
  "accountId" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now()
);

-- Unique constraint (propertyId, categoryKey)
DO $$ BEGIN
  ALTER TABLE "category_to_account" ADD CONSTRAINT "category_to_account_propertyId_categoryKey_key" UNIQUE ("propertyId", "categoryKey");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Index on accountId
CREATE INDEX IF NOT EXISTS "category_to_account_accountId_idx" ON "category_to_account" ("accountId");

-- FK category_to_account.propertyId -> Property
DO $$ BEGIN
  ALTER TABLE "category_to_account" ADD CONSTRAINT "category_to_account_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- FK category_to_account.accountId -> ledger_accounts
DO $$ BEGIN
  ALTER TABLE "category_to_account" ADD CONSTRAINT "category_to_account_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- FK journal_entries.accountId -> ledger_accounts
DO $$ BEGIN
  ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Basic trigger to auto-update updatedAt (optional) skipped for brevity.

-- Seed global ledger accounts (id = cuid() non déterministe -> utiliser gen_random_uuid()/md5 hash simple surrogate)
-- On utilise md5(code||'global') pour id stable texte
INSERT INTO "ledger_accounts" (id, "propertyId", code, label, kind, "isEditable") VALUES
 (md5('706' || 'global'), NULL, '706', 'Prestations de services', 'REVENUE', false),
 (md5('7061'|| 'global'), NULL, '7061', 'Loyers / nuitées', 'REVENUE', false),
 (md5('7068'|| 'global'), NULL, '7068', 'Autres produits d’exploitation', 'REVENUE', false),
 (md5('606' || 'global'), NULL, '606', 'Achats non stockés', 'EXPENSE', false),
 (md5('6063'|| 'global'), NULL, '6063', 'Fournitures / petit équipement', 'EXPENSE', false),
 (md5('6068'|| 'global'), NULL, '6068', 'Autres matières et fournitures', 'EXPENSE', false),
 (md5('6135'|| 'global'), NULL, '6135', 'Locations mobilières', 'EXPENSE', false),
 (md5('615' || 'global'), NULL, '615', 'Entretien et réparations', 'EXPENSE', false),
 (md5('616' || 'global'), NULL, '616', 'Primes d’assurances', 'EXPENSE', false),
 (md5('621' || 'global'), NULL, '621', 'Personnel extérieur', 'EXPENSE', false),
 (md5('622' || 'global'), NULL, '622', 'Honoraires', 'EXPENSE', false),
 (md5('623' || 'global'), NULL, '623', 'Publicité / annonces', 'EXPENSE', false),
 (md5('625' || 'global'), NULL, '625', 'Déplacements, missions, réceptions', 'EXPENSE', false),
 (md5('626' || 'global'), NULL, '626', 'Frais postaux et télécommunications', 'EXPENSE', false),
 (md5('627' || 'global'), NULL, '627', 'Services bancaires et assimilés', 'EXPENSE', false),
 (md5('628' || 'global'), NULL, '628', 'Charges diverses', 'EXPENSE', false),
 (md5('635' || 'global'), NULL, '635', 'Impôts et taxes', 'TAX', false),
 (md5('63512'|| 'global'), NULL, '63512', 'Taxe foncière', 'TAX', false),
 (md5('63513'|| 'global'), NULL, '63513', 'CFE', 'TAX', false),
 (md5('213' || 'global'), NULL, '213', 'Constructions (mobile-home)', 'ASSET', false),
 (md5('2135'|| 'global'), NULL, '2135', 'Agencements / aménagements de constructions', 'ASSET', false),
 (md5('2181'|| 'global'), NULL, '2181', 'Installations générales & agencements', 'ASSET', false),
 (md5('2183'|| 'global'), NULL, '2183', 'Matériel de bureau & informatique', 'ASSET', false),
 (md5('2184'|| 'global'), NULL, '2184', 'Mobilier', 'ASSET', false),
 (md5('2188'|| 'global'), NULL, '2188', 'Autres immobilisations corporelles', 'ASSET', false),
 (md5('2813'|| 'global'), NULL, '2813', 'Amortissements des constructions', 'ASSET', false),
 (md5('28181'|| 'global'), NULL, '28181', 'Amortissements des installations & agencements', 'ASSET', false),
 (md5('28183'|| 'global'), NULL, '28183', 'Amortissements du matériel informatique', 'ASSET', false),
 (md5('28184'|| 'global'), NULL, '28184', 'Amortissements du mobilier', 'ASSET', false),
 (md5('28188'|| 'global'), NULL, '28188', 'Amortissements autres immobilisations', 'ASSET', false),
 (md5('401' || 'global'), NULL, '401', 'Fournisseurs', 'LIABILITY', false),
 (md5('411' || 'global'), NULL, '411', 'Clients', 'ASSET', false),
 (md5('512' || 'global'), NULL, '512', 'Banque', 'TREASURY', false),
 (md5('53'  || 'global'), NULL, '53', 'Caisse', 'TREASURY', false),
 (md5('165' || 'global'), NULL, '165', 'Dépôts et cautionnements reçus', 'LIABILITY', false),
 (md5('44566'|| 'global'), NULL, '44566', 'TVA déductible sur autres biens et services', 'TAX', false),
 (md5('44571'|| 'global'), NULL, '44571', 'TVA collectée', 'TAX', false),
 (md5('44551'|| 'global'), NULL, '44551', 'TVA à décaisser', 'TAX', false)
ON CONFLICT DO NOTHING;
