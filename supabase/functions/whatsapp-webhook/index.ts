import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    const url = new URL(req.url);

    // GET Request: Webhook verification
    if (req.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            return new Response(challenge, { status: 200 });
        }

        return new Response("Invalid token", { status: 403 });
    }

    // POST Request: Outgoing Send or Webhook Event
    if (req.method === "POST") {
        try {
            const body = await req.json();
            console.log("Incoming request body:", JSON.stringify(body));

            const authHeader = req.headers.get("Authorization") || "";
            const isCustomRequest = authHeader.startsWith("Bearer ");

            // Initialize Supabase client
            const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
            const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
            const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

            // 1. Check if Database Webhook Trigger
            if (body.type === "INSERT" && body.table === "whatsapp_messages" && body.record) {
                const record = body.record;
                if (record.status === "sent" || record.status === "failed") {
                    return new Response(JSON.stringify({ message: "Already processed" }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                        status: 200,
                    });
                }

                const formattedPhone = formatPhoneNumber(record.phone);
                const sendResult = await sendWhatsApp(
                    WHATSAPP_PHONE_NUMBER_ID,
                    WHATSAPP_ACCESS_TOKEN,
                    formattedPhone,
                    record.message
                );

                await supabaseClient
                    .from("whatsapp_messages")
                    .update({
                        status: sendResult.success ? "sent" : "failed",
                        error_message: sendResult.error || null,
                    })
                    .eq("id", record.id);

                return new Response(JSON.stringify(sendResult), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: sendResult.success ? 200 : 400,
                });
            }

            // 2. Check if Direct send API call (Frontend/Mobile)
            if (isCustomRequest || body.action === "send") {
                const { phone, message, type, templateName, templateParams, userId } = body;

                if (!phone || (!message && !templateName)) {
                    return new Response(JSON.stringify({ error: "Missing phone, message or templateName" }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                        status: 400,
                    });
                }

                const formattedPhone = formatPhoneNumber(phone);
                const sendResult = await sendWhatsApp(
                    WHATSAPP_PHONE_NUMBER_ID,
                    WHATSAPP_ACCESS_TOKEN,
                    formattedPhone,
                    message,
                    type,
                    templateName,
                    templateParams
                );

                await supabaseClient.from("whatsapp_messages").insert({
                    user_id: userId || null,
                    phone: formattedPhone,
                    message: message || `Template: ${templateName}`,
                    status: sendResult.success ? "sent" : "failed",
                    error_message: sendResult.error || null,
                });

                return new Response(JSON.stringify(sendResult), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: sendResult.success ? 200 : 400,
                });
            }

            // 3. Fallback: standard incoming webhook event from Meta
            return new Response("EVENT_RECEIVED", { status: 200 });

        } catch (error) {
            console.error("Error processing request:", error);
            return new Response(JSON.stringify({ error: error.message }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            });
        }
    }
});

function formatPhoneNumber(phone: string): string {
    let clean = phone.replace(/\D/g, "");
    if (clean.startsWith("0") && clean.length === 11) {
        clean = "234" + clean.substring(1);
    } else if (clean.length === 10 && !clean.startsWith("234")) {
        clean = "234" + clean;
    }
    return clean;
}

async function sendWhatsApp(
    phoneId: string | undefined,
    token: string | undefined,
    to: string,
    message?: string,
    type?: string,
    templateName?: string,
    templateParams?: string[]
) {
    if (!phoneId || !token) {
        return { success: false, error: "Missing WhatsApp Cloud API credentials" };
    }

    let payload: any = {
        messaging_product: "whatsapp",
        to: to,
    };

    if (type === "template" || templateName) {
        payload.type = "template";
        payload.template = {
            name: templateName,
            language: {
                code: "en_US",
            },
            components: templateParams ? [
                {
                    type: "body",
                    parameters: templateParams.map((p) => ({
                        type: "text",
                        text: p,
                    })),
                },
            ] : [],
        };
    } else {
        payload.type = "text";
        payload.text = {
            body: message || "",
        };
    }

    try {
        const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const resJson = await res.json();
        if (res.ok) {
            return { success: true, messageId: resJson.messages?.[0]?.id };
        } else {
            return { success: false, error: JSON.stringify(resJson) };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}