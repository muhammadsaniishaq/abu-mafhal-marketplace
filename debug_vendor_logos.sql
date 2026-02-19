-- DEBUG VENDOR LOGOS (Where is the image?)

-- 1. Check Vendor Applications (Maybe it's here?)
SELECT id, business_name, logo_url, status 
FROM vendor_applications 
LIMIT 5;

-- 2. Check Profiles linked to Vendors (Maybe it's user's avatar?)
-- Assuming vendors has a profile_id or user_id
SELECT v.id as vendor_id, v.store_name, v.logo_url as vendor_logo, 
       p.id as profile_id, p.full_name, p.avatar_url as profile_avatar
FROM vendors v
LEFT JOIN profiles p ON v.id::text = p.id::text OR v.owner_id = p.id -- Guessing join condition
LIMIT 5;

-- 3. Check table columns for vendors again to be sure
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'vendors' 
AND column_name ILIKE '%url%' OR column_name ILIKE '%image%' OR column_name ILIKE '%logo%';
