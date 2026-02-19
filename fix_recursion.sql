-- FIX INFINITE RECURSION IN RLS POLICIES

-- 1. Create a Secure Function to check Admin Status (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Critical: Runs with privileges of the creator (postgres), bypassing RLS
SET search_path = public -- Security best practice
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- 2. Drop the recursive policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can view all brands" ON brands;

-- 3. Re-create policies using the SECURE function
-- Using the function avoids queries hitting the table directly within the policy check

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT
    USING ( check_is_admin() );

CREATE POLICY "Admins can view all vendors" ON public.vendors
    FOR SELECT
    USING ( check_is_admin() );

CREATE POLICY "Admins can view all brands" ON public.brands
    FOR SELECT
    USING ( check_is_admin() );

-- 4. Verify no recursion triggers
SELECT count(*) FROM profiles;
