import { prisma } from "@/db/prisma";
import type { RevenueReportResponse, RevenueReportScope } from "@/types/dto/revenueReport.dto";
import type { RevenueDateWindow } from "@/utils/revenueReportRange";

function moneyToNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  const n = Number(value.toString());
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100) / 100;
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

/**
 * Revenue from completed payments tied to repairs that are delivered (invoice proxy — no Invoice model).
 */
export async function getRevenueReport(
  scope: RevenueReportScope,
  window: RevenueDateWindow
): Promise<RevenueReportResponse> {
  const { start, end, periodLabel } = window;

  const result = await prisma.payment.aggregate({
    where: {
      status: "COMPLETED",
      paymentDate: { gte: start, lte: end },
      repairId: { not: null },
      tenantId: scope.tenantId,
      ...(scope.shopId ? { shopId: scope.shopId } : {}),
      repair: {
        status: "DELIVERED",
        tenantId: scope.tenantId,
        ...(scope.shopId ? { shopId: scope.shopId } : {}),
      },
    },
    _sum: { amount: true },
  });

  const totalRevenue = moneyToNumber(result._sum.amount);
  const currency = await resolveCurrency(scope.tenantId, scope.shopId);

  if (totalRevenue === 0) {
    return {
      totalRevenue: 0,
      currency,
      period: periodLabel,
      message: "No revenue data available for the selected period.",
    };
  }

  return {
    totalRevenue,
    currency,
    period: periodLabel,
  };
}
