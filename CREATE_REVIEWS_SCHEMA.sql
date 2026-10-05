-- ==============================================================================
-- ABU MAFHAL MARKETPLACE: 100% LIVE PRODUCT & DRIVER REVIEWS SYSTEM
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/ejqymvjrfqqljzjlwcin/sql)
-- ==============================================================================

-- 1. CREATE REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    review_type TEXT NOT NULL DEFAULT 'product' CHECK (review_type IN ('product', 'driver')),
    rating NUMERIC(2, 1) NOT NULL DEFAULT 5.0 CHECK (rating >= 1.0 AND rating <= 5.0),
    title TEXT,
    comment TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    user_name TEXT,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    helpful INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CREATE INDEXES FOR OPTIMAL PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_driver_id ON public.reviews(driver_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_type_status ON public.reviews(review_type, status);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES
DROP POLICY IF EXISTS "Public can view approved reviews" ON public.reviews;
CREATE POLICY "Public can view approved reviews"
    ON public.reviews FOR SELECT
    USING (status = 'approved' OR auth.uid() = user_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
CREATE POLICY "Authenticated users can insert reviews"
    ON public.reviews FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own reviews or admin" ON public.reviews;
CREATE POLICY "Users can update own reviews or admin"
    ON public.reviews FOR UPDATE
    USING (auth.uid() = user_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own reviews or admin" ON public.reviews;
CREATE POLICY "Users can delete own reviews or admin"
    ON public.reviews FOR DELETE
    USING (auth.uid() = user_id OR auth.role() = 'authenticated');

-- 5. FUNCTION TO AUTO-UPDATE DRIVER & PRODUCT AVERAGE RATINGS
CREATE OR REPLACE FUNCTION public.sync_review_ratings()
RETURNS TRIGGER AS $$
BEGIN
    -- Update Product Average Rating & Review Count
    IF NEW.product_id IS NOT NULL AND NEW.status = 'approved' THEN
        UPDATE public.products
        SET 
            rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews WHERE product_id = NEW.product_id AND status = 'approved'),
            reviews = (SELECT COUNT(*) FROM public.reviews WHERE product_id = NEW.product_id AND status = 'approved')
        WHERE id = NEW.product_id;
    END IF;

    -- Update Driver Average Rating
    IF NEW.driver_id IS NOT NULL AND NEW.status = 'approved' THEN
        UPDATE public.drivers
        SET 
            rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews WHERE driver_id = NEW.driver_id AND status = 'approved')
        WHERE id = NEW.driver_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_review_ratings ON public.reviews;
CREATE TRIGGER trigger_sync_review_ratings
AFTER INSERT OR UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.sync_review_ratings();

-- 6. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
