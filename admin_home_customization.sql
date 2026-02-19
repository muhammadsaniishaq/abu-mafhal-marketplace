-- ADMIN HOME CUSTOMIZATION SCHEMA

-- 1. FEATURED BRANDS
-- Add is_featured column to brands table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'is_featured') THEN
        ALTER TABLE public.brands ADD COLUMN is_featured BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. DISPLAYED REVIEWS (TESTIMONIALS)
-- Add is_displayed column to reviews table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'is_displayed') THEN
        ALTER TABLE public.reviews ADD COLUMN is_displayed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 3. TOP CUSTOMERS (MANUAL SELECTION)
-- Add is_featured_customer column to profiles (assuming profiles is the main user data table)
-- If 'profiles' uses user_id as PK.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_featured') THEN
        ALTER TABLE public.profiles ADD COLUMN is_featured BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 4. RLS POLICIES (Ensure public can view these featured items)

-- Brands (Public view already likely exists, but ensure is_featured is accessible)
DROP POLICY IF EXISTS "Public can view active brands" ON public.brands;
CREATE POLICY "Public can view active brands" ON public.brands FOR SELECT USING (is_active = true);

-- Reviews (Public can view displayed reviews)
DROP POLICY IF EXISTS "Public can view displayed reviews" ON public.reviews;
CREATE POLICY "Public can view displayed reviews" ON public.reviews FOR SELECT USING (is_displayed = true);

-- Featured Profiles (Public can view featured customers)
-- Note: Limit data exposure for profiles (only show name/avatar/tier)
-- This is usually handled in the SELECT query, but RLS should allow read access.
