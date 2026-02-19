-- 1. Enable Realtime for messages table
-- This is often the reason why "messages don't arrive" immediately
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 2. Ensure critical columns exist and are correct
-- We use 'message' in the App, so we ensure it exists.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url text;

-- 3. Fix potential "Ambiguous Column" issues by dropping confusing unused ones (?)
-- Optional: If you want to clean up, uncomment the lines below.
-- ALTER TABLE messages DROP COLUMN IF EXISTS text;
-- ALTER TABLE messages DROP COLUMN IF EXISTS "createdAt";

-- 4. Grant full access to Authenticated users (Simple Fix for now)
GRANT ALL ON messages TO authenticated;
GRANT ALL ON messages TO service_role;

-- 5. Ensure Sequence is correct (if id is serial, but it looks like uuid)
-- If id is UUID, it should have a default
ALTER TABLE messages ALTER COLUMN id SET DEFAULT gen_random_uuid();
