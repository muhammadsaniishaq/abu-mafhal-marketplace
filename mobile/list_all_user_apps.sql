-- Find the user_id from the known app ID, then list ALL their apps to check for duplicates
SELECT id, status, subscription_plan, payment_status, created_at, business_name
FROM public.vendor_applications
WHERE user_id = (SELECT user_id FROM public.vendor_applications WHERE id = 'eb8793ae-9817-42e6-97c0-bc1468f9fdbe')
ORDER BY created_at DESC;
