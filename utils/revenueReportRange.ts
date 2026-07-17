import type { RepairReportPeriod } from "@/types/dto/repairReport.dto";
import { getPeriodDateRange, parseReportPeriod } from "@/utils/reportPeriod";

export interface RevenueDateWindow {
  start: Date;
  end: Date;
  periodLabel: string;
}

function formatCustomRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

function formatPresetLabel(period: RepairReportPeriod, start: Date, end: Date): string {
  switch (period) {
    case "daily":
      return start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    case "weekly":
      return formatCustomRange(start, end);
    case "monthly":
      return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    case "yearly":
      return String(start.getFullYear());
    default:
      return formatCustomRange(start, end);
  }
}

/**
 * Resolves the revenue window from optional `from` / `to` (ISO dates) or `period` preset.
 */
export function resolveRevenueDateWindow(query: {
  from?: unknown;
  to?: unknown;
  period?: unknown;
}): RevenueDateWindow {
  const fromRaw = query.from;
  const toRaw = query.to;
  const fromProvided = fromRaw != null;
  const toProvided = toRaw != null;
  if (fromProvided !== toProvided) {
    throw Object.assign(new Error("from and to must be provided together"), { status: 400 });
  }

  if (fromProvided && toProvided) {
    if (typeof fromRaw !== "string" || typeof toRaw !== "string") {
      throw Object.assign(new Error("from and to must be ISO date strings"), { status: 400 });
    }
    const start = new Date(fromRaw);
    const end = new Date(toRaw);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw Object.assign(new Error("from and to must be valid dates"), { status: 400 });
    }
    if (start > end) {
      throw Object.assign(new Error("from must be on or before to"), { status: 400 });
    }
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e, periodLabel: formatCustomRange(s, e) };
  }

  const period = parseReportPeriod(query.period);
  const { start, end } = getPeriodDateRange(period);
  return { start, end, periodLabel: formatPresetLabel(period, start, end) };
}
