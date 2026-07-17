import { prisma } from "@/db/prisma";
import type {
  TechnicianReportResponse,
  TechnicianReportRow,
  TechnicianReportScope,
} from "@/types/dto/technicianReport.dto";
import type { RepairReportPeriod } from "@/types/dto/repairReport.dto";
import { getPeriodDateRange } from "@/utils/reportPeriod";

type UserRoleValue = "ADMIN" | "MANAGER" | "TECHNICIAN" | "CUSTOMER";

const ACTIVE_REPAIR_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "READY_TO_TAKE"] as const;

function roleDisplay(role: UserRoleValue): string {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "MANAGER":
      return "Manager";
    case "TECHNICIAN":
      return "Technician";
    case "CUSTOMER":
      return "Customer";
    default:
      return role;
  }
}

function availabilityStatus(isActive: boolean): string {
  return isActive ? "Available" : "Unavailable";
}

/**
 * Labels the technician's workplace from their assigned `Shop` (`User.shop`).
 * Uses `Shop.name` as the primary label; adds `Shop.branches` only when it is a distinct qualifier.
 */
function formatTechnicianBranch(
  shop: { name: string; branches?: string | null } | null | undefined
): string {
  if (!shop) return "—";
  const shopName = shop.name?.trim() ?? "";
  const primaryBranch =
    shop.branches?.trim().split(",").find((segment) => segment.trim().length > 0)?.trim() ?? "";

  if (!shopName && !primaryBranch) return "—";
  if (!primaryBranch || primaryBranch.localeCompare(shopName, undefined, { sensitivity: "base" }) === 0) {
    return shopName || primaryBranch;
  }
  return `${shopName} — ${primaryBranch}`;
}

function roundHours(h: number): number {
  return Math.round(h * 10) / 10;
}

function staffWhere(scope: TechnicianReportScope) {
  return {
    tenantId: scope.tenantId,
    ...(scope.shopId ? { shopId: scope.shopId } : {}),
    role: { in: ["ADMIN", "MANAGER", "TECHNICIAN"] as UserRoleValue[] },
  };
}

export async function getTechnicianReport(
  scope: TechnicianReportScope,
  period: RepairReportPeriod
): Promise<TechnicianReportResponse> {
  const { start, end } = getPeriodDateRange(period);
  const repairTenantShop = {
    tenantId: scope.tenantId,
    ...(scope.shopId ? { shopId: scope.shopId } : {}),
  };

  const [staffRows, completedInPeriod, activeGrouped] = await Promise.all([
    prisma.user.findMany({
      where: staffWhere(scope),
      select: {
        id: true,
        fullName: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        shop: { select: { branches: true, name: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.repair.findMany({
      where: {
        ...repairTenantShop,
        status: "DELIVERED",
        technicianId: { not: null },
        updatedAt: { gte: start, lte: end },
      },
      select: { technicianId: true, createdAt: true, updatedAt: true },
    }),
    prisma.repair.groupBy({
      by: ["technicianId"],
      where: {
        ...repairTenantShop,
        status: { in: [...ACTIVE_REPAIR_STATUSES] },
        technicianId: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const completionByTech = new Map<string, { count: number; totalHours: number }>();
  for (const r of completedInPeriod) {
    if (!r.technicianId) continue;
    const hours =
      Math.max(0, (r.updatedAt.getTime() - r.createdAt.getTime()) / 3_600_000);
    const cur = completionByTech.get(r.technicianId) ?? { count: 0, totalHours: 0 };
    cur.count += 1;
    cur.totalHours += hours;
    completionByTech.set(r.technicianId, cur);
  }

  const activeByTech = new Map<string, number>();
  for (const row of activeGrouped) {
    if (row.technicianId != null) {
      activeByTech.set(row.technicianId, row._count._all);
    }
  }

  const technicians: TechnicianReportRow[] = staffRows.map((u) => {
    const perf = completionByTech.get(u.id);
    const repairsCompleted = perf?.count ?? 0;
    const avgCompletionTimeHours =
      repairsCompleted > 0 ? roundHours((perf!.totalHours / repairsCompleted)) : null;

    const displayName = u.fullName?.trim() || u.name?.trim() || u.email?.trim() || "Staff";

    return {
      name: displayName,
      email: u.email,
      phone: u.phone,
      role: roleDisplay(u.role as UserRoleValue),
      branch: formatTechnicianBranch(u.shop ?? null),
      status: availabilityStatus(u.isActive),
      rating: null,
      activeJobs: activeByTech.get(u.id) ?? 0,
      repairsCompleted,
      avgCompletionTimeHours,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    technicians,
  };
}
