UPDATE public.vendor_applications
SET
    payment_status = 'paid',
    subscription_plan = '1 Year',
    subscription_fee = 18000,
    payment_reference = 'REF-MANUAL-FIX-AGAIN'
WHERE id = 'eb8793ae-9817-42e6-97c0-bc1468f9fdbe'
RETURNING *;
