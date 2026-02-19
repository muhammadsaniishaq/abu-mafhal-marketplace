-- Clear all test orders and related items
-- This will delete all rows from these tables. Use with caution.

BEGIN;

-- Delete order items first due to foreign key constraints
DELETE FROM order_items;

-- Delete orders
DELETE FROM orders;

-- Check if there are related transactions or notifications to clean up
-- DELETE FROM transactions WHERE type = 'order'; -- Check your schema if needed
-- DELETE FROM notifications WHERE type = 'order';

COMMIT;

-- Verify deletion
SELECT count(*) as orders_count FROM orders;
SELECT count(*) as items_count FROM order_items;
