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

        const { user_id, email, phone } = body;
        if (!user_id && !email) {
            return res.status(400).json({ success: false, error: 'Missing user_id or email' });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // 1. Fetch live Flutterwave secret key
        let flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || process.env.EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY;
        try {
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

        // 2. Fetch recent successful transactions from Flutterwave
        const flwRes = await fetch('https://api.flutterwave.com/v3/transactions?status=successful&limit=25', {
            headers: { 'Authorization': `Bearer ${flwSecret.trim()}` }
        });

        if (!flwRes.ok) {
            return res.status(200).json({ success: false, error: 'Could not fetch Flutterwave transactions' });
        }

        const flwJson = await flwRes.json();
        const txList = flwJson?.data || [];

        const userPrefix = String(user_id || '').substring(0, 8).toUpperCase();
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');

        // 3. Match user transactions
        const matched = txList.filter(t => {
            const txRef = String(t.tx_ref || '').toUpperCase();
            const custEmail = String(t.customer?.email || '').trim().toLowerCase();
            const custPhone = String(t.customer?.phone_number || '').replace(/[^0-9]/g, '');

            const matchRef = userPrefix && txRef.includes(userPrefix);
            const matchEmail = cleanEmail && custEmail === cleanEmail;
            const matchPhone = cleanPhone && (custPhone.includes(cleanPhone) || cleanPhone.includes(custPhone));

            return (matchRef || matchEmail || matchPhone) && t.status === 'successful';
        });

        // 4. Fetch current user balance
        let activeUserId = user_id;
        let currentBalance = 0;

        if (activeUserId) {
            const { data: p } = await supabase.from('profiles').select('id, balance').eq('id', activeUserId).maybeSingle();
            if (p) {
                currentBalance = Number(p.balance || 0);
            }
        } else if (cleanEmail) {
            const { data: p } = await supabase.from('profiles').select('id, balance').eq('email', cleanEmail).maybeSingle();
            if (p) {
                activeUserId = p.id;
                currentBalance = Number(p.balance || 0);
            }
        }

        return res.status(200).json({
            success: true,
            user_id: activeUserId,
            current_balance: currentBalance,
            matched_transactions: matched
        });

    } catch (err) {
        console.error('[API sync-flutterwave-deposits error]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
