-- FORCE PUBLIC ACCESS TO PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop any existing restrictive policies
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can select profiles" ON public.profiles;

-- Create a catch-all PUBLIC view policy
CREATE POLICY "Everyone can view profiles" 
ON public.profiles FOR SELECT 
USING (true);

-- Grant permissions explicitly
GRANT SELECT ON public.profiles TO anon, authenticated, service_role;


-- FORCE PUBLIC ACCESS TO AVATARS BUCKET
-- Note: structural updates to storage.objects might fail if managed by Supabase, 
-- but adding policies usually works.

-- Drop old policies to be clean
DROP POLICY IF EXISTS "Public Access Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatars Public View" ON storage.objects;

-- Create Permissive Policy for Avatars
CREATE POLICY "Avatars Public View"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Ensure the bucket is public
UPDATE storage.buckets
SET public = true
WHERE id = 'avatars';
