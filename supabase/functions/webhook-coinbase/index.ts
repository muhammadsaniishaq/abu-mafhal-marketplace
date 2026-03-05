import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

Deno.serve(async (req) => {
  try {
    const WEBHOOK_SECRET = Deno.env.get("COINBASE_COMMERCE_WEBHOOK_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!WEBHOOK_SECRET) throw new Error("Missing COINBASE_COMMERCE_WEBHOOK_SECRET");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");

    const signature = req.headers.get("X-CC-Webhook-Signature") ?? req.headers.get("x-cc-webhook-signature");
    const rawBody = await req.text();

    if (!signature) return new Response("Missing signature", { status: 401 });

    const expected = await hmacSha256Hex(WEBHOOK_SECRET, rawBody);
    if (signature !== expected) return new Response("Invalid signature", { status: 401 });

    const event = JSON.parse(rawBody);
    const type = event?.event?.type;
    const data = event?.event?.data;

    // metadata.session_id from initiate
    const session_id = data?.metadata?.session_id;
    const chargeId = data?.id;

    if (!session_id) return new Response("Missing session_id", { status: 400 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Commerce events commonly include confirmed/failed statuses; treat “confirmed/paid” as success
    // Adjust the condition based on the exact event types you receive.
    const isPaid =
      type === "charge:confirmed" || type === "charge:resolved" || type === "charge:paid";

    if (isPaid) {
      const { data: orderId, error: rpcError } = await supabase.rpc("create_order_from_session", {
        p_session_id: session_id,
        p_provider: "coinbase",
        p_provider_ref: chargeId ?? null
      });

      if (rpcError) {
        console.error("RPC Error (Conversion):", rpcError);
        return new Response("Failed to create order from session", { status: 500 });
      }
      console.log("Order created from session:", orderId);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    return new Response(String(e?.message ?? e), { status: 500 });
  }
});