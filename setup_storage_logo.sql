-- 1. Create the 'app-assets' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public access to read files in 'app-assets'
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'app-assets' );

-- 3. Allow authenticated users to upload files to 'app-assets'
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'app-assets' AND auth.role() = 'authenticated' );

-- 4. Allow authenticated users to update/delete files
DROP POLICY IF EXISTS "Admin Update" ON storage.objects;
CREATE POLICY "Admin Update" ON storage.objects FOR UPDATE USING ( bucket_id = 'app-assets' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
CREATE POLICY "Admin Delete" ON storage.objects FOR DELETE USING ( bucket_id = 'app-assets' AND auth.role() = 'authenticated' );
