-- Manually mark the application as PAID so they don't have to pay again.
UPDATE public.vendor_applications
SET payment_status = 'paid'
WHERE id = 'eb8793ae-9817-42e6-97c0-bc1468f9fdbe';
