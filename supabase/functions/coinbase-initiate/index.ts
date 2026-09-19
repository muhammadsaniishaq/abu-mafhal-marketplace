// @ts-nocheck
/// <reference path="../ambient.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let apiKey = Deno.env.get("NOWPAYMENTS_API_KEY");
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

    if (!apiKey) throw new Error("NOWPayments API Key is not configured in Admin Settings or Supabase.");

    const body = await req.json();
    const { order_id, amount, email, name, reference } = body;

    let finalAmount = amount;
    let currency = "NGN";

    if (order_id) {
      try {
        const { data: order } = await supabase
          .from("orders")
          .select("id, status, total_amount, currency")
          .eq("id", order_id)
          .maybeSingle();

        if (order) {
          if (order.status === "PAID") {
            return new Response(JSON.stringify({ error: "Order already paid" }), {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          finalAmount = order.total_amount || finalAmount;
          currency = order.currency ?? "NGN";
        }
      } catch (_) {}
    }

    if (!finalAmount || Number(finalAmount) <= 0) {
      return new Response(JSON.stringify({ error: "amount or order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ref = reference || `CB-${Date.now()}`;

    // Create NOWPayments invoice
    const res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
      },
      body: JSON.stringify({
        price_amount: Number(finalAmount) || 0,
        price_currency: currency.toLowerCase(),
        order_id: ref,
        order_description: `Order Payment (Ref: ${ref})`,
        ipn_callback_url: `${SUPABASE_URL}/functions/v1/webhook-nowpayments`,
        success_url: `https://abumafhal.com/payment/verify?status=successful&gateway=nowpayments&reference=${encodeURIComponent(ref)}`,
        cancel_url: `https://abumafhal.com/payment/verify?status=cancelled&gateway=nowpayments&reference=${encodeURIComponent(ref)}`,
      }),
    });

    const json = await res.json();
    if (!json?.invoice_url) {
      console.error("NOWPayments API Error:", json);
      return new Response(JSON.stringify({ error: "NOWPayments invoice creation failed", details: json }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invoiceId = json.id;
    const hostedUrl = json.invoice_url;

    return new Response(JSON.stringify({
      success: true,
      charge_id: invoiceId,
      hosted_url: hostedUrl,
      checkout_url: hostedUrl,
      invoice_url: hostedUrl,
      reference: ref
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});