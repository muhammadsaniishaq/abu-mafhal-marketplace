
-- 1. Create Drivers Table
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    vehicle_type TEXT DEFAULT 'bike', -- bike, car, van, truck
    vehicle_plate_number TEXT,
    photo_url TEXT,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    status TEXT DEFAULT 'available', -- available, busy, offline
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add driver_id to Orders
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'driver_id') THEN
        ALTER TABLE public.orders ADD COLUMN driver_id UUID REFERENCES public.drivers(id);
    END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Everyone can read drivers (so users can see who is delivering)
CREATE POLICY "Public drivers are viewable by everyone" ON public.drivers FOR SELECT USING (true);

-- Only admins/service_role can insert/update (This is simplified, assuming admin uses service role or admin auth)
-- Since we don't have a strict admin role yet, we'll allow Authenticated users to read.
CREATE POLICY "Authenticated users can read drivers" ON public.drivers FOR SELECT USING (auth.role() = 'authenticated');

-- Insert a Dummy Driver for Testing if empty
INSERT INTO public.drivers (name, phone, vehicle_type, vehicle_plate_number, photo_url, status)
SELECT 'Musa Ibrahim', '+2348012345678', 'bike', 'TVS-102-AB', 'https://placehold.co/100', 'available'
WHERE NOT EXISTS (SELECT 1 FROM public.drivers);

