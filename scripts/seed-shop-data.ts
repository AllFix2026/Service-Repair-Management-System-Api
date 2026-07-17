import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { prisma } from "../db/prisma";

async function main() {
  // Get email from command line arguments
  const email = process.argv[2];

  if (!email) {
    console.error("Please provide the shop owner's email address.");
    console.error("Usage: npx ts-node scripts/seed-shop-data.ts <email>");
    process.exit(1);
  }

  console.log(`Looking up shop for user: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { shop: true },
  });

  if (!user || !user.shopId) {
    console.error("User not found or does not belong to a shop.");
    process.exit(1);
  }

  const { tenantId, shopId } = user;
  console.log(`Found shop: ${user.shop?.name} (ID: ${shopId})`);
  console.log("Seeding 1 month of mock data...");

  // Generate 10 Customers
  const customers = [];
  for (let i = 0; i < 10; i++) {
    customers.push(
      await prisma.customer.create({
        data: {
          tenantId,
          shopId,
          name: `Mock Customer ${i + 1}`,
          phone: `+9477000${i}000`,
        },
      })
    );
  }
  console.log(`Created ${customers.length} customers.`);

  // Generate 10 Devices
  const devices = [];
  for (let i = 0; i < customers.length; i++) {
    devices.push(
      await prisma.device.create({
        data: {
          tenantId,
          shopId,
          customerId: customers[i].id,
          brand: i % 2 === 0 ? "Apple" : "Samsung",
          model: i % 2 === 0 ? "iPhone 13" : "Galaxy S21",
        },
      })
    );
  }
  console.log(`Created ${devices.length} devices.`);

  // Find all technicians for this shop
  const technicians = await prisma.user.findMany({
    where: { tenantId, shopId, role: "TECHNICIAN" },
  });

  const statuses: ("NOT_STARTED" | "IN_PROGRESS" | "READY_TO_TAKE" | "DELIVERED")[] = [
    "NOT_STARTED",
    "IN_PROGRESS",
    "READY_TO_TAKE",
    "DELIVERED",
  ];

  let now = new Date();

  let repairCount = 0;
  let paymentCount = 0;
  let appointmentCount = 0;

  for (let i = 0; i < 30; i++) {
    // Random date within the last 30 days
    const pastDate = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const customer = customers[i % customers.length];
    const device = devices[i % devices.length];
    const tech = technicians.length > 0 ? technicians[i % technicians.length] : undefined;
    const status = statuses[i % statuses.length];

    const refNum = Math.floor(100000 + Math.random() * 900000);

    const repair = await prisma.repair.create({
      data: {
        tenantId,
        shopId,
        customerId: customer.id,
        deviceId: device.id,
        reference: `#REP-MOCK-${refNum}`,
        status: status,
        issue: "Mock seeded issue - screen replacement",
        estimatedCost: 5000 + Math.floor(Math.random() * 5000),
        technicianId: tech?.id,
        createdAt: pastDate,
        updatedAt: pastDate,
      },
    });
    repairCount++;

    if (status !== "NOT_STARTED") {
      await (prisma as any).appointment.create({
        data: {
          tenantId,
          shopId,
          customerId: customer.id,
          technicianId: tech?.id,
          repairId: repair.id,
          scheduledAt: pastDate,
          duration: 60,
        },
      });
      appointmentCount++;
    }

    if (status === "DELIVERED" || status === "READY_TO_TAKE") {
      await (prisma as any).payment.create({
        data: {
          tenantId,
          shopId,
          repairId: repair.id,
          customerId: customer.id,
          paymentMethod: "CASH",
          paymentType: "FULL",
          amount: repair.estimatedCost || 0,
          status: "COMPLETED",
          paymentDate: pastDate,
        },
      });
      paymentCount++;
    }
  }

  console.log(`Created ${repairCount} repairs.`);
  console.log(`Created ${appointmentCount} appointments.`);
  console.log(`Created ${paymentCount} payments.`);
  console.log("Seeding complete! Enjoy your populated dashboard.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
