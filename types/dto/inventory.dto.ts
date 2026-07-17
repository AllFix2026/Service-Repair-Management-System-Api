export interface CreateInventoryItemRequest {
  partName: string;
  partNumber?: string | null;
  category?: string | null;
  compatibleBrands?: string[];
  compatibleModels?: string[];
  supplierName?: string | null;
  quantityInStock: number;
  minimumStockLevel: number;
  unitCost: number;
  sellingPrice: number;
}

export interface UpdateInventoryItemRequest {
  partName?: string;
  partNumber?: string | null;
  category?: string | null;
  compatibleBrands?: string[];
  compatibleModels?: string[];
  supplierName?: string | null;
  quantityInStock?: number;
  minimumStockLevel?: number;
  unitCost?: number;
  sellingPrice?: number;
}

export interface InventoryItemResponse {
  id: string;
  partName: string;
  partNumber: string | null;
  category: string | null;
  quantityInStock: number;
  minimumStockLevel: number;
  unitCost: number;
  sellingPrice: number;
  supplierName: string | null;
}

export interface LowStockItem {
  id: string;
  partName: string;
  quantityInStock: number;
  minimumStockLevel: number;
}

export interface InventoryUsageItem {
  partId: string;
  partName: string;
  totalQuantityUsed: number;
  totalRepairs: number;
}

export interface CreateSupplierRequest {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  category?: string | null;
}

export interface UpdateSupplierRequest {
  name?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  category?: string | null;
  status?: string;
}

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  orderNumber: string;
  notes?: string | null;
  expectedDelivery?: Date | string | null;
  items: {
    partId?: string | null;
    partName: string;
    sku?: string | null;
    quantity: number;
    unitCost: number;
  }[];
}

export interface UpdatePurchaseOrderStatusRequest {
  status: string;
  receivedAt?: Date | string | null;
}