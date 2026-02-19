-- PART 2: CLEANUP
-- Run this ONLY after running fix_status_enum.sql

UPDATE public.products 
SET status = 'archived' 
WHERE name LIKE 'Premium Item%' 
OR name LIKE 'Mock%';
