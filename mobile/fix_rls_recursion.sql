-- FINAL FIX: Row Level Security for Drivers & Orders
-- This script fixes the "Infinite Recursion" and ensures Admins can see all data.

-- 1. CLEANUP: Remove old/bad policies
-- Drivers table cleanup
DROP POLICY IF EXISTS "Drivers can view themselves" ON drivers;
DROP POLICY IF EXISTS "view_drivers" ON drivers;
DROP POLICY IF EXISTS "Drivers can view their own record" ON drivers;
DROP POLICY IF EXISTS "Users can view their own driver record" ON drivers;
DROP POLICY IF EXISTS "Admin view all, Drivers view self" ON drivers;

-- Orders table cleanup
DROP POLICY IF EXISTS "Drivers can view their assigned orders" ON orders;
DROP POLICY IF EXISTS "view_orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;

-- 2. DRIVERS TABLE POLICIES
-- Policy 1: Drivers see their own record
CREATE POLICY "Drivers view self" 
ON drivers FOR SELECT 
USING (user_id = auth.uid());

-- Policy 2: Admins see all drivers
-- We use a direct subquery to profiles. Note: This assumes profiles has a SELECT policy.
CREATE POLICY "Admins view all drivers" 
ON drivers FOR SELECT 
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 3. ORDERS TABLE POLICIES
-- Policy 1: Customers see their own orders
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
CREATE POLICY "Users view own orders" 
ON orders FOR SELECT 
USING (user_id = auth.uid());

-- Policy 2: Drivers see orders assigned to them
CREATE POLICY "Drivers view assigned orders" 
ON orders FOR SELECT 
USING (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);

-- Policy 3: Admins see all orders
CREATE POLICY "Admins view all orders" 
ON orders FOR SELECT 
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 4. Ensure RLS is enabled
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 5. Give service_role full access (Supabase internal tools)
-- Usually enabled by default, but good for stability.
ALTER TABLE drivers FORCE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
