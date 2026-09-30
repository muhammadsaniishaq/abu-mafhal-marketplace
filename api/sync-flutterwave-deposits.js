import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

// Robust fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        return res;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

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

        const { user_id, email, phone, tx_ref, reference, transaction_id } = body;
        if (!user_id && !email) {
            return res.status(400).json({ success: false, error: 'Missing user_id or email' });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // 1. Fetch live Flutterwave & Paystack secret keys
        let flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || process.env.EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY;
        let paystackSecret = process.env.PAYSTACK_SECRET_KEY || process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY;

        try {
            const { data: rows } = await supabase.from('app_settings').select('*');
            if (rows && Array.isArray(rows)) {
                for (const r of rows) {
                    if (r.key === 'payment_gateways' && r.value && typeof r.value === 'object') {
                        if (r.value.flutterwave_secret_key) flwSecret = r.value.flutterwave_secret_key;
                        if (r.value.paystack_secret_key) paystackSecret = r.value.paystack_secret_key;
                    } else if (r.key === 'flutterwave_secret_key') {
                        flwSecret = typeof r.value === 'string' ? r.value : (r.value?.value || r.value?.key);
                    } else if (r.key === 'paystack_secret_key') {
                        paystackSecret = typeof r.value === 'string' ? r.value : (r.value?.value || r.value?.key);
                    }
                }
            }
        } catch (_) {}

        if (!flwSecret) {
            flwSecret = 'FLWSECK-456331fb55a2e059f1eb8d439c53b9ae-1a07bfbf2fcvt-X';
        }

        // 2. Resolve target user profile
        let activeUserId = user_id;
        let userProfile = null;
        let currentBalance = 0;
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');

        if (activeUserId) {
            const { data: p } = await supabase.from('profiles').select('id, balance, email, phone, custom_id').eq('id', activeUserId).maybeSingle();
            if (p) {
                userProfile = p;
                currentBalance = Number(p.balance || 0);
            }
        } else if (cleanEmail) {
            const { data: p } = await supabase.from('profiles').select('id, balance, email, phone, custom_id').eq('email', cleanEmail).maybeSingle();
            if (p) {
                userProfile = p;
                activeUserId = p.id;
                currentBalance = Number(p.balance || 0);
            }
        }

        if (!activeUserId) {
            return res.status(200).json({ success: false, error: 'User not found' });
        }

        // Dedicated NUBAN account number for this user
        let userDedicatedAccount = null;
        if (userProfile?.custom_id) {
            try {
                const parsed = typeof userProfile.custom_id === 'string' ? JSON.parse(userProfile.custom_id) : userProfile.custom_id;
                if (parsed?.account_number) userDedicatedAccount = String(parsed.account_number).trim();
            } catch (_) {}
        }
        if (!userDedicatedAccount && activeUserId) {
            try {
                const { data: va } = await supabase.from('virtual_accounts').select('account_number').eq('user_id', activeUserId).maybeSingle();
                if (va?.account_number) userDedicatedAccount = String(va.account_number).trim();
            } catch (_) {}
        }

        // 3. Direct verification by transaction ID or specific reference (instant 1-click verify)
        const directRef = reference || tx_ref;
        if (directRef || transaction_id) {
            try {
                // Try Flutterwave direct verification
                const verifyUrl = transaction_id 
                    ? `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`
                    : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(directRef)}`;
                
                const vRes = await fetchWithTimeout(verifyUrl, {
                    headers: { 'Authorization': `Bearer ${flwSecret.trim()}` }
                }, 12000);

                if (vRes.ok) {
                    const vJson = await vRes.json();
                    if (vJson?.status === 'success' && vJson?.data?.status === 'successful') {
                        const verifiedTx = vJson.data;
                        const verifiedAmt = Number(verifiedTx.amount || 0);
                        const verifiedRef = `FLW-${verifiedTx.id}`;

                        // Global deduplication: check if already in DB anywhere
                        const { data: existing } = await supabase
                            .from('transactions')
                            .select('id')
                            .or(`reference.eq.${verifiedRef},reference.eq.${directRef}`)
                            .maybeSingle();

                        if (!existing && verifiedAmt > 0) {
                            const { data: p } = await supabase.from('profiles').select('balance').eq('id', activeUserId).maybeSingle();
                            const newBal = (Number(p?.balance) || 0) + verifiedAmt;

                            await supabase.from('profiles').update({ balance: newBal }).eq('id', activeUserId);
                            await supabase.from('transactions').insert({
                                user_id: activeUserId,
                                type: 'topup',
                                amount: verifiedAmt,
                                status: 'completed',
                                reference: verifiedRef,
                                description: `Deposit of ₦${verifiedAmt.toLocaleString()} via Flutterwave (Ref: ${directRef || verifiedRef})`,
                                created_at: verifiedTx.created_at || new Date().toISOString()
                            });

                            return res.status(200).json({
                                success: true,
                                verified: true,
                                credited_amount: verifiedAmt,
                                new_balance: newBal,
                                reference: verifiedRef,
                                message: `Successfully verified and credited ₦${verifiedAmt.toLocaleString()}`
                            });
                        } else if (existing) {
                            return res.status(200).json({
                                success: true,
                                verified: true,
                                already_credited: true,
                                credited_amount: 0,
                                current_balance: currentBalance,
                                message: 'Transaction already credited to wallet'
                            });
                        }
                    }
                }

                // If not FLW and Paystack secret exists, try Paystack verification
                if (paystackSecret && directRef) {
                    try {
                        const pRes = await fetchWithTimeout(`https://api.paystack.co/transaction/verify/${encodeURIComponent(directRef)}`, {
                            headers: { 'Authorization': `Bearer ${paystackSecret.trim()}` }
                        }, 12000);
                        if (pRes.ok) {
                            const pJson = await pRes.json();
                            if (pJson?.status && pJson?.data?.status === 'success') {
                                const pData = pJson.data;
                                const pAmt = Number(pData.amount || 0) / 100;
                                const pRef = `PAY-${pData.id || directRef}`;

                                const { data: pExisting } = await supabase
                                    .from('transactions')
                                    .select('id')
                                    .or(`reference.eq.${pRef},reference.eq.${directRef}`)
                                    .maybeSingle();

                                if (!pExisting && pAmt > 0) {
                                    const { data: curP } = await supabase.from('profiles').select('balance').eq('id', activeUserId).maybeSingle();
                                    const newBal = (Number(curP?.balance) || 0) + pAmt;

                                    await supabase.from('profiles').update({ balance: newBal }).eq('id', activeUserId);
                                    await supabase.from('transactions').insert({
                                        user_id: activeUserId,
                                        type: 'topup',
                                        amount: pAmt,
                                        status: 'completed',
                                        reference: pRef,
                                        description: `Deposit of ₦${pAmt.toLocaleString()} via Paystack (Ref: ${directRef})`,
                                        created_at: pData.paid_at || new Date().toISOString()
                                    });

                                    return res.status(200).json({
                                        success: true,
                                        verified: true,
                                        credited_amount: pAmt,
                                        new_balance: newBal,
                                        reference: pRef,
                                        message: `Successfully verified and credited ₦${pAmt.toLocaleString()}`
                                    });
                                }
                            }
                        }
                    } catch (_) {}
                }
            } catch (vErr) {
                console.warn('[sync-flutterwave-deposits] Direct verify note:', vErr.message);
            }
        }

        // 4. Fetch recent transactions from Flutterwave with a 30-DAY DATE RANGE LOOKBACK
        // Without from/to parameters, Flutterwave limits to today's date only!
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        let txList = [];
        try {
            const flwUrl = `https://api.flutterwave.com/v3/transactions?from=${startDate}&to=${endDate}&status=successful&limit=100`;
            const flwRes = await fetchWithTimeout(flwUrl, {
                headers: { 'Authorization': `Bearer ${flwSecret.trim()}` }
            }, 15000);
            if (flwRes.ok) {
                const flwJson = await flwRes.json();
                txList = flwJson?.data || [];
            }
        } catch (fetchErr) {
            console.warn('[sync-flutterwave-deposits] Date range fetch timeout/error, trying fallback:', fetchErr.message);
            // Quick fallback without date param
            try {
                const flwRes = await fetchWithTimeout('https://api.flutterwave.com/v3/transactions?status=successful&limit=50', {
                    headers: { 'Authorization': `Bearer ${flwSecret.trim()}` }
                }, 10000);
                if (flwRes.ok) {
                    const flwJson = await flwRes.json();
                    txList = flwJson?.data || [];
                }
            } catch (_) {}
        }

        // Unique user tokens
        const userSlug = String(activeUserId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
        const userPrefix10 = String(activeUserId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();

        // 5. Match transactions strictly belonging to this user
        const matched = txList.filter(t => {
            if (t.status !== 'successful') return false;
            const txRef = String(t.tx_ref || '').toUpperCase();
            const custEmail = String(t.customer?.email || '').trim().toLowerCase();
            const destAcc = String(
                t.meta?.virtualaccountnumber ||
                t.meta?.virtual_account_number ||
                t.virtual_account_number ||
                t.meta?.destination_account_number ||
                t.meta?.account_number ||
                t.account_number ||
                ''
            ).trim();
            const narration = String(t.narration || '');

            // Priority 1: Match by dedicated account number
            if (userDedicatedAccount && userDedicatedAccount.length >= 10) {
                if (destAcc === userDedicatedAccount || narration.includes(userDedicatedAccount)) {
                    return true;
                }
            }

            // Priority 2: Match by exact tx_ref containing user slug (AMF-VA-<userSlug>-...)
            if (userPrefix10 && userPrefix10.length >= 8 && txRef.includes(userPrefix10)) {
                return true;
            }
            if (userSlug && userSlug.length >= 6 && txRef.includes(userSlug)) {
                return true;
            }

            // Priority 3: Match by registered email (only if customer email is not generic)
            if (cleanEmail && cleanEmail.includes('@') && !cleanEmail.includes('abumafhal.com')) {
                if (custEmail === cleanEmail) {
                    return true;
                }
            }

            return false;
        });

        // 6. Global deduplication check across ALL transactions in the system
        const { data: allRecordedTxs } = await supabase
            .from('transactions')
            .select('reference');

        const globallyRecorded = new Set((allRecordedTxs || []).map(t => String(t.reference || '')));

        let totalNewAmount = 0;
        const newlyCredited = [];

        for (const t of matched) {
            const flwRefCode = `FLW-${t.id}`;
            const clientRef = String(t.tx_ref || '');

            const isAlreadyCredited = globallyRecorded.has(flwRefCode) || (clientRef && globallyRecorded.has(clientRef));
            if (!isAlreadyCredited) {
                const amt = Number(t.amount || 0);
                if (amt > 0) {
                    totalNewAmount += amt;
                    newlyCredited.push({
                        flw_id: t.id,
                        amount: amt,
                        reference: flwRefCode
                    });

                    // Insert transaction record
                    await supabase.from('transactions').insert({
                        user_id: activeUserId,
                        type: 'topup',
                        amount: amt,
                        status: 'completed',
                        reference: flwRefCode,
                        description: `Bank Transfer Deposit of ₦${amt.toLocaleString()} via Flutterwave MFB (Ref: ${clientRef || flwRefCode})`,
                        created_at: t.created_at || new Date().toISOString()
                    });

                    globallyRecorded.add(flwRefCode);
                    if (clientRef) globallyRecorded.add(clientRef);
                }
            }
        }

        // 7. Calculate verified ledger balance strictly from completed transactions
        const { data: allUserTxs } = await supabase
            .from('transactions')
            .select('amount, type, status')
            .eq('user_id', activeUserId);

        const totalLedgerCredits = (allUserTxs || [])
            .filter(t => (t.type === 'topup' || t.type === 'credit' || t.type === 'deposit') && t.status === 'completed')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const totalLedgerDebits = (allUserTxs || [])
            .filter(t => (t.type === 'withdrawal' || t.type === 'debit' || t.type === 'wallet_payment' || t.type === 'wallet_purchase' || t.type === 'order_payment' || t.type === 'pss_down_payment') && t.status === 'completed')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const verifiedLedgerBalance = Math.max(0, totalLedgerCredits - totalLedgerDebits);
        const correctBalance = (allUserTxs && allUserTxs.length > 0) ? verifiedLedgerBalance : Math.max(0, currentBalance + totalNewAmount);

        if (correctBalance !== currentBalance || totalNewAmount > 0) {
            await supabase.from('profiles').update({ balance: correctBalance }).eq('id', activeUserId);
            console.log(`[sync-flutterwave-deposits] Synced user ${activeUserId} balance to ₦${correctBalance} (credits: ₦${totalLedgerCredits}, debits: ₦${totalLedgerDebits})`);
        }

        return res.status(200).json({
            success: true,
            user_id: activeUserId,
            current_balance: correctBalance,
            total_credited: totalNewAmount,
            ledger_balance: verifiedLedgerBalance,
            new_credits_count: newlyCredited.length,
            newly_credited: newlyCredited,
            matched_transactions_count: matched.length
        });

    } catch (err) {
        console.error('[API sync-flutterwave-deposits error]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
