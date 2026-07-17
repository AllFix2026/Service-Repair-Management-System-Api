-- AlterTable
ALTER TABLE "User" ADD COLUMN "name" TEXT;
ALTER TABLE "User" ADD COLUMN "staffDisplayId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_staffDisplayId_key" ON "User"("tenantId", "staffDisplayId");
