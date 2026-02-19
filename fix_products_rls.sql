-- Enable RLS just in case
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Allow Public access to APPROVED products
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Public can view approved products" ON public.products;

CREATE POLICY "Public can view approved products" 
ON public.products FOR SELECT 
USING (status = 'approved');

-- Also check if there are any products
SELECT count(*) FROM public.products WHERE status = 'approved';

-- ==========================================
-- BRANDS TABLE (Official Stores)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for brands
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Policy: Public can view active brands
DROP POLICY IF EXISTS "Public can view active brands" ON public.brands;
CREATE POLICY "Public can view active brands" 
ON public.brands FOR SELECT 
USING (is_active = true);

-- Policy: Admin (or authenticated users for now) can manage brands
DROP POLICY IF EXISTS "Admins can manage brands" ON public.brands;
CREATE POLICY "Admins can manage brands" 
ON public.brands FOR ALL 
USING (auth.role() = 'authenticated');

-- Insert some dummy brands if empty
INSERT INTO public.brands (name, logo_url)
SELECT 'Apple', 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg'
WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE name = 'Apple');

INSERT INTO public.brands (name, logo_url)
SELECT 'Samsung', 'https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg'
WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE name = 'Samsung');

-- Verify
SELECT * FROM public.brands;
