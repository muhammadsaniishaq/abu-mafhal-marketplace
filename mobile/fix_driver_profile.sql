-- Create 'drivers' table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT,
    phone TEXT,
    vehicle_type TEXT DEFAULT 'Car',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- 1. Create a policy for drivers to view their own profile
DROP POLICY IF EXISTS "Drivers can view own profile" ON public.drivers;
CREATE POLICY "Drivers can view own profile" ON public.drivers
    FOR SELECT USING (auth.uid() = user_id);

-- 2. Create a policy for admins to manage drivers
DROP POLICY IF EXISTS "Admins can manage drivers" ON public.drivers;
CREATE POLICY "Admins can manage drivers" ON public.drivers
    FOR ALL USING (public.is_admin());

-- 3. Create a policy for users to view their assigned driver
DROP POLICY IF EXISTS "Users can view assigned driver" ON public.drivers;
CREATE POLICY "Users can view assigned driver" ON public.drivers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.driver_id = public.drivers.id
            AND o.user_id = auth.uid()
        )
    );

-- Fix: Insert missing driver profiles for users who have role = 'driver'
INSERT INTO public.drivers (user_id, name, phone, status)
SELECT p.id, p.full_name, p.phone, 'active'
FROM public.profiles p
WHERE p.role = 'driver'
AND NOT EXISTS (
    SELECT 1 FROM public.drivers d WHERE d.user_id = p.id
);

-- Add 'orders' column driver_id if not present
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id);
