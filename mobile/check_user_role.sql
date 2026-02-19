
SELECT 
    va.id as app_id,
    va.user_id,
    va.status as app_status,
    va.payment_status,
    p.role as user_role,
    v.id as vendor_record_id,
    v.vendor_status
FROM public.vendor_applications va
JOIN public.profiles p ON p.id = va.user_id
LEFT JOIN public.vendors v ON v.user_id = va.user_id
WHERE va.id = 'eb8793ae-9817-42e6-97c0-bc1468f9fdbe';
