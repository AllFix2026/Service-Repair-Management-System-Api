import { Router } from "express";
import * as invoiceController from "@/controllers/invoice.controller";
import { authenticate, authorizeRoles } from "@/middlewares/auth.middleware";
import { validateGenerateInvoice } from "@/validators/invoice/invoice.validator";

const router = Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "MANAGER"),
  invoiceController.getAllInvoices,
);

router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "MANAGER"),
  validateGenerateInvoice,
  invoiceController.generateInvoice,
);

export default router;