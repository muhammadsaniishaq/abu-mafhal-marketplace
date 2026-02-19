-- Investigation Query: Check existing policies on the drivers table
-- This is a diagnostic script to help find the recursive policy.

SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename = 'drivers';
