-- Run this in Supabase SQL Editor to check table columns
-- This helps debug the "column vendor_id does not exist" error

SELECT 
    table_name, 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public' 
    AND column_name IN ('vendor_id', 'user_id')
ORDER BY 
    table_name;

-- Standardize:
-- products -> MUST have vendor_id
-- orders -> MUST have ONLY user_id (not vendor_id)
-- order_items -> MUST have vendor_id
-- wallets -> MUST have vendor_id
-- vendor_requests -> Should have user_id (not vendor_id)
-- payments -> Should have user_id (not vendor_id)
