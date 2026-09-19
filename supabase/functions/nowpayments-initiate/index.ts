// @ts-nocheck
/// <reference path="../ambient.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: any) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase credentials in server environment.");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { amount, currency = "ngn", order_id, order_description, customer_email, api_key } = body;

    // 1. Dynamic API key: passed or from database app_settings table
    let apiKey = api_key;
    if (!apiKey) {
      try {
        const { data: rows } = await supabase.from("app_settings").select("*");
        if (rows && Array.isArray(rows)) {
          for (const r of rows) {
            if (r.key === "payment_gateways" && r.value && typeof r.value === "object") {
              if (r.value.nowpayments_api_key) apiKey = r.value.nowpayments_api_key;
            } else if (r.key === "nowpayments_api_key") {
              apiKey = typeof r.value === "string" ? r.value : (r.value?.value || r.value?.key);
            }
          }
        }
      } catch (_) {}
    }

    // 2. Fallback to Deno environment
    if (!apiKey) {
      apiKey = Deno.env.get("NOWPAYMENTS_API_KEY");
    }

    if (!apiKey) {
      throw new Error("NOWPayments API Key is not configured in Admin Settings or Supabase Database.");
    }

    const safeAmount = Number(amount) || 0;
    const ref = order_id || `NP_${Date.now()}`;

    const res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
      },
      body: JSON.stringify({
        price_amount: safeAmount,
        price_currency: currency.toLowerCase(),
        order_id: ref,
        order_description: order_description || `Abu Mafhal Marketplace Order ${ref}`,
        ipn_callback_url: `${SUPABASE_URL}/functions/v1/webhook-nowpayments`,
        success_url: `https://abumafhal.com/payment/verify?status=successful&gateway=nowpayments&reference=${encodeURIComponent(ref)}`,
        cancel_url: `https://abumafhal.com/payment/verify?status=cancelled&gateway=nowpayments&reference=${encodeURIComponent(ref)}`,
      }),
    });

    const json = await res.json();

    if (!json.invoice_url) {
      console.error("NOWPayments invoice creation error:", json);
      return new Response(JSON.stringify({ error: json.message || "Failed to create invoice with NOWPayments", details: json }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      id: json.id,
      invoice_url: json.invoice_url,
      reference: ref,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
