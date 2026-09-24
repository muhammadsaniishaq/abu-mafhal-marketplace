// @ts-nocheck
/// <reference path="../ambient.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: any) => {
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

    // 2. Fetch the Paystack Secret Key from database app_settings or environment
    let SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!SECRET_KEY) {
      try {
        const { data: rows } = await supabase.from('app_settings').select('*');
        if (rows && Array.isArray(rows)) {
          for (const r of rows) {
            if (r.key === 'payment_gateways' && r.value && typeof r.value === 'object') {
              if (r.value.paystack_secret_key) SECRET_KEY = r.value.paystack_secret_key;
            } else if (r.key === 'paystack_secret_key') {
              SECRET_KEY = typeof r.value === 'string' ? r.value : (r.value?.value || r.value?.key);
            }
          }
        }
      } catch (_) {}
    }

    if (!SECRET_KEY) {
      console.error('Paystack secret key is missing in both app_settings and environment.');
      throw new Error('Payment gateway is not configured properly (Missing Paystack Secret Key).');
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

      // Check if reference was already credited to prevent duplicate credits
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('reference', reference)
        .maybeSingle();

      if (existingTx) {
        return new Response(JSON.stringify({
          success: true,
          message: `Wallet already credited for reference ${reference}`,
          amount: paidAmount
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Fetch user profile current balance
      const { data: userProfile, error: profErr } = await supabase
        .from('profiles')
        .select('id, balance')
        .eq('id', user_id)
        .maybeSingle();

      if (profErr || !userProfile) {
        throw new Error(`User profile not found for ID: ${user_id}`);
      }

      const currentBal = Number(userProfile.balance || 0);
      const newBalance = currentBal + paidAmount;

      // Update user balance in profiles
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', user_id);

      if (updateErr) {
        throw new Error(`Failed to update user balance: ${updateErr.message}`);
      }

      // Record transaction
      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          user_id: user_id,
          type: 'topup',
          amount: paidAmount,
          status: 'completed',
          reference: reference,
          description: `Wallet Top-up of ₦${paidAmount.toLocaleString()} via Paystack (Ref: ${reference})`
        });

      if (txErr) {
        console.warn('Transaction record warning:', txErr.message);
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Wallet credited with NGN ${paidAmount}`,
        amount: paidAmount,
        new_balance: newBalance
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (action === 'vendor_registration') {
      // Find the active plans
      const { data: settingsData } = await supabase.from('app_settings').select('vendor_plans').single();
      const activePlans = settingsData?.vendor_plans || [];
      const plan = activePlans.find((p: any) => p.id === expected_plan_id) || activePlans[0];

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
    } else if (action === 'order_payment' || action === 'pss_down_payment' || action === 'checkout') {
      // Record verified transaction in database
      await supabase.from('transactions').insert({
        user_id,
        amount: paidAmount,
        reference,
        type: action === 'pss_down_payment' ? 'pss_down_payment' : 'order_payment',
        status: 'completed',
        description: `Verified Escrow Payment of NGN ${paidAmount.toLocaleString()} via Paystack (Ref: ${reference})`
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Order payment of NGN ${paidAmount} verified successfully.`,
        amount: paidAmount,
        reference
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      throw new Error(`Unsupported verification action: ${action}`);
    }

  } catch (error: any) {
    console.error('Verification Error:', error?.message || error);
    return new Response(JSON.stringify({ success: false, error: error?.message || String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
