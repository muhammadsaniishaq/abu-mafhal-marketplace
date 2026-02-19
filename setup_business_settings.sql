-- Create a table for global business settings
CREATE TABLE IF NOT EXISTS public.business_settings (
    id TEXT PRIMARY KEY DEFAULT 'default', -- Single row for now
    name TEXT DEFAULT 'Abu Mafhal Ltd',
    address TEXT DEFAULT 'Gashua, Yobe State',
    phone TEXT DEFAULT '+234 814 585 3539',
    email TEXT DEFAULT 'abumafhalhub@gmail.com',
    website TEXT DEFAULT 'https://abumafhal.com',
    logo_url TEXT,
    stamp_url TEXT,
    signature_url TEXT,
    footer_text TEXT DEFAULT 'Thank you for your patronage!',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read (for invoices)
CREATE POLICY "Public can view business settings" ON public.business_settings
    FOR SELECT USING (true);

-- Allow admins to update (assuming admin check or just authenticated for now)
CREATE POLICY "Admins can update business settings" ON public.business_settings
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert business settings" ON public.business_settings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create Storage Bucket for Business Assets if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('business_assets', 'business_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Renamed to avoid conflicts)
CREATE POLICY "Public Access Business Assets" ON storage.objects FOR SELECT
USING ( bucket_id = 'business_assets' );

CREATE POLICY "Auth Upload Business Assets" ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'business_assets' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Update Business Assets" ON storage.objects FOR UPDATE
USING ( bucket_id = 'business_assets' AND auth.role() = 'authenticated' );
