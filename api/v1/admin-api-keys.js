import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

async function isAdmin(supabase, authHeader) {
    try {
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '').trim();
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user?.id) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle();
                return profile?.role === 'admin' || profile?.role === 'superadmin';
            }
        }
    } catch (_) {}
    return false;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const authHeader = req.headers['authorization'] || '';
    const adminCheck = await isAdmin(supabase, authHeader);

    if (!adminCheck) {
        return res.status(403).json({
            status: 'error',
            code: 403,
            message: 'Forbidden: Admin authentication required.'
        });
    }

    try {
        // ─── GET: List all API access requests & active keys ─────────────────
        if (req.method === 'GET') {
            // Fetch all access requests from app_settings
            const { data: reqRow } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'vendor_api_access_requests')
                .maybeSingle();

            const requests = reqRow?.value?.requests || [];

            // Fetch all issued keys
            let allKeys = [];
            try {
                const { data: tableKeys } = await supabase
                    .from('vendor_api_keys')
                    .select('*, profiles:vendor_id(id, business_name, full_name, email, avatar_url)')
                    .order('created_at', { ascending: false });
                allKeys = tableKeys || [];
            } catch (_) {}

            // Fallback to app_settings keys
            if (allKeys.length === 0) {
                const { data: settingsRow } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'vendor_api_keys')
                    .maybeSingle();
                allKeys = settingsRow?.value?.keys || [];
            }

            // Fetch all profiles for vendor names in requests
            const vendorIds = [...new Set(requests.map(r => r.vendor_id).filter(Boolean))];
            let profileMap = {};
            if (vendorIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, business_name, full_name, email, avatar_url, custom_id')
                    .in('id', vendorIds);
                (profiles || []).forEach(p => { profileMap[p.id] = p; });
            }

            const enrichedRequests = requests.map(r => ({
                ...r,
                vendor: profileMap[r.vendor_id] || { id: r.vendor_id, full_name: 'Unknown Vendor' }
            }));

            return res.status(200).json({
                status: 'success',
                code: 200,
                access_requests: enrichedRequests,
                issued_keys: allKeys,
                stats: {
                    total_requests: enrichedRequests.length,
                    pending: enrichedRequests.filter(r => r.status === 'pending').length,
                    approved: enrichedRequests.filter(r => r.status === 'approved').length,
                    rejected: enrichedRequests.filter(r => r.status === 'rejected').length,
                    total_keys: allKeys.length,
                    active_keys: allKeys.filter(k => k.is_active !== false).length,
                }
            });
        }

        // ─── PATCH: Approve or Reject a vendor's API access request ─────────
        if (req.method === 'PATCH') {
            const { vendor_id, action, reason } = req.body || {};

            if (!vendor_id || !['approve', 'reject', 'revoke_all'].includes(action)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Missing vendor_id or invalid action. Use: approve | reject | revoke_all'
                });
            }

            // Update the access request status
            const { data: reqRow } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'vendor_api_access_requests')
                .maybeSingle();

            const requests = reqRow?.value?.requests || [];
            const updatedRequests = requests.map(r => {
                if (r.vendor_id === vendor_id) {
                    return {
                        ...r,
                        status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : r.status,
                        admin_note: reason || null,
                        reviewed_at: new Date().toISOString()
                    };
                }
                return r;
            });

            // If vendor not found in requests yet, create entry
            const exists = updatedRequests.some(r => r.vendor_id === vendor_id);
            if (!exists && action === 'approve') {
                updatedRequests.push({
                    id: `req_${Date.now()}`,
                    vendor_id,
                    status: 'approved',
                    admin_note: reason || 'Admin direct approval',
                    requested_at: new Date().toISOString(),
                    reviewed_at: new Date().toISOString()
                });
            }

            await supabase.from('app_settings').upsert({
                key: 'vendor_api_access_requests',
                value: { requests: updatedRequests },
                description: 'Vendor API Access Approval Queue',
                updated_at: new Date().toISOString()
            });

            // Also update profile flag for faster lookup
            const accessGranted = action === 'approve';
            await supabase
                .from('profiles')
                .update({ api_access_approved: accessGranted, updated_at: new Date().toISOString() })
                .eq('id', vendor_id)
                .catch(() => {});

            // If revoke_all or reject: deactivate all keys for this vendor
            if (action === 'revoke_all' || action === 'reject') {
                try {
                    await supabase
                        .from('vendor_api_keys')
                        .update({ is_active: false, updated_at: new Date().toISOString() })
                        .eq('vendor_id', vendor_id);
                } catch (_) {}

                const { data: keysRow } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'vendor_api_keys')
                    .maybeSingle();

                if (keysRow?.value?.keys) {
                    const updated = keysRow.value.keys.map(k =>
                        k.vendor_id === vendor_id ? { ...k, is_active: false } : k
                    );
                    await supabase.from('app_settings').upsert({
                        key: 'vendor_api_keys',
                        value: { keys: updated },
                        updated_at: new Date().toISOString()
                    });
                }
            }

            return res.status(200).json({
                status: 'success',
                code: 200,
                message: `Vendor API access ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'keys revoked'} successfully.`,
                action,
                vendor_id
            });
        }

        // ─── DELETE: Hard-revoke a single API key by key_id ──────────────────
        if (req.method === 'DELETE') {
            const { key_id, api_key } = req.body || {};

            if (!key_id && !api_key) {
                return res.status(400).json({ status: 'error', message: 'Missing key_id or api_key.' });
            }

            try {
                let q = supabase.from('vendor_api_keys').delete();
                if (key_id) q = q.eq('id', key_id);
                else q = q.eq('api_key', api_key);
                await q;
            } catch (_) {}

            // Also remove from app_settings
            const { data: settingsRow } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'vendor_api_keys')
                .maybeSingle();

            if (settingsRow?.value?.keys) {
                const filtered = settingsRow.value.keys.filter(k =>
                    (key_id ? k.id !== key_id : true) && (api_key ? k.api_key !== api_key : true)
                );
                await supabase.from('app_settings').upsert({
                    key: 'vendor_api_keys',
                    value: { keys: filtered },
                    updated_at: new Date().toISOString()
                });
            }

            return res.status(200).json({
                status: 'success',
                code: 200,
                message: 'API Key permanently revoked by admin.'
            });
        }

        return res.status(405).json({ status: 'error', message: 'Method not allowed.' });

    } catch (err) {
        console.error('Admin API Keys error:', err);
        return res.status(500).json({
            status: 'error',
            code: 500,
            message: 'Internal server error.',
            error: err.message
        });
    }
}
