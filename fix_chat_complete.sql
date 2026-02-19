-- 1. Add missing column 'last_seen' to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();

-- 2. Grant Permissions
-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow Public Read Access to rows (needed for discovery)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
FOR SELECT USING (true);

-- Revoke all access first
REVOKE SELECT ON profiles FROM anon, authenticated;

-- Grant access ONLY to safe columns (now including last_seen)
GRANT SELECT (id, full_name, avatar_url, role, last_seen, business_name, city, state, country, created_at, bio, address, phone) 
ON profiles TO anon, authenticated;

-- 3. Fix Messages RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own messages" ON messages;
CREATE POLICY "Users can read their own messages" ON messages
FOR SELECT USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Allow Admins to read all
DROP POLICY IF EXISTS "Admins can read all messages" ON messages;
CREATE POLICY "Admins can read all messages" ON messages
FOR SELECT USING (is_admin());
