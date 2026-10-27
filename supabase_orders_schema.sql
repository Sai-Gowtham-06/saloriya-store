-- ============================================================================
-- SALORIYA MULTI-DEVICE ORDERS & LIVE STOREFRONT SCHEMA
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ============================================================================

-- Ensure the orders table exists with all required fields
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  phone TEXT,
  delivery_address TEXT,
  address JSONB,
  product_id TEXT,
  product_name TEXT,
  product_image TEXT,
  variant_colour TEXT,
  quantity INTEGER DEFAULT 1,
  subtotal_paise INTEGER DEFAULT 0,
  total_paise INTEGER NOT NULL DEFAULT 0,
  discount_paise INTEGER DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT DEFAULT 'pending',
  order_status TEXT DEFAULT 'confirmed',
  status TEXT DEFAULT 'confirmed',
  utr_number TEXT,
  payment_screenshot TEXT,
  promo_code TEXT,
  email_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In case public.orders already existed with minimal columns, add any missing columns safely
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_image TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS variant_colour TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal_paise INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_paise INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_paise INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cod';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'confirmed';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS utr_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_screenshot TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email_token TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop any restrictive old policies
DROP POLICY IF EXISTS "Customers can place orders" ON public.orders;
DROP POLICY IF EXISTS "Admin manages orders" ON public.orders;
DROP POLICY IF EXISTS "Allow anon and auth full access to orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public orders management" ON public.orders;

-- Allow public / anon and authenticated store admin to select, insert, update and delete orders
CREATE POLICY "Allow anon and auth full access to orders"
  ON public.orders
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Populate existing orders into Supabase so all devices immediately synchronize
INSERT INTO public.orders (order_id, customer_name, customer_phone, delivery_address, product_id, product_name, variant_colour, quantity, total_paise, subtotal_paise, payment_method, status, order_status, created_at)
VALUES 
  ('SLR-952479', 'Naresh', '9363315416', 'Alpha male, Thiruvallur, Thiruvallur, Tamil Nadu - 602001', '2fb78137-672d-40f1-b058-9f3803f9642e', 'Antique Gold Stone Pearl Jhumka Earrings', 'BLACK', 1, 11900, 6900, 'cod', 'confirmed', 'confirmed', '2026-10-27T02:25:00.000Z'),
  ('SLR-952381', 'Naresh', '9363315416', 'Alpha male, Thiruvallur, Thiruvallur, Tamil Nadu - 602001', '2fb78137-672d-40f1-b058-9f3803f9642e', 'Antique Gold Stone Pearl Jhumka Earrings', 'BLACK', 1, 11900, 6900, 'cod', 'confirmed', 'confirmed', '2026-10-27T02:25:00.000Z'),
  ('SLR-757342', 'test', '8122291690', 'huiknk, Chennai, Tamil Nadu - 600001', 'f6ebe650-629a-4a3f-bf6c-ff07e1c0a53a', 'Royal Lotus Antique Gold Chandbali Earrings', 'BLUE', 1, 15500, 10500, 'cod', 'confirmed', 'confirmed', '2026-10-26T17:12:00.000Z')
ON CONFLICT (order_id) DO NOTHING;

