-- 1. Make the 'products' bucket public (So images can be seen by everyone)
UPDATE storage.buckets
SET public = true
WHERE id = 'products';

-- 2. Allow everyone to VIEW images (RESOLVES WHITE IMAGE ISSUE)
-- specific policy names to avoid conflicts if they exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Products'
    ) THEN
        CREATE POLICY "Public Access Products"
        ON storage.objects FOR SELECT
        USING ( bucket_id = 'products' );
    END IF;
END
$$;

-- 3. Allow logged-in users to UPLOAD images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Vendor Upload Products'
    ) THEN
        CREATE POLICY "Vendor Upload Products"
        ON storage.objects FOR INSERT
        WITH CHECK ( bucket_id = 'products' AND auth.role() = 'authenticated' );
    END IF;
END
$$;
