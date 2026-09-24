// @ts-nocheck
/// <reference path="../ambient.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: any) => {
  try {
    let secretHash = Deno.env.get("FLUTTERWAVE_WEBHOOK_HASH") || "AbuMafhalWebhook2026";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Missing Supabase env vars");

    const body = await req.json();
    const data = body?.data ?? body;
    const status = data?.status;
    const tx_ref = data?.tx_ref;
    const session_id = data?.meta?.session_id;
    const flwId = data?.id;

    // Flutterwave sends this header:
    const signature = req.headers.get("verif-hash");
    let isVerified = signature && signature === secretHash;

    // Verification fallback: verify directly with Flutterwave API if signature didn't match
    if (!isVerified && flwId) {
      try {
        const flwSecret = "FLWSECK-456331fb55a2e059f1eb8d439c53b9ae-1a07bfbf2fcvt-X";
        const vRes = await fetch(`https://api.flutterwave.com/v3/transactions/${flwId}/verify`, {
          headers: { "Authorization": `Bearer ${flwSecret}` }
        });
        if (vRes.ok) {
          const vData = await vRes.json();
          if (vData?.status === "success" && vData?.data?.status === "successful") {
            isVerified = true;
          }
        }
      } catch (_) {}
    }

    if (!isVerified) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Virtual Account Bank Transfer Auto-Credit Handling
    if (status === "successful" && (!session_id || tx_ref?.startsWith("AMF-DVA") || data?.payment_type === "bank_transfer")) {
        const depositAmt = Number(data?.amount || 0);
        const custEmail = data?.customer?.email;

        let targetUser = null;
        if (custEmail) {
            const { data: u } = await supabase.from("profiles").select("id, balance").eq("email", custEmail).maybeSingle();
            if (u) targetUser = u;
        }

        if (!targetUser && tx_ref && tx_ref.startsWith("AMF-DVA-")) {
            const prefix = tx_ref.replace("AMF-DVA-", "").split("-")[0].toLowerCase();
            const { data: users } = await supabase.from("profiles").select("id, balance");
            if (users && Array.isArray(users)) {
                targetUser = users.find(u => u.id.toLowerCase().startsWith(prefix));
            }
        }

        // Check if reference already recorded
        const refCode = data?.flw_ref || tx_ref || `FLW-${data?.id || Date.now()}`;
        const { data: existingTx } = await supabase
            .from("transactions")
            .select("id")
            .eq("reference", refCode)
            .maybeSingle();

        if (existingTx) {
            return new Response("Already Processed", { status: 200 });
        }

        if (targetUser && depositAmt > 0) {
            const newBal = Number(targetUser.balance || 0) + depositAmt;
            await supabase.from("profiles").update({ balance: newBal }).eq("id", targetUser.id);
            await supabase.from("transactions").insert({
                user_id: targetUser.id,
                type: "topup",
                amount: depositAmt,
                status: "completed",
                reference: refCode,
                description: `Bank Transfer Deposit of ₦${depositAmt.toLocaleString()} via Flutterwave MFB (Ref: ${refCode})`
            });
            console.log(`[FLW Webhook] Credited user ${targetUser.id} with ${depositAmt}. New balance: ${newBal}`);
            return new Response(JSON.stringify({ success: true, credited: depositAmt, user_id: targetUser.id }), { status: 200 });
        }
    }

    if (!session_id) return new Response("Missing session_id", { status: 400 });

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