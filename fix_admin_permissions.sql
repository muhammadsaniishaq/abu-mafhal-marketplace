-- Allow Admins to Update Any Product (Bypassing Vendor Check)
CREATE POLICY "Admins can update all products" ON public.products
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow Admins to Delete Any Product (Just in case)
CREATE POLICY "Admins can delete all products" ON public.products
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- CLEANUP: Soft delete any products that might be stuck or have no valid vendor
-- This sets 'archived' status for products with typically "mock" names if they exist
UPDATE public.products 
SET status = 'archived' 
WHERE name LIKE 'Premium Item%' 
OR name LIKE 'Mock%';
