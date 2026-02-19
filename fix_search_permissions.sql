-- FIX ADMIN SEARCH PERMISSIONS (CORRECTED)
-- This script adds RLS policies to allow Admins to search/view ALL vendors and profiles.
-- Corrected: Uses 'role' column instead of non-existent 'is_admin' column.

-- 1. DROP EXISTING POLICIES TO AVOID CONFLICTS
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can view all brands" ON brands;

-- 2. Allow Admins to View All Profiles (for "Elite Customers" search)
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT
    USING ( 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' 
    );

-- 3. Allow Admins to View All Vendors (for "Verify Seller" search)
CREATE POLICY "Admins can view all vendors" ON public.vendors
    FOR SELECT
    USING ( 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' 
    );

-- 4. Allow Admins to View All Brands
CREATE POLICY "Admins can view all brands" ON public.brands
    FOR SELECT
    USING ( 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' 
    );

-- 5. VERIFY (Safe Query)
-- This confirms the admin can see more than just their own data
SELECT count(*) as total_vendors FROM vendors;
