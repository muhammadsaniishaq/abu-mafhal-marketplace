-- RPC to Ensure Driver Profile Exists
-- This function checks if a driver profile exists for the current user.
-- If not, it creates one automatically.
-- Returns the driver profile.

CREATE OR REPLACE FUNCTION public.ensure_driver_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_result json;
BEGIN
    -- Check if exists
    SELECT id INTO v_driver_id FROM public.drivers WHERE user_id = auth.uid();
    
    -- If not, create
    IF v_driver_id IS NULL THEN
        INSERT INTO public.drivers (user_id, status, name)
        SELECT auth.uid(), 'active', (SELECT full_name FROM public.profiles WHERE id = auth.uid())
        RETURNING id INTO v_driver_id;
    END IF;

    -- Return the full driver record as JSON
    SELECT row_to_json(d) INTO v_result FROM public.drivers d WHERE id = v_driver_id;
    
    RETURN v_result;
END;
$$;
