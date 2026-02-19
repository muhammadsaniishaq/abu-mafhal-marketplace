-- EMERGENCY FIX: Infinite Recursion in RLS
-- This script uses SECURITY DEFINER functions to break the recursion loop.

-- 1. Create helper functions that bypass RLS
-- These functions run with the privileges of the creator (postgres), 
-- so they don't trigger RLS checks themselves.

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- This is the key to breaking recursion
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_driver_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT id FROM public.drivers WHERE user_id = auth.uid() LIMIT 1);
END;
$$;

-- 2. Clean up ALL existing policies on drivers and orders
-- We drop everything to ensure no hidden recursive policies remain.
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('drivers', 'orders')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. Implement NEW, simple, non-recursive policies

-- DRIVERS Table
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers_select_policy" 
ON public.drivers FOR SELECT 
USING (
  user_id = auth.uid() OR check_is_admin()
);

-- ORDERS Table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_policy" 
ON public.orders FOR SELECT 
USING (
  user_id = auth.uid() OR -- Customer
  driver_id = get_my_driver_id() OR -- Driver
  check_is_admin() -- Admin
);

-- Allow updates for drivers (status/assignment)
CREATE POLICY "orders_update_policy" 
ON public.orders FOR UPDATE
USING (
  user_id = auth.uid() OR 
  driver_id = get_my_driver_id() OR 
  check_is_admin()
);

-- 4. Verify RLS is actually on
ALTER TABLE public.drivers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
