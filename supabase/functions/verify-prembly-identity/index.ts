import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { type, value, company_name, company_type } = await req.json();

        // Initialize Supabase Client FIRST so we can fetch settings and determine URLs
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Fetch Prembly API keys dynamically from app_settings
        const { data: settings, error: settingsError } = await supabaseClient
            .from('app_settings')
            .select('prembly_app_id, prembly_secret_key')
            .single();

        if (settingsError || !settings?.prembly_app_id || !settings?.prembly_secret_key) {
            console.error('Settings fetch error:', settingsError);
            throw new Error('Prembly API credentials not found in settings. Please contact Admin.');
        }

        // Prembly uses the same Base URL for both Live and Sandbox. The Key format determines the environment.
        const BASE_URL = 'https://api.prembly.com/identitypass/verification';

        const ENDPOINTS: Record<string, string> = {
            bvn: `${BASE_URL}/bvn`,
            nin: `${BASE_URL}/nin`,
            vnin: `${BASE_URL}/vnin`,
            tin: `${BASE_URL}/tin`,
            cac: `${BASE_URL}/cac/advance`
        };

        if (!type || !ENDPOINTS[type]) {
            throw new Error('Invalid or missing verification type. Allowed types: bvn, nin, vnin, tin, cac');
        }

        if (!value && type !== 'cac') {
            throw new Error('Verification value is required');
        }





        const headers = {
            'Content-Type': 'application/json',
            'app-id': settings.prembly_app_id,
            'x-api-key': settings.prembly_secret_key
        };

        // Format request body depending on type
        let bodyObject: Record<string, any> = {};

        switch (type) {
            case 'bvn':
                bodyObject.number = value;
                break;
            case 'nin':
                // For direct 11-digit NIN, Prembly often uses number_nin or number depending on version
                // We'll try number_nin as it's the specific key for direct NIN in many of their endpoints
                bodyObject.number = value;
                // Adding number_nin as well just in case of version ambiguity
                bodyObject.number_nin = value;
                break;
            case 'vnin':
                bodyObject.number = value;
                break;
            case 'tin':
                bodyObject.number = value;
                bodyObject.channel = 'TIN';
                break;
            case 'cac':
                // For CAC we need rc_number, company_name, company_type (RC, BN, IT)
                bodyObject.rc_number = value;
                bodyObject.company_name = company_name || '';
                bodyObject.company_type = company_type || 'RC';
                break;
            default:
                break;
        }

        console.log(`Verifying ${type} payload:`, JSON.stringify(bodyObject));

        const premblyResponse = await fetch(ENDPOINTS[type], {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(bodyObject)
        });

        const data = await premblyResponse.json();

        console.log(`Prembly API Response for ${type}:`, JSON.stringify(data));

        if (!data.status) {
            return new Response(JSON.stringify({
                success: false,
                error: data.message || `Verification failed for ${type}`,
                message: data.message
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        return new Response(JSON.stringify({
            success: true,
            data: data.data || data.response || data.bvn_data || data.nin_data || data.cac_data || data,
            message: data.message,
            raw: data
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('Verify-Identity Edge Function Error:', error.message);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
