import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

// These account numbers are known test/dummy numbers - reject them
const BLOCKED_ACCOUNTS = new Set(['9187255635', '9282617835', '0000000000', '1111111111']);

function isValidVirtualAccount(account_number) {
    if (!account_number) return false;
    const acc = String(account_number).trim();
    if (acc.length < 10) return false;
    if (BLOCKED_ACCOUNTS.has(acc)) return false;
    if (/^(\d)\1{9,}$/.test(acc)) return false; // All same digit
    if (acc.startsWith('980')) return false; // Test prefix
    return true;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (_) { body = {}; }
        }

        const { user_id, email, name, phone, bvn, amount, force_refresh } = body;

        if (!user_id && !email) {
            return res.status(400).json({ success: false, error: 'Missing user_id or email' });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        let targetEmail = email;
        let targetName = name;
        let targetPhone = phone;

        // ── STEP 1: Check if user already has a valid dedicated account ──────────
        let existingVA = null;
        if (user_id) {
            const { data: p } = await supabase
                .from('profiles')
                .select('email, full_name, phone, custom_id')
                .eq('id', user_id)
                .maybeSingle();

            if (p) {
                if (!targetEmail) targetEmail = p.email;
                if (!targetName) targetName = p.full_name;
                if (!targetPhone) targetPhone = p.phone;

                if (p.custom_id) {
                    try {
                        const parsed = typeof p.custom_id === 'string' ? JSON.parse(p.custom_id) : p.custom_id;
                        if (parsed?.account_number && isValidVirtualAccount(parsed.account_number)) {
                            existingVA = parsed;
                        } else {
                            // Wipe invalid/shared account from DB immediately
                            await supabase.from('profiles').update({ custom_id: null }).eq('id', user_id);
                            console.log(`[create-virtual-account] Wiped invalid account ${parsed?.account_number} from user ${user_id}`);
                        }
                    } catch (_) {
                        await supabase.from('profiles').update({ custom_id: null }).eq('id', user_id);
                    }
                }
            }
        }

        // If user already has a valid dedicated account and not forcing refresh
        if (existingVA && !force_refresh) {
            return res.status(200).json({ success: true, data: existingVA });
        }

        // ── STEP 2: STRICT BVN validation — NO account without valid BVN ─────────
        const cleanBvn = bvn ? String(bvn).trim().replace(/[^0-9]/g, '') : null;
        const isValidBvn = cleanBvn &&
            cleanBvn.length === 11 &&
            !/^(\d)\1{10}$/.test(cleanBvn) &&
            cleanBvn !== '00000000000' &&
            cleanBvn !== '11111111111';

        if (!isValidBvn && !existingVA) {
            return res.status(400).json({
                success: false,
                requires_bvn: true,
                error: 'Ana bukatar ingantacciyar lambar BVN mai lamba 11 domin samar da asusun kanka (dedicated NUBAN).'
            });
        }

        // ── STEP 3: Prepare user details ──────────────────────────────────────────
        const cleanEmail = (targetEmail && targetEmail.includes('@'))
            ? targetEmail.trim().toLowerCase()
            : `user_${String(user_id || 'wallet').substring(0, 8)}@abumafhal.com`;

        const cleanName = (targetName || 'Valued Member').trim();
        const cleanPhone = (targetPhone || '08000000000').replace(/[^0-9]/g, '').slice(0, 11) || '08000000000';
        const nameParts = cleanName.split(/\s+/);
        const firstName = nameParts[0] || 'Member';
        const lastName = nameParts.slice(1).join(' ') || 'Customer';

        // Unique tx_ref per user (user_id prefix guarantees uniqueness)
        const userSlug = String(user_id || cleanEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
        const txRef = `AMF-VA-${userSlug}-${Date.now()}`;

        // ── STEP 4: Load gateway secrets ──────────────────────────────────────────
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

        if (!flwSecret) flwSecret = 'FLWSECK-456331fb55a2e059f1eb8d439c53b9ae-1a07bfbf2fcvt-X';

        let generatedVA = null;

        // ══════════════════════════════════════════════════════════════════════════
        // GATEWAY 1: FLUTTERWAVE DEDICATED VIRTUAL ACCOUNT (PRIMARY)
        // Creates a permanent unique NUBAN per user — tied to BVN
        // ══════════════════════════════════════════════════════════════════════════
        if (cleanBvn && flwSecret) {
            try {
                const flwPayload = {
                    email: cleanEmail,
                    is_permanent: true,
                    tx_ref: txRef,
                    phonenumber: cleanPhone,
                    firstname: firstName,
                    lastname: lastName,
                    bvn: cleanBvn,
                    narration: `Abu Mafhal - ${firstName} ${lastName}`
                };
                if (amount && Number(amount) > 0) flwPayload.amount = Number(amount);

                const flwRes = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${flwSecret.trim()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(flwPayload)
                });
                const flwData = await flwRes.json();

                console.log('[create-virtual-account] Flutterwave response:', JSON.stringify(flwData));

                if (flwData?.status === 'success' && flwData?.data?.account_number) {
                    const d = flwData.data;
                    const accountName = d.note
                        ? d.note.replace(/^Please make a bank transfer to\s+/i, '').trim()
                        : `${firstName} ${lastName} / Abu Mafhal`;

                    const acc = String(d.account_number).trim();
                    if (isValidVirtualAccount(acc)) {
                        generatedVA = {
                            account_number: acc,
                            account_name: accountName,
                            bank_name: d.bank_name || 'Flutterwave MFB',
                            order_ref: d.order_ref || txRef,
                            flw_ref: d.flw_ref,
                            tx_ref: txRef,
                            provider: 'flutterwave',
                            bvn_verified: true,
                            is_permanent: true,
                            created_at: d.created_at || new Date().toISOString()
                        };
                    } else {
                        console.warn('[create-virtual-account] Flutterwave returned blocked/invalid account:', acc);
                    }
                } else if (flwData?.message) {
                    const msg = flwData.message;
                    console.warn('[create-virtual-account] Flutterwave DVA message:', msg);
                    // BVN/NIN mismatch — return descriptive error to user
                    if (
                        msg.toLowerCase().includes('bvn') ||
                        msg.toLowerCase().includes('nin') ||
                        msg.toLowerCase().includes('name') ||
                        msg.toLowerCase().includes('invalid') ||
                        msg.toLowerCase().includes('exist')
                    ) {
                        return res.status(400).json({ success: false, error: msg });
                    }
                }
            } catch (flwErr) {
                console.warn('[create-virtual-account] Flutterwave DVA error:', flwErr.message);
            }
        }

        // ══════════════════════════════════════════════════════════════════════════
        // GATEWAY 2: PAYSTACK DEDICATED VIRTUAL ACCOUNT (FALLBACK)
        // ══════════════════════════════════════════════════════════════════════════
        if (!generatedVA && paystackSecret) {
            try {
                const cusRes = await fetch('https://api.paystack.co/customer', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${paystackSecret.trim()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: cleanEmail, first_name: firstName, last_name: lastName, phone: cleanPhone })
                });
                const cusJson = await cusRes.json();
                const customerCode = cusJson?.data?.customer_code;

                if (customerCode) {
                    // Submit BVN for verification
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

                    // Create dedicated virtual account for this customer
                    const dvaRes = await fetch('https://api.paystack.co/dedicated_account', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${paystackSecret.trim()}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ customer: customerCode, preferred_bank: 'wema-bank' })
                    });
                    const dvaJson = await dvaRes.json();

                    console.log('[create-virtual-account] Paystack response:', JSON.stringify(dvaJson));

                    if (dvaJson?.status && dvaJson?.data?.account_number) {
                        const d = dvaJson.data;
                        const acc = String(d.account_number).trim();
                        if (isValidVirtualAccount(acc)) {
                            generatedVA = {
                                account_number: acc,
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
                }
            } catch (paystackErr) {
                console.warn('[create-virtual-account] Paystack DVA error:', paystackErr.message);
            }
        }

        // ── STEP 5: Persist & return ──────────────────────────────────────────────
        if (generatedVA && generatedVA.account_number) {
            // Save unique account to this user's profile
            try {
                if (user_id) {
                    await supabase.from('profiles')
                        .update({ custom_id: JSON.stringify(generatedVA) })
                        .eq('id', user_id);
                }
            } catch (pErr) {
                console.warn('[create-virtual-account] Profile save error:', pErr.message);
            }

            // Also record in virtual_accounts table (for webhook matching)
            try {
                if (user_id) {
                    // Check if already exists in virtual_accounts
                    const { data: existing } = await supabase
                        .from('virtual_accounts')
                        .select('id')
                        .eq('account_number', generatedVA.account_number)
                        .maybeSingle();

                    if (!existing) {
                        await supabase.from('virtual_accounts').insert({
                            user_id,
                            bank_name: generatedVA.bank_name,
                            account_number: generatedVA.account_number,
                            account_name: generatedVA.account_name,
                            provider: generatedVA.provider,
                            currency: 'NGN'
                        });
                    }
                }
            } catch (dbErr) {
                console.warn('[create-virtual-account] virtual_accounts insert note:', dbErr.message);
            }

            return res.status(200).json({ success: true, data: generatedVA });
        }

        // Both gateways failed
        return res.status(400).json({
            success: false,
            error: cleanBvn
                ? 'Ba a samu damar samar da asusun kanka ba ta Flutterwave ko Paystack. Da fatan a tabbatar da BVN ɗinka da sunanka su yi daidai.'
                : 'Ana bukata a sanya BVN mai inganci kafin samar da asusun kanka.'
        });

    } catch (err) {
        console.error('[API create-virtual-account error]', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error'
        });
    }
}
