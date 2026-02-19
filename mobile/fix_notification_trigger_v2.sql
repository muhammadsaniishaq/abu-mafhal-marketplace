-- Aggressive Fix for Notification Trigger

-- 1. Drop the trigger explicitly to ensure no stale logic remains
DROP TRIGGER IF EXISTS on_vendor_application_status_change ON public.vendor_applications;

-- 2. Drop the function to force a clean recreate
DROP FUNCTION IF EXISTS public.handle_vendor_application_updates();

-- 3. Re-create the Function with STRICT checks
CREATE OR REPLACE FUNCTION public.handle_vendor_application_updates()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get the User ID from the NEW record
    target_user_id := NEW.user_id;

    -- LOGGING (Visible in Supabase Logs)
    RAISE NOTICE 'Trigger fired for App ID: %, Status: %, User ID: %', NEW.id, NEW.status, target_user_id;

    -- GUARD: If User ID is NULL, we CANNOT create a notification. Exit early.
    IF target_user_id IS NULL THEN
        RAISE WARNING 'Skipping notification for App ID % because user_id is NULL', NEW.id;
        RETURN NEW;
    END IF;

    -- Main Logic
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        -- APPROVED
        IF NEW.status = 'approved' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                target_user_id, -- Verified NOT NULL above
                'Vendor Application Approved! 🎉', 
                'Congratulations! Your application to become a vendor has been approved.', 
                'success'
            );
        
        -- REJECTED
        ELSIF NEW.status = 'rejected' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                target_user_id, -- Verified NOT NULL above
                'Vendor Application Update', 
                'Your vendor application was not approved. Reason: ' || COALESCE(NEW.rejection_reason, 'Docs incomplete.'), 
                'error'
            );
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-attach the Trigger
CREATE TRIGGER on_vendor_application_status_change
    AFTER UPDATE ON public.vendor_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_vendor_application_updates();

-- 5. Data Cleanup (Optional but Recommended)
-- Set a dummy name for apps with NULL user_id so you can identify them, or just ignore them.
-- This part is just a query to show you problematic rows
SELECT id, business_name FROM public.vendor_applications WHERE user_id IS NULL;
