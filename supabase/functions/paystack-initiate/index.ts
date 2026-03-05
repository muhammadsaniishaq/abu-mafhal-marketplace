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
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!PAYSTACK_SECRET_KEY) throw new Error("Missing PAYSTACK_SECRET_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { order_id, email } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read order from DB (anti-tamper: server is source of truth)
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, status, total_amount, currency")
      .eq("id", order_id)
      .single();

    console.log(`PaystackInit: OrderId=${order_id}, TotalAmount=${order?.total_amount}, Currency=${order?.currency}`);

    if (orderErr || !order) throw new Error("Order not found");
    if (order.status === "PAID") {
      return new Response(JSON.stringify({ error: "Order already paid" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If your DB stores NGN in naira, convert to kobo:
    const amountKobo =
      (order.currency ?? "NGN") === "NGN"
        ? Math.round(Number(order.total_amount) * 100)
        : Number(order.total_amount);

    console.log(`PaystackInit: Final amountKobo=${amountKobo}`);

    if (!amountKobo || amountKobo <= 0) throw new Error("Invalid order amount");

    const reference = `order_${order_id}_${crypto.randomUUID()}`;

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email ?? "customer@example.com",
        amount: amountKobo,
        reference,
        metadata: { order_id },
      }),
    });

    const json = await res.json();
    if (!res.ok || !json?.status) {
      return new Response(JSON.stringify({ error: "Paystack init failed", details: json }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save reference for tracking
    await supabase
      .from("orders")
      .update({
        provider: "paystack",
        provider_reference: reference,
        status: "PENDING_PAYMENT",
      })
      .eq("id", order_id);

    return new Response(
      JSON.stringify({
        authorization_url: json.data.authorization_url,
        access_code: json.data.access_code,
        reference,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});