import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const secretHash = Deno.env.get("FLUTTERWAVE_WEBHOOK_HASH");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!secretHash) throw new Error("Missing FLUTTERWAVE_WEBHOOK_HASH");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Missing Supabase env vars");

    // Flutterwave usually sends this header:
    const signature = req.headers.get("verif-hash");
    if (!signature || signature !== secretHash) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    // We expect meta.session_id from initiation
    const session_id = body?.data?.meta?.session_id;

    // Payment status check
    const status = body?.data?.status;
    const tx_ref = body?.data?.tx_ref;

    if (!session_id) return new Response("Missing session_id", { status: 400 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (status === "successful") {
      const { data: orderId, error: rpcError } = await supabase.rpc("create_order_from_session", {
        p_session_id: session_id,
        p_provider: "flutterwave",
        p_provider_ref: tx_ref ?? null
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