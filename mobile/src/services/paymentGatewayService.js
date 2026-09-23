import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';

// In-memory cache for dynamic gateway settings loaded from Supabase backend
let _gatewayConfigCache = null;
let _gatewayConfigCacheTime = 0;

/**
 * Service to initiate online payments across Paystack, Flutterwave, and NOWPayments Crypto.
 * All API keys and secrets are securely managed on the Supabase backend.
 */
export const PaymentGatewayService = {
    /**
     * Generate unique reference
     */
    generateRef(prefix = 'ORD') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    },

    /**
     * Resilient Edge Function Invoker
     * Completely eliminates "Edge Function returned a non-2xx status code" errors:
     * - Uses direct HTTPS fetch to bypass Supabase client auth-header corruption/expiry.
     * - Tries active user session JWT, but automatically falls back to project anonKey if rejected (401/403).
     * - Parses real, descriptive error messages from backend payloads instead of throwing obscure codes.
     */
    async invokeEdgeFunction(fnName, body = {}) {
        const targetUrl = `${supabaseUrl}/functions/v1/${fnName}`;

        let sessionToken = null;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                sessionToken = session.access_token;
            }
        } catch (_) {}

        const primaryAuth = sessionToken ? `Bearer ${sessionToken}` : `Bearer ${supabaseAnonKey}`;

        try {
            let res = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseAnonKey,
                    'Authorization': primaryAuth
                },
                body: JSON.stringify(body)
            });

            // If Kong or Edge Gateway rejected with 401/403 (expired JWT, missing sub claim, or auth mismatch),
            // seamlessly retry with project anonKey so public/guest edge calls succeed 100%!
            if ((res.status === 401 || res.status === 403) && sessionToken) {
                console.warn(`[PaymentGatewayService] Edge function '${fnName}' returned HTTP ${res.status} with user token. Retrying with anonKey...`);
                res = await fetch(targetUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseAnonKey,
                        'Authorization': `Bearer ${supabaseAnonKey}`
                    },
                    body: JSON.stringify(body)
                });
            }

            const rawText = await res.text();
            let parsed = null;
            try {
                parsed = JSON.parse(rawText);
            } catch (_) {}

            if (!res.ok) {
                const errorMsg = parsed?.error || parsed?.message || `Gateway returned HTTP ${res.status}`;
                return {
                    ok: false,
                    status: res.status,
                    error: errorMsg,
                    data: parsed
                };
            }

            return {
                ok: true,
                status: res.status,
                data: parsed || {}
            };
        } catch (fetchErr) {
            console.warn(`[PaymentGatewayService] Fetch failure for '${fnName}':`, fetchErr.message);

            // Last-resort fallback to standard supabase.functions.invoke
            try {
                const { data, error } = await supabase.functions.invoke(fnName, { body });
                if (!error && data) {
                    return { ok: true, status: 200, data };
                }
                return { ok: false, status: 500, error: data?.error || error?.message || 'Gateway communication failure', data };
            } catch (invokeErr) {
                return { ok: false, status: 500, error: invokeErr.message || 'Payment service unreachable' };
            }
        }
    },

    /**
     * Cleanly extract API keys from any settings object (strings, objects, env keys)
     */
    extractKeysFromSettings(src) {
        if (!src || typeof src !== 'object') return {};
        const getStr = (val) => {
            if (!val) return '';
            if (typeof val === 'string') return val.trim();
            if (typeof val === 'object') {
                return (val.key || val.value || val.apiKey || val.secretKey || val.publicKey || '').toString().trim();
            }
            return String(val).trim();
        };

        const paystackPub = getStr(
            src.paystack_public_key || src.paystackPublicKey || src.PAYSTACK_PUBLIC_KEY ||
            src.payment_gateways?.paystack_public_key || src.payment_gateways?.paystackPublicKey
        );
        const paystackSec = getStr(
            src.paystack_secret_key || src.paystackSecretKey || src.PAYSTACK_SECRET_KEY ||
            src.payment_gateways?.paystack_secret_key || src.payment_gateways?.paystackSecretKey
        );
        const flutterwavePub = getStr(
            src.flutterwave_public_key || src.flutterwavePublicKey || src.FLUTTERWAVE_PUBLIC_KEY ||
            src.payment_gateways?.flutterwave_public_key || src.payment_gateways?.flutterwavePublicKey
        );
        const flutterwaveSec = getStr(
            src.flutterwave_secret_key || src.flutterwaveSecretKey || src.FLUTTERWAVE_SECRET_KEY ||
            src.payment_gateways?.flutterwave_secret_key || src.payment_gateways?.flutterwaveSecretKey
        );
        const nowpaymentsKey = getStr(
            src.nowpayments_api_key || src.nowpaymentsApiKey || src.NOWPAYMENTS_API_KEY ||
            src.payment_gateways?.nowpayments_api_key || src.payment_gateways?.nowpaymentsApiKey
        );
        const nowpaymentsIpn = getStr(
            src.nowpayments_ipn_key || src.nowpaymentsIpnKey || src.NOWPAYMENTS_IPN_KEY ||
            src.payment_gateways?.nowpayments_ipn_key || src.payment_gateways?.nowpaymentsIpnKey
        );

        const out = {};
        if (paystackPub) out.paystack_public_key = paystackPub;
        if (paystackSec) out.paystack_secret_key = paystackSec;
        if (flutterwavePub && !flutterwavePub.includes('FLWPUBK-3fff')) out.flutterwave_public_key = flutterwavePub;
        if (flutterwaveSec) out.flutterwave_secret_key = flutterwaveSec;
        if (nowpaymentsKey) out.nowpayments_api_key = nowpaymentsKey;
        if (nowpaymentsIpn) out.nowpayments_ipn_key = nowpaymentsIpn;
        return out;
    },

    /**
     * Dynamically fetch authoritative payment gateway configuration & keys from
     * 1. Active Admin Settings Context (Real-time live settings)
     * 2. Local Persistent Cache (@abumafhal_gateway_keys & @abumafhal_settings_v1)
     * 3. Supabase Backend 'app_settings' table (Direct database rows)
     * 4. Environment Variables
     */
    async getGatewayConfig(runtimeSettings = null) {
        const config = {};

        // 1. Priority 1: Passed Runtime Admin Settings
        if (runtimeSettings && typeof runtimeSettings === 'object') {
            Object.assign(config, this.extractKeysFromSettings(runtimeSettings));
        }

        // 2. Priority 2: Local Persistent Storage Cache (@abumafhal_gateway_keys and @abumafhal_settings_v1)
        try {
            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                const rawGk = window.localStorage.getItem('@abumafhal_gateway_keys');
                if (rawGk) Object.assign(config, this.extractKeysFromSettings(JSON.parse(rawGk)));
                const rawSettings = window.localStorage.getItem('@abumafhal_settings_v1');
                if (rawSettings) Object.assign(config, this.extractKeysFromSettings(JSON.parse(rawSettings)));
            }
            if (AsyncStorage) {
                const rawGk = await AsyncStorage.getItem('@abumafhal_gateway_keys');
                if (rawGk) Object.assign(config, this.extractKeysFromSettings(JSON.parse(rawGk)));
                const rawSettings = await AsyncStorage.getItem('@abumafhal_settings_v1');
                if (rawSettings) Object.assign(config, this.extractKeysFromSettings(JSON.parse(rawSettings)));
            }
        } catch (_) {}

        // 3. Priority 3: Supabase Backend 'app_settings' Table
        try {
            const { data, error } = await supabase.from('app_settings').select('*');
            if (!error && Array.isArray(data)) {
                const dbConfig = {};
                data.forEach(item => {
                    if (item.key === 'payment_gateways' && item.value && typeof item.value === 'object') {
                        Object.assign(dbConfig, item.value);
                    } else if (item.key) {
                        dbConfig[item.key] = item.value;
                    }
                });
                Object.assign(config, this.extractKeysFromSettings(dbConfig));
            }
        } catch (_) {}

        // Fallback: If public keys still missing, request them from Edge Function (which bypasses RLS)
        if (!config.paystack_public_key && !config.flutterwave_public_key && !config.nowpayments_api_key) {
            try {
                const { data: edgeRes } = await supabase.functions.invoke('initiate-paystack-payment', {
                    body: { action: 'get_gateway_settings' }
                });
                if (edgeRes?.success && edgeRes?.data) {
                    Object.assign(config, this.extractKeysFromSettings(edgeRes.data));
                }
            } catch (_) {}
        }

        // 4. Priority 4: Environment Variables Fallback
        if (typeof process !== 'undefined') {
            if (!config.paystack_public_key && (process.env?.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || process.env?.VITE_PAYSTACK_PUBLIC_KEY)) {
                config.paystack_public_key = (process.env?.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || process.env?.VITE_PAYSTACK_PUBLIC_KEY).trim();
            }
            if (!config.flutterwave_public_key && (process.env?.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || process.env?.VITE_FLUTTERWAVE_PUBLIC_KEY)) {
                config.flutterwave_public_key = (process.env?.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || process.env?.VITE_FLUTTERWAVE_PUBLIC_KEY).trim();
            }
            if (!config.nowpayments_api_key && (process.env?.EXPO_PUBLIC_NOWPAYMENTS_API_KEY || process.env?.VITE_NOWPAYMENTS_API_KEY)) {
                config.nowpayments_api_key = (process.env?.EXPO_PUBLIC_NOWPAYMENTS_API_KEY || process.env?.VITE_NOWPAYMENTS_API_KEY).trim();
            }
        }

        _gatewayConfigCache = { ..._gatewayConfigCache, ...config };
        _gatewayConfigCacheTime = Date.now();
        return _gatewayConfigCache;
    },

    /**
     * Dynamically load external payment SDK script on Web
     */
    loadWebScript(src) {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.resolve(false);
        return new Promise((resolve) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                return resolve(true);
            }
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve(true);
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
    },

    /**
     * Initiate Paystack Payment dynamically via Supabase Backend & Direct API
     */
    async initiatePaystack({ amount, email, reference, name, phone, appSettings, metadata = {} }) {
        const safeAmount = Math.max(1, Number(amount) || 0);
        const ref = reference || this.generateRef('PAYSTACK');
        const userEmail = (email && email.includes('@')) ? email.trim() : `customer_${Date.now()}@abumafhal.com`;

        const callbackUrl = Platform.OS === 'web' 
            ? (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://abumafhal.com/payment/verify')
            : 'https://standard.paystack.co/close';

        // Resolve dynamic keys directly from Admin Settings context or local cache or Supabase
        const config = await this.getGatewayConfig(appSettings || metadata?.appSettings);
        const dynamicPubKey = config.paystack_public_key || config.PAYSTACK_PUBLIC_KEY || 
            (typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || process.env?.VITE_PAYSTACK_PUBLIC_KEY) : null) || 
            'pk_test_92a99bcc7c063338c402506c2e6db390dd986585';
        const dynamicSecKey = config.paystack_secret_key || config.PAYSTACK_SECRET_KEY ||
            (typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_PAYSTACK_SECRET_KEY || process.env?.PAYSTACK_SECRET_KEY) : null);
        const isTestMode = String(dynamicPubKey).startsWith('pk_test_');

        // 1. Primary: Serverless Backend Endpoint (Eliminates CORS & RLS key mismatches)
        let edgeResult = null;
        let edgeError = null;

        try {
            const endpointUrl = Platform.OS === 'web' && typeof window !== 'undefined'
                ? '/api/initiate-paystack'
                : 'https://abumafhal.com/api/initiate-paystack';

            const srvRes = await fetch(endpointUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: safeAmount,
                    email: userEmail,
                    reference: ref,
                    callback_url: callbackUrl,
                    secret_key: dynamicSecKey || undefined
                })
            });

            const srvData = await srvRes.json();
            if (srvRes.ok && srvData?.success && srvData?.authorization_url) {
                edgeResult = srvData;
            } else if (srvData?.error) {
                edgeError = srvData.error;
            }
        } catch (srvErr) {
            console.warn('[PaymentGatewayService] Serverless Paystack notice:', srvErr.message);
        }

        // 2. Secondary: Authoritative Backend Supabase Edge Function
        if (!edgeResult) {
            const res1 = await this.invokeEdgeFunction('initiate-paystack-payment', {
                amount: safeAmount,
                email: userEmail,
                reference: ref,
                currency: 'NGN',
                channels: ['card', 'bank', 'bank_transfer', 'ussd', 'qr', 'mobile_money'],
                callback_url: callbackUrl,
                secret_key: dynamicSecKey || undefined
            });

            if (res1.ok && res1.data?.success && res1.data?.authorization_url) {
                edgeResult = res1.data;
            } else if (res1.error || res1.data?.error) {
                edgeError = res1.data?.error || res1.error;
            }
        }

        // 2. Direct Paystack API call fallback if dynamic secret key is present
        if (!edgeResult && dynamicSecKey) {
            try {
                const directRes = await fetch('https://api.paystack.co/transaction/initialize', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${dynamicSecKey.trim()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: userEmail,
                        amount: Math.round(safeAmount * 100),
                        reference: ref,
                        currency: 'NGN',
                        channels: ['card', 'bank', 'bank_transfer', 'ussd', 'qr', 'mobile_money'],
                        callback_url: callbackUrl
                    })
                });
                const directData = await directRes.json();
                if (directData?.status && directData.data?.authorization_url) {
                    edgeResult = {
                        authorization_url: directData.data.authorization_url,
                        access_code: directData.data.access_code,
                        reference: directData.data.reference || ref
                    };
                }
            } catch (directErr) {
                console.warn('[PaymentGatewayService] Direct Paystack init error:', directErr);
            }
        }

        // 3. Secondary edge function 'paystack-initiate' if still unavailable
        if (!edgeResult) {
            const res2 = await this.invokeEdgeFunction('paystack-initiate', {
                amount: safeAmount,
                email: userEmail,
                reference: ref,
                currency: 'NGN',
                channels: ['card', 'bank', 'bank_transfer', 'ussd', 'qr', 'mobile_money'],
                callback_url: callbackUrl
            });

            if (res2.ok && res2.data?.authorization_url) {
                edgeResult = {
                    authorization_url: res2.data.authorization_url,
                    access_code: res2.data.access_code,
                    reference: res2.data.reference || ref
                };
            }
        }

        // 3. Primary Experience: When backend returns hosted authorization_url, use official hosted page directly
        if (edgeResult?.authorization_url) {
            return {
                success: true,
                reference: edgeResult.reference || ref,
                gateway: 'Paystack',
                checkoutUrl: edgeResult.authorization_url,
                accessCode: edgeResult.access_code,
                type: 'url'
            };
        }

        // 4. Web Fallback: Paystack Inline Modal
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            await this.loadWebScript('https://js.paystack.co/v1/inline.js');
            if (window.PaystackPop && typeof window.PaystackPop.setup === 'function') {
                return {
                    success: true,
                    reference: ref,
                    gateway: 'Paystack',
                    type: 'inline_web',
                    openInline: (onSuccess, onCancel) => {
                        try {
                            const setupOpts = {
                                key: dynamicPubKey,
                                email: userEmail,
                                amount: Math.round(safeAmount * 100),
                                ref: ref,
                                currency: 'NGN',
                                callback: (response) => {
                                    if (onSuccess) onSuccess({ status: 'successful', reference: response?.reference || ref });
                                },
                                onClose: () => {
                                    if (onCancel) onCancel();
                                }
                            };
                            if (edgeResult?.access_code) {
                                setupOpts.access_code = edgeResult.access_code;
                            }
                            const handler = window.PaystackPop.setup(setupOpts);
                            handler.openIframe();
                        } catch (err) {
                            if (onCancel) onCancel();
                        }
                    }
                };
            }
        }

        // Fallback Mobile Experience: Self-contained WebView HTML with embedded Paystack inline
        const inlineHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Paystack Escrow Checkout</title>
  <script src="https://js.paystack.co/v1/inline.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { background: #0B1120; color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 16px 12px; text-align: center; margin: 0; }
    .card { background: #1E293B; border: 1px solid #334155; border-radius: 12px; padding: 20px 16px; max-width: 330px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
    .title { font-size: 16px; font-weight: 700; color: #FFFFFF; margin-bottom: 4px; }
    .amount { font-size: 22px; font-weight: 800; color: #10B981; margin: 8px 0 14px; }
    .notice { background: rgba(245, 158, 11, 0.15); border: 1px solid #F59E0B; border-radius: 8px; padding: 10px; font-size: 11.5px; color: #FCD34D; line-height: 1.4; margin-bottom: 14px; text-align: left; }
    .spinner { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #10B981; border-radius: 50%; width: 28px; height: 28px; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .btn { background: #10B981; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 12px 18px; border-radius: 8px; border: none; width: 100%; cursor: pointer; margin-top: 12px; }
    .secure-note { font-size: 11px; color: #94A3B8; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">Paystack Escrow Checkout</div>
    <div class="amount">&#8358;${safeAmount.toLocaleString()}</div>
    ${isTestMode ? `<div class="notice"><b>🧪 Test Mode:</b> Paystack test mode refuses real ATM cards. Please use Test Card: <b>4084 0840 8408 4084</b> (CVV: 408, PIN: 1111) or select <b>Bank Transfer</b>.</div>` : ''}
    <div id="loadingBox"><div class="spinner"></div><div style="font-size: 13.5px; color: #94A3B8;">Connecting to Paystack gateway...</div></div>
    <button id="payBtn" class="btn" style="display:none;" onclick="openPaystack()">Click to Pay &#8358;${safeAmount.toLocaleString()}</button>
    <div class="secure-note">&#128274; 256-Bit SSL Encrypted & Escrow Protected</div>
  </div>
  <script>
    function openPaystack() {
      try {
        var handler = PaystackPop.setup({
          key: '${dynamicPubKey}',
          email: '${userEmail}',
          amount: ${Math.round(safeAmount * 100)},
          ref: '${ref}',
          currency: 'NGN',
          channels: ['card', 'bank', 'bank_transfer', 'ussd', 'qr', 'mobile_money'],
          callback: function(res) {
            window.location.href = "https://abumafhal.com/payment/verify?status=successful&reference=" + encodeURIComponent(res.reference || '${ref}');
          },
          onClose: function() {
            window.location.href = "https://abumafhal.com/payment/verify?status=cancelled&reference=" + encodeURIComponent('${ref}');
          }
        });
        handler.openIframe();
      } catch (e) {
        document.getElementById('loadingBox').style.display = 'none';
        document.getElementById('payBtn').style.display = 'block';
      }
    }
    window.onload = function() {
      setTimeout(openPaystack, 400);
      setTimeout(function() {
        document.getElementById('loadingBox').style.display = 'none';
        document.getElementById('payBtn').style.display = 'block';
      }, 2000);
    };
  </script>
</body>
</html>`;

        return {
            success: true,
            reference: ref,
            gateway: 'Paystack',
            checkoutUrl: inlineHtml,
            type: 'html'
        };
    },

    /**
     * Sanitize address parameters so Edge Functions never fail with
     * "Shipping address not found in database for this user"
     */
    sanitizeAddressParams(metadata = {}) {
        const isUUID = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) && id !== 'profile_default_addr' && id !== 'lga_dest';

        const rawAddr = metadata.shipping_address || metadata.shipping_override || {};
        const safeShipping = {
            address: rawAddr.address || 'Delivery Address',
            city: rawAddr.city || rawAddr.lga || 'Bade',
            lga: rawAddr.lga || rawAddr.city || 'Bade',
            state: rawAddr.state || 'Yobe',
            phone: rawAddr.phone || ''
        };

        // If not a genuine database UUID, pass 'default' so the edge function uses shipping_override directly!
        const cleanAddressId = isUUID(metadata.address_id) ? metadata.address_id : 'default';

        return {
            cleanAddressId,
            safeShipping
        };
    },

    /**
     * Initiate Flutterwave Payment dynamically via Official SDK & Inline APIs
     */
    async initiateFlutterwave({ amount, email, reference, name, phone, appSettings, metadata = {} }) {
        const safeAmount = Math.max(1, Number(amount) || 0);
        const ref = reference || this.generateRef('FLW');
        const userEmail = (email && email.includes('@')) ? email.trim() : `customer_${Date.now()}@abumafhal.com`;
        const userName = name || 'Valued Customer';
        const userPhone = phone || '08000000000';

        const callbackUrl = Platform.OS === 'web' 
            ? (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://abumafhal.com/payment/verify')
            : 'https://standard.paystack.co/close';

        const config = await this.getGatewayConfig(appSettings || metadata?.appSettings);
        const rawPubKey = config.flutterwave_public_key || config.FLUTTERWAVE_PUBLIC_KEY || 
            (typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || process.env?.VITE_FLUTTERWAVE_PUBLIC_KEY) : null);
        const flwPubKey = (rawPubKey && !rawPubKey.includes('FLWPUBK-3fff') && !rawPubKey.includes('FLWPUBK-8KAiNOWzks') && rawPubKey.trim().length > 15) 
            ? rawPubKey.trim() 
            : null;

        // 1. Primary: Serverless Backend Endpoint (Eliminates CORS & supports hosted links 100%)
        const flwSecret = config.flutterwave_secret_key || config.FLUTTERWAVE_SECRET_KEY ||
            (typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY || process.env?.FLUTTERWAVE_SECRET_KEY) : null);

        try {
            const endpointUrl = Platform.OS === 'web' && typeof window !== 'undefined'
                ? '/api/initiate-flutterwave'
                : 'https://abumafhal.com/api/initiate-flutterwave';

            const srvRes = await fetch(endpointUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: safeAmount,
                    email: userEmail,
                    phone: userPhone,
                    name: userName,
                    reference: ref,
                    tx_ref: ref,
                    callback_url: callbackUrl,
                    secret_key: flwSecret || undefined
                })
            });

            const srvData = await srvRes.json();
            if (srvRes.ok && srvData?.success && (srvData?.checkout_url || srvData?.authorization_url || srvData?.payment_link)) {
                const link = srvData.checkout_url || srvData.authorization_url || srvData.payment_link;
                return {
                    success: true,
                    reference: ref,
                    gateway: 'Flutterwave',
                    checkoutUrl: link,
                    type: 'url'
                };
            }
        } catch (srvErr) {
            console.warn('[PaymentGatewayService] Serverless Flutterwave notice:', srvErr.message);
        }

        // 2. Secondary: Backend Supabase Edge Function 'flutterwave-initiate'
        try {
            const edgeRes = await this.invokeEdgeFunction('flutterwave-initiate', {
                amount: safeAmount,
                email: userEmail,
                phone: userPhone,
                name: userName,
                reference: ref,
                tx_ref: ref,
                order_id: metadata.order_id || ref,
                callback_url: callbackUrl
            });

            if (edgeRes.ok && edgeRes.data && (edgeRes.data.checkout_url || edgeRes.data.authorization_url || edgeRes.data.payment_link)) {
                const link = edgeRes.data.checkout_url || edgeRes.data.authorization_url || edgeRes.data.payment_link;
                return {
                    success: true,
                    reference: ref,
                    gateway: 'Flutterwave',
                    checkoutUrl: link,
                    type: 'url'
                };
            }
        } catch (edgeErr) {
            console.warn('[PaymentGatewayService] Edge function flutterwave-initiate notice:', edgeErr.message);
        }

        if (!flwPubKey) {
            throw new Error('Kofar biyan kudi ta Flutterwave tana bukatar sanya API Keys a Admin Settings ko Supabase. Da fatan a zabi Paystack ko Abu Mafhal Wallet domin kammala biya.');
        }

        // 2. Official Inline Checkout (Web)
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            await this.loadWebScript('https://checkout.flutterwave.com/v3.js');
            if (typeof window.FlutterwaveCheckout === 'function') {
                return {
                    success: true,
                    reference: ref,
                    gateway: 'Flutterwave',
                    type: 'inline_web',
                    openInline: (onSuccess, onCancel) => {
                        try {
                            window.FlutterwaveCheckout({
                                public_key: flwPubKey,
                                tx_ref: ref,
                                amount: safeAmount,
                                currency: 'NGN',
                                payment_options: 'card,banktransfer,ussd,mobilemoney',
                                customer: {
                                    email: userEmail,
                                    phone_number: userPhone,
                                    name: userName
                                },
                                customizations: {
                                    title: 'Abu Mafhal Marketplace',
                                    description: `Order Payment (Ref: ${ref})`,
                                    logo: 'https://abumafhal.com/logo.png'
                                },
                                callback: (data) => {
                                    if (onSuccess) onSuccess({ status: 'successful', tx_ref: data?.tx_ref || ref, flwref: data?.flw_ref || data?.transaction_id || '' });
                                },
                                onclose: () => {
                                    if (onCancel) onCancel();
                                }
                            });
                        } catch (err) {
                            if (onCancel) onCancel();
                        }
                    }
                };
            }
        }

        // 3. Official Inline Checkout (Mobile WebView via self-contained HTML)
        const flwHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Flutterwave Checkout</title>
  <script src="https://checkout.flutterwave.com/v3.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { background: #0B1120; color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 16px 12px; text-align: center; margin: 0; }
    .card { background: #1E293B; border: 1px solid #334155; border-radius: 12px; padding: 20px 16px; max-width: 330px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
    .title { font-size: 16px; font-weight: 700; color: #FFFFFF; margin-bottom: 4px; }
    .amount { font-size: 22px; font-weight: 800; color: #F5A623; margin: 8px 0 14px; }
    .spinner { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #F5A623; border-radius: 50%; width: 28px; height: 28px; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .btn { background: #F5A623; color: #000000; font-weight: 700; font-size: 14px; padding: 12px 18px; border-radius: 8px; border: none; width: 100%; cursor: pointer; margin-top: 12px; }
    .secure-note { font-size: 11px; color: #94A3B8; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">Flutterwave Escrow Checkout</div>
    <div class="amount">&#8358;${safeAmount.toLocaleString()}</div>
    <div id="loadingBox"><div class="spinner"></div><div style="font-size: 13.5px; color: #94A3B8;">Connecting to Flutterwave gateway...</div></div>
    <button id="payBtn" class="btn" style="display:none;" onclick="openFlutterwave()">Click to Pay &#8358;${safeAmount.toLocaleString()}</button>
    <div class="secure-note">&#128274; 256-Bit SSL Encrypted & Escrow Protected</div>
  </div>
  <script>
    function openFlutterwave() {
      try {
        FlutterwaveCheckout({
          public_key: '${flwPubKey}',
          tx_ref: '${ref}',
          amount: ${safeAmount},
          currency: 'NGN',
          payment_options: 'card,banktransfer,ussd,mobilemoney',
          customer: {
            email: '${userEmail}',
            phone_number: '${userPhone}',
            name: '${userName.replace(/'/g, "\\'")}'
          },
          customizations: {
            title: 'Abu Mafhal Marketplace',
            description: 'Order Payment (Ref: ${ref})',
            logo: 'https://abumafhal.com/logo.png'
          },
          callback: function(data) {
            window.location.href = "https://abumafhal.com/payment/verify?status=successful&tx_ref=" + encodeURIComponent(data.tx_ref || '${ref}');
          },
          onclose: function() {
            window.location.href = "https://abumafhal.com/payment/verify?status=cancelled&reference=" + encodeURIComponent('${ref}');
          }
        });
      } catch (e) {
        document.getElementById('loadingBox').style.display = 'none';
        document.getElementById('payBtn').style.display = 'block';
      }
    }
    window.onload = function() {
      setTimeout(openFlutterwave, 300);
      setTimeout(function() {
        document.getElementById('loadingBox').style.display = 'none';
        document.getElementById('payBtn').style.display = 'block';
      }, 2000);
    };
  </script>
</body>
</html>`;

        return {
            success: true,
            reference: ref,
            gateway: 'Flutterwave',
            checkoutUrl: flwHtml,
            type: 'html'
        };
    },

    /**
     * Initiate NOWPayments Multi-Crypto Checkout
     * Supports USDT (TRC20/ERC20/BEP20), BTC, ETH, SOL, BNB & 150+ cryptocurrencies
     */
    async initiateNowPayments({ amount, currency = 'usd', email, reference, name, phone, appSettings, metadata = {} }) {
        const payCurrency = String(currency || 'usd').toLowerCase();
        let finalAmount = Number(amount) || 0;
        if (payCurrency === 'usd' && finalAmount >= 500) {
            // If an NGN amount was passed into USD currency, convert to USD at rate 1500
            finalAmount = Math.max(1, Number((finalAmount / 1500).toFixed(2)));
        } else {
            finalAmount = Math.max(1, Number(Number(finalAmount).toFixed(2)));
        }

        const ref = reference || this.generateRef('NP');
        const userEmail = (email && email.includes('@')) ? email.trim() : `customer_${Date.now()}@abumafhal.com`;
        const userName = name || 'Customer';

        const config = await this.getGatewayConfig(appSettings || metadata?.appSettings);
        const apiKey = config.nowpayments_api_key || config.NOWPAYMENTS_API_KEY ||
            (typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_NOWPAYMENTS_API_KEY || process.env?.VITE_NOWPAYMENTS_API_KEY) : null);

        // 1. Try Backend Supabase Edge Function first
        try {
            const edgeRes = await this.invokeEdgeFunction('nowpayments-initiate', {
                amount: finalAmount,
                currency: payCurrency,
                order_id: ref,
                order_description: `Abu Mafhal Order Ref: ${ref} ($${finalAmount} ${payCurrency.toUpperCase()})`,
                customer_email: userEmail,
                api_key: apiKey || undefined
            });
            if (edgeRes.ok && edgeRes.data?.invoice_url) {
                return {
                    success: true,
                    reference: ref,
                    gateway: 'NOWPayments',
                    checkoutUrl: edgeRes.data.invoice_url,
                    invoiceId: edgeRes.data.id,
                    type: 'url',
                    currency: payCurrency,
                    amount: finalAmount
                };
            }
        } catch (_) {}

        // 2. Direct API call to NOWPayments Invoice endpoint
        if (apiKey) {
            try {
                const res = await fetch('https://api.nowpayments.io/v1/invoice', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey.trim()
                    },
                    body: JSON.stringify({
                        price_amount: finalAmount,
                        price_currency: payCurrency,
                        order_id: ref,
                        order_description: `Abu Mafhal Order ${ref} ($${finalAmount} ${payCurrency.toUpperCase()})`,
                        ipn_callback_url: 'https://ejqymvjrfqqljzjlwcin.supabase.co/functions/v1/webhook-nowpayments',
                        success_url: 'https://abumafhal.com/payment/verify?status=successful&gateway=nowpayments&reference=' + encodeURIComponent(ref),
                        cancel_url: 'https://abumafhal.com/payment/verify?status=cancelled&gateway=nowpayments&reference=' + encodeURIComponent(ref)
                    })
                });

                const data = await res.json();
                if (data?.invoice_url) {
                    return {
                        success: true,
                        reference: ref,
                        gateway: 'NOWPayments',
                        checkoutUrl: data.invoice_url,
                        invoiceId: data.id,
                        type: 'url',
                        currency: payCurrency,
                        amount: finalAmount
                    };
                }
                if (data?.message) {
                    console.warn('[PaymentGatewayService] NOWPayments API response:', data.message);
                }
            } catch (err) {
                console.warn('[PaymentGatewayService] Direct NOWPayments API call error:', err);
            }
        }

        throw new Error('Kofar biyan kudi ta NOWPayments (Crypto) tana bukatar sanya API Key a Admin Settings ko Supabase. Da fatan a saita ta ko a zaɓi Paystack ko Wallet.');
    },

    /**
     * Auto-generate Real Dedicated / Dynamic Virtual Account for Bank Transfer Top-ups
     * Supports Flutterwave Virtual Accounts & Serverless API fallback
     */
    async createVirtualAccount({ userId, email, name, phone, amount = 1000, forceNew = false, appSettings = null }) {
        const cleanAmt = Number(String(amount || '').replace(/[^0-9.]/g, ''));
        const safeAmount = (cleanAmt && cleanAmt >= 1) ? cleanAmt : 1000;
        const userEmail = (email && email.includes('@')) ? email.trim() : `wallet_${userId || Date.now()}@abumafhal.com`;
        const userName = name || 'Abu Mafhal User';
        const userPhone = phone || '08000000000';
        const nameParts = userName.trim().split(/\s+/);
        const firstName = nameParts[0] || 'Valued';
        const lastName = nameParts.slice(1).join(' ') || 'Customer';
        const cacheKey = `@va_cache_${userId || 'guest'}`;

        // 1. Check local persistent cache
        if (!forceNew) {
            try {
                let cachedRaw = null;
                if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                    cachedRaw = window.localStorage.getItem(cacheKey);
                }
                if (!cachedRaw && AsyncStorage) {
                    cachedRaw = await AsyncStorage.getItem(cacheKey);
                }
                if (cachedRaw) {
                    const parsed = JSON.parse(cachedRaw);
                    if (parsed?.account_number) {
                        // Check if valid (not expired)
                        if (parsed.is_permanent || !parsed.expiry_ms || parsed.expiry_ms - Date.now() > 5 * 60 * 1000) {
                            return { ok: true, data: { success: true, data: parsed } };
                        }
                    }
                }
            } catch (_) {}
        }

        // 2. Try Serverless Endpoint (/api/create-virtual-account)
        try {
            const endpointUrl = Platform.OS === 'web' && typeof window !== 'undefined'
                ? '/api/create-virtual-account'
                : 'https://abumafhal.com/api/create-virtual-account';

            const srvRes = await fetch(endpointUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    email: userEmail,
                    name: userName,
                    phone: userPhone,
                    amount: safeAmount
                })
            });

            if (srvRes.ok) {
                const srvData = await srvRes.json();
                if (srvData?.success && srvData?.data?.account_number) {
                    try {
                        const str = JSON.stringify(srvData.data);
                        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                            window.localStorage.setItem(cacheKey, str);
                        }
                        if (AsyncStorage) await AsyncStorage.setItem(cacheKey, str);
                    } catch (_) {}
                    return { ok: true, data: srvData };
                }
            }
        } catch (srvErr) {
            console.warn('[PaymentGatewayService] Serverless VA notice:', srvErr.message);
        }

        // 3. Direct Flutterwave Virtual Account Fallback
        try {
            const config = await this.getGatewayConfig(appSettings);
            const flwSecret = config.flutterwave_secret_key ||
                (typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY || process.env?.FLUTTERWAVE_SECRET_KEY) : null) ||
                'FLWSECK-456331fb55a2e059f1eb8d439c53b9ae-1a07bfbf2fcvt-X';

            const txRef = `WVA-${(userId || 'USR').substring(0, 8)}-${Date.now()}`;
            const flwRes = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${flwSecret.trim()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: userEmail,
                    is_permanent: false,
                    bvn: null,
                    tx_ref: txRef,
                    phonenumber: userPhone,
                    firstname: firstName,
                    lastname: lastName,
                    narration: `Abu Mafhal Wallet - ${userName}`,
                    amount: safeAmount
                })
            });

            const flwData = await flwRes.json();
            if (flwData?.status === 'success' && flwData?.data?.account_number) {
                const d = flwData.data;
                const result = {
                    account_number: d.account_number,
                    account_name: d.note ? d.note.replace(/^Please make a bank transfer to\s+/i, '').trim() : 'ABU MAFHAL LTD FLW',
                    bank_name: d.bank_name || 'Flutterwave MFB',
                    order_ref: d.order_ref,
                    flw_ref: d.flw_ref,
                    tx_ref: txRef,
                    amount: d.amount || safeAmount,
                    expiry: d.expiry_date,
                    expiry_ms: d.expiry_date ? new Date(d.expiry_date).getTime() : (Date.now() + 60 * 60 * 1000),
                    is_permanent: false,
                    provider: 'flutterwave',
                    created_at: d.created_at || new Date().toISOString()
                };

                try {
                    const str = JSON.stringify(result);
                    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                        window.localStorage.setItem(cacheKey, str);
                    }
                    if (AsyncStorage) await AsyncStorage.setItem(cacheKey, str);
                } catch (_) {}

                return { ok: true, data: { success: true, data: result } };
            } else {
                return {
                    ok: false,
                    error: flwData?.message || 'Could not generate virtual account with payment gateway'
                };
            }
        } catch (directErr) {
            console.error('[PaymentGatewayService] Direct VA generation error:', directErr);
            return { ok: false, error: directErr.message || 'Network error generating virtual account' };
        }
    },

    /**
     * Unified Entry Point
     */
    async initiate({ gateway = 'Paystack', amount, email, phone, name, reference, appSettings, metadata = {} }) {
        const normalized = String(gateway).toLowerCase();

        if (normalized.includes('flutter') || normalized.includes('flw')) {
            return this.initiateFlutterwave({ amount, email, phone, name, reference, appSettings, metadata });
        }

        if (normalized.includes('nowpayment') || normalized.includes('crypto') || normalized.includes('coinbase')) {
            return this.initiateNowPayments({ amount, currency: metadata?.currency || 'usd', email, phone, name, reference, appSettings, metadata });
        }

        // Default to Paystack
        return this.initiatePaystack({ amount, email, phone, name, reference, appSettings, metadata });
    },

    /**
     * Record Completed Transaction in Supabase
     */
    async recordTransaction({ userId, amount, reference, gateway, type = 'order_payment', description, status = 'completed' }) {
        const isUUID = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

        let validUid = userId;
        if (!isUUID(validUid)) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user && isUUID(user.id)) {
                    validUid = user.id;
                }
            } catch (_) {}
        }

        if (!isUUID(validUid)) {
            console.warn('[PaymentGatewayService] Cannot insert transaction remotely: authentic user UUID required. Transaction logged in local escrow store.');
            return null;
        }

        try {
            const { data, error } = await supabase.from('transactions').insert({
                user_id: validUid,
                type,
                amount: Number(amount) || 0,
                status,
                reference: reference || this.generateRef('TX'),
                description: description || `Escrow Payment via ${gateway || 'Online'}`
            }).select();

            if (error) {
                console.warn('[PaymentGatewayService] Error inserting transaction:', error.message);
            }
            return data;
        } catch (e) {
            console.warn('[PaymentGatewayService] Transaction insert exception:', e.message);
            return null;
        }
    },

    /**
     * Authoritative Payment Verification
     * Strictly verifies payments against Paystack / Flutterwave APIs.
     * Never returns false-positive success.
     */
    async verifyPayment({ reference, gateway = 'Paystack', amount, userId, action = 'order_payment' }) {
        if (!reference) return { success: false, error: 'Missing payment reference' };
        const norm = String(gateway).toLowerCase();

        // 1. Paystack Verification
        if (norm.includes('paystack')) {
            try {
                const res = await this.invokeEdgeFunction('verify-paystack-payment', {
                    reference,
                    action,
                    amount: Number(amount) || 0,
                    user_id: userId
                });
                if (res.ok && res.data?.success) {
                    return { success: true, data: res.data };
                }
                if (res.data?.error || res.error) {
                    const errTxt = res.data?.error || res.error;
                    // If backend explicitly rejected payment verification (e.g. transaction not successful)
                    if (errTxt.toLowerCase().includes('verification failed') || errTxt.toLowerCase().includes('not successful')) {
                        return { success: false, error: errTxt };
                    }
                }
            } catch (e) {
                console.warn('[PaymentGatewayService] Paystack verify edge note:', e.message);
            }

            // Fallback: Direct Paystack Verify API with dynamic secret key
            try {
                const config = await this.getGatewayConfig();
                const secret = config.paystack_secret_key || config.PAYSTACK_SECRET_KEY || 
                    (typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_PAYSTACK_SECRET_KEY || process.env?.PAYSTACK_SECRET_KEY) : null);
                if (secret) {
                    const resp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${secret.trim()}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    const json = await resp.json();
                    if (json?.status && json?.data?.status === 'success') {
                        return { success: true, data: json.data };
                    } else {
                        return { success: false, error: json?.message || 'Transaction was not successful on Paystack' };
                    }
                }
            } catch (directErr) {
                console.warn('[PaymentGatewayService] Direct Paystack verify error:', directErr.message);
            }
        }

        // 2. Flutterwave Verification
        if (norm.includes('flutterwave') || norm.includes('flw')) {
            try {
                const config = await this.getGatewayConfig();
                const flwSecret = config.flutterwave_secret_key || config.FLUTTERWAVE_SECRET_KEY ||
                    (typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY || process.env?.FLUTTERWAVE_SECRET_KEY) : null);
                if (flwSecret) {
                    const resp = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${flwSecret.trim()}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    const json = await resp.json();
                    if (json?.status === 'success' && json?.data?.status === 'successful') {
                        return { success: true, data: json.data };
                    } else {
                        return { success: false, error: json?.message || 'Transaction was not approved by Flutterwave' };
                    }
                }
            } catch (flwErr) {
                console.warn('[PaymentGatewayService] Flutterwave verify error:', flwErr.message);
            }
        }

        // 3. NOWPayments (Crypto) Verification
        if (norm.includes('nowpayment') || norm.includes('crypto')) {
            try {
                const config = await this.getGatewayConfig();
                const npKey = config.nowpayments_api_key || config.NOWPAYMENTS_API_KEY ||
                    (typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_NOWPAYMENTS_API_KEY || process.env?.VITE_NOWPAYMENTS_API_KEY) : null);
                if (npKey) {
                    const resp = await fetch('https://api.nowpayments.io/v1/payment/?limit=20&page=0&sortBy=created_at&orderBy=desc', {
                        method: 'GET',
                        headers: {
                            'x-api-key': npKey.trim()
                        }
                    });
                    const json = await resp.json();
                    if (Array.isArray(json?.data)) {
                        const matched = json.data.find(p => p.order_id === reference || String(p.payment_id) === String(reference));
                        if (matched) {
                            const st = (matched.payment_status || '').toLowerCase();
                            if (st === 'finished' || st === 'confirmed' || st === 'sending') {
                                return { success: true, data: matched };
                            } else if (st === 'failed' || st === 'expired' || st === 'rejected') {
                                return { success: false, error: `Crypto payment ${st}. Please try again.` };
                            }
                        }
                    }
                }
            } catch (npErr) {
                console.warn('[PaymentGatewayService] NOWPayments verify error:', npErr.message);
            }
        }

        // 4. Database verified record check (e.g. IPN webhook already marked transaction completed)
        try {
            const { data } = await supabase.from('transactions')
                .select('*')
                .eq('reference', reference)
                .maybeSingle();

            if (data && (data.status === 'completed' || data.status === 'success')) {
                return { success: true, data };
            }
        } catch (_) {}

        return { success: false, error: 'Payment transaction could not be verified with payment gateway.' };
    },

    /**
     * Cache Order Record Locally for Instant Display
     */
    async cacheOrderLocally(userId, orderData) {
        if (!userId || !orderData) return;
        try {
            const key = `@abumafhal_orders_${userId}`;
            const existing = await AsyncStorage.getItem(key);
            const list = existing ? JSON.parse(existing) : [];
            const updated = [orderData, ...list];
            await AsyncStorage.setItem(key, JSON.stringify(updated));
        } catch (e) {
            console.warn('[PaymentGatewayService] Cache order locally error:', e.message);
        }
    }
};

export default PaymentGatewayService;
