-- FIX DUPLICATES
-- 1. Delete older duplicates, keeping only the most recent one for each user.
DELETE FROM public.vendor_applications a
USING public.vendor_applications b
WHERE a.id < b.id
AND a.user_id = b.user_id;

-- 2. Add a UNIQUE constraint to prevent this from happening again.
ALTER TABLE public.vendor_applications
ADD CONSTRAINT unique_user_application UNIQUE (user_id);
