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
            bvn,
            amount,
            force_refresh
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

        // If user already has an active dedicated virtual account and not forcing refresh with new BVN
        if (existingVA && !force_refresh && !bvn) {
            return res.status(200).json({
                success: true,
                data: existingVA
            });
        }

        const cleanEmail = (targetEmail && targetEmail.includes('@')) 
            ? targetEmail.trim().toLowerCase() 
            : `user_${String(user_id || 'wallet').substring(0, 8)}@abumafhal.com`;

        const cleanName = (targetName || 'Valued Member').trim();
        const cleanPhone = (targetPhone || '08000000000').replace(/[^0-9]/g, '');
        const cleanBvn = bvn ? String(bvn).trim().replace(/[^0-9]/g, '') : null;

        const nameParts = cleanName.split(/\s+/);
        const firstName = nameParts[0] || 'Member';
        const lastName = nameParts.slice(1).join(' ') || 'Customer';

        // Retrieve gateway credentials from database
        let paystackSecret = process.env.PAYSTACK_SECRET_KEY || process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY;
        let flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || process.env.EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY;

        try {
            const { data: rows } = await supabase.from('app_settings').select('*');
            if (rows && Array.isArray(rows)) {
                for (const r of rows) {
                    if (r.key === 'payment_gateways' && r.value && typeof r.value === 'object') {
                        if (r.value.paystack_secret_key) paystackSecret = r.value.paystack_secret_key;
                        if (r.value.flutterwave_secret_key) flwSecret = r.value.flutterwave_secret_key;
                    } else if (r.key === 'paystack_secret_key') {
                        paystackSecret = typeof r.value === 'string' ? r.value : (r.value?.value || r.value?.key);
                    } else if (r.key === 'flutterwave_secret_key') {
                        flwSecret = typeof r.value === 'string' ? r.value : (r.value?.value || r.value?.key);
                    }
                }
            }
        } catch (_) {}

        if (!flwSecret) {
            flwSecret = 'FLWSECK-456331fb55a2e059f1eb8d439c53b9ae-1a07bfbf2fcvt-X';
        }

        const userSlug = String(user_id || cleanEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
        const txRef = `AMF-VA-${userSlug}-${Date.now()}`;

        let generatedVA = null;

        // ═════════════════════════════════════════════════════════════════════════
        // 1. PAYSTACK VERIFICATION & DEDICATED VIRTUAL ACCOUNT CREATION
        // ═════════════════════════════════════════════════════════════════════════
        if (paystackSecret) {
            try {
                // A. Create or Fetch Paystack Customer
                const cusRes = await fetch('https://api.paystack.co/customer', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${paystackSecret.trim()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: cleanEmail,
                        first_name: firstName,
                        last_name: lastName,
                        phone: cleanPhone
                    })
                });
                const cusJson = await cusRes.json();
                const customerCode = cusJson?.data?.customer_code;

                if (customerCode) {
                    // B. Validate Customer Identification via BVN if provided
                    if (cleanBvn && cleanBvn.length === 11) {
                        try {
                            await fetch(`https://api.paystack.co/customer/${customerCode}/identification`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${paystackSecret.trim()}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    country: 'NG',
                                    type: 'bvn',
                                    value: cleanBvn,
                                    first_name: firstName,
                                    last_name: lastName
                                })
                            });
                        } catch (_) {}
                    }

                    // C. Request Dedicated Virtual Account from Paystack (Wema Bank or Titan Trust)
                    const dvaRes = await fetch('https://api.paystack.co/dedicated_account', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${paystackSecret.trim()}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            customer: customerCode,
                            preferred_bank: 'wema-bank'
                        })
                    });
                    const dvaJson = await dvaRes.json();

                    if (dvaJson?.status && dvaJson?.data?.account_number) {
                        const d = dvaJson.data;
                        generatedVA = {
                            account_number: d.account_number,
                            account_name: d.account_name || `${firstName} ${lastName} / Abu Mafhal`,
                            bank_name: d.bank?.name || 'Wema Bank (Paystack)',
                            bank_slug: d.bank?.slug || 'wema-bank',
                            provider: 'paystack',
                            customer_code: customerCode,
                            bvn_verified: Boolean(cleanBvn),
                            tx_ref: txRef,
                            is_permanent: true,
                            created_at: new Date().toISOString()
                        };
                    }
                }
            } catch (paystackErr) {
                console.warn('[create-virtual-account] Paystack DVA creation note:', paystackErr.message);
            }
        }

        // ═════════════════════════════════════════════════════════════════════════
        // 2. FLUTTERWAVE DEDICATED VIRTUAL ACCOUNT (FALLBACK OR COMPLEMENTARY)
        // ═════════════════════════════════════════════════════════════════════════
        if (!generatedVA && flwSecret) {
            try {
                const reqAmount = Math.max(100, Number(amount) || 1000);
                const flwPayload = {
                    email: cleanEmail,
                    is_permanent: true,
                    amount: reqAmount,
                    tx_ref: txRef,
                    phonenumber: cleanPhone,
                    firstname: firstName,
                    lastname: lastName,
                    narration: `Abu Mafhal ${firstName}`
                };
                if (cleanBvn && cleanBvn.length === 11) {
                    flwPayload.bvn = cleanBvn;
                }

                const flwRes = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${flwSecret.trim()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(flwPayload)
                });
                const flwData = await flwRes.json();

                if (flwData?.status === 'success' && flwData?.data?.account_number) {
                    const d = flwData.data;
                    const accountName = d.note 
                        ? d.note.replace(/^Please make a bank transfer to\s+/i, '').trim()
                        : `${firstName} ${lastName} / Abu Mafhal`;

                    generatedVA = {
                        account_number: d.account_number,
                        account_name: accountName,
                        bank_name: d.bank_name || 'Flutterwave MFB',
                        order_ref: d.order_ref,
                        flw_ref: d.flw_ref,
                        tx_ref: txRef,
                        provider: 'flutterwave',
                        bvn_verified: Boolean(cleanBvn),
                        is_permanent: true,
                        created_at: d.created_at || new Date().toISOString()
                    };
                } else if (cleanBvn && flwData?.message?.toLowerCase()?.includes('bvn')) {
                    return res.status(400).json({
                        success: false,
                        error: flwData.message || 'Invalid BVN details. Please ensure your name matches your Bank Verification Number.'
                    });
                }
            } catch (flwErr) {
                console.warn('[create-virtual-account] Flutterwave DVA creation error:', flwErr.message);
            }
        }

        // ═════════════════════════════════════════════════════════════════════════
        // 3. PERSIST AND RETURN GENERATED VIRTUAL ACCOUNT
        // ═════════════════════════════════════════════════════════════════════════
        if (generatedVA && generatedVA.account_number) {
            // Save in profiles table so it persists across all devices and logins
            try {
                if (user_id) {
                    await supabase.from('profiles').update({
                        custom_id: JSON.stringify(generatedVA)
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
                        bank_name: generatedVA.bank_name,
                        account_number: generatedVA.account_number,
                        account_name: generatedVA.account_name,
                        provider: generatedVA.provider,
                        currency: 'NGN'
                    });
                }
            } catch (dbErr) {
                console.warn('[create-virtual-account] DB insert note:', dbErr.message);
            }

            return res.status(200).json({
                success: true,
                data: generatedVA
            });
        }

        return res.status(400).json({
            success: false,
            error: cleanBvn 
                ? 'Could not generate virtual account with the provided BVN. Please verify your 11-digit BVN and legal name.'
                : 'Could not generate virtual account from payment gateway. Please provide your BVN to verify and activate.'
        });

    } catch (err) {
        console.error('[API create-virtual-account error]', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error while generating virtual account'
        });
    }
}
