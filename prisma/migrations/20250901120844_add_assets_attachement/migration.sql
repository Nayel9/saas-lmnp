-- AlterTable
ALTER TABLE "public"."attachments" ADD COLUMN     "assetId" TEXT,
ALTER COLUMN "entryId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "attachments_assetId_idx" ON "public"."attachments"("assetId");

-- AddForeignKey
ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
