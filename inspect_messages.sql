-- Inspect messages table schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'messages';

-- Inspect RLS policies for messages
SELECT * FROM pg_policies WHERE tablename = 'messages';
