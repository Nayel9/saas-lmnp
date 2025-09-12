-- CreateEnum
CREATE TYPE "public"."AssetCategory" AS ENUM ('mobilier', 'batiment', 'vehicule');

-- CreateTable
CREATE TABLE "public"."amortization_defaults" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "category" "public"."AssetCategory" NOT NULL,
    "defaultDurationMonths" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "amortization_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "amortization_defaults_propertyId_category_key" ON "public"."amortization_defaults"("propertyId", "category");

-- AddForeignKey
ALTER TABLE "public"."amortization_defaults" ADD CONSTRAINT "amortization_defaults_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
