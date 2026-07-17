-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "invoiceSequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "tenantId" TEXT,
ADD COLUMN     "shopId" TEXT;

-- Backfill existing invoices from their related repair rows
UPDATE "Invoice" i
SET "tenantId" = r."tenantId",
    "shopId" = r."shopId"
FROM "Repair" r
WHERE i."repairId" = r."id";

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "tenantId" SET NOT NULL,
ALTER COLUMN "shopId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_shopId_idx" ON "Invoice"("shopId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;