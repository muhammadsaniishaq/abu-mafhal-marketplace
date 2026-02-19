-- 1. Ensure is_admin() is SECURITY DEFINER to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Critical!
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
END;
$$;

-- 2. Drop existing restrictive policies on profiles to avoid conflicts
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- 3. Re-create robust policies
-- Admin Access (Uses the SECURITY DEFINER function)
CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING ( is_admin() );

-- Public Access (If you want limited access, but for now let's ensure basic read works for app stability,
-- or strictly restrict. The previous error suggests 'permission denied', so standard auth user couldn't see it.)
-- Let's stick to: Users can see their own.
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING ( auth.uid() = id );

-- FIX for Vendor Applications Join:
-- When AdminVendors fetches `vendor_applications`, it joins `profiles`.
-- The user is an Admin. `is_admin()` should return true.
-- So "Admins can read all profiles" SHOULD pass.

-- 4. GRANT Usage just in case
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.profiles TO authenticated;

-- 5. Debug Helper: Allow reading basic info if necessary (Fallback)
-- If is_admin() fails for some reason, we might want to allow reading basic fields?
-- No, let's trust is_admin() if defined correctly.

-- 6. Ensure vendor_applications is readable
GRANT SELECT ON public.vendor_applications TO authenticated;
CREATE POLICY "Admins can manage vendor applications"
ON public.vendor_applications
FOR ALL
TO authenticated
USING ( is_admin() ); 

-- Add a policy for users to see/create their OWN applications
CREATE POLICY "Users can see own applications"
ON public.vendor_applications
FOR SELECT
TO authenticated
USING ( auth.uid() = user_id );

CREATE POLICY "Users can create applications"
ON public.vendor_applications
FOR INSERT
TO authenticated
WITH CHECK ( auth.uid() = user_id );
