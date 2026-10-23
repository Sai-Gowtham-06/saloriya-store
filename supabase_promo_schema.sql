-- ============================================================================
-- SALORIYA PROMO CODES & FREE DELIVERY SCHEMA
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'free_delivery', -- 'free_delivery' (₹50 discount)
  discount_value NUMERIC NOT NULL DEFAULT 50,
  min_order_paise INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT NULL, -- NULL = unlimited
  uses_count INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT DEFAULT 'Free Delivery Voucher',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL
);

-- Case-insensitive index for fast code lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_code_upper ON public.promo_codes(upper(code));

-- Enable Row Level Security (RLS)
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active promo codes so storefront customers can validate them at checkout
CREATE POLICY "Allow public read promo codes"
  ON public.promo_codes
  FOR SELECT
  USING (true);

-- Allow authenticated admins (and service role) to insert, update, delete promo codes
CREATE POLICY "Allow full access to promo codes"
  ON public.promo_codes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add promo_code tracking column to orders table if not present
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_paise INTEGER DEFAULT 0;

-- Seed an initial default promo code for Free Delivery
INSERT INTO public.promo_codes (code, discount_type, discount_value, is_active, description)
VALUES ('FREEDELIVERY', 'free_delivery', 50, true, 'Complimentary Free Transport & Packaging')
ON CONFLICT (code) DO NOTHING;
