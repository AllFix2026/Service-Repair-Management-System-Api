import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const userEmail = 'suresh.20232859@iit.ac.lk';
  console.log(`[Seed] Finding user: ${userEmail}...`);

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user || !user.tenantId || !user.shopId) {
    console.error(`[Seed] User not found or missing tenantId/shopId. Please login first.`);
    return;
  }

  const tenantId = user.tenantId;
  const shopId = user.shopId;

  console.log(`[Seed] Found Tenant: ${tenantId}, Shop: ${shopId}`);
  console.log(`[Seed] Generating 1 month of dashboard data...`);

  // Clear existing dummy data for this tenant (optional, but safe for repairs/customers)
  await prisma.repair.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  // We'll leave technicians if they exist, or create some.
  await prisma.user.deleteMany({ where: { tenantId, role: 'TECHNICIAN' } });

  // 1. Create Technicians
  const techs = [];
  for (let i = 1; i <= 3; i++) {
    const tech = await prisma.user.create({
      data: {
        tenantId,
        shopId,
        email: `tech${i}@srm.com`,
        password: await bcrypt.hash('password123', 10),
        fullName: `Technician ${i}`,
        role: 'TECHNICIAN',
        isActive: true,
      },
    });
    techs.push(tech);
  }
  console.log(`[Seed] Created ${techs.length} Technicians.`);

  // 2. Create Customers
  const customers = [];
  for (let i = 1; i <= 10; i++) {
    const cust = await prisma.customer.create({
      data: {
        tenantId,
        shopId,
        name: `Customer ${i}`,
        email: `customer${i}@example.com`,
        phone: `+9470123456${i}`,
      },
    });
    customers.push(cust);
  }
  console.log(`[Seed] Created ${customers.length} Customers.`);

  // 3. Create Repairs (Spread over last 30 days)
  const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  let totalRevenue = 0;

  for (let i = 1; i <= 50; i++) {
    // Random date within last 30 days
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));

    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const price = Math.floor(Math.random() * 15000) + 1000; // 1000 to 16000 LKR
    
    if (status === 'COMPLETED') totalRevenue += price;

    await prisma.repair.create({
      data: {
        tenantId,
        shopId,
        customerId: customers[Math.floor(Math.random() * customers.length)].id,
        technicianId: techs[Math.floor(Math.random() * techs.length)].id,
        deviceType: ['Mobile', 'Laptop', 'Tablet', 'Console'][Math.floor(Math.random() * 4)],
        deviceBrand: ['Apple', 'Samsung', 'Dell', 'Sony'][Math.floor(Math.random() * 4)],
        deviceModel: `Model X-${Math.floor(Math.random() * 100)}`,
        issueDescription: `Screen cracked or battery issue #${i}`,
        status,
        estimatedCost: price,
        createdAt: date,
        updatedAt: date,
      },
    });
  }

  console.log(`[Seed] Created 50 Repairs (Total Revenue: LKR ${totalRevenue}).`);
  console.log(`[Seed] ✅ Dashboard Data Seeding Complete!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
