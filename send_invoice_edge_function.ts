import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { invoice_id, email, invoice_data } = await req.json();

        if (!email) {
            throw new Error("No email provided");
        }

        // You can fetch invoice data from DB if not provided, using Supabase Client
        // For now assuming we pass basic info or fetch it here.

        // HTML Template
        const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0F172A;">Purchase Receipt</h1>
        <p>Thank you for your order!</p>
        <p><strong>Invoice ID:</strong> ${invoice_id}</p>
        <p>You can view and verify your invoice here:</p>
        <a href="https://abumafhal.com/verify/${invoice_id}" style="background: #0F172A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Invoice</a>
        <br/><br/>
        <p style="font-size: 12px; color: #888;">Abu Mafhal Ltd</p>
      </div>
    `;

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Abu Mafhal <orders@abumafhal.com>", // UPDATE THIS
                to: [email],
                subject: `Invoice ${invoice_id} from Abu Mafhal`,
                html: htmlContent,
            }),
        });

        const data = await res.json();

        return new Response(JSON.stringify(data), {
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
