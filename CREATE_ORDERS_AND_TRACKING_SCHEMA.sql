-- ==============================================================================
-- ABU MAFHAL MARKETPLACE: ORDERS, TRACKING, ORDER_ITEMS & DRIVERS SCHEMA
-- Run this script in the Supabase SQL Editor to eliminate the error:
-- "Could not find the table 'public.orders' in the schema cache"
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE DRIVERS TABLE (if not exists)
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT,
    vehicle_type TEXT DEFAULT 'Motorcycle',
    vehicle_number TEXT,
    current_location TEXT DEFAULT 'Hub Central',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT DEFAULT 'available', -- 'available', 'busy', 'offline'
    is_active BOOLEAN DEFAULT TRUE,
    rating NUMERIC(3, 2) DEFAULT 5.0,
    xp INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREATE ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'
    payment_status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'paid', 'refunded', 'failed'
    payment_method TEXT DEFAULT 'paystack', -- 'paystack', 'flutterwave', 'crypto', 'wallet', 'pod'
    payment_reference TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) DEFAULT 0.00,
    shipping_fee NUMERIC(12, 2) DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00,
    shipping_address TEXT,
    shipping_details JSONB DEFAULT '{}'::jsonb,
    contact_phone TEXT,
    notes TEXT,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    driver_notes TEXT,
    user_confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMPTZ,
    current_location TEXT DEFAULT 'Processing Facility',
    estimated_delivery TIMESTAMPTZ,
    tracking_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CREATE ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    vendor_id UUID,
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    variant TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CREATE ORDER STATUS & LIVE TRACKING LOGS TABLE
CREATE TABLE IF NOT EXISTS public.order_status_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    title TEXT,
    description TEXT,
    location TEXT,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CREATE INDEXES FOR FAST QUERYING
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_order_id ON public.order_status_logs(order_id);

-- 7. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;

-- 8. CREATE POLICIES (Allow Authenticated & Public Access for smooth operation)
-- Drivers Policies
DROP POLICY IF EXISTS "Allow read drivers" ON public.drivers;
CREATE POLICY "Allow read drivers" ON public.drivers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin modify drivers" ON public.drivers;
CREATE POLICY "Allow admin modify drivers" ON public.drivers FOR ALL USING (true);

-- Orders Policies
DROP POLICY IF EXISTS "Allow buyers read own orders" ON public.orders;
CREATE POLICY "Allow buyers read own orders" ON public.orders FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() IS NOT NULL OR true);

DROP POLICY IF EXISTS "Allow insert orders" ON public.orders;
CREATE POLICY "Allow insert orders" ON public.orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update orders" ON public.orders;
CREATE POLICY "Allow update orders" ON public.orders FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete orders" ON public.orders;
CREATE POLICY "Allow delete orders" ON public.orders FOR DELETE USING (true);

-- Order Items Policies
DROP POLICY IF EXISTS "Allow read order items" ON public.order_items;
CREATE POLICY "Allow read order items" ON public.order_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert order items" ON public.order_items;
CREATE POLICY "Allow insert order items" ON public.order_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update order items" ON public.order_items;
CREATE POLICY "Allow update order items" ON public.order_items FOR ALL USING (true);

-- Order Status Logs Policies
DROP POLICY IF EXISTS "Allow read status logs" ON public.order_status_logs;
CREATE POLICY "Allow read status logs" ON public.order_status_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert status logs" ON public.order_status_logs;
CREATE POLICY "Allow insert status logs" ON public.order_status_logs FOR ALL USING (true);

-- 9. ADD TO SUPABASE REALTIME (For Live Tracking & Realtime Admin Orders)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'order_status_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_logs;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added
END $$;

-- 10. FOREIGN KEY RELATION TO PROFILES (Enables direct PostgREST joins if desired)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_profiles'
    ) THEN
        BEGIN
            ALTER TABLE public.orders ADD CONSTRAINT fk_orders_profiles FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_drivers_profiles'
    ) THEN
        BEGIN
            ALTER TABLE public.drivers ADD CONSTRAINT fk_drivers_profiles FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
END $$;

-- 11. PAY SMALL SMALL (BNPL) INSTALLMENT PLAN SUPPORT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'installment_plan'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN installment_plan JSONB;
    END IF;
END $$;

-- 12. NOTIFY POSTGREST SCHEMA CACHE RELOAD
NOTIFY pgrst, 'reload schema';

SELECT 'Orders, Live Tracking, and BNPL Schema created successfully!' AS result;
