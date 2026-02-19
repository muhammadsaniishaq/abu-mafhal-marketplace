-- Update the sender_email to the verified one provided by user
UPDATE public.business_settings
SET sender_email = 'support@abumafhal.com'
WHERE id = 'default';

-- Ensure the column exists if it didn't (safeguard)
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS sender_email TEXT DEFAULT 'support@abumafhal.com';
