-- Add cert_logo_url column (Logo on Certificate)
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS cert_logo_url TEXT;

-- Add cert_badge_url column (Badge/Seal on Certificate)
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS cert_badge_url TEXT;
