import { prisma } from "../db/prisma";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  const days = 2; // For Jul 8 - Jul 9
  const rangeDate = new Date();
  rangeDate.setHours(0, 0, 0, 0);
  rangeDate.setDate(rangeDate.getDate() - days);

  console.log("Checking from:", rangeDate.toISOString());

  // 1. Completed payments in this range
  const completedPayments = await prisma.payment.findMany({
    where: {
      status: "COMPLETED",
      paymentDate: { gte: rangeDate }
    },
    select: { id: true, amount: true, paymentDate: true, repairId: true, invoiceId: true }
  });
  console.log("Completed payments:", completedPayments);

  // 2. Active repairs advance payments in this range
  const activeRepairs = await prisma.repair.findMany({
    where: {
      status: { notIn: ["PAID", "DELIVERED"] },
      createdAt: { gte: rangeDate }
    },
    select: { id: true, advancePayment: true, status: true, createdAt: true }
  });
  console.log("Active repairs with advance payments:", activeRepairs);

  // 3. Let's see all repairs created or updated in this range to see if there is any other payment info
  const allRepairs = await prisma.repair.findMany({
    where: {
      createdAt: { gte: rangeDate }
    },
    select: {
      id: true,
      status: true,
      advancePayment: true,
      finalCost: true,
      createdAt: true
    }
  });
  console.log("All repairs in range:", allRepairs);

  // 4. Parts used in these repairs
  const partsUsed = await prisma.repairPartsUsed.findMany({
    select: {
      repairId: true,
      quantityUsed: true,
      unitPrice: true,
      partId: true
    }
  });
  console.log("Parts used details:", partsUsed);
}

run().catch(console.error).finally(() => prisma.$disconnect());
