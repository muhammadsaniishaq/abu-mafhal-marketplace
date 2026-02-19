-- Fix Storage Policies for app-assets to ensure invoices can be uploaded
-- 1. Create bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. ENABLE RLS (Typically enabled by default; skipping to avoid permission errors)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. ALLOW PUBLIC READ (So users can download PDFs)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'app-assets' );

-- 4. ALLOW AUTHENTICATED UPLOAD (For logged in users/admin)
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'app-assets' AND auth.role() = 'authenticated' );

-- 5. ALLOW PUBLIC UPLOAD (TEMPORARY FIX if specific auth fails on mobile)
-- Uncomment below if authentication is the issue
-- DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
-- CREATE POLICY "Public Upload" ON storage.objects FOR INSERT 
-- WITH CHECK ( bucket_id = 'app-assets' );
