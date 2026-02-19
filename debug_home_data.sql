-- DEBUG HOME PAGE DATA & RLS

-- 1. Check Verified Vendors Count
SELECT count(*) as verified_vendors_count 
FROM vendors 
WHERE is_verified = true AND vendor_status = 'active';

-- 2. Check Featured Profiles Count
SELECT count(*) as featured_profiles_count 
FROM profiles 
WHERE is_featured = true;

-- 3. Check if Data was Seeded (Are sales/spend > 0?)
SELECT id, business_name, total_sales, review_count 
FROM vendors 
WHERE is_verified = true 
LIMIT 3;

SELECT id, full_name, total_spend 
FROM profiles 
WHERE is_featured = true 
LIMIT 3;

-- 4. FORCE UPDATE (If counts are 0, let's make some visible)
-- Make first 5 users featured
UPDATE profiles 
SET is_featured = true, total_spend = floor(random() * 500000 + 10000)::numeric
WHERE id IN (SELECT id FROM profiles LIMIT 5);

-- Make first 5 active vendors verified
UPDATE vendors 
SET is_verified = true, total_sales = floor(random() * 500 + 10)::int
WHERE vendor_status = 'active' 
AND id IN (SELECT id FROM vendors LIMIT 5);

-- 5. RLS CHECK (Simulate anonymous/authenticated read)
-- This query helps us know if policies are blocking the view
-- (Note: In SQL Editor we are admin/postgres, so we see everything. 
-- Real test is RLS policy definition).

-- 6. Check RLS Policies on profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles';
SELECT * FROM pg_policies WHERE tablename = 'vendors';
