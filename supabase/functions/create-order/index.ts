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
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: req.headers.get("Authorization")! },
                },
            }
        );

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { items, address_id, payment_method, coupon_code, order_notes } = await req.json();

        if (!items || !items.length) throw new Error("Cart is empty");
        if (!address_id) throw new Error("Shipping address is required");

        // 1. Fetch products to recompute total (Security: Prevent client tampering)
        const itemIds = items.map((i: any) => i.id);
        const { data: products, error: productsError } = await supabaseClient
            .from("products")
            .select("*")
            .in("id", itemIds);

        if (productsError) throw productsError;

        let subtotal = 0;
        const orderItems = items.map((cartItem: any) => {
            const product = products.find((p: any) => p.id === cartItem.id);
            if (!product) throw new Error(`Product ${cartItem.id} not found`);
            const price = product.price;
            const quantity = cartItem.qty || cartItem.quantity || 1;
            subtotal += price * quantity;
            return {
                product_id: product.id,
                quantity,
                price,
                vendor_id: product.vendor_id,
            };
        });

        // 2. Shipping Fee
        const { data: address, error: addressError } = await supabaseClient
            .from("addresses")
            .select("*")
            .eq("id", address_id)
            .single();

        if (addressError) throw addressError;

        const majorStates = ["Lagos", "Abuja", "Kano", "Rivers"];
        const shippingFee = majorStates.includes(address.state) ? 1500 : 3000;
        const tax = Math.round(subtotal * 0.05);

        // 3. Coupon validation
        let discount = 0;
        let couponId = null;
        if (coupon_code) {
            const { data: coupon } = await supabaseClient
                .from("coupons")
                .select("*")
                .eq("code", coupon_code.toUpperCase())
                .eq("is_active", true)
                .single();

            if (coupon) {
                discount = coupon.discount_type === "percentage"
                    ? (subtotal * coupon.discount_value) / 100
                    : coupon.discount_value;
                couponId = coupon.id;
            }
        }

        const totalAmount = Math.max(0, subtotal + shippingFee + tax - discount);
        console.log(`CreateOrder: subtotal=${subtotal}, shipping=${shippingFee}, tax=${tax}, discount=${discount}, total=${totalAmount}`);

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: order, error: orderError } = await supabaseAdmin
            .from("orders")
            .insert([
                {
                    user_id: user.id,
                    total_amount: totalAmount,
                    subtotal,
                    shipping_fee: shippingFee,
                    tax,
                    discount_applied: discount,
                    status: "pending",
                    shipping_address: `${address.address}, ${address.city}, ${address.state}`,
                    payment_method,
                    items_count: items.length,
                    coupon_id: couponId,
                    order_notes: order_notes || ""
                },
            ])
            .select()
            .single();

        if (orderError) throw orderError;

        // Insert order items
        await supabaseAdmin
            .from("order_items")
            .insert(orderItems.map((oi: any) => ({ ...oi, order_id: order.id })));

        return new Response(JSON.stringify({
            order_id: order.id,
            amount: totalAmount,
            email: user.email
        }), {
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
