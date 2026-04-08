import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { FiChevronRight, FiSave, FiSettings, FiCheck, FiX, FiInfo, FiUploadCloud } from 'react-icons/fi';

const CATEGORIES = [
    { id: 'branding', label: 'Brand & Display' },
    { id: 'financial', label: 'Finance & Gateway' },
    { id: 'shipping', label: 'Shipping & Tax' },
    { id: 'security', label: 'Security & Auth' },
    { id: 'vendors', label: 'Vendor Controls' },
    { id: 'contact', label: 'Contact & Social' },
    { id: 'features', label: 'Feature Flags' },
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

    // --- Unified Settings State ---
    const [settings, setSettings] = useState({});

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .single();

            if (error) throw error;
            if (data) {
                // Initialize arrays/objects if null
                if (!data.shipping_fees) {
                    const defaultFees = {};
                    NIGERIA_STATES.forEach(s => defaultFees[s] = ['Lagos', 'FCT (Abuja)', 'Rivers', 'Kano', 'Ogun'].includes(s) ? 1500 : 3000);
                    data.shipping_fees = defaultFees;
                }
                if (!data.payment_methods) data.payment_methods = {};
                if (!data.features) data.features = {};
                
                setSettings(data);
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
            const { error } = await supabase
                .from('app_settings')
                .update({
                    ...settings,
                    updated_at: new Date().toISOString()
                })
                .eq('is_singleton', true);

            if (error) throw error;
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
                                    <Toggle label="Crypto Payments (Coinbase)" field="crypto" nestedObj="payment_methods" />
                                    <Toggle label="Customer Internal Wallet" field="wallet" nestedObj="payment_methods" />

                                    <div className="col-span-full mt-6 mb-4">
                                        <h3 className="font-semibold text-gray-800 border-b pb-2 text-rose-700">Gateway API Secrets</h3>
                                    </div>
                                    <InputField type="password" label="Paystack Public Key" field="paystack_public_key" />
                                    <InputField type="password" label="Paystack Secret Key" field="paystack_secret_key" />
                                </div>
                            </div>
                        )}

                        {/* 3. SHIPPING & TAX */}
                        {activeTab === 'shipping' && (
                            <div className="animate-fade-in">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Shipping & Taxation</h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 mb-8">
                                    <Toggle label="Enable Tax (VAT) Calculation" field="tax_enabled" />
                                    {settings.tax_enabled !== false && (
                                        <InputField type="number" label="Global Tax Rate (%)" field="tax_rate" />
                                    )}
                                    
                                    <Toggle label="Override: Free Nationwide Shipping" field="free_nationwide_shipping" hint="Forces shipping calculation to 0 regardless of state." />
                                    <InputField type="number" label="Auto-Free Shipping Cart Minimum" field="free_shipping_min" hint="Cart value to trigger free shipping automatically." />
                                </div>

                                <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Per-State Logistics Rates</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {NIGERIA_STATES.map(state => (
                                        <div key={state} className="flex items-center gap-2">
                                            <label className="w-24 text-sm text-gray-600 truncate">{state}</label>
                                            <input
                                                type="number"
                                                value={settings.shipping_fees?.[state] || 0}
                                                onChange={(e) => updateNestedField('shipping_fees', state, parseFloat(e.target.value) || 0)}
                                                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                                            />
                                        </div>
                                    ))}
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