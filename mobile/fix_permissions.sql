-- FIX PERMISSIONS & TABLES (SAFE DROP & RECREATE)
-- We drop existing policies first to avoid "ERROR: 42710"

-- 1. Create Admins Policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- 2. Allow users to insert their own profile (for Signup)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK ( auth.uid() = id );

-- 3. Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING ( auth.uid() = id );

-- 4. EMERGENCY: Grant full access to service_role (just in case)
GRANT ALL ON public.profiles TO service_role;

-- 5. Backfill Script (Safe)
-- If you have users in auth.users but not in profiles, this will fix them.
-- This part likely didn't run last time because of the error.
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;
