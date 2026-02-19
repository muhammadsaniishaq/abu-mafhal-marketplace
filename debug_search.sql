-- Check RLS Policies and Columns for Search Debugging

-- 1. Check vendors columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vendors';

-- 2. Check profiles columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';

-- 3. Check for specific vendor data to see what fields are populated
SELECT id, business_name, store_name, owner_name FROM vendors LIMIT 5;

-- 4. Check for specific profile data
SELECT id, full_name, username, email FROM profiles LIMIT 5;

-- 5. Check RLS Policies on vendors
SELECT * FROM pg_policies WHERE tablename = 'vendors';

-- 6. Check RLS Policies on profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles';
