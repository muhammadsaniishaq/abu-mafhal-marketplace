-- Inspect vendors table columns explicitly
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public' 
    AND table_name = 'vendors'
ORDER BY ordinal_position;
