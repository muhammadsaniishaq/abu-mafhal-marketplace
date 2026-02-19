-- Rename 'link' to 'action_link' if it exists, or create 'action_link' if simpler.
DO $$
BEGIN
    -- Check if 'link' exists and 'action_link' does not
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banners' AND column_name = 'link') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banners' AND column_name = 'action_link') THEN
        ALTER TABLE public.banners RENAME COLUMN link TO action_link;
    -- Else if neither exists (unlikely but safe), add action_link
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banners' AND column_name = 'action_link') THEN
        ALTER TABLE public.banners ADD COLUMN action_link TEXT;
    END IF;
END $$;
