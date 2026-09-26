import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { 
    FiChevronRight, FiSave, FiSettings, FiCheck, FiX, FiInfo, FiUploadCloud, FiNavigation,
    FiSmartphone, FiDownloadCloud, FiExternalLink, FiCopy, FiRefreshCw, FiAlertTriangle, FiCheckCircle
} from 'react-icons/fi';

const CATEGORIES = [
    { id: 'branding', label: 'Brand & Display' },
    { id: 'financial', label: 'Finance & Gateway' },
    { id: 'shipping', label: 'Shipping & Tax' },
    { id: 'security', label: 'Security & Auth' },
    { id: 'vendors', label: 'Vendor Controls' },
    { id: 'contact', label: 'Contact & Social' },
    { id: 'features', label: 'Feature Flags' },
    { id: 'app_update', label: 'Play Store & Version' },
    { id: 'advanced', label: 'Advanced System' },
];

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'];

const NIGERIA_STATES = [
    'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
    'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT (Abuja)','Gombe',
    'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara',
    'Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau',
    'Rivers','Sokoto','Taraba','Yobe','Zamfara'
];

const AdminSettings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('branding');
    const [unsaved, setUnsaved] = useState(false);
    const [toast, setToast] = useState('');
    const [copied, setCopied] = useState(false);

    // --- Unified Settings State ---
    const [settings, setSettings] = useState({});

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*');

            if (error) throw error;
            if (data && data.length > 0) {
                const merged = {};
                data.forEach(r => {
                    if (r.key) {
                        merged[r.key] = typeof r.value === 'object' && r.value !== null && 'value' in r.value && Object.keys(r.value).length === 1
                            ? r.value.value
                            : r.value;
                    }
                });

                if (merged.payment_gateways && typeof merged.payment_gateways === 'object') {
                    Object.assign(merged, merged.payment_gateways);
                }

                // Initialize arrays/objects if null
                if (!merged.shipping_fees) {
                    const defaultFees = {};
                    NIGERIA_STATES.forEach(s => defaultFees[s] = ['Lagos', 'FCT (Abuja)', 'Rivers', 'Kano', 'Ogun'].includes(s) ? 1500 : 3000);
                    merged.shipping_fees = defaultFees;
                }
                if (!merged.payment_methods) merged.payment_methods = { paystack: true, flutterwave: true, nowpayments: true, wallet: true, pod: true };
                if (!merged.features) merged.features = {};
                
                // Play Store & Version defaults
                if (!merged.latest_app_version) merged.latest_app_version = '1.0.0';
                if (!merged.min_required_version) merged.min_required_version = '1.0.0';
                if (merged.force_update_enabled === undefined) merged.force_update_enabled = false;
                if (!merged.play_store_url) merged.play_store_url = 'https://play.google.com/store/apps/details?id=com.abumafhal.app';
                if (!merged.update_title) merged.update_title = 'Sabon Version Ya Fito A Play Store!';
                if (!merged.update_message) merged.update_message = 'Muna bukatar kayi update na manhajar Abu Mafhal zuwa sabon version domin samun sabbin fasaloli da ingantaccen tsaro kafin ka shiga.';
                if (!merged.update_release_notes) merged.update_release_notes = '• Karin sabbin fasaloli da inganta saurin manhaja\n• Sabon tsarin VIP Pass da katin shaida mai lambar QR\n• Karin tsaro ga asusunka da tsarin biyan kudi\n• Gyaran kurakurai da saukaka saye da sayarwa';

                setSettings(merged);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            setToast('Error loading configurations.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        if(e) e.preventDefault();
        setSaving(true);
        try {
            // 1. Save payment gateways dedicated group
            const gatewayKeys = {
                paystack_public_key: settings.paystack_public_key || '',
                paystack_secret_key: settings.paystack_secret_key || '',
                flutterwave_public_key: settings.flutterwave_public_key || '',
                flutterwave_secret_key: settings.flutterwave_secret_key || '',
                nowpayments_api_key: settings.nowpayments_api_key || '',
                nowpayments_ipn_key: settings.nowpayments_ipn_key || '',
                updated_at: new Date().toISOString()
            };

            try {
                await supabase.rpc('save_payment_gateways', { gateway_data: gatewayKeys });
            } catch (_) {}

            try {
                await supabase
                    .from('app_settings')
                    .upsert({
                        key: 'payment_gateways',
                        value: gatewayKeys,
                        description: 'Authoritative Payment Gateways Credentials',
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
            } catch (_) {}

            // 2. Save each key-value setting
            for (const [k, val] of Object.entries(settings)) {
                if (val !== undefined && k !== 'payment_gateways' && k !== 'shipping_fees' && k !== 'id' && k !== 'created_at' && k !== 'updated_at') {
                    const payload = typeof val === 'object' ? val : { value: val };
                    try {
                        const { error: rpcErr } = await supabase.rpc('save_app_setting', {
                            p_key: k,
                            p_value: payload,
                            p_description: `Platform setting: ${k}`
                        });
                        if (rpcErr) throw rpcErr;
                    } catch (_) {
                        try {
                            await supabase
                                .from('app_settings')
                                .upsert({
                                    key: k,
                                    value: payload,
                                    description: `Platform setting: ${k}`,
                                    updated_at: new Date().toISOString()
                                }, { onConflict: 'key' });
                        } catch (_) {}
                    }
                }
            }

            setUnsaved(false);
            setToast('Configurations saved and synced globally.');
            setTimeout(() => setToast(''), 4000);
        } catch (error) {
            console.error('Error saving settings:', error);
            setToast('Error saving configurations.');
        } finally {
            setSaving(false);
        }
    };

    const updateField = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setUnsaved(true);
    };

    const updateNestedField = (parentObj, key, value) => {
        setSettings(prev => ({
            ...prev,
            [parentObj]: { ...(prev[parentObj] || {}), [key]: value }
        }));
        setUnsaved(true);
    };

    // --- Play Store & Version Bump Helpers ---
    const bumpVersion = (field, type) => {
        const current = String(settings[field] || '1.0.0').replace(/^v/i, '').trim();
        const parts = current.split('.').map(n => parseInt(n, 10) || 0);
        while (parts.length < 3) parts.push(0);

        if (type === 'patch') {
            parts[2] = parts[2] + 1;
        } else if (type === 'minor') {
            parts[1] = parts[1] + 1;
            parts[2] = 0;
        } else if (type === 'major') {
            parts[0] = parts[0] + 1;
            parts[1] = 0;
            parts[2] = 0;
        }
        const newVer = parts.slice(0, 3).join('.');
        updateField(field, newVer);
    };

    const syncMinWithLatest = () => {
        updateField('min_required_version', settings.latest_app_version || '1.0.0');
    };

    const resetMinToDefault = () => {
        updateField('min_required_version', '1.0.0');
    };

    const applyReleaseNotesTemplate = (type) => {
        if (type === 'general') {
            updateField('update_title', 'Sabon Version Ya Fito A Play Store! 🚀');
            updateField('update_message', 'Muna bukatar kayi update na manhajar Abu Mafhal zuwa sabon version domin samun sabbin fasaloli da ingantaccen tsaro kafin ka shiga.');
            updateField('update_release_notes', '• Karin sabbin fasaloli da inganta saurin manhaja\n• Sabon tsarin VIP Pass da katin shaida mai lambar QR\n• Karin tsaro ga asusunka da tsarin biyan kudi\n• Gyaran kurakurai da saukaka saye da sayarwa');
        } else if (type === 'security') {
            updateField('update_title', 'Sabuntawar Tsaro da Asusu 🔒');
            updateField('update_message', 'Wannan sabuntawar tana da matukar muhimmanci domin tsaron asusunka da ingantaccen tsarin biyan kudi.');
            updateField('update_release_notes', '• Karfafa tsaron asusun masu amfani\n• Inganta hanyoyin biyan kudi da walat\n• Kariyar sirri da gyaran tsarin tantancewa');
        } else if (type === 'market') {
            updateField('update_title', 'Sabbin Fasaloli da More Rayuwa! 🎉');
            updateField('update_message', 'Muna alfaharin sanar da kai sabbin hanyoyin ciniki da katin shaida mai lambar QR!');
            updateField('update_release_notes', '• Sabon tsarin katin shaida mai lambar QR\n• Sabon tsarin rajistar shagunan VIP\n• Saukin neman kaya da duba makota\n• Inganta saurin karbar oda da isarwa');
        }
    };

    const copyPlayStoreUrl = () => {
        const url = settings.play_store_url || 'https://play.google.com/store/apps/details?id=com.abumafhal.app';
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[500px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    // --- UI Helpers ---
    const InputField = ({ label, field, type = 'text', placeholder, hint, prefix }) => (
        <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
            <div className="relative">
                {prefix && <span className="absolute left-3 top-2.5 text-gray-500">{prefix}</span>}
                <input
                    type={type}
                    value={settings[field] === undefined || settings[field] === null ? '' : settings[field]}
                    onChange={(e) => updateField(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                    placeholder={placeholder}
                    className={`w-full ${prefix ? 'pl-8' : 'px-4'} py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all`}
                />
            </div>
            {hint && <p className="text-xs text-gray-500 mt-1.5">{hint}</p>}
        </div>
    );

    const TextAreaField = ({ label, field, rows = 3, placeholder, hint }) => (
        <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
            <textarea
                rows={rows}
                value={settings[field] === undefined || settings[field] === null ? '' : settings[field]}
                onChange={(e) => updateField(field, e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-mono text-sm leading-relaxed"
            />
            {hint && <p className="text-xs text-gray-500 mt-1.5">{hint}</p>}
        </div>
    );

    const Toggle = ({ label, field, hint, nestedObj }) => {
        const value = nestedObj ? settings[nestedObj]?.[field] : settings[field];
        // Note: Checkbox logic inverted if default is true, but we assume true means checked.
        const checked = value !== false; // defaults to true if undefined

        return (
            <div className="flex items-start gap-3 mb-5 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                        if (nestedObj) updateNestedField(nestedObj, field, e.target.checked);
                        else updateField(field, e.target.checked);
                    }}
                    className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500 mt-0.5"
                />
                <div>
                    <label className="font-semibold text-gray-800 cursor-pointer">{label}</label>
                    {hint && <p className="text-sm text-gray-500 leading-snug mt-0.5">{hint}</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto pb-24">
            
            {/* Header Area */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Platform Configurations</h1>
                    <p className="text-gray-500 mt-1">Manage global marketplace settings. Changes sync instantly to Web and Mobile applications.</p>
                </div>
                
                <button
                    onClick={handleSave}
                    disabled={saving || !unsaved}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all duration-200 ${
                        unsaved 
                            ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/30' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"/> : <FiSave />}
                    {saving ? 'Deploying...' : unsaved ? 'Deploy Changes' : 'Up to Date'}
                </button>
            </div>

            {toast && (
                <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 flex items-center gap-3 text-green-800 shadow-sm animate-fade-in">
                    <FiCheck className="text-green-600 text-lg" />
                    <span className="font-medium">{toast}</span>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:w-64 flex-shrink-0">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden sticky top-4">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveTab(cat.id)}
                                className={`w-full text-left px-5 py-3.5 border-l-4 transition-all flex items-center justify-between ${
                                    activeTab === cat.id 
                                        ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold' 
                                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                            >
                                {cat.label}
                                {activeTab === cat.id && <FiChevronRight className="opacity-50" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                        
                        {/* 1. BRANDING & DISPLAY */}
                        {activeTab === 'branding' && (
                            <div className="animate-fade-in">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Branding & Identity</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                    <InputField label="Application Name" field="app_name" placeholder="Abu Mafhal Marketplace" />
                                    <InputField label="Admin Panel Name" field="admin_name" hint="(Displayed in admin headers)" />
                                    
                                    <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 border-b border-gray-100 pb-6">
                                        <div>
                                            <InputField label="Primary Brand Color" field="primary_color" placeholder="#0F172A" />
                                            <div className="h-2 w-full rounded" style={{ backgroundColor: settings.primary_color || '#0F172A' }} />
                                        </div>
                                        <div>
                                            <InputField label="Secondary Brand Color" field="secondary_color" placeholder="#3B82F6" />
                                            <div className="h-2 w-full rounded" style={{ backgroundColor: settings.secondary_color || '#3B82F6' }} />
                                        </div>
                                    </div>

                                    <div className="col-span-full">
                                        <h3 className="font-semibold text-gray-800 mb-4">Logo References (URLs)</h3>
                                    </div>
                                    <InputField label="Main Logo URL" field="logo_url" />
                                    <InputField label="Certificate Logo URL" field="cert_logo_url" />
                                    <InputField label="Trust Badge URL" field="cert_badge_url" />
                                    <InputField label="Signature Image URL" field="cert_signature_url" />
                                </div>
                            </div>
                        )}

                        {/* 2. FINANCE & GATEWAYS */}
                        {activeTab === 'financial' && (
                            <div className="animate-fade-in">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Financial Architecture</h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                    <div className="mb-5">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Base Currency</label>
                                        <select 
                                            value={settings.currency || 'NGN'} 
                                            onChange={(e) => updateField('currency', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                                        >
                                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <InputField type="number" label="Platform Commission (%)" field="commission_rate" hint="Deducted directly from vendor payouts." />
                                    <InputField type="number" label="Minimum Cart Order Amount" field="min_order_amount" />
                                    <InputField type="number" label="Affiliate Reward Rate (%)" field="affiliate_rate" />
                                    
                                    <div className="col-span-full mt-6 mb-4">
                                        <h3 className="font-semibold text-gray-800 border-b pb-2">Allowed Payment Gateways</h3>
                                    </div>
                                    <Toggle label="Paystack Integration" field="paystack" nestedObj="payment_methods" />
                                    <Toggle label="Flutterwave Integration" field="flutterwave" nestedObj="payment_methods" />
                                    <Toggle label="Crypto Payments (NOWPayments)" field="crypto" nestedObj="payment_methods" />
                                    <Toggle label="Customer Internal Wallet" field="wallet" nestedObj="payment_methods" />

                                    <div className="col-span-full mt-6 mb-4">
                                        <h3 className="font-semibold text-gray-800 border-b pb-2 text-rose-700">Gateway API Secrets</h3>
                                    </div>
                                    <InputField type="password" label="Paystack Public Key" field="paystack_public_key" placeholder="pk_live_... or pk_test_..." />
                                    <InputField type="password" label="Paystack Secret Key" field="paystack_secret_key" placeholder="sk_live_... or sk_test_..." />
                                    <InputField type="password" label="Flutterwave Public Key" field="flutterwave_public_key" placeholder="FLWPUBK-... or FLWPUBK_TEST-..." />
                                    <InputField type="password" label="Flutterwave Secret Key" field="flutterwave_secret_key" placeholder="FLWSECK-... or FLWSECK_TEST-..." />
                                    <InputField type="password" label="NOWPayments API Key" field="nowpayments_api_key" placeholder="Enter NOWPayments API Key..." />
                                    <InputField type="password" label="NOWPayments IPN Secret Key" field="nowpayments_ipn_key" placeholder="Enter NOWPayments IPN Key..." />
                                </div>
                            </div>
                        )}

                        {/* 3. SHIPPING & TAX */}
                        {activeTab === 'shipping' && (
                            <div className="animate-fade-in">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Shipping & Taxation</h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 mb-8">
                                    <div className="col-span-full mb-4">
                                        <InputField label="Fallback Headquarters Shipping Address" field="default_shipping_address" placeholder="e.g. Main Commercial Plaza, Bade / Gashua, Yobe State" hint="Main HQ dispatch address used across marketplace calculations." />
                                    </div>

                                    <Toggle label="Enable Tax (VAT) Calculation" field="tax_enabled" />
                                    {settings.tax_enabled !== false && (
                                        <InputField type="number" label="Global Tax Rate (%)" field="tax_rate" />
                                    )}
                                    
                                    <Toggle label="Override: Free Nationwide Shipping" field="free_nationwide_shipping" hint="Forces shipping calculation to 0 regardless of state." />
                                    <InputField type="number" label="Auto-Free Shipping Cart Minimum" field="free_shipping_min" hint="Cart value to trigger free shipping automatically." />
                                </div>

                                <div className="mt-4 p-5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-sm">
                                            <FiNavigation className="text-xl" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-base">Dynamic GPS Longitude &amp; Latitude Engine Active</h3>
                                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                                Static per-state shipping fees have been deprecated. Delivery fees are now measured in real-time using GPS coordinates (Latitude &amp; Longitude) via the Haversine distance formula between Vendor warehouse coordinates and Buyer delivery coordinates.
                                            </p>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center text-xs font-semibold text-blue-800 bg-blue-100/80 py-1 px-3 rounded-full">
                                                    ✓ Base Fee + (Distance KM × Price/KM) + Handling Fee
                                                </span>
                                                <span className="inline-flex items-center text-xs font-semibold text-emerald-800 bg-emerald-100/80 py-1 px-3 rounded-full">
                                                    ✓ Store Pickup is 100% Free (₦0)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 4. SECURITY & AUTH */}
                        {activeTab === 'security' && (
                            <div className="animate-fade-in">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Security & Authorizations</h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                    <Toggle label="Allow Guest Store Browsing" field="allow_guest_browse" hint="If disabled, users are forced to login before seeing products." />
                                    <Toggle label="Enable Waitlist / Pre-registration" field="enable_waitlist" />
                                    
                                    <div className="col-span-full mt-6 mb-4">
                                        <h3 className="font-semibold text-gray-800 border-b pb-2">Third-Party Verification Keys</h3>
                                    </div>
                                    <InputField type="password" label="Prembly App ID (Identity)" field="prembly_app_id" />
                                    <InputField type="password" label="Prembly Secret Key" field="prembly_secret_key" />
                                </div>
                            </div>
                        )}

                        {/* 5. VENDORS */}
                        {activeTab === 'vendors' && (
                            <div className="animate-fade-in">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Vendor Ecosystem</h2>
                                
                                <Toggle label="Auto-Approve Vendors" field="vendor_auto_approve" hint="Bypass manual review for new vendor registrations." />
                                
                                <h3 className="font-semibold text-gray-800 mt-6 mb-4 border-b pb-2">Vendor Subscription Plans</h3>
                                <p className="text-sm text-gray-500 mb-4">Note: Modify plan structures directly via database migrations currently.</p>
                                
                                {settings.vendor_plans && settings.vendor_plans.map((plan, i) => (
                                    <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-4 flex justify-between items-center">
                                        <div>
                                            <h4 className="font-bold text-gray-800">{plan.name}</h4>
                                            <p className="text-sm text-gray-500">{plan.duration_months} Months • Fee: {settings.currency || '₦'} {plan.price}</p>
                                        </div>
                                        <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Active</div>
                                    </div>
                                ))}
                                {(!settings.vendor_plans || settings.vendor_plans.length === 0) && (
                                    <p className="text-gray-400 italic text-sm">No vendor plans mapped.</p>
                                )}
                            </div>
                        )}

                        {/* 6. CONTACT & SOCIAL */}
                        {activeTab === 'contact' && (
                            <div className="animate-fade-in">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Contact & Social Links</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                    <InputField label="Support Email" field="support_email" />
                                    <InputField label="Support Phone Number" field="support_phone" />
                                    <InputField label="WhatsApp Number" field="whatsapp_number" />
                                    
                                    <div className="col-span-full mt-4"></div>
                                    <InputField label="Facebook Page URL" field="facebook_url" />
                                    <InputField label="Instagram Handle (w/o @)" field="instagram_handle" />
                                    <InputField label="Twitter/X Handle" field="twitter_handle" />
                                    <InputField label="TikTok Handle" field="tiktok_handle" />

                                    <div className="col-span-full mt-4 mb-2 border-b pb-2"><h3 className="font-semibold text-gray-800">App Download Links</h3></div>
                                    <InputField label="Google Play Store URL" field="play_store_url" />
                                    <InputField label="Apple App Store URL" field="app_store_url" />
                                </div>
                            </div>
                        )}

                        {/* 7. FEATURES */}
                        {activeTab === 'features' && (
                            <div className="animate-fade-in">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Platform Features</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                    {/* Commerce Features */}
                                    <Toggle label="Enable Promotional Coupons" field="enable_coupons" />
                                    <Toggle label="Enable Product Returns" field="enable_returns" />
                                    <Toggle label="Enable Product Reviews Flow" field="enable_reviews" />
                                    <Toggle label="Enable Driver Ratings Flow" field="enable_ratings" />
                                    <Toggle label="Enable Affiliate/Referral System" field="enable_affiliate" />
                                    <Toggle label="Enable Live Chat Support" field="enable_live_chat" />

                                    {/* Order State Labels */}
                                    <div className="col-span-full mt-6 mb-4"><h3 className="font-semibold text-gray-800 border-b pb-2">Order State Terminology</h3></div>
                                    <InputField label="Pending State Label" field="order_label_pending" placeholder="Pending" />
                                    <InputField label="Shipped State Label" field="order_label_shipped" placeholder="Shipped" />
                                    <InputField label="Delivered State Label" field="order_label_delivered" placeholder="Delivered" />
                                    <InputField label="Cancelled State Label" field="order_label_cancelled" placeholder="Cancelled" />
                                    
                                    <div className="col-span-full mt-2"><InputField type="number" label="Max Product Images per Upload" field="max_product_images" /></div>
                                </div>
                            </div>
                        )}

                        {/* PLAY STORE & VERSION CONTROL */}
                        {activeTab === 'app_update' && (
                            <div className="animate-fade-in">
                                {/* Top Banner / Hub */}
                                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 mb-8 text-white shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-3xl shadow-inner">
                                                <FiSmartphone />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Google Play Store Hub</span>
                                                    <span className="text-xs text-slate-400">Package: <code className="text-emerald-400 font-mono">com.abumafhal.app</code></span>
                                                </div>
                                                <h2 className="text-2xl font-black mt-1">Play Store Version & Force Update</h2>
                                                <p className="text-slate-300 text-sm mt-0.5">Saita sabon version na manhaja, gindaya dokar tilas (force update), da rubuta abubuwan da aka inganta.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 self-start md:self-auto">
                                            <button
                                                type="button"
                                                onClick={copyPlayStoreUrl}
                                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 transition-all shadow-sm"
                                            >
                                                {copied ? <FiCheck className="text-emerald-400" /> : <FiCopy />}
                                                {copied ? 'An Kwafi Link!' : 'Kwafi Link'}
                                            </button>
                                            <a
                                                href={settings.play_store_url || 'https://play.google.com/store/apps/details?id=com.abumafhal.app'}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-900/30"
                                            >
                                                <FiExternalLink />
                                                Bude Play Store
                                            </a>
                                        </div>
                                    </div>

                                    {/* Status Chips */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-700/80">
                                        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 flex items-center justify-between">
                                            <span className="text-xs text-slate-400 font-medium">Sabuwar Siga (Latest):</span>
                                            <span className="text-sm font-extrabold text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/20">
                                                v{settings.latest_app_version || '1.0.0'}
                                            </span>
                                        </div>
                                        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 flex items-center justify-between">
                                            <span className="text-xs text-slate-400 font-medium">Mafi Karanci (Min Req):</span>
                                            <span className="text-sm font-extrabold text-amber-400 font-mono bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/20">
                                                v{settings.min_required_version || '1.0.0'}
                                            </span>
                                        </div>
                                        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 flex items-center justify-between">
                                            <span className="text-xs text-slate-400 font-medium">Yanayin Tilastawa:</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                settings.force_update_enabled
                                                    ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                                                    : 'bg-blue-950/60 text-blue-300 border border-blue-500/30'
                                            }`}>
                                                {settings.force_update_enabled ? 'Strict Lock (Tilas)' : 'Flexible (Zabi)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Main 2-column workspace */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                    {/* Left Side: Controls & Inputs (7 cols) */}
                                    <div className="lg:col-span-7 space-y-6">
                                        {/* Version Manager */}
                                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                                            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                                                        <FiDownloadCloud className="text-primary-600" />
                                                        Version Control (Saita Sigar Manhaja)
                                                    </h3>
                                                    <p className="text-xs text-gray-500 mt-0.5">Saita sabon lambar version da kuma mafi karancin version da ake bukata.</p>
                                                </div>
                                            </div>

                                            {/* Latest App Version */}
                                            <div className="mb-5">
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-sm font-semibold text-gray-800">
                                                        Latest Published Version (Sabuwar Sigar da Ke Play Store)
                                                    </label>
                                                    <span className="text-xs text-gray-400 font-mono">Format: X.Y.Z</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={settings.latest_app_version || '1.0.0'}
                                                    onChange={(e) => updateField('latest_app_version', e.target.value)}
                                                    placeholder="1.0.1"
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono font-bold text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                                />
                                                {/* Version Bump Quick Pills */}
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-xs text-gray-500 font-medium">Karin Sauri:</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => bumpVersion('latest_app_version', 'patch')}
                                                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-colors"
                                                    >
                                                        +0.0.1 (Patch / Gyara)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => bumpVersion('latest_app_version', 'minor')}
                                                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                                                    >
                                                        +0.1.0 (Sabon Fasali)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => bumpVersion('latest_app_version', 'major')}
                                                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors"
                                                    >
                                                        +1.0.0 (Babban Canji)
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Minimum Required Version */}
                                            <div className="mb-4 pt-3 border-t border-gray-100">
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-sm font-semibold text-gray-800">
                                                        Minimum Required Version (Mafi Karancin Version da Zai Bude Manhaja)
                                                    </label>
                                                    <span className="text-xs text-amber-600 font-medium font-mono">Dole ne ya dace ko ya fi</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={settings.min_required_version || '1.0.0'}
                                                    onChange={(e) => updateField('min_required_version', e.target.value)}
                                                    placeholder="1.0.0"
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono font-bold text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                                />
                                                <div className="flex items-center gap-2 mt-2">
                                                    <button
                                                        type="button"
                                                        onClick={syncMinWithLatest}
                                                        className="px-3 py-1 text-xs font-semibold rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
                                                    >
                                                        Yi Daidai da Sabon Version (Sync = {settings.latest_app_version || '1.0.0'})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={resetMinToDefault}
                                                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 transition-colors"
                                                    >
                                                        Maida 1.0.0
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                                                    💡 <strong>Yadda tsarin yake:</strong> Idan wani yana amfani da version da yake ƙasa da <em>Minimum Required Version</em>, manhaja zata hana shi shiga har sai yaje Google Play Store yayi update.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Play Store URL & Force Toggle */}
                                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
                                            <h3 className="font-bold text-gray-900 text-base border-b border-gray-100 pb-3 flex items-center gap-2">
                                                <FiExternalLink className="text-emerald-600" />
                                                Play Store URL & Yanayin Tilastawa
                                            </h3>

                                            <InputField
                                                label="Google Play Store Download URL"
                                                field="play_store_url"
                                                placeholder="https://play.google.com/store/apps/details?id=com.abumafhal.app"
                                                hint="Wannan shine link din da ke bude Google Play Store kai tsaye idan mai amfani ya danna 'YI UPDATE YANZU'."
                                            />

                                            {/* Force Update Toggle */}
                                            <div className="pt-2">
                                                <div className={`p-4 rounded-xl border transition-all ${
                                                    settings.force_update_enabled
                                                        ? 'bg-rose-50/70 border-rose-200'
                                                        : 'bg-emerald-50/60 border-emerald-200'
                                                }`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-start gap-3">
                                                            <div className={`mt-0.5 p-2 rounded-lg text-lg ${
                                                                settings.force_update_enabled ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                                                            }`}>
                                                                {settings.force_update_enabled ? <FiAlertTriangle /> : <FiCheckCircle />}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-gray-900 text-sm">
                                                                    Kunna Tilastawa (Force Update Enabled)
                                                                </h4>
                                                                <p className="text-xs text-gray-600 mt-0.5">
                                                                    {settings.force_update_enabled
                                                                        ? '🚨 Strict Lock Kunne: Ba za a bar wanda ke da tsohon version ya wuce ba.'
                                                                        : '✨ Soft Recommendation Kunne: Mai amfani zai iya danna "Remind Me Later" ya ci gaba.'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!settings.force_update_enabled}
                                                                onChange={(e) => updateField('force_update_enabled', e.target.checked)}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Release Content & Notes */}
                                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                                            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-base">Sanarwar Sabuntawa & Release Notes</h3>
                                                    <p className="text-xs text-gray-500 mt-0.5">Zaɓi tsari da aka riga aka shirya ko ka rubuta naka.</p>
                                                </div>
                                            </div>

                                            {/* Quick Templates */}
                                            <div className="mb-4">
                                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                                    Sanya Samfurin Rubutu (Quick Templates):
                                                </label>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => applyReleaseNotesTemplate('general')}
                                                        className="px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 text-left transition-colors"
                                                    >
                                                        🚀 Janar (General)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyReleaseNotesTemplate('security')}
                                                        className="px-3 py-2 text-xs font-bold rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 text-left transition-colors"
                                                    >
                                                        🔒 Tsaro & Walat
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyReleaseNotesTemplate('market')}
                                                        className="px-3 py-2 text-xs font-bold rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-left transition-colors"
                                                    >
                                                        🎉 Sabbin Fasaloli
                                                    </button>
                                                </div>
                                            </div>

                                            <InputField
                                                label="Kan Magana (Update Title)"
                                                field="update_title"
                                                placeholder="Sabon Version Ya Fito A Play Store!"
                                            />

                                            <TextAreaField
                                                label="Bayanin Sabuntawa (Update Message)"
                                                field="update_message"
                                                rows={2}
                                                placeholder="Muna bukatar kayi update na manhajar Abu Mafhal..."
                                            />

                                            <TextAreaField
                                                label="Abubuwan da Aka Inganta (Release Notes - Layi-da-Layi)"
                                                field="update_release_notes"
                                                rows={4}
                                                hint="Duk layin da ka fara da • ko - zai fito a matsayin jerin abubuwan da aka gyara."
                                            />
                                        </div>
                                    </div>

                                    {/* Right Side: Live Mobile Popup Preview (5 cols) */}
                                    <div className="lg:col-span-5">
                                        <div className="sticky top-6">
                                            <div className="flex items-center justify-between mb-3 px-1">
                                                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                                    <FiSmartphone className="text-primary-600" />
                                                    Live Phone Preview
                                                </span>
                                                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                                                    Real-time Mockup
                                                </span>
                                            </div>

                                            {/* Mockup Card */}
                                            <div className="bg-[#0B1220] rounded-3xl p-6 border-2 border-slate-700/80 shadow-2xl text-white relative overflow-hidden">
                                                {/* Top Glow bar */}
                                                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500"></div>

                                                {/* Header in Popup */}
                                                <div className="flex items-center justify-between mt-2 mb-4">
                                                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                                                        <div className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-black">
                                                            ▶
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="text-[11px] font-black leading-tight text-white">Google Play</div>
                                                            <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Official Store</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 bg-[#D9A73A]/10 border border-[#D9A73A]/30 px-2.5 py-1 rounded-lg">
                                                        <span className="text-xs text-[#D9A73A]">🛡️</span>
                                                        <span className="text-[10px] font-black text-[#D9A73A] tracking-wider">ABU MAFHAL</span>
                                                    </div>
                                                </div>

                                                {/* Alert Pill */}
                                                <div className="text-center my-3">
                                                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                                                        settings.force_update_enabled
                                                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                    }`}>
                                                        {settings.force_update_enabled ? '⚠️ DOLE NE KAYI UPDATE KAFIN KA SHIGA' : '✨ SABON UPDATE YA FITO'}
                                                    </span>
                                                </div>

                                                {/* Title */}
                                                <h4 className="text-lg font-black text-center text-slate-100 leading-snug mb-3">
                                                    {settings.update_title || 'Sabon Version Ya Fito A Play Store!'}
                                                </h4>

                                                {/* Version Comparison Box */}
                                                <div className="flex items-center justify-center gap-2 my-4 bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800">
                                                    <div className="flex-1 bg-slate-800/80 rounded-xl p-2 text-center border border-slate-700">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Wanda Ke Wayarka</div>
                                                        <div className="text-sm font-black text-slate-300 font-mono mt-0.5">v1.0.0</div>
                                                    </div>
                                                    <div className="text-[#D9A73A] font-black text-base px-1">➔</div>
                                                    <div className="flex-1 bg-emerald-950/60 rounded-xl p-2 text-center border border-emerald-500/30">
                                                        <div className="text-[10px] font-bold text-emerald-400 uppercase">Sabuwar Sigar</div>
                                                        <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">
                                                            v{settings.latest_app_version || '1.0.0'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Message */}
                                                <p className="text-xs text-slate-300 text-center leading-relaxed mb-4 px-2">
                                                    {settings.update_message || 'Muna bukatar kayi update na manhajar Abu Mafhal zuwa sabon version domin samun sabbin fasaloli da ingantaccen tsaro kafin ka shiga.'}
                                                </p>

                                                {/* Release Notes in Card */}
                                                <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800 mb-5">
                                                    <div className="text-[10px] font-black text-[#D9A73A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                        <span>🎁</span> ABINDA KE CIKIN SABON VERSION:
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {(settings.update_release_notes || '• Inganta saurin manhaja\n• Sabon tsarin VIP Pass da QR Code\n• Karfafa tsaron asusu')
                                                            .split('\n')
                                                            .filter(Boolean)
                                                            .map((note, idx) => (
                                                                <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-300 leading-tight">
                                                                    <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                                                                    <span>{note.replace(/^[\u2022\-\*0-9\.\s]+/, '')}</span>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </div>

                                                {/* Action Buttons inside Mockup */}
                                                <div className="space-y-2">
                                                    <div className="w-full py-3 px-4 rounded-xl bg-emerald-600 text-white font-black text-xs text-center flex items-center justify-between shadow-lg shadow-emerald-950/50 cursor-pointer">
                                                        <span className="text-base">▶</span>
                                                        <span className="tracking-wide">YI UPDATE YANZU A PLAY STORE</span>
                                                        <FiExternalLink />
                                                    </div>
                                                    <div className="w-full py-2 px-3 rounded-lg bg-[#D9A73A]/10 border border-[#D9A73A]/30 text-[#D9A73A] font-bold text-xs text-center flex items-center justify-center gap-1.5 cursor-pointer">
                                                        <FiRefreshCw className="text-[11px]" />
                                                        Na Riga Na Yi Update (Duba Kuma)
                                                    </div>
                                                    {!settings.force_update_enabled && (
                                                        <div className="text-center pt-1 text-[11px] text-slate-400 underline cursor-pointer">
                                                            Ci gaba a yanzu (Remind me later)
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 8. ADVANCED */}
                        {activeTab === 'advanced' && (
                            <div className="animate-fade-in">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Advanced Systems</h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                    {/* AI Keys */}
                                    <InputField type="password" label="Google Gemini API Key" field="gemini_api_key" hint="Used for generative AI features." />
                                    <InputField type="password" label="OpenAI API Key" field="openai_api_key" />

                                    {/* Document Links */}
                                    <div className="col-span-full mt-4"></div>
                                    <InputField label="Privacy Policy Document URL" field="privacy_policy_url" />
                                    <InputField label="Terms & Conditions Document URL" field="terms_url" />

                                    {/* Global Announcement */}
                                    <div className="col-span-full mt-6 mb-4"><h3 className="font-semibold text-gray-800 border-b pb-2">Global Announcement Banner</h3></div>
                                    <div className="col-span-full">
                                        <Toggle label="Activate Announcement Banner" field="announcement_active" />
                                    </div>
                                    <div className="col-span-full w-full">
                                        <InputField label="Announcement Banner Text" field="announcement_text" placeholder="e.g. Scheduled maintenance this weekend." />
                                    </div>
                                    <InputField label="Banner Background Color" field="announcement_color" placeholder="#EA580C" />
                                    
                                    {/* Watermark */}
                                    <div className="col-span-full mt-6 mb-4"><h3 className="font-semibold text-gray-800 border-b pb-2">Media Processing</h3></div>
                                    <Toggle label="Apply Text Watermark on Image Uploads" field="enable_watermark" />
                                    <InputField label="Watermark Text Content" field="watermark_text" />
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;