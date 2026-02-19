-- 1. Add delivery_fee column to orders if it doesn't exist
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 500;

-- 2. Create a function to handle delivery completion
-- This function updates the order status AND credits the driver's wallet safely.

CREATE OR REPLACE FUNCTION public.complete_delivery(p_order_id UUID, p_driver_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_fee NUMERIC;
    v_order_status TEXT;
    v_driver_user_id UUID;
BEGIN
    -- Get order details
    SELECT delivery_fee, status INTO v_order_fee, v_order_status
    FROM public.orders
    WHERE id = p_order_id AND driver_id = p_driver_id;

    -- Validation
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found or not assigned to this driver.';
    END IF;

    IF v_order_status = 'delivered' THEN
        RAISE EXCEPTION 'Order is already delivered.';
    END IF;

    -- Get driver's user_id for wallet credit
    SELECT user_id INTO v_driver_user_id
    FROM public.drivers
    WHERE id = p_driver_id;

    -- Update Order Status
    UPDATE public.orders
    SET status = 'delivered', updated_at = now()
    WHERE id = p_order_id;

    -- Credit Driver Wallet
    INSERT INTO public.wallets (user_id, balance, currency)
    VALUES (v_driver_user_id, COALESCE(v_order_fee, 500), 'NGN')
    ON CONFLICT (user_id) 
    DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

    -- Log Transaction (Audit)
    -- Assuming an audit_logs table or similar exists, or just rely on wallet update.
    -- If you have a transactions table, insert here.
    
END;
$$;
