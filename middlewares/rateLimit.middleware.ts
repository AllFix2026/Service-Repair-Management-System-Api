import { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Global API rate limiter — 300 req/min per IP.
 * Applied to all routes as a basic DDoS guard.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

/**
 * Shop-scoped rate limiter — 100 req/min per shop.
 * Applied to authenticated routes to prevent one shop from
 * flooding the API and degrading all other shops.
 */
export const shopRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  keyGenerator: (req: any) => req.user?.shopId || ipKeyGenerator(req.ip!),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this shop. Please slow down.",
  },
});

/**
 * Login rate limiter — 10 attempts/min per IP+email combo.
 * Prevents brute force attacks on user accounts.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = (req.body as Record<string, unknown>)?.email ?? "unknown";
    const ip = ipKeyGenerator(req.ip!);
    return `${ip}-${email}`;
  },
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 1 minute.",
  },
});