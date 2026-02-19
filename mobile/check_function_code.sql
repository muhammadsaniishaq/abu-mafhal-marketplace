-- Check the actual code stored in the database
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'handle_vendor_application_updates';
