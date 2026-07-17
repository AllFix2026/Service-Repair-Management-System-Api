import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { prisma } from "../db/prisma";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 12;

// ─── Real Sri Lankan Names & Data ────────────────────────────────────────────
const CUSTOMERS = [
  { name: "Kasun Perera",        phone: "+94771234501" },
  { name: "Nimali Silva",         phone: "+94771234502" },
  { name: "Tharindu Fernando",   phone: "+94771234503" },
  { name: "Sanduni Jayawardena", phone: "+94771234504" },
  { name: "Ruwan Gunaratne",     phone: "+94771234505" },
  { name: "Dilini Rajapaksa",    phone: "+94771234506" },
  { name: "Chamara Dissanayake", phone: "+94771234507" },
  { name: "Malsha Wickramasinghe",phone: "+94771234508" },
  { name: "Pradeep Kumara",      phone: "+94771234509" },
  { name: "Hiruni Bandara",      phone: "+94771234510" },
];

const TECHNICIANS = [
  { name: "Amara Pathirana",  email: "amara.tech@servicepro.lk",   password: "Tech@2024!" },
  { name: "Saman Rathnayake", email: "saman.tech@servicepro.lk",   password: "Tech@2024!" },
  { name: "Lakmal Wijesinghe",email: "lakmal.tech@servicepro.lk",  password: "Tech@2024!" },
];

const DEVICES = [
  { brand: "Apple",   model: "iPhone 14 Pro",    type: "PHONE"  },
  { brand: "Samsung", model: "Galaxy S23 Ultra",  type: "PHONE"  },
  { brand: "Apple",   model: "MacBook Pro M2",    type: "LAPTOP" },
  { brand: "HP",      model: "Pavilion 15",        type: "LAPTOP" },
  { brand: "Apple",   model: "iPad Pro 12.9",      type: "TABLET" },
  { brand: "Samsung", model: "Galaxy A54",         type: "PHONE"  },
  { brand: "Lenovo",  model: "IdeaPad 5",          type: "LAPTOP" },
  { brand: "Apple",   model: "iPhone 13",          type: "PHONE"  },
  { brand: "OnePlus", model: "Nord 3",             type: "PHONE"  },
  { brand: "Dell",    model: "Inspiron 15",        type: "LAPTOP" },
];

const ISSUES = [
  "Cracked screen – needs full display replacement",
  "Battery draining rapidly – replace battery",
  "Charging port damaged – won't charge",
  "Keyboard keys not responding – needs cleaning and replacement",
  "Water damage – full diagnostic and repair",
  "Camera module faulty – blurry images",
  "Speaker not working – audio module replacement",
  "Touchscreen unresponsive after drop",
  "Overheating during normal use",
  "SIM card not detected – motherboard issue",
];

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: npx ts-node scripts/seed-real-data.ts <admin-email>");
    process.exit(1);
  }

  console.log(`\n🔍 Looking up shop for: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { shop: true },
  });

  if (!user || !user.shopId) {
    console.error("❌ User not found or not linked to a shop.");
    process.exit(1);
  }

  const { tenantId, shopId } = user;
  console.log(`✅ Shop: "${user.shop?.name}" (shopId: ${shopId})\n`);

  // ── 0. Clear existing data for this shop ───────────────────────────────────
  console.log("🗑  Clearing old data for this shop...");
  await prisma.repair.deleteMany({ where: { shopId } });
  await prisma.device.deleteMany({ where: { shopId } });
  await prisma.customer.deleteMany({ where: { shopId } });
  console.log("   ✅ Database cleared for shop.");

  // ── 1. Seed Customers ──────────────────────────────────────────────────────
  console.log("\n👥 Creating customers...");
  const createdCustomers = [];
  for (const c of CUSTOMERS) {
    const existing = await prisma.customer.findFirst({
      where: { tenantId, shopId, phone: c.phone },
    });
    if (existing) {
      createdCustomers.push(existing);
      console.log(`   ⏭  Skipped (exists): ${c.name}`);
    } else {
      const created = await prisma.customer.create({
        data: { tenantId, shopId, name: c.name, phone: c.phone },
      });
      createdCustomers.push(created);
      console.log(`   ✅ Created: ${c.name}`);
    }
  }

  // ── 2. Seed Devices (one per customer) ────────────────────────────────────
  console.log("\n📱 Creating devices...");
  const createdDevices = [];
  for (let i = 0; i < createdCustomers.length; i++) {
    const customer = createdCustomers[i];
    const deviceTemplate = DEVICES[i % DEVICES.length];
    const existing = await prisma.device.findFirst({
      where: { tenantId, shopId, customerId: customer.id },
    });
    if (existing) {
      createdDevices.push(existing);
      console.log(`   ⏭  Skipped device for: ${customer.name}`);
    } else {
      const device = await prisma.device.create({
        data: {
          tenantId,
          shopId,
          customerId: customer.id,
          brand: deviceTemplate.brand,
          model: deviceTemplate.model,
        },
      });
      createdDevices.push(device);
      console.log(`   ✅ ${deviceTemplate.brand} ${deviceTemplate.model} → ${customer.name}`);
    }
  }

  // ── 3. Seed Technician Accounts ───────────────────────────────────────────
  console.log("\n🔧 Creating technician accounts...");
  const createdTechs = [];
  for (const t of TECHNICIANS) {
    const existing = await prisma.user.findFirst({
      where: { tenantId, shopId, email: t.email },
    });
    if (existing) {
      createdTechs.push(existing);
      console.log(`   ⏭  Skipped (exists): ${t.name} <${t.email}>`);
    } else {
      const hashed = await bcrypt.hash(t.password, BCRYPT_ROUNDS);
      const tech = await prisma.user.create({
        data: {
          tenantId,
          shopId,
          email: t.email,
          password: hashed,
          fullName: t.name,
          name: t.name,
          role: "TECHNICIAN",
          isActive: true,
        } as any,
      });
      createdTechs.push(tech);
      console.log(`   ✅ ${t.name} <${t.email}> — password: ${t.password}`);
    }
  }

  // ── 5. Seed Real Repairs ──────────────────────────────────────────────────

  // ── 5. Seed Real Repairs ──────────────────────────────────────────────────
  console.log("\n🛠  Creating real repairs...");
  const statuses = ["NOT_STARTED", "IN_PROGRESS", "READY_TO_TAKE", "DELIVERED", "NOT_STARTED"] as const;
  let repairCount = 0;

  for (let i = 0; i < 20; i++) {
    const customer = createdCustomers[i % createdCustomers.length];
    const device = createdDevices[i % createdDevices.length];
    const tech = createdTechs.length > 0 ? createdTechs[i % createdTechs.length] : undefined;
    const status = statuses[i % statuses.length];
    const issue = ISSUES[i % ISSUES.length];
    const daysAgo = Math.floor(Math.random() * 30);
    const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const refNum = Math.floor(100000 + Math.random() * 900000);
    const cost = 2500 + Math.floor(Math.random() * 7500);

    await prisma.repair.create({
      data: {
        tenantId,
        shopId,
        customerId: customer.id,
        deviceId: device.id,
        reference: `#REP-${refNum}`,
        status: status as any,
        issue,
        estimatedCost: cost,
        technicianId: tech?.id,
        createdAt: pastDate,
        updatedAt: pastDate,
      },
    });
    repairCount++;
    console.log(`   ✅ #REP-${refNum} — ${customer.name} — ${status}`);
  }

  console.log(`\n🎉 Seeding complete!`);
  console.log(`   Customers:   ${createdCustomers.length}`);
  console.log(`   Devices:     ${createdDevices.length}`);
  console.log(`   Technicians: ${createdTechs.length}`);
  console.log(`   Repairs:     ${repairCount}`);
  console.log(`\n📋 Technician login credentials:`);
  for (const t of TECHNICIANS) {
    console.log(`   ${t.name}: ${t.email} / ${t.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
