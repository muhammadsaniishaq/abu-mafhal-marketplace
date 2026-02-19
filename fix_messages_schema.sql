-- Fix messages table timestamp column
-- App expects 'created_at', but DB has 'createdAt' or 'inserted_at'

-- 1. Add created_at if it doesn't exist
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- 2. Backfill created_at from inserted_at or createdAt
UPDATE messages 
SET created_at = COALESCE(inserted_at, "createdAt", created_at);

-- 3. Ensure RLS is still good (idempotent)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. Double check policies
DROP POLICY IF EXISTS "Users can read their own messages" ON messages;
CREATE POLICY "Users can read their own messages" ON messages
FOR SELECT USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
FOR INSERT WITH CHECK (auth.uid() = sender_id);
