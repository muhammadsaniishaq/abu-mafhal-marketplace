-- FIX NOTIFICATIONS SCHEMA
-- The error "column notifications.created_at does not exist" suggests a mismatch (likely CamelCase vs snake_case).

DO $$
BEGIN
    -- 1. Check if 'createdAt' exists and 'created_at' does NOT
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'createdAt') 
       AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'created_at') THEN
       
        -- Rename it to snake_case for consistency with Supabase standards
        ALTER TABLE public.notifications RENAME COLUMN "createdAt" TO created_at;
        
    -- 2. If NEITHER exists, create 'created_at'
    ELSIF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'created_at') THEN
        ALTER TABLE public.notifications ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- 3. Also check 'userId' vs 'user_id' which is common
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'userId') 
       AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
        ALTER TABLE public.notifications RENAME COLUMN "userId" TO user_id;
    END IF;

END $$;
