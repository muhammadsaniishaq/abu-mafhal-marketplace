import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { order_id } = await req.json();
        if (!order_id) throw new Error("Order ID is required");

        // Fetch order
        const { data: order, error: orderError } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("id", order_id)
            .single();

        if (orderError || !order) throw new Error("Order not found");
        if (order.status === "paid") return new Response(JSON.stringify({ status: "already_paid" }));

        // Check user balance
        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("wallet_balance")
            .eq("id", order.user_id)
            .single();

        if (profileError || !profile) throw new Error("Could not verify wallet balance");
        if (profile.wallet_balance < order.total_amount) {
            // Cancel order if balance insufficient
            await supabaseAdmin.from("orders").update({ status: "cancelled", order_notes: "Insufficient wallet balance" }).eq("id", order_id);
            throw new Error("Insufficient wallet balance");
        }

        // Atomic deduction
        const { error: deductError } = await supabaseAdmin.rpc("decrement_wallet_balance", {
            p_user_id: order.user_id,
            p_amount: order.total_amount
        });

        if (deductError) throw deductError;

        // Mark as paid
        await supabaseAdmin.from("orders").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", order_id);

        // Notify vendors
        const { data: items } = await supabaseAdmin.from("order_items").select("vendor_id, price, quantity").eq("order_id", order_id);
        if (items) {
            for (const item of items) {
                await supabaseAdmin.rpc("increment_wallet_balance", {
                    p_vendor_id: item.vendor_id,
                    p_amount: item.price * item.quantity
                });
            }
        }

        return new Response(JSON.stringify({ status: "success" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
