/**
 * adminAIService.js
 * ─────────────────────────────────────────────────────────────
 * AI service EXCLUSIVELY for Admin role.
 * • Fetches live platform data from Supabase
 * • Builds a rich, factual system prompt
 * • NEVER leaks user private data to admin (e.g. no password, payment card)
 * • NEVER uses this service in User-facing screens
 * ─────────────────────────────────────────────────────────────
 */
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────
// Admin AI Tools (Function Calling Definitions)
// ─────────────────────────────────────────────
const adminTools = [
    {
        name: 'search_users',
        description: 'Search for a user by name, email, or exact phone number. If multiple users are found, LIST them briefly and ask the admin to clarify which one by exact phone, email, or ID.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'Name, email, or phone of the user' } }, required: ['query'] }
    },
    {
        name: 'search_orders',
        description: 'Get details of a specific order by its exact ID or tracking number, including items, shipping, and status.',
        parameters: { type: 'object', properties: { order_id: { type: 'string', description: 'The order ID or tracking string' } }, required: ['order_id'] }
    },
    {
        name: 'search_products',
        description: 'Search for products by name or category to see stock levels, price, and vendor info.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'Product name or category keyword' } }, required: ['query'] }
    },
    {
        name: 'search_vendors',
        description: 'Search for a vendor or store by name, email or phone to see their store details, status, and balance.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'Store name, vendor email, or phone' } }, required: ['query'] }
    },
    {
        name: 'search_tickets',
        description: 'Search support tickets by exact ID, or user email/name to check status and issues.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'Ticket ID, user email, or subject keyword' } }, required: ['query'] }
    },
    {
        name: 'search_payouts',
        description: 'Search for withdrawal or payout requests by exact ID or vendor name to check status and amount.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'Payout ID or vendor name' } }, required: ['query'] }
    },
    {
        name: 'search_coupons',
        description: 'Search for a discount coupon by its exact code to see its value, expiration, and usage count.',
        parameters: { type: 'object', properties: { code: { type: 'string', description: 'The exact coupon code' } }, required: ['code'] }
    },
    {
        name: 'search_disputes',
        description: 'Search for order disputes by order ID, vendor, or reason keyword.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'Order ID, reason keyword, or status' } }, required: ['query'] }
    },
    {
        name: 'search_broadcasts',
        description: 'Search past notification broadcasts sent to users by title keyword.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'Title keyword of the broadcast' } }, required: ['query'] }
    },
    {
        name: 'search_vendor_applications',
        description: 'Search vendor store applications by store name or user email/phone.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'Store name, email, or phone number' } }, required: ['query'] }
    },
    {
        name: 'search_invoices',
        description: 'Search for payment invoices or financial records by exact invoice ID.',
        parameters: { type: 'object', properties: { invoice_id: { type: 'string', description: 'Exact invoice ID' } }, required: ['invoice_id'] }
    },
    {
        name: 'get_platform_metrics',
        description: 'Get deep analytics metrics for a specific timeframe (e.g. daily, weekly, monthly).',
        parameters: { type: 'object', properties: { period: { type: 'string', description: 'Time period: daily, weekly, or monthly', enum: ['daily', 'weekly', 'monthly'] } }, required: ['period'] }
    },
    {
        name: 'search_banners',
        description: 'Search active or inactive promo banners by title or status.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'Banner title or status (active/inactive)' } }, required: ['query'] }
    },
    {
        name: 'search_referrals',
        description: 'Search referral code usage or referral rewards by referrer user email/phone.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'Referrer email or phone number' } }, required: ['query'] }
    }
];

// ─────────────────────────────────────────────
// Tool Execution Logic
// ─────────────────────────────────────────────
async function executeToolCall(toolName, args, platformContext) {
    try {
        console.log(`[AdminAI] Executing Tool: ${toolName} with args:`, args);
        if (toolName === 'search_users') {
            const q = args.query.trim();
            // Try to match by ID first if it looks like a short UUID or full UUID, otherwise text search
            let queryBuilder = supabase.from('profiles').select('id, full_name, email, role, phone, created_at');

            // Supabase 'or' syntax: 'column.operator.value,column.operator.value'
            // We use ilike for partial matching. 
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
            const orQuery = `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%${isUuid ? `,id.eq.${q}` : ''}`;

            let { data, error } = await queryBuilder.or(orQuery).limit(20);

            if (error) {
                console.error('[AdminAI] search_users error:', error);
                return { message: 'Error searching users: ' + error.message };
            }

            if (data && data.length) {
                // Fetch wallets separately since there's no direct relation
                const userIds = data.map(u => u.id);
                const { data: walletData } = await supabase.from('wallets').select('user_id, balance').in('user_id', userIds);
                if (walletData) {
                    const walletMap = {};
                    walletData.forEach(w => walletMap[w.user_id] = w.balance);
                    data = data.map(u => ({ ...u, wallet_balance: walletMap[u.id] || 0 }));
                }
                return data;
            }

            return { message: `No users found matching "${q}". Ask the admin for a more specific email or phone.` };
        }
        if (toolName === 'search_orders') {
            const { data } = await supabase.from('orders').select('*, order_items(*, product:products(name)), user:profiles(full_name, phone), vendor:vendor_profiles(store_name)').eq('id', args.order_id).maybeSingle();
            return data || { message: 'Order not found.' };
        }
        if (toolName === 'search_products') {
            const { data } = await supabase.from('products').select('id, name, price, stock_quantity, category, status, vendor:vendor_profiles(store_name)').ilike('name', `%${args.query}%`).limit(5);
            return data && data.length ? data : { message: 'No products found.' };
        }
        if (toolName === 'search_vendors') {
            const { data } = await supabase.from('vendor_profiles').select('id, store_name, status, store_description, user:profiles(full_name, phone), balance:wallets(balance)').ilike('store_name', `%${args.query}%`).limit(5);
            return data && data.length ? data : { message: 'No vendors found matching query.' };
        }
        if (toolName === 'search_tickets') {
            const { data } = await supabase.from('support_tickets').select('id, subject, description, status, category, created_at, user:profiles(full_name, email)').or(`id.eq.${args.query},subject.ilike.%${args.query}%`).limit(5).catch(() => supabase.from('support_tickets').select('id, subject, description, status, category, created_at, user:profiles(full_name)').ilike('subject', `%${args.query}%`).limit(5));
            return data && data.length ? data : { message: 'No tickets found.' };
        }
        if (toolName === 'search_payouts') {
            const { data } = await supabase.from('payouts').select('id, amount, status, created_at, vendor:vendor_profiles(store_name), account_name, account_number, bank_name').limit(5); // Basic fallback find, as complex search across relations is tricky in simple OR
            let results = data;
            if (args.query && data) {
                results = data.filter(d => d.id === args.query || d.vendor?.store_name?.toLowerCase().includes(args.query.toLowerCase()));
            }
            return results && results.length ? results : { message: 'No payouts found.' };
        }
        if (toolName === 'search_coupons') {
            const { data } = await supabase.from('coupons').select('id, code, discount_type, discount_value, min_order_amount, usage_count, is_active, expires_at').eq('code', args.code).maybeSingle();
            return data || { message: 'Coupon not found.' };
        }
        if (toolName === 'search_disputes') {
            const { data } = await supabase.from('disputes').select('id, order_id, reason, status, created_at, vendor:vendor_profiles(store_name), user:profiles(full_name)').ilike('reason', `%${args.query}%`).limit(5);
            return data && data.length ? data : { message: 'No disputes found.' };
        }
        if (toolName === 'search_broadcasts') {
            const { data } = await supabase.from('broadcasts').select('id, title, message, target_audience, created_at, status').ilike('title', `%${args.query}%`).limit(5);
            return data && data.length ? data : { message: 'No broadcasts found.' };
        }
        if (toolName === 'search_vendor_applications') {
            const { data } = await supabase.from('vendor_applications').select('id, store_name, store_description, business_address, status, created_at, user:profiles(full_name, email, phone)').ilike('store_name', `%${args.query}%`).limit(5);
            return data && data.length ? data : { message: 'No applications found.' };
        }
        if (toolName === 'search_invoices') {
            const { data } = await supabase.from('invoices').select('id, amount, status, created_at, user:profiles(full_name)').eq('id', args.invoice_id).maybeSingle();
            return data || { message: 'Invoice not found.' };
        }
        if (toolName === 'get_platform_metrics') {
            // Simplified analytics fetching since complex metrics take long
            const { data } = await supabase.rpc('get_admin_dashboard_stats');
            return data ? { ...data, requested_period: args.period } : { message: 'Metrics not available.' };
        }
        if (toolName === 'search_banners') {
            const { data } = await supabase.from('promo_banners').select('id, title, status, created_at, link_url').ilike('title', `%${args.query}%`).limit(5).catch(() => supabase.from('banners').select('id, title, status, created_at').ilike('title', `%${args.query}%`).limit(5));
            return data && data.length ? data : { message: 'No banners found.' };
        }
        if (toolName === 'search_referrals') {
            const { data } = await supabase.from('referrals').select('id, referrer:profiles(full_name, phone), referred:profiles(full_name), reward_amount, status, created_at').limit(5);
            let results = data;
            if (args.query && data) {
                results = data.filter(d => d.referrer?.phone?.includes(args.query) || d.referrer?.full_name?.toLowerCase().includes(args.query.toLowerCase()));
            }
            return results && results.length ? results : { message: 'No referrals found matching the user.' };
        }
    } catch (e) {
        return { error: 'Tool execution failed: ' + e.message };
    }
    return { error: 'Unknown tool.' };
}

// ─────────────────────────────────────────────
// Model auto-discovery for Gemini
// ─────────────────────────────────────────────
async function getBestGeminiModel(apiKey) {
    try {
        for (const version of ['v1beta', 'v1']) {
            const url = `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) continue;
            const data = await response.json();
            const models = (data.models || []).filter(m =>
                m.supportedGenerationMethods?.includes('generateContent') &&
                m.name?.toLowerCase().includes('gemini')
            );
            if (models.length > 0) {
                const best =
                    models.find(m => m.name.includes('flash')) ||
                    models.find(m => m.name.includes('pro')) ||
                    models[0];
                const modelId = best.name.replace('models/', '');
                console.log(`[AdminAI] Using model: ${modelId} (${version})`);
                return { modelId, version };
            }
        }
    } catch (err) {
        throw new Error('Network connection failed. Please check your internet connection.');
    }
    throw new Error('No Gemini models found for this API Key. Verify the key has Gemini API access enabled.');
}

// ─────────────────────────────────────────────
// Fetch comprehensive platform data
// ─────────────────────────────────────────────
export async function fetchAdminPlatformContext() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        const [
            { data: rpcStats },
            { data: pendingVendors },
            { data: recentOrders },
            { data: lowStock },
            { data: openTickets },
            { data: activeCoupons },
            { data: flashSales },
            { data: pendingPayouts },
            { data: openDisputes },
            { data: recentBroadcasts },
            { data: todayOrders },
            { data: abandonedCarts },
        ] = await Promise.all([
            supabase.rpc('get_admin_dashboard_stats').maybeSingle(),
            supabase.from('vendor_applications').select('id, store_name, status, created_at').eq('status', 'pending').limit(10),
            supabase.from('orders').select('id, status, total_amount, created_at, user:profiles(full_name)').order('created_at', { ascending: false }).limit(8),
            supabase.from('products').select('id, name, stock_quantity, price, category').lt('stock_quantity', 10).eq('status', 'approved').order('stock_quantity').limit(10),
            supabase.from('support_tickets').select('id, subject, status, category, created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(8),
            supabase.from('coupons').select('id, code, discount_type, discount_value, usage_count, expires_at').eq('is_active', true).limit(5),
            supabase.from('flash_sales').select('id, title, start_time, end_time, discount_percentage').gte('end_time', new Date().toISOString()).limit(5),
            supabase.from('payouts').select('id, amount, status, vendor_id').eq('status', 'pending').limit(10),
            supabase.from('disputes').select('id, reason, status, created_at').eq('status', 'open').limit(5),
            supabase.from('broadcasts').select('id, title, created_at').order('created_at', { ascending: false }).limit(3),
            supabase.from('orders').select('id, total_amount, status').gte('created_at', today).limit(50),
            supabase.from('abandoned_carts').select('id').gte('created_at', weekAgo).limit(1),
        ]);

        const todayRevenue = (todayOrders || []).filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount || 0), 0);
        const pendingOrdersCount = (todayOrders || []).filter(o => o.status === 'pending').length;

        return {
            stats: {
                users: rpcStats?.user_count || 0,
                vendors: rpcStats?.vendor_count || 0,
                revenue: rpcStats?.total_revenue || 0,
                pendingOrders: rpcStats?.pending_orders_count || 0,
                todayRevenue,
                todayOrders: todayOrders?.length || 0,
            },
            pendingVendors: pendingVendors || [],
            recentOrders: recentOrders || [],
            lowStock: lowStock || [],
            openTickets: openTickets || [],
            activeCoupons: activeCoupons || [],
            activeFlashSales: flashSales || [],
            pendingPayouts: pendingPayouts || [],
            openDisputes: openDisputes || [],
            recentBroadcasts: recentBroadcasts || [],
            abandonedCartsThisWeek: abandonedCarts?.length || 0,
        };
    } catch (e) {
        console.log('[AdminAI] Context fetch error:', e.message);
        return {};
    }
}

// ─────────────────────────────────────────────
// Build system prompt from live context
// ─────────────────────────────────────────────
function buildAdminSystemPrompt(ctx, followUpLang) {
    const d = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const { stats = {}, pendingVendors = [], recentOrders = [], lowStock = [], openTickets = [], activeCoupons = [], activeFlashSales = [], pendingPayouts = [], openDisputes = [], recentBroadcasts = [], abandonedCartsThisWeek = 0 } = ctx;

    let prompt = `You are a highly intelligent, professional AI Admin Assistant for Abu-Mafhal Marketplace, operating on ${d}.
You have FULL access to the platform's operational data. Be concise, factual, and actionable.
IMPORTANT: Use ONLY the data below OR use your provided TOOLS to answer questions. 
If a user asks about a specific user, order, product, vendor, support ticket, or payout that is not in the live data, YOU MUST USE THE APPROPRIATE TOOL to search for it. Do NOT say "I don't have that data" until you have actually executed a tool search and found nothing.

SECURITY: You must NEVER reveal user passwords, full payment card numbers, or any personal data beyond what's needed for admin operations.

LANGUAGE RULE: Detect the user's language and ALWAYS respond in the same language. English → English. Hausa → Hausa.

═══ LIVE PLATFORM DATA (${d}) ═══

📊 OVERVIEW:
• Total Users: ${stats.users || 0}
• Active Vendors: ${stats.vendors || 0}
• All-Time Revenue: ₦${(stats.revenue || 0).toLocaleString()}
• Today's Revenue: ₦${(stats.todayRevenue || 0).toLocaleString()}
• Today's Orders: ${stats.todayOrders || 0}
• Pending Orders: ${stats.pendingOrders || 0}`;

    if (pendingVendors.length) {
        prompt += `\n\n🏪 PENDING VENDOR APPLICATIONS (${pendingVendors.length}):\n`;
        pendingVendors.slice(0, 5).forEach(v => { prompt += `• ${v.store_name} — applied ${new Date(v.created_at).toLocaleDateString()}\n`; });
    }

    if (lowStock.length) {
        prompt += `\n\n📉 LOW STOCK PRODUCTS (${lowStock.length} items < 10 units):\n`;
        lowStock.slice(0, 5).forEach(p => { prompt += `• ${p.name} — ${p.stock_quantity} left (₦${p.price?.toLocaleString()}, ${p.category})\n`; });
    }

    if (recentOrders.length) {
        prompt += `\n\n📦 RECENT ORDERS:\n`;
        recentOrders.slice(0, 5).forEach(o => { prompt += `• #${o.id?.slice(0, 8).toUpperCase()} | ${o.status} | ₦${o.total_amount?.toLocaleString()} | ${o.user?.full_name || 'Unknown'}\n`; });
    }

    if (openTickets.length) {
        prompt += `\n\n🎫 OPEN SUPPORT TICKETS (${openTickets.length}):\n`;
        openTickets.slice(0, 4).forEach(t => { prompt += `• "${t.subject}" [${t.category}]\n`; });
    }

    if (activeCoupons.length) {
        prompt += `\n\n🎟️ ACTIVE COUPONS:\n`;
        activeCoupons.forEach(c => { prompt += `• ${c.code} — ${c.discount_value}${c.discount_type === 'percentage' ? '%' : '₦'} off, used ${c.usage_count} times\n`; });
    }

    if (activeFlashSales.length) {
        prompt += `\n\n⚡ ACTIVE FLASH SALES:\n`;
        activeFlashSales.forEach(f => { prompt += `• ${f.title} — ${f.discount_percentage}% off, ends ${new Date(f.end_time).toLocaleDateString()}\n`; });
    }

    if (pendingPayouts.length) {
        prompt += `\n\n💸 PENDING PAYOUTS: ${pendingPayouts.length} requests pending\n`;
    }

    if (openDisputes.length) {
        prompt += `\n\n⚠️ OPEN DISPUTES: ${openDisputes.length} open\n`;
        openDisputes.slice(0, 3).forEach(d => { prompt += `• "${d.reason}" — opened ${new Date(d.created_at).toLocaleDateString()}\n`; });
    }

    if (recentBroadcasts.length) {
        prompt += `\n\n📢 RECENT BROADCASTS:\n`;
        recentBroadcasts.forEach(b => { prompt += `• "${b.title}" — ${new Date(b.created_at).toLocaleDateString()}\n`; });
    }

    if (abandonedCartsThisWeek)
        prompt += `\n\n🛒 ABANDONED CARTS THIS WEEK: ${abandonedCartsThisWeek}\n`;

    prompt += `\n\n═══════════════════════════════

After your response, append on a new line EXACTLY: FOLLOW_UP: <q1> | <q2> | <q3> (3 brief follow-up questions in the same language). Do NOT skip this.`;

    return prompt;
}

// ─────────────────────────────────────────────
// Core API callers
// ─────────────────────────────────────────────
async function callGemini(prompt, history, apiKey, systemPrompt, platformContext, imageBase64, imageMimeType) {
    const { modelId, version } = await getBestGeminiModel(apiKey);
    const url = `https://generativelanguage.googleapis.com/${version}/models/${modelId}:generateContent?key=${apiKey}`;

    // Convert tools for Gemini format
    const geminiTools = [{ functionDeclarations: adminTools }];

    let userParts = [{ text: prompt }];
    if (imageBase64 && imageMimeType) {
        userParts.push({ inlineData: { data: imageBase64, mimeType: imageMimeType } });
    }

    let historyContents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood.' }] },
        ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        { role: 'user', parts: userParts },
    ];

    const body = {
        contents: historyContents,
        tools: geminiTools,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
    };

    let response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini error');

    const firstCandidate = data.candidates?.[0];
    const functionCall = firstCandidate?.content?.parts?.find(p => p.functionCall)?.functionCall;

    // Handle Function Call Recursion
    if (functionCall) {
        const toolName = functionCall.name;
        const toolArgs = functionCall.args;
        const toolResult = await executeToolCall(toolName, toolArgs, platformContext);

        // Append function call block and result block to history
        historyContents.push(firstCandidate.content);
        historyContents.push({
            role: 'user',
            parts: [{
                functionResponse: {
                    name: toolName,
                    response: { name: toolName, content: toolResult }
                }
            }]
        });

        const followupBody = { contents: historyContents, tools: geminiTools, generationConfig: body.generationConfig };
        const followResponse = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(followupBody) });
        const followData = await followResponse.json();
        return followData.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || '';
    }

    return firstCandidate?.content?.parts?.find(p => p.text)?.text || '';
}

async function callOpenAI(prompt, history, apiKey, systemPrompt, platformContext, imageBase64, imageMimeType) {
    let userContent = prompt;
    if (imageBase64 && imageMimeType) {
        userContent = [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } }
        ];
    }

    let messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        { role: 'user', content: userContent }
    ];

    const openaiTools = adminTools.map(t => ({ type: 'function', function: t }));

    let response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, tools: openaiTools, temperature: 0.7, max_tokens: 1200 })
    });
    let data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI error');

    const choice = data.choices?.[0];

    // Handle Function Call Recursion
    if (choice?.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        messages.push(choice.message);
        for (const toolCall of choice.message.tool_calls) {
            const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
            const toolResult = await executeToolCall(toolCall.function.name, toolArgs, platformContext);
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify(toolResult)
            });
        }

        const followResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'gpt-4o-mini', messages })
        });
        const followData = await followResponse.json();
        return followData.choices?.[0]?.message?.content || '';
    }

    return choice?.message?.content || '';
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────
export const AdminAIService = {
    async generateResponse({ prompt, history = [], provider = 'gemini', geminiKey, openaiKey, platformContext = {}, imageBase64, imageMimeType }) {
        let systemPrompt = '';
        try {
            systemPrompt = buildAdminSystemPrompt(platformContext);
        } catch (e) {
            console.log('[AdminAI] Context Error:', e);
        }

        try {
            if (provider === 'gemini' && !geminiKey) throw new Error('Gemini API Key not configured. Go to Admin Settings.');
            if (provider === 'openai' && !openaiKey) throw new Error('OpenAI API Key not configured. Go to Admin Settings.');

            let rawText = '';

            if (provider === 'gemini') {
                try {
                    rawText = await callGemini(prompt, history, geminiKey, systemPrompt, platformContext, imageBase64, imageMimeType);
                } catch (gemErr) {
                    const em = (gemErr.message || '').toLowerCase();
                    if (em.includes('quota') || em.includes('429') || em.includes('exceeded')) {
                        console.log('[AdminAI] Gemini Quota Exceeded. Attempting OpenAI Fallback...');
                        if (openaiKey) {
                            rawText = await callOpenAI(prompt, history, openaiKey, systemPrompt, platformContext, imageBase64, imageMimeType);
                        } else {
                            throw new Error('Gemini Free limit reached. Please wait a minute, or configure OpenAI API Key in Settings for automatic backup.');
                        }
                    } else {
                        throw gemErr;
                    }
                }
            } else {
                rawText = await callOpenAI(prompt, history, openaiKey, systemPrompt, platformContext, imageBase64, imageMimeType);
            }

            const suggMatch = rawText.match(/FOLLOW_UP:\s*(.+)/);
            const suggestions = suggMatch ? suggMatch[1].split('|').map(s => s.trim()).filter(Boolean).slice(0, 3) : [];
            const text = rawText.replace(/FOLLOW_UP:.*$/m, '').trim();
            return { text, suggestions };
        } catch (error) {
            console.log('[AdminAI] Error:', error.message);
            throw new Error(error.message || 'AI service failed. Please try again.');
        }
    },
};
