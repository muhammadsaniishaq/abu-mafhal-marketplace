-- Create Vendors Table (Active Sellers)
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    business_name TEXT NOT NULL,
    logo_url TEXT,
    vendor_status TEXT DEFAULT 'active', -- active, suspended, locked
    is_locked BOOLEAN DEFAULT false,
    subscription_plan TEXT,
    expires_at TIMESTAMPTZ,
    last_payment_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist and names are standardized (Standardize owner_id -> user_id)
DO $$ BEGIN
    -- 1. Rename owner_id to user_id if it exists from older schema
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'owner_id') THEN
        ALTER TABLE public.vendors RENAME COLUMN owner_id TO user_id;
    END IF;

    -- 2. Add missing columns
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'vendor_status') THEN
        ALTER TABLE public.vendors ADD COLUMN vendor_status TEXT DEFAULT 'active';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'is_locked') THEN
        ALTER TABLE public.vendors ADD COLUMN is_locked BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'subscription_plan') THEN
        ALTER TABLE public.vendors ADD COLUMN subscription_plan TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'business_name') THEN
        ALTER TABLE public.vendors ADD COLUMN business_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'expires_at') THEN
        ALTER TABLE public.vendors ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
END $$;

-- Enable RLS on vendors
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Policies for vendors (Safely drop and recreate)
DROP POLICY IF EXISTS "Public can view active vendors" ON public.vendors;
CREATE POLICY "Public can view active vendors" ON public.vendors 
    FOR SELECT USING (vendor_status = 'active');

DROP POLICY IF EXISTS "Vendors can view/update own profile" ON public.vendors;
CREATE POLICY "Vendors can view/update own profile" ON public.vendors
    FOR ALL USING (auth.uid() = user_id);

-- Function to handle Vendor Application Approval
CREATE OR REPLACE FUNCTION public.handle_vendor_approval()
RETURNS TRIGGER AS $$
DECLARE
    expire_days INTEGER;
BEGIN
    -- Only act when status changes to 'approved'
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        
        -- Determine expiry days based on plan
        IF NEW.subscription_plan = '1 Month Free Trial' THEN
            expire_days := 30;
        ELSIF NEW.subscription_plan = '1 Month' THEN
            expire_days := 30;
        ELSIF NEW.subscription_plan = '3 Months' THEN
            expire_days := 90;
        ELSIF NEW.subscription_plan = '6 Months' THEN
            expire_days := 180;
        ELSIF NEW.subscription_plan = '1 Year' THEN
            expire_days := 365;
        ELSE
            expire_days := 36500; -- Lifetime
        END IF;

        -- Create or Update Vendor Record
        INSERT INTO public.vendors (
            user_id, 
            business_name, 
            logo_url, 
            subscription_plan, 
            expires_at, 
            vendor_status,
            is_locked
        )
        VALUES (
            NEW.user_id, 
            NEW.business_name, 
            NEW.logo_url, 
            NEW.subscription_plan, 
            NOW() + (expire_days || ' days')::INTERVAL,
            'active',
            false
        )
        ON CONFLICT (user_id) DO UPDATE SET
            business_name = EXCLUDED.business_name,
            logo_url = EXCLUDED.logo_url,
            subscription_plan = EXCLUDED.subscription_plan,
            expires_at = EXCLUDED.expires_at,
            vendor_status = 'active',
            is_locked = false;

        -- Update Profile Role
        UPDATE public.profiles 
        SET role = 'vendor', business_name = NEW.business_name 
        WHERE id = NEW.user_id;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for vendor_applications
DROP TRIGGER IF EXISTS on_vendor_application_approved ON public.vendor_applications;
CREATE TRIGGER on_vendor_application_approved
    AFTER UPDATE ON public.vendor_applications
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
    EXECUTE FUNCTION public.handle_vendor_approval();

-- Enforce Locking on Product Visibility (Hides products if vendor is locked)
DROP POLICY IF EXISTS "Public view approved products" ON public.products;
CREATE POLICY "Public view approved products" 
ON public.products FOR SELECT 
USING (
    status = 'approved'::product_status 
    AND EXISTS (
        SELECT 1 FROM public.vendors 
        WHERE vendors.user_id = products.vendor_id 
        AND vendors.is_locked = false
    )
);

-- Function to check expiry and lock vendors + notify
CREATE OR REPLACE FUNCTION public.check_vendor_expiries()
RETURNS VOID AS $$
BEGIN
    -- 1. Send Warning Notifications (5 days before)
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT 
        user_id, 
        'Subscription Expiring Soon', 
        'Your vendor subscription will expire in 5 days. Please renew to keep your shop active.', 
        'warning'
    FROM public.vendors
    WHERE expires_at > NOW() 
      AND expires_at <= NOW() + INTERVAL '5 days'
      AND NOT EXISTS (
          SELECT 1 FROM public.notifications n 
          WHERE n.user_id = vendors.user_id 
          AND n.title = 'Subscription Expiring Soon' 
          AND n.created_at > NOW() - INTERVAL '1 day'
      );

    -- 2. Lock vendors whose subscription expired
    UPDATE public.vendors
    SET is_locked = true, vendor_status = 'locked'
    WHERE expires_at < NOW() AND is_locked = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: In a real Supabase environment, you'd set up pg_cron to run check_vendor_expiries() daily.
-- SELECT cron.schedule('check-vendor-expiry', '0 0 * * *', 'SELECT check_vendor_expiries()');
