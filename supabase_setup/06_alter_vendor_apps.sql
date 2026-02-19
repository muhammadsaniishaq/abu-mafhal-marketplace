-- Add missing columns to existing vendor_applications table
ALTER TABLE public.vendor_applications 
ADD COLUMN IF NOT EXISTS bvn text,
ADD COLUMN IF NOT EXISTS nin text,
ADD COLUMN IF NOT EXISTS cac_number text,
ADD COLUMN IF NOT EXISTS tin_number text,
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS video_url text,
ADD COLUMN IF NOT EXISTS nin_url text,
ADD COLUMN IF NOT EXISTS cac_url text,
ADD COLUMN IF NOT EXISTS delivery_type text,
ADD COLUMN IF NOT EXISTS guarantor jsonb,
ADD COLUMN IF NOT EXISTS socials jsonb,
ADD COLUMN IF NOT EXISTS admin_notes text;

-- Ensure RLS
ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;

-- Add policies if they don't exist (DO block logic or just attempt creation which might fail if exists, better to use DO)
DO $$ BEGIN
    CREATE POLICY "Users view own applications" ON public.vendor_applications FOR SELECT USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users create applications" ON public.vendor_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins manage applications" ON public.vendor_applications FOR ALL USING (public.is_admin());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
