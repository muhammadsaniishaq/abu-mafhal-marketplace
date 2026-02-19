-- 1. Allow Drivers to View Unassigned Orders (The "Pool")
-- Update the "Users can view assigned driver" policy or create a new one.
-- Actually, we need a policy on 'orders' table.

DROP POLICY IF EXISTS "Drivers can view unassigned orders" ON public.orders;
CREATE POLICY "Drivers can view unassigned orders" ON public.orders
    FOR SELECT
    USING (
        (auth.uid() IN (SELECT user_id FROM public.drivers WHERE status = 'active')) -- Must be an active driver
        AND 
        (driver_id IS NULL OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())) -- Unassigned OR Assigned to me
    );

-- 2. Function for a Driver to Accept an Order
CREATE OR REPLACE FUNCTION public.accept_delivery(p_order_id UUID, p_driver_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_driver UUID;
BEGIN
    -- Check if order is already taken
    SELECT driver_id INTO v_current_driver FROM public.orders WHERE id = p_order_id;
    
    IF v_current_driver IS NOT NULL THEN
        RAISE EXCEPTION 'Order is already taken by another driver.';
    END IF;

    -- Assign to driver
    UPDATE public.orders
    SET driver_id = p_driver_id,
        status = 'shipped', -- or 'processing' -> 'shipped' (En route)
        updated_at = now()
    WHERE id = p_order_id;
    
    -- Optional: Log it
END;
$$;

-- 3. Function to Toggle Driver Status (Online/Offline)
CREATE OR REPLACE FUNCTION public.toggle_driver_status(p_driver_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_status TEXT;
BEGIN
    UPDATE public.drivers
    SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END
    WHERE id = p_driver_id
    RETURNING status INTO v_new_status;
    
    RETURN v_new_status;
END;
$$;
