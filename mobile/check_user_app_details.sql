-- Check the application details for the user with issues
SELECT id, status, payment_status, subscription_plan, subscription_fee, payment_reference 
FROM public.vendor_applications 
WHERE user_id = '8f429903-024d-48e8-b7c1-05f15b40aa6b';
