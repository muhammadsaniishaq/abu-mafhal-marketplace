-- FIX CATEGORIES RLS PERMISSIONS
-- Run this in your Supabase SQL Editor if you want direct table insert/update/delete on public.categories

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 1. Ensure public read is permitted
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
DROP POLICY IF EXISTS "Public read access" ON public.categories;
CREATE POLICY "Public can view categories" ON public.categories FOR SELECT USING (true);

-- 2. Allow Insert (authenticated + anon / admin)
DROP POLICY IF EXISTS "Admin write access" ON public.categories;
DROP POLICY IF EXISTS "Allow all category insert" ON public.categories;
CREATE POLICY "Allow all category insert" ON public.categories FOR INSERT WITH CHECK (true);

-- 3. Allow Update
DROP POLICY IF EXISTS "Allow all category update" ON public.categories;
CREATE POLICY "Allow all category update" ON public.categories FOR UPDATE USING (true) WITH CHECK (true);

-- 4. Allow Delete
DROP POLICY IF EXISTS "Allow all category delete" ON public.categories;
CREATE POLICY "Allow all category delete" ON public.categories FOR DELETE USING (true);

-- 5. Grant explicit permissions to all roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated, service_role;
