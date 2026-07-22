import { prisma } from "@/db/prisma";
import { logger } from "@/config/logger.config";

export interface SearchResult {
  id: string;
  type: string;
  name: string;
  sub: string;
  link: string;
}

export const globalSearch = async (
  query: string,
  tenantId: string,
  shopId: string
): Promise<SearchResult[]> => {
  logger.info(`[globalSearch] -> Searching for: "${query}" in shop ${shopId}`);

  const lowerQuery = query.toLowerCase();

  // Run all queries concurrently for performance
  const [
    customers,
    repairs,
    devices,
    inventory,
    staff,
    payments
  ] = await Promise.all([
    // Search Customers
    prisma.customer.findMany({
      where: {
        tenantId,
        shopId,
        OR: [
          { name: { contains: lowerQuery, mode: "insensitive" } },
          { email: { contains: lowerQuery, mode: "insensitive" } },
          { phone: { contains: lowerQuery, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),

    // Search Repairs
    prisma.repair.findMany({
      where: {
        tenantId,
        shopId,
        OR: [
          { reference: { contains: lowerQuery, mode: "insensitive" } },
          { issue: { contains: lowerQuery, mode: "insensitive" } },
          { customer: { name: { contains: lowerQuery, mode: "insensitive" } } },
        ],
      },
      include: { customer: true },
      take: 5,
    }),

    // Search Devices
    prisma.device.findMany({
      where: {
        tenantId,
        shopId,
        OR: [
          { model: { contains: lowerQuery, mode: "insensitive" } },
          { brand: { contains: lowerQuery, mode: "insensitive" } },
          { serialNo: { contains: lowerQuery, mode: "insensitive" } },
          { imei: { contains: lowerQuery, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),

    // Search Inventory (Parts)
    prisma.partsInventory.findMany({
      where: {
        tenantId,
        shopId,
        OR: [
          { partName: { contains: lowerQuery, mode: "insensitive" } },
          { partNumber: { contains: lowerQuery, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),

    // Search Staff (Users)
    prisma.user.findMany({
      where: {
        tenantId,
        shopId,
        OR: [
          { fullName: { contains: lowerQuery, mode: "insensitive" } },
          { email: { contains: lowerQuery, mode: "insensitive" } },
          { phone: { contains: lowerQuery, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),

    // Search Invoices/Payments
    prisma.payment.findMany({
      where: {
        tenantId,
        shopId,
        OR: [
          { transactionReference: { contains: lowerQuery, mode: "insensitive" } },
          { customer: { name: { contains: lowerQuery, mode: "insensitive" } } },
        ],
      },
      include: { customer: true },
      take: 5,
    }),
  ]);

  const results: SearchResult[] = [];

  // Format Customers
  customers.forEach(c => results.push({
    id: `cust_${c.id}`,
    type: "Customer",
    name: c.name,
    sub: c.email || c.phone || "No contact info",
    link: `/admin/customers`
  }));

  // Format Repairs
  repairs.forEach(r => results.push({
    id: `rep_${r.id}`,
    type: "Repair",
    name: r.reference,
    sub: `${r.customer?.name || 'Unknown'} - ${r.issue || 'No issue description'}`,
    link: `/admin/repairs/${r.id}`
  }));

  // Format Devices
  devices.forEach(d => results.push({
    id: `dev_${d.id}`,
    type: "Device",
    name: `${d.brand} ${d.model}`,
    sub: d.imei ? `IMEI: ${d.imei}` : (d.serialNo ? `Serial: ${d.serialNo}` : "No serial/IMEI"),
    link: `/admin/devices`
  }));

  // Format Inventory
  inventory.forEach(i => results.push({
    id: `inv_${i.id}`,
    type: "Inventory",
    name: i.partName,
    sub: i.partNumber ? `SKU: ${i.partNumber} | Stock: ${i.quantityInStock}` : `Stock: ${i.quantityInStock}`,
    link: `/admin/inventory`
  }));

  // Format Staff
  staff.forEach(s => results.push({
    id: `staff_${s.id}`,
    type: "Staff",
    name: s.fullName,
    sub: `${s.role} | ${s.email || s.phone || ''}`,
    link: `/admin/settings/team`
  }));

  // Format Payments/Invoices
  payments.forEach(p => results.push({
    id: `pay_${p.id}`,
    type: "Invoice",
    name: p.transactionReference || "Payment",
    sub: `${p.customer?.name || 'Unknown'} - ${p.amount.toString()} ${p.paymentMethod}`,
    link: `/admin/invoices`
  }));

  // Sort results somewhat (could be improved, but this mixes them)
  // Let's just return the raw array, the frontend can limit it to top X if needed.
  return results;
};
