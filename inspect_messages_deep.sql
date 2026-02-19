-- Inspect columns and constraints
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'messages';

-- Check if table is in realtime publication
SELECT * FROM pg_publication_tables WHERE tablename = 'messages';
