SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('brands', 'reviews', 'users') 
ORDER BY table_name, column_name;
