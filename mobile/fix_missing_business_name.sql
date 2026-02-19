-- Fix missing business_name column in vendors table
DO $$ 
BEGIN 
    -- 1. Check if vendors table exists and add business_name if missing
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendors') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'business_name') THEN
            ALTER TABLE public.vendors ADD COLUMN business_name TEXT;
        END IF;
    END IF;

    -- 2. Check if profiles table exists and add business_name if missing (referenced in triggers)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'business_name') THEN
            ALTER TABLE public.profiles ADD COLUMN business_name TEXT;
        END IF;
    END IF;
END $$;

-- Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
