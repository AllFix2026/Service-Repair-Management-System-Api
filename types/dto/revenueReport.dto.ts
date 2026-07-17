export interface RevenueReportResponse {
  totalRevenue: number;
  currency: string;
  /** Human-readable label for the selected window, e.g. "March 2026" */
  period: string;
  /** Present when there was no qualifying revenue in range (Scenario 2). */
  message?: string;
}

export interface RevenueReportScope {
  tenantId: string;
  shopId: string | null;
}
