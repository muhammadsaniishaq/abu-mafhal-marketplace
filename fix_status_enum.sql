-- PART 1: FIX ENUM
-- Run this script ALONE first.
-- It adds 'archived' to the allowed list of statuses.

ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'archived';

-- After running this successfully, you can run the cleanup script or use the app.
