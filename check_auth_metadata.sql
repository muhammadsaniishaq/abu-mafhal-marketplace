-- Check auth.users metadata for the specific user
SELECT id, email, raw_user_meta_data 
FROM auth.users 
WHERE id = '9f58f703-d5f0-422d-a4ae-a2e22bba3c21';
