// @ts-nocheck
/// <reference path="../ambient.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha512Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

function sortObject(obj: any): any {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  return Object.keys(obj)
    .sort()
    .reduce((result: any, key: string) => {
      result[key] = sortObject(obj[key]);
      return result;
    }, {});
}

Deno.serve(async (req: any) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Read IPN secret key from database app_settings or environment
    let ipnSecret = Deno.env.get("NOWPAYMENTS_IPN_KEY");
    if (!ipnSecret) {
      try {
        const { data: rows } = await supabase.from("app_settings").select("*");
        if (rows && Array.isArray(rows)) {
          for (const r of rows) {
            if (r.key === "payment_gateways" && r.value && typeof r.value === "object") {
              if (r.value.nowpayments_ipn_key) ipnSecret = r.value.nowpayments_ipn_key;
            } else if (r.key === "nowpayments_ipn_key") {
              ipnSecret = typeof r.value === "string" ? r.value : (r.value?.value || r.value?.key);
            }
          }
        }
      } catch (_) {}
    }

    const signature = req.headers.get("x-nowpayments-sig");
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody || "{}");

    // If IPN secret is configured, verify HMAC signature
    if (ipnSecret && signature) {
      const sortedPayload = JSON.stringify(sortObject(payload));
      const expected = await hmacSha512Hex(ipnSecret.trim(), sortedPayload);
      if (signature !== expected) {
        console.warn("NOWPayments signature mismatch");
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const paymentStatus = payload?.payment_status;
    const orderId = payload?.order_id;
    const paymentId = payload?.payment_id;

    console.log(`NOWPayments IPN received: order=${orderId}, status=${paymentStatus}, id=${paymentId}`);

    if (paymentStatus === "finished" || paymentStatus === "confirmed") {
      // 1. Check if order_id is a checkout_session id
      const { data: sessionData } = await supabase
        .from("checkout_sessions")
        .select("id, delivery_method, shipping_snapshot")
        .eq("id", orderId)
        .maybeSingle();

      if (sessionData) {
        const { data: createdOrderId, error: rpcError } = await supabase.rpc("create_order_from_session", {
          p_session_id: sessionData.id,
          p_provider: "nowpayments",
          p_provider_ref: String(paymentId || orderId),
        });

        if (!rpcError && createdOrderId) {
          await supabase
            .from("orders")
            .update({
              payment_status: "paid",
              status: "processing",
              delivery_method: sessionData.delivery_method || "standard",
              shipping_snapshot: sessionData.shipping_snapshot || null,
            })
            .eq("id", createdOrderId);
          console.log("NOWPayments order created from session:", createdOrderId);
        }
      } else {
        // 2. Direct order reference lookup
        const { data: order } = await supabase
          .from("orders")
          .select("id, payment_status")
          .or(`id.eq.${orderId},order_number.eq.${orderId},payment_ref.eq.${orderId}`)
          .maybeSingle();

        if (order) {
          await supabase
            .from("orders")
            .update({
              payment_status: "paid",
              status: "processing",
              payment_ref: String(paymentId || orderId),
            })
            .eq("id", order.id);
          console.log("NOWPayments direct order marked paid:", order.id);
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("NOWPayments Webhook Error:", err);
    return new Response(String(err?.message || err), { status: 500 });
  }
});
