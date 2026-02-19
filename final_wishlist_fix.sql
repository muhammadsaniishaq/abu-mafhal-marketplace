-- FINAL WISH-LIST SCHEMA FIX (ROBUST)
-- Standardizes wishlists to a 1-to-1 table with 'id' (User UUID) and 'items' (JSONB Array)

DO $$ 
BEGIN 
    -- 1. DROP old table to ensure clean slate (standardizes format)
    -- WARNING: This clears old wishlist data but is necessary for structural alignment.
    DROP TABLE IF EXISTS public.wishlists;

    -- 2. CREATE robust table
    CREATE TABLE public.wishlists (
        id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
        items jsonb DEFAULT '[]'::jsonb,
        updated_at timestamptz DEFAULT now()
    );

    -- 3. ENABLE RLS
    ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

    -- 4. POLICIES
    -- Users can manage their own row
    DROP POLICY IF EXISTS "Users can manage own wishlist" ON public.wishlists;
    CREATE POLICY "Users can manage own wishlist" 
    ON public.wishlists FOR ALL 
    USING (auth.uid() = id);

END $$;
