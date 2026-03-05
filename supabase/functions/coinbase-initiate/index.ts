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
    const COINBASE_COMMERCE_API_KEY = Deno.env.get("COINBASE_COMMERCE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!COINBASE_COMMERCE_API_KEY) throw new Error("Missing COINBASE_COMMERCE_API_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order from DB (server source of truth)
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, status, total_amount, currency")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) throw new Error("Order not found");
    if (order.status === "PAID") {
      return new Response(JSON.stringify({ error: "Order already paid" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currency = (order.currency ?? "USD").toUpperCase(); // Commerce commonly supports USD; use what you support
    const amount = String(order.total_amount);

    // Create Coinbase Commerce charge
    const res = await fetch("https://api.commerce.coinbase.com/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": COINBASE_COMMERCE_API_KEY,
        "X-CC-Version": "2018-03-22",
      },
      body: JSON.stringify({
        name: "Order payment",
        description: `Payment for order ${order_id}`,
        local_price: { amount, currency },
        pricing_type: "fixed_price",
        metadata: { order_id },
      }),
    });

    const json = await res.json();
    if (!res.ok || !json?.data) {
      return new Response(JSON.stringify({ error: "Coinbase init failed", details: json }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chargeId = json.data.id;
    const hostedUrl = json.data.hosted_url;

    await supabase
      .from("orders")
      .update({
        provider: "coinbase",
        provider_reference: chargeId,
        status: "PENDING_PAYMENT",
      })
      .eq("id", order_id);

    return new Response(JSON.stringify({ charge_id: chargeId, hosted_url: hostedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});