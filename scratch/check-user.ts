import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'suresh.20232859@iit.ac.lk' },
    select: { id: true, email: true, shopId: true, role: true }
  });
  console.log('USER_CHECK_RESULT:', JSON.stringify(user, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
