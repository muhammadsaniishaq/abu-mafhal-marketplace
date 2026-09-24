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
            amount
        } = body;

        if (!user_id && !email) {
            return res.status(400).json({ success: false, error: 'Missing user_id or email' });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        let targetEmail = email;
        let targetName = name;
        let targetPhone = phone;

        // Check profiles for existing dedicated virtual account
        let existingVA = null;
        if (user_id) {
            const { data: p } = await supabase.from('profiles').select('email, full_name, phone, custom_id').eq('id', user_id).maybeSingle();
            if (p) {
                if (!targetEmail) targetEmail = p.email;
                if (!targetName) targetName = p.full_name;
                if (!targetPhone) targetPhone = p.phone;
                if (p.custom_id) {
                    try {
                        const parsed = JSON.parse(p.custom_id);
                        if (parsed && parsed.account_number && !parsed.account_number.startsWith('980')) {
                            existingVA = parsed;
                        }
                    } catch (_) {}
                }
            }
        }

        // If user already has an active dedicated virtual account, return it immediately!
        if (existingVA && !body.force_refresh) {
            return res.status(200).json({
                success: true,
                data: existingVA
            });
        }

        const cleanEmail = (targetEmail && targetEmail.includes('@')) 
            ? targetEmail.trim().toLowerCase() 
            : `user_${String(user_id || 'wallet').substring(0, 8)}@abumafhal.com`;

        const FOUNDER_EMAILS = [
            'sale.abumafhal@gmail.com',
            'muhammadsanishaq@gmail.com',
            'abumafhalhub@gmail.com',
            'muhammadsanish0@gmail.com',
            'ceo@abumafhal.com',
            'muhammadsaniisyaku3@gmail.com'
        ];

        // Founder accounts always use the permanent dedicated account that never expires
        if (FOUNDER_EMAILS.includes(cleanEmail)) {
            const founderVA = {
                account_number: '9187255635',
                account_name: 'Abu Mafhal / Muhammad Sani',
                bank_name: 'Flutterwave MFB (Formerly OK MFB)',
                provider: 'flutterwave',
                is_permanent: true,
                tx_ref: 'AMF-DVA-6D3DF1F5'
            };
            try {
                if (user_id) {
                    await supabase.from('profiles').update({
                        custom_id: JSON.stringify(founderVA)
                    }).eq('id', user_id);
                }
            } catch (_) {}
            return res.status(200).json({
                success: true,
                data: founderVA
            });
        }
        
        const cleanName = (targetName || 'Valued Member').trim();
        const cleanPhone = (targetPhone || '08000000000').replace(/[^0-9]/g, '');
        const nameParts = cleanName.split(/\s+/);
        const firstName = nameParts[0] || 'Member';
        const lastName = nameParts.slice(1).join(' ') || 'Customer';

        // Fetch Flutterwave secret key
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

        const reqAmount = Math.max(100, Number(amount) || 1000);
        const userSlug = String(user_id || cleanEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
        const txRef = `AMF-${userSlug}-${Date.now()}`;

        // Call Flutterwave API to create unique dynamic virtual account for this specific user
        const flwRes = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${flwSecret.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: cleanEmail,
                is_permanent: false,
                amount: reqAmount,
                tx_ref: txRef,
                phonenumber: cleanPhone,
                firstname: firstName,
                lastname: lastName,
                narration: `Abu Mafhal ${firstName}`
            })
        });

        const flwData = await flwRes.json();

        if (flwData?.status === 'success' && flwData?.data?.account_number) {
            const d = flwData.data;
            const accountName = d.note 
                ? d.note.replace(/^Please make a bank transfer to\s+/i, '').trim()
                : `Abu Mafhal ${firstName} FLW`;

            const vaPayload = {
                account_number: d.account_number,
                account_name: accountName,
                bank_name: d.bank_name || 'Flutterwave MFB',
                amount: reqAmount,
                expected_amount: d.amount || reqAmount,
                order_ref: d.order_ref,
                flw_ref: d.flw_ref,
                tx_ref: txRef,
                expiry_date: d.expiry_date,
                provider: 'flutterwave',
                created_at: d.created_at || new Date().toISOString()
            };

            // Save in profiles table so it persists across all devices and logins
            try {
                if (user_id) {
                    await supabase.from('profiles').update({
                        custom_id: JSON.stringify(vaPayload)
                    }).eq('id', user_id);
                }
            } catch (pErr) {
                console.warn('[create-virtual-account] Profile save notice:', pErr.message);
            }

            // Also record in virtual_accounts table if permitted
            try {
                if (user_id) {
                    await supabase.from('virtual_accounts').insert({
                        user_id: user_id,
                        bank_name: d.bank_name || 'Flutterwave MFB',
                        account_number: d.account_number,
                        account_name: accountName,
                        provider: 'flutterwave',
                        currency: 'NGN'
                    });
                }
            } catch (dbErr) {
                console.warn('[create-virtual-account] DB insert note:', dbErr.message);
            }

            return res.status(200).json({
                success: true,
                data: {
                    account_number: d.account_number,
                    account_name: accountName,
                    bank_name: d.bank_name || 'Flutterwave MFB',
                    amount: reqAmount,
                    expected_amount: d.amount || reqAmount,
                    order_ref: d.order_ref,
                    flw_ref: d.flw_ref,
                    tx_ref: txRef,
                    expiry_date: d.expiry_date,
                    provider: 'flutterwave',
                    created_at: d.created_at || new Date().toISOString()
                }
            });
        }

        return res.status(400).json({
            success: false,
            error: flwData?.message || 'Could not generate virtual account from payment gateway'
        });

    } catch (err) {
        console.error('[API create-virtual-account error]', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error while generating virtual account'
        });
    }
}
