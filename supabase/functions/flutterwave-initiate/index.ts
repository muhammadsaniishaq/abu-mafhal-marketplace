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
    const FLUTTERWAVE_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FLUTTERWAVE_SECRET_KEY) throw new Error("Missing FLUTTERWAVE_SECRET_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Missing Supabase env vars");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { order_id, email, phone_number, name } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const tx_ref = `order_${order_id}_${crypto.randomUUID()}`;

    const payload = {
      tx_ref,
      amount: String(order.total_amount),
      currency: order.currency ?? "NGN",
      redirect_url: "YOUR_APP_CALLBACK_URL",
      customer: {
        email: email ?? "customer@example.com",
        phonenumber: phone_number ?? "",
        name: name ?? "",
      },
      meta: { order_id },
      customizations: {
        title: "Checkout Payment",
        description: "Order payment",
      },
    };

    const res = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok || json?.status !== "success") {
      return new Response(
        JSON.stringify({ error: "Flutterwave init failed", details: json }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("orders")
      .update({
        provider: "flutterwave",
        provider_reference: tx_ref,
        status: "PENDING_PAYMENT",
      })
      .eq("id", order_id);

    return new Response(
      JSON.stringify({ payment_link: json.data.link, tx_ref }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});