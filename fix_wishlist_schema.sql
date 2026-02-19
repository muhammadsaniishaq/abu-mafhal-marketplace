-- Standardize Wishlist Schema
-- Convert wishlists to use a JSONB array for items, matching the frontend state logic.

DO $$ 
BEGIN 
    -- 1. Check if the table has 'product_id' (old relational format)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wishlists' AND column_name = 'product_id') THEN
        -- Drop the old table to replace it with the array-based one
        DROP TABLE public.wishlists;
    END IF;

    -- 2. Create the array-based wishlists table
    CREATE TABLE IF NOT EXISTS public.wishlists (
        id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
        items jsonb DEFAULT '[]'::jsonb,
        updated_at timestamptz DEFAULT now()
    );

    -- 3. Enable RLS
    ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

    -- 4. Policies
    DROP POLICY IF EXISTS "Users can manage own wishlist" ON public.wishlists;
    CREATE POLICY "Users can manage own wishlist" 
    ON public.wishlists FOR ALL 
    USING (auth.uid() = id);

END $$;
