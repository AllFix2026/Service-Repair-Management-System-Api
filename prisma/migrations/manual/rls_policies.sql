-- ============================================================
-- SRM — Row Level Security (RLS) Policies
-- Version: 1.0 | June 2026
-- ============================================================
-- HOW TO APPLY:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. Deploy tenant.middleware.ts BEFORE running this script
--      (otherwise all queries will return 0 rows)
--
-- WHAT THIS DOES:
--   Enables RLS on all multi-tenant tables and creates isolation
--   policies that restrict each query to only the rows belonging
--   to the shop identified by app.shop_id (set by tenant middleware).
--
-- SAFETY:
--   - Data is NEVER deleted or modified by RLS
--   - To temporarily disable: ALTER TABLE "Repair" DISABLE ROW LEVEL SECURITY;
--   - The service_role (used by Railway backend) bypasses RLS automatically
-- ============================================================

-- ─── Step 1: Enable RLS on all multi-tenant tables ──────────────────────────

ALTER TABLE "Repair"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Device"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PartsInventory"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrder"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffRole"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RepairArchive"   ENABLE ROW LEVEL SECURITY;

-- ─── Step 2: Drop existing policies (safe to re-run) ────────────────────────

DROP POLICY IF EXISTS shop_isolation_repair         ON "Repair";
DROP POLICY IF EXISTS shop_isolation_customer       ON "Customer";
DROP POLICY IF EXISTS shop_isolation_device         ON "Device";
DROP POLICY IF EXISTS shop_isolation_payment        ON "Payment";
DROP POLICY IF EXISTS shop_isolation_inventory      ON "PartsInventory";
DROP POLICY IF EXISTS shop_isolation_notification   ON "Notification";
DROP POLICY IF EXISTS shop_isolation_appointment    ON "Appointment";
DROP POLICY IF EXISTS shop_isolation_task           ON "Task";
DROP POLICY IF EXISTS shop_isolation_supplier       ON "Supplier";
DROP POLICY IF EXISTS shop_isolation_po             ON "PurchaseOrder";
DROP POLICY IF EXISTS shop_isolation_staffrole      ON "StaffRole";
DROP POLICY IF EXISTS shop_isolation_archive        ON "RepairArchive";

-- ─── Step 3: Create isolation policies ──────────────────────────────────────
-- Each policy uses current_setting('app.shop_id', true) which is set by
-- the tenant middleware on every authenticated request.
-- The 'true' makes it return NULL instead of throwing if not set
-- (safe for unauthenticated/admin contexts).

CREATE POLICY shop_isolation_repair ON "Repair"
  USING ("shopId" = current_setting('app.shop_id', true));

CREATE POLICY shop_isolation_customer ON "Customer"
  USING ("shopId" = current_setting('app.shop_id', true));

CREATE POLICY shop_isolation_device ON "Device"
  USING ("shopId" = current_setting('app.shop_id', true));

CREATE POLICY shop_isolation_payment ON "Payment"
  USING ("shopId" = current_setting('app.shop_id', true));

CREATE POLICY shop_isolation_inventory ON "PartsInventory"
  USING ("shopId" = current_setting('app.shop_id', true));

CREATE POLICY shop_isolation_notification ON "Notification"
  USING ("shopId" = current_setting('app.shop_id', true));

CREATE POLICY shop_isolation_appointment ON "Appointment"
  USING ("shopId" = current_setting('app.shop_id', true));

CREATE POLICY shop_isolation_task ON "Task"
  USING ("shopId" = current_setting('app.shop_id', true));

CREATE POLICY shop_isolation_supplier ON "Supplier"
  USING ("shopId" = current_setting('app.shop_id', true));

CREATE POLICY shop_isolation_po ON "PurchaseOrder"
  USING ("shopId" = current_setting('app.shop_id', true));

CREATE POLICY shop_isolation_staffrole ON "StaffRole"
  USING ("shopId" = current_setting('app.shop_id', true));

CREATE POLICY shop_isolation_archive ON "RepairArchive"
  USING ("shopId" = current_setting('app.shop_id', true));

-- ─── Step 4: Verify ─────────────────────────────────────────────────────────
-- Run this query to confirm all policies are in place:
--
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- You should see one policy per table listed above.
-- ============================================================
