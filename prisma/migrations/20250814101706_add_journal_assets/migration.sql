-- CreateEnum
CREATE TYPE "public"."JournalEntryType" AS ENUM ('achat', 'vente');

-- CreateTable
CREATE TABLE "public"."journal_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "public"."JournalEntryType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "designation" TEXT NOT NULL,
    "tier" TEXT,
    "account_code" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount_ht" DECIMAL(12,2) NOT NULL,
    "duration_years" INTEGER NOT NULL,
    "acquisition_date" TIMESTAMP(3) NOT NULL,
    "account_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journal_entries_user_id_idx" ON "public"."journal_entries"("user_id");

-- CreateIndex
CREATE INDEX "assets_user_id_idx" ON "public"."assets"("user_id");
