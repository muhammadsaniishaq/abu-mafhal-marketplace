-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    description text,
    image_url text,
    parent_id uuid REFERENCES public.categories(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Public read access" ON public.categories FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admin write access" ON public.categories FOR ALL USING (public.is_admin());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
