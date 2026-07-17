import type { AuthRole } from "@/types/auth.types";

export type RepairReportPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface RepairReportQuery {
  period?: RepairReportPeriod;
}

export interface RepairReportStats {
  totalRepairs: number;
  completedRepairs: number;
  pendingRepairs: number;
}

/** One row for the repairs report table (UI columns). */
export interface RepairReportItem {
  reference: string;
  customer: string;
  phone: string | null;
  device: string;
  issue: string;
  status: string;
  priority: string;
  technician: string;
  /** `finalCost` if set, otherwise `estimatedCost` (same integer units as stored on Repair). */
  amount: number | null;
  dueDate: string;
}

export interface RepairReportResponse extends RepairReportStats {
  generatedAt: string;
  repairs: RepairReportItem[];
}

export interface RepairReportScope {
  tenantId: string;
  shopId: string | null;
  role: AuthRole;
  userId: string;
}
