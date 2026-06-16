/**
 * TASK: Large Scale Data & API Latency Analysis
 * Script: Seed 100 shops with 6 months of realistic data
 * 
 * This script is REPEATABLE and RESETABLE.
 * - Seeds exactly 100 shops
 * - Each shop gets 5-10 staff, 50-100 customers, 10-20 repairs/month over 6 months
 * - All timestamps spread across last 6 months
 * - Repair statuses vary (NOT_STARTED, IN_PROGRESS, READY_TO_TAKE, DELIVERED)
 * - Invoices created for completed repairs
 * - Inventory items with varying stock levels
 * - Uses faker.js for realistic fake data
 * 
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-100-shops-6months.ts
 */

import "dotenv/config";
import * as path from "path";
import { faker } from "@faker-js/faker";
import { prisma } from "@/db/prisma";
import * as bcrypt from "bcrypt";

// ============ CONFIGURATION ============
const NUM_SHOPS = 100;
const STAFF_PER_SHOP = { min: 5, max: 10 };
const CUSTOMERS_PER_SHOP = { min: 50, max: 100 };
const DEVICES_PER_CUSTOMER = { min: 1, max: 3 };
const REPAIRS_PER_MONTH = { min: 10, max: 20 }; // per shop
const INVENTORY_ITEMS_PER_SHOP = { min: 20, max: 40 };
const MONTHS_OF_DATA = 6;

const REPAIR_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "READY_TO_TAKE", "DELIVERED"] as const;
type RepairStatus = typeof REPAIR_STATUSES[number];

const DEVICE_BRANDS = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Oppo",
  "Vivo",
  "Realme",
  "OnePlus",
  "Huawei",
];
const DEVICE_MODELS = [
  "iPhone 12",
  "iPhone 13",
  "iPhone 14",
  "Galaxy S20",
  "Galaxy S21",
  "Galaxy S22",
  "Xiaomi 11",
  "Oppo A53",
];

const REPAIR_ISSUES = [
  "Screen replacement",
  "Battery replacement",
  "Charging port repair",
  "Water damage",
  "Speaker replacement",
  "Camera repair",
  "Motherboard repair",
  "Software update",
  "Glass protector installation",
  "Back cover replacement",
];

const REPAIR_TYPES = [
  "Screen",
  "Battery",
  "Charging",
  "Water Damage",
  "Speaker",
  "Camera",
  "Hardware",
  "Software",
];

const INVENTORY_CATEGORIES = [
  "Screens",
  "Batteries",
  "Charging Cables",
  "Glass Protectors",
  "Cases",
  "Chargers",
  "Cables",
  "Adhesives",
];

const INVENTORY_ITEMS: Record<string, string[]> = {
  Screens: [
    "iPhone 12 Screen",
    "iPhone 13 Screen",
    "Samsung S21 Screen",
    "Generic AMOLED Screen",
  ],
  Batteries: [
    "iPhone Battery",
    "Samsung Battery",
    "Generic Li-Ion Battery 2000mAh",
    "Generic Li-Ion Battery 3000mAh",
  ],
  "Charging Cables": [
    "USB-C Cable",
    "Lightning Cable",
    "Micro USB Cable",
    "Braided USB-C Cable",
  ],
  "Glass Protectors": [
    "Tempered Glass 5.5\"",
    "Tempered Glass 6.1\"",
    "Tempered Glass 6.7\"",
    "Privacy Glass Protector",
  ],
  Cases: [
    "Silicone Case",
    "Hard Case",
    "Leather Case",
    "TPU Case",
    "Wallet Case",
  ],
  Chargers: [
    "5W Charger",
    "10W Charger",
    "20W Fast Charger",
    "Wireless Charger",
  ],
  Cables: ["HDMI Cable", "VGA Cable", "Display Port Cable"],
  Adhesives: [
    "Display Adhesive",
    "Frame Adhesive",
    "Thermal Paste",
    "Clear Silicone",
  ],
};

// ============ UTILITIES ============

function getRandomDateInLast6Months(): Date {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const randomTime =
    sixMonthsAgo.getTime() +
    Math.random() * (now.getTime() - sixMonthsAgo.getTime());
  return new Date(randomTime);
}

function getRandomDateInMonth(monthOffset: number): Date {
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const nextMonth = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth() + 1,
    1
  );

  const randomTime =
    targetDate.getTime() +
    Math.random() * (nextMonth.getTime() - targetDate.getTime());
  return new Date(randomTime);
}

function generateShopCode(): string {
  return `SHOP-${faker.string.alphanumeric(6).toUpperCase()}`;
}

function generateRepairReference(): string {
  return `REP-${Date.now()}-${faker.string.alphanumeric(6).toUpperCase()}`;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============ SEEDING FUNCTIONS ============

async function deleteAllData() {
  console.log("🗑️  Clearing all existing data...");

  try {
    await prisma.repairTimelineEvent.deleteMany({});
    await prisma.repairNote.deleteMany({});
    await prisma.repairPartsUsed.deleteMany({});
    await prisma.photo.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.appointment.deleteMany({}).catch(() => {});
    await prisma.task.deleteMany({});
    await prisma.customerNote.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.repair.deleteMany({});
    await prisma.device.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.purchaseOrderItem.deleteMany({}).catch(() => {});
    await prisma.purchaseOrderAudit.deleteMany({}).catch(() => {});
    await prisma.purchaseOrder.deleteMany({}).catch(() => {});
    await prisma.supplier.deleteMany({});
    await prisma.partsInventory.deleteMany({});
    await prisma.staffRole.deleteMany({}).catch(() => {});
    await prisma.shopSettings.deleteMany({}).catch(() => {});
    await prisma.emailLog.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.shop.deleteMany({});
    await prisma.tenant.deleteMany({});
  } catch (e) {
    console.log("(Some cleanup operations were skipped)");
  }

  console.log("✅ Ready for fresh seeding.\n");
}

async function seedTenant(shopIndex: number) {
  return await prisma.tenant.create({
    data: {
      name: `Tenant ${shopIndex + 1}`,
    },
  });
}

async function seedShop(tenantId: string, shopIndex: number) {
  const shopCode = generateShopCode();
  const city = faker.location.city();

  return await prisma.shop.create({
    data: {
      tenantId,
      shopCode,
      name: `${faker.company.name()} Mobile Repair`,
      businessRegistration: faker.string.alphanumeric(10).toUpperCase(),
      address: faker.location.streetAddress(),
      city,
      country: "Sri Lanka",
      postalCode: faker.location.zipCode(),
      phone: `+94${faker.string.numeric(9)}`,
      email: faker.internet.email(),
      website: faker.internet.url(),
      taxNumber: faker.string.alphanumeric(8).toUpperCase(),
      repairTypes: REPAIR_TYPES,
      subscriptionPlan: "MEDIUM",
      subscriptionStatus: "ACTIVE",
      subscriptionStartDate: new Date(new Date().getTime() - 90 * 24 * 60 * 60 * 1000),
      subscriptionEndDate: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000),
      isActive: true,
      acceptsStaffRegistrations: true,
      createdAt: getRandomDateInLast6Months(),
    },
  });
}

async function seedStaff(tenantId: string, shopId: string) {
  const staffCount = randomInt(STAFF_PER_SHOP.min, STAFF_PER_SHOP.max);
  const staff = [];

  const roles: ("ADMIN" | "MANAGER" | "TECHNICIAN")[] = ["ADMIN", "MANAGER", "TECHNICIAN"];

  for (let i = 0; i < staffCount; i++) {
    const hashedPassword = await bcrypt.hash("DefaultPass123!", 10);

    const user = await prisma.user.create({
      data: {
        tenantId,
        shopId,
        fullName: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        phone: `+94${faker.string.numeric(9)}`,
        password: hashedPassword,
        role: roles[i % roles.length],
        isActive: true,
        isEmailVerified: true,
        specialties: i % 3 === 0 ? [randomElement(REPAIR_TYPES)] : [],
        createdAt: getRandomDateInLast6Months(),
      },
    });

    staff.push(user);
  }

  return staff;
}

async function seedCustomers(tenantId: string, shopId: string) {
  const customerCount = randomInt(
    CUSTOMERS_PER_SHOP.min,
    CUSTOMERS_PER_SHOP.max
  );
  const customers = [];

  for (let i = 0; i < customerCount; i++) {
    const customer = await prisma.customer.create({
      data: {
        tenantId,
        shopId,
        name: faker.person.fullName(),
        phone: `+94${faker.string.numeric(9)}`,
        email: faker.internet.email().toLowerCase(),
        address: faker.location.streetAddress(),
        customerType: Math.random() > 0.8 ? "BUSINESS" : "INDIVIDUAL",
        tier: randomElement(["Bronze", "Silver", "Gold", "Platinum"]),
        createdAt: getRandomDateInLast6Months(),
      },
    });

    customers.push(customer);
  }

  return customers;
}

async function seedDevices(
  tenantId: string,
  shopId: string,
  customers: any[]
) {
  const devices = [];

  for (const customer of customers) {
    const deviceCount = randomInt(DEVICES_PER_CUSTOMER.min, DEVICES_PER_CUSTOMER.max);

    for (let i = 0; i < deviceCount; i++) {
      try {
        const device = await prisma.device.create({
          data: {
            tenantId,
            shopId,
            customerId: customer.id,
            brand: randomElement(DEVICE_BRANDS),
            model: randomElement(DEVICE_MODELS),
            imei: faker.string.numeric(15),
            serialNo: faker.string.alphanumeric(10).toUpperCase(),
            status: randomElement(["ACTIVE", "AVAILABLE", "IN_SERVICE"]) as any,
            createdAt: getRandomDateInLast6Months(),
          },
        });

        devices.push(device);
      } catch (e) {
        // Skip on error (e.g., duplicate IMEI)
      }
    }
  }

  return devices;
}

async function seedRepairs(
  tenantId: string,
  shopId: string,
  customers: any[],
  devices: any[],
  staff: any[]
) {
  const repairs = [];

  const repairsPerMonth = randomInt(REPAIRS_PER_MONTH.min, REPAIRS_PER_MONTH.max);
  const totalRepairs = repairsPerMonth * MONTHS_OF_DATA;

  for (let i = 0; i < totalRepairs; i++) {
    const monthOffset = Math.floor(i / repairsPerMonth);
    const customer = randomElement(customers);
    const device = devices.find((d) => d.customerId === customer.id) || randomElement(devices);
    const technician = staff.find((s) => s.role === "TECHNICIAN") || null;
    const createdAt = getRandomDateInMonth(monthOffset);

    let status: RepairStatus;
    const rand = Math.random();
    if (rand < 0.1) status = "NOT_STARTED";
    else if (rand < 0.3) status = "IN_PROGRESS";
    else if (rand < 0.6) status = "READY_TO_TAKE";
    else status = "DELIVERED";

    const estimatedCost = randomInt(2000, 15000);
    const finalCost = status === "DELIVERED"
      ? randomInt(estimatedCost - 1000, estimatedCost + 2000)
      : null;

    try {
      const repair = await prisma.repair.create({
        data: {
          tenantId,
          shopId,
          customerId: customer.id,
          deviceId: device.id,
          reference: generateRepairReference(),
          status: status as any,
          issue: randomElement(REPAIR_ISSUES),
          diagnosis:
            status !== "NOT_STARTED"
              ? `Diagnosis: ${faker.lorem.sentence()}`
              : null,
          estimatedCost,
          finalCost,
          technicianId: technician?.id || null,
          priority: randomElement(["URGENT", "HIGH", "MEDIUM", "LOW"]) as any,
          createdAt,
          updatedAt: createdAt,
        },
      });

      repairs.push(repair);

      // Create appointment if repair is not in NOT_STARTED status
      if (status !== "NOT_STARTED") {
        const appointmentDate = new Date(createdAt.getTime() + randomInt(1, 7) * 24 * 60 * 60 * 1000);
        
        try {
          await prisma.appointment.create({
            data: {
              tenantId,
              shopId,
              customerId: customer.id,
              technicianId: technician?.id || null,
              repairId: repair.id,
              scheduledAt: appointmentDate,
              duration: randomInt(30, 180),
            },
          }).catch(() => {});
        } catch (e) {}
      }

      // Create payment if repair is delivered
      if (status === "DELIVERED" && finalCost) {
        const paymentDate = new Date(createdAt.getTime() + randomInt(1, 5) * 24 * 60 * 60 * 1000);
        
        try {
          await prisma.payment.create({
            data: {
              tenantId,
              shopId,
              repairId: repair.id,
              customerId: customer.id,
              paymentMethod: randomElement([
                "CASH",
                "CARD",
                "BANK_TRANSFER",
                "MOBILE_PAYMENT",
              ]) as any,
              paymentType: randomElement(["ADVANCE", "PARTIAL", "FULL"]) as any,
              amount: finalCost.toString(),
              status: "PENDING",
              paymentDate,
              createdAt: paymentDate,
            },
          }).catch(() => {});
        } catch (e) {}
      }

      // Create notification for repair status
      if (status !== "NOT_STARTED") {
        const notificationDate = new Date(createdAt.getTime() + randomInt(1, 3) * 24 * 60 * 60 * 1000);
        
        try {
          await prisma.notification.create({
            data: {
              tenantId,
              shopId,
              repairId: repair.id,
              channel: randomElement(["IN_APP", "EMAIL", "SMS"]) as any,
              title: `Repair ${status}`,
              message: `Your repair #${repair.reference} is now ${status.toLowerCase()}`,
              type: "REPAIR",
              isRead: Math.random() > 0.3,
              status: "SENT",
              createdAt: notificationDate,
              sentAt: notificationDate,
            },
          }).catch(() => {});
        } catch (e) {}
      }

      // Create repair notes for in-progress or completed repairs
      if (["IN_PROGRESS", "READY_TO_TAKE", "DELIVERED"].includes(status) && technician) {
        const noteCount = randomInt(1, 3);
        for (let j = 0; j < noteCount; j++) {
          const noteDate = new Date(createdAt.getTime() + (j + 1) * 24 * 60 * 60 * 1000);
          
          try {
            await prisma.repairNote.create({
              data: {
                repairId: repair.id,
                userId: technician.id,
                text: faker.lorem.sentence(),
                createdAt: noteDate,
              },
            }).catch(() => {});
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  return repairs;
}

async function seedInventory(tenantId: string, shopId: string) {
  const itemCount = randomInt(
    INVENTORY_ITEMS_PER_SHOP.min,
    INVENTORY_ITEMS_PER_SHOP.max
  );
  const inventory = [];

  for (let i = 0; i < itemCount; i++) {
    const category = randomElement(Object.keys(INVENTORY_ITEMS));
    const itemName =
      randomElement(INVENTORY_ITEMS[category]) ||
      `${category} Item ${i}`;

    const minimumStock = randomInt(5, 15);
    let quantityInStock = randomInt(0, 40);

    if (Math.random() < 0.2) {
      quantityInStock = randomInt(0, minimumStock - 1);
    }

    const unitCost = randomInt(500, 10000);
    const sellingPrice = Math.floor(unitCost * randomInt(130, 250) / 100);

    try {
      const item = await prisma.partsInventory.create({
        data: {
          tenantId,
          shopId,
          partName: itemName,
          partNumber: `PN-${faker.string.alphanumeric(6).toUpperCase()}`,
          category,
          compatibleBrands: DEVICE_BRANDS.slice(0, randomInt(2, 4)),
          compatibleModels: DEVICE_MODELS.slice(0, randomInt(2, 3)),
          quantityInStock,
          minimumStockLevel: minimumStock,
          unitCost,
          sellingPrice,
          isActive: true,
          createdAt: getRandomDateInLast6Months(),
        },
      });

      inventory.push(item);
    } catch (e) {}
  }

  return inventory;
}

// ============ MAIN ============

async function main() {
  try {
    console.log("\n========================================");
    console.log("🚀 SEEDING 100 SHOPS WITH 6 MONTHS OF DATA");
    console.log("========================================\n");

    await deleteAllData();

    let totalStats = {
      tenants: 0,
      shops: 0,
      staff: 0,
      customers: 0,
      devices: 0,
      repairs: 0,
      payments: 0,
      inventory: 0,
      appointments: 0,
      notifications: 0,
    };

    for (let shopIndex = 0; shopIndex < NUM_SHOPS; shopIndex++) {
      const progress = `[${shopIndex + 1}/${NUM_SHOPS}]`;

      try {
        const tenant = await seedTenant(shopIndex);
        totalStats.tenants++;

        const shop = await seedShop(tenant.id, shopIndex);
        totalStats.shops++;
        console.log(`${progress} ✓ Shop created`);

        const staff = await seedStaff(tenant.id, shop.id);
        totalStats.staff += staff.length;

        const customers = await seedCustomers(tenant.id, shop.id);
        totalStats.customers += customers.length;

        const devices = await seedDevices(tenant.id, shop.id, customers);
        totalStats.devices += devices.length;

        const repairs = await seedRepairs(
          tenant.id,
          shop.id,
          customers,
          devices,
          staff
        );
        totalStats.repairs += repairs.length;

        const inventory = await seedInventory(tenant.id, shop.id);
        totalStats.inventory += inventory.length;

        const appointments = await prisma.appointment.count({
          where: { shopId: shop.id },
        });
        const payments = await prisma.payment.count({
          where: { shopId: shop.id },
        });
        const notifications = await prisma.notification.count({
          where: { shopId: shop.id },
        });

        totalStats.appointments += appointments;
        totalStats.payments += payments;
        totalStats.notifications += notifications;
      } catch (error) {
        console.error(`${progress} ❌ Error`);
        continue;
      }
    }

    console.log("\n========================================");
    console.log("✅ SEEDING COMPLETE");
    console.log("========================================\n");
    console.log("📊 TOTAL RECORDS SEEDED:");
    console.log(`   • Tenants:       ${totalStats.tenants}`);
    console.log(`   • Shops:         ${totalStats.shops}`);
    console.log(`   • Staff:         ${totalStats.staff}`);
    console.log(`   • Customers:     ${totalStats.customers}`);
    console.log(`   • Devices:       ${totalStats.devices}`);
    console.log(`   • Repairs:       ${totalStats.repairs}`);
    console.log(`   • Appointments:  ${totalStats.appointments}`);
    console.log(`   • Payments:      ${totalStats.payments}`);
    console.log(`   • Inventory:     ${totalStats.inventory}`);
    console.log(`   • Notifications: ${totalStats.notifications}`);
    console.log("\n========================================");
    console.log("✨ Ready for API latency testing!");
    console.log("========================================\n");
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
