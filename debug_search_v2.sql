-- DEBUG SEARCH V2 (Column Name Verification)

-- 1. Check vendors table columns (Is it businessName or business_name?)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'vendors';

-- 2. Check profiles table columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles';

-- 3. Check brands table columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'brands';

-- 4. Check if we can select from vendors (Admin Check)
SELECT count(*) as vendor_count FROM vendors;

-- 5. See raw data to confirm content
SELECT * FROM vendors LIMIT 3;
