import { getEnv } from "@/utils/env.util";

export const env = {
  NODE_ENV: getEnv("NODE_ENV", { defaultValue: "development" }),

  PORT: getEnv<number>("PORT", {
    defaultValue: 3000,
    type: "number",
  }),

  LOG_LEVEL: getEnv("LOG_LEVEL", {
    defaultValue: "info",
  }),

  ENABLE_DOCS: getEnv<boolean>("ENABLE_DOCS", {
    defaultValue: true,
    type: "boolean",
  }),

  DATABASE_URL: getEnv("DATABASE_URL", {
    required: true,
  }),

  // ── JWT ──────────────────────────────────────────────
  ACCESS_TOKEN_SECRET: getEnv("ACCESS_TOKEN_SECRET", {
    required: true,
  }),

  REFRESH_TOKEN_SECRET: getEnv("REFRESH_TOKEN_SECRET", {
    required: true,
  }),

  ACCESS_TOKEN_EXPIRY: getEnv("ACCESS_TOKEN_EXPIRY", {
    defaultValue: "365d",
  }),

  REFRESH_TOKEN_EXPIRY: getEnv("REFRESH_TOKEN_EXPIRY", {
    defaultValue: "7d",
  }),

  JWT_ISSUER: getEnv("JWT_ISSUER", {
    defaultValue: "crezio-api",
  }),

  STAFF_REGISTRATION_SOURCE: getEnv("STAFF_REGISTRATION_SOURCE", {
    defaultValue: "staff-portal",
  }),
  
  STAFF_REGISTRATION_SECRET: getEnv("STAFF_REGISTRATION_SECRET", {
    defaultValue: "change-me-in-production",
  }),

  // ── Redis ──────────────────────────────────────────────
  REDIS_URL: getEnv("REDIS_URL", {
    defaultValue: "",
  }),

  REDIS_HOST: getEnv("REDIS_HOST", {
    defaultValue: "localhost",
  }),

  REDIS_PORT: getEnv<number>("REDIS_PORT", {
    defaultValue: 6379,
    type: "number",
  }),

  REDIS_USERNAME: getEnv("REDIS_USERNAME", {
    defaultValue: "default",
  }),

  REDIS_PASSWORD: getEnv("REDIS_PASSWORD", {
    defaultValue: "",
  }),

  /** Prepended to cache keys (e.g. `srm` → `srm:ff:tenant:<id>`). Empty = no prefix. */
  REDIS_PREFIX: getEnv("REDIS_PREFIX", {
    defaultValue: "",
  }),

  // ── Stripe ───────────────────────────────────────────
  STRIPE_SECRET_KEY: getEnv("STRIPE_SECRET_KEY", {
    defaultValue: "",
  }),

  STRIPE_WEBHOOK_SECRET: getEnv("STRIPE_WEBHOOK_SECRET", {
    defaultValue: "",
  }),
} as const;