import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("--- Initiate Payment Started ---");

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "No Authorization header provided" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: authHeader },
                },
            }
        );

        // Get user from JWT
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace(/Bearer /i, ""));

        if (userError || !user) {
            console.error("Auth Error (DIAG_001):", userError);
            return new Response(JSON.stringify({
                error: "DIAG_AUTH_FAILURE",
                details: userError?.message || "Invalid or missing user session"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }
        console.log("User:", user.id, user.email);

        const body = await req.json();
        console.log("Payload:", JSON.stringify(body));

        const { items, address_id, payment_method, coupon_code, order_notes, shipping_override } = body;

        if (!items || !items.length) throw new Error("Cart is empty");

        // Initialize Admin Client once at the top
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        let address: any = null;
        let shippingAddressString = "";

        if (address_id && address_id !== 'default') {
            const { data: addressData, error: addressError } = await supabaseAdmin
                .from("addresses")
                .select("*")
                .eq("id", address_id)
                .eq("user_id", user.id) // Security check: Ensure it belongs to the user
                .single();

            if (addressError) {
                console.error("Address Lookup Error (DIAG_003):", addressError);
                throw new Error("Shipping address not found in database for this user.");
            }
            address = addressData;
            shippingAddressString = `${address.address}, ${address.city}, ${address.state}`;
        } else if (shipping_override) {
            address = shipping_override;
            shippingAddressString = `${address.address}, ${address.city}, ${address.state}`;
        } else {
            throw new Error("Shipping address is required");
        }

        // 1. Fetch products to recompute total
        console.log("Fetching products:", items.map((i: any) => i.id));
        const itemIds = items.map((i: any) => i.id);
        const { data: products, error: productsError } = await supabaseClient
            .from("products")
            .select("*")
            .in("id", itemIds);

        if (productsError) {
            console.error("Products Fetch Error:", productsError);
            throw productsError;
        }

        let subtotal = 0;
        const orderItems = items.map((cartItem: any) => {
            const product = products.find((p: any) => p.id === cartItem.id);
            if (!product) throw new Error(`Product ${cartItem.id} not found in database`);
            const price = product.price;
            const quantity = cartItem.qty || cartItem.quantity || 1;
            subtotal += price * quantity;
            return {
                order_id: "", // placeholder, will be set during bulk insert or after order creation
                product_id: product.id,
                user_id: user.id,
                quantity,
                price,
                subtotal: price * quantity,
                vendor_id: product.vendor_id,
                variant: cartItem.variant || null
            };
        });
        console.log("Subtotal calculated:", subtotal);

        const majorStates = ["Lagos", "Abuja", "Kano", "Rivers"];
        const shippingFee = (address && majorStates.includes(address.state)) ? 1500 : 3000;

        // 3. Tax (5% standard)
        const tax = Math.round(subtotal * 0.05);

        // 4. Coupon validation
        let discount = 0;
        let couponId = null;
        if (coupon_code) {
            console.log("Validating coupon:", coupon_code);
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
        console.log("Total Amount:", totalAmount);

        // 5. Create Order using Service Role

        // 5b. Resolve Profile IDs to Vendor IDs (Constraint 'order_items_vendor_id_fkey' references 'vendors(id)')
        const profileVendorIds = [...new Set(products.map((p: any) => p.vendor_id).filter(Boolean))] as string[];
        const { data: vendorRecords, error: vError } = await supabaseAdmin
            .from("vendors")
            .select("id, user_id")
            .in("user_id", profileVendorIds);

        if (vError) {
            console.error("Vendor Resolution Error:", vError);
            throw new Error("Could not resolve vendor associations for products.");
        }

        const vendorIdMap: Record<string, string> = {};
        vendorRecords?.forEach((v: any) => {
            if (v.user_id) vendorIdMap[v.user_id as string] = v.id;
        });

        // Auto-create missing vendor records (for admins/orphans) to prevent FK violation
        for (const pid of profileVendorIds) {
            if (!vendorIdMap[pid]) {
                console.warn(`Profile ${pid} has no vendor entry. Creating minimal vendor record...`);
                const { data: newVendor, error: nvError } = await supabaseAdmin
                    .from("vendors")
                    .insert({
                        user_id: pid,
                        store_name: "Marketplace Seller",
                        store_slug: `seller-${pid.split('-')[0]}-${Math.random().toString(36).substr(2, 4)}`,
                        is_verified: true
                    })
                    .select("id")
                    .single();

                if (nvError) {
                    console.error(`Failed to auto-create vendor for ${pid}:`, nvError);
                    throw new Error(`Product owner ${pid} is not a registered vendor.`);
                }
                vendorIdMap[pid] = newVendor.id;
            }
        }

        const paymentRef = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // 5. Create Checkout Session using Service Role
        const { data: session, error: sessionError } = await supabaseAdmin
            .from("checkout_sessions")
            .insert([
                {
                    user_id: user.id,
                    items: orderItems.map((oi: any) => ({
                        ...oi,
                        vendor_id: vendorIdMap[oi.vendor_id] || oi.vendor_id
                    })),
                    address_id: address_id,
                    shipping_address: shippingAddressString,
                    payment_method,
                    total_amount: totalAmount,
                    subtotal,
                    shipping_fee: shippingFee,
                    tax,
                    discount_applied: discount,
                    payment_reference: paymentRef,
                    coupon_id: couponId,
                    order_notes: order_notes || ""
                },
            ])
            .select()
            .single();

        if (sessionError) {
            console.error("Session Insert Error:", sessionError);
            throw sessionError;
        }
        console.log("Checkout Session Created:", session.id);

        // 6. Provider Initialization
        let checkoutUrl = "";

        if (payment_method === "Paystack") {
            const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
            if (!paystackSecret) throw new Error("Paystack configuration missing (Secret Key)");

            const response = await fetch("https://api.paystack.co/transaction/initialize", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${paystackSecret}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: user.email,
                    amount: Math.round(totalAmount * 100),
                    reference: paymentRef,
                    metadata: { session_id: session.id, user_id: user.id },
                }),
            });

            const result = await response.json();
            if (!result.status) throw new Error(result.message || "Paystack initiation failed");
            checkoutUrl = result.data.authorization_url;
        }
        else if (payment_method === "Flutterwave") {
            const flwSecret = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
            if (!flwSecret) throw new Error("Flutterwave configuration missing (Secret Key)");

            const response = await fetch("https://api.flutterwave.com/v3/payments", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${flwSecret}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    tx_ref: paymentRef,
                    amount: totalAmount,
                    currency: "NGN",
                    redirect_url: "https://abumafhal.com/payment/verify",
                    customer: {
                        email: user.email,
                        name: user.user_metadata?.full_name || "Customer",
                    },
                    meta: { session_id: session.id },
                    customizations: {
                        title: "Abu Mafhal Marketplace",
                        description: `Payment for Order (Ref: ${paymentRef})`,
                        logo: "https://abumafhal.com/logo.png",
                    },
                }),
            });

            const result = await response.json();
            if (result.status !== "success") throw new Error(result.message || "Flutterwave initiation failed");
            checkoutUrl = result.data.link;
        }
        else if (payment_method === "Wallet") {
            const { data: walletData, error: walletError } = await supabaseAdmin
                .from("wallets")
                .select("balance")
                .eq("user_id", user.id)
                .single();

            if (walletError || !walletData) throw new Error("Wallet not found for this user.");
            if (walletData.balance < totalAmount) {
                return new Response(JSON.stringify({
                    error: "Insufficient Wallet Balance",
                    details: `You need NGN ${totalAmount.toLocaleString()}, but your balance is only NGN ${walletData.balance.toLocaleString()}.`
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 400,
                });
            }

            const { error: deductError } = await supabaseAdmin.rpc("decrement_wallet_balance", {
                p_user_id: user.id,
                p_amount: totalAmount
            });

            if (deductError) throw deductError;

            // Finalize order immediately for Wallet
            const { data: finalOrderId, error: conversionError } = await supabaseAdmin.rpc("create_order_from_session", {
                p_session_id: session.id,
                p_provider: "wallet",
                p_provider_ref: paymentRef
            });

            if (conversionError) {
                console.error("Session to Order Conversion Error (Wallet):", conversionError);
                throw conversionError;
            }

            checkoutUrl = "success";
        }
        else if (payment_method === "Coinbase") {
            const coinbaseSecret = Deno.env.get("COINBASE_API_KEY");
            if (!coinbaseSecret) throw new Error("Coinbase configuration missing (API Key)");

            const response = await fetch("https://api.commerce.coinbase.com/charges", {
                method: "POST",
                headers: {
                    "X-CC-Api-Key": coinbaseSecret,
                    "X-CC-Version": "2018-03-22",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: `Abu Mafhal Marketplace`,
                    description: `Order Ref: ${paymentRef}`,
                    local_price: {
                        amount: totalAmount.toString(),
                        currency: "NGN",
                    },
                    pricing_type: "fixed_price",
                    metadata: {
                        session_id: session.id,
                        user_id: user.id
                    },
                    redirect_url: "https://abumafhal.com/payment/success",
                    cancel_url: "https://abumafhal.com/payment/cancel"
                }),
            });

            const result = await response.json();
            if (!result.data || !result.data.hosted_url) {
                console.error("Coinbase Error Detail:", result);
                throw new Error(result.error?.message || "Coinbase initiation failed");
            }
            checkoutUrl = result.data.hosted_url;
        }
        else {
            throw new Error(`Payment method ${payment_method} not supported.`);
        }

        console.log("Success! Redirection URL:", checkoutUrl);
        return new Response(JSON.stringify({ checkout_url: checkoutUrl, session_id: session.id, payment_reference: paymentRef }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        console.error("CRITICAL ERROR (DIAG_002):", error.message || error);
        return new Response(JSON.stringify({
            error: "DIAG_CRITICAL_ERROR: " + (error.message || "Internal server error"),
            details: error.toString()
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
