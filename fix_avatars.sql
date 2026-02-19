-- FIX MISSING AVATARS FOR FEATURED PROFILES

-- 1. Update CEO with a professional avatar
UPDATE profiles 
SET avatar_url = 'https://ui-avatars.com/api/?name=CEO+AbuMafhal&background=random&size=200'
WHERE full_name ILIKE '%ceo%' OR email ILIKE '%ceo%';

-- 2. Update Abu Mafhal with brand avatar
UPDATE profiles 
SET avatar_url = 'https://ui-avatars.com/api/?name=Abu+Mafhal&background=0D8ABC&color=fff&size=200'
WHERE full_name ILIKE '%abu mafhal%';

-- 3. Update Muhammad Sani (fix local file path issue)
UPDATE profiles 
SET avatar_url = 'https://ui-avatars.com/api/?name=Muhammad+Sani&background=random&size=200'
WHERE full_name ILIKE '%muhammad%';

-- 4. Update any featured profile with NULL avatar
UPDATE profiles 
SET avatar_url = 'https://ui-avatars.com/api/?name=Valued+Customer&background=random&size=200'
WHERE is_featured = true AND (avatar_url IS NULL OR avatar_url = 'null');

-- 5. Verify updates
SELECT id, full_name, avatar_url FROM profiles WHERE is_featured = true;
