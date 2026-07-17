import { loginRateLimiter } from "@/middlewares/rateLimit.middleware";
import { authenticate } from "@/middlewares/auth.middleware";
import { createInitialAdmin, login, logout, me, refresh, forgotPassword, resetPassword, updateMe } from "@/controllers/auth.controller";
import { Router } from "express";

const router = Router();

router.post("/login", loginRateLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);
router.patch("/me", authenticate, updateMe);
router.post("/init-admin", createInitialAdmin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;

