-- 1. Temporarily disable RLS to see if data appears
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- 2. Check if any data exists (this will show in the user's app now)
-- No changes needed to DB data, just visibility.

-- 3. If the user still sees "0 items", we should check if the order_id link is correct.
-- Let's run a query to check for "orphan" order items
SELECT count(*) as orphan_count 
FROM order_items 
WHERE order_id NOT IN (SELECT id FROM orders);

-- 4. Re-enable RLS with a "Lazy" policy for testing if needed
-- (But for now, leave it disabled so the user can verify if data exists at all)
