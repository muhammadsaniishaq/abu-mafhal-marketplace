-- Fix Admin Profile Name
UPDATE profiles 
SET full_name = 'Abu Mafhal Admin' 
WHERE role = 'admin' AND full_name IS NULL;

-- Verify
SELECT * FROM profiles WHERE role = 'admin';
