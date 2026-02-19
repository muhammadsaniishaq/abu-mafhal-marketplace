-- Create Carts Table for Server-Side Sync (Idempotent)
CREATE TABLE IF NOT EXISTS public.carts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE, -- One cart per user
    items jsonb DEFAULT '[]'::jsonb, 
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- RLS (Drop first to avoid errors if exists)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users view own cart" ON public.carts;
    DROP POLICY IF EXISTS "Users insert/update own cart" ON public.carts;
END $$;

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cart" 
ON public.carts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users insert/update own cart" 
ON public.carts FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_updated_at' AND tgrelid = 'public.carts'::regclass) THEN
        CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.carts
        FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
