-- Add is_new column if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false;

-- Optional: Index for performance since we filter by it
CREATE INDEX IF NOT EXISTS idx_products_is_new ON products(is_new);
