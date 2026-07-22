const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const partsUsed = await prisma.repairPartsUsed.findMany();
  console.log("Total RepairPartsUsed records:", partsUsed.length);
  if (partsUsed.length > 0) {
    console.log("Sample:", partsUsed[0]);
  }
  
  const repairs = await prisma.repair.findMany({ include: { repairPartsUsed: true } });
  console.log("Total repairs:", repairs.length);
  const withParts = repairs.filter(r => r.repairPartsUsed.length > 0);
  console.log("Repairs with parts:", withParts.length);
  
  process.exit(0);
}
check();
