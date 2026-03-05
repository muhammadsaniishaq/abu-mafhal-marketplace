import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { reference, action, amount, user_id, expected_plan_id } = await req.json();

    if (!reference || !action || !user_id) {
      throw new Error('Missing required fields (reference, action, user_id).');
    }

    // 1. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch the Paystack Secret Key from Deno Environment (Secrets)
    const SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');

    if (!SECRET_KEY) {
      console.error('Failed to get secret key from environment variables.');
      throw new Error('Payment gateway is not configured properly.');
    }

    // 3. Verify Payment with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data.status !== 'success') {
      throw new Error(`Payment verification failed: ${paystackData.message || 'Transaction not successful'}`);
    }

    const paidAmount = paystackData.data.amount / 100; // Paystack returns in kobo

    // 4. Handle Actions based on valid payment
    if (action === 'wallet_topup') {
      // Verify expected amount if provided (optional but good)
      if (amount && paidAmount < amount) {
        console.warn(`Amount mismatch. Expected ${amount}, paid ${paidAmount}. Proceeding with paid amount.`);
      }

      // Call the existing RPC safely via server
      const { data: rpcData, error: rpcError } = await supabase.rpc('process_wallet_topup', {
        user_id_arg: user_id,
        amount_arg: paidAmount,
        ref_arg: reference
      });

      if (rpcError || !rpcData?.success) {
        throw new Error(rpcData?.error || rpcError?.message || 'Wallet Topup Process Failed');
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Wallet credited with NGN ${paidAmount}`,
        amount: paidAmount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (action === 'vendor_registration') {
      // Find the active plans
      const { data: settingsData } = await supabase.from('app_settings').select('vendor_plans').single();
      const activePlans = settingsData?.vendor_plans || [];
      const plan = activePlans.find(p => p.id === expected_plan_id) || activePlans[0];

      if (!plan) {
        throw new Error('System configuration error: vendor plan not found.');
      }

      if (paidAmount < plan.price) {
        throw new Error(`Insufficient payment amount. Paid: ${paidAmount}, Expected: ${plan.price}`);
      }

      // Update Vendor Registration status directly bypassing user RLS
      const { error: vendError } = await supabase
        .from('vendor_applications')
        .update({
          payment_status: 'paid',
          payment_reference: reference,
          subscription_plan: plan.label
        })
        .eq('user_id', user_id)
        .order('created_at', { ascending: false }) // ensure latest
        .limit(1);

      if (vendError) throw vendError;

      return new Response(JSON.stringify({
        success: true,
        message: `Vendor payment verified for plan: ${plan.label}`,
        plan: plan.label
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      throw new Error(`Unsupported verification action: ${action}`);
    }

  } catch (error) {
    console.error('Verification Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
