import { prisma } from "@/db/prisma";
import type {
  CustomerReportResponse,
  CustomerReportRow,
  CustomerReportScope,
} from "@/types/dto/customerReport.dto";
import type { RepairReportPeriod } from "@/types/dto/repairReport.dto";
import { getPeriodDateRange } from "@/utils/reportPeriod";

/** Display labels for `Customer.customerType` (`CustomerType` enum). */
const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: "Individual",
  BUSINESS: "Business",
};

function customerTypeDisplay(customerType: string): string {
  return CUSTOMER_TYPE_LABELS[customerType] ?? customerType;
}

function moneyToNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  const n = Number(value.toString());
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100) / 100;
}

function customerWhere(scope: CustomerReportScope) {
  return {
    tenantId: scope.tenantId,
    ...(scope.shopId ? { shopId: scope.shopId } : {}),
  };
}

function repairWhere(scope: CustomerReportScope, start: Date, end: Date) {
  return {
    tenantId: scope.tenantId,
    ...(scope.shopId ? { shopId: scope.shopId } : {}),
    createdAt: { gte: start, lte: end },
  };
}

function paymentAggWhere(scope: CustomerReportScope, start: Date, end: Date) {
  return {
    status: "COMPLETED" as const,
    paymentDate: { gte: start, lte: end },
    customerId: { not: null },
    tenantId: scope.tenantId,
    ...(scope.shopId ? { shopId: scope.shopId } : {}),
    customer: customerWhere(scope),
  };
}

export async function getCustomerReport(
  scope: CustomerReportScope,
  period: RepairReportPeriod
): Promise<CustomerReportResponse> {
  const { start, end } = getPeriodDateRange(period);

  const [customers, repairGroups, paymentGroups] = await Promise.all([
    prisma.customer.findMany({
      where: customerWhere(scope),
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        customerType: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.repair.groupBy({
      by: ["customerId"],
      where: repairWhere(scope, start, end),
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["customerId"],
      where: paymentAggWhere(scope, start, end),
      _sum: { amount: true },
    }),
  ]);

  const repairsByCustomer = new Map<string, number>();
  for (const g of repairGroups) {
    repairsByCustomer.set(g.customerId, g._count._all);
  }

  const spentByCustomer = new Map<string, number>();
  for (const g of paymentGroups) {
    if (g.customerId == null) continue;
    spentByCustomer.set(g.customerId, moneyToNumber(g._sum.amount));
  }

  const rows: CustomerReportRow[] = customers.map((c) => {
    const repairs = repairsByCustomer.get(c.id) ?? 0;
    const totalSpent = spentByCustomer.get(c.id) ?? 0;
    const address = c.address?.trim() ?? "";

    return {
      name: c.name,
      email: c.email,
      phone: c.phone,
      location: address.length > 0 ? address : null,
      type: customerTypeDisplay(c.customerType),
      repairs,
      totalSpent,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    customers: rows,
  };
}
