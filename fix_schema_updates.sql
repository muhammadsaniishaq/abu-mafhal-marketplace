-- COMPREHENSIVE SCHEMA FIX
-- Standards: snake_case for all columns, handles potential renaming collisions.

DO $$ 
BEGIN 
    -- ==========================================
    -- 1. NOTIFICATIONS TABLE FIXES
    -- ==========================================
    
    -- Rename 'read' to 'is_read' if 'read' exists AND 'is_read' DOES NOT
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
        ALTER TABLE public.notifications RENAME COLUMN "read" TO is_read;
    END IF;

    -- Ensure 'is_read' exists (if both were somehow missing)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
        ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    END IF;

    -- Standardize userId -> user_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'userId') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
        ALTER TABLE public.notifications RENAME COLUMN "userId" TO user_id;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'userId') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
        -- Both exist: Sync data then drop old one
        UPDATE public.notifications SET user_id = "userId" WHERE user_id IS NULL AND "userId" IS NOT NULL;
        -- ALTER TABLE public.notifications DROP COLUMN "userId"; -- Optional: safer to keep until verified
    END IF;

    -- ==========================================
    -- 2. BUSINESS NAME ADDITIONS
    -- ==========================================

    -- PROFILES table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'business_name') THEN
            ALTER TABLE public.profiles ADD COLUMN business_name TEXT;
        END IF;

        -- Sync from camelCase if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'businessName') THEN
            UPDATE public.profiles SET business_name = "businessName" WHERE business_name IS NULL;
        END IF;
    END IF;

    -- VENDORS table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendors') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'business_name') THEN
            ALTER TABLE public.vendors ADD COLUMN business_name TEXT;
        END IF;

        -- Sync from camelCase if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'businessName') THEN
            UPDATE public.vendors SET business_name = "businessName" WHERE business_name IS NULL;
        END IF;
    END IF;

    -- USERS table (as fallback/alternate schema name)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'business_name') THEN
            ALTER TABLE public.users ADD COLUMN business_name TEXT;
        END IF;
    END IF;

END $$;
