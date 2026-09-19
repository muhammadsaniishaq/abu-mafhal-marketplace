// @ts-nocheck
/// <reference path="../ambient.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

Deno.serve(async (req: any) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      try {
        const { data: rows } = await supabase.from("app_settings").select("*");
        if (rows && Array.isArray(rows)) {
          for (const r of rows) {
            if (r.key === "payment_gateways" && r.value && typeof r.value === "object") {
              if (r.value.paystack_secret_key) PAYSTACK_SECRET_KEY = r.value.paystack_secret_key;
            } else if (r.key === "paystack_secret_key") {
              PAYSTACK_SECRET_KEY = typeof r.value === "string" ? r.value : (r.value?.value || r.value?.key);
            }
          }
        }
      } catch (_) {}
    }

    if (!PAYSTACK_SECRET_KEY) throw new Error("Missing PAYSTACK_SECRET_KEY");

    const signature = req.headers.get("x-paystack-signature");
    const rawBody = await req.text();

    if (!signature) return new Response("Unauthorized", { status: 401 });

    const expected = await hmacSha512Hex(PAYSTACK_SECRET_KEY, rawBody);
    if (signature !== expected) return new Response("Unauthorized", { status: 401 });

    const payload = JSON.parse(rawBody);
    const event = payload?.event;
    const data = payload?.data;
    const reference = data?.reference;
    const session_id = data?.metadata?.session_id;

    if (!session_id) return new Response("Missing session_id", { status: 400 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (event === "charge.success") {
      const { data: orderId, error: rpcError } = await supabase.rpc("create_order_from_session", {
        p_session_id: session_id,
        p_provider: "paystack",
        p_provider_ref: reference ?? null
      });

      if (rpcError) {
        console.error("RPC Error (Conversion):", rpcError);
        return new Response("Failed to create order from session", { status: 500 });
      }
      console.log("Order created from session:", orderId);

      if (orderId) {
        const { data: sessData } = await supabase
          .from("checkout_sessions")
          .select("delivery_method, shipping_snapshot")
          .eq("id", session_id)
          .maybeSingle();
        if (sessData) {
          await supabase
            .from("orders")
            .update({
              delivery_method: sessData.delivery_method || 'standard',
              shipping_snapshot: sessData.shipping_snapshot || null
            })
            .eq("id", orderId);
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (e: any) {
    return new Response(String(e?.message ?? e), { status: 500 });
  }
});