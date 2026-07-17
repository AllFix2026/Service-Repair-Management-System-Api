import type { RepairReportPeriod } from "@/types/dto/repairReport.dto";

export const REPORT_PERIODS: RepairReportPeriod[] = ["daily", "weekly", "monthly", "yearly"];

export function parseReportPeriod(raw: unknown): RepairReportPeriod {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!s) return "monthly";
  if (REPORT_PERIODS.includes(s as RepairReportPeriod)) return s as RepairReportPeriod;
  throw Object.assign(new Error("period must be one of: daily, weekly, monthly, yearly"), { status: 400 });
}

/** Local calendar boundaries for reporting (aligned with dashboard date handling). */
export function getPeriodDateRange(
  period: RepairReportPeriod,
  now = new Date()
): { start: Date; end: Date } {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (period) {
    case "daily": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "weekly": {
      const d = new Date(now);
      const day = d.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const start = new Date(d);
      start.setDate(d.getDate() + diffToMonday);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "yearly": {
      const start = new Date(now.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
  }
}
