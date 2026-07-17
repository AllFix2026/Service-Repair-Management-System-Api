-- CreateEnum (name must match Prisma `enum Priority` default mapping)
CREATE TYPE "Priority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "Repair" ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Repair" ADD COLUMN "estimatedCompletionDate" TIMESTAMP(3);
