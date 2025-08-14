-- CreateTable
CREATE TABLE "public"."Property" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Income" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "label" TEXT,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Expense" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Amortization" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,

    CONSTRAINT "Amortization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Income_user_id_idx" ON "public"."Income"("user_id");

-- CreateIndex
CREATE INDEX "Income_propertyId_idx" ON "public"."Income"("propertyId");

-- CreateIndex
CREATE INDEX "Expense_user_id_idx" ON "public"."Expense"("user_id");

-- CreateIndex
CREATE INDEX "Expense_propertyId_idx" ON "public"."Expense"("propertyId");

-- CreateIndex
CREATE INDEX "Amortization_user_id_idx" ON "public"."Amortization"("user_id");

-- CreateIndex
CREATE INDEX "Amortization_propertyId_idx" ON "public"."Amortization"("propertyId");

-- AddForeignKey
ALTER TABLE "public"."Income" ADD CONSTRAINT "Income_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Amortization" ADD CONSTRAINT "Amortization_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
