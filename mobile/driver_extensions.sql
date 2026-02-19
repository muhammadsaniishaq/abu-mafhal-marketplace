-- 1. Add Vehicle Columns if they don't exist
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
ADD COLUMN IF NOT EXISTS plate_number TEXT;

-- 2. RPC to Update Driver Profile (Vehicle Info)
CREATE OR REPLACE FUNCTION public.update_driver_vehicle(p_vehicle_type TEXT, p_plate_number TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.drivers
    SET vehicle_type = p_vehicle_type,
        plate_number = p_plate_number,
        updated_at = now()
    WHERE user_id = auth.uid();
END;
$$;

-- 3. Placeholder for Withdrawal Requests (Policy + Function)
-- This is a simplified version. In a real app, this would log to a requests table.
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    -- Check balance
    SELECT balance INTO v_balance FROM public.wallets WHERE user_id = auth.uid();
    
    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance.';
    END IF;

    -- In a real system, you would deduct here or move to "pending"
    -- For now, we'll just return a success message
    RETURN 'Withdrawal request for ₦' || p_amount || ' has been submitted and is pending approval.';
END;
$$;
