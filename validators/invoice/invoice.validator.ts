import { NextFunction, Request, Response } from "express";
import { z } from "zod";

const generateInvoiceSchema = z.object({
  repairId: z.string().trim().min(1, "repairId is required"),
  notes: z.string().optional(),
  remarks: z.string().optional(),
});

/**
 * Validates the generate-invoice request body.
 */
export function validateGenerateInvoice(req: Request, res: Response, next: NextFunction) {
  const result = generateInvoiceSchema.safeParse(req.body);

  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join("; ");
    return res.status(422).json({ error: message });
  }

  req.body = result.data;
  return next();
}