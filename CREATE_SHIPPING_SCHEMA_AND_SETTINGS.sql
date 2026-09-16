-- ==============================================================================
-- ABU MAFHAL MARKETPLACE: SHIPPING MANAGEMENT & DISTANCE-BASED SHIPPING SYSTEM
-- Database Migration Script for Supabase (PostgreSQL)
-- ==============================================================================

-- 1. EXTEND ADDRESSES TABLE (Customer Delivery Coordinates)
ALTER TABLE IF EXISTS public.addresses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE IF EXISTS public.addresses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE IF EXISTS public.addresses ADD COLUMN IF NOT EXISTS lga TEXT;

-- 2. EXTEND STORES & PROFILES (Vendor GPS Coordinates & Custom Rules)
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS lga TEXT;
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS custom_shipping_enabled BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS custom_base_fee NUMERIC;
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS custom_price_per_km NUMERIC;
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS custom_min_fee NUMERIC;
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS custom_max_fee NUMERIC;
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC DEFAULT 250;
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS supports_pickup BOOLEAN DEFAULT true;
ALTER TABLE IF EXISTS public.stores ADD COLUMN IF NOT EXISTS supports_express BOOLEAN DEFAULT true;

-- 3. EXTEND ORDERS & CHECKOUT SESSIONS (Historical Immutable Shipping Snapshots)
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS shipping_snapshot JSONB;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'standard';
ALTER TABLE IF EXISTS public.checkout_sessions ADD COLUMN IF NOT EXISTS shipping_snapshot JSONB;
ALTER TABLE IF EXISTS public.checkout_sessions ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'standard';

-- 4. CREATE SHIPPING METHODS TABLE
CREATE TABLE IF NOT EXISTS public.shipping_methods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    base_fee NUMERIC NOT NULL DEFAULT 1000,
    price_per_km NUMERIC NOT NULL DEFAULT 75,
    min_fee NUMERIC NOT NULL DEFAULT 1000,
    max_fee NUMERIC NOT NULL DEFAULT 25000,
    estimated_delivery_time TEXT DEFAULT '2 - 4 Business Days',
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Default Shipping Methods
INSERT INTO public.shipping_methods (id, name, description, base_fee, price_per_km, min_fee, max_fee, estimated_delivery_time, is_active, display_order)
VALUES
    ('standard', 'Standard Delivery', 'Economical road courier delivery across regional hubs', 1000, 75, 1000, 20000, '2 - 4 Business Days', true, 1),
    ('express', 'Express Priority', 'Expedited doorstep delivery with direct courier routing', 2500, 120, 2500, 35000, '1 - 2 Business Days', true, 2),
    ('same_day', 'Same-Day City Rush', 'Direct dispatch for orders placed before 1:00 PM within same LGA/City', 4000, 180, 4000, 45000, 'Same Day (Within 6 hours)', true, 3),
    ('pickup', 'Self Pickup (Hub / Store)', 'Pick up free or nominal handling fee from verified vendor store or hub', 0, 0, 0, 500, 'Ready in 24 Hours', true, 4)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    base_fee = EXCLUDED.base_fee,
    price_per_km = EXCLUDED.price_per_km,
    min_fee = EXCLUDED.min_fee,
    max_fee = EXCLUDED.max_fee,
    estimated_delivery_time = EXCLUDED.estimated_delivery_time,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;

-- 5. CREATE SHIPPING ZONES TABLE (Regional & LGA Pricing Rules)
CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country TEXT DEFAULT 'Nigeria',
    state TEXT NOT NULL,
    lga TEXT,
    base_fee NUMERIC,
    price_per_km NUMERIC,
    min_fee NUMERIC,
    max_fee NUMERIC,
    remote_area_fee NUMERIC DEFAULT 0,
    free_shipping_threshold NUMERIC,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Representative Regional Zones
INSERT INTO public.shipping_zones (name, country, state, lga, base_fee, price_per_km, min_fee, max_fee, remote_area_fee, free_shipping_threshold, is_active)
SELECT 'Yobe State Core Hub', 'Nigeria', 'Yobe', 'Bade', 800, 60, 800, 15000, 0, 40000, true
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_zones WHERE state = 'Yobe' AND lga = 'Bade');

INSERT INTO public.shipping_zones (name, country, state, lga, base_fee, price_per_km, min_fee, max_fee, remote_area_fee, free_shipping_threshold, is_active)
SELECT 'Kano Commercial Metro', 'Nigeria', 'Kano', NULL, 1200, 70, 1200, 18000, 0, 45000, true
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_zones WHERE state = 'Kano' AND lga IS NULL);

INSERT INTO public.shipping_zones (name, country, state, lga, base_fee, price_per_km, min_fee, max_fee, remote_area_fee, free_shipping_threshold, is_active)
SELECT 'Lagos Express Hub', 'Nigeria', 'Lagos', NULL, 1500, 85, 1500, 25000, 0, 50000, true
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_zones WHERE state = 'Lagos' AND lga IS NULL);

-- 6. SEED COMPREHENSIVE GLOBAL SHIPPING CONFIG IN APP_SETTINGS
INSERT INTO public.app_settings (key, value, description, updated_at)
VALUES (
    'shipping_settings',
    '{
        "enabled": true,
        "currency": "NGN",
        "base_fee": 1000,
        "price_per_km": 75,
        "min_fee": 1000,
        "max_fee": 25000,
        "free_shipping_threshold": 50000,
        "max_delivery_distance_km": 350,
        "handling_fee": 200,
        "remote_area_fee": 1500,
        "vendor_handling_fee": 0,
        "standard_delivery_enabled": true,
        "express_delivery_enabled": true,
        "same_day_delivery_enabled": true,
        "customer_pickup_enabled": true
    }'::jsonb,
    'Authoritative distance-based and dynamic shipping configuration for Abu Mafhal Marketplace',
    now()
)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active shipping methods" ON public.shipping_methods;
DROP POLICY IF EXISTS "Admins can manage shipping methods" ON public.shipping_methods;
CREATE POLICY "Public can view active shipping methods" ON public.shipping_methods FOR SELECT USING (true);
CREATE POLICY "Admins can manage shipping methods" ON public.shipping_methods FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view active shipping zones" ON public.shipping_zones;
DROP POLICY IF EXISTS "Admins can manage shipping zones" ON public.shipping_zones;
CREATE POLICY "Public can view active shipping zones" ON public.shipping_zones FOR SELECT USING (true);
CREATE POLICY "Admins can manage shipping zones" ON public.shipping_zones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. GRANT ACCESS AND NOTIFY PGRST
GRANT ALL ON TABLE public.shipping_methods TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.shipping_zones TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
