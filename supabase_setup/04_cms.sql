-- ==============================================================================
-- 04. CMS TABLES (Dynamic Content)
-- ==============================================================================

-- Ensure extension exists for auto-updating timestamps
CREATE EXTENSION IF NOT EXISTS "moddatetime";

-- ------------------------------------------------------------------------------
-- A. HERO SLIDES (Home Page Carousel)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hero_slides (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text,
    subtitle text,
    image_url text NOT NULL,
    cta_text text DEFAULT 'Shop Now',
    cta_link text DEFAULT '/shop',
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    bg_color text DEFAULT '#0F172A', -- Fallback background color
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index for sorting active slides
CREATE INDEX IF NOT EXISTS idx_hero_slides_sort ON public.hero_slides(sort_order) WHERE is_active = true;

-- Trigger: Updated At
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.hero_slides
FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- ------------------------------------------------------------------------------
-- B. RLS POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

-- 1. Public Read (Anyone can see active slides)
CREATE POLICY "Public can view active slides" ON public.hero_slides
    FOR SELECT USING (is_active = true);

-- 2. Admin Full Access
CREATE POLICY "Admins can manage slides" ON public.hero_slides
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
      )
    );
