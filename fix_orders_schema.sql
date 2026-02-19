-- Add payment_status column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';

-- Ensure shipping_address can handle JSON text if needed
-- (It is already text, so JSON.stringify() from client works fine)

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders';
