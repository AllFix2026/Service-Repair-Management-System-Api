import { prisma } from "@/db/prisma";
import { CreateInventoryItemRequest, UpdateInventoryItemRequest } from "@/types/dto/inventory.dto";
import { logger } from "@/config/logger.config";
import { getCachedData, setCachedData, invalidateCachePattern } from "@/services/cache/cache";

export const createInventoryItem = async (
  data: CreateInventoryItemRequest,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[createInventoryItem] -> Creating inventory item: ${data.partName}`);

  const item = await prisma.partsInventory.create({
    data: {
      tenantId,
      shopId,
      partName: data.partName,
      partNumber: data.partNumber ?? null,
      category: data.category ?? null,
      compatibleBrands: data.compatibleBrands ?? [],
      compatibleModels: data.compatibleModels ?? [],
      supplierName: data.supplierName ?? null,
      quantityInStock: data.quantityInStock,
      minimumStockLevel: data.minimumStockLevel,
      unitCost: data.unitCost,
      sellingPrice: data.sellingPrice,
    },
  });

  logger.info(`[createInventoryItem] -> Item created: ${item.id}`);

  // Invalidate Cache for this shop
  await invalidateCachePattern(`inv:${tenantId}:${shopId}:*`);

  return item;
};

export const getInventoryItems = async (
  tenantId: string,
  shopId: string,
  pagination?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
  }
) => {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 100;
  const search = pagination?.search?.trim() ?? "";
  const category = pagination?.category?.trim() ?? "";
  const status = pagination?.status?.trim() ?? "";

  const cacheKey = `inv:${tenantId}:${shopId}:p:${page}:l:${limit}:s:${search}:c:${category}:st:${status}`;

  // Try Cache First
  const cached = await getCachedData<any>(cacheKey);
  if (cached) {
    logger.info(`[getInventoryItems] -> Returning cached items for shop: ${shopId}`);
    return cached;
  }

  logger.info(`[getInventoryItems] -> Cache miss. Querying database for shop: ${shopId}`);

  // Base query filter
  const whereClause: any = {
    tenantId,
    shopId,
    isActive: true,
  };

  if (search) {
    whereClause.OR = [
      { partName: { contains: search, mode: "insensitive" } },
      { partNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  if (category && category !== "All Categories" && category !== "All") {
    whereClause.category = category;
  }

  // Fetch count and items in parallel for performance
  const [totalCount, items] = await Promise.all([
    prisma.partsInventory.count({ where: whereClause }),
    prisma.partsInventory.findMany({
      where: whereClause,
      select: {
        id: true,
        partName: true,
        partNumber: true,
        category: true,
        quantityInStock: true,
        minimumStockLevel: true,
        unitCost: true,
        sellingPrice: true,
        supplierName: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  let filteredItems = items;
  // If status filter is active, perform filter post-fetch since status is computed
  if (status && status !== "All Status" && status !== "All") {
    filteredItems = items.filter(item => {
      const stock = item.quantityInStock ?? 0;
      const minStock = item.minimumStockLevel ?? 5;
      const itemStatus = stock === 0 ? "Out of Stock" : stock <= minStock ? "Low Stock" : "In Stock";
      return itemStatus.toLowerCase() === status.toLowerCase();
    });
  }

  const result = {
    items: filteredItems,
    totalCount,
    page,
    limit,
  };

  // Cache it for 5 minutes
  await setCachedData(cacheKey, result, 300);

  return result;
};


export const getInventoryItemById = async (
  itemId: string,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[getInventoryItemById] -> Fetching item: ${itemId}`);

  const item = await prisma.partsInventory.findFirst({
    where: { id: itemId, tenantId, shopId, isActive: true },
  });

  if (!item) {
    logger.warn(`[getInventoryItemById] -> Item not found: ${itemId}`);
    throw { status: 404, message: "Item not found" };
  }

  logger.info(`[getInventoryItemById] -> Item found: ${itemId}`);
  return item;
};

export const updateInventoryItem = async (
  itemId: string,
  data: UpdateInventoryItemRequest,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[updateInventoryItem] -> Updating item: ${itemId}`);

  const existing = await prisma.partsInventory.findFirst({
    where: { id: itemId, tenantId, shopId, isActive: true },
  });

  if (!existing) {
    logger.warn(`[updateInventoryItem] -> Item not found: ${itemId}`);
    throw { status: 404, message: "Item not found" };
  }

  const item = await prisma.partsInventory.update({
    where: { id: itemId },
    data: {
      ...(data.partName !== undefined && { partName: data.partName }),
      ...(data.partNumber !== undefined && { partNumber: data.partNumber }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.compatibleBrands !== undefined && { compatibleBrands: data.compatibleBrands }),
      ...(data.compatibleModels !== undefined && { compatibleModels: data.compatibleModels }),
      ...(data.supplierName !== undefined && { supplierName: data.supplierName }),
      ...(data.quantityInStock !== undefined && { quantityInStock: data.quantityInStock }),
      ...(data.minimumStockLevel !== undefined && { minimumStockLevel: data.minimumStockLevel }),
      ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
      ...(data.sellingPrice !== undefined && { sellingPrice: data.sellingPrice }),
    },
  });

  logger.info(`[updateInventoryItem] -> Item updated: ${itemId}`);
  
  // Invalidate Cache for this shop
  await invalidateCachePattern(`inv:${tenantId}:${shopId}:*`);

  return item;
};

export const deleteInventoryItem = async (
  itemId: string,
  tenantId: string,
  shopId: string
) => {
  logger.info(`[deleteInventoryItem] -> Deleting item: ${itemId}`);

  const existing = await prisma.partsInventory.findFirst({
    where: { id: itemId, tenantId, shopId, isActive: true },
  });

  if (!existing) {
    logger.warn(`[deleteInventoryItem] -> Item not found: ${itemId}`);
    throw { status: 404, message: "Item not found" };
  }

  // Use updateMany to scope by tenantId and shopId
  await prisma.partsInventory.updateMany({
    where: { id: itemId, tenantId, shopId },
    data: { isActive: false },
  });

  logger.info(`[deleteInventoryItem] -> Item soft deleted: ${itemId}`);

  // Invalidate Cache for this shop
  await invalidateCachePattern(`inv:${tenantId}:${shopId}:*`);
};

export const getLowStockItems = async (tenantId: string, shopId: string) => {
  logger.info(`[getLowStockItems] -> Fetching low stock items for shop: ${shopId}`);

  const items = await prisma.partsInventory.findMany({
    where: {
      tenantId,
      shopId,
      isActive: true,
    },
    select: {
      id: true,
      partName: true,
      quantityInStock: true,
      minimumStockLevel: true,
    },
  });

  const lowStockItems = items.filter(
    (item) => item.quantityInStock <= item.minimumStockLevel
  );

  logger.info(`[getLowStockItems] -> Found ${lowStockItems.length} low stock items`);
  return lowStockItems;
};

export const getInventorySummary = async (tenantId: string, shopId: string) => {
  logger.info(`[getInventorySummary] -> Fetching inventory summary for shop: ${shopId}`);

  const items = await prisma.partsInventory.findMany({
    where: { tenantId, shopId, isActive: true },
    select: {
      quantityInStock: true,
      minimumStockLevel: true,
      unitCost: true,
    },
  });

  const totalItems = items.length;
  const lowStockCount = items.filter(i => i.quantityInStock <= i.minimumStockLevel && i.quantityInStock > 0).length;
  const outOfStockCount = items.filter(i => i.quantityInStock === 0).length;
  const totalValue = items.reduce((sum, i) => sum + (i.quantityInStock * i.unitCost), 0);

  return {
    totalItems,
    lowStockCount,
    outOfStockCount,
    totalValue,
    pendingPOs: 5, // Mocked for now
  };
};

export const getInventoryUsage = async (tenantId: string, shopId: string) => {
  logger.info(`[getInventoryUsage] -> Fetching usage report for shop: ${shopId}`);

  // Get all repairs for this shop
  const repairs = await prisma.repair.findMany({
    where: { tenantId, shopId },
    select: { id: true },
  });

  const repairIds = repairs.map((r) => r.id);

  if (repairIds.length === 0) {
    logger.info(`[getInventoryUsage] -> No repairs found, returning empty report`);
    return [];
  }

  // Get parts used in those repairs
  const partsUsed = await prisma.repairPartsUsed.findMany({
    where: { repairId: { in: repairIds } },
    select: {
      partId: true,
      quantityUsed: true,
      repairId: true,
    },
  });

  // Manual aggregation
  const usageMap = new Map<string, { totalQuantity: number; repairCount: Set<string> }>();

  partsUsed.forEach((item) => {
    if (!usageMap.has(item.partId)) {
      usageMap.set(item.partId, { totalQuantity: 0, repairCount: new Set() });
    }
    const current = usageMap.get(item.partId)!;
    current.totalQuantity += item.quantityUsed;
    current.repairCount.add(item.repairId);
  });

  // Get part names
  const usageReport = await Promise.all(
    Array.from(usageMap.entries()).map(async ([partId, data]) => {
      const part = await prisma.partsInventory.findUnique({
        where: { id: partId },
        select: { partName: true },
      });

      return {
        partId,
        partName: part?.partName ?? "Unknown Part",
        totalQuantityUsed: data.totalQuantity,
        totalRepairs: data.repairCount.size,
      };
    })
  );

  logger.info(`[getInventoryUsage] -> Usage report generated with ${usageReport.length} items`);
  return usageReport;
};