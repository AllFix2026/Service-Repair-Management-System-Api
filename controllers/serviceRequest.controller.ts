import { Request, Response } from "express";
import { prisma } from "@/db/prisma";
import { logger } from "@/config/logger.config";
import { AuthRequest } from "@/types/auth.types";

/**
 * ─── PUBLIC ENDPOINTS ────────────────────────────────────────────────────────
 */

// POST /v1/service-requests
export const createServiceRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body;

    const request = await prisma.serviceRequest.create({
      data: {
        requestType: data.requestType,
        deviceType: data.deviceType,
        description: data.description,
        imageUrls: data.imageUrls || [],
        aiCategory: data.aiCategory,
        aiBudgetMin: data.aiBudgetMin,
        aiBudgetMax: data.aiBudgetMax,
        customerBudgetMin: data.customerBudgetMin,
        customerBudgetMax: data.customerBudgetMax,
        latitude: data.latitude,
        longitude: data.longitude,
        locationText: data.locationText,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        status: "pending",
      },
    });

    // Mock: Notify nearby shops
    // In v2, this would query shops within a certain radius using Haversine formula
    // and send emails/SMS to them.
    logger.info(`[ORP] New service request ${request.id} created. Nearby shops would be notified here.`);

    res.status(201).json({ success: true, requestId: request.id });
  } catch (error: any) {
    logger.error(`[ORP] Failed to create service request: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /v1/service-requests/:id/track
export const trackServiceRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const phone = req.query.phone as string;

    if (!phone) {
      res.status(400).json({ success: false, message: "Phone number required for tracking" });
      return;
    }

    const request = await prisma.serviceRequest.findFirst({
      where: { id, customerPhone: phone },
      include: {
        offers: {
          include: {
            shop: {
              select: { id: true, name: true, address: true, phone: true }
            }
          }
        }
      }
    });

    if (!request) {
      res.status(404).json({ success: false, message: "Request not found or phone number mismatch" });
      return;
    }

    res.status(200).json({ success: true, data: request });
  } catch (error: any) {
    logger.error(`[ORP] Failed to track request: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /v1/service-requests/:id/confirm
export const confirmOffer = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { offerId, fulfillment, phone } = req.body;

    const request = await prisma.serviceRequest.findFirst({
      where: { id, customerPhone: phone, status: { in: ["pending", "offered"] } },
    });

    if (!request) {
      res.status(404).json({ success: false, message: "Request not found or already confirmed" });
      return;
    }

    const offer = await prisma.requestOffer.findUnique({
      where: { id: offerId },
    });

    if (!offer || offer.requestId !== id) {
      res.status(404).json({ success: false, message: "Valid offer not found" });
      return;
    }

    // Wrap the confirmation process in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Mark request as confirmed
      await tx.serviceRequest.update({
        where: { id },
        data: { status: "confirmed", acceptedOfferId: offerId },
      });

      // 2. Mark winning offer as accepted
      await tx.requestOffer.update({
        where: { id: offerId },
        data: { status: "accepted" },
      });

      // 3. Mark other offers as rejected
      await tx.requestOffer.updateMany({
        where: { requestId: id, id: { not: offerId } },
        data: { status: "rejected" },
      });

      // 4. Create the repair job in the dashboard
      // We must mock the customer ID if it doesn't exist, or lookup first.
      // For simplicity in this v1, we create a basic customer record if none exists for this shop/phone.
      let customer = await tx.customer.findFirst({
        where: { shopId: offer.shopId, phone: request.customerPhone }
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            tenantId: offer.shopId, // Assumes single tenant setup where tenantId == shopId
            shopId: offer.shopId,
            name: request.customerName,
            phone: request.customerPhone,
            email: request.customerEmail,
          }
        });
      }

      // Create Device if not exists
      let device = null;
      if (request.deviceType) {
        device = await tx.device.findFirst({
          where: { shopId: offer.shopId, brand: request.deviceType, customerId: customer.id }
        });
        
        if (!device) {
          device = await tx.device.create({
            data: {
              tenantId: offer.shopId,
              shopId: offer.shopId,
              customerId: customer.id,
              brand: request.deviceType,
              model: "From Portal",
            }
          });
        }
      }

      await tx.repair.create({
        data: {
          tenantId: offer.shopId,
          shopId: offer.shopId,
          customerId: customer.id,
          deviceId: device?.id || "unknown", // Handle this better based on your schema requirements
          reference: `ORP-${request.id.substring(0, 8).toUpperCase()}`,
          status: "NOT_STARTED",
          issue: request.description,
          estimatedCost: offer.quotedAmount,
          sourceRequestId: request.id,
        }
      });

      // 5. Create delivery job if requested
      if (fulfillment === "delivery") {
        await tx.deliveryJob.create({
          data: {
            requestId: request.id,
            offerId: offer.id,
            status: "pending",
          }
        });
      }
    });

    // Mock notification
    logger.info(`[ORP] Request ${id} confirmed with offer ${offerId}. Shop would be notified here.`);

    res.status(200).json({ success: true, message: "Offer confirmed successfully" });
  } catch (error: any) {
    logger.error(`[ORP] Failed to confirm offer: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /v1/service-requests/ai-suggest
export const aiSuggest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceType, description } = req.body;
    
    // Mock AI Categorization
    // In production, you would call the Anthropic SDK here:
    // const response = await anthropic.messages.create({...})
    
    // Simulating API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Basic logic for mock
    let category = "General Repair";
    let min = 2000;
    let max = 5000;
    
    const text = (deviceType + " " + description).toLowerCase();
    
    if (text.includes("screen") || text.includes("display")) {
      category = "Screen Replacement";
      min = 8000;
      max = 25000;
    } else if (text.includes("battery") || text.includes("power")) {
      category = "Battery Replacement";
      min = 3500;
      max = 8000;
    } else if (text.includes("water") || text.includes("liquid")) {
      category = "Water Damage Repair";
      min = 5000;
      max = 15000;
    }

    res.status(200).json({
      success: true,
      data: {
        suggested_category: category,
        budget_min: min,
        budget_max: max,
        confidence: "medium"
      }
    });
  } catch (error: any) {
    logger.error(`[ORP] AI Suggestion failed: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * ─── PROTECTED ENDPOINTS (DASHBOARD) ─────────────────────────────────────────
 */

// GET /v1/service-requests
export const getShopServiceRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const shopId = authReq.user?.shopId;
    const status = req.query.status as string;

    if (!shopId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }

    const requests = await prisma.serviceRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        offers: {
          where: { shopId } // Only show offers from this shop
        }
      }
    });

    res.status(200).json({ success: true, data: requests });
  } catch (error: any) {
    logger.error(`[ORP] Failed to fetch shop service requests: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /v1/service-requests/:id/offer
export const makeOffer = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const shopId = authReq.user?.shopId;
    const id = req.params.id as string;
    const { quotedAmount, message } = req.body;

    if (!shopId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const request = await prisma.serviceRequest.findUnique({
      where: { id }
    });

    if (!request || request.status !== "pending") {
      res.status(400).json({ success: false, message: "Request is not available for new offers" });
      return;
    }

    const offer = await prisma.requestOffer.create({
      data: {
        requestId: id,
        shopId,
        quotedAmount,
        message,
        status: "pending"
      }
    });

    // Update request status to 'offered'
    await prisma.serviceRequest.update({
      where: { id },
      data: { status: "offered" }
    });

    // Mock: Notify Customer
    logger.info(`[ORP] Shop ${shopId} made offer ${offer.id} on request ${id}. Customer would be notified here via SMS.`);

    res.status(201).json({ success: true, data: offer });
  } catch (error: any) {
    logger.error(`[ORP] Failed to create offer: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
