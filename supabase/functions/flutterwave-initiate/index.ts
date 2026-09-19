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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Missing Supabase env vars");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch live secret key from app_settings table in Supabase
    let FLUTTERWAVE_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!FLUTTERWAVE_SECRET_KEY) {
      try {
        const { data: rows } = await supabase.from("app_settings").select("*");
        if (rows && Array.isArray(rows)) {
          for (const r of rows) {
            if (r.key === "payment_gateways" && r.value && typeof r.value === "object") {
              if (r.value.flutterwave_secret_key) FLUTTERWAVE_SECRET_KEY = r.value.flutterwave_secret_key;
            } else if (r.key === "flutterwave_secret_key") {
              FLUTTERWAVE_SECRET_KEY = typeof r.value === "string" ? r.value : (r.value?.value || r.value?.key);
            }
          }
        }
      } catch (_) {}
    }

    if (!FLUTTERWAVE_SECRET_KEY) throw new Error("Flutterwave Secret Key is not configured in Admin Settings or Supabase.");

    const body = await req.json();
    const {
      order_id,
      email,
      phone_number,
      phone,
      name,
      amount,
      reference,
      tx_ref: clientTxRef,
      callback_url
    } = body;

    let finalAmount = amount;
    let currency = "NGN";

    if (order_id) {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, status, total_amount, currency")
        .eq("id", order_id)
        .single();

      if (order && !orderErr) {
        if (order.status === "PAID") {
          return new Response(JSON.stringify({ error: "Order already paid" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        finalAmount = order.total_amount;
        currency = order.currency ?? "NGN";
      }
    }

    if (!finalAmount || Number(finalAmount) <= 0) {
      return new Response(JSON.stringify({ error: "amount or valid order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tx_ref = clientTxRef || reference || (order_id ? `order_${order_id}_${crypto.randomUUID()}` : `FLW-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
    const redirect_url = callback_url || "https://abumafhal.com/payment/verify";

    const payload = {
      tx_ref,
      amount: String(finalAmount),
      currency: currency,
      redirect_url,
      customer: {
        email: email ?? "customer@abumafhal.com",
        phonenumber: phone_number || phone || "",
        name: name ?? "Customer",
      },
      meta: { order_id: order_id || null, tx_ref },
      customizations: {
        title: "Abu Mafhal Marketplace",
        description: `Order Payment (Ref: ${tx_ref})`,
        logo: "https://abumafhal.com/logo.png",
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
      console.error("Flutterwave API Error Response:", json);
      return new Response(
        JSON.stringify({ success: false, error: "Flutterwave init failed", details: json }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (order_id) {
      await supabase
        .from("orders")
        .update({
          provider: "flutterwave",
          provider_reference: tx_ref,
          status: "PENDING_PAYMENT",
        })
        .eq("id", order_id);
    }

    const paymentLink = json.data?.link;
    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: paymentLink,
        payment_link: paymentLink,
        checkout_url: paymentLink,
        tx_ref,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("flutterwave-initiate Exception:", e?.message || e);
    return new Response(JSON.stringify({ success: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});