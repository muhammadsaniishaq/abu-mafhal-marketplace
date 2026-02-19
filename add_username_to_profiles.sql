-- Add username column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Verify
SELECT * FROM public.profiles LIMIT 1;
