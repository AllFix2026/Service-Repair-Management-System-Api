const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const deleted = await prisma.user.deleteMany({
      where: {
        fullName: 'Thivyanath Maheswaran',
        email: null
      }
    });
    console.log('Successfully deleted temporary staff accounts:', deleted);
  } catch (error) {
    console.error('Error deleting staff account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
