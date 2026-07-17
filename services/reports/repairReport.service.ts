import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type {
  RepairReportItem,
  RepairReportPeriod,
  RepairReportResponse,
  RepairReportScope,
} from "@/types/dto/repairReport.dto";
import { getPeriodDateRange } from "@/utils/reportPeriod";

const repairReportInclude = {
  customer: { select: { name: true, phone: true } },
  device: { select: { brand: true, model: true } },
  technician: { select: { fullName: true, name: true } },
} as const satisfies Prisma.RepairInclude;

type RepairReportRow = Prisma.RepairGetPayload<{ include: typeof repairReportInclude }>;

/** Display labels for `Repair.status`. */
const REPAIR_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Pending",
  IN_PROGRESS: "In Progress",
  READY_TO_TAKE: "Ready",
  DELIVERED: "Completed",
  PAID: "Paid",
};

export function repairStatusDisplay(status: RepairReportRow["status"]): string {
  const key = status as string;
  return REPAIR_STATUS_LABELS[key] ?? key;
}

/** Display labels for `Repair.priority` (`Priority` enum in schema). */
const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function repairPriorityDisplay(priority: RepairReportRow["priority"]): string {
  const key = priority as string;
  return PRIORITY_LABELS[key] ?? key;
}

const COMPLETED_REPAIR_STATUS = new Set<string>(["DELIVERED", "PAID"]);

function isCompletedRepairStatus(status: RepairReportRow["status"]): boolean {
  return COMPLETED_REPAIR_STATUS.has(status as string);
}

function formatReportDueDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDeviceLabel(brand: string, model: string): string {
  const b = brand?.trim() ?? "";
  const m = model?.trim() ?? "";
  if (!b && !m) return "Unknown Device";
  return `${b} ${m}`.trim();
}

function mapRepairRow(r: RepairReportRow): RepairReportItem {
  const tech = r.technician;
  const technicianName =
    tech?.fullName?.trim() || tech?.name?.trim() || "Unassigned";

  return {
    reference: r.reference,
    customer: r.customer.name,
    phone: r.customer.phone,
    device: formatDeviceLabel(r.device.brand, r.device.model),
    issue: r.issue?.trim() ?? "",
    status: repairStatusDisplay(r.status),
    priority: repairPriorityDisplay(r.priority),
    technician: technicianName,
    amount: r.finalCost ?? r.estimatedCost ?? null,
    dueDate: formatReportDueDate(r.estimatedCompletionDate),
  };
}

function baseWhere(scope: RepairReportScope, start: Date, end: Date) {
  return {
    tenantId: scope.tenantId,
    ...(scope.shopId ? { shopId: scope.shopId } : {}),
    ...(scope.role === "TECHNICIAN" ? { technicianId: scope.userId } : {}),
    createdAt: { gte: start, lte: end },
  };
}

export async function getRepairReport(
  scope: RepairReportScope,
  period: RepairReportPeriod
): Promise<RepairReportResponse> {
  const { start, end } = getPeriodDateRange(period);
  const where = baseWhere(scope, start, end);

  const rows = await prisma.repair.findMany({
    where,
    include: repairReportInclude,
    orderBy: { createdAt: "desc" },
  });

  const totalRepairs = rows.length;
  const completedRepairs = rows.filter((r) => isCompletedRepairStatus(r.status)).length;
  const pendingRepairs = totalRepairs - completedRepairs;
  const repairs = rows.map(mapRepairRow);

  return {
    totalRepairs,
    completedRepairs,
    pendingRepairs,
    generatedAt: new Date().toISOString(),
    repairs,
  };
}
