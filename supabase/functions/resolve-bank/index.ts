// supabase/functions/resolve-bank/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        let account_number, bank_code;

        if (req.method === "POST") {
            const body = await req.json();
            account_number = body.account_number;
            bank_code = body.bank_code;
        } else {
            const url = new URL(req.url);
            account_number = url.searchParams.get("account_number");
            bank_code = url.searchParams.get("bank_code");
        }

        if (!account_number || !bank_code) {
            return new Response(
                JSON.stringify({ status: false, message: "Missing account_number or bank_code" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
        if (!secretKey) {
            return new Response(
                JSON.stringify({ status: false, message: "Server misconfigured: missing PAYSTACK_SECRET_KEY" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const psRes = await fetch(
            `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(
                account_number
            )}&bank_code=${encodeURIComponent(bank_code)}`,
            {
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const data = await psRes.json();

        return new Response(JSON.stringify(data), {
            status: psRes.status,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
            },
        });
    } catch (e) {
        return new Response(
            JSON.stringify({ status: false, message: "Unexpected server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});