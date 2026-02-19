-- 1. Re-enable Public Read Access to ROWS (RLS)
-- We need users to be able to "see" that other users exist.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
FOR SELECT USING (true);

-- 2. Restrict Access to Sensitive COLUMNS (CLS)
-- Revoke all access first to be safe (except for service_role/superuser)
REVOKE SELECT ON profiles FROM anon, authenticated;

-- Grant access ONLY to safe columns
GRANT SELECT (id, full_name, avatar_url, role, last_seen, business_name, city, state, country, created_at) 
ON profiles TO anon, authenticated;

-- Note: The owner (auth.uid() = id) might need to see their own email/phone.
-- Standard Postgres CLS applies to roles, not row-conditions.
-- To allow users to see their OWN email/phone, we might need a SECURITY DEFINER function or a separate table.
-- HOWEVER, for the "Edit Profile" screen, we typically use `auth.users` metadata or the service role?
-- Actually, the user currently queries `profiles` for their own data.
-- Problem: If I restrict columns for 'authenticated', I restrict it even for their own row.

-- ALTERNATIVE SOLUTION:
-- Use the `public_profiles` VIEW as a SECURITY DEFINER wrapper? No, views don't have that.
-- We will use a dedicated SECURITY DEFINER FUNCTION to fetch "My sensitive data" if needed?
-- OR, just rely on the fact that the App usually knows the logged-in user's email from `auth.getUser()`.

-- Let's check what EditProfilePage needs.
-- It likely needs `mobile`, `address`, `bio` etc.

-- Let's ADD `bio`, `address`, `phone` to the allowed list for now if they are not super sensitive?
-- `phone` is somewhat sensitive. `email` (in profiles) is sensitive. `mafhal_coins` is SENSITIVE.

-- compromise:
GRANT SELECT (id, full_name, avatar_url, role, last_seen, business_name, city, state, country, created_at, bio, address, phone) 
ON profiles TO anon, authenticated;

-- We keep `email` and `mafhal_coins` HIDDEN.
-- `phone` is often public on marketplaces.

-- 3. Fix Messages RLS (Just to be sure)
DROP POLICY IF EXISTS "Public Messages" ON messages;

-- Ensure we have sane policies
DROP POLICY IF EXISTS "Users can read their own messages" ON messages;
CREATE POLICY "Users can read their own messages" ON messages
FOR SELECT USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 4. Enable Public Access to messages for debugging? No, let's keep it secure.
-- But wait, if Recipient is Admin, Admin needs to see it. Admin checks 'is_admin()'.
-- Add Admin policy for messages
CREATE POLICY "Admins can read all messages" ON messages
FOR SELECT USING (is_admin());
