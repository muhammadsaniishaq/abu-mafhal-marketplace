-- DATA CLEANUP & V3 TRIGGER FIX

-- 1. Clean up invalid data
-- Applications without a User ID are broken and cannot be processed.
-- We will delete them to prevent them from crashing the system.
DELETE FROM public.vendor_applications WHERE user_id IS NULL;

-- 2. Drop potential conflicts (Old versions)
DROP TRIGGER IF EXISTS on_vendor_application_status_change ON public.vendor_applications;
DROP FUNCTION IF EXISTS public.handle_vendor_application_updates();
DROP TRIGGER IF EXISTS on_vendor_app_v3_trigger ON public.vendor_applications; -- Cleanup self if re-run

-- 3. Create V3 Function (Unique Name)
CREATE OR REPLACE FUNCTION public.handle_vendor_notifications_v3()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
BEGIN
    target_user_id := NEW.user_id;

    -- Strict Guard
    IF target_user_id IS NULL THEN
        -- If we somehow still have nulls, do nothing.
        RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        -- Approved
        IF NEW.status = 'approved' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (target_user_id, 'Approved! 🎉', 'Your vendor application is approved.', 'success');
        
        -- Rejected
        ELSIF NEW.status = 'rejected' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                target_user_id, 
                'Application Rejected', 
                'Reason: ' || COALESCE(NEW.rejection_reason, 'Policy violation'), 
                'error'
            );
        END IF;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Final Safety Net: If anything fails, just log it and don't crash the update
    RAISE WARNING 'Notification Trigger Failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach V3 Trigger
CREATE TRIGGER on_vendor_app_v3_trigger
    AFTER UPDATE ON public.vendor_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_vendor_notifications_v3();
