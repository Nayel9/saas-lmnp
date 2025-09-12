-- AlterTable
ALTER TABLE "public"."Property" ADD COLUMN     "vatEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."assets" ADD COLUMN     "propertyId" TEXT;

-- AlterTable
ALTER TABLE "public"."journal_entries" ADD COLUMN     "amountHT" DECIMAL(12,2),
ADD COLUMN     "amountTTC" DECIMAL(12,2),
ADD COLUMN     "propertyId" TEXT,
ADD COLUMN     "vatAmount" DECIMAL(12,2),
ADD COLUMN     "vatRate" DECIMAL(5,2);

-- CreateIndex
CREATE INDEX "assets_propertyId_idx" ON "public"."assets"("propertyId");

-- CreateIndex
CREATE INDEX "journal_entries_propertyId_idx" ON "public"."journal_entries"("propertyId");

-- AddForeignKey
ALTER TABLE "public"."journal_entries" ADD CONSTRAINT "journal_entries_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assets" ADD CONSTRAINT "assets_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
