-- ============================================================
-- ORP — Row Level Security (RLS) Policies
-- Version: 1.0
-- ============================================================
-- HOW TO APPLY:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click "Run"
-- ============================================================

-- ─── Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE "ServiceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequestOffer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryJob" ENABLE ROW LEVEL SECURITY;

-- ─── ServiceRequest Policies ────────────────────────────────────────────────
-- Public can insert (submit a request)
CREATE POLICY "public_insert_service_requests" ON "ServiceRequest"
  FOR INSERT WITH CHECK (true);

-- Shop staff can read requests (must be authenticated)
-- Using auth.role() = 'authenticated' to ensure only staff can read.
CREATE POLICY "staff_read_service_requests" ON "ServiceRequest"
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── RequestOffer Policies ──────────────────────────────────────────────────
-- Shop staff can manage offers.
CREATE POLICY "staff_manage_request_offers" ON "RequestOffer"
  USING (auth.role() = 'authenticated');

-- ─── DeliveryJob Policies ───────────────────────────────────────────────────
-- Shop staff can manage delivery jobs.
CREATE POLICY "staff_manage_delivery_jobs" ON "DeliveryJob"
  USING (auth.role() = 'authenticated');
