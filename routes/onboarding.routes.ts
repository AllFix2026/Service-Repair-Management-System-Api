import { Router } from "express";
import * as onboardingController from "@/controllers/onboarding.controller";

const router = Router();

router.get("/requests", onboardingController.listRequests);
router.post("/request", onboardingController.requestRegistration);
router.delete("/request/:id", onboardingController.cancelRegistration);
router.post("/approve/:token", onboardingController.approveRegistration);
router.post("/reject/:token", onboardingController.rejectRegistration);
router.get("/status/:id", onboardingController.getStatus);
router.post("/resend/:id", onboardingController.resendAdminNotification);
router.post("/create-payment-intent", onboardingController.createPaymentIntent);
router.post("/create-payhere-params", onboardingController.createPayHereParams);
router.post("/finalize", onboardingController.finalizeRegistration);
router.post("/staff-request", onboardingController.registerStaff);
export default router;
