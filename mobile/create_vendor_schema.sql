-- Create Vendor Applications Table
CREATE TABLE IF NOT EXISTS public.vendor_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Business Info
    business_name TEXT,
    business_description TEXT,
    business_address TEXT,
    business_location TEXT,
    business_category TEXT,
    
    -- Registration Numbers
    cac_number TEXT,
    tin_number TEXT,
    bvn TEXT,
    nin TEXT,
    
    -- Documents (URLs)
    logo_url TEXT,
    video_url TEXT,
    nin_url TEXT,
    cac_url TEXT,
    
    -- Logistics
    delivery_type TEXT, -- 'marketplace' or 'self'
    
    -- Guarantor (JSONB for flexibility)
    guarantor JSONB, 
    
    -- Socials (JSONB)
    socials JSONB,
    
    -- Subscription Plan
    subscription_plan TEXT,
    subscription_fee NUMERIC,
    subscription_expiry TIMESTAMPTZ,
    
    -- Banking
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    payment_status TEXT DEFAULT 'pending',
    payment_reference TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;

-- Users can create their own application
DROP POLICY IF EXISTS "Users can insert own application" ON public.vendor_applications;
CREATE POLICY "Users can insert own application" ON public.vendor_applications 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own application
DROP POLICY IF EXISTS "Users can view own application" ON public.vendor_applications;
CREATE POLICY "Users can view own application" ON public.vendor_applications 
FOR SELECT USING (auth.uid() = user_id);

-- Admins (Service Role) have full access - assumed handled by role or disabled RLS for service key


-- STORAGE FOR DOCUMENTS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vendor-docs', 'vendor-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- 1. Allow authenticated users to upload
DROP POLICY IF EXISTS "Vendor Uploads" ON storage.objects;
CREATE POLICY "Vendor Uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vendor-docs');

-- 2. Allow public/authenticated read (Depending on privacy needs, usually restricted, but for MVP/Admin review public is easier to debug)
DROP POLICY IF EXISTS "Vendor Reads" ON storage.objects;
CREATE POLICY "Vendor Reads" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'vendor-docs');
