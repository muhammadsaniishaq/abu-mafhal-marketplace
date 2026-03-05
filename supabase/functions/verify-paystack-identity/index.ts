// supabase/functions/verify-paystack-identity/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { type, value } = await req.json();

        if (!type || !value) {
            return new Response(JSON.stringify({ success: false, error: "Missing type or value" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
        if (!secretKey) {
            return new Response(JSON.stringify({ success: false, error: "Server misconfigured: missing PAYSTACK_SECRET_KEY" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            });
        }

        let url = "";
        let method = "GET";
        let body = null;

        if (type === "bvn") {
            // Paystack BVN Resolution
            url = `https://api.paystack.co/bank/resolve_bvn/${value}`;
        } else if (type === "nin") {
            // Note: Paystack NIN verification usually requires customer validation or dedicated tools.
            // For a simple 'check', we can try the identity verification endpoint if available, 
            // but BVN is the primary identity tool for Paystack.
            // If the user specifically wants NIN via Paystack, we'll try the identity endpoint.
            url = "https://api.paystack.co/identityverification";
            method = "POST";
            body = JSON.stringify({
                type: "nin",
                value: value
            });
        } else {
            return new Response(JSON.stringify({ success: false, error: `Unsupported verification type for Paystack: ${type}` }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        const psRes = await fetch(url, {
            method: method,
            headers: {
                Authorization: `Bearer ${secretKey}`,
                "Content-Type": "application/json",
            },
            body: body
        });

        const data = await psRes.json();

        if (!data.status) {
            return new Response(JSON.stringify({
                success: false,
                error: data.message || "Paystack verification failed",
                raw: data
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200, // Return 200 so frontend can handle the 'false' status gracefully
            });
        }

        return new Response(JSON.stringify({
            success: true,
            data: data.data,
            message: data.message
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error("Paystack Identity Error:", error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
