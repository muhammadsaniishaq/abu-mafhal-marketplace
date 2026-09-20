-- =========================================================================
-- ABU MAFHAL MARKETPLACE: CONFIGURE PAYMENT GATEWAYS IN SUPABASE DATABASE
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ejqymvjrfqqljzjlwcin/sql
-- =========================================================================

-- 1. Create the secure RPC function to save gateway keys directly from Admin Settings
CREATE OR REPLACE FUNCTION public.save_payment_gateways(gateway_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.app_settings (key, value, description, updated_at)
    VALUES (
        'payment_gateways',
        gateway_data,
        'Authoritative Payment Gateways Credentials',
        now()
    )
    ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_at = now();

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execution to all roles
GRANT EXECUTE ON FUNCTION public.save_payment_gateways(jsonb) TO anon, authenticated, service_role;

-- 2. Allow reading and writing app_settings for Admin & Client
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read app settings" ON public.app_settings;
CREATE POLICY "Everyone can read app settings" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert app settings" ON public.app_settings;
CREATE POLICY "Allow authenticated to insert app settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated to update app settings" ON public.app_settings;
CREATE POLICY "Allow authenticated to update app settings" ON public.app_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on app settings" ON public.app_settings;
CREATE POLICY "Allow anon all on app settings" ON public.app_settings FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.app_settings TO anon, authenticated, service_role;

-- 3. Initial Seed for payment_gateways
INSERT INTO public.app_settings (key, value, description, updated_at)
VALUES (
    'payment_gateways',
    jsonb_build_object(
        'paystack_public_key', '',
        'paystack_secret_key', '',
        'flutterwave_public_key', '',
        'flutterwave_secret_key', '',
        'nowpayments_api_key', '',
        'nowpayments_ipn_key', '',
        'updated_at', now()
    ),
    'Authoritative Payment Gateways Credentials',
    now()
)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
