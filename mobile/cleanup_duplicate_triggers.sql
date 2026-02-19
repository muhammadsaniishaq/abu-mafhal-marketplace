-- CLEANUP SCRIPT: specific to your database state
-- We need to remove the OLD trigger that is conflicting with our new one.

-- 1. Drop the old/duplicate trigger
DROP TRIGGER IF EXISTS on_vendor_application_approved ON public.vendor_applications;

-- 2. Drop the old function associated with it (to be safe)
DROP FUNCTION IF EXISTS public.handle_vendor_approval();

-- 3. Verify: You should only have 'on_vendor_application_status_change' left after this.
SELECT count(*) as remaining_triggers 
FROM information_schema.triggers 
WHERE event_object_table = 'vendor_applications';
