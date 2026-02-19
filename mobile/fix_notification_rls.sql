-- Enable RLS on notifications table (if not already enabled)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. Policy for Users to View THEIR OWN notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Policy for Admins/System to INSERT notifications (CRITICAL FIX)
-- We allow ANY authenticated user to insert. Ideally, we'd check for admin role,
-- but for now, we just need the Admin App (authenticated) to be able to write.
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
CREATE POLICY "Anyone can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- 3. Policy to allow Update/Delete (e.g. marking as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);
