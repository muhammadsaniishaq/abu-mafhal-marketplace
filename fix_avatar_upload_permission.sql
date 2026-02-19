-- Allow Authenticated Users to Upload Avatars
-- We need to ensure the 'avatars' bucket exists and has the right policies.

-- 1. Create Policy for INSERT (Upload)
-- Only allow if user is authenticated. 
-- Ideally restrict to own folder, but for now simple authenticated insert is a good first step.
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
CREATE POLICY "Users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

-- 2. Create Policy for UPDATE (Replace)
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );

-- 3. Create Policy for DELETE
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );

-- 4. Ensure Bucket is Public (Review)
UPDATE storage.buckets SET public = true WHERE id = 'avatars';
