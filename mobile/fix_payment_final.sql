-- 1. Identify the Main (Oldest or Preferred) Application for the user
-- We assume the one with ID 'eb8793ae-9817-42e6-97c0-bc1468f9fdbe' is the target, OR we find the latest.

-- Update the specific known application to PAID
UPDATE public.vendor_applications
SET 
    payment_status = 'paid',
    status = 'rejected', -- Keep it rejected so they can "Retry"
    subscription_plan = '1 Year',
    subscription_fee = 18000,
    payment_reference = 'REF-MANUAL-FIX-FINAL'
WHERE id = 'eb8793ae-9817-42e6-97c0-bc1468f9fdbe';

-- OPTIONAL: If there are OTHER applications for this user that are 'pending' (duplicates), delete them
-- (Replace 'THE_USER_ID' with actual user_id if known, otherwise this safe update above is enough)
