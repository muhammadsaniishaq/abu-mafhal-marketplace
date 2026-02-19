-- DEBUG VENDOR LOGOS V2 (Fixed Column Names)

-- 1. Check Vendor Applications (Is the logo here?)
SELECT id, business_name, logo_url, status
FROM vendor_applications 
LIMIT 5;

-- 2. Check Profiles linked to Vendors (Is it the user's avatar?)
-- Assuming user_id is the foreign key (based on postgres hints)
SELECT v.id as vendor_id, v.store_name, v.logo_url as vendor_logo, 
       p.id as profile_id, p.full_name, p.avatar_url as profile_avatar
FROM vendors v
LEFT JOIN profiles p ON v.id = p.id OR v.user_id = p.id  -- Fixed: owner_id -> user_id
LIMIT 5;

-- 3. Check for any logo columns in vendors just in case
SELECT column_name
FROM information_schema.columns 
WHERE table_name = 'vendors' 
AND (column_name ILIKE '%url%' OR column_name ILIKE '%image%' OR column_name ILIKE '%logo%');
