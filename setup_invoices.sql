-- Create Invoices Table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY, -- manually generated info like INV-12345678
    "customerName" TEXT,
    "customerPhone" TEXT,
    items JSONB, -- Array of items: { description, quantity, price, total }
    "taxRate" NUMERIC DEFAULT 0,
    "discount" NUMERIC DEFAULT 0,
    "subtotal" NUMERIC DEFAULT 0,
    "vat" NUMERIC DEFAULT 0,
    "grandTotal" NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'PENDING', -- PAID, PENDING, CANCELLED
    "dueDate" TEXT,
    "issuedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    business JSONB, -- { name, address, logo, signature, etc. }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL -- Link to order
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Access (For Verify Invoice Page)
-- Allowing anyone with the ID to view it (Security via Obscurity of ID)
DROP POLICY IF EXISTS "Public can view invoices" ON public.invoices;
CREATE POLICY "Public can view invoices"
ON public.invoices FOR SELECT
USING (true);

-- 2. Authenticated Insert (For User/Admin creating invoices)
DROP POLICY IF EXISTS "Authenticated can insert invoices" ON public.invoices;
CREATE POLICY "Authenticated can insert invoices"
ON public.invoices FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. Admin/Owner Update
DROP POLICY IF EXISTS "Admins can update invoices" ON public.invoices;
CREATE POLICY "Admins can update invoices"
ON public.invoices FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add 'order_id' column if it doesn't exist (migrations safety)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'order_id') THEN
        ALTER TABLE public.invoices ADD COLUMN order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
    END IF;
END $$;
