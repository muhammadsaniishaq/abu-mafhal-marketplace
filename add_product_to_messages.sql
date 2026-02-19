-- Add product_id to messages to persist context
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id);

-- Update RLS to allow inserting product_id (existing policy should cover it, but good to verify)
-- Standard INSERT policy: FOR INSERT WITH CHECK (auth.uid() = sender_id);
-- This allows inserting ANY column as long as sender_id matches. So we are good.

-- We also need to fetch product details in ConversationsScreen or ChatScreen.
-- Let's make sure 'products' table is readable. RLS on products is usually public read.
