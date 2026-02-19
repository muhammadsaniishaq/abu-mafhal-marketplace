-- Check if there are any messages between these two users
-- Replace UUIDs with the ones from the log if testing specific pairs
-- Current User: 8f429903-024d-48e8-b7c1-05f15b40aa6b
-- Target/Vendor: 9f58f703-d5f0-422d-a4ae-a2e22bba3c21

SELECT * FROM messages 
WHERE (sender_id = '8f429903-024d-48e8-b7c1-05f15b40aa6b' AND receiver_id = '9f58f703-d5f0-422d-a4ae-a2e22bba3c21')
   OR (sender_id = '9f58f703-d5f0-422d-a4ae-a2e22bba3c21' AND receiver_id = '8f429903-024d-48e8-b7c1-05f15b40aa6b')
ORDER BY created_at DESC;

-- specific check for created_at column existence
SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'created_at';
