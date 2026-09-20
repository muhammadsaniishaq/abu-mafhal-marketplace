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
            phone,
            name,
            reference,
            tx_ref,
            callback_url,
            secret_key
        } = body;

        const safeAmount = Math.max(1, Number(amount) || 0);
        const ref = tx_ref || reference || `FLW-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const userEmail = (email && email.includes('@')) ? email.trim() : `customer_${Date.now()}@abumafhal.com`;
        const userName = name || 'Valued Customer';
        const userPhone = phone || '08000000000';
        const redirectUrl = callback_url || 'https://abumafhal.com/payment/verify';

        // 1. Fetch live secret key from app_settings or payload or env
        let flwSecret = secret_key;
        if (!flwSecret) {
            try {
                const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                const { data: rows } = await supabase.from('app_settings').select('*');
                if (rows && Array.isArray(rows)) {
                    for (const r of rows) {
                        if (r.key === 'payment_gateways' && r.value && typeof r.value === 'object') {
                            if (r.value.flutterwave_secret_key) flwSecret = r.value.flutterwave_secret_key;
                        } else if (r.key === 'flutterwave_secret_key') {
                            flwSecret = typeof r.value === 'string' ? r.value : (r.value?.value || r.value?.key);
                        }
                    }
                }
            } catch (_) {}
        }

        if (!flwSecret) {
            flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || process.env.EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY;
        }

        if (!flwSecret) {
            return res.status(400).json({
                success: false,
                error: 'Flutterwave Secret Key is not configured in Admin Settings or Database.'
            });
        }

        // 2. Call Official Flutterwave Payments API (Server-side, no CORS)
        const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${flwSecret.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tx_ref: ref,
                amount: safeAmount,
                currency: 'NGN',
                redirect_url: redirectUrl,
                customer: {
                    email: userEmail,
                    phonenumber: userPhone,
                    name: userName
                },
                customizations: {
                    title: 'Abu Mafhal Marketplace',
                    description: `Order Ref: ${ref}`,
                    logo: 'https://abumafhal.com/logo.png'
                }
            })
        });

        const flwData = await flwRes.json();
        if (!flwRes.ok || flwData?.status !== 'success' || !flwData?.data?.link) {
            return res.status(400).json({
                success: false,
                error: flwData?.message || 'Flutterwave initialization failed',
                details: flwData
            });
        }

        return res.status(200).json({
            success: true,
            checkout_url: flwData.data.link,
            authorization_url: flwData.data.link,
            payment_link: flwData.data.link,
            reference: ref,
            tx_ref: ref
        });

    } catch (err) {
        console.error('[API initiate-flutterwave error]', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error while initializing Flutterwave'
        });
    }
}
