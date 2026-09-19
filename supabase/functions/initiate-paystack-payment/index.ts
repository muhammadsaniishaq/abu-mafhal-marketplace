import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { amount, email, reference, callback_url, secret_key } = await req.json();

        if (!amount || !email || !reference) {
            throw new Error('Missing required fields.');
        }

        // 1. Dynamic Secret Key from Admin Settings request
        let SECRET_KEY = secret_key;

        // 2. Dynamic Secret Key from Supabase app_settings table via Service Role
        if (!SECRET_KEY) {
            try {
                const supabaseUrl = Deno.env.get('SUPABASE_URL');
                const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
                if (supabaseUrl && serviceRoleKey) {
                    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);
                    const { data: dbSettings } = await supabaseClient.from('app_settings').select('*');
                    if (dbSettings && Array.isArray(dbSettings)) {
                        const gwRow = dbSettings.find((r: any) => r.key === 'payment_gateways');
                        if (gwRow?.value?.paystack_secret_key) {
                            SECRET_KEY = gwRow.value.paystack_secret_key;
                        } else {
                            const secRow = dbSettings.find((r: any) => r.key === 'paystack_secret_key');
                            if (secRow?.value) {
                                SECRET_KEY = typeof secRow.value === 'string' ? secRow.value : (secRow.value.value || secRow.value.key);
                            }
                        }
                    }
                }
            } catch (_) {}
        }

        // 3. Fallback to Deno Environment Variable
        if (!SECRET_KEY) {
            SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
        }

        if (!SECRET_KEY) {
            throw new Error('Payment gateway is not configured properly (Missing Paystack Secret Key in Admin Settings or Server Environment).');
        }

        const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                amount: Math.round(Number(amount) * 100),
                reference,
                currency: 'NGN',
                channels: ['card', 'bank', 'bank_transfer', 'ussd', 'qr', 'mobile_money'],
                callback_url: callback_url || 'https://standard.paystack.co/close'
            })
        });

        const paystackData = await paystackRes.json();

        if (!paystackRes.ok || !paystackData.status) {
            throw new Error(`Failed to initialize payment: ${paystackData.message}`);
        }

        return new Response(JSON.stringify({
            success: true,
            authorization_url: paystackData.data.authorization_url,
            access_code: paystackData.data.access_code,
            reference: paystackData.data.reference
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        console.error('Edge Function Catch Error:', error.message || error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Unknown server error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
});
