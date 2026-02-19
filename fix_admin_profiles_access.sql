-- FIX ADMIN ACCESS TO PROFILES TABLE
-- 1. Restore Table-Level SELECT permissions (This fixes "Permission Denied")
GRANT SELECT ON TABLE profiles TO authenticated;
GRANT SELECT ON TABLE profiles TO service_role;

-- 2. Make sure RLS is Enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing conflicting policies to start fresh/clean
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 4. Create STRICT RLS Policies

-- A. ADMINS: Can View ALL Profiles (including emails, balances, etc.)
CREATE POLICY "Admins can read all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  is_admin() 
  OR 
  (auth.jwt() ->> 'email') IN ('muhammadsaniisyaku3@gmail.com', 'muhammadsanish0@gmail.com', 'abumafhalhub@gmail.com')
);

-- B. OWNERS: Can View ONLY their OWN Profile
CREATE POLICY "Users can read own profile"
ON profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

-- C. INSERT: Users can create their own profile (Standard)
CREATE POLICY "Users can insert their own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
);

-- D. UPDATE: Admins can update ANY, Owners can update OWN
CREATE POLICY "Admins can update all profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  is_admin()
)
WITH CHECK (
  is_admin()
);

CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);

-- Note: The "Public" cannot access 'profiles' table directly anymore for SELECT.
-- They MUST use the 'public_profiles' VIEW which hides sensitive data.
-- This effectively secures emails and phone numbers from being scraped via the table API.
