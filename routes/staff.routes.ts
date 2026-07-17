import {
  addStaff,
  deleteStaff,
  getStaffDashboardContext,
  getStaffList,
  registerStaff,
  updateStaff,
  validateShopId,
} from "@/controllers/staff.controller";
import {
  getRoles,
  addRole,
  updateRole,
  removeRole,
} from "@/controllers/roles.controller";
import { authenticate, authorizeRoles } from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

// Public staff self-registration
router.post("/register", registerStaff);
router.post("/validate-shop-id", validateShopId);

// Protected staff context + management
router.get("/me", authenticate, authorizeRoles("ADMIN", "TECHNICIAN", "MANAGER"), getStaffDashboardContext);
router.get("/", authenticate, authorizeRoles("ADMIN", "MANAGER"), getStaffList);
router.post("/", authenticate, authorizeRoles("ADMIN"), addStaff);
router.put("/:staffId", authenticate, authorizeRoles("ADMIN"), updateStaff);
router.delete("/:staffId", authenticate, authorizeRoles("ADMIN"), deleteStaff);

// Staff Roles
router.get("/roles", authenticate, authorizeRoles("ADMIN", "MANAGER"), getRoles);
router.post("/roles", authenticate, authorizeRoles("ADMIN"), addRole);
router.patch("/roles/:id", authenticate, authorizeRoles("ADMIN"), updateRole);
router.delete("/roles/:id", authenticate, authorizeRoles("ADMIN"), removeRole);

export default router;