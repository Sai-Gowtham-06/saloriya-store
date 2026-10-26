-- ============================================================================
-- SALORIYA PRODUCTS & IMAGE STORAGE SCHEMA
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ============================================================================

-- 1. Ensure the products table exists with all standard columns
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Combos',
  price_paise INTEGER NOT NULL DEFAULT 0,
  colours TEXT[] DEFAULT ARRAY[]::TEXT[],
  stock INTEGER NOT NULL DEFAULT 5,
  image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add any missing columns safely if the table was created earlier with a minimal schema
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Combos';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_paise INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS colours TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Create helpful indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_published ON public.products(is_published);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 5. Policies: Allow public read access to active pieces for storefront customers
DROP POLICY IF EXISTS "Allow public read products" ON public.products;
CREATE POLICY "Allow public read products"
  ON public.products
  FOR SELECT
  USING (true);

-- 6. Policies: Allow admin inserts, updates, and deletes
DROP POLICY IF EXISTS "Allow full access to products" ON public.products;
CREATE POLICY "Allow full access to products"
  ON public.products
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. Ensure the product-images storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 8. Storage bucket policies for public view & admin uploads
DROP POLICY IF EXISTS "Public product image access" ON storage.objects;
CREATE POLICY "Public product image access"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Allow product image uploads" ON storage.objects;
CREATE POLICY "Allow product image uploads"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Allow product image updates" ON storage.objects;
CREATE POLICY "Allow product image updates"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Allow product image deletions" ON storage.objects;
CREATE POLICY "Allow product image deletions"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'product-images');
