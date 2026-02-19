-- Inspect latest 10 messages to see if 'message' and 'product_id' are being saved
SELECT id, sender_id, receiver_id, message, product_id, created_at 
FROM messages 
ORDER BY created_at DESC 
LIMIT 10;
