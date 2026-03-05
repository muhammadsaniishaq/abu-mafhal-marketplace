import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        if (!resendApiKey) {
            throw new Error("RESEND_API_KEY is not set in environment variables");
        }

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Parse webhook payload from Supabase Database Webhook
        const payload = await req.json();
        const record = payload.record;

        if (!record || !record.id) {
            throw new Error("Invalid payload: Missing record");
        }

        if (record.status === 'sent') {
            return new Response(JSON.stringify({ message: "Email already sent" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const emailPayload = {
            // Using the verified custom domain
            from: "ABU MAFHAL <support@abumafhal.com>",
            to: record.to_email,
            subject: record.subject,
            html: record.html,
        };

        // Delay artificially to respect Resend Free Tier (2 req/sec)
        // Since Supabase Webhooks fire simultaneously, we add a random jitter between 500ms - 2000ms
        const delay = Math.floor(Math.random() * 1500) + 500;
        await new Promise(resolve => setTimeout(resolve, delay));

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(emailPayload),
        });

        const resData = await res.json();

        if (res.ok) {
            // Mark as sent
            await supabaseClient
                .from('mail')
                .update({ status: 'sent', error_message: null })
                .eq('id', record.id);

            return new Response(JSON.stringify({ success: true, id: resData.id }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        } else {
            // Mark as failed
            await supabaseClient
                .from('mail')
                .update({ status: 'failed', error_message: JSON.stringify(resData) })
                .eq('id', record.id);

            throw new Error(JSON.stringify(resData));
        }

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
