-- FIX INFINITE RECURSION IN RLS

-- 1. Create a helper function to check admin status securely
-- SECURITY DEFINER means it runs with system privileges, bypassing RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Drop the buggy recursive policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 3. Create the new safe policy using the function
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  public.is_admin()
);
