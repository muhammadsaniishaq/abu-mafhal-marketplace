-- Check if messages table has product_id or similar
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages';
