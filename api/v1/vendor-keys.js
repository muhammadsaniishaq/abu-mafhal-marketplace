import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

function generateRandomApiKey(keyType = 'live') {
    const randomHex = crypto.randomBytes(24).toString('hex');
    const prefix = keyType === 'test' ? 'abumafhal_test_' : 'abumafhal_live_';
    return `${prefix}${randomHex}`;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
        // ─── 1. Authenticate Request via Supabase JWT or user_id ───
        let userId = null;
        let vendorProfile = null;

        // Try extracting user from Authorization Bearer token if provided
        const authHeader = req.headers['authorization'] || '';
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '').trim();
            const { data: { user } } = await supabase.auth.getUser(token).catch(() => ({ data: {} }));
            if (user?.id) {
                userId = user.id;
            }
        }

        // Fallback for body/query param (client passing current authenticated vendor id)
        if (!userId) {
            userId = req.body?.vendor_id || req.query?.vendor_id;
        }

        if (!userId) {
            return res.status(401).json({
                status: 'error',
                code: 401,
                message: 'Unauthorized: Vendor session or vendor_id is required.'
            });
        }

        // Verify profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, business_name, full_name, email, role, avatar_url, custom_id')
            .eq('id', userId)
            .maybeSingle();

        if (!profile) {
            return res.status(404).json({
                status: 'error',
                code: 404,
                message: 'Vendor profile not found.'
            });
        }

        vendorProfile = profile;

        // ─── GET: List Vendor Keys ──────────────────────────────────────────────
        if (req.method === 'GET') {
            // First check vendor_api_keys table
            try {
                const { data: tableKeys } = await supabase
                    .from('vendor_api_keys')
                    .select('*')
                    .eq('vendor_id', userId)
                    .order('created_at', { ascending: false });

                if (tableKeys && tableKeys.length > 0) {
                    return res.status(200).json({
                        status: 'success',
                        code: 200,
                        keys: tableKeys,
                        data: tableKeys
                    });
                }
            } catch (_) {}

            // Fallback: check app_settings
            const { data: settingRow } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'vendor_api_keys')
                .maybeSingle();

            const allKeys = (settingRow?.value?.keys || []);
            const vendorKeys = allKeys.filter(k => k.vendor_id === userId);

            return res.status(200).json({
                status: 'success',
                code: 200,
                keys: vendorKeys,
                data: vendorKeys
            });
        }

        // ─── POST: Generate / Create New API Key ─────────────────────────────────
        if (req.method === 'POST') {
            let body = req.body || {};
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (_) { body = {}; }
            }

            const keyName = (body.key_name || 'Production Storefront Key').trim();
            const keyType = body.key_type === 'test' ? 'test' : 'live';
            const newApiKey = generateRandomApiKey(keyType);

            const newKeyRecord = {
                id: crypto.randomUUID ? crypto.randomUUID() : `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                vendor_id: userId,
                vendor_name: vendorProfile.business_name || vendorProfile.full_name || 'Vendor',
                key_name: keyName,
                key_type: keyType,
                api_key: newApiKey,
                is_active: true,
                rate_limit_per_minute: 120,
                total_requests: 0,
                last_used_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Attempt save to vendor_api_keys table
            let savedInTable = false;
            try {
                const { error: insErr } = await supabase
                    .from('vendor_api_keys')
                    .insert([newKeyRecord]);
                if (!insErr) savedInTable = true;
            } catch (_) {}

            // Synchronize into app_settings for zero-latency universal resilience
            try {
                const { data: settingRow } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'vendor_api_keys')
                    .maybeSingle();

                let currentList = (settingRow?.value?.keys || []);
                currentList = currentList.filter(k => k.api_key !== newApiKey);
                currentList.unshift(newKeyRecord);

                await supabase.from('app_settings').upsert({
                    key: 'vendor_api_keys',
                    value: { keys: currentList },
                    description: 'Registered Vendor Public API Keys',
                    updated_at: new Date().toISOString()
                });
            } catch (syncErr) {
                console.error('Settings sync note:', syncErr);
            }

            return res.status(201).json({
                status: 'success',
                code: 201,
                message: 'Vendor API Key successfully created!',
                key: newKeyRecord,
                data: newKeyRecord
            });
        }

        // ─── DELETE: Revoke API Key ──────────────────────────────────────────────
        if (req.method === 'DELETE') {
            const keyToRevoke = req.body?.api_key || req.query?.api_key;
            const keyIdToRevoke = req.body?.key_id || req.query?.key_id;

            if (!keyToRevoke && !keyIdToRevoke) {
                return res.status(400).json({ status: 'error', message: 'Missing api_key or key_id to revoke.' });
            }

            // Revoke in table
            try {
                let q = supabase.from('vendor_api_keys').delete().eq('vendor_id', userId);
                if (keyToRevoke) q = q.eq('api_key', keyToRevoke);
                else if (keyIdToRevoke) q = q.eq('id', keyIdToRevoke);
                await q;
            } catch (_) {}

            // Revoke in app_settings
            try {
                const { data: settingRow } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'vendor_api_keys')
                    .maybeSingle();

                if (settingRow?.value?.keys) {
                    const filtered = settingRow.value.keys.filter(k => {
                        if (k.vendor_id !== userId) return true;
                        if (keyToRevoke && k.api_key === keyToRevoke) return false;
                        if (keyIdToRevoke && k.id === keyIdToRevoke) return false;
                        return true;
                    });

                    await supabase.from('app_settings').upsert({
                        key: 'vendor_api_keys',
                        value: { keys: filtered },
                        description: 'Registered Vendor Public API Keys',
                        updated_at: new Date().toISOString()
                    });
                }
            } catch (_) {}

            return res.status(200).json({
                status: 'success',
                code: 200,
                message: 'API Key revoked successfully.'
            });
        }

        return res.status(405).json({ status: 'error', message: 'Method not allowed' });

    } catch (err) {
        console.error('Keys Management Error:', err);
        return res.status(500).json({
            status: 'error',
            code: 500,
            message: 'Internal server error while managing vendor API keys.',
            error: err.message
        });
    }
}
