-- ============================================================================
-- SALORIYA SECURE EMAIL OTP VERIFICATION & ANTI-ABUSE SCHEMA
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_otps (
  email VARCHAR(255) PRIMARY KEY,
  otp_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  resend_count INTEGER NOT NULL DEFAULT 1,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for instant lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_email_otps_expires_at ON public.email_otps(expires_at);

-- Row Level Security (RLS) Policy
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- Allow server backend / serverless functions to read, insert, update and delete OTP records
CREATE POLICY "Allow service role full access to email_otps"
  ON public.email_otps
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-cleanup function for expired OTP records (deletes records older than 15 minutes)
CREATE OR REPLACE FUNCTION delete_expired_email_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.email_otps WHERE expires_at < NOW() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
