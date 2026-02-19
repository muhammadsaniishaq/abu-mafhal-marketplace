-- Add XP column for gamification
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;

-- Update reward logic if needed (optional)
-- This could be triggered on order completion to increase XP.
CREATE OR REPLACE FUNCTION public.complete_delivery(p_order_id UUID, p_driver_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_delivery_fee NUMERIC;
    v_user_id UUID;
BEGIN
    -- 1. Get delivery fee and user_id of the driver
    SELECT delivery_fee, user_id INTO v_delivery_fee, v_user_id
    FROM public.orders WHERE id = p_order_id;
    
    -- 2. Update order status
    UPDATE public.orders 
    SET status = 'delivered',
        updated_at = now()
    WHERE id = p_order_id;
    
    -- 3. Credit wallet
    UPDATE public.wallets 
    SET balance = balance + v_delivery_fee,
        updated_at = now()
    WHERE user_id = v_user_id;
    
    -- 4. AWARD XP (Gamiication)
    UPDATE public.drivers
    SET xp = xp + 10 -- 10 XP per delivery
    WHERE id = p_driver_id;
END;
$$;
