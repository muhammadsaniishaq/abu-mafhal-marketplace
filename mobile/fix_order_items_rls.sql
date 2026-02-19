-- Ensure RLS is enabled
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Users can view their own order items" ON order_items;
DROP POLICY IF EXISTS "Users can view order items" ON order_items;

-- Create a comprehensive select policy for order_items
-- Checks if the user is the one who placed the order (buyer_id) or is linked to the order
CREATE POLICY "Users can view their own order items"
ON order_items
FOR SELECT
TO authenticated
USING (
  auth.uid() = buyer_id OR 
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  )
);

-- Also allow vendors to see items of orders placed with them
-- Note: If vendor_id doesn't exist on order_items, this might need a join to products
DROP POLICY IF EXISTS "Vendors can view order items for their products" ON order_items;
CREATE POLICY "Vendors can view order items for their products"
ON order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = order_items.product_id 
    AND products.vendor_id = auth.uid()
  )
);

-- Allow Admins full access
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
CREATE POLICY "Admins can view all order items"
ON order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
