import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

/**
 * Vendor API Key Authenticator (Supports both Live & Test keys)
 */
async function authenticateApiKey(supabase, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return null;
    const cleanKey = apiKey.trim();
    if (!cleanKey.startsWith('abumafhal_') && !cleanKey.startsWith('am_live_') && !cleanKey.startsWith('am_test_')) {
        return null;
    }

    const isTestKey = cleanKey.includes('_test_');

    // 1. Check vendor_api_keys table
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

    // 2. Check app_settings fallback
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Extract API Key
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
            message: 'Unauthorized: Missing API Key. Provide via "x-api-key" header.'
        });
    }

    const authResult = await authenticateApiKey(supabase, providedKey);
    if (!authResult) {
        return res.status(403).json({
            status: 'error',
            code: 403,
            message: 'Forbidden: Invalid or inactive API Key.'
        });
    }

    // ─── GET: Verify Payment Status / Order ─────────────────────────────
    if (req.method === 'GET') {
        const { reference, order_id } = req.query;

        if (!reference && !order_id) {
            return res.status(400).json({
                status: 'error',
                code: 400,
                message: 'Missing reference or order_id query parameter.'
            });
        }

        try {
            let orderQuery = supabase
                .from('orders')
                .select('*');

            if (reference) {
                orderQuery = orderQuery.eq('payment_reference', reference);
            } else if (order_id) {
                orderQuery = orderQuery.eq('id', order_id);
            }

            const { data: order, error: orderErr } = await orderQuery.maybeSingle();

            if (orderErr || !order) {
                return res.status(404).json({
                    status: 'error',
                    code: 404,
                    message: 'Payment record or order not found.'
                });
            }

            return res.status(200).json({
                status: 'success',
                code: 200,
                mode: authResult.is_test ? 'test' : 'live',
                payment: {
                    reference: order.payment_reference,
                    order_id: order.id,
                    amount: order.total || order.amount,
                    currency: 'NGN',
                    currency_symbol: '₦',
                    status: order.payment_status || 'paid',
                    customer_email: order.customer_email || order.shipping_address?.email,
                    paid_at: order.created_at,
                    channel: order.payment_method || 'paystack'
                }
            });
        } catch (err) {
            return res.status(500).json({
                status: 'error',
                code: 500,
                message: 'Error verifying payment',
                error: err.message
            });
        }
    }

    // ─── POST: Initialize Checkout / Payment Session ───────────────────
    if (req.method === 'POST') {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (_) { body = {}; }
        }

        const { amount, customer_email, customer_name, callback_url, items, metadata } = body;

        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({
                status: 'error',
                code: 400,
                message: 'Invalid or missing amount in NGN.'
            });
        }

        if (!customer_email) {
            return res.status(400).json({
                status: 'error',
                code: 400,
                message: 'customer_email is required.'
            });
        }

        const refPrefix = authResult.is_test ? 'AM_TEST_' : 'AM_PAY_';
        const reference = `${refPrefix}${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // Return initialized payment details with official Abu Mafhal Checkout URL
        const checkoutUrl = `https://www.abumafhal.com/checkout?reference=${reference}&amount=${numAmount}&vendor=${authResult.vendor_id}&mode=${authResult.key_type}`;

        return res.status(200).json({
            status: 'success',
            code: 200,
            mode: authResult.is_test ? 'test' : 'live',
            message: 'Payment session created successfully.',
            data: {
                reference: reference,
                amount: numAmount,
                currency: 'NGN',
                currency_symbol: '₦',
                checkout_url: checkoutUrl,
                paystack_public_key: 'pk_live_abumafhal_marketplace',
                vendor: {
                    id: authResult.vendor_id,
                    name: authResult.vendor_name
                },
                metadata: metadata || {}
            }
        });
    }

    return res.status(405).json({
        status: 'error',
        code: 405,
        message: `Method ${req.method} not allowed.`
    });
}
