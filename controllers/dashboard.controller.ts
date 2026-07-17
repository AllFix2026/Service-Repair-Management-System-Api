import { logger } from "@/config/logger.config";
import type { AuthRequest } from "@/types/auth.types";
import { countPendingRepairs, getTodayRepairs, getDashboardAnalytics } from "@/services/dashboard/dashboard.service";
import type { Request, Response } from "express";
import type { DashboardAuthContext } from "@/types/dto/dashboard.dto";

// GET /api/v1/dashboard/analytics
export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const auth: DashboardAuthContext = {
      user_id: authReq.user.id,
      role: authReq.user.role as DashboardAuthContext["role"],
      tenant_id: authReq.user.tenantId,
      shop_id: authReq.user.shopId || undefined,
    };
    const days = parseInt(req.query.days as string) || 7;
    const data = await getDashboardAnalytics(auth, days);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error(`[getAnalytics] -> ${error.message}`);
    return res.status(error.status ?? 500).json({
      success: false,
      message: error.message ?? "Unable to fetch dashboard analytics",
    });
  }
};

// GET /api/v1/dashboard/today-repairs
export const todayRepairs = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      logger.warn(`[todayRepairs] -> Missing auth user`);
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const auth: DashboardAuthContext = {
      user_id: authReq.user.id,
      role: authReq.user.role as DashboardAuthContext["role"],
      tenant_id: authReq.user.tenantId,
      shop_id: authReq.user.shopId || undefined,
    };
    const data = await getTodayRepairs(auth);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error(`[todayRepairs] -> ${error.message}`);
    return res.status(error.status ?? 500).json({
      success: false,
      message: error.message ?? "Unable to fetch today's repair summary",
    });
  }
};

// GET /api/v1/dashboard/pending-repairs
export async function getPendingRepairs(req: AuthRequest, res: Response) {
  try {
    const user = req.user!;
    const pendingRepairs = await countPendingRepairs({
      tenantId: user.tenantId,
      shopId: user.shopId,
      role: user.role,
      userId: user.id,
    });
    return res.status(200).json({ success: true, data: { pendingRepairs } });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch pending repairs",
    });
  }
}

// POST /api/v1/dashboard/seed
export const seedDashboardData = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user || !authReq.user.shopId) {
      return res.status(401).json({ success: false, message: "Unauthorized or missing shop context" });
    }

    const { tenantId, shopId } = authReq.user;
    // Import prisma locally to avoid circular deps if any
    const { prisma } = require("@/db/prisma");

    // Clear existing for this shop (optional, or just add on top)
    // Here we will just add on top to not break existing functionality.

    const customers = [];
    for (let i = 0; i < 10; i++) {
      customers.push(await prisma.customer.create({
        data: {
          tenantId,
          shopId,
          name: `Mock Customer ${i}`,
          phone: `+9477000${i}000`,
        }
      }));
    }

    const devices = [];
    for (const customer of customers) {
      devices.push(await prisma.device.create({
        data: {
          tenantId,
          shopId,
          customerId: customer.id,
          brand: "Apple",
          model: "iPhone 13",
        }
      }));
    }

    // 4. Seeding Inventory & Usage Movement
    let parts = await prisma.partsInventory.findMany({ where: { tenantId, shopId, isActive: true } });
    if (parts.length === 0) {
      const mockParts = [
        { name: "iPhone 13 Screen OLED", cat: "Screens", cost: 12000, price: 18500 },
        { name: "Samsung S21 Battery", cat: "Batteries", cost: 4500, price: 7500 },
        { name: "Generic USB-C Port", cat: "Charging Ports", cost: 800, price: 2500 },
        { name: "iPhone Camera Module", cat: "Cameras", cost: 8500, price: 12000 },
        { name: "Glass Adhesive Pro", cat: "Tools", cost: 1200, price: 3000 }
      ];

      for (const p of mockParts) {
        parts.push(await prisma.partsInventory.create({
          data: {
            tenantId,
            shopId,
            partName: p.name,
            category: p.cat,
            quantityInStock: 50,
            minimumStockLevel: 10,
            unitCost: p.cost,
            sellingPrice: p.price,
            isActive: true
          }
        }));
      }
    }

    const mockIssues = [
      "Screen Damage",
      "Water damage – full diagnostic and repair",
      "SIM card not detected – motherboard issue",
      "Speaker not working – audio module replacement",
      "Keyboard keys not responding – needs cleaning and replacement",
      "Battery draining fast",
      "Charging port loose",
      "Camera lens cracked"
    ];

    const statuses = ["NOT_STARTED", "IN_PROGRESS", "READY_TO_TAKE", "DELIVERED", "PAID"];
    const now = new Date();
    const technicians = await prisma.user.findMany({ where: { tenantId, shopId, role: "TECHNICIAN" } });

    // Seed specific staff members if needed
    if (technicians.length < 3) {
      const staffToSeed = [
        { name: "Amara Pathirana", email: "amara.tech@servicepro.lk", role: "TECHNICIAN" },
        { name: "Saman Rathnayake", email: "saman.r@servicepro.lk", role: "TECHNICIAN" },
        { name: "Suresh", email: "suresh.admin@servicepro.lk", role: "ADMIN" }
      ];

      for (const s of staffToSeed) {
        const exists = await prisma.user.findUnique({ where: { email: s.email } });
        if (!exists) {
          await prisma.user.create({
            data: {
              tenantId,
              shopId,
              name: s.name,
              fullName: s.name,
              email: s.email,
              password: await require("bcrypt").hash("Password123!", 12),
              role: s.role as any,
              isActive: true
            }
          });
        }
      }
    }

    for (let i = 0; i < 30; i++) {
      const pastDate = new Date(now.getTime() - (Math.random() * 30 * 24 * 60 * 60 * 1000));
      const customer = customers[i % customers.length];
      const device = devices[i % devices.length];
      const tech = technicians.length > 0 ? technicians[i % technicians.length] : undefined;
      const status = statuses[i % statuses.length];
      const issue = mockIssues[i % mockIssues.length];

      const refNum = Math.floor(100000 + Math.random() * 900000);
      const estCost = 5000 + Math.floor(Math.random() * 15000);

      const repair = await prisma.repair.create({
        data: {
          tenantId,
          shopId,
          customerId: customer.id,
          deviceId: device.id,
          reference: `#REP-MOCK-${refNum}`,
          status: status,
          issue: issue,
          estimatedCost: estCost,
          finalCost: (status === "PAID" || status === "DELIVERED") ? estCost : null,
          technicianId: tech?.id,
          createdAt: pastDate,
          updatedAt: pastDate
        }
      });

      // Link parts usage for movement data (Fast Moving Items)
      if (status !== "NOT_STARTED") {
        const partsToUse = parts.slice(0, 2);
        for (const part of partsToUse) {
          await prisma.repairPartsUsed.create({
            data: {
              repairId: repair.id,
              partId: part.id,
              quantityUsed: 1,
              unitPrice: part.sellingPrice,
              totalPrice: part.sellingPrice,
              addedByUserId: tech?.id || authReq.user!.id,
              addedAt: pastDate
            }
          });
        }
      }

      if (status !== "NOT_STARTED") {
        await prisma.appointment.create({
          data: {
            tenantId,
            shopId,
            customerId: customer.id,
            technicianId: tech?.id,
            repairId: repair.id,
            scheduledAt: pastDate,
            duration: 60,
          }
        });
      }

      if (status === "DELIVERED" || status === "READY_TO_TAKE") {
        await prisma.payment.create({
          data: {
            tenantId,
            repairId: repair.id,
            customerId: customer.id,
            paymentMethod: "CASH",
            paymentType: "FULL",
            amount: repair.estimatedCost,
            status: "COMPLETED",
            paymentDate: pastDate,
          }
        });
      }
    }

    return res.status(200).json({ success: true, message: "1 Month of mock data seeded successfully." });

  } catch (error: any) {
    logger.error(`[seedDashboardData] -> ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Unable to seed data",
      error: error.message
    });
  }
};

// PATCH /api/v1/dashboard/notifications/mark-read
export const markRead = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user?.shopId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { notificationId } = req.body;
    const { markNotificationsRead } = require("@/services/dashboard/dashboard.service");

    await markNotificationsRead(authReq.user.shopId, notificationId);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/v1/dashboard/notifications/clear
export const clearAll = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user?.shopId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { notificationId } = req.body;
    const { clearNotifications } = require("@/services/dashboard/dashboard.service");

    await clearNotifications(authReq.user.shopId, notificationId);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};