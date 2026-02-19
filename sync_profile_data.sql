-- Sync Auth Metadata to Profiles Table
-- This pulls the name and other details from the "hidden" auth area to the "public" profile area

UPDATE profiles
SET 
  full_name = (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE auth.users.id = profiles.id),
  avatar_url = (SELECT raw_user_meta_data->>'avatar_url' FROM auth.users WHERE auth.users.id = profiles.id),
  phone = (SELECT raw_user_meta_data->>'phone_number' FROM auth.users WHERE auth.users.id = profiles.id),
  bio = (SELECT raw_user_meta_data->>'bio' FROM auth.users WHERE auth.users.id = profiles.id),
  city = (SELECT raw_user_meta_data->>'location' FROM auth.users WHERE auth.users.id = profiles.id)
WHERE 
  profiles.id = '9f58f703-d5f0-422d-a4ae-a2e22bba3c21';

-- Verify the update
SELECT * FROM profiles WHERE id = '9f58f703-d5f0-422d-a4ae-a2e22bba3c21';
