-- 1. Create 'products' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'products', 
    'products', 
    true, 
    52428800, -- 50MB limit (optional)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];

-- 2. Policy to allow public access (View)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'products');

-- 3. Policy to allow authenticated uploads (Insert)
DROP POLICY IF EXISTS "Authenticated Uploads" ON storage.objects;
CREATE POLICY "Authenticated Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products');

-- 4. Policy to allow owners to update/delete
DROP POLICY IF EXISTS "Owner Update/Delete" ON storage.objects;
CREATE POLICY "Owner Update/Delete"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'products' AND auth.uid() = owner);
