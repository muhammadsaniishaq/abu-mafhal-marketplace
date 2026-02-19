-- Create a secure view for public profile data
CREATE OR REPLACE VIEW public_profiles AS
SELECT 
    id,
    full_name,
    avatar_url,
    role,
    business_name,
    city,
    state,
    country,
    created_at,
    last_seen
FROM profiles;

-- Grant access to the view
GRANT SELECT ON public_profiles TO anon, authenticated, service_role;

-- Update RLS on the main profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 1. Users can read their own profile (FULL ACCESS)
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
FOR SELECT USING (auth.uid() = id);

-- 2. Admins can read all profiles (FULL ACCESS)
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles" ON profiles
FOR SELECT USING (is_admin());

-- 4. REMOVE PUBLIC ACCESS POLICY
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
