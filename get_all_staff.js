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
    const staff = await prisma.user.findMany({
      where: {
        role: { in: ['TECHNICIAN', 'MANAGER'] }
      },
      include: {
        shop: {
          select: {
            name: true,
            shopCode: true
          }
        }
      }
    });
    
    console.log('--- REGISTERED STAFF ACCOUNTS ---');
    if (staff.length === 0) {
      console.log('No staff accounts found.');
    } else {
      staff.forEach((u, i) => {
        console.log(`[Staff #${i + 1}]`);
        console.log(`  Name:      ${u.fullName || u.name || 'N/A'}`);
        console.log(`  Email:     ${u.email || 'N/A (Null)'}`);
        console.log(`  Phone:     ${u.phone || 'N/A'}`);
        console.log(`  Role:      ${u.role}`);
        console.log(`  Shop:      ${u.shop ? `${u.shop.name} (${u.shop.shopCode})` : 'N/A'}`);
        console.log(`  Active:    ${u.isActive}`);
        console.log('--------------------------------');
      });
    }
  } catch (error) {
    console.error('Error fetching staff:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
