import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, verif-hash');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'active', message: 'Abu Mafhal Flutterwave Webhook is running' });
    }

    try {
        const body = req.body || {};
        const eventType = body?.event || '';
        const data = body?.data ?? body;
        const flwId = data?.id;
        const status = data?.status;
        const tx_ref = data?.tx_ref || '';
        const signature = req.headers['verif-hash'];

        const expectedHash = process.env.FLUTTERWAVE_WEBHOOK_HASH || 'AbuMafhalWebhook2026';
        const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || 'FLWSECK-456331fb55a2e059f1eb8d439c53b9ae-1a07bfbf2fcvt-X';

        // Verify webhook authenticity
        let isVerified = signature && signature === expectedHash;
        if (!isVerified && flwId) {
            try {
                const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${flwId}/verify`, {
                    headers: { 'Authorization': `Bearer ${flwSecret}` }
                });
                if (verifyRes.ok) {
                    const verifyJson = await verifyRes.json();
                    if (verifyJson?.status === 'success' && verifyJson?.data?.status === 'successful') {
                        isVerified = true;
                    }
                }
            } catch (_) {}
        }

        if (!isVerified) {
            console.warn('[Webhook FLW] Unauthorized attempt. Signature:', signature);
            return res.status(401).json({ error: 'Unauthorized signature' });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // ── Handle successful bank transfer/charge ──────────────────────────────
        if (status === 'successful') {
            const depositAmt = Number(data?.amount || 0);
            if (depositAmt <= 0) {
                return res.status(200).json({ status: 'ignored', reason: 'Zero amount' });
            }

            const custEmail    = (data?.customer?.email || '').trim().toLowerCase();
            const custPhone    = String(data?.customer?.phone_number || '').replace(/[^0-9]/g, '');
            const destAccount  = (
                data?.meta?.virtualaccountnumber ||
                data?.meta?.virtual_account_number ||
                data?.virtual_account_number ||
                data?.meta?.destination_account_number ||
                data?.account_number ||
                ''
            ).trim();

            let targetUser = null;

            // ── Strategy 1: Match by the dedicated NUBAN account number (most reliable) ──
            // Flutterwave sends destination_account_number in meta for DVA transfers
            if (destAccount && destAccount.length >= 10) {
                const { data: allProfiles } = await supabase
                    .from('profiles')
                    .select('id, balance, email, custom_id');
                if (allProfiles) {
                    for (const p of allProfiles) {
                        if (!p.custom_id) continue;
                        try {
                            const va = typeof p.custom_id === 'string' ? JSON.parse(p.custom_id) : p.custom_id;
                            if (va?.account_number && va.account_number === destAccount) {
                                targetUser = p;
                                break;
                            }
                        } catch (_) {}
                    }
                }
            }

            // ── Strategy 2: Match by virtual_accounts table (dedicated NUBAN registry) ──
            if (!targetUser && destAccount && destAccount.length >= 10) {
                const { data: vaRow } = await supabase
                    .from('virtual_accounts')
                    .select('user_id')
                    .eq('account_number', destAccount)
                    .maybeSingle();
                if (vaRow?.user_id) {
                    const { data: p } = await supabase
                        .from('profiles')
                        .select('id, balance, email, custom_id')
                        .eq('id', vaRow.user_id)
                        .maybeSingle();
                    if (p) targetUser = p;
                }
            }

            // ── Strategy 3: Match by tx_ref prefix (AMF-<userSlug>) ──
            if (!targetUser && tx_ref && tx_ref.toUpperCase().startsWith('AMF-')) {
                const cleanRef = tx_ref.replace(/^AMF-(VA-|DVA-)?/i, '');
                const token = cleanRef.split('-')[0].toLowerCase().trim();
                if (token && token.length >= 4) {
                    const { data: users } = await supabase
                        .from('profiles')
                        .select('id, balance, email, custom_id');
                    if (users) {
                        targetUser = users.find(u => {
                            const rawId = u.id.replace(/-/g, '').toLowerCase();
                            return rawId.startsWith(token) || rawId.includes(token);
                        }) || null;
                    }
                }
            }

            // ── Strategy 4: Match by customer email ──
            if (!targetUser && custEmail && custEmail.includes('@')) {
                const { data: u } = await supabase
                    .from('profiles')
                    .select('id, balance, email, custom_id')
                    .eq('email', custEmail)
                    .maybeSingle();
                if (u) targetUser = u;
            }

            // ── Strategy 5: Match by customer phone ──
            if (!targetUser && custPhone && custPhone.length >= 9) {
                const { data: users } = await supabase
                    .from('profiles')
                    .select('id, balance, email, phone, custom_id');
                if (users) {
                    targetUser = users.find(u =>
                        u.phone && u.phone.replace(/[^0-9]/g, '').includes(custPhone.slice(-10))
                    ) || null;
                }
            }

            if (!targetUser) {
                console.warn('[Webhook FLW] No user matched for deposit:', { custEmail, destAccount, tx_ref, flwId });
                return res.status(200).json({ status: 'ignored', message: 'No matching user profile found' });
            }

            const refCode = `FLW-${flwId || tx_ref || Date.now()}`;

            // Deduplication check
            const { data: existingTx } = await supabase
                .from('transactions')
                .select('id')
                .or(`reference.eq.${refCode},reference.eq.${tx_ref}`)
                .maybeSingle();

            if (existingTx) {
                return res.status(200).json({ status: 'already_processed', tx_id: existingTx.id });
            }

            // Credit wallet
            const newBal = Number(targetUser.balance || 0) + depositAmt;
            await supabase.from('profiles').update({ balance: newBal }).eq('id', targetUser.id);
            await supabase.from('transactions').insert({
                user_id: targetUser.id,
                type: 'topup',
                amount: depositAmt,
                status: 'completed',
                reference: refCode,
                description: `Bank Transfer Deposit of ₦${depositAmt.toLocaleString()} via Dedicated NUBAN (Ref: ${tx_ref || refCode})`
            });

            console.log(`[Webhook FLW] Credited ₦${depositAmt} to user ${targetUser.id} (${targetUser.email}). New Balance: ₦${newBal}`);
            return res.status(200).json({
                success: true,
                credited: depositAmt,
                new_balance: newBal,
                user_id: targetUser.id
            });
        }

        return res.status(200).json({ status: 'received', event: eventType });

    } catch (err) {
        console.error('[Webhook FLW] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
