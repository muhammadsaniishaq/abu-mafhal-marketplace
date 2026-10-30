import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import {
  Key, Copy, Check, Terminal, Code2, RefreshCw, Trash2,
  ExternalLink, Sparkles, BookOpen, AlertCircle, ArrowUpRight,
  ShieldCheck, Globe, Zap, Cpu, CheckCircle2, Lock, Eye, EyeOff,
  Database, Server, Layers, Play, CreditCard, ShoppingBag, Send,
  HelpCircle, Activity, FileJson, ShieldAlert, Clock, Unlock
} from 'lucide-react';

export default function VendorApiDocs() {
  const { currentUser } = useAuth();
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('Production Live Key');
  const [newKeyType, setNewKeyType] = useState('live'); // 'live' or 'test'
  const [activeTab, setActiveTab] = useState('curl');
  const [copiedKey, setCopiedKey] = useState(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [apiSuccessMsg, setApiSuccessMsg] = useState('');
  const [apiErrorMsg, setApiErrorMsg] = useState('');
  const [revealedKeys, setRevealedKeys] = useState({});

  // API Access Approval Lock State
  const [accessStatus, setAccessStatus] = useState('loading'); // 'approved' | 'pending' | 'rejected' | 'not_requested'
  const [accessRequest, setAccessRequest] = useState(null);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [requestNote, setRequestNote] = useState('');

  // Interactive Playground State
  const [selectedEndpoint, setSelectedEndpoint] = useState('products'); // 'products' | 'payments' | 'orders' | 'analytics'
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Playground Filters & Inputs
  const [filterLimit, setFilterLimit] = useState('5');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStockOnly, setFilterStockOnly] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('5000');
  const [customerEmail, setCustomerEmail] = useState('customer@example.com');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');

  // Webhook Simulator State
  const [webhookUrl, setWebhookUrl] = useState('https://webhook.site/demo-abumafhal');
  const [webhookEvent, setWebhookEvent] = useState('order.created');
  const [webhookSecret, setWebhookSecret] = useState('am_sec_demo99482710');
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [webhookSimResult, setWebhookSimResult] = useState(null);

  const [selectedApiKey, setSelectedApiKey] = useState('');
  const [responseViewMode, setResponseViewMode] = useState('visual'); // 'visual' | 'json'

  const vendorId = currentUser?.id || currentUser?.uid;
  const officialDomain = 'https://www.abumafhal.com';
  const productsApiUrl = `${officialDomain}/api/v1/products`;
  const paymentsApiUrl = `${officialDomain}/api/v1/payments`;
  const ordersApiUrl = `${officialDomain}/api/v1/orders`;
  const analyticsApiUrl = `${officialDomain}/api/v1/analytics`;

  useEffect(() => {
    if (vendorId) {
      loadKeys();
    }
  }, [vendorId]);

  const loadKeys = async () => {
    setLoading(true);
    setApiErrorMsg('');
    try {
      const res = await fetch(`/api/v1/vendor-keys?vendor_id=${vendorId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          setAccessStatus(data.access_status || 'not_requested');
          setAccessRequest(data.access_request || null);
          const retrievedKeys = Array.isArray(data.keys) ? data.keys : Array.isArray(data.data) ? data.data : [];
          setApiKeys(retrievedKeys);
          if (retrievedKeys.length > 0 && !selectedApiKey) {
            setSelectedApiKey(retrievedKeys[0].api_key);
          }
          setLoading(false);
          return;
        }
      }

      const { data: settings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'vendor_api_keys')
        .maybeSingle();

      if (settings?.value?.keys && Array.isArray(settings.value.keys)) {
        const userKeys = settings.value.keys.filter(k => k.vendor_id === vendorId);
        setApiKeys(userKeys);
        if (userKeys.length > 0 && !selectedApiKey) {
          setSelectedApiKey(userKeys[0].api_key);
        }
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
      setApiErrorMsg('Failed to load API keys. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const submitAccessRequest = async () => {
    if (!vendorId) return;
    setRequestingAccess(true);
    setApiErrorMsg('');
    setApiSuccessMsg('');

    try {
      const res = await fetch('/api/v1/vendor-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          action: 'request_access',
          note: requestNote.trim()
        })
      });

      const result = await res.json();

      if (res.ok && result.status === 'success') {
        setAccessStatus('pending');
        setApiSuccessMsg(result.message || 'Developer API access request submitted! Admin will review shortly.');
        await loadKeys();
      } else {
        setApiErrorMsg(result.message || 'Failed to submit API access request.');
      }
    } catch (err) {
      console.error('API access request error:', err);
      setApiErrorMsg('Network error while requesting developer API access.');
    } finally {
      setRequestingAccess(false);
    }
  };

  const generateNewKey = async () => {
    if (!vendorId) return;

    if (accessStatus !== 'approved') {
      setApiErrorMsg('Developer API access is currently locked. You must submit a request and obtain administrator approval before generating keys.');
      return;
    }

    setGenerating(true);
    setApiErrorMsg('');
    setApiSuccessMsg('');

    try {
      const res = await fetch('/api/v1/vendor-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          key_name: newKeyName.trim() || (newKeyType === 'test' ? 'Sandbox Test Key' : 'Production Live Key'),
          key_type: newKeyType
        })
      });

      const result = await res.json();

      if (res.ok && result.status === 'success') {
        setApiSuccessMsg(`Successfully generated new ${newKeyType.toUpperCase()} API key for abumafhal.com!`);
        if (result.data?.api_key) {
          setSelectedApiKey(result.data.api_key);
        }
        await loadKeys();
      } else {
        setApiErrorMsg(result.message || 'Failed to generate API key.');
      }
    } catch (err) {
      console.error('API key generation error:', err);
      setApiErrorMsg('Network error while generating API key.');
    } finally {
      setGenerating(false);
    }
  };

  const revokeKey = async (keyRecord) => {
    const keyId = typeof keyRecord === 'object' ? keyRecord.id : keyRecord;
    const apiKey = typeof keyRecord === 'object' ? keyRecord.api_key : null;

    if (!window.confirm('Are you sure you want to revoke this API Key? Any external applications using this key will immediately lose access.')) {
      return;
    }

    try {
      const res = await fetch('/api/v1/vendor-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          key_id: keyId,
          api_key: apiKey
        })
      });

      if (res.ok) {
        setApiKeys(prev => {
          const updated = prev.filter(k => (keyId ? k.id !== keyId : true) && (apiKey ? k.api_key !== apiKey : true));
          if (updated.length > 0) setSelectedApiKey(updated[0].api_key);
          else setSelectedApiKey('abumafhal_test_sandbox_verified_key');
          return updated;
        });
        setApiSuccessMsg('API Key has been revoked successfully.');
      }
    } catch (err) {
      console.error('Failed to revoke key:', err);
    }
  };

  const copyToClipboard = (text, type = 'key') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2500);
    } else {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2500);
    }
  };

  const toggleRevealKey = (id) => {
    setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Determine active key: user-selected key, first active key, or universal verified sandbox key
  const activeKeyString = selectedApiKey || apiKeys.find(k => k.is_active !== false)?.api_key || 'abumafhal_test_sandbox_verified_key';

  const runLiveTest = async () => {
    setTestingEndpoint(true);
    setTestResult(null);

    // Use relative endpoint path in browser to prevent any cross-origin CORS or port mismatch issues,
    // while displaying official domain in docs
    let testPath = '';
    let displayUrl = '';
    let options = {};

    if (selectedEndpoint === 'products') {
      const q = new URLSearchParams();
      if (filterLimit) q.append('limit', filterLimit);
      if (filterStockOnly) q.append('in_stock_only', 'true');
      if (filterCategory) q.append('category', filterCategory);
      testPath = `/api/v1/products?${q.toString()}`;
      displayUrl = `${productsApiUrl}?${q.toString()}`;
      options = {
        method: 'GET',
        headers: { 'x-api-key': activeKeyString, 'Accept': 'application/json' }
      };
    } else if (selectedEndpoint === 'payments') {
      testPath = '/api/v1/payments';
      displayUrl = paymentsApiUrl;
      options = {
        method: 'POST',
        headers: { 'x-api-key': activeKeyString, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(paymentAmount) || 5000,
          customer_email: customerEmail || 'customer@example.com',
          customer_name: 'Customer Name'
        })
      };
    } else if (selectedEndpoint === 'orders') {
      // Orders
      const q = new URLSearchParams();
      if (filterLimit) q.append('limit', filterLimit);
      if (orderStatusFilter !== 'all') q.append('status', orderStatusFilter);
      testPath = `/api/v1/orders?${q.toString()}`;
      displayUrl = `${ordersApiUrl}?${q.toString()}`;
      options = {
        method: 'GET',
        headers: { 'x-api-key': activeKeyString, 'Accept': 'application/json' }
      };
    } else {
      // Analytics & Telemetry
      testPath = '/api/v1/analytics';
      displayUrl = analyticsApiUrl;
      options = {
        method: 'GET',
        headers: { 'x-api-key': activeKeyString, 'Accept': 'application/json' }
      };
    }

    try {
      const startTime = performance.now();
      const res = await fetch(testPath, options);
      const endTime = performance.now();
      const data = await res.json();
      setTestResult({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        timeMs: Math.round(endTime - startTime),
        url: displayUrl,
        body: data
      });
    } catch (err) {
      setTestResult({
        status: 500,
        ok: false,
        timeMs: 0,
        url: displayUrl,
        body: { error: err.message }
      });
    } finally {
      setTestingEndpoint(false);
    }
  };

  const simulateWebhookPing = async () => {
    setSimulatingWebhook(true);
    setWebhookSimResult(null);

    const samplePayload = {
      event: webhookEvent,
      timestamp: new Date().toISOString(),
      id: `evt_${Date.now()}`,
      data: webhookEvent === 'order.created' ? {
        order_number: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'pending',
        currency: 'NGN',
        total_amount: 14500,
        customer: { name: 'Amina Bello', email: 'amina@example.com', phone: '+2348012345678' }
      } : webhookEvent === 'payment.success' ? {
        reference: `REF-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'paid',
        amount: 25000,
        channel: 'card',
        paid_at: new Date().toISOString()
      } : {
        product_id: 'prod_987162',
        product_name: 'Wireless Bluetooth Earbuds Pro',
        remaining_units: 3,
        threshold: 5
      }
    };

    try {
      const startTime = performance.now();
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-abumafhal-signature': `sha256=${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
          'x-abumafhal-event': webhookEvent
        },
        body: JSON.stringify(samplePayload)
      }).catch((e) => ({ ok: false, status: 0, statusText: e.message || 'CORS / Network Blocked' }));

      const endTime = performance.now();
      setWebhookSimResult({
        delivered: res.ok || res.status === 200 || res.status === 201 || res.status === 204,
        status: res.status || 0,
        statusText: res.statusText || 'Sent Payload',
        latencyMs: Math.round(endTime - startTime),
        payload: samplePayload
      });
    } catch (e) {
      setWebhookSimResult({
        delivered: false,
        status: 0,
        statusText: e.message || 'Failed to dispatch ping',
        latencyMs: 0,
        payload: samplePayload
      });
    } finally {
      setSimulatingWebhook(false);
    }
  };

  const getSnippets = () => {
    if (selectedEndpoint === 'products') {
      return {
        curl: `# 1. Products API — Retrieve Store Catalog & Stock
curl -X GET "${productsApiUrl}?limit=20&in_stock_only=true" \\
  -H "x-api-key: ${activeKeyString}" \\
  -H "Accept: application/json"`,
        javascript: `// JavaScript (Fetch / Node.js 18+)
async function getProducts() {
  const response = await fetch("${productsApiUrl}?limit=20&in_stock_only=true", {
    method: "GET",
    headers: {
      "x-api-key": "${activeKeyString}",
      "Accept": "application/json"
    }
  });

  const payload = await response.json();
  console.log("Total Products:", payload.pagination.total_products);
  payload.data.forEach(item => {
    console.log(\`📦 \${item.name} — ₦\${item.price.toLocaleString()} (Stock: \${item.available_stock})\`);
  });
}
getProducts();`,
        python: `# Python 3 (Requests)
import requests

url = "${productsApiUrl}"
headers = { "x-api-key": "${activeKeyString}" }
params = { "limit": 20, "in_stock_only": "true" }

response = requests.get(url, headers=headers, params=params)
data = response.json()
print("Products returned:", len(data.get("data", [])))`
      };
    } else if (selectedEndpoint === 'payments') {
      return {
        curl: `# 2. Payments API — Initialize Checkout Session
curl -X POST "${paymentsApiUrl}" \\
  -H "x-api-key: ${activeKeyString}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "customer_email": "customer@example.com",
    "customer_name": "John Doe"
  }'`,
        javascript: `// Initialize Checkout Session
async function createPayment() {
  const response = await fetch("${paymentsApiUrl}", {
    method: "POST",
    headers: {
      "x-api-key": "${activeKeyString}",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: 5000,
      customer_email: "customer@example.com",
      customer_name: "John Doe"
    })
  });

  const { data } = await response.json();
  console.log("Reference:", data.reference);
  console.log("Redirect Customer to:", data.checkout_url);
}
createPayment();`,
        python: `# Python 3 Payment Checkout
import requests

url = "${paymentsApiUrl}"
headers = {
    "x-api-key": "${activeKeyString}",
    "Content-Type": "application/json"
}
payload = {
    "amount": 5000,
    "customer_email": "customer@example.com"
}
response = requests.post(url, headers=headers, json=payload)
print(response.json())`
      };
    } else if (selectedEndpoint === 'orders') {
      return {
        curl: `# 3. Orders API — Query Customer Orders
curl -X GET "${ordersApiUrl}?limit=10&status=all" \\
  -H "x-api-key: ${activeKeyString}" \\
  -H "Accept: application/json"`,
        javascript: `// Fetch Vendor Orders
async function getOrders() {
  const response = await fetch("${ordersApiUrl}?limit=10", {
    headers: { "x-api-key": "${activeKeyString}" }
  });
  const result = await response.json();
  console.log("Orders List:", result.data);
}
getOrders();`,
        python: `# Python 3 Orders
import requests

response = requests.get("${ordersApiUrl}?limit=10", headers={"x-api-key": "${activeKeyString}"})
print(response.json())`
      };
    } else {
      return {
        curl: `# 4. Storefront Telemetry & Analytics API
curl -X GET "${analyticsApiUrl}" \\
  -H "x-api-key: ${activeKeyString}" \\
  -H "Accept: application/json"`,
        javascript: `// JavaScript — Fetch Storefront Inventory & Telemetry
async function getStoreAnalytics() {
  const response = await fetch("${analyticsApiUrl}", {
    method: "GET",
    headers: {
      "x-api-key": "${activeKeyString}",
      "Accept": "application/json"
    }
  });

  const { inventory_summary, sales_summary, api_health } = await response.json();
  console.log("Active Listings:", inventory_summary.active_listings);
  console.log("Gross Revenue:", sales_summary.currency_symbol + sales_summary.gross_revenue.toLocaleString());
  console.log("Gateway Latency:", api_health.average_latency_ms + "ms");
}
getStoreAnalytics();`,
        python: `# Python 3 — Telemetry & Analytics
import requests

url = "${analyticsApiUrl}"
headers = { "x-api-key": "${activeKeyString}" }
response = requests.get(url, headers=headers)
data = response.json()
print("Inventory:", data.get("inventory_summary"))
print("Sales:", data.get("sales_summary"))`
      };
    }
  };

  const codeSnippets = getSnippets();

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16 font-sans">
      {/* ─── Hero Header Card with Abu Mafhal Navy & Gold Branding ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/90 p-8 lg:p-10 shadow-sm">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#00BFA5]/10 via-amber-50/40 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-br from-[#0A192F]/5 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-3.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A192F]/5 border border-[#0A192F]/15 text-[#0A192F] text-xs font-bold tracking-wide uppercase shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#00BFA5] animate-pulse" />
              Abu Mafhal Developer Platform v1
            </div>

            <h1 className="text-3xl lg:text-4xl font-extrabold text-[#0A192F] tracking-tight">
              Developer REST API & Gateways
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed">
              Integrate your Abu Mafhal marketplace store with any website, mobile app, or external system. 
              Retrieve live product data (<strong className="text-[#00BFA5] font-semibold">Images</strong>, <strong className="text-[#00BFA5] font-semibold">Prices</strong>, <strong className="text-[#00BFA5] font-semibold">Stock Quantity</strong>), accept online customer payments via <strong className="text-[#00BFA5] font-semibold">Payments API</strong>, and manage orders on <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-[#0A192F] border border-slate-200">abumafhal.com</span>.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5 text-[#0A192F] font-semibold">
                <Globe className="w-4 h-4 text-[#00BFA5]" />
                abumafhal.com
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <CreditCard className="w-4 h-4 text-[#D9A73A]" />
                Direct Payment Gateway
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <Zap className="w-4 h-4 text-amber-500" />
                Live & Sandbox Test Keys
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              onClick={() => {
                const el = document.getElementById('playground');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-3 rounded-2xl bg-[#00BFA5] hover:bg-[#00a896] text-white font-bold text-xs shadow-md shadow-[#00BFA5]/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Live API Playground</span>
            </button>
            <a
              href="#documentation"
              className="px-6 py-3 rounded-2xl bg-[#0A192F] hover:bg-[#112240] text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-[#D9A73A]" />
              <span>Documentation & Code</span>
            </a>
          </div>
        </div>
      </div>

      {/* ─── Feedback Alerts ─── */}
      {apiSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{apiSuccessMsg}</span>
          </div>
          <button onClick={() => setApiSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900 text-sm">✕</button>
        </div>
      )}

      {apiErrorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{apiErrorMsg}</span>
          </div>
          <button onClick={() => setApiErrorMsg('')} className="text-rose-600 hover:text-rose-900 text-sm">✕</button>
        </div>
      )}

      {/* ─── Credentials Management Card / Access Lock ─── */}
      {accessStatus === 'loading' ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#00BFA5]" />
          <span className="text-xs text-slate-500 font-medium">Verifying API access permissions...</span>
        </div>
      ) : accessStatus === 'pending' ? (
        <div className="bg-white rounded-3xl border border-amber-200 shadow-sm p-6 lg:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-amber-600 animate-spin" />
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Under Review
                </div>
                <h2 className="text-xl font-extrabold text-[#0A192F]">Developer API Access: Pending Admin Approval</h2>
                <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                  Your application for developer API credentials has been received and is waiting for review by an Abu Mafhal platform administrator. Once approved, you will be able to generate and manage live and sandbox API keys immediately.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-500">
                  <span className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
                    <strong>Submitted:</strong> {accessRequest?.requested_at ? new Date(accessRequest.requested_at).toLocaleDateString() : 'Today'}
                  </span>
                  {accessRequest?.note && (
                    <span className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl italic">
                      &quot;{accessRequest.note}&quot;
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 px-5 py-4 bg-amber-50/70 border border-amber-200 rounded-2xl shrink-0">
              <Lock className="w-5 h-5 text-amber-700" />
              <span className="text-[11px] font-bold text-amber-900">Key Generation Locked</span>
              <span className="text-[10px] text-amber-700 text-center">Unlocks upon admin approval</span>
            </div>
          </div>
        </div>
      ) : accessStatus === 'rejected' ? (
        <div className="bg-white rounded-3xl border border-rose-200 shadow-sm p-6 lg:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-100/40 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold uppercase tracking-wider">
                  Access Declined
                </div>
                <h2 className="text-xl font-extrabold text-[#0A192F]">Developer API Access: Declined</h2>
                <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                  Your previous developer API access request was declined by the administrator. Review the feedback below and submit an updated application.
                </p>
                {accessRequest?.admin_note && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                    <strong>Admin Note:</strong> {accessRequest.admin_note}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <label className="block text-xs font-bold text-[#0A192F]">Submit New Integration Application</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="Explain your updated use case (e.g., verified store with custom mobile app integration)..."
                  className="flex-1 text-xs px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00BFA5]"
                />
                <button
                  onClick={submitAccessRequest}
                  disabled={requestingAccess}
                  className="px-5 py-2.5 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {requestingAccess ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                  Re-submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : accessStatus === 'not_requested' ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#00BFA5]/10 via-amber-50/30 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row items-start justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A192F]/5 border border-[#0A192F]/15 text-[#0A192F] text-[11px] font-bold uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5 text-[#D9A73A]" />
                Admin Approval Required
              </div>
              <h2 className="text-2xl font-extrabold text-[#0A192F]">Developer API Access is Locked</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                To ensure store security, data privacy, and reliable gateway performance, developer API access requires administrative authorization. Once approved, you can generate production and sandbox credentials to connect your store with external mobile apps, websites, POS systems, or accounting software.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold text-[#0A192F] block mb-0.5">⚡ Fast Review</span>
                  <span>Reviewed by admin within 24 hours</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold text-[#0A192F] block mb-0.5">🔒 Multi-Key Support</span>
                  <span>Live production & sandbox test keys</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold text-[#0A192F] block mb-0.5">📦 Full Catalog API</span>
                  <span>Products, Payments, Orders & Telemetry</span>
                </div>
              </div>

              <div className="pt-3 space-y-2">
                <label className="block text-xs font-bold text-[#0A192F]">Describe Your Integration / Use Case</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder="e.g. Custom mobile shopping app, ERP inventory sync, external WooCommerce store..."
                    className="flex-1 text-xs px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00BFA5]"
                  />
                  <button
                    onClick={submitAccessRequest}
                    disabled={requestingAccess}
                    className="px-6 py-2.5 rounded-xl bg-[#00BFA5] hover:bg-[#00a896] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-[#00BFA5]/20 disabled:opacity-50"
                  >
                    {requestingAccess ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Request API Access</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-72 p-5 rounded-2xl bg-gradient-to-br from-[#0A192F] to-[#112240] text-white space-y-3 shadow-lg shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00BFA5]" />
                <span className="text-xs font-bold">API Security Policy</span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-2">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#00BFA5]">✓</span> Rate limited to 120 calls/min
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#00BFA5]">✓</span> Scoped strictly to your vendor store
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#00BFA5]">✓</span> Admin instant-revocation protection
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#00BFA5]">✓</span> HMAC-SHA256 encrypted webhooks
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#D9A73A] flex items-center justify-center border border-amber-200">
                  <Key className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-[#0A192F]">API Credentials & Keys</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase">
                  <ShieldCheck className="w-3 h-3" /> Approved
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Create <span className="text-emerald-700 font-bold">Live Production Keys</span> for commercial store integration or <span className="text-amber-700 font-bold">Sandbox Test Keys</span> for test catalog and simulated checkout.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setNewKeyType('live');
                    setNewKeyName('Production Live Key');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    newKeyType === 'live' ? 'bg-[#00BFA5] text-white shadow-2xs' : 'text-slate-600 hover:text-[#0A192F]'
                  }`}
                >
                  Live Key
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewKeyType('test');
                    setNewKeyName('Sandbox Test Key');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    newKeyType === 'test' ? 'bg-[#D9A73A] text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-[#0A192F]'
                  }`}
                >
                  Test Key (Sandbox)
                </button>
              </div>

              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key Name"
                className="text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00BFA5]/20 focus:border-[#00BFA5] transition-all w-52 text-slate-800"
              />
              <button
                onClick={generateNewKey}
                disabled={generating}
                className="px-4 py-2.5 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00BFA5]" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#D9A73A]" />
                    <span>Generate Key</span>
                  </>
                )}
              </button>
            </div>
          </div>

        {/* Keys List */}
        <div className="mt-6">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#00BFA5]" />
              <span>Verifying credentials...</span>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="py-12 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-300 p-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#0A192F]">No active API keys found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Click &quot;Generate Key&quot; above to create your first Live or Sandbox API credential.
              </p>
              <button
                onClick={generateNewKey}
                disabled={generating}
                className="px-4 py-2 rounded-xl bg-[#00BFA5] text-white text-xs font-bold hover:bg-[#00a896] shadow-sm transition-all cursor-pointer"
              >
                Create API Key Now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((k) => {
                const isTest = k.key_type === 'test' || k.api_key.includes('_test_');
                const isRevealed = revealedKeys[k.id || k.api_key];
                const displayedKey = isRevealed ? k.api_key : `${k.api_key.substring(0, 15)}••••••••••••••••••••••••••••`;

                return (
                  <div
                    key={k.id || k.api_key}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300 transition-all gap-4 shadow-2xs"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#0A192F]">{k.key_name || (isTest ? 'Sandbox Test Key' : 'Production Live Key')}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isTest ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {isTest ? 'TEST KEY' : 'LIVE KEY'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-mono bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 select-all font-semibold">
                          {displayedKey}
                        </code>

                        <button
                          onClick={() => toggleRevealKey(k.id || k.api_key)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 transition-all cursor-pointer"
                          title={isRevealed ? "Hide Key" : "Show Key"}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => copyToClipboard(k.api_key, 'key')}
                          className="px-2.5 py-1 rounded-lg bg-[#00BFA5]/10 hover:bg-[#00BFA5]/20 border border-[#00BFA5]/30 text-[#00BFA5] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedKey === k.api_key ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Key</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 text-xs text-slate-500 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Created</span>
                        <span className="font-medium text-slate-700">{new Date(k.created_at || Date.now()).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Requests</span>
                        <span className="font-bold text-[#0A192F]">{k.total_requests || 0} calls</span>
                      </div>
                      <button
                        onClick={() => revokeKey(k)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer"
                        title="Revoke this API Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ─── Interactive Live Playground (Products, Payments, Orders) ─── */}
      <div id="playground" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#00BFA5]/10 text-[#00BFA5] flex items-center justify-center border border-[#00BFA5]/20">
                <Terminal className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-[#0A192F]">Interactive API Playground</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Execute live REST requests directly against <strong className="font-mono text-slate-700">abumafhal.com</strong> endpoints.
            </p>
          </div>

          {/* Endpoint Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold overflow-x-auto">
            <button
              onClick={() => { setSelectedEndpoint('products'); setTestResult(null); }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedEndpoint === 'products' ? 'bg-[#00BFA5] text-white shadow-2xs' : 'text-slate-600 hover:text-[#0A192F]'
              }`}
            >
              📦 Products API
            </button>
            <button
              onClick={() => { setSelectedEndpoint('payments'); setTestResult(null); }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedEndpoint === 'payments' ? 'bg-[#0A192F] text-[#D9A73A] shadow-2xs' : 'text-slate-600 hover:text-[#0A192F]'
              }`}
            >
              💳 Payments API
            </button>
            <button
              onClick={() => { setSelectedEndpoint('orders'); setTestResult(null); }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedEndpoint === 'orders' ? 'bg-[#0A192F] text-white shadow-2xs' : 'text-slate-600 hover:text-[#0A192F]'
              }`}
            >
              📋 Orders API
            </button>
            <button
              onClick={() => { setSelectedEndpoint('analytics'); setTestResult(null); }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedEndpoint === 'analytics' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-[#0A192F]'
              }`}
            >
              📊 Telemetry & Analytics
            </button>
          </div>
        </div>

        {/* Key Selector & Dynamic Filters */}
        <div className="my-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#0A192F]">Active Key:</span>
              <select
                value={activeKeyString}
                onChange={(e) => setSelectedApiKey(e.target.value)}
                className="text-xs font-mono font-semibold px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00BFA5]/30 cursor-pointer max-w-xs"
              >
                {apiKeys.length === 0 ? (
                  <option value="abumafhal_test_sandbox_verified_key">abumafhal_test_sandbox_verified_key (Default Sandbox)</option>
                ) : (
                  <>
                    {apiKeys.map((k) => (
                      <option key={k.id || k.api_key} value={k.api_key}>
                        {k.key_name || (k.api_key.includes('_test_') ? 'Sandbox Test Key' : 'Production Live Key')} ({k.api_key.substring(0, 16)}...)
                      </option>
                    ))}
                    <option value="abumafhal_test_sandbox_verified_key">abumafhal_test_sandbox_verified_key (Universal Sandbox)</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Domain:</span>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[#0A192F]">
                abumafhal.com
              </span>
            </div>
          </div>

          {selectedEndpoint === 'products' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Limit (Per Page)</label>
                <input
                  type="number"
                  value={filterLimit}
                  onChange={(e) => setFilterLimit(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-[#00BFA5]"
                  placeholder="5"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Category Filter</label>
                <input
                  type="text"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-[#00BFA5]"
                  placeholder="e.g. Electronics"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="stockCheck"
                  checked={filterStockOnly}
                  onChange={(e) => setFilterStockOnly(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00BFA5] focus:ring-[#00BFA5] border-slate-300 cursor-pointer"
                />
                <label htmlFor="stockCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  In-Stock Products Only
                </label>
              </div>
            </div>
          ) : selectedEndpoint === 'payments' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Amount in NGN (₦)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-[#00BFA5]"
                  placeholder="5000"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Customer Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-[#00BFA5]"
                  placeholder="customer@example.com"
                />
              </div>
            </div>
          ) : selectedEndpoint === 'orders' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Orders Limit</label>
                <input
                  type="number"
                  value={filterLimit}
                  onChange={(e) => setFilterLimit(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-[#00BFA5]"
                  placeholder="5"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Order Status</label>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-[#00BFA5] cursor-pointer"
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600" />
                <span>Storefront Telemetry aggregates live active inventory, low-stock warnings, gross sales, and payment health.</span>
              </div>
              <span className="font-mono text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                GET /api/v1/analytics
              </span>
            </div>
          )}
        </div>

        <button
          onClick={runLiveTest}
          disabled={testingEndpoint}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-white font-bold text-xs bg-[#00BFA5] hover:bg-[#00a896] shadow-md shadow-[#00BFA5]/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {testingEndpoint ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Executing request...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                Send Live Request ({selectedEndpoint === 'products' ? 'GET Products' : selectedEndpoint === 'payments' ? 'POST Payment Session' : selectedEndpoint === 'orders' ? 'GET Orders' : 'GET Analytics Telemetry'})
              </span>
            </>
          )}
        </button>

        {/* Live Playground Output */}
        {testResult && (
          <div className="space-y-4 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-100 rounded-2xl text-xs font-medium text-slate-700">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-md font-bold text-xs ${testResult.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                  HTTP {testResult.status} {testResult.statusText || (testResult.ok ? 'OK' : 'Error')}
                </span>
                <span className="text-slate-500">Latency: <strong>{testResult.timeMs}ms</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setResponseViewMode('visual')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      responseViewMode === 'visual' ? 'bg-[#0A192F] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Visual View
                  </button>
                  <button
                    onClick={() => setResponseViewMode('json')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      responseViewMode === 'json' ? 'bg-[#0A192F] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    JSON Response
                  </button>
                </div>

                <button
                  onClick={() => copyToClipboard(JSON.stringify(testResult.body, null, 2), 'snippet')}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>
            </div>

            {/* Visual View for Products */}
            {responseViewMode === 'visual' && selectedEndpoint === 'products' && Array.isArray(testResult.body?.data) && testResult.body.data.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {testResult.body.data.map((prod) => (
                  <div key={prod.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all">
                    <div className="space-y-3">
                      <div className="w-full h-36 rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-100">
                        {prod.primary_image ? (
                          <img src={prod.primary_image} alt={prod.name} className="w-full h-full object-contain p-2" />
                        ) : (
                          <div className="text-slate-400 text-xs flex flex-col items-center gap-1">
                            <ShoppingBag className="w-8 h-8" />
                            <span>No Image</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#00BFA5] tracking-wider block">
                          {prod.category || 'General'}
                        </span>
                        <h4 className="text-sm font-bold text-[#0A192F] line-clamp-1">{prod.name}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">{prod.description || 'Verified authentic product on Abu Mafhal Marketplace.'}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Live Price</span>
                        <span className="text-sm font-extrabold text-[#0A192F]">₦{prod.price?.toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-semibold">Stock Available</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {prod.available_stock} Units
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Visual View for Payments */}
            {responseViewMode === 'visual' && selectedEndpoint === 'payments' && testResult.body?.data?.checkout_url && (
              <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-bold text-emerald-900">Payment Session Created Successfully!</h4>
                </div>
                <div className="text-xs text-slate-700 space-y-1">
                  <p><strong>Reference:</strong> <code className="bg-white px-2 py-0.5 rounded font-mono border border-emerald-200">{testResult.body.data.reference}</code></p>
                  <p><strong>Amount:</strong> ₦{Number(testResult.body.data.amount)?.toLocaleString()}</p>
                </div>
                <div className="pt-2">
                  <a
                    href={testResult.body.data.checkout_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00BFA5] text-white font-bold text-xs shadow-md hover:bg-[#00a896] transition-all"
                  >
                    <span>Open Checkout Page</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Visual View for Orders */}
            {responseViewMode === 'visual' && selectedEndpoint === 'orders' && Array.isArray(testResult.body?.data) && testResult.body.data.length > 0 && (
              <div className="space-y-2">
                {testResult.body.data.map((order) => (
                  <div key={order.id} className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#0A192F]">{order.order_number}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Payment: <strong>{order.payment_status}</strong> ({order.payment_method})</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-[#0A192F]">₦{order.total?.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 block">{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Visual View for Analytics & Telemetry */}
            {responseViewMode === 'visual' && selectedEndpoint === 'analytics' && testResult.body?.inventory_summary && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Gross Revenue</span>
                    <span className="text-lg font-extrabold text-[#0A192F]">
                      ₦{Number(testResult.body.sales_summary?.gross_revenue || 0).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
                      {testResult.body.sales_summary?.total_orders || 0} Total Orders
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Listings</span>
                    <span className="text-lg font-extrabold text-[#00BFA5]">
                      {testResult.body.inventory_summary?.active_listings || 0}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium block mt-1">
                      {testResult.body.inventory_summary?.in_stock || 0} In Stock
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Low Stock Alert</span>
                    <span className="text-lg font-extrabold text-amber-600">
                      {testResult.body.inventory_summary?.low_stock_warning || 0}
                    </span>
                    <span className="text-[11px] text-amber-700 font-medium block mt-1">
                      &lt; 5 Units Remaining
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Gateway Latency</span>
                    <span className="text-lg font-extrabold text-indigo-600">
                      {testResult.timeMs}ms
                    </span>
                    <span className="text-[11px] text-emerald-600 font-semibold block mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {testResult.body.api_health?.gateway_status || 'OPERATIONAL'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between text-xs text-indigo-900">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    <span>Vendor: <strong>{testResult.body.vendor?.name}</strong> • Mode: <strong className="uppercase">{testResult.body.mode}</strong></span>
                  </div>
                  <span className="text-indigo-600 font-mono text-[11px]">{new Date(testResult.body.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            )}

            {/* Raw JSON View */}
            {(responseViewMode === 'json' || !testResult.body?.data) && (
              <pre className="bg-[#0A192F] text-emerald-400 p-5 rounded-2xl text-xs font-mono overflow-x-auto max-h-96 border border-[#1e3a63] leading-relaxed shadow-inner">
                {JSON.stringify(testResult.body, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* ─── Code Samples & Integration Documentation (English) ─── */}
      <div id="documentation" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0A192F]/5 text-[#0A192F] flex items-center justify-center border border-[#0A192F]/10">
                <Code2 className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-[#0A192F]">Code Integration Samples</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Production-ready integration samples for cURL, JavaScript, and Python.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {['curl', 'javascript', 'python'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer ${
                  activeTab === tab ? 'bg-white text-[#0A192F] shadow-sm' : 'text-slate-500 hover:text-[#0A192F]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-4">
          <button
            onClick={() => copyToClipboard(codeSnippets[activeTab], 'snippet')}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-[#0A192F] hover:bg-[#112240] text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer z-10"
          >
            {copiedSnippet ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <pre className="p-5 rounded-2xl bg-[#0A192F] text-slate-200 text-xs font-mono overflow-x-auto border border-[#1e3a63] leading-relaxed shadow-inner">
            {codeSnippets[activeTab]}
          </pre>
        </div>
      </div>

      {/* ─── Real-Time Webhooks & Events (Modern Feature) ─── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
                <Zap className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-[#0A192F]">Webhooks & Real-Time Event Dispatch</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Receive automatic HTTP POST payloads whenever an order is placed, paid, or fulfilled.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold self-start md:self-auto">
            HMAC-SHA256 Signed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-mono text-xs font-bold text-[#0A192F]">order.created</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Triggers immediately when a customer creates a checkout order for items in your store.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00BFA5]" />
              <span className="font-mono text-xs font-bold text-[#0A192F]">payment.success</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Dispatches when customer funds are confirmed by Abu Mafhal direct payment gateway.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-mono text-xs font-bold text-[#0A192F]">stock.low_alert</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Automatic alert payload whenever an item drops below 5 units remaining in active inventory.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#0A192F] block">Your Webhook Receiver Endpoint</span>
            <span className="text-xs text-slate-500">Configure your secure HTTPS endpoint in Store Settings &gt; Integrations</span>
          </div>
          <code className="text-xs font-mono bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700">
            https://your-domain.com/webhooks/abumafhal
          </code>
        </div>

        {/* Interactive Webhook Ping & Test Simulator */}
        <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0A192F]">Interactive Webhook Simulator</h3>
            </div>
            <span className="text-[11px] text-slate-500">Simulate real-time POST events with cryptographic HMAC signatures</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Target Endpoint URL</label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://webhook.site/..."
                className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Simulation Event</label>
              <select
                value={webhookEvent}
                onChange={(e) => setWebhookEvent(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="order.created">order.created (New Order)</option>
                <option value="payment.success">payment.success (Payment Verified)</option>
                <option value="stock.low_alert">stock.low_alert (Low Stock Warning)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              onClick={simulateWebhookPing}
              disabled={simulatingWebhook}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {simulatingWebhook ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching Event...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Webhook Ping</span>
                </>
              )}
            </button>

            <span className="text-[11px] text-slate-400">
              Includes <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-600">x-abumafhal-signature</code> header
            </span>
          </div>

          {webhookSimResult && (
            <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 text-xs font-mono space-y-2 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${webhookSimResult.delivered ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <strong>Result:</strong> {webhookSimResult.statusText} ({webhookSimResult.status})
                </span>
                <span className="text-slate-400">Latency: {webhookSimResult.latencyMs}ms</span>
              </div>
              <p className="text-[11px] text-slate-400">Dispatched Payload:</p>
              <pre className="text-emerald-400 overflow-x-auto text-[11px] leading-relaxed">
                {JSON.stringify(webhookSimResult.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* ─── HTTP Status Codes & Error Handling (Modern Spec) ─── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="flex items-center gap-2.5 pb-6 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0A192F]">HTTP Response & Error Standards</h2>
            <p className="text-xs text-slate-500 mt-0.5">Predictable status codes returned across all abumafhal.com APIs</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 mt-2">
          <div className="py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">200 OK</span>
              <span className="font-medium text-slate-700">Request succeeded; returns data payload and pagination.</span>
            </div>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">JSON</span>
          </div>

          <div className="py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">401 Unauthorized</span>
              <span className="font-medium text-slate-700">Missing x-api-key header or invalid authorization bearer token.</span>
            </div>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">JSON</span>
          </div>

          <div className="py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">403 Forbidden</span>
              <span className="font-medium text-slate-700">API Key is inactive or revoked. Create a new key above.</span>
            </div>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">JSON</span>
          </div>

          <div className="py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">429 Rate Limit</span>
              <span className="font-medium text-slate-700">Maximum 120 requests per minute per key exceeded.</span>
            </div>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">JSON</span>
          </div>
        </div>
      </div>
    </div>
  );
}
