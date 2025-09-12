-- AlterTable
ALTER TABLE "public"."journal_entries" ADD COLUMN     "isDeposit" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "journal_entries_user_id_date_isDeposit_idx" ON "public"."journal_entries"("user_id", "date", "isDeposit");
