-- Add sender_email to business_settings if it doesn't exist
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS sender_email TEXT DEFAULT 'onboarding@resend.dev';

-- Comment: User should update this to their verified domain email (e.g., info@abumafhal.com)
