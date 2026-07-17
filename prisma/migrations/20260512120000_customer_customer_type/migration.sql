-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "customerType" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL';
