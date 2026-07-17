const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const shop = await prisma.shop.findFirst({
      include: { settings: true }
    });
    if (!shop) {
      console.log('No shop found!');
      return;
    }
    console.log('Found shop:', shop.id, 'settings exists:', !!shop.settings);
    
    const shopId = shop.id;
    const settingsUpdatePayload = {
      currency: 'LKR',
      timezone: '(GMT +05:30) Colombo, Sri Lanka',
      language: 'en',
      notificationPreferences: {},
      appearance: {
        theme: 'light',
        accentColor: '#4F46E5',
        customerTiers: []
      },
      securityRules: {}
    };

    console.log('Attempting upsert...');
    const result = await prisma.shopSettings.upsert({
      where: { tenantId: shopId },
      create: {
        tenantId: shopId,
        ...settingsUpdatePayload,
      },
      update: settingsUpdatePayload,
    });
    console.log('Upsert success:', result);
  } catch (error) {
    console.error('Prisma Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
