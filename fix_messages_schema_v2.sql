-- Fix messages table timestamp column (v2)
-- Removing dependency on 'inserted_at' which caused an error.

-- 1. Add created_at if it doesn't exist
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- 2. Backfill created_at from createdAt (quoted for case sensitivity)
-- If createdAt is null, it defaults to DEFAULT now() from step 1, or we can force it.
UPDATE messages 
SET created_at = "createdAt"
WHERE created_at IS NULL AND "createdAt" IS NOT NULL;

-- 3. Ensure RLS is enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. Re-apply Policies (Safe to run multiple times)
DROP POLICY IF EXISTS "Users can read their own messages" ON messages;
CREATE POLICY "Users can read their own messages" ON messages
FOR SELECT USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Admins can read all messages" ON messages;
CREATE POLICY "Admins can read all messages" ON messages
FOR SELECT USING (is_admin());
