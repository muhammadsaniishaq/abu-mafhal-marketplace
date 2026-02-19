-- CHECK AVATARS
SELECT id, full_name, avatar_url, is_featured 
FROM profiles 
WHERE is_featured = true;
