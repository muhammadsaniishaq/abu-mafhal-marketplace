-- DYNAMIC HOME PAGE FEATURES
-- Adds columns for sorting Vendors and Customers by performance

-- 1. Add columns to VENDORS
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS total_sales integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;

-- 2. Add columns to PROFILES (Customers)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS total_spend numeric DEFAULT 0;

-- 3. Seed Data for Visualization (Mock Data for existing records)
-- Give random sales/reviews to verified vendors
UPDATE public.vendors 
SET 
  total_sales = floor(random() * 500 + 10)::int,
  review_count = floor(random() * 100 + 5)::int
WHERE is_verified = true;

-- Give random spend to featured customers
UPDATE public.profiles
SET
  total_spend = floor(random() * 500000 + 10000)::numeric
WHERE is_featured = true;

-- 4. Verify columns exist
SELECT column_name, table_name 
FROM information_schema.columns 
WHERE column_name IN ('total_sales', 'review_count', 'total_spend')
AND table_name IN ('vendors', 'profiles');
