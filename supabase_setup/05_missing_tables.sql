-- ==============================================================================
-- 05. MISSING TABLES (As per Project Specs)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. VENDOR REQUESTS
-- ------------------------------------------------------------------------------
CREATE TYPE vendor_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS public.vendor_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    business_name text NOT NULL,
    business_description text,
    business_address text,
    business_location text,
    business_category text,
    
    -- Verification
    bvn text,
    nin text,
    cac_number text,
    tin_number text,
    
    -- Documents (URLs)
    logo_url text,    -- businessImage
    video_url text,   -- businessVideo
    nin_url text,     -- ninDocument
    cac_url text,     -- cacDocument
    
    -- Logistics & Trust
    delivery_type text,
    guarantor jsonb, -- { name, phone, address, relationship }
    socials jsonb,   -- { instagram, facebook, twitter }
    
    -- Subscription & Payment
    subscription_plan text,
    subscription_fee numeric(10,2),
    subscription_expiry timestamptz,
    payment_status text DEFAULT 'pending', -- paid, free_trial
    payment_reference text,
    
    status vendor_request_status DEFAULT 'pending'::vendor_request_status,
    admin_notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.vendor_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own requests" ON public.vendor_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create requests" ON public.vendor_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage requests" ON public.vendor_requests FOR ALL USING (is_admin());

-- ------------------------------------------------------------------------------
-- B. WALLETS (For Vendor Earnings)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    available_balance numeric(12,2) DEFAULT 0.00,
    pending_balance numeric(12,2) DEFAULT 0.00,
    currency text DEFAULT 'NGN',
    updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendors view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = vendor_id);
CREATE POLICY "Admins view all wallets" ON public.wallets FOR SELECT USING (is_admin());

-- ------------------------------------------------------------------------------
-- C. REVIEWS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    rating integer CHECK (rating >= 1 AND rating <= 5),
    comment text,
    is_verified_purchase boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users delete own reviews" ON public.reviews FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- D. AI LOGS (Audit & History)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type text NOT NULL, -- e.g. 'generate_description', 'fraud_check'
    input_context jsonb,
    output_result jsonb,
    created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all logs" ON public.ai_logs FOR ALL USING (is_admin());
CREATE POLICY "Users insert logs" ON public.ai_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- E. PAYMENTS (Tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'NGN',
    provider text NOT NULL, -- paystack, flutterwave
    reference text NOT NULL,
    status text NOT NULL, -- success, failed, pending
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all payments" ON public.payments FOR ALL USING (is_admin());
