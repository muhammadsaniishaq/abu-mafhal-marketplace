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

    let COINBASE_COMMERCE_API_KEY = Deno.env.get("COINBASE_API_KEY") || Deno.env.get("COINBASE_COMMERCE_API_KEY");
    if (!COINBASE_COMMERCE_API_KEY) {
      try {
        const { data: rows } = await supabase.from("app_settings").select("*");
        if (rows && Array.isArray(rows)) {
          for (const r of rows) {
            if (r.key === "payment_gateways" && r.value && typeof r.value === "object") {
              if (r.value.coinbase_api_key) COINBASE_COMMERCE_API_KEY = r.value.coinbase_api_key;
            } else if (r.key === "coinbase_api_key") {
              COINBASE_COMMERCE_API_KEY = typeof r.value === "string" ? r.value : (r.value?.value || r.value?.key);
            }
          }
        }
      } catch (_) {}
    }

    if (!COINBASE_COMMERCE_API_KEY) throw new Error("Coinbase Commerce API Key is not configured in Admin Settings or Supabase.");

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

    // Create Coinbase Commerce charge
    const res = await fetch("https://api.commerce.coinbase.com/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": COINBASE_COMMERCE_API_KEY,
        "X-CC-Version": "2018-03-22",
      },
      body: JSON.stringify({
        name: "Abu Mafhal Marketplace",
        description: `Order Payment (Ref: ${ref})`,
        local_price: { amount: String(finalAmount), currency },
        pricing_type: "fixed_price",
        metadata: { order_id: order_id || null, reference: ref, customer_email: email || "" },
        redirect_url: "https://abumafhal.com/payment/verify?status=successful",
        cancel_url: "https://abumafhal.com/payment/verify?status=cancelled"
      }),
    });

    const json = await res.json();
    if (!res.ok || !json?.data) {
      console.error("Coinbase API Error:", json);
      return new Response(JSON.stringify({ error: "Coinbase charge creation failed", details: json }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chargeId = json.data.id;
    const hostedUrl = json.data.hosted_url;

    return new Response(JSON.stringify({
      success: true,
      charge_id: chargeId,
      hosted_url: hostedUrl,
      checkout_url: hostedUrl,
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