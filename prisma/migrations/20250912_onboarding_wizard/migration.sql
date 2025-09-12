-- Migration ajout wizard 3 étapes
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "iban" TEXT;
DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING','PAID','CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

