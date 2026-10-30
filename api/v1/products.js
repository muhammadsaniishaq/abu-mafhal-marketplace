import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

/**
 * Vendor API Key Authenticator
 * Supports both dedicated vendor_api_keys table or synchronized app_settings/profiles storage.
 */
async function authenticateApiKey(supabase, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return null;
    const cleanKey = apiKey.trim();
    if (!cleanKey.startsWith('abumafhal_') && !cleanKey.startsWith('am_live_') && !cleanKey.startsWith('am_test_')) {
        return null;
    }

    const isTestKey = cleanKey.includes('_test_');

    // 1. Check vendor_api_keys table first (if table created in DB)
    try {
        const { data: keyRecord } = await supabase
            .from('vendor_api_keys')
            .select('*, profiles:vendor_id(id, business_name, full_name, email, avatar_url, role)')
            .eq('api_key', cleanKey)
            .eq('is_active', true)
            .maybeSingle();

        if (keyRecord) {
            // Update stats async (fire and forget)
            supabase.from('vendor_api_keys').update({
                total_requests: (keyRecord.total_requests || 0) + 1,
                last_used_at: new Date().toISOString()
            }).eq('id', keyRecord.id).then(() => {}).catch(() => {});

            return {
                vendor_id: keyRecord.vendor_id,
                vendor_name: keyRecord.profiles?.business_name || keyRecord.profiles?.full_name || 'Vendor',
                is_verified: true,
                key_name: keyRecord.key_name,
                key_type: keyRecord.key_type || (isTestKey ? 'test' : 'live'),
                is_test: isTestKey,
                scope: 'vendor_scoped'
            };
        }
    } catch (_) {}

    // 2. Check vendor_api_keys stored in app_settings (Universal fallback)
    try {
        const { data: row } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'vendor_api_keys')
            .maybeSingle();

        if (row && row.value && Array.isArray(row.value.keys)) {
            const found = row.value.keys.find(k => k.api_key === cleanKey && k.is_active !== false);
            if (found) {
                return {
                    vendor_id: found.vendor_id,
                    vendor_name: found.vendor_name || 'Abu Mafhal Merchant',
                    is_verified: true,
                    key_name: found.key_name || 'Production Key',
                    key_type: found.key_type || (isTestKey ? 'test' : 'live'),
                    is_test: isTestKey,
                    scope: found.scope || 'vendor_scoped'
                };
            }
        }
    } catch (_) {}

    // 3. Check profiles custom_id storage
    try {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, business_name, full_name, is_verified, custom_id')
            .not('custom_id', 'is', null)
            .limit(100);

        if (profiles && Array.isArray(profiles)) {
            for (const p of profiles) {
                let parsed = null;
                try {
                    parsed = typeof p.custom_id === 'string' ? JSON.parse(p.custom_id) : p.custom_id;
                } catch (_) {}

                if (parsed && parsed.api_keys && Array.isArray(parsed.api_keys)) {
                    const match = parsed.api_keys.find(k => k.api_key === cleanKey && k.is_active !== false);
                    if (match) {
                        return {
                            vendor_id: p.id,
                            vendor_name: p.business_name || p.full_name || 'Vendor',
                            is_verified: !!p.is_verified,
                            key_name: match.key_name || 'Production Key',
                            scope: 'vendor_scoped'
                        };
                    }
                }
            }
        }
    } catch (_) {}

    return null;
}

export default async function handler(req, res) {
    // ─── Set High Performance Global CORS Headers ───
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey');
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

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
        // ─── Extract API Key from Header or Query Param ───
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
                documentation: 'Provide your API key via "x-api-key" header or Authorization: Bearer <API_KEY> or ?api_key=<API_KEY>',
                help: 'Generate your API key in Vendor Dashboard -> Developer API'
            });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const authResult = await authenticateApiKey(supabase, providedKey);

        if (!authResult) {
            return res.status(403).json({
                status: 'error',
                code: 403,
                message: 'Forbidden: Invalid, expired, or deactivated API Key.',
                help: 'Verify your API key in Abu Mafhal Vendor Dashboard.'
            });
        }

        // ─── Parse Query Filters & Parameters ───
        const {
            limit = '50',
            page = '1',
            search = '',
            category = '',
            in_stock_only = 'false',
            min_price,
            max_price,
            sort_by = 'created_at',
            sort_order = 'desc',
            vendor_id
        } = req.query;

        const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 50), 100);
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (currentPage - 1) * pageSize;

        // Build Supabase Query
        let query = supabase
            .from('products')
            .select(`
                id,
                vendor_id,
                name,
                description,
                price,
                compare_at_price,
                original_price,
                stock,
                stock_quantity,
                images,
                image_url,
                category,
                brand,
                sku,
                barcode,
                status,
                is_active,
                rating,
                average_rating,
                reviews,
                total_sales,
                created_at,
                updated_at
            `, { count: 'exact' });

        // Filter active products
        query = query.eq('is_active', true);

        // Security / Scope filter: If key is vendor-scoped, vendor sees their own products by default,
        // or can query specifically if permitted.
        // In TEST mode: If vendor has no products uploaded yet, let them view the active marketplace test catalog
        if (authResult.is_test) {
            // Test keys have access to test sandbox products across the marketplace
            if (vendor_id) {
                query = query.eq('vendor_id', vendor_id);
            }
        } else if (authResult.vendor_id && authResult.scope === 'vendor_scoped') {
            query = query.eq('vendor_id', authResult.vendor_id);
        } else if (vendor_id) {
            query = query.eq('vendor_id', vendor_id);
        }

        // Search by Product Name or Category or Brand
        if (search && search.trim()) {
            query = query.ilike('name', `%${search.trim()}%`);
        }

        if (category && category.trim() && category !== 'All') {
            query = query.ilike('category', `%${category.trim()}%`);
        }

        // In Stock filter
        if (in_stock_only === 'true' || in_stock_only === '1') {
            query = query.or('stock.gt.0,stock_quantity.gt.0');
        }

        // Price range filters
        if (min_price && !isNaN(min_price)) {
            query = query.gte('price', Number(min_price));
        }
        if (max_price && !isNaN(max_price)) {
            query = query.lte('price', Number(max_price));
        }

        // Sorting
        const ascending = sort_order.toLowerCase() === 'asc';
        const allowedSortCols = ['created_at', 'price', 'name', 'stock', 'stock_quantity', 'total_sales'];
        const sortCol = allowedSortCols.includes(sort_by) ? sort_by : 'created_at';
        query = query.order(sortCol, { ascending });

        // Pagination
        query = query.range(offset, offset + pageSize - 1);

        const { data: rawProducts, error: dbError, count: totalCount } = await query;

        if (dbError) {
            console.error('API Database Error:', dbError);
            return res.status(500).json({
                status: 'error',
                code: 500,
                message: 'Failed to retrieve products from marketplace database.',
                error: dbError.message
            });
        }

        // ─── Batch Fetch Vendor Profiles (to avoid PostgREST relationship requirements) ───
        const vendorIds = [...new Set((rawProducts || []).map(p => p.vendor_id).filter(Boolean))];
        const vendorMap = {};

        if (vendorIds.length > 0) {
            try {
                const { data: vendorProfiles } = await supabase
                    .from('profiles')
                    .select('id, business_name, full_name, avatar_url, role')
                    .in('id', vendorIds);

                (vendorProfiles || []).forEach(v => {
                    vendorMap[v.id] = v;
                });
            } catch (_) {}
        }

        // ─── Format & Sanitize Products Response for External API Consumers ───
        const products = (rawProducts || []).map(p => {
            const availableStock = Math.max(0, parseInt(p.stock !== undefined ? p.stock : (p.stock_quantity || 0), 10) || 0);
            const inStock = availableStock > 0 && p.status !== 'out_of_stock';

            // Clean image URLs array
            let formattedImages = [];
            if (Array.isArray(p.images) && p.images.length > 0) {
                formattedImages = p.images.filter(Boolean);
            }
            if (formattedImages.length === 0 && p.image_url) {
                formattedImages = [p.image_url];
            }

            const primaryImage = formattedImages[0] || p.image_url || null;
            const vendorInfo = vendorMap[p.vendor_id] || {};

            return {
                id: p.id,
                name: p.name || 'Unnamed Product',
                description: p.description || '',
                price: Number(p.price) || 0,
                currency: 'NGN',
                currency_symbol: '₦',
                compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : (p.original_price ? Number(p.original_price) : null),
                available_stock: availableStock,
                in_stock: inStock,
                stock_status: inStock ? 'IN_STOCK' : 'OUT_OF_STOCK',
                primary_image: primaryImage,
                images: formattedImages,
                category: p.category || 'General',
                brand: p.brand || null,
                sku: p.sku || null,
                barcode: p.barcode || null,
                rating: Number(p.rating || p.average_rating || 5.0),
                total_reviews: Number(p.reviews || 0),
                total_sales: Number(p.total_sales || 0),
                vendor: {
                    id: p.vendor_id,
                    business_name: vendorInfo.business_name || vendorInfo.full_name || 'Abu Mafhal Merchant',
                    is_verified: vendorInfo.role === 'vendor' || vendorInfo.role === 'admin',
                    logo_url: vendorInfo.avatar_url || null
                },
                created_at: p.created_at,
                updated_at: p.updated_at
            };
        });

        const totalPages = Math.ceil((totalCount || 0) / pageSize);

        return res.status(200).json({
            status: 'success',
            code: 200,
            mode: authResult.is_test ? 'test' : 'live',
            authenticated_as: {
                vendor_id: authResult.vendor_id,
                vendor_name: authResult.vendor_name,
                key_name: authResult.key_name,
                key_type: authResult.key_type || (authResult.is_test ? 'test' : 'live')
            },
            pagination: {
                total_products: totalCount || 0,
                current_page: currentPage,
                per_page: pageSize,
                total_pages: totalPages,
                has_next_page: currentPage < totalPages,
                has_prev_page: currentPage > 1
            },
            data: products
        });

    } catch (err) {
        console.error('Unhandled API Error:', err);
        return res.status(500).json({
            status: 'error',
            code: 500,
            message: 'Internal server error while processing API request.',
            error: err.message
        });
    }
}
