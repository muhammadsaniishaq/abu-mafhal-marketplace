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
        const { amount, email, reference, callback_url } = await req.json();

        if (!amount || !email || !reference) {
            throw new Error('Missing required fields.');
        }

        const SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!SECRET_KEY) {
            throw new Error('Payment gateway is not configured properly (Missing PAYSTACK_SECRET_KEY environment variable).');
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
