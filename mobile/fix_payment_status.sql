-- Force update payment status to 'paid' for all pending applications
-- This allows you to test the "Skip Payment" logic
UPDATE public.vendor_applications
SET payment_status = 'paid'
WHERE status = 'rejected' OR status = 'pending';

-- Verify the change
SELECT id, business_name, status, payment_status FROM public.vendor_applications;
