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

        const { user_id, email, phone, tx_ref, reference, transaction_id } = body;
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

        // Direct verification by transaction ID or specific reference if provided
        const directRef = reference || tx_ref;
        if (directRef || transaction_id) {
            try {
                const verifyUrl = transaction_id 
                    ? `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`
                    : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(directRef)}`;
                
                const vRes = await fetch(verifyUrl, {
                    headers: { 'Authorization': `Bearer ${flwSecret.trim()}` }
                });
                if (vRes.ok) {
                    const vJson = await vRes.json();
                    if (vJson?.status === 'success' && vJson?.data?.status === 'successful') {
                        const verifiedTx = vJson.data;
                        const verifiedAmt = Number(verifiedTx.amount || 0);
                        const verifiedRef = `FLW-${verifiedTx.id}`;

                        // Check if already in DB
                        const { data: existing } = await supabase
                            .from('transactions')
                            .select('id')
                            .or(`reference.eq.${verifiedRef},reference.eq.${directRef}`)
                            .maybeSingle();

                        if (!existing && verifiedAmt > 0) {
                            let targetUid = user_id;
                            if (!targetUid && email) {
                                const { data: p } = await supabase.from('profiles').select('id, balance').eq('email', email.trim().toLowerCase()).maybeSingle();
                                if (p) targetUid = p.id;
                            }

                            if (targetUid) {
                                const { data: p } = await supabase.from('profiles').select('balance').eq('id', targetUid).maybeSingle();
                                const newBal = (Number(p?.balance) || 0) + verifiedAmt;

                                await supabase.from('profiles').update({ balance: newBal }).eq('id', targetUid);
                                await supabase.from('transactions').insert({
                                    user_id: targetUid,
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
                                    reference: verifiedRef
                                });
                            }
                        }
                    }
                }
            } catch (vErr) {
                console.warn('[sync-flutterwave-deposits] Direct verify note:', vErr.message);
            }
        }

        // 2. Fetch recent successful transactions from Flutterwave (expanded to 100)
        let txList = [];
        try {
            const flwRes = await fetch('https://api.flutterwave.com/v3/transactions?status=successful&limit=100', {
                headers: { 'Authorization': `Bearer ${flwSecret.trim()}` }
            });
            if (flwRes.ok) {
                const flwJson = await flwRes.json();
                txList = flwJson?.data || [];
            }
        } catch (fetchErr) {
            console.warn('[sync-flutterwave-deposits] Notice: FLW fetch notice:', fetchErr.message);
        }

        const userSlug = String(user_id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');

        const FOUNDER_EMAILS = [
            'sale.abumafhal@gmail.com',
            'muhammadsanishaq@gmail.com',
            'abumafhalhub@gmail.com',
            'muhammadsanish0@gmail.com',
            'ceo@abumafhal.com',
            'muhammadsaniisyaku3@gmail.com'
        ];

        const isFounder = FOUNDER_EMAILS.includes(cleanEmail) || ['6D3DF1F5', '8F429903', '9F58F703', '5B5CF3AE'].includes(userSlug);

        // 3. Match user transactions
        const matched = txList.filter(t => {
            if (t.status !== 'successful') return false;
            const txRef = String(t.tx_ref || '').toUpperCase();
            const custEmail = String(t.customer?.email || '').trim().toLowerCase();
            const custPhone = String(t.customer?.phone_number || '').replace(/[^0-9]/g, '');

            const matchRef = userSlug && userSlug.length >= 4 && txRef.includes(userSlug);
            const matchEmail = cleanEmail && cleanEmail.includes('@') && custEmail === cleanEmail;
            const matchPhone = cleanPhone && cleanPhone.length >= 9 && (custPhone.includes(cleanPhone) || cleanPhone.includes(custPhone));

            // If founder is logged in, also match deposits made to the founder permanent account 9187255635
            const matchFounder = isFounder && (
                txRef.includes('6D3DF1F5') ||
                FOUNDER_EMAILS.includes(custEmail)
            );

            return matchRef || matchEmail || matchPhone || matchFounder;
        });

        // 4. Fetch current user profile
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

        if (!activeUserId) {
            return res.status(200).json({ success: false, error: 'User not found', matched_count: matched.length });
        }

        // 5. Fetch existing recorded transactions to prevent double crediting
        const { data: userExistingTxs } = await supabase
            .from('transactions')
            .select('reference')
            .eq('user_id', activeUserId);

        const recordedRefs = new Set((userExistingTxs || []).map(t => String(t.reference || '')));

        let totalNewAmount = 0;
        const newlyCredited = [];

        for (const t of matched) {
            const flwRefCode = `FLW-${t.id}`;
            const clientRef = String(t.tx_ref || '');

            // Check if already in DB
            const isAlreadyCredited = recordedRefs.has(flwRefCode) || (clientRef && recordedRefs.has(clientRef));
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

                    recordedRefs.add(flwRefCode);
                }
            }
        }

        // Calculate verified ledger balance from all completed transactions for this user
        const { data: allUserTxs } = await supabase
            .from('transactions')
            .select('amount, type, status')
            .eq('user_id', activeUserId);

        const totalLedgerCredits = (allUserTxs || [])
            .filter(t => (t.type === 'topup' || t.type === 'credit' || t.type === 'deposit') && t.status === 'completed')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const totalLedgerDebits = (allUserTxs || [])
            .filter(t => (t.type === 'withdrawal' || t.type === 'debit' || t.type === 'wallet_payment' || t.type === 'wallet_purchase') && t.status === 'completed')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const verifiedLedgerBalance = Math.max(0, totalLedgerCredits - totalLedgerDebits);
        const correctBalance = Math.max(currentBalance + totalNewAmount, verifiedLedgerBalance);

        if (correctBalance !== currentBalance || totalNewAmount > 0) {
            await supabase.from('profiles').update({ balance: correctBalance }).eq('id', activeUserId);
            console.log(`[sync-flutterwave-deposits] Synced user ${activeUserId} balance to ₦${correctBalance} (ledger credits: ₦${totalLedgerCredits})`);
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
