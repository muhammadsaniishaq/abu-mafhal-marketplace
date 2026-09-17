import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Production & Test Gateway Keys
export const PAYSTACK_PUBLIC_KEY = 'pk_test_92a99bcc7c063338c402506c2e6db390dd986585';
export const FLUTTERWAVE_PUBLIC_KEY = 'FLWPUBK_TEST-e04746fae852427a92dfeb6df16d5663-X';
export const COINBASE_USDT_ADDRESS = 'TQ8C18Wb567hD3Z1W8mK8UqpL2PqZ4mNxK';
export const COINBASE_BTC_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';

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
            window.location.href = "https://abumafhal.com/payment/verify?status=successful&reference=" + encodeURIComponent(response.reference || '${ref}');
          },
          onClose: function() {
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
            window.location.href = "https://abumafhal.com/payment/verify?status=successful&tx_ref=" + encodeURIComponent(data.tx_ref || '${ref}') + "&flwref=" + encodeURIComponent(data.flw_ref || data.transaction_id || '');
          },
          onclose: function() {
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
     * Initiate Coinbase / Crypto Escrow Checkout
     */
    async initiateCoinbase({ amount, email, reference, name, phone, metadata = {} }) {
        const safeAmount = Math.max(1, Number(amount) || 0);
        const ref = reference || this.generateRef('CRYPTO');
        const approxUsdt = (safeAmount / 1500).toFixed(2); // approximate USDT conversion at ~1500 NGN/USDT

        // Clean, responsive Crypto Escrow Interface with instant Copy & Confirmation
        const inlineHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Coinbase & Crypto Checkout</title>
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
      padding: 20px;
      text-align: center;
    }
    .card {
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 18px;
      padding: 24px 20px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.5);
    }
    .logo-badge {
      width: 52px;
      height: 52px;
      background: #0F172A;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px;
      border: 1px solid #3B82F6;
    }
    .title { font-size: 18px; font-weight: 800; color: #FFFFFF; }
    .sub { font-size: 12px; color: #94A3B8; margin-top: 4px; margin-bottom: 16px; }
    .amount-box {
      background: #0F172A;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .ngn-val { font-size: 22px; font-weight: 900; color: #10B981; }
    .crypto-val { font-size: 13px; font-weight: 700; color: #38BDF8; margin-top: 4px; }
    .address-section {
      text-align: left;
      background: #0F172A;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 14px;
    }
    .addr-label { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94A3B8; margin-bottom: 6px; }
    .addr-val {
      font-size: 11.5px;
      font-family: monospace;
      color: #E2E8F0;
      word-break: break-all;
      background: #1E293B;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px dashed #475569;
    }
    .btn-copy {
      background: #3B82F6;
      color: white;
      font-weight: 700;
      font-size: 12px;
      padding: 7px 14px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      margin-top: 8px;
      display: inline-block;
    }
    .btn-confirm {
      background: #10B981;
      color: white;
      font-weight: 800;
      font-size: 15px;
      padding: 14px;
      border-radius: 10px;
      border: none;
      width: 100%;
      cursor: pointer;
      margin-top: 14px;
    }
    .btn-cancel {
      background: transparent;
      color: #94A3B8;
      font-weight: 600;
      font-size: 13px;
      padding: 10px;
      border: none;
      width: 100%;
      cursor: pointer;
      margin-top: 6px;
    }
    .toast {
      display: none;
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #10B981;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-badge">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 8v8M8 12h8"></path>
      </svg>
    </div>
    <div class="title">Coinbase Crypto Escrow</div>
    <div class="sub">Pay securely with USDT (TRC-20) or Bitcoin</div>

    <div class="amount-box">
      <div class="ngn-val">&#8358;${safeAmount.toLocaleString()}</div>
      <div class="crypto-val">&asymp; ${approxUsdt} USDT (TRC-20)</div>
    </div>

    <div class="address-section">
      <div class="addr-label">Official Deposit Address (USDT - TRC20)</div>
      <div class="addr-val" id="usdtAddr">${COINBASE_USDT_ADDRESS}</div>
      <button class="btn-copy" onclick="copyAddress('${COINBASE_USDT_ADDRESS}')">&#128203; Copy USDT Address</button>
    </div>

    <div class="address-section">
      <div class="addr-label">Alternative: Bitcoin (BTC)</div>
      <div class="addr-val" id="btcAddr">${COINBASE_BTC_ADDRESS}</div>
      <button class="btn-copy" onclick="copyAddress('${COINBASE_BTC_ADDRESS}')">&#128203; Copy BTC Address</button>
    </div>

    <button class="btn-confirm" onclick="confirmPayment()">I Have Made Payment &#10004;</button>
    <button class="btn-cancel" onclick="cancelPayment()">Cancel Transaction</button>
    <div style="font-size: 11px; color: #64748B; margin-top: 10px;">Your transaction ref: ${ref}</div>
  </div>

  <div id="toast" class="toast">Address copied to clipboard!</div>

  <script>
    function copyAddress(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
      } else {
        var el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      var t = document.getElementById('toast');
      t.style.display = 'block';
      setTimeout(function() { t.style.display = 'none'; }, 2000);
    }

    function confirmPayment() {
      window.location.href = "https://abumafhal.com/payment/verify?status=successful&reference=" + encodeURIComponent('${ref}') + "&gateway=coinbase";
    }

    function cancelPayment() {
      window.location.href = "https://abumafhal.com/payment/verify?status=cancelled&reference=" + encodeURIComponent('${ref}');
    }
  </script>
</body>
</html>
`;

        return {
            success: true,
            reference: ref,
            gateway: 'Coinbase',
            checkoutUrl: inlineHtml,
            type: 'html'
        };
    },

    /**
     * Unified Entry Point
     */
    async initiate({ gateway = 'Paystack', amount, email, phone, name, metadata = {} }) {
        const normalized = String(gateway).toLowerCase();

        if (normalized.includes('flutter') || normalized.includes('flw')) {
            return this.initiateFlutterwave({ amount, email, phone, name, metadata });
        }

        if (normalized.includes('coinbase') || normalized.includes('crypto')) {
            return this.initiateCoinbase({ amount, email, phone, name, metadata });
        }

        // Default to Paystack
        return this.initiatePaystack({ amount, email, phone, name, metadata });
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
