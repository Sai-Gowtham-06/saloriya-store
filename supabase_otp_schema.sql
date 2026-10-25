-- ============================================================================
-- SALORIYA SECURE PHONE OTP STORAGE & ANTI-ABUSE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.phone_otps (
  phone VARCHAR(15) PRIMARY KEY,
  otp_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  resend_count INTEGER NOT NULL DEFAULT 1,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for speedy lookups and expiration cleanups
CREATE INDEX IF NOT EXISTS idx_phone_otps_expires_at ON public.phone_otps(expires_at);

-- Row Level Security (RLS) Policy
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

-- Allow serverless backend with anon/service key to read/insert/update/delete OTP records
DROP POLICY IF EXISTS "Allow service role full access to phone_otps" ON public.phone_otps;
DROP POLICY IF EXISTS "Allow anon and service role access to phone_otps" ON public.phone_otps;

CREATE POLICY "Allow anon and service role access to phone_otps"
  ON public.phone_otps
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Optional Auto-cleanup function for expired OTP records (runs periodically)
CREATE OR REPLACE FUNCTION delete_expired_phone_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.phone_otps WHERE expires_at < NOW() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
