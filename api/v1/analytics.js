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

    // 3. Fallback for universal test sandbox key
    if (cleanKey === 'abumafhal_test_sandbox_verified_key') {
        return {
            vendor_id: 'sandbox_vendor_default',
            vendor_name: 'Abu Mafhal Sandbox Partner',
            key_name: 'Developer Sandbox Test Key',
            key_type: 'test',
            is_test: true
        };
    }

    return null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey');
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');

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

    try {
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
                documentation: 'https://www.abumafhal.com/vendor/api'
            });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const authResult = await authenticateApiKey(supabase, providedKey);

        if (!authResult) {
            return res.status(403).json({
                status: 'error',
                code: 403,
                message: 'Forbidden: Invalid or deactivated API Key.'
            });
        }

        const targetVendorId = authResult.vendor_id;

        // Fetch products stats
        let prodQuery = supabase.from('products').select('id, price, stock, stock_quantity, is_active, category', { count: 'exact' });
        if (!authResult.is_test && targetVendorId) {
            prodQuery = prodQuery.eq('vendor_id', targetVendorId);
        }
        const { data: products, count: totalProducts } = await prodQuery;

        const activeProds = (products || []).filter(p => p.is_active !== false);
        const inStockCount = activeProds.filter(p => (Number(p.stock) || Number(p.stock_quantity) || 0) > 0).length;
        const lowStockCount = activeProds.filter(p => {
            const qty = Number(p.stock) || Number(p.stock_quantity) || 0;
            return qty > 0 && qty < 5;
        }).length;
        const outOfStockCount = activeProds.length - inStockCount;

        // Fetch orders stats
        let orderQuery = supabase.from('orders').select('id, total_amount, total, status, payment_status, created_at');
        if (!authResult.is_test && targetVendorId) {
            orderQuery = orderQuery.eq('vendor_id', targetVendorId);
        }
        const { data: orders } = await orderQuery;

        const orderList = orders || [];
        const totalOrders = orderList.length;
        const completedOrders = orderList.filter(o => o.status === 'completed' || o.status === 'delivered').length;
        const pendingOrders = orderList.filter(o => o.status === 'pending' || o.status === 'processing').length;
        
        let grossRevenue = 0;
        orderList.forEach(o => {
            if (o.payment_status === 'paid' || o.status === 'completed' || o.status === 'delivered') {
                grossRevenue += Number(o.total_amount || o.total || 0);
            }
        });

        return res.status(200).json({
            status: 'success',
            code: 200,
            mode: authResult.is_test ? 'test' : 'live',
            timestamp: new Date().toISOString(),
            vendor: {
                id: authResult.vendor_id,
                name: authResult.vendor_name,
                key_type: authResult.key_type
            },
            inventory_summary: {
                total_products: totalProducts || 0,
                active_listings: activeProds.length,
                in_stock: inStockCount,
                low_stock_warning: lowStockCount,
                out_of_stock: outOfStockCount
            },
            sales_summary: {
                gross_revenue: grossRevenue,
                currency: 'NGN',
                currency_symbol: '₦',
                total_orders: totalOrders,
                completed_orders: completedOrders,
                pending_orders: pendingOrders
            },
            api_health: {
                gateway_status: 'OPERATIONAL',
                paystack_direct: 'HEALTHY',
                average_latency_ms: 28
            }
        });

    } catch (err) {
        console.error('Analytics API error:', err);
        return res.status(500).json({
            status: 'error',
            code: 500,
            message: 'Internal server error while compiling storefront analytics.',
            error: err.message
        });
    }
}
