const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  try {
    const updated = await prisma.user.updateMany({
      where: {
        fullName: 'Thivyanath Maheswaran',
        email: null
      },
      data: {
        email: 'thivyanathmahes@gmail.com'
      }
    });
    console.log('Successfully updated staff email address:', updated);
  } catch (error) {
    console.error('Error updating staff email:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
