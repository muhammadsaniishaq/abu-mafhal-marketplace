-- COMPREHENSIVE SCHEMA FIX FOR VENDOR APPLICATIONS (V5)

-- 1. REPAIR PROFILES TABLE (Crucial: This fixes the 23503 error)
-- This ensures every user has a profile record so that joins and constraints work.
INSERT INTO public.profiles (id, email, full_name, created_at)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', email), created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 2. Fix user_id column and point to AUTH.USERS (Safe reference)
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.vendor_applications DROP CONSTRAINT IF EXISTS vendor_applications_user_id_fkey;
ALTER TABLE public.vendor_applications ADD CONSTRAINT vendor_applications_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Add an additional relationship for PostgREST to join with Profiles
-- This doesn't strictly enforce but helps the API understand the join.
-- (PostgREST uses any FK relationship to identify join paths)
-- We will point it to profiles(id) BUT drop it if it causes issues.
-- Actually, pointing to auth.users is sufficient if there is a common key.
-- But let's add an explicit FK to profiles as well (now safe since we repaired them).
ALTER TABLE public.vendor_applications DROP CONSTRAINT IF EXISTS vendor_applications_profiles_fkey;
ALTER TABLE public.vendor_applications ADD CONSTRAINT vendor_applications_profiles_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Ensure all other columns exist
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS business_description TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS business_address TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS business_location TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS business_category TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS bvn TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS nin TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS cac_number TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS tin_number TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS cac_url TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS nin_url TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS delivery_type TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS guarantor JSONB;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS socials JSONB;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS subscription_plan TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS subscription_fee NUMERIC;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- 5. FORCED SCHEMA RELOAD
COMMENT ON TABLE public.vendor_applications IS 'Vendor Applications - Profile Repair Fix';
NOTIFY pgrst, 'reload schema';

-- Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vendor_applications';
