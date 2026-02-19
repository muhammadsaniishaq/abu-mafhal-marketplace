-- 1. Check for applications with NULL user_id
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT count(*) INTO null_count FROM public.vendor_applications WHERE user_id IS NULL;
    RAISE NOTICE 'Found % applications with NULL user_id', null_count;
END $$;

-- 2. Update the trigger function to be safer
CREATE OR REPLACE FUNCTION public.handle_vendor_application_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if status changed AND user_id is present
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.user_id IS NOT NULL THEN
        
        -- CASE 1: Approved
        IF NEW.status = 'approved' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                NEW.user_id, 
                'Vendor Application Approved! 🎉', 
                'Congratulations! Your application to become a vendor has been approved. You can now set up your shop.', 
                'success'
            );
        
        -- CASE 2: Rejected
        ELSIF NEW.status = 'rejected' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                NEW.user_id, 
                'Vendor Application Update', 
                'Your vendor application was not approved. Reason: ' || COALESCE(NEW.rejection_reason, 'Docs incomplete or policy violation.'), 
                'error'
            );
        END IF;

    ELSE
        -- Log warning if user_id is null
        IF NEW.user_id IS NULL THEN
            RAISE WARNING 'Cannot send notification: Vendor Application % has NULL user_id', NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
