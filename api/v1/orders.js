import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

async function authenticateApiKey(supabase, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return null;
    const cleanKey = apiKey.trim();
    if (!cleanKey.startsWith('abumafhal_') && !cleanKey.startsWith('am_live_') && !cleanKey.startsWith('am_test_')) {
        return null;
    }

    const isTestKey = cleanKey.includes('_test_');

    try {
        const { data: keyRecord } = await supabase
            .from('vendor_api_keys')
            .select('*, profiles:vendor_id(id, business_name, full_name, email, role, avatar_url)')
            .eq('api_key', cleanKey)
            .eq('is_active', true)
            .maybeSingle();

        if (keyRecord) {
            return {
                vendor_id: keyRecord.vendor_id,
                vendor_name: keyRecord.profiles?.business_name || keyRecord.profiles?.full_name || 'Vendor',
                key_name: keyRecord.key_name,
                key_type: keyRecord.key_type || (isTestKey ? 'test' : 'live'),
                is_test: isTestKey
            };
        }
    } catch (_) {}

    try {
        const { data: row } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'vendor_api_keys')
            .maybeSingle();

        if (row?.value?.keys && Array.isArray(row.value.keys)) {
            const found = row.value.keys.find(k => k.api_key === cleanKey && k.is_active !== false);
            if (found) {
                return {
                    vendor_id: found.vendor_id,
                    vendor_name: found.vendor_name || 'Abu Mafhal Merchant',
                    key_name: found.key_name || 'API Key',
                    key_type: found.key_type || (isTestKey ? 'test' : 'live'),
                    is_test: isTestKey
                };
            }
        }
    } catch (_) {}

    return null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            status: 'error',
            code: 405,
            message: `Method ${req.method} not allowed. Please use GET.`
        });
    }

    const authHeader = req.headers['authorization'] || '';
    const xApiKey = req.headers['x-api-key'] || '';
    const queryApiKey = req.query?.api_key || '';

    let providedKey = xApiKey || queryApiKey;
    if (!providedKey && authHeader.startsWith('Bearer ')) {
        providedKey = authHeader.replace('Bearer ', '').trim();
    }

    if (!providedKey) {
        return res.status(401).json({
            status: 'error',
            code: 401,
            message: 'Unauthorized: Missing API Key.',
            documentation: 'Provide API Key via "x-api-key" header or Authorization: Bearer <API_KEY>'
        });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const authResult = await authenticateApiKey(supabase, providedKey);

    if (!authResult) {
        return res.status(403).json({
            status: 'error',
            code: 403,
            message: 'Forbidden: Invalid or inactive API Key.'
        });
    }

    try {
        const { limit = '20', page = '1', status = 'all' } = req.query;
        const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (currentPage - 1) * pageSize;

        let query = supabase
            .from('orders')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (status && status !== 'all') {
            query = query.eq('status', status.toLowerCase());
        }

        query = query.range(offset, offset + pageSize - 1);

        const { data: rawOrders, error: orderErr, count: totalCount } = await query;

        if (orderErr) {
            return res.status(500).json({
                status: 'error',
                code: 500,
                message: 'Failed to retrieve orders.',
                error: orderErr.message
            });
        }

        const orders = (rawOrders || []).map(order => ({
            id: order.id,
            order_number: order.order_number || `#AM-${order.id?.slice(0, 8)?.toUpperCase()}`,
            total: Number(order.total || order.amount || 0),
            currency: 'NGN',
            currency_symbol: '₦',
            status: order.status || 'pending',
            payment_status: order.payment_status || 'paid',
            payment_method: order.payment_method || 'paystack',
            payment_reference: order.payment_reference || null,
            customer: {
                name: order.customer_name || order.shipping_address?.name || 'Customer',
                email: order.customer_email || order.shipping_address?.email || null,
                phone: order.customer_phone || order.shipping_address?.phone || null
            },
            shipping_address: order.shipping_address || null,
            items: order.items || [],
            created_at: order.created_at,
            updated_at: order.updated_at
        }));

        const totalPages = Math.ceil((totalCount || 0) / pageSize);

        return res.status(200).json({
            status: 'success',
            code: 200,
            mode: authResult.is_test ? 'test' : 'live',
            authenticated_as: {
                vendor_id: authResult.vendor_id,
                vendor_name: authResult.vendor_name,
                key_type: authResult.key_type
            },
            pagination: {
                total_orders: totalCount || 0,
                current_page: currentPage,
                per_page: pageSize,
                total_pages: totalPages,
                has_next_page: currentPage < totalPages,
                has_prev_page: currentPage > 1
            },
            data: orders
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            code: 500,
            message: 'Internal server error while processing orders request.',
            error: err.message
        });
    }
}
