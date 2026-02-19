-- Create the banners table
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_url TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    link TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (Check if exists first)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'banners' AND policyname = 'Public Read Banners') THEN
        CREATE POLICY "Public Read Banners"
        ON public.banners FOR SELECT
        USING (true);
    END IF;
END $$;

-- Allow all access to authenticated users (admin) (Check if exists first)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'banners' AND policyname = 'Admin Manage Banners') THEN
        CREATE POLICY "Admin Manage Banners"
        ON public.banners FOR ALL
        USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Create storage bucket for banners if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public access to banner images
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Banners') THEN
        CREATE POLICY "Public Access Banners"
        ON storage.objects FOR SELECT
        USING ( bucket_id = 'banners' );
    END IF;
END $$;

-- Allow authenticated users to upload banner images
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin Upload Banners') THEN
        CREATE POLICY "Admin Upload Banners"
        ON storage.objects FOR INSERT
        WITH CHECK ( bucket_id = 'banners' AND auth.role() = 'authenticated' );
    END IF;
END $$;
