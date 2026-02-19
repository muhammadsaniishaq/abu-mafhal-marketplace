-- Assign the latest pending order to the driver (You!)
-- Replace 'YOUR_EMAIL_HERE' with your email if needed, or it will just pick the first available driver.

DO $$
DECLARE
    v_driver_id UUID;
    v_order_id UUID;
BEGIN
    -- 1. Get a driver ID (preferably the one connected to the current user, or just the first active driver)
    SELECT id INTO v_driver_id FROM public.drivers WHERE status = 'active' LIMIT 1;

    -- 2. Get a pending or processing order
    SELECT id INTO v_order_id FROM public.orders 
    WHERE status IN ('pending', 'processing') 
    ORDER BY created_at DESC 
    LIMIT 1;

    -- 3. Assign
    IF v_driver_id IS NOT NULL AND v_order_id IS NOT NULL THEN
        UPDATE public.orders 
        SET driver_id = v_driver_id, status = 'shipped' -- Change processing -> shipped/assigned
        WHERE id = v_order_id;
        
        RAISE NOTICE 'Assigned Order % to Driver %', v_order_id, v_driver_id;
    ELSE
        RAISE NOTICE 'Could not find a driver or a pending order to assign.';
    END IF;
END $$;
