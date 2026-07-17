import {
  addInventoryItem,
  listInventoryItems,
  getInventoryItem,
  editInventoryItem,
  removeInventoryItem,
  lowStock,
  usage,
  summary,
} from "@/controllers/inventory.controller";
import {
  addSupplier,
  listSuppliers,
  editSupplier,
  removeSupplier,
} from "@/controllers/supplier.controller";
import {
  addPurchaseOrder,
  listPurchaseOrders,
  updatePOStatus,
  editPurchaseOrder,
  removePurchaseOrder,
} from "@/controllers/purchaseOrder.controller";
import { authorizeRoles } from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

// Special routes first (before /:itemId)
router.get("/low-stock", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), lowStock);
router.get("/usage", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), usage);
router.get("/summary", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), summary);

// Supplier Routes
router.get("/suppliers/all", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), listSuppliers);
router.post("/suppliers", authorizeRoles("ADMIN", "MANAGER"), addSupplier);
router.put("/suppliers/:supplierId", authorizeRoles("ADMIN", "MANAGER"), editSupplier);
router.delete("/suppliers/:supplierId", authorizeRoles("ADMIN", "MANAGER"), removeSupplier);

// Purchase Order Routes
router.get("/purchase-orders/all", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), listPurchaseOrders);
router.post("/purchase-orders", authorizeRoles("ADMIN", "MANAGER"), addPurchaseOrder);
router.patch("/purchase-orders/:poId/status", authorizeRoles("ADMIN", "MANAGER"), updatePOStatus);
router.put("/purchase-orders/:poId", authorizeRoles("ADMIN", "MANAGER"), editPurchaseOrder);
router.delete("/purchase-orders/:poId", authorizeRoles("ADMIN", "MANAGER"), removePurchaseOrder);

// CRUD routes
router.get("/", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), listInventoryItems);
router.post("/", authorizeRoles("ADMIN", "MANAGER"), addInventoryItem);
router.get("/:itemId", authorizeRoles("ADMIN", "MANAGER", "TECHNICIAN"), getInventoryItem);
router.put("/:itemId", authorizeRoles("ADMIN", "MANAGER"), editInventoryItem);
router.delete("/:itemId", authorizeRoles("ADMIN", "MANAGER"), removeInventoryItem);

export default router;