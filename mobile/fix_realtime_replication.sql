DO $$
BEGIN
  -- We ensure the orders table is part of the realtime publication.
  -- This allows Supabase to broadcast changes to the app instantly.
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION
  WHEN OTHERS THEN
    -- If it's already there or publication doesn't exist, ignore the error
    NULL;
END $$;

-- Alternative way if the block above is too complex for some environments
-- Uncomment if needed:
-- ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Ensure RLS allows drivers to see orders assigned to them
-- (Already likely exists, but good to be sure)
DROP POLICY IF EXISTS "Drivers can view their assigned orders" ON orders;
CREATE POLICY "Drivers can view their assigned orders" 
ON orders FOR SELECT 
USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

-- Ensure RLS allows drivers to see "Pool" orders (unassigned)
DROP POLICY IF EXISTS "Drivers can view unassigned orders" ON orders;
CREATE POLICY "Drivers can view unassigned orders" 
ON orders FOR SELECT 
USING (driver_id IS NULL AND (status = 'pending' OR status = 'processing'));
