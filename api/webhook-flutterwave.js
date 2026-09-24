import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, verif-hash');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({ status: 'active', message: 'Abu Mafhal Flutterwave Webhook is running' });
    }

    try {
        const body = req.body || {};
        const data = body?.data ?? body;
        const flwId = data?.id;
        const status = data?.status;
        const tx_ref = data?.tx_ref;
        const signature = req.headers['verif-hash'];

        // Known webhook secret hash
        const expectedHash = process.env.FLUTTERWAVE_WEBHOOK_HASH || 'AbuMafhalWebhook2026';

        const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY || 'FLWSECK-456331fb55a2e059f1eb8d439c53b9ae-1a07bfbf2fcvt-X';

        // Security check: either hash matches, or we verify directly against Flutterwave official API
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
            } catch (vErr) {
                console.warn('[Webhook FLW] Direct verify attempt warning:', vErr.message);
            }
        }

        if (!isVerified) {
            console.warn('[Webhook FLW] Unauthorized attempt or signature mismatch. Signature:', signature);
            return res.status(401).json({ error: 'Unauthorized signature' });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Process successful bank transfers or charges
        if (status === 'successful') {
            const depositAmt = Number(data?.amount || 0);
            const custEmail = (data?.customer?.email || '').trim().toLowerCase();
            const custPhone = (data?.customer?.phone_number || '').replace(/[^0-9]/g, '');
            let targetUser = null;

            // 1. Match by email first (direct exact match on user profile email)
            if (custEmail && custEmail.includes('@')) {
                const { data: u } = await supabase.from('profiles').select('id, balance, email').eq('email', custEmail).maybeSingle();
                if (u) targetUser = u;
            }

            // 2. Match by tx_ref prefix (e.g. AMF-8F429903-1727... or AMF-DVA-6D3DF1F5)
            if (!targetUser && tx_ref && tx_ref.startsWith('AMF-')) {
                const cleanRef = tx_ref.replace(/^AMF-(DVA-)?/i, '');
                const token = cleanRef.split('-')[0].toLowerCase().trim();
                if (token && token.length >= 4) {
                    const { data: users } = await supabase.from('profiles').select('id, balance, email');
                    if (users && Array.isArray(users)) {
                        targetUser = users.find(u => {
                            const rawId = u.id.replace(/-/g, '').toLowerCase();
                            return rawId.startsWith(token) || rawId.includes(token);
                        });
                    }
                }
            }

            // 3. Match by phone if still not resolved
            if (!targetUser && custPhone && custPhone.length >= 9) {
                const { data: users } = await supabase.from('profiles').select('id, balance, phone, email');
                if (users && Array.isArray(users)) {
                    targetUser = users.find(u => u.phone && u.phone.replace(/[^0-9]/g, '').includes(custPhone));
                }
            }

            if (!targetUser) {
                console.warn('[Webhook FLW] No user matched for deposit:', { custEmail, tx_ref, flwId });
                return res.status(200).json({ status: 'ignored', message: 'No matching user profile found' });
            }

            const refCode = `FLW-${flwId || tx_ref || Date.now()}`;

            // Deduplication check
            const { data: existingTx } = await supabase
                .from('transactions')
                .select('id')
                .or(`reference.eq.${refCode},reference.eq.FLW-${flwId},reference.eq.${tx_ref}`)
                .maybeSingle();

            if (existingTx) {
                return res.status(200).json({ status: 'already_processed', tx_id: existingTx.id });
            }

            if (depositAmt > 0) {
                const newBal = Number(targetUser.balance || 0) + depositAmt;
                await supabase.from('profiles').update({ balance: newBal }).eq('id', targetUser.id);
                await supabase.from('transactions').insert({
                    user_id: targetUser.id,
                    type: 'topup',
                    amount: depositAmt,
                    status: 'completed',
                    reference: refCode,
                    description: `Bank Transfer Deposit of ₦${depositAmt.toLocaleString()} via Flutterwave MFB (Ref: ${tx_ref || refCode})`
                });

                // If user is founder/admin, also sync other founder profiles so they never see zero on any device/login
                const FOUNDER_EMAILS = [
                    'sale.abumafhal@gmail.com',
                    'muhammadsanishaq@gmail.com',
                    'abumafhalhub@gmail.com',
                    'muhammadsanish0@gmail.com',
                    'ceo@abumafhal.com',
                    'muhammadsaniisyaku3@gmail.com'
                ];

                if (FOUNDER_EMAILS.includes(targetUser.email?.toLowerCase())) {
                    for (const fEmail of FOUNDER_EMAILS) {
                        if (fEmail !== targetUser.email?.toLowerCase()) {
                            try {
                                const { data: fp } = await supabase.from('profiles').select('id, balance').eq('email', fEmail).maybeSingle();
                                if (fp) {
                                    await supabase.from('profiles').update({ balance: Number(fp.balance || 0) + depositAmt }).eq('id', fp.id);
                                    await supabase.from('transactions').insert({
                                        user_id: fp.id,
                                        type: 'topup',
                                        amount: depositAmt,
                                        status: 'completed',
                                        reference: `${refCode}-${fp.id.slice(0, 4)}`,
                                        description: `Bank Transfer Deposit of ₦${depositAmt.toLocaleString()} via Flutterwave MFB (Ref: ${tx_ref || refCode})`
                                    });
                                }
                            } catch (_) {}
                        }
                    }
                }

                console.log(`[Webhook FLW] Successfully credited ₦${depositAmt} to user ${targetUser.id} (${targetUser.email}). New Balance: ₦${newBal}`);
                return res.status(200).json({
                    success: true,
                    credited: depositAmt,
                    new_balance: newBal,
                    user_id: targetUser.id
                });
            }
        }

        return res.status(200).json({ status: 'received' });
    } catch (err) {
        console.error('[Webhook FLW] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
