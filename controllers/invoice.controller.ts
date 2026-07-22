import type { Request, Response } from "express";
import type { AuthRequest } from "@/types/auth.types";
import { logger } from "@/config/logger.config";
import {
  getInvoices,
  getInvoiceSummary,
  generateInvoice,
  createInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  mapStatusToDatabase,
} from "@/services/invoice/invoice.service";
import { invalidateDashboardCache } from "@/services/dashboard/dashboard.service";

// GET /api/v1/invoices
export const listInvoices = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const invoices = await getInvoices(auth.tenantId);
    return res.status(200).json({ success: true, invoices });
  } catch (error: any) {
    logger.error(`[listInvoices] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ success: false, message: "Unable to fetch invoices" });
  }
};

// GET /api/v1/invoices/summary
export const invoiceSummary = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const summary = await getInvoiceSummary(auth.tenantId);
    return res.status(200).json({ success: true, summary });
  } catch (error: any) {
    logger.error(`[invoiceSummary] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ success: false, message: "Unable to fetch summary" });
  }
};

// POST /api/v1/invoices/generate
// Auto-generates an invoice for a completed repair job.
export const generateInvoiceFromRepair = async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await generateInvoice(req.body.repairId, req.user!.tenantId);

    return res.status(201).json({
      success: true,
      message: "Invoice generated successfully",
      invoiceId: invoice.invoiceNumber,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      total: Number(invoice.total),
    });
  } catch (error: any) {
    logger.error(`[generateInvoiceFromRepair] -> ${error.message}`);

    if (error?.status === 404) {
      return res.status(404).json({ success: false, message: "Repair job not found" });
    }
    if (error?.status === 400) {
      return res.status(400).json({ success: false, message: "Repair job is not completed yet" });
    }
    if (error?.status === 409) {
      return res.status(409).json({ success: false, message: "Invoice already exists for this repair job" });
    }

    return res.status(500).json({ success: false, message: "Invoice generation failed" });
  }
};

// POST /api/v1/invoices
export const addInvoice = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const { repairId, customerId, amount, paymentMethod = "CASH", paymentType = "FULL", status, notes, transactionReference } = req.body;

    if (!amount) {
      logger.warn(`[addInvoice] -> Missing amount for tenant: ${auth.tenantId}`);
      return res.status(400).json({ success: false, message: "amount is required" });
    }

    // Map user-friendly status names to database values or default to PENDING
    const dbStatus = mapStatusToDatabase(status) ?? "PENDING";

    logger.info(
      `[addInvoice] -> Creating invoice for tenant: ${auth.tenantId}, status: ${dbStatus}`
    );

    const invoice = await createInvoice(auth.tenantId, {
      shopId: auth.shopId!,
      repairId,
      customerId,
      amount: Number(amount),
      paymentMethod,
      paymentType,
      status: dbStatus,
      notes,
      transactionReference,
    });

    await invalidateDashboardCache(auth.tenantId, auth.shopId);

    logger.info(`[addInvoice] -> Invoice created successfully: ${invoice.id}`);
    return res.status(201).json({ success: true, invoice });
  } catch (error: any) {
    logger.error(
      `[addInvoice] -> Error: ${error.message}, Stack: ${error.stack}, Status: ${error.status}`
    );
    return res.status(error.status ?? 500).json({ success: false, message: error.message || "Unable to create invoice" });
  }
};

// PATCH /api/v1/invoices/:id/status
export const patchInvoiceStatus = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const id = req.params.id as string;
    const { status, amount } = req.body;

    // Validate that at least one field is provided
    if (!status && amount === undefined) {
      logger.warn(`[patchInvoiceStatus] -> Missing status or amount for invoice: ${id}`);
      return res.status(400).json({ success: false, message: "status or amount is required" });
    }

    logger.info(
      `[patchInvoiceStatus] -> Updating invoice ${id} with status: ${status}, amount: ${amount}`
    );

    const updated = await updateInvoiceStatus(id, auth.tenantId, status, amount ? Number(amount) : undefined);

    await invalidateDashboardCache(auth.tenantId, auth.shopId);

    logger.info(`[patchInvoiceStatus] -> Successfully updated invoice: ${id}`);
    return res.status(200).json({ success: true, invoice: updated });
  } catch (error: any) {
    // Log the full error details for debugging
    logger.error(
      `[patchInvoiceStatus] -> Error: ${error.message}, Stack: ${error.stack}, Status: ${error.status}`
    );

    // Return appropriate status code (400 for validation, 404 for not found, 500 for server errors)
    const statusCode = error.status ?? 500;
    const message = error.message || "Unable to update invoice";

    return res.status(statusCode).json({ success: false, message });
  }
};

// DELETE /api/v1/invoices/:id
export const removeInvoice = async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthRequest).user!;
    const id = req.params.id as string;
    await deleteInvoice(id, auth.tenantId);

    await invalidateDashboardCache(auth.tenantId, auth.shopId);

    return res.status(200).json({ success: true, message: "Invoice deleted" });
  } catch (error: any) {
    logger.error(`[removeInvoice] -> ${error.message}`);
    return res.status(error.status ?? 500).json({ success: false, message: "Unable to delete invoice" });
  }
};