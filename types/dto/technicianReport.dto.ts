/** Staff row: UI columns + performance metrics from product spec */
export interface TechnicianReportRow {
  name: string;
  email: string | null;
  /** Phone or null; clients may render as N/A when missing */
  phone: string | null;
  /** Human-readable role, e.g. Technician, Manager */
  role: string;
  /** Assigned shop: `Shop.name`, plus `Shop.branches` when set and distinct (`—` if no linked shop). */
  branch: string;
  /** Availability-style label derived from `User.isActive` */
  status: string;
  /** Not stored in schema; null until ratings exist */
  rating: number | null;
  /** Non-delivered repairs currently assigned (not filtered by period) */
  activeJobs: number;
  /** Delivered repairs attributed to technician within the report period */
  repairsCompleted: number;
  /** Mean hours from created→updated among completed repairs in period; null if none */
  avgCompletionTimeHours: number | null;
}

export interface TechnicianReportResponse {
  generatedAt: string;
  technicians: TechnicianReportRow[];
}

export interface TechnicianReportScope {
  tenantId: string;
  shopId: string | null;
}
