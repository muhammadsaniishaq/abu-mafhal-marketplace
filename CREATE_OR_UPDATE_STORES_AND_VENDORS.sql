-- ==============================================================================
-- ABU MAFHAL MARKETPLACE - STORES, BRANDING & RECOMMENDED VENDORS MIGRATION
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> Run)
-- ==============================================================================

-- 1. ADD STORE BRANDING AND RECOMMENDATION COLUMNS TO PROFILES TABLE
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_category TEXT DEFAULT 'General Merchant';

-- 2. CREATE DEDICATED STORES TABLE (If not already present)
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    about TEXT,
    logo TEXT,
    cover_image TEXT,
    phone TEXT,
    category TEXT DEFAULT 'General Merchant',
    address TEXT,
    is_recommended BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT true,
    is_official BOOLEAN DEFAULT false,
    rating NUMERIC DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Safely add columns if stores table already existed
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General Merchant';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT false;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 5.0;

-- 3. ENABLE ROW LEVEL SECURITY (RLS) FOR STORES
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view stores" ON public.stores;
CREATE POLICY "Public can view stores" ON public.stores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert stores" ON public.stores;
CREATE POLICY "Users can insert stores" ON public.stores FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update stores" ON public.stores;
CREATE POLICY "Users can update stores" ON public.stores FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete stores" ON public.stores;
CREATE POLICY "Users can delete stores" ON public.stores FOR DELETE USING (true);

-- 4. GRANT PERMISSIONS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. INITIALIZE OFFICIAL STORE PROFILE
-- Update admin profile with real flagship branding and recommended status
UPDATE public.profiles
SET 
    business_name = COALESCE(business_name, 'Abu Mafhal Official Store'),
    about = COALESCE(about, 'The official verified flagship store of Abu Mafhal Marketplace. Discover 100% authentic electronics, fashion, and lifestyle products with genuine warranty, swift nationwide dispatch, and buyer protection.'),
    cover_image = COALESCE(cover_image, 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop'),
    business_category = COALESCE(business_category, 'Official Mall & Flagship Store'),
    is_recommended = true,
    phone = COALESCE(phone, '2349021486162')
WHERE role = 'admin';

-- 6. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

SELECT 'SUCCESS: Store columns and table configured. Recommended vendors active.' AS result;
