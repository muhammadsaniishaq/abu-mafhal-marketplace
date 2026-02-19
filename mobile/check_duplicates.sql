-- Check for users with multiple applications
SELECT user_id, count(*) 
FROM public.vendor_applications 
GROUP BY user_id 
HAVING count(*) > 1;
