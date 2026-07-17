export interface InventoryDeviceRow {
  /** Primary line in UI, e.g. model name */
  deviceName: string;
  /** Second line, e.g. "SAMSUNG • MOBILE PHONE" */
  categoryLine: string;
  /** IMEI, serial, or "N/A" */
  identifier: string;
  ownerName: string;
  ownerPhone: string | null;
  /** e.g. AVAILABLE, IN REVIEW (open repair on this device) */
  status: string;
  /** No device valuation in schema; 0 until modeled */
  value: number;
}

export interface InventoryPartUsageRow {
  partId: string;
  partName: string;
  quantityUsed: number;
}

export interface InventoryRestockRow {
  partId: string;
  partName: string;
  quantityInStock: number;
  minimumStockLevel: number;
}

export interface InventoryDeviceSummary {
  totalAssets: number;
  availableStocks: number;
  inReview: number;
  /** Not modeled; reserved for future disposal / collection workflow */
  soldCollected: number;
}

export interface InventoryReportResponse {
  /** Active spare-part SKUs in `PartsInventory` */
  totalItems: number;
  /** Parts at or below minimum stock */
  lowStockItems: number;
  generatedAt: string;
  currency: string;
  summary: InventoryDeviceSummary;
  devices: InventoryDeviceRow[];
  /** Most-used parts in the report period (by quantity on repairs) */
  topUsedParts: InventoryPartUsageRow[];
  /** Parts that need restocking */
  restockAlerts: InventoryRestockRow[];
  message?: string;
}

export interface InventoryReportScope {
  tenantId: string;
  shopId: string | null;
}
