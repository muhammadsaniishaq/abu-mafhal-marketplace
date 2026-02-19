-- ==========================================
-- 1. FIX RLS POLICIES (Vendor Products & Storage)
-- ==========================================

-- Enable RLS on products table if not already
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow Vendors to INSERT products
DROP POLICY IF EXISTS "Vendors can insert their own products" ON products;
CREATE POLICY "Vendors can insert their own products"
ON products
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = vendor_id
);

-- Allow Vendors to UPDATE their own products
DROP POLICY IF EXISTS "Vendors can update their own products" ON products;
CREATE POLICY "Vendors can update their own products"
ON products
FOR UPDATE
TO authenticated
USING (auth.uid() = vendor_id);

-- Allow Vendors to DELETE their own products
DROP POLICY IF EXISTS "Vendors can delete their own products" ON products;
CREATE POLICY "Vendors can delete their own products"
ON products
FOR DELETE
TO authenticated
USING (auth.uid() = vendor_id);

-- Allow Public to VIEW products
DROP POLICY IF EXISTS "Public can view products" ON products;
CREATE POLICY "Public can view products"
ON products
FOR SELECT
TO public
USING (true);

-- STORAGE POLICIES (for 'products' bucket)

-- Allow Authenticated users to UPLOAD to 'products' bucket
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products');

-- Allow Public to VIEW files in 'products' bucket
DROP POLICY IF EXISTS "Allow public view" ON storage.objects;
CREATE POLICY "Allow public view"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'products');

-- Allow Users to UPDATE/DELETE their own files
DROP POLICY IF EXISTS "Allow owners to update delete" ON storage.objects;
CREATE POLICY "Allow owners to update delete"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'products' AND auth.uid() = owner);


-- ==========================================
-- 2. UPDATE TRIGGER (Security Definer)
-- ==========================================

-- Function to decrement stock (SECURITY DEFINER added)
CREATE OR REPLACE FUNCTION decrement_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after a new order item is created
DROP TRIGGER IF EXISTS decrement_stock_on_order ON order_items;

CREATE TRIGGER decrement_stock_on_order
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION decrement_stock();
