import { Router } from "express";
import {
  listInvoices,
  invoiceSummary,
  addInvoice,
  patchInvoiceStatus,
  removeInvoice,
} from "@/controllers/invoice.controller";

const router = Router();

router.get("/", listInvoices);
router.get("/summary", invoiceSummary);
router.post("/", addInvoice);
router.patch("/:id/status", patchInvoiceStatus);
router.delete("/:id", removeInvoice);

export default router;
