-- FIX VENDOR LOGOS (Verified Sellers)

-- 1. Update Mock Vendor
UPDATE vendors 
SET logo_url = 'https://ui-avatars.com/api/?name=Mock+Vendor&background=0D8ABC&color=fff&size=200'
WHERE store_name ILIKE '%mock%';

-- 2. Update Abu Mafhal Ltd
UPDATE vendors 
SET logo_url = 'https://ui-avatars.com/api/?name=Abu+Mafhal&background=random&size=200'
WHERE store_name ILIKE '%abu mafhal%';

-- 3. Catch-all for any other verified vendor missing a logo
UPDATE vendors 
SET logo_url = 'https://ui-avatars.com/api/?name=Verified+Seller&background=random&size=200'
WHERE is_verified = true AND (logo_url IS NULL OR logo_url = 'null');

-- 4. Verify updates
SELECT id, store_name, logo_url FROM vendors WHERE is_verified = true;
