-- Check for recent notifications for the rejected user
-- Replace with the specific User ID if known, or just show the last 5 notifications
SELECT * FROM public.notifications
ORDER BY created_at DESC
LIMIT 5;
