import { Router } from "express";
import { apiRateLimiter, shopRateLimiter } from "@/middlewares/rateLimit.middleware";
import { authenticate } from "@/middlewares/auth.middleware";
import { tenantMiddleware } from "@/middlewares/tenant.middleware";
import authRouter from "@/routes/auth.routes";
import usersRouter from "@/routes/users.routes";
import shopsRouter from "@/routes/shops.routes";
import repairsRouter from "@/routes/repairs.routes";
import devicesRouter from "@/routes/devices.routes";
import staffRouter from "@/routes/staff.routes";
import inventoryRouter from "@/routes/inventory.routes";
import settingsRouter from "@/routes/settings.routes";
import paymentRouter from "@/routes/payment.routes";
import subscriptionRouter from "@/routes/subscription.routes";
import onboardingRouter from "@/routes/onboarding.routes";
import customersRouter from "@/routes/customers.routes";
import dashboardRouter from "@/routes/dashboard.routes";
import reportsRouter from "@/routes/reports.routes";
import adminRouter from "@/routes/admin.routes";
import invoicesRouter from "@/routes/invoices.routes";
import appointmentsRouter from "@/routes/appointments.routes";
import uploadsRouter from "@/routes/uploads.routes";
import {
  verifyEmail,
  generateShopIds,
  registerShop,
  sendVerification as sendShopVerification,
} from "@/controllers/shop.controller";
import taskRouter from "@/routes/task.routes";
import smsRouter from "@/routes/sms.routes";
import contactRouter from "@/routes/contact.routes";
import searchRouter from "@/routes/search.routes";
import serviceRequestsRouter from "@/routes/serviceRequests.routes";

const router = Router();

// Global rate limiter — 300 req/min per IP (DDoS guard)
router.use(apiRateLimiter);

router.get("/health", (_req, res) => {
  res.status(200).json({ success: true, status: "UP", timestamp: new Date().toISOString() });
});

// ─── Public Routes ──────────────────────────────────────────────────────────
router.use("/v1/auth", authRouter);
router.get("/v1/users/verify-email", verifyEmail);
router.use("/v1/onboarding", onboardingRouter);
router.use("/v1/admin", adminRouter);
router.use("/v1/contact", contactRouter);

// Public Shop Onboarding Routes
router.post("/v1/shops/generate-ids", generateShopIds);
router.post("/v1/shops/register", registerShop);
router.post("/v1/shops/send-verification", sendShopVerification);

// Public Payment & Subscription webhooks (must be before authenticate)
router.use("/v1/payment", paymentRouter);
router.use("/v1/subscription", subscriptionRouter);
router.use("/v1/staff", staffRouter);

// Online Request Portal (ORP) - Has both public and protected endpoints internally
router.use("/v1/service-requests", serviceRequestsRouter);

// ─── Protected Routes ───────────────────────────────────────────────────────
// authenticate   → verifies JWT, attaches req.user
// shopRateLimiter → 100 req/min per shop (prevents one shop from flooding API)
// tenantMiddleware → sets Postgres session var for RLS isolation
router.use(authenticate);
router.use(shopRateLimiter);
router.use(tenantMiddleware);

router.use("/v1/users", usersRouter);
router.use("/v1/shops", shopsRouter);
router.use("/v1/repairs", repairsRouter);
router.use("/v1/devices", devicesRouter);
router.use("/v1/customers", customersRouter);
router.use("/v1/inventory", inventoryRouter);
router.use("/v1/settings", settingsRouter);
router.use("/v1/dashboard", dashboardRouter);
router.use("/v1/invoices", invoicesRouter);
router.use("/v1/appointments", appointmentsRouter);
router.use("/v1/reports", reportsRouter);
router.use("/v1/uploads", uploadsRouter);
router.use("/v1/tasks", taskRouter);
router.use("/v1/sms", smsRouter);
router.use("/v1/search", searchRouter);

export default router;