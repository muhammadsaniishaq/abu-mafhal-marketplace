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
            user_id,
            email,
            name,
            phone,
            amount = 1000
        } = body;

        const safeAmount = Math.max(1, Number(amount) || 1000);
        const userEmail = (email && email.includes('@')) ? email.trim() : `wallet_${Date.now()}@abumafhal.com`;
        const userName = name || 'Abu Mafhal User';
        const userPhone = phone || '08000000000';
        const nameParts = userName.trim().split(/\s+/);
        const firstName = nameParts[0] || 'Valued';
        const lastName = nameParts.slice(1).join(' ') || 'Customer';

        // 1. Fetch live Flutterwave secret key from app_settings or env
        let flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || process.env.EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY;
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

        if (!flwSecret) {
            flwSecret = 'FLWSECK-456331fb55a2e059f1eb8d439c53b9ae-1a07bfbf2fcvt-X';
        }

        const txRef = `WVA-${(user_id || 'USR').substring(0, 8)}-${Date.now()}`;

        // 2. Call Flutterwave Virtual Account API
        const flwRes = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${flwSecret.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: userEmail,
                is_permanent: false,
                bvn: null,
                tx_ref: txRef,
                phonenumber: userPhone,
                firstname: firstName,
                lastname: lastName,
                narration: `Abu Mafhal Wallet - ${userName}`,
                amount: safeAmount
            })
        });

        const flwData = await flwRes.json();

        if (!flwRes.ok || flwData?.status !== 'success' || !flwData?.data?.account_number) {
            return res.status(400).json({
                success: false,
                error: flwData?.message || 'Could not generate virtual account with payment gateway',
                details: flwData
            });
        }

        const d = flwData.data;
        const result = {
            account_number: d.account_number,
            account_name: d.note ? d.note.replace(/^Please make a bank transfer to\s+/i, '').trim() : 'ABU MAFHAL LTD FLW',
            bank_name: d.bank_name || 'Flutterwave MFB',
            order_ref: d.order_ref,
            flw_ref: d.flw_ref,
            tx_ref: txRef,
            amount: d.amount || safeAmount,
            expiry: d.expiry_date,
            expiry_ms: d.expiry_date ? new Date(d.expiry_date).getTime() : (Date.now() + 60 * 60 * 1000),
            is_permanent: false,
            provider: 'flutterwave',
            created_at: d.created_at || new Date().toISOString()
        };

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (err) {
        console.error('[API create-virtual-account error]', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error while generating virtual account'
        });
    }
}
