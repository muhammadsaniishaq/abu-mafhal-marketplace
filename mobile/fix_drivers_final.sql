-- Comprehensive Fix for 'drivers' table
-- This script safely adds columns one by one, handling cases where the table already exists but has missing columns.

-- 1. Create table if it doesn't exist at all
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'drivers') THEN
        CREATE TABLE public.drivers (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
            name TEXT,
            phone TEXT,
            vehicle_type TEXT DEFAULT 'Car',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    END IF;
END $$;

-- 2. Add columns individually if they are missing (for existing tables)
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'Car';
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. Enable RLS
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- 4. Create/Recreate Policies
DROP POLICY IF EXISTS "Drivers can view own profile" ON public.drivers;
CREATE POLICY "Drivers can view own profile" ON public.drivers
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage drivers" ON public.drivers;
CREATE POLICY "Admins can manage drivers" ON public.drivers
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view assigned driver" ON public.drivers;
CREATE POLICY "Users can view assigned driver" ON public.drivers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.driver_id = public.drivers.id
            AND o.user_id = auth.uid()
        )
    );

-- 5. Insert missing driver profiles
INSERT INTO public.drivers (user_id, name, phone, status)
SELECT p.id, p.full_name, p.phone, 'active'
FROM public.profiles p
WHERE p.role = 'driver'
AND NOT EXISTS (
    SELECT 1 FROM public.drivers d WHERE d.user_id = p.id
);

-- 6. Ensure 'orders' table has driver_id
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id);
