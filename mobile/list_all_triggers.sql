-- List ALL triggers in the public schema
SELECT 
    event_object_table AS table_name, 
    trigger_name, 
    event_manipulation AS event, 
    action_statement AS definition 
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY table_name, trigger_name;
