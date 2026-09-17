import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Production & Test Gateway Keys
export const PAYSTACK_PUBLIC_KEY = 'pk_test_92a99bcc7c063338c402506c2e6db390dd986585';
export const FLUTTERWAVE_PUBLIC_KEY = 'FLWPUBK_TEST-e04746fae852427a92dfeb6df16d5663-X';

/**
 * Service to initiate online payments across Paystack, Flutterwave, and Coinbase Crypto.
 */
export const PaymentGatewayService = {
    /**
     * Generate unique reference
     */
    generateRef(prefix = 'ORD') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    },

    /**
     * Initiate Paystack Payment
     */
    async initiatePaystack({ amount, email, reference, name, phone, metadata = {} }) {
        const safeAmount = Math.max(1, Number(amount) || 0);
        const ref = reference || this.generateRef('PAYSTACK');
        const userEmail = (email && email.includes('@')) ? email.trim() : `customer_${Date.now()}@abumafhal.com`;

        // 1. Try Supabase Edge Function 'initiate-paystack-payment'
        try {
            const callbackUrl = Platform.OS === 'web' 
                ? (typeof window !== 'undefined' ? window.location.href : 'https://abumafhal.com/payment/verify')
                : 'https://standard.paystack.co/close';

            const { data, error } = await supabase.functions.invoke('initiate-paystack-payment', {
                body: {
                    amount: safeAmount,
                    email: userEmail,
                    reference: ref,
                    callback_url: callbackUrl
                }
            });

            if (!error && data?.success && data?.authorization_url) {
                return {
                    success: true,
                    reference: ref,
                    gateway: 'Paystack',
                    checkoutUrl: data.authorization_url,
                    accessCode: data.access_code,
                    type: 'url' 
                };
            }
        } catch (e) {
            console.warn('[PaymentGatewayService] Edge function Paystack init failed, using inline fallback:', e.message);
        }

        // 2. High-reliability Fallback: Direct Paystack Inline Checkout HTML for WebView
        const inlineHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Paystack Secure Checkout</title>
  <script src="https://js.paystack.co/v1/inline.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0B1120;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }
    .card {
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }
    .logo-badge {
      width: 54px;
      height: 54px;
      background: #0F172A;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      border: 1px solid #3B82F6;
    }
    .title { font-size: 18px; font-weight: 800; color: #FFFFFF; margin-bottom: 6px; }
    .amount { font-size: 26px; font-weight: 900; color: #10B981; margin: 14px 0 20px; }
    .spinner {
      border: 3px solid rgba(255,255,255,0.1);
      border-top: 3px solid #10B981;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .btn {
      background: #10B981;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 15px;
      padding: 14px 24px;
      border-radius: 10px;
      border: none;
      width: 100%;
      cursor: pointer;
      margin-top: 16px;
    }
    .secure-note { font-size: 12px; color: #94A3B8; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-badge">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
        <line x1="1" y1="10" x2="23" y2="10"></line>
      </svg>
    </div>
    <div class="title">Paystack Escrow Checkout</div>
    <div class="amount">&#8358;${safeAmount.toLocaleString()}</div>
    <div id="loadingBox">
      <div class="spinner"></div>
      <div style="font-size: 13.5px; color: #94A3B8;">Connecting to Paystack gateway...</div>
    </div>
    <button id="payBtn" class="btn" style="display:none;" onclick="openPaystack()">Click to Pay &#8358;${safeAmount.toLocaleString()}</button>
    <div class="secure-note">&#128274; 256-Bit SSL Encrypted & Escrow Protected</div>
  </div>

  <script>
    function openPaystack() {
      try {
        var handler = PaystackPop.setup({
          key: '${PAYSTACK_PUBLIC_KEY}',
          email: '${userEmail}',
          amount: ${Math.round(safeAmount * 100)},
          ref: '${ref}',
          currency: 'NGN',
          metadata: {
            custom_fields: [
              { display_name: "Customer Name", variable_name: "customer_name", value: "${name || 'Customer'}" },
              { display_name: "Phone", variable_name: "customer_phone", value: "${phone || ''}" }
            ]
          },
          callback: function(response) {
            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ status: 'successful', reference: response.reference || '${ref}' }, '*');
              }
            } catch (_) {}
            window.location.href = "https://abumafhal.com/payment/verify?status=successful&reference=" + encodeURIComponent(response.reference || '${ref}');
          },
          onClose: function() {
            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ status: 'cancelled', reference: '${ref}' }, '*');
              }
            } catch (_) {}
            window.location.href = "https://abumafhal.com/payment/verify?status=cancelled&reference=" + encodeURIComponent('${ref}');
          }
        });
        handler.openIframe();
      } catch (err) {
        document.getElementById('loadingBox').style.display = 'none';
        document.getElementById('payBtn').style.display = 'block';
      }
    }

    window.onload = function() {
      setTimeout(function() {
        openPaystack();
        setTimeout(function() {
          document.getElementById('loadingBox').style.display = 'none';
          document.getElementById('payBtn').style.display = 'block';
        }, 1500);
      }, 400);
    };
  </script>
</body>
</html>
`;

        return {
            success: true,
            reference: ref,
            gateway: 'Paystack',
            checkoutUrl: inlineHtml,
            type: 'html'
        };
    },

    /**
     * Initiate Flutterwave Payment
     */
    async initiateFlutterwave({ amount, email, reference, name, phone, metadata = {} }) {
        const safeAmount = Math.max(1, Number(amount) || 0);
        const ref = reference || this.generateRef('FLW');
        const userEmail = (email && email.includes('@')) ? email.trim() : `customer_${Date.now()}@abumafhal.com`;
        const userName = name || 'Customer';
        const userPhone = phone || '08000000000';

        // High-reliability Flutterwave v3 Checkout HTML for WebView
        const inlineHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Flutterwave Secure Checkout</title>
  <script src="https://checkout.flutterwave.com/v3.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0B1120;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }
    .card {
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }
    .logo-badge {
      width: 54px;
      height: 54px;
      background: #0F172A;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      border: 1px solid #F5A623;
    }
    .title { font-size: 18px; font-weight: 800; color: #FFFFFF; margin-bottom: 6px; }
    .amount { font-size: 26px; font-weight: 900; color: #F5A623; margin: 14px 0 20px; }
    .spinner {
      border: 3px solid rgba(255,255,255,0.1);
      border-top: 3px solid #F5A623;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .btn {
      background: #F5A623;
      color: #0F172A;
      font-weight: 900;
      font-size: 15px;
      padding: 14px 24px;
      border-radius: 10px;
      border: none;
      width: 100%;
      cursor: pointer;
      margin-top: 16px;
    }
    .secure-note { font-size: 12px; color: #94A3B8; margin-top: 14px; }
    .channels-pill {
      display: inline-flex;
      background: rgba(245, 166, 35, 0.1);
      border: 1px solid rgba(245, 166, 35, 0.3);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      color: #FBBF24;
      font-weight: 700;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-badge">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F5A623" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    </div>
    <div class="channels-pill">Cards &bull; USSD &bull; Bank Transfer</div>
    <div class="title">Flutterwave Escrow Checkout</div>
    <div class="amount">&#8358;${safeAmount.toLocaleString()}</div>
    <div id="loadingBox">
      <div class="spinner"></div>
      <div style="font-size: 13.5px; color: #94A3B8;">Connecting to Flutterwave gateway...</div>
    </div>
    <button id="payBtn" class="btn" style="display:none;" onclick="openFlutterwave()">Click to Pay &#8358;${safeAmount.toLocaleString()}</button>
    <div class="secure-note">&#128274; Escrow Protected Payment Processing</div>
  </div>

  <script>
    function openFlutterwave() {
      try {
        FlutterwaveCheckout({
          public_key: '${FLUTTERWAVE_PUBLIC_KEY}',
          tx_ref: '${ref}',
          amount: ${safeAmount},
          currency: "NGN",
          payment_options: "card,banktransfer,ussd",
          customer: {
            email: "${userEmail}",
            phone_number: "${userPhone}",
            name: "${userName}"
          },
          customizations: {
            title: "Abu Mafhal Marketplace",
            description: "Order Escrow Payment",
            logo: "https://abumafhal.com/logo.png"
          },
          callback: function(data) {
            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ status: 'successful', tx_ref: data.tx_ref || '${ref}', flwref: data.flw_ref || data.transaction_id || '' }, '*');
              }
            } catch (_) {}
            window.location.href = "https://abumafhal.com/payment/verify?status=successful&tx_ref=" + encodeURIComponent(data.tx_ref || '${ref}') + "&flwref=" + encodeURIComponent(data.flw_ref || data.transaction_id || '');
          },
          onclose: function() {
            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ status: 'cancelled', tx_ref: '${ref}' }, '*');
              }
            } catch (_) {}
            window.location.href = "https://abumafhal.com/payment/verify?status=cancelled&tx_ref=" + encodeURIComponent('${ref}');
          }
        });
      } catch (err) {
        document.getElementById('loadingBox').style.display = 'none';
        document.getElementById('payBtn').style.display = 'block';
      }
    }

    window.onload = function() {
      setTimeout(function() {
        openFlutterwave();
        setTimeout(function() {
          document.getElementById('loadingBox').style.display = 'none';
          document.getElementById('payBtn').style.display = 'block';
        }, 1500);
      }, 400);
    };
  </script>
</body>
</html>
`;

        return {
            success: true,
            reference: ref,
            gateway: 'Flutterwave',
            checkoutUrl: inlineHtml,
            type: 'html'
        };
    },

    /**
     * Initiate Coinbase / Crypto Checkout (Coinbase Commerce)
     */
    async initiateCoinbase({ amount, email, reference, name, phone, metadata = {} }) {
        const safeAmount = Math.max(1, Number(amount) || 0);
        const ref = reference || this.generateRef('COINBASE');

        // Invoke Supabase Edge Function configured with authentic Coinbase Commerce API
        try {
            const { data, error } = await supabase.functions.invoke('initiate-payment', {
                body: {
                    payment_method: 'Coinbase',
                    payment_reference: ref,
                    total_amount: safeAmount,
                    items: metadata.items || [],
                    shipping_address: metadata.shipping_address || {},
                    delivery_method: metadata.delivery_method || 'standard',
                    order_notes: metadata.order_notes || ''
                }
            });

            if (!error && data?.checkout_url && typeof data.checkout_url === 'string' && data.checkout_url.startsWith('http')) {
                return {
                    success: true,
                    reference: data.payment_reference || ref,
                    gateway: 'Coinbase',
                    checkoutUrl: data.checkout_url,
                    sessionId: data.session_id,
                    type: 'url'
                };
            }

            const errDetail = data?.error || error?.message || 'Coinbase Commerce returned an invalid response.';
            console.warn('[PaymentGatewayService] Coinbase API warning:', errDetail);

            // Inform the user if Coinbase Commerce API Key has not been configured in the backend environment
            if (errDetail.toLowerCase().includes('api key') || errDetail.toLowerCase().includes('configuration missing') || errDetail.toLowerCase().includes('not configured')) {
                throw new Error('Coinbase Commerce is not active on this store (API Key missing). Please choose Paystack, Flutterwave, or Wallet for instant checkout.');
            }

            throw new Error(errDetail);
        } catch (e) {
            console.error('[PaymentGatewayService] Coinbase Commerce error:', e.message);
            throw e;
        }
    },

    /**
     * Unified Entry Point
     */
    async initiate({ gateway = 'Paystack', amount, email, phone, name, reference, metadata = {} }) {
        const normalized = String(gateway).toLowerCase();

        if (normalized.includes('flutter') || normalized.includes('flw')) {
            return this.initiateFlutterwave({ amount, email, phone, name, reference, metadata });
        }

        if (normalized.includes('coinbase') || normalized.includes('crypto')) {
            return this.initiateCoinbase({ amount, email, phone, name, reference, metadata });
        }

        // Default to Paystack
        return this.initiatePaystack({ amount, email, phone, name, reference, metadata });
    },

    /**
     * Record Completed Transaction in Supabase
     */
    async recordTransaction({ userId, amount, reference, gateway, type = 'order_payment', description, status = 'completed' }) {
        if (!userId) return null;
        try {
            const { data, error } = await supabase.from('transactions').insert({
                user_id: userId,
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
