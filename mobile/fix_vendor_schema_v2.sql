-- Safely add missing banking columns to vendor_applications
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vendor_applications' AND column_name = 'bank_name') THEN
        ALTER TABLE public.vendor_applications ADD COLUMN bank_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vendor_applications' AND column_name = 'account_number') THEN
        ALTER TABLE public.vendor_applications ADD COLUMN account_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vendor_applications' AND column_name = 'account_name') THEN
        ALTER TABLE public.vendor_applications ADD COLUMN account_name TEXT;
    END IF;
END $$;

-- Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
