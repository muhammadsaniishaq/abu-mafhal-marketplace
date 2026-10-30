import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import {
  Key, Copy, Check, Terminal, Code2, RefreshCw, Trash2,
  ExternalLink, Sparkles, BookOpen, AlertCircle, ArrowUpRight, Zap
} from 'lucide-react';

export default function VendorApiDocs() {
  const { currentUser } = useAuth();
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('Production Store API Key');
  const [activeTab, setActiveTab] = useState('curl');
  const [copiedKey, setCopiedKey] = useState(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [apiSuccessMsg, setApiSuccessMsg] = useState('');
  const [apiErrorMsg, setApiErrorMsg] = useState('');

  // Live test states
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const vendorId = currentUser?.id || currentUser?.uid;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.abumafhal.com';
  const productsApiUrl = `${baseUrl}/api/v1/products`;

  useEffect(() => {
    if (vendorId) {
      loadKeys();
    }
  }, [vendorId]);

  const loadKeys = async () => {
    setLoading(true);
    setApiErrorMsg('');
    try {
      // 1. Try fetching via API management endpoint
      const res = await fetch(`/api/v1/vendor-keys?vendor_id=${vendorId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
          setApiKeys(data.data);
          setLoading(false);
          return;
        }
      }

      // 2. Fallback: check app_settings
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
      setApiErrorMsg('Failed to load API keys. Please try refreshing.');
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
          key_name: newKeyName.trim() || 'Storefront Developer Key'
        })
      });

      const result = await res.json();

      if (res.ok && result.status === 'success') {
        setApiSuccessMsg('Sabon API Key ya hadu cikin nasara! Ka kiyaye shi a wuri mai tsaro.');
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
    if (!window.confirm('Shin kana da tabbacin kana son goge wannan API Key din? Duk wani website da ke amfani da shi zai daina aiki.')) {
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

  const activeKeyString = apiKeys.find(k => k.is_active !== false)?.api_key || 'abumafhal_live_YOUR_API_KEY_HERE';

  // Live Test API Request
  const runLiveTest = async () => {
    setTestingEndpoint(true);
    setTestResult(null);
    try {
      const res = await fetch(`${productsApiUrl}?limit=3`, {
        headers: {
          'x-api-key': activeKeyString
        }
      });
      const data = await res.json();
      setTestResult({
        status: res.status,
        ok: res.ok,
        body: data
      });
    } catch (err) {
      setTestResult({
        status: 500,
        ok: false,
        body: { error: err.message }
      });
    } finally {
      setTestingEndpoint(false);
    }
  };

  // Code Snippets
  const codeSnippets = {
    curl: `curl -X GET "${productsApiUrl}?limit=20&in_stock_only=true" \\
  -H "x-api-key: ${activeKeyString}" \\
  -H "Accept: application/json"`,

    javascript: `// JavaScript (Node.js or Frontend Fetch)
const fetchAvailableProducts = async () => {
  const response = await fetch("${productsApiUrl}?limit=20&in_stock_only=true", {
    method: "GET",
    headers: {
      "x-api-key": "${activeKeyString}",
      "Accept": "application/json"
    }
  });

  const result = await response.json();
  if (result.status === "success") {
    console.log("Total Available Products:", result.pagination.total_products);
    
    // Iterate products
    result.data.forEach(product => {
      console.log(\`📦 \${product.name}\`);
      console.log(\`💰 Price: ₦\${product.price.toLocaleString()}\`);
      console.log(\`📊 Stock: \${product.available_stock} items (\${product.stock_status})\`);
      console.log(\`🖼️ Image: \${product.primary_image}\`);
      console.log("-----------------------------------------");
    });
  } else {
    console.error("API Error:", result.message);
  }
};

fetchAvailableProducts();`,

    python: `# Python 3 (Requests)
import requests

API_URL = "${productsApiUrl}"
API_KEY = "${activeKeyString}"

headers = {
    "x-api-key": API_KEY,
    "Accept": "application/json"
}

params = {
    "limit": 20,
    "in_stock_only": "true",
    "sort_by": "created_at",
    "sort_order": "desc"
}

response = requests.get(API_URL, headers=headers, params=params)

if response.status_code == 200:
    data = response.json()
    products = data.get("data", [])
    print(f"Loaded {len(products)} products from Abu Mafhal Marketplace:")
    
    for item in products:
        print(f"• {item['name']} - ₦{item['price']:,} (Stock: {item['available_stock']})")
        print(f"  Image: {item['primary_image']}")
else:
    print(f"Error {response.status_code}: {response.text}")`
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0A192F] via-[#112240] to-[#0d2a4a] border border-[#1e3a63] p-6 lg:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00BFA5]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00BFA5]/20 border border-[#00BFA5]/40 text-[#00BFA5] text-xs font-bold tracking-wide uppercase">
              <Zap className="w-3.5 h-3.5" />
              Abu Mafhal Developer API
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
              Vendor Developer REST API & Webhooks
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Haɗa shagonka na Abu Mafhal da kowane website, mobile app, ko software na waje. 
              Kira hotunan kaya (<span className="text-[#00BFA5] font-semibold">Images</span>), farashi (<span className="text-[#00BFA5] font-semibold">Price</span>), da adadin da ya rage (<span className="text-[#00BFA5] font-semibold">Stock Quantity</span>) nan take cikin sauƙi.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              onClick={() => {
                const el = document.getElementById('playground');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#00BFA5] hover:bg-[#00a896] text-white font-bold text-xs shadow-lg shadow-[#00BFA5]/20 transition-all flex items-center justify-center gap-2"
            >
              <Terminal className="w-4 h-4" />
              <span>Gwajin API (Playground)</span>
            </button>
            <a
              href="#documentation"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/20 transition-all flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Documentation</span>
            </a>
          </div>
        </div>
      </div>

      {/* Messages */}
      {apiSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{apiSuccessMsg}</span>
          </div>
          <button onClick={() => setApiSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {apiErrorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{apiErrorMsg}</span>
          </div>
          <button onClick={() => setApiErrorMsg('')} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {/* API Keys Management Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-[#00BFA5]" />
              <h2 className="text-lg font-black text-slate-800">API Keys Dinka</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Yi amfani da waɗannan key wajen tabbatar da buƙatunka na API daga waje. Kar a raba wannan key ga wanda ba a yarda da shi ba.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Sunan Key (Misali: Web Store Key)"
              className="text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00BFA5]/20 focus:border-[#00BFA5] transition-all w-60"
            />
            <button
              onClick={generateNewKey}
              disabled={generating}
              className="px-4 py-2.5 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Ana Kirkira...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Samar da Sabon Key</span>
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
              <span>Ana duba API Keys...</span>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-8">
              <Key className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">Ba ka da wani API Key a halin yanzu</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Danna maballin &quot;Samar da Sabon Key&quot; a sama domin samun damar haɗa kayanka da wani website ko software.
              </p>
              <button
                onClick={generateNewKey}
                disabled={generating}
                className="px-4 py-2 rounded-xl bg-[#00BFA5] text-white text-xs font-bold hover:bg-[#00a896] shadow transition-all"
              >
                Kirkiri API Key Yanzu
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((k) => (
                <div
                  key={k.id || k.api_key}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-slate-50 transition-all gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800">{k.key_name || 'Production Key'}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 select-all">
                        {k.api_key}
                      </code>
                      <button
                        onClick={() => copyToClipboard(k.api_key, 'key')}
                        className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-500 hover:text-slate-700 transition-all"
                        title="Copy API Key"
                      >
                        {copiedKey === k.api_key ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 text-xs text-slate-500">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Kirkira</span>
                      <span>{new Date(k.created_at || Date.now()).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Kiran da aka yi</span>
                      <span className="font-semibold text-slate-700">{k.total_requests || 0} calls</span>
                    </div>
                    <button
                      onClick={() => revokeKey(k.id)}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-all"
                      title="Goge wannan API Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Playground / Quick Test */}
      <div id="playground" className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-black text-slate-800">Gwajin API Live (Playground)</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Gwajin kiran API ɗin kai tsaye don ganin yadda zai baka kaya, hotuna, farashi, da adadin stock na ainihi.
            </p>
          </div>

          <button
            onClick={runLiveTest}
            disabled={testingEndpoint}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {testingEndpoint ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Ana kira...</span>
              </>
            ) : (
              <>
                <ArrowUpRight className="w-4 h-4" />
                <span>Tura Gwajin Request (Send Test)</span>
              </>
            )}
          </button>
        </div>

        {/* Live response viewer */}
        {testResult && (
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">
                Sakamakon Amsa: Status <span className={`px-2 py-0.5 rounded ${testResult.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{testResult.status}</span>
              </span>
              <button
                onClick={() => copyToClipboard(JSON.stringify(testResult.body, null, 2), 'snippet')}
                className="text-[#00BFA5] hover:underline flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Kwafi JSON Response</span>
              </button>
            </div>
            <pre className="bg-[#0A192F] text-emerald-400 p-4 rounded-2xl text-xs font-mono overflow-x-auto max-h-96 border border-[#1e3a63]">
              {JSON.stringify(testResult.body, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Code Examples & Documentation */}
      <div id="documentation" className="bg-[#0A192F] rounded-3xl border border-[#1e3a63] text-white p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1e3a63]">
          <div>
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-[#00BFA5]" />
              <h2 className="text-lg font-black text-white">Yadda Zaka Haɗa da Code (Code Samples)</h2>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Zaɓi yaren da kake son amfani da shi domin kwafar code ɗin da ya dace.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#112240] p-1 rounded-xl border border-[#1e3a63]">
            {['curl', 'javascript', 'python'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all uppercase ${
                  activeTab === tab
                    ? 'bg-[#00BFA5] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Code View */}
        <div className="relative mt-4">
          <button
            onClick={() => copyToClipboard(codeSnippets[activeTab], 'snippet')}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all"
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
          <pre className="p-4 rounded-2xl bg-[#071324] text-slate-200 text-xs font-mono overflow-x-auto border border-[#152744] leading-relaxed">
            {codeSnippets[activeTab]}
          </pre>
        </div>

        {/* Endpoint Reference Table */}
        <div className="mt-8 pt-6 border-t border-[#1e3a63]">
          <h3 className="text-sm font-bold text-white mb-3">API Query Parameters & Filters</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1e3a63] text-slate-400">
                  <th className="py-2.5 pr-4 font-bold">Parameter</th>
                  <th className="py-2.5 px-4 font-bold">Type</th>
                  <th className="py-2.5 px-4 font-bold">Default</th>
                  <th className="py-2.5 pl-4 font-bold">Bayanin Aiki</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e3a63]/60 text-slate-300">
                <tr>
                  <td className="py-2.5 pr-4 font-mono text-[#00BFA5]">limit</td>
                  <td className="py-2.5 px-4 text-slate-400">number</td>
                  <td className="py-2.5 px-4 text-slate-400">50</td>
                  <td className="py-2.5 pl-4">Adadin kayan da za a dawo da su a kowane kira (Max: 100).</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-mono text-[#00BFA5]">page</td>
                  <td className="py-2.5 px-4 text-slate-400">number</td>
                  <td className="py-2.5 px-4 text-slate-400">1</td>
                  <td className="py-2.5 pl-4">Shashin shafi na pagination don duba sauran kaya.</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-mono text-[#00BFA5]">in_stock_only</td>
                  <td className="py-2.5 px-4 text-slate-400">boolean</td>
                  <td className="py-2.5 px-4 text-slate-400">false</td>
                  <td className="py-2.5 pl-4">Idan aka sa <code className="text-amber-400">true</code>, kayan da ke da available stock kadai zasu fito.</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-mono text-[#00BFA5]">search</td>
                  <td className="py-2.5 px-4 text-slate-400">string</td>
                  <td className="py-2.5 px-4 text-slate-400">-</td>
                  <td className="py-2.5 pl-4">Neman kaya ta sunansa ko nau&apos;insa (e.g. &apos;iPhone&apos;).</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-mono text-[#00BFA5]">category</td>
                  <td className="py-2.5 px-4 text-slate-400">string</td>
                  <td className="py-2.5 px-4 text-slate-400">All</td>
                  <td className="py-2.5 pl-4">Tace kaya ta rukunin rukuni (e.g. &apos;Electronics&apos;, &apos;Fashion&apos;).</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-mono text-[#00BFA5]">min_price / max_price</td>
                  <td className="py-2.5 px-4 text-slate-400">number</td>
                  <td className="py-2.5 px-4 text-slate-400">-</td>
                  <td className="py-2.5 pl-4">Tace kaya gwargwadon farashin Naira.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
