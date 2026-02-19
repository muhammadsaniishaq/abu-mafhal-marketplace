-- Check Privileges/Grants on profiles table
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'profiles';

-- Also check column privileges if any
SELECT grantee, column_name, privilege_type 
FROM information_schema.column_privileges 
WHERE table_name = 'profiles';
