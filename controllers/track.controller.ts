import type { Request, Response } from "express";
import { prisma } from "@/db/prisma";

/**
 * PUBLIC endpoint — no auth required.
 * GET /v1/track/:ref
 * Returns enough repair/invoice data for a customer to view their invoice.
 */
export const getPublicInvoiceByRef = async (req: Request, res: Response) => {
  try {
    const ref = req.params.ref as string;

    if (!ref) {
      return res.status(400).json({ success: false, message: "Reference number is required." });
    }

    const repair = await (prisma.repair.findFirst as any)({
      where: { reference: ref },
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        device:   { select: { brand: true, model: true, type: true, imei: true } },
        shop: {
          select: {
            name: true,
            address: true,
            city: true,
            phone: true,
            settings: { select: { appearance: true } },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            amount: true,
            status: true,
            paymentMethod: true,
            paymentDate: true,
          },
        },
        repairPartsUsed: {
          select: {
            quantityUsed: true,
            unitPrice: true,
            part: { select: { partName: true } },
          },
        },
      },
    });

    if (!repair) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found. Please check your reference number.",
      });
    }

    // Extract logo from the appearance JSON blob stored in ShopSettings
    const appearance = repair.shop?.settings?.appearance as Record<string, any> | null;
    const logoUrl: string | null = appearance?.logoUrl ?? null;

    // Build a safe, minimal public-facing payload
    const invoice = {
      reference: repair.reference,
      status:    repair.status,
      issue:     repair.issue,
      diagnosis: repair.diagnosis,
      estimatedCost: repair.estimatedCost,
      finalCost:     repair.finalCost,
      createdAt:     repair.createdAt,
      updatedAt:     repair.updatedAt,
      estimatedCompletionDate: repair.estimatedCompletionDate,

      customer: {
        name: repair.customer?.name ?? "Customer",
      },

      device: {
        brand: repair.device?.brand,
        model: repair.device?.model,
        type:  repair.device?.type,
        // Mask all but last 4 digits of IMEI for privacy
        imei:  repair.device?.imei
          ? `****${String(repair.device.imei).slice(-4)}`
          : null,
      },

      shop: {
        name:    repair.shop?.name,
        address: [repair.shop?.address, repair.shop?.city].filter(Boolean).join(", "),
        phone:   repair.shop?.phone,
        logoUrl,
      },

      payment: repair.payments?.[0]
        ? {
            amount:        repair.payments[0].amount,
            status:        repair.payments[0].status,
            method:        repair.payments[0].paymentMethod,
            date:          repair.payments[0].paymentDate,
          }
        : null,

      parts: (repair.repairPartsUsed ?? []).map((p: any) => ({
        name:     p.part?.partName,
        quantity: p.quantityUsed,
        unitCost: p.unitPrice,
      })),
    };

    return res.status(200).json({ success: true, data: invoice });
  } catch (error: any) {
    console.error("[PUBLIC TRACK] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};
