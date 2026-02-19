-- Add 'section' column to banners table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banners' AND column_name = 'section') THEN
        ALTER TABLE public.banners ADD COLUMN section TEXT DEFAULT 'home';
    END IF;
END $$;

-- Optional: Add a check constraint to ensure valid sections
-- ALTER TABLE public.banners ADD CONSTRAINT valid_section CHECK (section IN ('landing', 'home', 'shop'));
