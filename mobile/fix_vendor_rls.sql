-- Enable RLS on products table if not already
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 1. Allow Vendors to INSERT products
DROP POLICY IF EXISTS "Vendors can insert their own products" ON products;
CREATE POLICY "Vendors can insert their own products"
ON products
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = vendor_id
  -- OR exists(select 1 from users where id = auth.uid() and role = 'vendor') -- Optional stricter check
);

-- 2. Allow Vendors to UPDATE their own products
DROP POLICY IF EXISTS "Vendors can update their own products" ON products;
CREATE POLICY "Vendors can update their own products"
ON products
FOR UPDATE
TO authenticated
USING (auth.uid() = vendor_id);

-- 3. Allow Vendors to DELETE their own products
DROP POLICY IF EXISTS "Vendors can delete their own products" ON products;
CREATE POLICY "Vendors can delete their own products"
ON products
FOR DELETE
TO authenticated
USING (auth.uid() = vendor_id);

-- 4. Allow Public to VIEW approved products (or all for now to avoid bugs)
DROP POLICY IF EXISTS "Public can view products" ON products;
CREATE POLICY "Public can view products"
ON products
FOR SELECT
TO public
USING (true);

-- STORAGE POLICIES (for 'products' bucket)

-- Ensure bucket exists (this part is usually manual but policies depend on it)
-- INSERT into storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT DO NOTHING;

-- 5. Allow Authenticated users to UPLOAD to 'products' bucket
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products');

-- 6. Allow Public to VIEW files in 'products' bucket
DROP POLICY IF EXISTS "Allow public view" ON storage.objects;
CREATE POLICY "Allow public view"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'products');

-- 7. Allow Users to UPDATE/DELETE their own files (Optional but good)
DROP POLICY IF EXISTS "Allow owners to update delete" ON storage.objects;
CREATE POLICY "Allow owners to update delete"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'products' AND auth.uid() = owner);
