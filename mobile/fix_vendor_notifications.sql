-- 1. Add rejection_reason column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vendor_applications' AND column_name = 'rejection_reason') THEN
        ALTER TABLE public.vendor_applications ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

-- 2. Create Function to Handle Application Notifications
CREATE OR REPLACE FUNCTION public.handle_vendor_application_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if status changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
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
            
            -- Ensure subscription doesn't auto-renew or similar logic if needed (handled by not being in 'vendors' table)
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS on_vendor_application_status_change ON public.vendor_applications;
CREATE TRIGGER on_vendor_application_status_change
    AFTER UPDATE ON public.vendor_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_vendor_application_updates();

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
