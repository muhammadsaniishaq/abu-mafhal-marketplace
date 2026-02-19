-- FINAL FIX: NUCLEAR OPTION
-- This script completely resets the automation triggers to ensure NO duplicates exist.

-- 1. DROP EVERYTHING related to these triggers (Old and New)
DROP TRIGGER IF EXISTS on_vendor_application_approved ON public.vendor_applications;
DROP TRIGGER IF EXISTS on_vendor_application_status_change ON public.vendor_applications;

DROP FUNCTION IF EXISTS public.handle_vendor_approval();
DROP FUNCTION IF EXISTS public.handle_vendor_application_updates();

-- 2. Clean up any bad data (Optional: Delete applications with no user attached to prevent future confusion)
-- DELETE FROM public.vendor_applications WHERE user_id IS NULL; 

-- 3. Re-create the SINGLE, SAFE Function
CREATE OR REPLACE FUNCTION public.handle_vendor_application_updates()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
BEGIN
    target_user_id := NEW.user_id;

    -- SAFETY CHECK: If no user_id, stop immediately. Do not Crash.
    IF target_user_id IS NULL THEN
        RAISE WARNING ' Application % has NULL user_id. Notification skipped.', NEW.id;
        RETURN NEW;
    END IF;

    -- Logic
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        -- APPROVED
        IF NEW.status = 'approved' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                target_user_id, 
                'Vendor Application Approved! 🎉', 
                'Congratulations! Your application to become a vendor has been approved.', 
                'success'
            );
        
        -- REJECTED
        ELSIF NEW.status = 'rejected' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                target_user_id, 
                'Vendor Application Update', 
                'Your vendor application was not approved. Reason: ' || COALESCE(NEW.rejection_reason, 'Docs incomplete.'), 
                'error'
            );
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-attach the Single Trigger
CREATE TRIGGER on_vendor_application_status_change
    AFTER UPDATE ON public.vendor_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_vendor_application_updates();

-- 5. Final Confirmation
SELECT 'Success! All triggers reset.' as status;
