import { prisma } from "@/db/prisma";
import type {
  InventoryDeviceRow,
  InventoryReportResponse,
  InventoryReportScope,
  InventoryRestockRow,
} from "@/types/dto/inventoryReport.dto";
import type { RepairReportPeriod } from "@/types/dto/repairReport.dto";
import { getPeriodDateRange } from "@/utils/reportPeriod";

const ACTIVE_REPAIR_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "READY_TO_TAKE"] as const;
const TOP_PARTS_LIMIT = 5;

function partsWhere(scope: InventoryReportScope) {
  return {
    tenantId: scope.tenantId,
    ...(scope.shopId ? { shopId: scope.shopId } : {}),
    isActive: true,
  };
}

function devicesWhere(scope: InventoryReportScope) {
  return {
    tenantId: scope.tenantId,
    ...(scope.shopId ? { shopId: scope.shopId } : {}),
  };
}

async function resolveCurrency(tenantId: string, shopId: string | null): Promise<string> {
  const effectiveShopId =
    shopId ??
    (
      await prisma.shop.findFirst({
        where: { tenantId },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      })
    )?.id;

  if (!effectiveShopId) return "LKR";

  const settings = await prisma.shopSettings.findUnique({
    where: { tenantId: effectiveShopId },
    select: { currency: true },
  });

  const c = settings?.currency?.trim();
  return c && c.length > 0 ? c : "LKR";
}

function categoryLine(brand: string): string {
  const b = brand?.trim() || "UNKNOWN";
  return `${b.toUpperCase()} • MOBILE PHONE`;
}

function deviceDisplayName(brand: string, model: string): string {
  const m = model?.trim();
  const b = brand?.trim();
  if (m) return m;
  if (b) return b;
  return "Unknown Device";
}

function deviceIdentifier(imei: string | null, serialNo: string | null): string {
  const i = imei?.trim();
  if (i) return i;
  const s = serialNo?.trim();
  if (s) return s;
  return "N/A";
}

function mapDeviceRow(
  d: {
    brand: string;
    model: string;
    imei: string | null;
    serialNo: string | null;
    customer: { name: string; phone: string | null };
  },
  inReview: boolean
): InventoryDeviceRow {
  return {
    deviceName: deviceDisplayName(d.brand, d.model),
    categoryLine: categoryLine(d.brand),
    identifier: deviceIdentifier(d.imei, d.serialNo),
    ownerName: d.customer.name,
    ownerPhone: d.customer.phone,
    status: inReview ? "IN REVIEW" : "AVAILABLE",
    value: 0,
  };
}

export async function getInventoryReport(
  scope: InventoryReportScope,
  period: RepairReportPeriod
): Promise<InventoryReportResponse> {
  const { start, end } = getPeriodDateRange(period);
  const pw = partsWhere(scope);
  const dw = devicesWhere(scope);

  const [totalItems, partStockRows, devices, usageGroups, currency] = await Promise.all([
    prisma.partsInventory.count({ where: pw }),
    prisma.partsInventory.findMany({
      where: pw,
      select: { id: true, partName: true, quantityInStock: true, minimumStockLevel: true },
    }),
    prisma.device.findMany({
      where: dw,
      include: {
        customer: { select: { name: true, phone: true } },
      },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
    }),
    prisma.repairPartsUsed.groupBy({
      by: ["partId"],
      where: {
        addedAt: { gte: start, lte: end },
        part: pw,
      },
      _sum: { quantityUsed: true },
    }),
    resolveCurrency(scope.tenantId, scope.shopId),
  ]);

  const lowStockRows = partStockRows.filter((p) => p.quantityInStock <= p.minimumStockLevel);
  const lowStockItems = lowStockRows.length;

  const restockAlerts: InventoryRestockRow[] = lowStockRows.map((p) => ({
    partId: p.id,
    partName: p.partName,
    quantityInStock: p.quantityInStock,
    minimumStockLevel: p.minimumStockLevel,
  }));

  const deviceIds = devices.map((d) => d.id);
  let inReviewDeviceIds = new Set<string>();
  if (deviceIds.length > 0) {
    const inReviewGroups = await prisma.repair.groupBy({
      by: ["deviceId"],
      where: {
        deviceId: { in: deviceIds },
        status: { in: [...ACTIVE_REPAIR_STATUSES] },
        tenantId: scope.tenantId,
        ...(scope.shopId ? { shopId: scope.shopId } : {}),
      },
      _count: { _all: true },
    });
    inReviewDeviceIds = new Set(
      inReviewGroups.map((g) => g.deviceId).filter((id): id is string => id != null)
    );
  }

  const deviceRows: InventoryDeviceRow[] = devices.map((d) =>
    mapDeviceRow(d, inReviewDeviceIds.has(d.id))
  );

  const inReviewCount = deviceRows.filter((r) => r.status === "IN REVIEW").length;
  const summary = {
    totalAssets: devices.length,
    availableStocks: devices.length - inReviewCount,
    inReview: inReviewCount,
    soldCollected: 0,
  };

  const sortedUsage = [...usageGroups].sort(
    (a, b) => (b._sum.quantityUsed ?? 0) - (a._sum.quantityUsed ?? 0)
  );
  const topPartIds = sortedUsage.slice(0, TOP_PARTS_LIMIT).map((u) => u.partId);
  const topPartMeta =
    topPartIds.length > 0
      ? await prisma.partsInventory.findMany({
          where: { id: { in: topPartIds }, ...pw },
          select: { id: true, partName: true },
        })
      : [];
  const nameById = new Map(topPartMeta.map((p) => [p.id, p.partName]));

  const topUsedParts = sortedUsage.slice(0, TOP_PARTS_LIMIT).map((u) => ({
    partId: u.partId,
    partName: nameById.get(u.partId) ?? "Unknown part",
    quantityUsed: u._sum.quantityUsed ?? 0,
  }));

  const isEmpty = totalItems === 0 && devices.length === 0;

  return {
    totalItems,
    lowStockItems,
    generatedAt: new Date().toISOString(),
    currency,
    summary,
    devices: deviceRows,
    topUsedParts,
    restockAlerts,
    ...(isEmpty
      ? { message: "No inventory data available for this shop." }
      : {}),
  };
}
