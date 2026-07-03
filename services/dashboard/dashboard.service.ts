import { prisma } from "@/db/prisma";
import { logger } from "@/config/logger.config";
import type { DashboardAuthContext, TodayRepairsResponse } from "@/types/dto/dashboard.dto";
import type { AuthRole } from "@/types/auth.types";
import { getCachedData, setCachedData } from "@/services/cache/cache";


export const getTodayRepairs = async (
  auth: DashboardAuthContext
): Promise<TodayRepairsResponse> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = today.toISOString().split("T")[0];

  logger.info(`[getTodayRepairs] -> Fetching today's repairs for role: ${auth.role}`);

  if (auth.role === "TECHNICIAN") {
    logger.info(`[getTodayRepairs] -> Scoping to technician: ${auth.user_id}`);
    const count = await prisma.repair.count({
      where: {
        tenantId: auth.tenant_id,
        ...(auth.shop_id ? { shopId: auth.shop_id } : {}),
        technicianId: auth.user_id,
        createdAt: { gte: today, lt: tomorrow },
      },
    });
    logger.info(`[getTodayRepairs] -> Technician repairs today: ${count}`);
    return { todayRepairs: count, date };
  }

  const count = await prisma.repair.count({
    where: {
      tenantId: auth.tenant_id,
      ...(auth.shop_id ? { shopId: auth.shop_id } : {}),
      createdAt: { gte: today, lt: tomorrow },
    },
  });
  logger.info(`[getTodayRepairs] -> Total repairs today: ${count}`);
  return { todayRepairs: count, date };
};

export async function countPendingRepairs(params: {
  tenantId: string;
  shopId: string | null;
  role: AuthRole;
  userId: string;
}) {
  const { tenantId, shopId, role, userId } = params;
  return prisma.repair.count({
    where: {
      tenantId,
      ...(shopId ? { shopId } : {}),
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      ...(role === "TECHNICIAN" ? { technicianId: userId } : {}),
    },
  });
}

// Session fallbacks for when DB sync is missing or table schema is old
const sessionClearedIds = new Set<string>();
const sessionReadIds = new Set<string>();
const sessionAllReadShops = new Set<string>();
const sessionAllClearedShops = new Set<string>();

// Full Dashboard Analytics for Shop Owner
export const getDashboardAnalytics = async (auth: DashboardAuthContext, days: number = 7) => {
  const { tenant_id: tenantId, shop_id: shopId, role, user_id: userId } = auth;
  const cacheKey = `dashboard:analytics:${tenantId}:${shopId || 'all'}:${days}`;

  // Attempt Cache Read
  try {
    const cached = await getCachedData<any>(cacheKey);
    if (cached) {
      logger.info(`[getDashboardAnalytics] -> Cache HIT for key: ${cacheKey}`);
      return cached;
    }
  } catch (err: any) {
    logger.warn(`[getDashboardAnalytics] -> Cache read failed: ${err.message}`);
  }

  logger.info(`[getDashboardAnalytics] -> Cache MISS. Calculating analytics for ${days} days...`);

  const rangeDate = new Date();
  rangeDate.setHours(0, 0, 0, 0); // Start of day
  rangeDate.setDate(rangeDate.getDate() - days);

  const baseWhere = {
    tenantId,
    ...(shopId ? { shopId } : {}),
  };

  // 1. Stats Overview
  const totalRepairs = await prisma.repair.count({ where: baseWhere });
  const pendingRepairsCount = await prisma.repair.count({ 
    where: { ...baseWhere, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } } 
  });
  const activeTechniciansCount = await prisma.user.count({ 
    where: { ...baseWhere, role: "TECHNICIAN", isActive: true } 
  });

  const completedPayments = await prisma.payment.findMany({
    where: { 
      ...baseWhere, 
      status: "COMPLETED",
      paymentDate: { gte: rangeDate }
    },
    select: { amount: true, paymentDate: true }
  });

  // Optimize Query Count Trend: fetch repairs created in date range ONCE
  const repairsInRange = await prisma.repair.findMany({
    where: {
      ...baseWhere,
      createdAt: { gte: rangeDate }
    },
    select: { createdAt: true }
  });

  const totalRevenue = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Calculate total parts cost using raw SQL (works regardless of Prisma client generation state)
  let totalPartsCost = 0;
  try {
    // Direct SQL join: RepairPartsUsed → PartsInventory → unitCost (stock value)
    // Only count parts from PAID or DELIVERED repairs
    let rawResult: any[];
    if (shopId) {
      rawResult = await prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(rpu."quantityUsed" * COALESCE(pi."unitCost", rpu."unitPrice" * 0.8)), 0) AS "partsCost"
        FROM "RepairPartsUsed" rpu
        JOIN "Repair" r ON r.id = rpu."repairId"
        LEFT JOIN "PartsInventory" pi ON pi.id = rpu."partId"
        WHERE r."tenantId" = $1
          AND r."shopId" = $2
          AND r.status IN ('PAID', 'DELIVERED')
          AND r."createdAt" >= $3
      `, tenantId, shopId, rangeDate);
    } else {
      rawResult = await prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(rpu."quantityUsed" * COALESCE(pi."unitCost", rpu."unitPrice" * 0.8)), 0) AS "partsCost"
        FROM "RepairPartsUsed" rpu
        JOIN "Repair" r ON r.id = rpu."repairId"
        LEFT JOIN "PartsInventory" pi ON pi.id = rpu."partId"
        WHERE r."tenantId" = $1
          AND r.status IN ('PAID', 'DELIVERED')
          AND r."createdAt" >= $2
      `, tenantId, rangeDate);
    }

    totalPartsCost = Number(rawResult?.[0]?.partsCost ?? 0);
    logger.info(`[getDashboardAnalytics] -> Parts cost (raw SQL): ${totalPartsCost}`);
  } catch (err: any) {
    logger.error(`[getDashboardAnalytics] -> Raw SQL parts cost failed: ${err.message}`);
    // Fallback: totalPartsCost stays 0 (net profit = revenue)
  }

  const netProfit = Math.max(0, totalRevenue - totalPartsCost);

  // Calculate percentage changes (mocked logic for now)
  const revenueChange = "+15%";
  const repairChange = "+8%";

  // 2. Revenue Trend (Daily or Monthly depending on range)
  const revenueData = [];
  
  if (days <= 30) {
    // Daily View (For 7d, 14d, 30d)
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = days <= 7 
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      
      const dayRevenue = completedPayments
        .filter(p => {
          const pDate = p.paymentDate;
          return `${pDate.getFullYear()}-${pDate.getMonth()}-${pDate.getDate()}` === dStr;
        })
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // Count repairs for this day in memory
      const dStart = new Date(d);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(dStart.getTime() + 24 * 60 * 60 * 1000);
      const dayRepairs = repairsInRange.filter(r => {
        const rDate = new Date(r.createdAt);
        return rDate >= dStart && rDate < dEnd;
      }).length;
        
      revenueData.push({ date: dateStr, revenue: dayRevenue, repairs: dayRepairs });
    }
  } else {
    // Monthly View (Jan, Feb, Mar...)
    const monthsToShow = days >= 999 ? 12 : Math.ceil(days / 30);
    const now = new Date();
    
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
      const monthIndex = d.getMonth();
      const yearIndex = d.getFullYear();
      
      const monthRevenue = completedPayments
        .filter(p => {
          const pDate = p.paymentDate;
          return pDate.getMonth() === monthIndex && pDate.getFullYear() === yearIndex;
        })
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // Count repairs for this month in memory
      const startOfMonth = new Date(yearIndex, monthIndex, 1);
      const endOfMonth = new Date(yearIndex, monthIndex + 1, 0, 23, 59, 59);
      const monthRepairs = repairsInRange.filter(r => {
        const rDate = new Date(r.createdAt);
        return rDate >= startOfMonth && rDate <= endOfMonth;
      }).length;
        
      revenueData.push({ date: monthLabel, revenue: monthRevenue, repairs: monthRepairs });
    }
  }

  // 3. Repair Status Distribution
  const allStatuses = ["NOT_STARTED", "IN_PROGRESS", "READY_TO_TAKE", "DELIVERED", "PAID"];
  const statusCounts = await prisma.repair.groupBy({
    by: ['status'],
    where: baseWhere,
    _count: { status: true }
  });
  
  const countMap = Object.fromEntries(statusCounts.map(s => [s.status, s._count.status]));

  const statusData = allStatuses.map(status => {
    let color = '#F59E0B'; // Default (NOT_STARTED)
    if (status === 'DELIVERED' || status === 'PAID') color = '#10B981';
    if (status === 'IN_PROGRESS') color = '#4F46E5';
    if (status === 'READY_TO_TAKE') color = '#10B981'; // Green for ready

    return {
      name: status.replace('_', ' '),
      value: countMap[status] || 0,
      color
    };
  });

  // 4. Recent Repairs & Notifications Source
  const recentRepairs = await prisma.repair.findMany({
    where: baseWhere,
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { customer: true, technician: true, device: true }
  });

  // 5. Top Technicians (by completed jobs)
  const techs = await prisma.user.findMany({
    where: { ...baseWhere, role: "TECHNICIAN" },
    include: {
      _count: {
        select: { repairs: { where: { status: { in: ["DELIVERED", "PAID" as any] } } } }
      }
    },
    orderBy: { repairs: { _count: 'desc' } },
    take: 4
  });

  const topTechnicians = techs.map(t => ({
    name: t.fullName,
    jobsCompleted: (t as any)._count?.repairs || 0,
    rating: (4.5 + Math.random() * 0.5).toFixed(1), // Mock rating
    avatar: t.fullName.substring(0, 2).toUpperCase()
  }));

  // 6. Brand Distribution (Market Share)
  const devicesForBrand = await prisma.repair.findMany({
    where: baseWhere,
    include: { device: { select: { brand: true } } },
  });
  
  const brandCounts: Record<string, number> = {};
  devicesForBrand.forEach(r => {
    const brand = r.device?.brand || "Unknown";
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
  });
  
  const totalBrandCount = devicesForBrand.length || 1;
  const brandData = Object.entries(brandCounts).map(([name, count]) => ({
    name,
    value: Math.round((count / totalBrandCount) * 100),
    color: name === 'Apple' ? '#4F46E5' : name === 'Samsung' ? '#10B981' : name === 'Google' ? '#F59E0B' : '#94A3B8'
  })).sort((a, b) => b.value - a.value).slice(0, 5);

  // 7. Popular Services (By issue category)
  const serviceCounts = await prisma.repair.groupBy({
    by: ['issue'],
    where: baseWhere,
    _count: { issue: true },
    _sum: { finalCost: true, estimatedCost: true },
    orderBy: { _count: { issue: 'desc' } },
    take: 5
  });

  const topServices = serviceCounts.map(s => {
    const finalRev = Number(s._sum.finalCost ?? 0);
    const estRev   = Number(s._sum.estimatedCost ?? 0) * 0.8;
    const revenue  = finalRev > 0 ? finalRev : estRev;
    return {
      name: s.issue || "General Repair",
      count: s._count.issue,
      revenue: `Rs. ${Math.round(revenue).toLocaleString()}`
    };
  });

  // 8. Notifications Feed (Persistent with Session Fallback)
  const currentEvents: any[] = [];
  
  // Fetch real timeline events for status changes if available
  try {
    const timelineEvents = await prisma.repairTimelineEvent.findMany({
      where: {
        repair: {
          tenantId: baseWhere.tenantId,
          ...(baseWhere.shopId ? { shopId: baseWhere.shopId } : {})
        },
        type: "STATUS_CHANGE"
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        repair: {
          include: { customer: true, device: true, technician: true }
        }
      }
    });

    timelineEvents.forEach(event => {
      currentEvents.push({
        id: `timeline-${event.id}`,
        title: "Status Update",
        description: `${event.repair.device.model}: ${event.description}`,
        type: "REPAIR",
        repairId: event.repairId,
        createdAt: event.createdAt
      });
    });
  } catch (err) {
    // Fallback to deriving from recent repairs if timeline fails
    recentRepairs.forEach(r => {
      if (r.status === "NOT_STARTED") {
        currentEvents.push({
          id: `rep-new-${r.id}`,
          title: "New repair request",
          description: `${r.device.brand} ${r.device.model} - ${r.issue} by ${r.customer?.name || 'Customer'}`,
          type: "REPAIR",
          repairId: r.id,
          createdAt: r.createdAt
        });
      } else if (r.status === "IN_PROGRESS") {
        currentEvents.push({
          id: `rep-start-${r.id}`,
          title: "Started repair for",
          description: `${r.device.model} - ${r.issue} by ${r.technician?.fullName || 'Technician'}`,
          type: "REPAIR",
          repairId: r.id,
          createdAt: r.updatedAt
        });
      } else if (r.status === "READY_TO_TAKE") {
        currentEvents.push({
          id: `rep-ready-${r.id}`,
          title: "Repair ready for pickup",
          description: `${r.device.model} fix completed for ${r.customer?.name || 'Customer'}`,
          type: "REPAIR",
          repairId: r.id,
          createdAt: r.updatedAt
        });
      } else if (r.status === "DELIVERED") {
         currentEvents.push({
          id: `rep-done-${r.id}`,
          title: "Repair completed",
          description: `${r.device.model} delivered to ${r.customer?.name || 'Customer'}`,
          type: "REPAIR",
          repairId: r.id,
          createdAt: r.updatedAt
        });
      }
    });
  }

  // Potential Inventory Events
  const inventoryItems = await prisma.partsInventory.findMany({
    where: baseWhere,
    take: 50
  });
  const lowStockItems = inventoryItems.filter((item: any) => 
    item.quantityInStock <= item.minimumStockLevel && item.isActive
  );

  lowStockItems.forEach(item => {
    currentEvents.push({
      id: `inv-low-${item.id}`,
      title: "Low stock alert",
      description: `${item.partName} dropping below threshold (${item.quantityInStock} remaining)`,
      type: "INVENTORY",
      createdAt: item.updatedAt
    });
  });

  // Sync to Notification table (Upsert)
  try {
    for (const event of currentEvents) {
      await (prisma as any).notification.upsert({
        where: { id: event.id },
        update: {}, 
        create: {
          id: event.id,
          tenantId,
          shopId,
          title: event.title,
          message: event.description,
          type: event.type,
          repairId: event.repairId || null,
          channel: "IN_APP",
          createdAt: event.createdAt
        }
      });
    }
  } catch (err) {
    // Ignore if table/schema doesn't match
  }

  // Fetch from persistent table
  let persistentNotifications = [];
  try {
    persistentNotifications = await (prisma as any).notification.findMany({
      where: {
        shopId,
        channel: "IN_APP",
        isCleared: false
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  } catch (err) {
    // Fallback to current events
    persistentNotifications = currentEvents.map(e => ({
      ...e,
      message: e.description,
      isRead: false,
      isCleared: false
    }));
  }

  // Apply session-based filtering
  const isAllCleared = shopId && sessionAllClearedShops.has(shopId);
  const isAllRead = shopId && sessionAllReadShops.has(shopId);

  const finalNotifications = isAllCleared ? [] : persistentNotifications
    .filter((n: any) => !sessionClearedIds.has(n.id))
    .map((n: any) => ({
      id: n.id,
      title: n.title,
      description: n.message || n.description,
      time: n.createdAt || n.time,
      unread: (isAllRead || sessionReadIds.has(n.id)) ? false : !n.isRead,
      type: n.type,
      repairId: n.repairId
    }))
    .sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 20);

  const result = {
    stats: {
      totalRevenue,
      revenueChange,
      totalRepairs,
      repairChange,
      pendingRepairs: pendingRepairsCount,
      activeTechnicians: activeTechniciansCount,
      netProfit,
      totalPartsCost
    },
    revenueData,
    statusData,
    brandData,
    topServices,
    recentRepairs: recentRepairs.slice(0, 5).map(r => ({
      id: r.id,
      customerName: r.customer?.name || "Unknown",
      device: r.device.model,
      status: r.status,
      date: r.createdAt.toLocaleDateString(),
      amount: (r.status === 'DELIVERED' || (r.status as any) === 'PAID') ? (r.finalCost || r.estimatedCost || 0) : (r.estimatedCost || 0)
    })),
    topTechnicians,
    notifications: finalNotifications
  };

  try {
    await setCachedData(cacheKey, result, 60); // Cache for 1 min
    logger.info(`[getDashboardAnalytics] -> Cached analytics result for key: ${cacheKey}`);
  } catch (err: any) {
    logger.warn(`[getDashboardAnalytics] -> Cache write failed: ${err.message}`);
  }

  return result;
};

export const markNotificationsRead = async (shopId: string, notificationId?: string) => {
  if (notificationId) sessionReadIds.add(notificationId);
  else sessionAllReadShops.add(shopId);
  
  try {
    if (notificationId) {
      return await (prisma as any).notification.update({
        where: { id: notificationId },
        data: { isRead: true }
      });
    }
    return await (prisma as any).notification.updateMany({
      where: { shopId, isRead: false },
      data: { isRead: true }
    });
  } catch (err) {
    return null;
  }
};

export const clearNotifications = async (shopId: string, notificationId?: string) => {
  if (notificationId) sessionClearedIds.add(notificationId);
  else sessionAllClearedShops.add(shopId);
  
  try {
    if (notificationId) {
      return await (prisma as any).notification.update({
        where: { id: notificationId },
        data: { isCleared: true }
      });
    }
    return await (prisma as any).notification.updateMany({
      where: { shopId, isCleared: false },
      data: { isCleared: true }
    });
  } catch (err) {
    return null;
  }
};

export const invalidateDashboardCache = async (tenantId: string, shopId?: string | null) => {
  const { invalidateCachePattern } = require("@/services/cache/cache");
  const pattern = `dashboard:analytics:${tenantId}:${shopId || "*"}:*`;
  try {
    await invalidateCachePattern(pattern);
    logger.info(`[invalidateDashboardCache] -> Invalidated dashboard cache for pattern: ${pattern}`);
  } catch (err: any) {
    logger.warn(`[invalidateDashboardCache] -> Failed to invalidate: ${err.message}`);
  }
};