import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (_) { body = {}; }
        }

        const {
            amount,
            email,
            reference,
            callback_url,
            secret_key
        } = body;

        const safeAmount = Math.max(1, Number(amount) || 0);
        const ref = reference || `PAYSTACK-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const userEmail = (email && email.includes('@')) ? email.trim() : `customer_${Date.now()}@abumafhal.com`;
        const redirectUrl = callback_url || 'https://abumafhal.com/payment/verify';

        // 1. Fetch live secret key from app_settings or payload or env
        let paystackSecret = secret_key;
        if (!paystackSecret) {
            try {
                const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                const { data: rows } = await supabase.from('app_settings').select('*');
                if (rows && Array.isArray(rows)) {
                    for (const r of rows) {
                        if (r.key === 'payment_gateways' && r.value && typeof r.value === 'object') {
                            if (r.value.paystack_secret_key) paystackSecret = r.value.paystack_secret_key;
                        } else if (r.key === 'paystack_secret_key') {
                            paystackSecret = typeof r.value === 'string' ? r.value : (r.value?.value || r.value?.key);
                        }
                    }
                }
            } catch (_) {}
        }

        if (!paystackSecret) {
            paystackSecret = process.env.PAYSTACK_SECRET_KEY || process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY;
        }

        if (!paystackSecret) {
            return res.status(400).json({
                success: false,
                error: 'Paystack Secret Key is not configured in Admin Settings or Database. Please configure your sk_live_... key in Admin Settings.'
            });
        }

        // 2. Call Official Paystack Initialize API (Server-side, no CORS)
        const psPayload = {
            email: userEmail,
            amount: Math.round(safeAmount * 100),
            reference: ref,
            currency: 'NGN',
            callback_url: redirectUrl
        };

        const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecret.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(psPayload)
        });

        const psData = await psRes.json();
        if (!psRes.ok || !psData?.status || !psData?.data?.authorization_url) {
            return res.status(400).json({
                success: false,
                error: psData?.message || 'Paystack initialization failed',
                details: psData
            });
        }

        return res.status(200).json({
            success: true,
            authorization_url: psData.data.authorization_url,
            checkout_url: psData.data.authorization_url,
            access_code: psData.data.access_code,
            reference: psData.data.reference || ref
        });

    } catch (err) {
        console.error('[API initiate-paystack error]', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error while initializing Paystack'
        });
    }
}
