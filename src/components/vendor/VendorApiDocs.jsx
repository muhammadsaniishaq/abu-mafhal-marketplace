import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import {
  Key, Copy, Check, Terminal, Code2, RefreshCw, Trash2,
  ExternalLink, Sparkles, BookOpen, AlertCircle, ArrowUpRight,
  ShieldCheck, Globe, Zap, Cpu, CheckCircle2, Lock, Eye, EyeOff,
  Database, Server, Layers, Play, CreditCard, DollarSign, Wallet
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

  // Live test playground state
  const [selectedApiEndpoint, setSelectedApiEndpoint] = useState('products'); // 'products' or 'payments'
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [filterLimit, setFilterLimit] = useState('5');
  const [filterStockOnly, setFilterStockOnly] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('5000');
  const [customerEmail, setCustomerEmail] = useState('buyer@example.com');

  const vendorId = currentUser?.id || currentUser?.uid;
  const officialDomain = 'https://www.abumafhal.com';
  const productsApiUrl = `${officialDomain}/api/v1/products`;
  const paymentsApiUrl = `${officialDomain}/api/v1/payments`;

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
        if (data.status === 'success' && Array.isArray(data.data)) {
          setApiKeys(data.data);
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
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
      setApiErrorMsg('An samu matsala wajen loda API Keys.');
    } finally {
      setLoading(false);
    }
  };

  const generateNewKey = async () => {
    if (!vendorId) return;
    setGenerating(true);
    setApiErrorMsg('');
    setApiSuccessMsg('');

    try {
      const res = await fetch('/api/v1/vendor-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendor_id: vendorId,
          key_name: newKeyName.trim() || (newKeyType === 'test' ? 'Sandbox Test Key' : 'Production Live Key'),
          key_type: newKeyType
        })
      });

      const result = await res.json();

      if (res.ok && result.status === 'success') {
        setApiSuccessMsg(`Sabon API Key (${newKeyType.toUpperCase()}) ya hadu cikin nasara a abumafhal.com!`);
        await loadKeys();
      } else {
        setApiErrorMsg(result.message || 'An samu matsala wajen samar da API Key.');
      }
    } catch (err) {
      console.error('API key generation error:', err);
      setApiErrorMsg('Network error while generating API key.');
    } finally {
      setGenerating(false);
    }
  };

  const revokeKey = async (keyId) => {
    if (!window.confirm('Shin kana da tabbacin kana son goge wannan API Key din?')) {
      return;
    }

    try {
      const res = await fetch('/api/v1/vendor-keys', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendor_id: vendorId,
          key_id: keyId
        })
      });

      if (res.ok) {
        setApiKeys(prev => prev.filter(k => k.id !== keyId));
        setApiSuccessMsg('An goge API Key cikin nasara.');
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

  // Pick first available key for playground / samples
  const activeKeyString = apiKeys.find(k => k.is_active !== false)?.api_key || 'abumafhal_live_YOUR_OFFICIAL_KEY';

  const runLiveTest = async () => {
    setTestingEndpoint(true);
    setTestResult(null);

    let testUrl = '';
    let options = {};

    if (selectedApiEndpoint === 'products') {
      const queryParams = new URLSearchParams();
      if (filterLimit) queryParams.append('limit', filterLimit);
      if (filterStockOnly) queryParams.append('in_stock_only', 'true');
      if (filterCategory) queryParams.append('category', filterCategory);
      testUrl = `${productsApiUrl}?${queryParams.toString()}`;
      options = {
        method: 'GET',
        headers: {
          'x-api-key': activeKeyString,
          'Accept': 'application/json'
        }
      };
    } else {
      // Payments Endpoint
      testUrl = paymentsApiUrl;
      options = {
        method: 'POST',
        headers: {
          'x-api-key': activeKeyString,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Number(paymentAmount) || 5000,
          customer_email: customerEmail || 'buyer@example.com',
          customer_name: 'Test Customer',
          metadata: { store: 'Abu Mafhal Vendor Partner' }
        })
      };
    }

    try {
      const startTime = performance.now();
      const res = await fetch(testUrl, options);
      const endTime = performance.now();
      const data = await res.json();
      setTestResult({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        timeMs: Math.round(endTime - startTime),
        url: testUrl,
        body: data
      });
    } catch (err) {
      setTestResult({
        status: 500,
        ok: false,
        timeMs: 0,
        url: testUrl,
        body: { error: err.message }
      });
    } finally {
      setTestingEndpoint(false);
    }
  };

  // Modern Clean Code Snippets
  const codeSnippets = {
    curl: selectedApiEndpoint === 'products'
      ? `# 1. Kira Kayan Shago (Products API - abumafhal.com)
curl -X GET "${productsApiUrl}?limit=20&in_stock_only=true" \\
  -H "x-api-key: ${activeKeyString}" \\
  -H "Accept: application/json"`
      : `# 2. Karbar Kudi / Kirkiri Checkout Session (Payments API)
curl -X POST "${paymentsApiUrl}" \\
  -H "x-api-key: ${activeKeyString}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "customer_email": "buyer@example.com",
    "customer_name": "Sani Bello",
    "metadata": { "order_note": "Direct purchase" }
  }'`,

    javascript: selectedApiEndpoint === 'products'
      ? `// JavaScript (Products API - abumafhal.com)
async function fetchProducts() {
  const response = await fetch("${productsApiUrl}?limit=20&in_stock_only=true", {
    method: "GET",
    headers: {
      "x-api-key": "${activeKeyString}",
      "Accept": "application/json"
    }
  });
  const { data } = await response.json();
  console.log("Products from Abu Mafhal:", data);
}
fetchProducts();`
      : `// JavaScript (Payments API - Initialize Checkout Session)
async function createPaymentSession() {
  const response = await fetch("${paymentsApiUrl}", {
    method: "POST",
    headers: {
      "x-api-key": "${activeKeyString}",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: 5000, // Naira
      customer_email: "buyer@example.com",
      customer_name: "Muhammad Sani"
    })
  });

  const { data } = await response.json();
  console.log("Payment Reference:", data.reference);
  console.log("Redirect Customer to:", data.checkout_url);
}
createPaymentSession();`,

    python: selectedApiEndpoint === 'products'
      ? `# Python 3 (Products API)
import requests

headers = { "x-api-key": "${activeKeyString}" }
res = requests.get("${productsApiUrl}", headers=headers, params={"limit": 20, "in_stock_only": "true"})
print(res.json())`
      : `# Python 3 (Payments API)
import requests

headers = {
    "x-api-key": "${activeKeyString}",
    "Content-Type": "application/json"
}
payload = {
    "amount": 5000,
    "customer_email": "buyer@example.com",
    "customer_name": "Sani"
}
res = requests.post("${paymentsApiUrl}", headers=headers, json=payload)
print(res.json())`
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16 font-sans">
      {/* ─── Hero Header: Modern Clean White Card with Soft Accents ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/90 p-8 lg:p-10 shadow-sm">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-teal-50 via-emerald-50/40 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-br from-indigo-50/40 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-3.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold tracking-wide uppercase shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              Abu Mafhal Developer Platform v1
            </div>

            <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
              Developer REST API & Payment Gateway
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed">
              Haɗa shagonka da dukkan manhajoji ko shafukan yanar gizo. 
              Kira hotuna (<strong className="text-teal-700 font-semibold">Images</strong>), farashi (<strong className="text-teal-700 font-semibold">Price</strong>), ragowar kaya (<strong className="text-teal-700 font-semibold">Stock</strong>), da kuma 
              karɓar kuɗi kai tsaye ta hanyar <strong className="text-teal-700 font-semibold">Payments API</strong> da amfani da <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">abumafhal.com</span>.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <Globe className="w-4 h-4 text-teal-600" />
                abumafhal.com
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                Integrated Paystack Payments
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <Zap className="w-4 h-4 text-amber-500" />
                Live & Test Sandboxes
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              onClick={() => {
                const el = document.getElementById('playground');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Gwajin API Live (Playground)</span>
            </button>
            <a
              href="#documentation"
              className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs border border-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-slate-600" />
              <span>Bayanin Code & Docs</span>
            </a>
          </div>
        </div>
      </div>

      {/* ─── Feedback Messages ─── */}
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

      {/* ─── API Keys Management Card (Live & Test Key Selector) ─── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                <Key className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">API Keys (Live & Test Environment)</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Zaka iya samar da <span className="text-emerald-700 font-bold">Live Key</span> domin ainihin ciniki, ko <span className="text-amber-700 font-bold">Test Key</span> domin gwaji da development.
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
                  newKeyType === 'live' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
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
                  newKeyType === 'test' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Test Key (Sandbox)
              </button>
            </div>

            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Sunan Key"
              className="text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all w-52 text-slate-800"
            />
            <button
              onClick={generateNewKey}
              disabled={generating}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
                  <span>Ana Kirkira...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Samar da Key</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Keys List */}
        <div className="mt-6">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
              <span>Ana duba API Keys dinka...</span>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="py-12 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-300 p-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Ba ka da wani API Key a halin yanzu</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Danna &quot;Samar da Key&quot; a sama don samun Live ko Test API Key.
              </p>
              <button
                onClick={generateNewKey}
                disabled={generating}
                className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-sm transition-all cursor-pointer"
              >
                Samar da API Key Yanzu
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
                        <span className="font-bold text-xs text-slate-900">{k.key_name || (isTest ? 'Sandbox Test Key' : 'Production Live Key')}</span>
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
                          title={isRevealed ? "Boye Key" : "Nuna Key"}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => copyToClipboard(k.api_key, 'key')}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedKey === k.api_key ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">An Kwafa!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Kwafi Key</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 text-xs text-slate-500 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Kwanan Wata</span>
                        <span className="font-medium text-slate-700">{new Date(k.created_at || Date.now()).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Kira</span>
                        <span className="font-bold text-slate-800">{k.total_requests || 0} calls</span>
                      </div>
                      <button
                        onClick={() => revokeKey(k.id)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer"
                        title="Goge wannan API Key"
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

      {/* ─── Live Playground: Toggle between Products API & Payments API ─── */}
      <div id="playground" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-200">
                <Terminal className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Gwajin API Live (Interactive Playground)</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Zaɓi endpoint ɗin da kake son gwadawa: Kayan Shago (<span className="text-teal-700 font-bold">Products API</span>) ko Karɓar Kuɗi (<span className="text-indigo-700 font-bold">Payments API</span>).
            </p>
          </div>

          {/* Endpoint Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => { setSelectedApiEndpoint('products'); setTestResult(null); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedApiEndpoint === 'products' ? 'bg-teal-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📦 Products API
            </button>
            <button
              onClick={() => { setSelectedApiEndpoint('payments'); setTestResult(null); }}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedApiEndpoint === 'payments' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💳 Payments API
            </button>
          </div>
        </div>

        {/* Dynamic Controls based on selected API */}
        {selectedApiEndpoint === 'products' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Limit (Adadin Kaya)</label>
              <input
                type="number"
                value={filterLimit}
                onChange={(e) => setFilterLimit(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-teal-500"
                placeholder="5"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Rukuni (Category)</label>
              <input
                type="text"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-teal-500"
                placeholder="e.g. Electronics"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="stockCheck"
                checked={filterStockOnly}
                onChange={(e) => setFilterStockOnly(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
              />
              <label htmlFor="stockCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Kayan da ke da stock kawai
              </label>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Kudi a Naira (Amount in NGN)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="5000"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Email na Mai Saye (Customer Email)</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-indigo-500"
                placeholder="buyer@example.com"
              />
            </div>
          </div>
        )}

        <button
          onClick={runLiveTest}
          disabled={testingEndpoint}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${
            selectedApiEndpoint === 'products' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {testingEndpoint ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Ana gudanar da kira...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Tura Gwajin Request ({selectedApiEndpoint === 'products' ? 'GET Products' : 'POST Create Payment'})</span>
            </>
          )}
        </button>

        {/* Live Playground Output */}
        {testResult && (
          <div className="space-y-2 mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-100 rounded-xl text-xs font-medium text-slate-700">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-md font-bold text-xs ${testResult.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                  HTTP {testResult.status} {testResult.statusText || (testResult.ok ? 'OK' : 'Error')}
                </span>
                <span className="text-slate-500">Lokaci: <strong>{testResult.timeMs}ms</strong></span>
              </div>

              <div className="flex items-center gap-3">
                <code className="text-[11px] font-mono text-slate-600 max-w-xs truncate hidden sm:inline-block">
                  {testResult.url}
                </code>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(testResult.body, null, 2), 'snippet')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kwafi JSON</span>
                </button>
              </div>
            </div>

            <pre className="bg-slate-950 text-emerald-400 p-5 rounded-2xl text-xs font-mono overflow-x-auto max-h-96 border border-slate-800 leading-relaxed shadow-inner">
              {JSON.stringify(testResult.body, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* ─── Code Samples & Integration Documentation ─── */}
      <div id="documentation" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                <Code2 className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Misalan Code na Haɗawa (Code Integration)</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Kwafi cikakken code na cURL, JavaScript, ko Python don amfani a shafinka ko manhajarka.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {['curl', 'javascript', 'python'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer ${
                  activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
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
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer z-10"
          >
            {copiedSnippet ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>An Kwafa!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Kwafi Code</span>
              </>
            )}
          </button>

          <pre className="p-5 rounded-2xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto border border-slate-800 leading-relaxed shadow-inner">
            {codeSnippets[activeTab]}
          </pre>
        </div>
      </div>
    </div>
  );
}
