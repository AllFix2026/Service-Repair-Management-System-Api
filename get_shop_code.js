const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shops = await prisma.shop.findMany({
    select: {
      id: true,
      shopCode: true,
      name: true,
      email: true
    }
  });
  console.log('SHOPS_LIST:', JSON.stringify(shops, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
