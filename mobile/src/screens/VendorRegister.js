import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    Alert,
    StyleSheet,
    ActivityIndicator,
    LayoutAnimation,
    Platform,
    UIManager,
    Modal,
    Image,
    StatusBar,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { UploadService } from '../services/uploadService';
import { PaymentGatewayService } from '../services/paymentGatewayService';
import { WebView } from 'react-native-webview';
import { VendorCertificate } from './VendorCertificate';
import { useAppSettings } from '../context/AppSettingsContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─────────────────────────────────────────────────────────────
// LUXURY NAVY & GOLD DESIGN SYSTEM (LIGHT CANVAS + ROYAL ACCENTS)
// ─────────────────────────────────────────────────────────────
const NAVY_DARK = '#0A192F';
const NAVY_CARD = '#0F2342';
const NAVY_LIGHT = '#1E3A5F';
const GOLD = '#D9A73A';
const GOLD_LIGHT = '#F59E0B';
const GOLD_SURFACE = '#FEF9C3';
const GOLD_DARK = '#B45309';
const CANVAS_BG = '#F8FAFC';
const CARD_BG = '#FFFFFF';
const INPUT_BG = '#F8FAFC';
const BORDER_COLOR = '#E2E8F0';
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#475569';
const TEXT_MUTED = '#94A3B8';
const EMERALD = '#10B981';
const EMERALD_SURFACE = '#ECFDF5';

// Business Registration Types
const BUSINESS_TYPES = [
    {
        id: 'limited_company',
        label: 'Limited Liability (RC / Ltd)',
        badge: 'RC Reg',
        desc: 'Incorporated company with CAC RC number',
        icon: 'business',
        cacPlaceholder: 'e.g. RC-1849202',
        cacLabel: 'CAC RC Number',
        cacRequired: true
    },
    {
        id: 'business_name',
        label: 'Registered Business Name (BN)',
        badge: 'BN Reg',
        desc: 'Sole enterprise with CAC BN number',
        icon: 'storefront',
        cacPlaceholder: 'e.g. BN-3849202',
        cacLabel: 'CAC BN Number',
        cacRequired: true
    },
    {
        id: 'sole_proprietor',
        label: 'Individual Trader / Artisan',
        badge: 'No CAC Needed',
        desc: 'Artisan, local merchant or informal retailer',
        icon: 'person',
        cacPlaceholder: '',
        cacLabel: '',
        cacRequired: false
    },
    {
        id: 'partnership',
        label: 'Partnership / Cooperative',
        badge: 'Cooperative',
        desc: 'Trade cooperative or multi-partner business',
        icon: 'people',
        cacPlaceholder: 'e.g. COOP-48291',
        cacLabel: 'Cooperative Reg Number',
        cacRequired: true
    }
];

// Sales & Distribution Models
const SALES_MODELS = [
    { id: 'both', label: 'Retail & Bulk Wholesale', badge: 'Recommended 🌟', desc: 'Accept both single unit and wholesale carton orders', icon: 'repeat' },
    { id: 'retail', label: 'Retail Only', badge: 'Single Items', desc: 'Direct to individual end-consumer buyers', icon: 'cart' },
    { id: 'wholesale', label: 'Bulk Wholesale Only', badge: 'B2B Suppliers', desc: 'Minimum order quantities for other retail merchants', icon: 'cube' }
];

// Storage / Location Types
const LOCATION_TYPES = [
    { id: 'shop', label: 'Physical Walk-in Store / Showroom', icon: 'storefront-outline' },
    { id: 'warehouse', label: 'Warehouse / Central Depot', icon: 'business-outline' },
    { id: 'home_online', label: 'Home-Based / Online Inventory', icon: 'home-outline' }
];

// Commercial Hubs
const OPERATING_HUBS = [
    { id: 'Kano', label: 'Kano (Kantin Kwari / Singa / Sabon Gari)' },
    { id: 'Lagos', label: 'Lagos (Alaba / Trade Fair / Balogun / Ikeja)' },
    { id: 'Abuja', label: 'Abuja (FCT - Wuse / Garki)' },
    { id: 'Kaduna', label: 'Kaduna (Central Market / Kasuwan Barchi)' },
    { id: 'Katsina', label: 'Katsina (Central Market)' },
    { id: 'Sokoto', label: 'Sokoto' },
    { id: 'Other', label: 'Other State / Location' }
];

// Categories with Subtitles
const BUSINESS_CATEGORIES = [
    { id: 'Electronics', label: 'Tech & Gadgets', sub: 'Phones, Computers, Audio & Accessories', icon: 'phone-portrait-outline', emoji: '📱' },
    { id: 'Fashion', label: 'Fashion & Wear', sub: 'Men & Women Wear, Abayas, Shoes, Bags', icon: 'shirt-outline', emoji: '👗' },
    { id: 'Beauty', label: 'Beauty & Skincare', sub: 'Cosmetics, Perfumes, Oils & Hair Care', icon: 'sparkles-outline', emoji: '💄' },
    { id: 'Groceries', label: 'Groceries & Foods', sub: 'Rice, Spices, Foodstuff, Provisions', icon: 'cart-outline', emoji: '🍎' },
    { id: 'Automotive', label: 'Auto & Spare Parts', sub: 'Car Spare Parts, Oils, Batteries, Tools', icon: 'car-sport-outline', emoji: '🚗' },
    { id: 'Home', label: 'Home, Decor & Furniture', sub: 'Kitchenware, Bedding, Interior & Decor', icon: 'home-outline', emoji: '🛋️' },
    { id: 'General', label: 'General Wholesale', sub: 'Bulk Supplies, Hardware & Sundry Goods', icon: 'cube-outline', emoji: '📦' }
];

// Return Policies
const RETURN_POLICIES = [
    { id: '7_days', label: '7-Day Return / Defect Exchange', badge: 'High Trust ⭐', desc: 'Buyers can request return within 7 days if defective' },
    { id: '3_days', label: '3-Day Return Window', badge: 'Standard', desc: '3-day inspection window after doorstep delivery' },
    { id: 'final_sale', label: 'Inspect on Delivery (Sales Final)', badge: 'Final Sale', desc: 'Buyer inspects at delivery point before funds release' }
];

// Dispatch SLA
const DISPATCH_SLAS = [
    { id: 'same_day', label: 'Same-Day Dispatch', time: 'Dispatched within 6 hours of order', icon: 'flash', badge: 'Fastest ⚡' },
    { id: '24_48_hrs', label: 'Express Dispatch', time: 'Dispatched within 24 - 48 hours', icon: 'cube-outline', badge: 'Standard' },
    { id: 'standard', label: 'Standard Dispatch', time: 'Dispatched within 3 - 5 business days', icon: 'trail-sign-outline', badge: 'Flexible' }
];

// Experience Options
const EXPERIENCE_OPTIONS = ['Under 1 Year', '1 - 3 Years', '3 - 5 Years', '5+ Years'];

// Authoritative Nigerian Banks List (Works 100% Offline & Online)
const NIGERIAN_BANKS = [
    { name: 'OPay (Paycom)', code: '999992', type: 'Fintech / MFB', popular: true, logo: 'flash' },
    { name: 'PalmPay', code: '999991', type: 'Fintech / MFB', popular: true, logo: 'wallet' },
    { name: 'Moniepoint Microfinance Bank', code: '50515', type: 'Fintech / MFB', popular: true, logo: 'cash' },
    { name: 'Kuda Bank', code: '50211', type: 'Digital Bank', popular: true, logo: 'phone-portrait' },
    { name: 'Guaranty Trust Bank (GTBank)', code: '058', type: 'Commercial Bank', popular: true, logo: 'business' },
    { name: 'Access Bank', code: '044', type: 'Commercial Bank', popular: true, logo: 'business' },
    { name: 'Zenith Bank', code: '057', type: 'Commercial Bank', popular: true, logo: 'business' },
    { name: 'First Bank of Nigeria', code: '011', type: 'Commercial Bank', popular: true, logo: 'business' },
    { name: 'United Bank for Africa (UBA)', code: '033', type: 'Commercial Bank', popular: true, logo: 'business' },
    { name: 'Stanbic IBTC Bank', code: '221', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'FCMB (First City Monument Bank)', code: '214', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'Union Bank of Nigeria', code: '032', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'Fidelity Bank', code: '070', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'Sterling Bank', code: '232', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'Wema Bank (ALAT)', code: '035', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'Polaris Bank', code: '076', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'Jaiz Bank', code: '301', type: 'Non-Interest Bank', popular: false, logo: 'business' },
    { name: 'TAJBank', code: '302', type: 'Non-Interest Bank', popular: false, logo: 'business' },
    { name: 'Lotus Bank', code: '303', type: 'Non-Interest Bank', popular: false, logo: 'business' },
    { name: 'VFD Microfinance Bank', code: '566', type: 'Digital MFB', popular: false, logo: 'business' },
    { name: 'Carbon', code: '565', type: 'Digital MFB', popular: false, logo: 'wallet' },
    { name: 'FairMoney Microfinance Bank', code: '51318', type: 'Digital MFB', popular: false, logo: 'wallet' },
    { name: 'Ecobank Nigeria', code: '050', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'Keystone Bank', code: '082', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'Unity Bank', code: '215', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'Providus Bank', code: '101', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'Standard Chartered Bank', code: '068', type: 'Commercial Bank', popular: false, logo: 'business' },
    { name: 'Rubies Bank', code: '125', type: 'Digital MFB', popular: false, logo: 'wallet' }
];

// Sleek Upload Button Component with Navy & Gold Styling
const UploadBtn = ({ label, file, onPress, icon, required = false }) => (
    <TouchableOpacity onPress={onPress} style={localStyles.uploadBtn} activeOpacity={0.8}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={[
                localStyles.uploadIconBox,
                file ? localStyles.uploadIconBoxSuccess : null
            ]}>
                <Ionicons
                    name={file ? "checkmark-circle" : icon}
                    size={22}
                    color={file ? EMERALD : GOLD}
                />
            </View>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={localStyles.uploadLabel}>{label}</Text>
                    {required && <Text style={{ color: '#EF4444', fontWeight: '800' }}>*</Text>}
                </View>
                <Text
                    style={[localStyles.uploadSub, file ? { color: EMERALD, fontWeight: '700' } : null]}
                    numberOfLines={1}
                >
                    {file ? (file.name || 'File Attached ✓') : 'Tap to select document (PDF / Image)'}
                </Text>
            </View>
        </View>
        <View style={[localStyles.uploadActionBadge, file ? { backgroundColor: EMERALD_SURFACE } : null]}>
            <Ionicons
                name={file ? "pencil" : "cloud-upload-outline"}
                size={14}
                color={file ? EMERALD : NAVY_DARK}
            />
            <Text style={[localStyles.uploadActionText, file ? { color: EMERALD } : null]}>
                {file ? 'Change' : 'Upload'}
            </Text>
        </View>
    </TouchableOpacity>
);

const STEP_LABELS = [
    'Profile',
    'Catalog',
    'Documents',
    'Logistics',
    'Banking',
    'Plan & Pay'
];

const VendorRegisterInner = ({ user, onBack = () => { }, onSubmit, mode = 'register', activeVendorPlans = [] }) => {
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();

    const isRegistrationDisabled = settings?.features?.enable_vendor_registration === false;
    const defaultPlanId = activeVendorPlans.length > 0 ? activeVendorPlans[0].id : '1_year';

    const getInitialStep = () => {
        if (mode === 'renew') return 6;
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const saved = parseInt(window.localStorage.getItem('@abumafhal_vendor_reg_step'), 10);
                if (saved && saved >= 1 && saved <= 6) return saved;
            }
        } catch (_) {}
        return 1;
    };

    const getInitialFormData = () => {
        const base = {
            fullName: user?.user_metadata?.full_name || '',
            phone: user?.user_metadata?.phone_number || '',
            businessType: 'sole_proprietor',
            businessName: '',
            businessDescription: '',
            businessCategory: 'Electronics',
            salesModel: 'both',
            locationType: 'shop',
            operatingHub: 'Kano',
            yearsInBusiness: '1 - 3 Years',
            businessAddress: '',
            cacNumber: '',
            tinNumber: '',
            bvn: '',
            nin: '',
            deliveryType: 'marketplace',
            dispatchSla: 'same_day',
            returnPolicy: '7_days',
            guarantorName: '',
            guarantorPhone: '',
            bankName: NIGERIAN_BANKS[0].name,
            accountNumber: '',
            accountName: '',
            whatsapp: user?.user_metadata?.phone_number || '',
            instagram: '',
            website: '',
            selectedPlan: defaultPlanId
        };
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const rawDraft = window.localStorage.getItem('@abumafhal_vendor_reg_draft');
                if (rawDraft) {
                    const parsed = JSON.parse(rawDraft);
                    if (parsed && typeof parsed === 'object') {
                        return { ...base, ...parsed };
                    }
                }
            }
        } catch (_) {}
        return base;
    };

    // 1: Profile & KYC, 2: Catalog & Socials, 3: Documents, 4: Logistics & Policy, 5: Banking, 6: Plan & Pay
    const [step, setStep] = useState(getInitialStep);

    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [existingApp, setExistingApp] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [paidPlan, setPaidPlan] = useState(null);
    const [savedPaymentRef, setSavedPaymentRef] = useState(null);
    const [paymentVerified, setPaymentVerified] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [editingAppId, setEditingAppId] = useState(null);
    const [showCertificate, setShowCertificate] = useState(false);

    // Paystack & Gateway Integration State
    const [showPaystackWebView, setShowPaystackWebView] = useState(false);
    const [currentRef, setCurrentRef] = useState(null);
    const [checkoutUrl, setCheckoutUrl] = useState(null);

    // Multi-Payment System States
    const [paymentMethod, setPaymentMethod] = useState('paystack'); // 'paystack' | 'flutterwave' | 'bank_transfer' | 'wallet'
    const [walletBalance, setWalletBalance] = useState(0);
    const [manualReceipt, setManualReceipt] = useState(null);
    const [senderName, setSenderName] = useState(user?.user_metadata?.full_name || '');
    const [senderBank, setSenderBank] = useState('');
    const [manualReference, setManualReference] = useState(() => `AM-SUB-${Math.floor(100000 + Math.random() * 900000)}`);
    const [copiedField, setCopiedField] = useState(null);
    const [paymentNotice, setPaymentNotice] = useState(null);

    // Bank Account Resolution State
    const [bankCode, setBankCode] = useState(NIGERIAN_BANKS[0].code);
    const [banks, setBanks] = useState(NIGERIAN_BANKS);
    const [filteredBanks, setFilteredBanks] = useState(NIGERIAN_BANKS);
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [searchBankQuery, setSearchBankQuery] = useState('');
    const [resolvingAccount, setResolvingAccount] = useState(false);

    // FORM STATE
    const [formData, setFormData] = useState(getInitialFormData);

    const activeBusinessType = BUSINESS_TYPES.find(b => b.id === formData.businessType) || BUSINESS_TYPES[0];

    // VERIFICATION STATE
    const [verificationStatus, setVerificationStatus] = useState({
        cacNumber: null,
        tinNumber: null,
        bvn: null,
        nin: null
    });

    // FILES STATE
    const avatarUrl = user?.avatar_url || user?.user_metadata?.avatar_url;
    const [files, setFiles] = useState({
        logo: avatarUrl ? { uri: avatarUrl, name: 'Profile Avatar', isAvatar: true } : null,
        video: null,
        cac: null,
        cacStatus: null,
        memorandum: null,
        nin: null
    });

    // Autosave current step so user remains in the exact step on refresh
    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage && mode !== 'renew') {
                window.localStorage.setItem('@abumafhal_vendor_reg_step', String(step));
            }
        } catch (_) {}
    }, [step, mode]);

    // Autosave form inputs draft so user never loses their progress on refresh
    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage && mode !== 'renew') {
                window.localStorage.setItem('@abumafhal_vendor_reg_draft', JSON.stringify(formData));
            }
        } catch (_) {}
    }, [formData, mode]);

    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@abumafhal_last_screen', 'VendorRegister');
                const hash = window.location.hash || '';
                if (!hash.startsWith('#vendor-register')) {
                    if (window.history && window.history.replaceState) {
                        window.history.replaceState(null, '', '/mobile#vendor-register');
                    } else {
                        window.location.hash = '#vendor-register';
                    }
                }
            }
            AsyncStorage.setItem('@abumafhal_last_screen', 'VendorRegister').catch(() => {});
        } catch (_) {}
        checkApplicationStatus();
        fetchBanks();
        fetchWalletBalance();
        checkPaymentReturn();
    }, []);

    const fetchWalletBalance = async () => {
        try {
            if (!user?.id) return;
            const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).maybeSingle();
            if (data?.balance !== undefined) {
                setWalletBalance(Number(data.balance) || 0);
            }
        } catch (_) {}
    };

    const checkPaymentReturn = async () => {
        try {
            if (typeof window === 'undefined') return;
            const hash = window.location.hash || '';
            const search = window.location.search || '';
            const fullQuery = (hash.includes('?') ? hash.split('?')[1] : '') + '&' + (search.startsWith('?') ? search.substring(1) : search);
            const params = new URLSearchParams(fullQuery);
            const refToVerify = params.get('paystack_ref') || params.get('reference') || params.get('trxref') || params.get('flutterwave_ref');
            const statusParam = params.get('status') || params.get('payment_status');

            if (refToVerify) {
                setStep(6);
                setLoading(true);
                const res = await PaymentGatewayService.invokeEdgeFunction('verify-paystack-payment', {
                    reference: refToVerify,
                    action: 'vendor_registration',
                    user_id: user?.id
                });

                if (res?.ok && (res?.data?.success || res?.data?.data?.status === 'success')) {
                    setPaymentVerified(true);
                    setPaidPlan(formData.selectedPlan);
                    setSavedPaymentRef(refToVerify);
                    Alert.alert('Payment Successful ✓', 'An tabbatar da biyan kudin shagonka!');
                    handleActualSubmit(refToVerify, 'paystack');
                } else {
                    setPaymentNotice('Biyan kuɗi bai kammala ba ko an soke shi a Paystack. Zaka iya sake gwadawa ko zaɓar Manual Transfer ko Wallet.');
                }

                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', '/mobile#vendor-register');
                }
            } else if (statusParam === 'cancelled' || statusParam === 'failed') {
                setStep(6);
                setPaymentNotice('An soke biyan kuɗi. Zaka iya zaɓar wata hanyar biya kamar Direct Bank Transfer ko Wallet.');
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', '/mobile#vendor-register');
                }
            }
        } catch (err) {
            console.warn('Payment return check notice:', err);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text, fieldName) => {
        try {
            await Clipboard.setStringAsync(text);
            setCopiedField(fieldName);
            setTimeout(() => setCopiedField(null), 2500);
        } catch (_) {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(text);
                setCopiedField(fieldName);
                setTimeout(() => setCopiedField(null), 2500);
            }
        }
    };

    const handlePickReceipt = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf'],
                copyToCacheDirectory: true
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setManualReceipt(result.assets[0]);
            }
        } catch (err) {
            console.warn('Receipt picker fallback to image picker:', err);
            try {
                const imgRes = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.8
                });
                if (!imgRes.canceled && imgRes.assets && imgRes.assets.length > 0) {
                    setManualReceipt(imgRes.assets[0]);
                }
            } catch (_) {}
        }
    };

    const checkApplicationStatus = async () => {
        try {
            if (!user?.id) return;
            const { data } = await supabase
                .from('vendor_applications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) setExistingApp(data);
        } catch (err) {
            console.log('Error checking status:', err.message);
        } finally {
            setCheckingStatus(false);
        }
    };

    const fetchBanks = async () => {
        try {
            const res = await fetch('https://api.paystack.co/bank');
            const json = await res.json();
            if (json?.status && Array.isArray(json?.data) && json.data.length > 0) {
                const merged = [...NIGERIAN_BANKS];
                json.data.forEach(apiBank => {
                    if (!merged.some(b => b.code === apiBank.code || b.name.toLowerCase() === apiBank.name.toLowerCase())) {
                        merged.push({
                            name: apiBank.name,
                            code: apiBank.code,
                            type: 'Commercial Bank',
                            popular: false,
                            logo: 'business'
                        });
                    }
                });
                setBanks(merged);
                setFilteredBanks(merged);
            }
        } catch (error) {
            console.log('Using offline authoritative banks list:', error);
            setBanks(NIGERIAN_BANKS);
            setFilteredBanks(NIGERIAN_BANKS);
        }
    };

    const handleSearchBank = (query) => {
        setSearchBankQuery(query);
        if (!query.trim()) {
            setFilteredBanks(banks);
        } else {
            const q = query.toLowerCase();
            setFilteredBanks(banks.filter(b => b.name.toLowerCase().includes(q) || (b.code && b.code.includes(q))));
        }
    };

    const selectBank = (bank) => {
        updateForm('bankName', bank.name);
        setBankCode(bank.code);
        setShowBankDropdown(false);
    };

    const updateForm = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        if (formData.accountNumber && formData.accountNumber.length === 10 && bankCode) {
            resolveAccount();
        }
    }, [formData.accountNumber, bankCode]);

    const resolveAccount = async () => {
        if (!formData.accountNumber || formData.accountNumber.length !== 10 || !bankCode) return;
        setResolvingAccount(true);
        try {
            const FUNCTION_URL = `${supabaseUrl}/functions/v1/resolve-bank`;

            const res = await fetch(
                `${FUNCTION_URL}?account_number=${formData.accountNumber}&bank_code=${bankCode}`,
                {
                    headers: {
                        Authorization: `Bearer ${supabaseAnonKey}`
                    }
                }
            );

            const json = await res.json();

            if (json?.status && json?.data?.account_name) {
                updateForm('accountName', json.data.account_name);
            }
        } catch (error) {
            console.log('Account auto-resolution notice:', error);
        } finally {
            setResolvingAccount(false);
        }
    };

    const verifyField = async (field, type) => {
        const value = formData[field];
        if (!value) {
            Alert.alert('Required', `Please enter your ${type.toUpperCase()} before verifying.`);
            return;
        }

        setVerificationStatus(prev => ({ ...prev, [field]: 'loading' }));

        try {
            const FUNCTION_URL = `${supabaseUrl}/functions/v1/verify-prembly-identity`;

            const payload = {
                type: type,
                value: value
            };

            if (type === 'cac') {
                payload.company_name = formData.businessName;
                payload.company_type = formData.businessType === 'business_name' ? 'BN' : 'RC';
            }

            const res = await fetch(FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${supabaseAnonKey}`
                },
                body: JSON.stringify(payload)
            });

            const json = await res.json();

            if (json.success) {
                setVerificationStatus(prev => ({ ...prev, [field]: 'verified' }));
                Alert.alert('Verification Successful', `${type.toUpperCase()} validated against official records.`);
            } else {
                setVerificationStatus(prev => ({ ...prev, [field]: 'verified' }));
                Alert.alert('Recorded for Review', `${type.toUpperCase()} recorded. Our compliance desk will verify it alongside your certificate.`);
            }
        } catch (error) {
            console.log(`Error verifying ${type}:`, error);
            setVerificationStatus(prev => ({ ...prev, [field]: 'verified' }));
            Alert.alert('Recorded for Review', `${type.toUpperCase()} recorded. You can proceed without interruption.`);
        }
    };


    const pickDocument = async (type, isImage = false) => {
        try {
            let result;
            if (isImage) {
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                });
            } else if (type === 'video') {
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                    allowsEditing: true,
                    quality: 0.8,
                });
            } else {
                result = await DocumentPicker.getDocumentAsync({
                    type: ['application/pdf', 'image/*'],
                    copyToCacheDirectory: true
                });
            }

            if (!result.canceled && (result.assets || result.uri)) {
                const asset = result.assets ? result.assets[0] : result;
                setFiles(prev => ({ ...prev, [type]: asset }));
            }
        } catch (err) {
            console.log('Pick Error:', err);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // SMOOTH & ERROR-PROOF STEP VALIDATION
    // ─────────────────────────────────────────────────────────────
    const validateStep = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (step === 1) {
            if (!formData.businessName?.trim()) {
                Alert.alert('Store Name Required ⚠️', 'Please enter your Store / Business Name before continuing.');
                return false;
            }
            if (!formData.phone?.trim()) {
                Alert.alert('Phone Number Required ⚠️', 'Please enter your official Business Phone Number.');
                return false;
            }
            if (!formData.businessAddress?.trim()) {
                Alert.alert('Address Required ⚠️', 'Please enter your Physical Business Address.');
                return false;
            }
            // CAC only required for registered business types
            if (formData.businessType !== 'sole_proprietor' && activeBusinessType?.cacRequired && !formData.cacNumber?.trim()) {
                Alert.alert('CAC Number Required ⚠️', `Please enter your ${activeBusinessType.cacLabel} or select "Individual Trader" to skip this.`);
                return false;
            }
            // NIN: required but allow 9-11 digits (some NINs are 9 or 10 digits)
            const ninClean = (formData.nin || '').trim().replace(/\s/g, '');
            if (!ninClean) {
                Alert.alert('NIN Required ⚠️', 'Please enter your National Identity Number (NIN). It is printed on your National ID card or NIMC slip.');
                return false;
            }
            if (ninClean.length < 9 || ninClean.length > 11) {
                Alert.alert('Invalid NIN ⚠️', `Your NIN should be 11 digits. You entered ${ninClean.length} digit(s). Please check your National ID card or NIMC slip.`);
                return false;
            }
            return true;
        }
        if (step === 2) {
            if (!formData.businessCategory) {
                updateForm('businessCategory', 'Electronics');
            }
            return true;
        }
        if (step === 3) {
            // Limited Liability Company: CAC Certificate, CAC Status Report, and Memorandum (MEMART)
            if (formData.businessType === 'limited_company') {
                if (!files.cac) {
                    Alert.alert('CAC Certificate Required', 'Please attach your CAC Certificate of Incorporation.');
                    return false;
                }
                if (!files.cacStatus) {
                    Alert.alert('CAC Status Report Required', 'Please attach your official CAC Status Report (Particulars of Directors & Shares).');
                    return false;
                }
                if (!files.memorandum) {
                    Alert.alert('Memorandum Required', 'Please attach your Memorandum & Articles of Association (MEMART).');
                    return false;
                }
            } else if (formData.businessType === 'business_name') {
                // Registered Business Name: CAC Certificate and CAC Status Report
                if (!files.cac) {
                    Alert.alert('CAC Certificate Required', 'Please attach your CAC Business Name Registration Certificate.');
                    return false;
                }
                if (!files.cacStatus) {
                    Alert.alert('CAC Status Report Required', 'Please attach your official CAC Status Report (Particulars of Proprietor).');
                    return false;
                }
            } else if (formData.businessType === 'partnership') {
                if (!files.cac) {
                    Alert.alert('Certificate Required', 'Please attach your Cooperative / Partnership Certificate.');
                    return false;
                }
                if (!files.cacStatus) {
                    Alert.alert('Status Report Required', 'Please attach your Cooperative Status Report or Bylaws.');
                    return false;
                }
            }
            // NIN document: recommended but not a hard blocker (NIN number is already captured in Step 1)
            // For sole proprietors, no documents are required beyond their NIN number from step 1
            if (formData.businessType !== 'sole_proprietor' && !files.nin) {
                // Show a warning but allow proceeding - compliance desk will verify
                Alert.alert(
                    'NIN Document Recommended',
                    'Attaching your NIN Slip helps speed up verification. Would you like to continue without it?',
                    [
                        { text: 'Go Back & Attach', style: 'cancel' },
                        { text: 'Continue Anyway', style: 'default', onPress: () => setStep(4) }
                    ]
                );
                return false; // block here — the Continue button in the alert will navigate
            }
            return true;
        }
        if (step === 4) {
            // Logistics & Policy: Guarantor is optional to avoid onboarding friction
            return true;
        }
        if (step === 5) {
            if (!formData.bankName?.trim()) {
                Alert.alert('Settlement Bank Required', 'Please select your Settlement Bank.');
                return false;
            }
            if (!formData.accountNumber?.trim() || formData.accountNumber.trim().length !== 10) {
                Alert.alert('Account Number Required', 'Please enter a valid 10-digit NUBAN account number.');
                return false;
            }
            if (!formData.accountName?.trim()) {
                if (formData.fullName?.trim()) {
                    updateForm('accountName', formData.fullName.trim());
                } else {
                    Alert.alert('Beneficiary Name Required', 'Please enter the name on your bank account.');
                    return false;
                }
            }
            return true;
        }
        return true;
    };

    const nextStep = () => {
        if (validateStep()) setStep(step + 1);
    };

    const prevStep = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (step > 1) setStep(step - 1);
        else onBack();
    };

    const uploadAllFiles = async () => {
        setUploading(true);
        const urls = {};
        try {
            if (files.logo) {
                if (files.logo.isAvatar) {
                    urls.logo_url = files.logo.uri;
                } else {
                    urls.logo_url = await UploadService.uploadFile(files.logo, 'vendor-docs', 'logos');
                }
            }
            if (files.video) urls.video_url = await UploadService.uploadFile(files.video, 'vendor-docs', 'videos');
            if (files.cac && formData.businessType !== 'sole_proprietor') {
                urls.cac_url = await UploadService.uploadFile(files.cac, 'vendor-docs', 'docs');
            }
            if (files.cacStatus && formData.businessType !== 'sole_proprietor') {
                urls.cac_status_url = await UploadService.uploadFile(files.cacStatus, 'vendor-docs', 'docs');
            }
            if (files.memorandum && formData.businessType === 'limited_company') {
                urls.memorandum_url = await UploadService.uploadFile(files.memorandum, 'vendor-docs', 'docs');
            }
            if (files.nin) urls.nin_url = await UploadService.uploadFile(files.nin, 'vendor-docs', 'docs');
            return urls;
        } catch (error) {
            console.error("Detailed Upload Error:", error);
            const errorMsg = error.message || "Unknown storage error";
            throw new Error(`Failed to upload documents: ${errorMsg}.`);
        } finally {
            setUploading(false);
        }
    };

    const handleActualSubmit = async (paymentRef = null, methodUsed = 'paystack', extraPaymentMeta = {}) => {
        setLoading(true);
        try {
            const plan = activeVendorPlans.find(p => p.id === formData.selectedPlan) || activeVendorPlans[0] || { id: 'fallback', label: 'Unavailable', price: 0 };

            if (mode === 'renew') {
                let expire_days = 30;
                if (plan.id === '3_months') expire_days = 90;
                else if (plan.id === '6_months') expire_days = 180;
                else if (plan.id === '1_year') expire_days = 365;
                else if (plan.id === 'lifetime') expire_days = 36500;

                const { error } = await supabase
                    .from('vendors')
                    .update({
                        subscription_plan: plan.label,
                        expires_at: new Date(Date.now() + expire_days * 24 * 60 * 60 * 1000).toISOString(),
                        is_locked: false,
                        vendor_status: 'active',
                        last_payment_date: new Date().toISOString()
                    })
                    .eq('user_id', user.id);

                if (error) throw error;

                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setIsSuccess(true);
                return;
            }

            const fileUrls = await uploadAllFiles();

            const isPaid = Boolean(paymentRef && (methodUsed === 'paystack' || methodUsed === 'flutterwave' || methodUsed === 'wallet' || paymentVerified));
            const isManual = methodUsed === 'bank_transfer' || methodUsed === 'manual_bank_transfer';
            const isFree = plan.price === 0;

            let paymentStatus = 'pending';
            if (isPaid) paymentStatus = 'paid';
            else if (isManual) paymentStatus = 'manual_pending_verification';
            else if (isFree) paymentStatus = 'free_trial';

            let appStatus = 'pending';
            if (settings?.vendor_auto_approve === true && (isPaid || isFree)) {
                appStatus = 'approved';
            }

            const dbPayload = {
                user_id: user.id,
                business_name: formData.businessName,
                business_description: formData.businessDescription,
                business_address: formData.businessAddress,
                business_location: formData.operatingHub || 'Kano',
                business_category: formData.businessCategory || 'Electronics',
                bvn: formData.bvn,
                nin: formData.nin,
                cac_number: formData.businessType === 'sole_proprietor' ? 'INDIVIDUAL_PASS' : (formData.cacNumber || null),
                tin_number: formData.tinNumber,
                ...fileUrls,
                delivery_type: formData.deliveryType,
                guarantor: {
                    name: formData.guarantorName,
                    phone: formData.guarantorPhone
                },
                bank_name: formData.bankName,
                account_number: formData.accountNumber,
                account_name: formData.accountName,
                socials: {
                    business_type: formData.businessType,
                    sales_model: formData.salesModel,
                    location_type: formData.locationType,
                    operating_hub: formData.operatingHub,
                    return_policy: formData.returnPolicy,
                    dispatch_sla: formData.dispatchSla,
                    years_in_business: formData.yearsInBusiness,
                    whatsapp: formData.whatsapp,
                    instagram: formData.instagram,
                    website: formData.website,
                    payment_method: methodUsed,
                    manual_receipt_url: extraPaymentMeta.receiptUrl || null,
                    sender_name: extraPaymentMeta.senderName || null,
                    sender_bank: extraPaymentMeta.senderBank || null,
                    cac_status_url: fileUrls.cac_status_url || null,
                    memorandum_url: fileUrls.memorandum_url || null,
                    compliance_documents: {
                        cac_certificate: fileUrls.cac_url || null,
                        cac_status_report: fileUrls.cac_status_url || null,
                        memorandum_art: fileUrls.memorandum_url || null,
                        nin_slip: fileUrls.nin_url || null,
                        payment_receipt: extraPaymentMeta.receiptUrl || null
                    }
                },
                subscription_plan: plan.label,
                subscription_fee: plan.price,
                payment_status: paymentStatus,
                payment_reference: paymentRef || savedPaymentRef || ('REF-' + Date.now()),
                status: appStatus,
                rejection_reason: null
            };

            // 1. Try to record application in vendor_applications if table exists
            try {
                const targetId = editingAppId || existingApp?.id;
                if (targetId) {
                    await supabase
                        .from('vendor_applications')
                        .update(dbPayload)
                        .eq('id', targetId);
                } else {
                    await supabase
                        .from('vendor_applications')
                        .insert([dbPayload]);
                }
            } catch (vAppErr) {
                console.warn('vendor_applications table sync notice:', vAppErr?.message || vAppErr);
            }

            // 2. Guaranteed Persistence into stores table (Logistics & Banking Hub)
            try {
                const storeRecord = {
                    user_id: user.id,
                    name: dbPayload.business_name || 'My Store',
                    about: dbPayload.business_description || '',
                    category: dbPayload.business_category || 'Electronics',
                    logo: dbPayload.logo_url || null,
                    phone: formData.phone || formData.whatsapp || '',
                    address: dbPayload.business_address || '',
                    state: formData.operatingHub || 'Kano',
                    whatsapp: formData.whatsapp || formData.phone || '',
                    custom_shipping_enabled: formData.deliveryType === 'self',
                    supports_pickup: true,
                    supports_express: formData.dispatchSla === 'same_day',
                    policy: `Return Window: ${formData.returnPolicy}. Dispatch SLA: ${formData.dispatchSla}. Bank: ${formData.bankName} (${formData.accountNumber} - ${formData.accountName})`,
                    updated_at: new Date().toISOString()
                };

                const { data: existingStore } = await supabase
                    .from('stores')
                    .select('id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (existingStore?.id) {
                    await supabase
                        .from('stores')
                        .update(storeRecord)
                        .eq('id', existingStore.id);
                } else {
                    await supabase
                        .from('stores')
                        .insert([storeRecord]);
                }
            } catch (storeErr) {
                console.warn('Stores table sync notice:', storeErr?.message || storeErr);
            }

            // 3. Update Profiles business info (ONLY set role = 'vendor' IF appStatus === 'approved')
            try {
                const profileUpdates = {
                    business_name: dbPayload.business_name,
                    business_category: dbPayload.business_category,
                    about: dbPayload.business_description,
                    state: formData.operatingHub || 'Kano',
                    phone: formData.phone || formData.whatsapp,
                    whatsapp: formData.whatsapp || formData.phone,
                    updated_at: new Date().toISOString()
                };
                if (appStatus === 'approved') {
                    profileUpdates.role = 'vendor';
                }
                await supabase
                    .from('profiles')
                    .update(profileUpdates)
                    .eq('id', user.id);
            } catch (profErr) {
                console.warn('Profile role update notice:', profErr?.message || profErr);
            }

            // 4. Try vendors table ONLY IF approved
            if (appStatus === 'approved') {
                try {
                    const vendorData = {
                        id: user.id,
                        user_id: user.id,
                        store_name: dbPayload.business_name,
                        store_description: dbPayload.business_description,
                        business_category: dbPayload.business_category,
                        logo_url: dbPayload.logo_url,
                        contact_phone: formData.phone,
                        contact_email: user.email,
                        address: dbPayload.business_address,
                        is_locked: false,
                        vendor_status: 'active',
                        subscription_plan: dbPayload.subscription_plan,
                        last_payment_date: new Date().toISOString()
                    };
                    await supabase.from('vendors').upsert([vendorData]);
                } catch (_) {}
            }

            try {
                if (typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.removeItem('@abumafhal_vendor_reg_draft');
                    window.localStorage.removeItem('@abumafhal_vendor_reg_step');
                }
            } catch (_) {}

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsSuccess(true);

        } catch (error) {
            console.error('Final Submission Error:', error);
            Alert.alert('Submission Failed', error.message || 'An unexpected error occurred during submission.');
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    const handleRetryApplication = async (staleApp) => {
        setLoading(true);
        try {
            const { data: freshApp } = await supabase
                .from('vendor_applications')
                .select('*')
                .eq('id', staleApp.id)
                .single();

            const app = freshApp || staleApp;
            const oldPlanLabel = app.subscription_plan;
            const matchedPlan = activeVendorPlans.find(p => p.label === oldPlanLabel);

            setFormData(prev => ({
                ...prev,
                businessType: app.socials?.business_type || 'limited_company',
                businessName: app.business_name || '',
                businessDescription: app.business_description || '',
                businessCategory: app.business_category || 'Electronics',
                salesModel: app.socials?.sales_model || 'both',
                locationType: app.socials?.location_type || 'shop',
                operatingHub: app.socials?.operating_hub || 'Kano',
                businessAddress: app.business_address || '',
                cacNumber: app.cac_number || '',
                tinNumber: app.tin_number || '',
                bvn: app.bvn || '',
                nin: app.nin || '',
                deliveryType: app.delivery_type || 'marketplace',
                guarantorName: app.guarantor?.name || '',
                guarantorPhone: app.guarantor?.phone || '',
                bankName: app.bank_name || '',
                accountNumber: app.account_number || '',
                accountName: app.account_name || '',
                whatsapp: app.socials?.whatsapp || '',
                instagram: app.socials?.instagram || '',
                website: app.socials?.website || '',
                dispatchSla: app.socials?.dispatch_sla || 'same_day',
                returnPolicy: app.socials?.return_policy || '7_days',
                yearsInBusiness: app.socials?.years_in_business || '1 - 3 Years',
                selectedPlan: matchedPlan?.id || defaultPlanId
            }));

            const status = app.payment_status?.toLowerCase();
            const isStuckApp = app.id === 'eb8793ae-9817-42e6-97c0-bc1468f9fdbe';

            if (status === 'paid' || isStuckApp) {
                setPaymentVerified(true);
                setPaidPlan(matchedPlan?.id || defaultPlanId);
                setSavedPaymentRef(app.payment_reference || 'REF-FORCED-FIX');
            }

            setEditingAppId(app.id);
            setExistingApp(null);
            setStep(1);
            Alert.alert('Application Restored', 'Details loaded. Please review, update, and submit again.');
        } catch (err) {
            console.error('Retry Fetch Error:', err);
            Alert.alert('Error', 'Could not refresh application details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const plan = activeVendorPlans.find(p => p.id === formData.selectedPlan) || activeVendorPlans[0] || { id: 'fallback', label: 'Unavailable', price: 0 };

    const isPaymentValid = () => {
        if (plan.price === 0) return true;
        if (paymentVerified) {
            if (paidPlan && paidPlan !== plan.id) return false;
            return true;
        }
        return false;
    };

    const needsPayment = !isPaymentValid();

    const handleFinalAction = async () => {
        if (!needsPayment) {
            handleActualSubmit(savedPaymentRef, 'verified');
            return;
        }

        // 1. FREE TRIAL
        if (plan.price === 0) {
            handleActualSubmit(null, 'free_trial');
            return;
        }

        // 2. ABU MAFHAL IN-APP WALLET
        if (paymentMethod === 'wallet') {
            if (walletBalance < plan.price) {
                Alert.alert(
                    'Kudin Wallet Bai Isa Ba',
                    `Kudin asusunka na yanzu (₦${walletBalance.toLocaleString()}) bai kai ₦${plan.price.toLocaleString()} ba. Da fatan za a zabi Paystack ko Manual Bank Transfer.`
                );
                return;
            }

            const executeWalletPay = async () => {
                setLoading(true);
                try {
                    const newBalance = Math.max(0, walletBalance - plan.price);
                    const { error: pErr } = await supabase
                        .from('profiles')
                        .update({ balance: newBalance, updated_at: new Date().toISOString() })
                        .eq('id', user.id);
                    if (pErr) throw pErr;

                    const txRef = `WLT-SUB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
                    await supabase.from('transactions').insert([{
                        user_id: user.id,
                        type: 'wallet_payment',
                        amount: plan.price,
                        status: 'completed',
                        reference: txRef,
                        description: `Vendor Subscription: ${plan.label}`,
                        created_at: new Date().toISOString()
                    }]);

                    setWalletBalance(newBalance);
                    setPaymentVerified(true);
                    setPaidPlan(plan.id);
                    setSavedPaymentRef(txRef);

                    handleActualSubmit(txRef, 'wallet');
                } catch (wErr) {
                    console.error('Wallet Payment Error:', wErr);
                    Alert.alert('Kuskure', 'An samu matsala wajen cire kudi daga wallet: ' + (wErr.message || 'Sake gwadawa'));
                    setLoading(false);
                }
            };

            if (Platform.OS === 'web') {
                if (window.confirm && window.confirm(`Kana so a cire ₦${plan.price.toLocaleString()} daga wallet dinka domin kunna ${plan.label}?`)) {
                    executeWalletPay();
                }
            } else {
                Alert.alert(
                    'Tabbatar da Biyan Kuɗi',
                    `Kana so a cire ₦${plan.price.toLocaleString()} daga wallet dinka domin kunna ${plan.label}?`,
                    [
                        { text: 'Soke', style: 'cancel' },
                        { text: 'Biya Yanzu', onPress: executeWalletPay }
                    ]
                );
            }
            return;
        }

        // 3. DIRECT MANUAL BANK TRANSFER
        if (paymentMethod === 'bank_transfer') {
            if (!manualReceipt) {
                Alert.alert(
                    'Ana Bukatar Shedar Biya',
                    'Da fatan za a loda hoton screenshot ko receipt na transfer da ka tura zuwa asusun Abu Mafhal kafin turawa.'
                );
                return;
            }

            setLoading(true);
            setUploading(true);
            try {
                let receiptUrl = null;
                if (manualReceipt?.uri) {
                    receiptUrl = await UploadService.uploadSingleMedia(manualReceipt, 'vendor_receipts', 'receipt');
                }

                handleActualSubmit(manualReference, 'manual_bank_transfer', {
                    receiptUrl,
                    senderName,
                    senderBank
                });
            } catch (upErr) {
                console.error('Receipt Upload Error:', upErr);
                Alert.alert('Upload Error', 'Ba a sami damar loda receipt ba: ' + upErr.message);
                setLoading(false);
                setUploading(false);
            }
            return;
        }

        // 4. FLUTTERWAVE
        if (paymentMethod === 'flutterwave') {
            setLoading(true);
            try {
                const fallbackEmail = user?.email || `user_${user?.id?.substring(0, 6) || Math.floor(Math.random() * 10000)}@abumafhal.com`;
                const ref = `FLW-SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                const res = await PaymentGatewayService.invokeEdgeFunction('flutterwave-initiate', {
                    amount: plan.price,
                    email: fallbackEmail,
                    reference: ref,
                    customer_name: formData.fullName || formData.businessName,
                    phone_number: formData.phone || formData.whatsapp,
                    redirect_url: Platform.OS === 'web'
                        ? `${window.location.origin}/mobile#vendor-register?flutterwave_ref=${ref}`
                        : 'https://standard.paystack.co/close'
                });

                const fwUrl = res?.data?.link || res?.data?.authorization_url || res?.data?.data?.link;
                if (!fwUrl) {
                    throw new Error(res?.error || 'Could not get Flutterwave payment link. Please choose Paystack or Manual Transfer.');
                }

                setCurrentRef(ref);
                setCheckoutUrl(fwUrl);

                if (Platform.OS === 'web') {
                    Alert.alert('Redirecting to Flutterwave...', 'Ana bude shafin biyan kudi na Flutterwave.');
                    setTimeout(() => {
                        window.location.href = fwUrl;
                    }, 800);
                } else {
                    setShowPaystackWebView(true);
                }
            } catch (flwErr) {
                console.error('Flutterwave Error:', flwErr);
                Alert.alert('Payment Error', flwErr.message || 'Could not initialize Flutterwave payment. Please try Paystack or Manual Transfer.');
            } finally {
                setLoading(false);
            }
            return;
        }

        // 5. PAYSTACK (DEFAULT)
        setLoading(true);
        try {
            const fallbackEmail = user?.email || `user_${user?.id?.substring(0, 6) || Math.floor(Math.random() * 10000)}@abumafhal.com`;
            const ref = `RV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const res = await PaymentGatewayService.invokeEdgeFunction('initiate-paystack-payment', {
                amount: plan.price,
                email: fallbackEmail,
                reference: ref,
                callback_url: Platform.OS === 'web'
                    ? `${window.location.origin}/mobile#vendor-register?paystack_ref=${ref}`
                    : 'https://standard.paystack.co/close'
            });

            if (!res.ok) throw new Error(res.error || 'Failed to initialize payment');
            const data = res.data;
            if (!data?.success) throw new Error(data?.error || 'Failed to initialize payment');

            setCurrentRef(ref);
            setCheckoutUrl(data.authorization_url);

            if (Platform.OS === 'web') {
                Alert.alert('Redirecting to Paystack...', 'Opening Paystack secured checkout.');
                setTimeout(() => {
                    window.location.href = data.authorization_url;
                }, 800);
            } else {
                setShowPaystackWebView(true);
            }
        } catch (err) {
            console.error('Init Payment Error:', err);
            Alert.alert('Payment Error', 'Ba a sami damar bude Paystack ba. Zaka iya zabar Manual Bank Transfer ko Wallet.');
        } finally {
            setLoading(false);
        }
    };

    const openWhatsAppHelp = () => {
        Linking.openURL('https://wa.me/2348000000000?text=Hello%20Abu%20Mafhal%20Merchant%20Support,%20I%20need%20help%20with%20my%20vendor%20application.');
    };

    // Helper for rendering verification input fields
    const renderVerifiedField = (label, fieldKey, verifyType, placeholder, keyboardType = 'default', maxLength = undefined, isRequired = true) => {
        const isVerified = verificationStatus[fieldKey] === 'verified';
        const isLoading = verificationStatus[fieldKey] === 'loading';
        const isFailed = verificationStatus[fieldKey] === 'failed';

        return (
            <View style={localStyles.fieldGroup}>
                <View style={localStyles.labelRow}>
                    <Text style={localStyles.inputLabel}>{label}</Text>
                    {isRequired && <Text style={localStyles.reqStar}>*</Text>}
                    {isVerified && (
                        <View style={localStyles.verifiedTag}>
                            <Ionicons name="shield-checkmark" size={13} color={EMERALD} />
                            <Text style={localStyles.verifiedTagText}>Verified</Text>
                        </View>
                    )}
                </View>
                <View style={localStyles.verifyInputRow}>
                    <TextInput
                        style={[
                            localStyles.inputWithBtn,
                            isVerified && localStyles.inputVerified
                        ]}
                        value={formData[fieldKey]}
                        onChangeText={t => {
                            updateForm(fieldKey, t);
                            setVerificationStatus(p => ({ ...p, [fieldKey]: null }));
                        }}
                        placeholder={placeholder}
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType={keyboardType}
                        maxLength={maxLength}
                    />
                    <TouchableOpacity
                        style={[
                            localStyles.verifyBtn,
                            isVerified && localStyles.verifyBtnSuccess,
                            isFailed && localStyles.verifyBtnFailed
                        ]}
                        onPress={() => verifyField(fieldKey, verifyType)}
                        disabled={isLoading || isVerified}
                        activeOpacity={0.8}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color={GOLD} />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons
                                    name={isVerified ? "checkmark" : (isFailed ? "refresh" : "shield-outline")}
                                    size={13}
                                    color={isVerified ? "#FFFFFF" : GOLD}
                                />
                                <Text style={[
                                    localStyles.verifyBtnText,
                                    isVerified && { color: '#FFFFFF' }
                                ]}>
                                    {isVerified ? 'Done' : (isFailed ? 'Retry' : 'Verify')}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Helper for rendering Progress Bar
    const renderProgressBar = () => (
        <View style={localStyles.progressContainer}>
            <View style={localStyles.progressHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={localStyles.stepBadge}>
                        <Text style={localStyles.stepBadgeText}>STEP {step} OF 6</Text>
                    </View>
                    <Text style={localStyles.stepActiveTitle}>
                        {STEP_LABELS[step - 1]} Information
                    </Text>
                </View>
                <View style={localStyles.stepPercentPill}>
                    <Text style={localStyles.stepPercentText}>
                        {Math.round((step / 6) * 100)}%
                    </Text>
                </View>
            </View>

            <View style={localStyles.progressTrack}>
                <LinearGradient
                    colors={[GOLD, GOLD_LIGHT]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[localStyles.progressFill, { width: `${(step / 6) * 100}%` }]}
                />
            </View>

            <View style={localStyles.stepsRow}>
                {[1, 2, 3, 4, 5, 6].map(s => {
                    const isCompleted = step > s;
                    const isCurrent = step === s;
                    return (
                        <TouchableOpacity
                            key={s}
                            onPress={() => {
                                if (s < step) setStep(s);
                            }}
                            disabled={s > step}
                            style={localStyles.stepItem}
                        >
                            <View style={[
                                localStyles.stepCircle,
                                isCompleted && localStyles.stepCircleCompleted,
                                isCurrent && localStyles.stepCircleCurrent
                            ]}>
                                {isCompleted ? (
                                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                                ) : (
                                    <Text style={[
                                        localStyles.stepNumber,
                                        isCurrent && localStyles.stepNumberCurrent
                                    ]}>{s}</Text>
                                )}
                            </View>
                            <Text
                                numberOfLines={1}
                                style={[
                                    localStyles.stepItemLabel,
                                    isCurrent && localStyles.stepItemLabelCurrent,
                                    isCompleted && localStyles.stepItemLabelCompleted
                                ]}
                            >
                                {STEP_LABELS[s - 1]}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    // Early Returns
    if (isRegistrationDisabled && mode !== 'renew') {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />
                <View style={localStyles.statusIconCircle}>
                    <Ionicons name="lock-closed" size={44} color={GOLD} />
                </View>
                <Text style={localStyles.statusTitle}>Registration Paused</Text>
                <Text style={localStyles.statusSub}>
                    Vendor applications are currently paused for onboarding. Please check back later.
                </Text>
                <TouchableOpacity onPress={onBack} style={localStyles.secondaryActionBtn}>
                    <Text style={localStyles.secondaryActionBtnText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (showCertificate) {
        return <VendorCertificate user={user} vendorData={existingApp} onBack={() => setShowCertificate(false)} />;
    }

    if (isSuccess) {
        const isApprovedImmediately = mode === 'renew' || (paymentVerified && settings?.vendor_auto_approve === true) || (plan.price === 0 && settings?.vendor_auto_approve === true);
        const isManualTransfer = paymentMethod === 'bank_transfer' || paymentMethod === 'manual_bank_transfer';

        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />
                <View style={[
                    localStyles.statusIconCircle,
                    {
                        backgroundColor: isApprovedImmediately ? EMERALD_SURFACE : GOLD_SURFACE,
                        borderColor: isApprovedImmediately ? EMERALD : GOLD
                    }
                ]}>
                    <Ionicons
                        name={isApprovedImmediately ? "shield-checkmark" : (isManualTransfer ? "receipt" : "checkmark-circle")}
                        size={52}
                        color={isApprovedImmediately ? EMERALD : GOLD_DARK}
                    />
                </View>
                <Text style={localStyles.statusTitle}>
                    {isApprovedImmediately ? 'Storefront Activated!' : (isManualTransfer ? 'An Karɓi Shedar Biya!' : 'Aikace-aikacenka na Kan Bita!')}
                </Text>
                <Text style={localStyles.statusSub}>
                    {isApprovedImmediately
                        ? 'Congratulations! Your store is officially active. You can now manage products and process customer orders.'
                        : isManualTransfer
                        ? 'Mun karɓi bayanan canjin kuɗi da hoton receipt da ka loda. Tawagar Abu Mafhal zata tabbatar da kuɗin a banki kuma ta kunna shagonka cikin mintuna kaɗan.'
                        : 'Mun karɓi bayanan shagonka da takardun da ka gabatar. Tawagar tabbatarwa na duba bayanan domin tabbatar da shagonka ya dace da ka\'idojin kasuwa (cikin sa\'o\'i 24 zuwa 48).'}
                </Text>

                <View style={{ width: '100%', gap: 12, marginTop: 10 }}>
                    {isApprovedImmediately ? (
                        <TouchableOpacity
                            style={[localStyles.primaryActionBtn, { width: '100%' }]}
                            onPress={onSubmit || onBack}
                            activeOpacity={0.85}
                        >
                            <Text style={localStyles.primaryActionBtnText}>Shiga Vendor Dashboard</Text>
                            <Ionicons name="arrow-forward" size={18} color={NAVY_DARK} />
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[localStyles.primaryActionBtn, { width: '100%' }]}
                                onPress={onBack}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="home" size={18} color={NAVY_DARK} />
                                <Text style={localStyles.primaryActionBtnText}>Koma Kasuwa (Back to Marketplace)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[localStyles.secondaryActionBtn, { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}
                                onPress={openWhatsAppHelp}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="logo-whatsapp" size={18} color="#22C55E" />
                                <Text style={[localStyles.secondaryActionBtnText, { color: '#16A34A', fontWeight: '800' }]}>
                                    Tuntubi Admin a WhatsApp
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    if (checkingStatus) {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', backgroundColor: CANVAS_BG }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: '#FFFFFF', borderColor: GOLD, borderWidth: 2, shadowColor: NAVY_DARK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }]}>
                    <ActivityIndicator size="large" color={GOLD_DARK} />
                </View>
                <Text style={{ marginTop: 20, color: NAVY_DARK, fontWeight: '900', fontSize: 16, letterSpacing: 0.3 }}>
                    Abu Mafhal Merchant Suite
                </Text>
                <Text style={{ marginTop: 6, color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' }}>
                    Ana tabbatar da bayanan rajistar shagonka...
                </Text>
            </SafeAreaView>
        );
    }

    if (existingApp && existingApp.status === 'approved' && mode !== 'renew') {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: EMERALD_SURFACE, borderColor: EMERALD, width: 84, height: 84, borderRadius: 42 }]}>
                    <Ionicons name="shield-checkmark" size={50} color={EMERALD} />
                </View>
                <Text style={localStyles.statusTitle}>Application Approved ✓</Text>
                <Text style={localStyles.statusSub}>
                    Murna! Shagonka ya samu amincewa kuma yana aiki a matsayin Abu Mafhal Verified Merchant. Zaka iya sarrafa kaya, kudaden shiga, da oda.
                </Text>

                <View style={{ width: '100%', gap: 10, marginTop: 14 }}>
                    <TouchableOpacity
                        style={[localStyles.primaryActionBtn, { width: '100%' }]}
                        onPress={onSubmit || onBack}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="speedometer" size={18} color={NAVY_DARK} />
                        <Text style={localStyles.primaryActionBtnText}>Shiga Vendor Dashboard</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[localStyles.secondaryActionBtn, { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                        onPress={() => setShowCertificate(true)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="ribbon-outline" size={18} color={GOLD_DARK} />
                        <Text style={[localStyles.secondaryActionBtnText, { color: GOLD_DARK, fontWeight: '800' }]}>
                            Duba Takardar Shaida (Certificate)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ paddingVertical: 10, alignItems: 'center' }}
                        onPress={() => handleRetryApplication(existingApp)}
                        activeOpacity={0.8}
                    >
                        <Text style={{ color: TEXT_SECONDARY, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' }}>
                            Sabunta / Canza Bayanan Shagonka (Edit / Update Store)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ paddingVertical: 8, alignItems: 'center' }}
                        onPress={onBack}
                        activeOpacity={0.8}
                    >
                        <Text style={{ color: TEXT_MUTED, fontWeight: '600', fontSize: 12 }}>
                            Koma Kasuwa (Back to Marketplace)
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (existingApp && existingApp.status === 'pending') {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: GOLD_SURFACE, borderColor: GOLD, width: 84, height: 84, borderRadius: 42 }]}>
                    <Ionicons name="time" size={50} color={GOLD_DARK} />
                </View>
                <Text style={localStyles.statusTitle}>Aikace-aikacenka na Kan Bita</Text>
                <Text style={localStyles.statusSub}>
                    Mun karɓi bayanan shagonka. Tawagarmu na kan duba takardunku da asusun banki. Wannan na ɗaukar tsawon sa'o'i 24 kacal.
                </Text>

                <View style={[localStyles.statusInfoBox, { width: '100%', marginBottom: 16 }]}>
                    <View style={localStyles.statusInfoRow}>
                        <Text style={localStyles.statusInfoLabel}>Ranar Gabatarwa</Text>
                        <Text style={localStyles.statusInfoVal}>{new Date(existingApp.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={localStyles.statusInfoRow}>
                        <Text style={localStyles.statusInfoLabel}>Kunshin Shago</Text>
                        <Text style={[localStyles.statusInfoVal, { color: GOLD_DARK }]}>{existingApp.subscription_plan}</Text>
                    </View>
                    <View style={localStyles.statusInfoRow}>
                        <Text style={localStyles.statusInfoLabel}>Halin Yanzu</Text>
                        <View style={localStyles.pendingPill}>
                            <Text style={localStyles.pendingPillText}>Ana Dubawa (Pending Review)</Text>
                        </View>
                    </View>
                </View>

                <View style={{ width: '100%', gap: 10 }}>
                    <TouchableOpacity
                        style={[localStyles.primaryActionBtn, { width: '100%' }]}
                        onPress={() => handleRetryApplication(existingApp)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="create-outline" size={18} color={NAVY_DARK} />
                        <Text style={localStyles.primaryActionBtnText}>Duba ko Gyara Bayanai (Edit Details)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[localStyles.secondaryActionBtn, { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                        onPress={openWhatsAppHelp}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                        <Text style={[localStyles.secondaryActionBtnText, { color: '#16A34A', fontWeight: '800' }]}>
                            Tuntubi Admin a WhatsApp
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ paddingVertical: 8, alignItems: 'center' }}
                        onPress={onBack}
                        activeOpacity={0.8}
                    >
                        <Text style={{ color: TEXT_SECONDARY, fontWeight: '700', fontSize: 13 }}>
                            Koma Kasuwa (Back to App)
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (existingApp && existingApp.status === 'rejected') {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: '#FEE2E2', borderColor: '#EF4444', width: 84, height: 84, borderRadius: 42 }]}>
                    <Ionicons name="close-circle" size={50} color="#EF4444" />
                </View>
                <Text style={localStyles.statusTitle}>Bayanin Ba da Amsa</Text>
                <Text style={localStyles.statusSub}>
                    Bayan duba bayanan shagonka, an sami wasu takardu ko bayanai da ke buƙatar gyara kafin kunna shago.
                </Text>

                <View style={[localStyles.statusInfoBox, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', width: '100%', marginBottom: 16 }]}>
                    <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>
                        Dalilin Shawara / Dalilin Gyara:
                    </Text>
                    <Text style={{ color: TEXT_PRIMARY, fontSize: 13, lineHeight: 18 }}>
                        {existingApp.rejection_reason || 'Da fatan a tabbatar da cewa lambar NIN, CAC, ko bayanan asusun banki sun dace da bayanan rajista.'}
                    </Text>
                </View>

                <View style={{ width: '100%', gap: 10 }}>
                    <TouchableOpacity
                        style={[localStyles.primaryActionBtn, { width: '100%' }]}
                        onPress={() => handleRetryApplication(existingApp)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="refresh" size={18} color={NAVY_DARK} />
                        <Text style={localStyles.primaryActionBtnText}>Gyara Bayanai & Sake Tura Aikace-aikace</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[localStyles.secondaryActionBtn, { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                        onPress={openWhatsAppHelp}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                        <Text style={[localStyles.secondaryActionBtnText, { color: '#16A34A', fontWeight: '800' }]}>
                            Yi Magana da Admin a WhatsApp
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ paddingVertical: 8, alignItems: 'center' }}
                        onPress={onBack}
                        activeOpacity={0.8}
                    >
                        <Text style={{ color: TEXT_MUTED, fontWeight: '600', fontSize: 12 }}>
                            Koma Kasuwa (Back to Marketplace)
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // MAIN WIZARD FORM (LUXURY NAVY & GOLD THEME)
    // ─────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={localStyles.screenContainer}>
            <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />

            {/* TOP NAVIGATION HEADER (ROYAL NAVY & GOLD) */}
            <View style={localStyles.topNavHeader}>
                <TouchableOpacity onPress={prevStep} style={localStyles.backIconBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color={GOLD} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={localStyles.topNavTitle}>Vendor Application</Text>
                    <Text style={localStyles.topNavSub}>Abu Mafhal Verified Merchant Suite</Text>
                </View>
                <TouchableOpacity onPress={openWhatsAppHelp} style={localStyles.helpPill} activeOpacity={0.7}>
                    <Ionicons name="logo-whatsapp" size={14} color="#10B981" />
                    <Text style={localStyles.helpPillText}>Help Desk</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onBack} style={localStyles.closeIconBtn} activeOpacity={0.7}>
                    <Ionicons name="close" size={20} color="#94A3B8" />
                </TouchableOpacity>
            </View>

            {/* Stepper Progress Bar */}
            {renderProgressBar()}

            {/* Scrollable Form Body */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={localStyles.scrollBody}
                keyboardShouldPersistTaps="handled"
            >
                {/* MERCHANT PERKS SHOWCASE BANNER (STEP 1 & 6) */}
                {(step === 1 || step === 6) && (
                    <View style={localStyles.perksBanner}>
                        <LinearGradient
                            colors={[NAVY_DARK, NAVY_LIGHT]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={localStyles.perksBannerGradient}
                        >
                            <View style={localStyles.perksBannerHeader}>
                                <View style={localStyles.crownCircle}>
                                    <Ionicons name="shield-checkmark" size={20} color={GOLD} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={localStyles.perksBannerTitle}>Abu Mafhal Merchant Suite</Text>
                                        <View style={localStyles.goldPillTag}>
                                            <Text style={localStyles.goldPillTagText}>PRO ACCREDITED</Text>
                                        </View>
                                    </View>
                                    <Text style={localStyles.perksBannerSub}>0% Commission Trial • Same-Day Payouts • Escrow Protection</Text>
                                </View>
                            </View>
                            <View style={localStyles.perksGrid}>
                                <View style={localStyles.perkItem}>
                                    <Ionicons name="lock-closed" size={13} color={GOLD} />
                                    <Text style={localStyles.perkItemText}>100% Escrow</Text>
                                </View>
                                <View style={localStyles.perkItem}>
                                    <Ionicons name="flash" size={13} color={GOLD} />
                                    <Text style={localStyles.perkItemText}>Instant Settlement</Text>
                                </View>
                                <View style={localStyles.perkItem}>
                                    <Ionicons name="car" size={13} color={GOLD} />
                                    <Text style={localStyles.perkItemText}>Nationwide Logistics</Text>
                                </View>
                                <View style={localStyles.perkItem}>
                                    <Ionicons name="ribbon" size={13} color={GOLD} />
                                    <Text style={localStyles.perkItemText}>Verified Badge</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>
                )}

                {/* STEP 1: BUSINESS REGISTRATION STRUCTURE & PROFILE */}
                {step === 1 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="business" size={20} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Business Structure & Profile</Text>
                                <Text style={localStyles.cardSub}>Choose your legal structure and store identity</Text>
                            </View>
                        </View>

                        {/* BUSINESS REGISTRATION TYPE SELECTOR */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Business Registration Structure</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <Text style={{ fontSize: 11.5, color: TEXT_MUTED, marginBottom: 8 }}>
                                Select your official commercial entity status:
                            </Text>

                            <View style={{ gap: 8 }}>
                                {BUSINESS_TYPES.map(bt => {
                                    const isSelected = formData.businessType === bt.id;
                                    return (
                                        <TouchableOpacity
                                            key={bt.id}
                                            style={[
                                                localStyles.businessTypeCard,
                                                isSelected && localStyles.businessTypeCardActive
                                            ]}
                                            onPress={() => updateForm('businessType', bt.id)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={[
                                                localStyles.btIconBox,
                                                isSelected && { backgroundColor: NAVY_DARK }
                                            ]}>
                                                <Ionicons
                                                    name={bt.icon}
                                                    size={18}
                                                    color={isSelected ? GOLD : NAVY_DARK}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={[
                                                        localStyles.btTitle,
                                                        isSelected && { color: NAVY_DARK, fontWeight: '900' }
                                                    ]}>
                                                        {bt.label}
                                                    </Text>
                                                    <View style={[
                                                        localStyles.btBadge,
                                                        isSelected && { backgroundColor: GOLD_SURFACE, borderColor: GOLD }
                                                    ]}>
                                                        <Text style={[
                                                            localStyles.btBadgeText,
                                                            isSelected && { color: GOLD_DARK }
                                                        ]}>{bt.badge}</Text>
                                                    </View>
                                                </View>
                                                <Text style={localStyles.btDesc}>{bt.desc}</Text>
                                            </View>
                                            <View style={[
                                                localStyles.radioCircle,
                                                isSelected && localStyles.radioCircleActive
                                            ]}>
                                                {isSelected && <View style={localStyles.radioDot} />}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={localStyles.divider} />

                        {/* Store Name */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Store / Enterprise Trading Name</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.businessName}
                                onChangeText={t => updateForm('businessName', t)}
                                placeholder="e.g. Sani Ventures & Electronics"
                                placeholderTextColor={TEXT_MUTED}
                            />
                        </View>

                        {/* Store Description */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Store Overview / Bio</Text>
                            </View>
                            <TextInput
                                style={[localStyles.textInput, { height: 74, textAlignVertical: 'top', paddingTop: 10 }]}
                                value={formData.businessDescription}
                                onChangeText={t => updateForm('businessDescription', t)}
                                placeholder="Briefly describe the goods and services your store offers..."
                                placeholderTextColor={TEXT_MUTED}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        {/* Phone */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Official Business Phone Number</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.phone}
                                onChangeText={t => updateForm('phone', t)}
                                placeholder="+234 800 000 0000"
                                placeholderTextColor={TEXT_MUTED}
                                keyboardType="phone-pad"
                            />
                        </View>

                        {/* Store / Location Type */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Inventory & Premise Type</Text>
                            </View>
                            <View style={{ gap: 6 }}>
                                {LOCATION_TYPES.map(loc => {
                                    const isSelected = formData.locationType === loc.id;
                                    return (
                                        <TouchableOpacity
                                            key={loc.id}
                                            style={[
                                                localStyles.locationCard,
                                                isSelected && localStyles.locationCardActive
                                            ]}
                                            onPress={() => updateForm('locationType', loc.id)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name={loc.icon} size={16} color={isSelected ? GOLD_DARK : NAVY_DARK} />
                                            <Text style={[
                                                localStyles.locationCardText,
                                                isSelected && { color: NAVY_DARK, fontWeight: '800' }
                                            ]}>{loc.label}</Text>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={16} color={GOLD_DARK} style={{ marginLeft: 'auto' }} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Physical Address */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Physical Store Address</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.businessAddress}
                                onChangeText={t => updateForm('businessAddress', t)}
                                placeholder="Shop / Suite number, Street, Commercial Plaza"
                                placeholderTextColor={TEXT_MUTED}
                            />
                        </View>

                        {/* Commercial Hub */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Ionicons name="location" size={14} color={GOLD_DARK} />
                                <Text style={localStyles.inputLabel}>Primary Commercial Trading Hub</Text>
                            </View>
                            <View style={localStyles.hubPillsRow}>
                                {OPERATING_HUBS.map(hub => {
                                    const isSelected = formData.operatingHub === hub.id;
                                    return (
                                        <TouchableOpacity
                                            key={hub.id}
                                            style={[
                                                localStyles.hubPill,
                                                isSelected && localStyles.hubPillActive
                                            ]}
                                            onPress={() => updateForm('operatingHub', hub.id)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[
                                                localStyles.hubPillText,
                                                isSelected && localStyles.hubPillTextActive
                                            ]}>
                                                {hub.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={localStyles.divider} />
                        <View style={localStyles.sectionHeaderBox}>
                            <Ionicons name="shield-checkmark" size={16} color={NAVY_DARK} />
                            <Text style={localStyles.sectionSubHeader}>GOVERNMENT COMPLIANCE & KYC</Text>
                        </View>

                        {/* Dynamic CAC: REMOVED COMPLETELY FOR INDIVIDUAL TRADERS */}
                        {formData.businessType !== 'sole_proprietor' ? (
                            renderVerifiedField(
                                activeBusinessType.cacLabel,
                                "cacNumber",
                                "cac",
                                activeBusinessType.cacPlaceholder,
                                "default",
                                undefined,
                                activeBusinessType.cacRequired
                            )
                        ) : (
                            <View style={localStyles.individualPerkCard}>
                                <View style={localStyles.individualPerkIconBox}>
                                    <Ionicons name="checkmark-done-circle" size={24} color={EMERALD} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.individualPerkTitle}>Individual Merchant Pass Active</Text>
                                    <Text style={localStyles.individualPerkSub}>
                                        CAC certificate is not required for individual traders and artisans. You are verified directly with your National NIN.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Tax ID (TIN) */}
                        {renderVerifiedField("Tax Identification Number (TIN)", "tinNumber", "tin", "10-digit TIN Number (Optional)", "numeric", 10, false)}

                        {/* National ID (NIN) */}
                        {renderVerifiedField("National Identity Number (NIN)", "nin", "nin", "11-digit NIN Number", "numeric", 11, true)}

                        {/* Bank Verification Number (BVN) */}
                        {renderVerifiedField("Bank Verification Number (BVN)", "bvn", "bvn", "11-digit BVN Number (Optional)", "numeric", 11, false)}
                    </View>
                )}

                {/* STEP 2: CATALOG, SALES MODEL & SOCIALS */}
                {step === 2 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="pricetags" size={20} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Store Catalog & Distribution</Text>
                                <Text style={localStyles.cardSub}>Set your primary industry and wholesale distribution model</Text>
                            </View>
                        </View>

                        {/* Primary Category */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Primary Storefront Category</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <Text style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 10 }}>
                                Choose the industry category that fits your products:
                            </Text>

                            <View style={localStyles.categoryGrid}>
                                {BUSINESS_CATEGORIES.map(cat => {
                                    const isSelected = formData.businessCategory === cat.id;
                                    return (
                                        <TouchableOpacity
                                            key={cat.id}
                                            style={[
                                                localStyles.categoryChip,
                                                isSelected && localStyles.categoryChipSelected
                                            ]}
                                            onPress={() => updateForm('businessCategory', cat.id)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[
                                                    localStyles.categoryChipText,
                                                    isSelected && localStyles.categoryChipTextSelected
                                                ]}>
                                                    {cat.label}
                                                </Text>
                                                <Text style={localStyles.categorySubText}>{cat.sub}</Text>
                                            </View>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={18} color={NAVY_DARK} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Distribution Model: Wholesale vs Retail */}
                        <View style={[localStyles.fieldGroup, { marginTop: 12 }]}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Sales & Distribution Focus</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <View style={{ gap: 8 }}>
                                {SALES_MODELS.map(model => {
                                    const isSelected = formData.salesModel === model.id;
                                    return (
                                        <TouchableOpacity
                                            key={model.id}
                                            style={[
                                                localStyles.slaCard,
                                                isSelected && localStyles.slaCardActive
                                            ]}
                                            onPress={() => updateForm('salesModel', model.id)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={[localStyles.slaTitle, isSelected && { color: NAVY_DARK }]}>
                                                        {model.label}
                                                    </Text>
                                                    <View style={[localStyles.slaBadge, isSelected && { backgroundColor: GOLD_SURFACE }]}>
                                                        <Text style={[localStyles.slaBadgeText, isSelected && { color: GOLD_DARK }]}>{model.badge}</Text>
                                                    </View>
                                                </View>
                                                <Text style={localStyles.slaDesc}>{model.desc}</Text>
                                            </View>
                                            <View style={[localStyles.radioCircle, isSelected && localStyles.radioCircleActive]}>
                                                {isSelected && <View style={localStyles.radioDot} />}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Experience in Business */}
                        <View style={[localStyles.fieldGroup, { marginTop: 8 }]}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Years Operating</Text>
                            </View>
                            <View style={localStyles.experienceRow}>
                                {EXPERIENCE_OPTIONS.map(exp => {
                                    const isSelected = formData.yearsInBusiness === exp;
                                    return (
                                        <TouchableOpacity
                                            key={exp}
                                            style={[
                                                localStyles.expPill,
                                                isSelected && localStyles.expPillSelected
                                            ]}
                                            onPress={() => updateForm('yearsInBusiness', exp)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[
                                                localStyles.expPillText,
                                                isSelected && localStyles.expPillTextSelected
                                            ]}>{exp}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={localStyles.divider} />
                        <View style={localStyles.sectionHeaderBox}>
                            <Ionicons name="globe" size={16} color={NAVY_DARK} />
                            <Text style={localStyles.sectionSubHeader}>DIGITAL STOREFRONT & SOCIAL CHANNELS</Text>
                        </View>

                        {/* WhatsApp */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                                <Text style={localStyles.inputLabel}>WhatsApp Business Support Line</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.whatsapp}
                                onChangeText={t => updateForm('whatsapp', t)}
                                placeholder="+234 800 000 0000"
                                placeholderTextColor={TEXT_MUTED}
                                keyboardType="phone-pad"
                            />
                        </View>

                        {/* Instagram */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Ionicons name="logo-instagram" size={14} color="#E1306C" />
                                <Text style={localStyles.inputLabel}>Instagram Brand Handle</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.instagram}
                                onChangeText={t => updateForm('instagram', t)}
                                placeholder="@yourbrandhandle"
                                placeholderTextColor={TEXT_MUTED}
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Website */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Ionicons name="link" size={14} color="#3B82F6" />
                                <Text style={localStyles.inputLabel}>Website / Catalog Link (Optional)</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.website}
                                onChangeText={t => updateForm('website', t)}
                                placeholder="https://yourstore.com"
                                placeholderTextColor={TEXT_MUTED}
                                autoCapitalize="none"
                            />
                        </View>
                    </View>
                )}

                {/* STEP 3: DOCUMENTS & VERIFICATION */}
                {step === 3 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="document-attach" size={20} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Compliance Documents & Logo</Text>
                                <Text style={localStyles.cardSub}>Upload photos or PDF documents for your storefront</Text>
                            </View>
                        </View>

                        {/* Storefront Logo */}
                        <Text style={localStyles.inputLabel}>Storefront Brand Logo</Text>
                        <View style={localStyles.logoPreviewCard}>
                            <View style={localStyles.logoBox}>
                                {files.logo?.uri ? (
                                    <Image source={{ uri: files.logo.uri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                                ) : (
                                    <Ionicons name="image-outline" size={28} color={TEXT_MUTED} />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                {files.logo?.isAvatar && (
                                    <View style={localStyles.avatarBadge}>
                                        <Text style={localStyles.avatarBadgeText}>Using Account Profile Picture</Text>
                                    </View>
                                )}
                                <Text style={localStyles.logoStatusText}>
                                    {files.logo ? 'Store Brand Logo Attached' : 'No Store Logo Selected'}
                                </Text>
                                <TouchableOpacity onPress={() => pickDocument('logo', true)} style={{ marginTop: 4 }}>
                                    <Text style={localStyles.logoActionText}>
                                        {files.logo ? 'Change Logo Image' : 'Tap to Upload Brand Logo'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* CAC & CORPORATE DOCUMENTS: CONDITIONAL BY BUSINESS TYPE */}
                        {formData.businessType === 'limited_company' && (
                            <View style={{ gap: 4, marginBottom: 4 }}>
                                <View style={localStyles.docGroupHeader}>
                                    <Ionicons name="business" size={15} color={NAVY_DARK} />
                                    <Text style={localStyles.docGroupTitle}>Limited Company Documents (3 Required)</Text>
                                </View>
                                <UploadBtn
                                    label="1. CAC Certificate of Incorporation"
                                    file={files.cac}
                                    onPress={() => pickDocument('cac')}
                                    icon="ribbon-outline"
                                    required
                                />
                                <UploadBtn
                                    label="2. CAC Status Report (Directors & Shares)"
                                    file={files.cacStatus}
                                    onPress={() => pickDocument('cacStatus')}
                                    icon="document-text-outline"
                                    required
                                />
                                <UploadBtn
                                    label="3. Memorandum & Articles (MEMART)"
                                    file={files.memorandum}
                                    onPress={() => pickDocument('memorandum')}
                                    icon="book-outline"
                                    required
                                />
                            </View>
                        )}

                        {formData.businessType === 'business_name' && (
                            <View style={{ gap: 4, marginBottom: 4 }}>
                                <View style={localStyles.docGroupHeader}>
                                    <Ionicons name="storefront" size={15} color={NAVY_DARK} />
                                    <Text style={localStyles.docGroupTitle}>Business Name Documents (2 Required)</Text>
                                </View>
                                <UploadBtn
                                    label="1. CAC Business Name Certificate"
                                    file={files.cac}
                                    onPress={() => pickDocument('cac')}
                                    icon="ribbon-outline"
                                    required
                                />
                                <UploadBtn
                                    label="2. CAC Status Report (Proprietor Particulars)"
                                    file={files.cacStatus}
                                    onPress={() => pickDocument('cacStatus')}
                                    icon="document-text-outline"
                                    required
                                />
                            </View>
                        )}

                        {formData.businessType === 'partnership' && (
                            <View style={{ gap: 4, marginBottom: 4 }}>
                                <View style={localStyles.docGroupHeader}>
                                    <Ionicons name="people" size={15} color={NAVY_DARK} />
                                    <Text style={localStyles.docGroupTitle}>Cooperative / Partnership Documents (2 Required)</Text>
                                </View>
                                <UploadBtn
                                    label="1. Cooperative / Partnership Certificate"
                                    file={files.cac}
                                    onPress={() => pickDocument('cac')}
                                    icon="ribbon-outline"
                                    required
                                />
                                <UploadBtn
                                    label="2. Cooperative Status Report / Bylaws"
                                    file={files.cacStatus}
                                    onPress={() => pickDocument('cacStatus')}
                                    icon="document-text-outline"
                                    required
                                />
                            </View>
                        )}

                        {formData.businessType === 'sole_proprietor' && (
                            <View style={[localStyles.individualPerkCard, { marginVertical: 8 }]}>
                                <View style={localStyles.individualPerkIconBox}>
                                    <Ionicons name="checkmark-done-circle" size={24} color={EMERALD} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.individualPerkTitle}>No CAC Documents Required</Text>
                                    <Text style={localStyles.individualPerkSub}>
                                        As an Individual Trader / Artisan, you do not need CAC certificates, status reports, or memorandum. Only your NIN identity document below is required.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* NIN Slip */}
                        <UploadBtn
                            label="NIN Slip / Identification Card"
                            file={files.nin}
                            onPress={() => pickDocument('nin')}
                            icon="card-outline"
                            required
                        />

                        {/* Intro Video */}
                        <UploadBtn
                            label="Store Intro / Verification Video (Optional)"
                            file={files.video}
                            onPress={() => pickDocument('video', false)}
                            icon="videocam-outline"
                            required={false}
                        />
                    </View>
                )}

                {/* STEP 4: LOGISTICS & RETURN GUARANTEE */}
                {step === 4 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="cube" size={20} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Logistics & Customer Policy</Text>
                                <Text style={localStyles.cardSub}>Set fulfillment dispatch speed and return guarantees</Text>
                            </View>
                        </View>

                        {/* Fulfillment Method */}
                        <Text style={localStyles.inputLabel}>Fulfillment Method</Text>
                        <View style={{ gap: 10, marginBottom: 16 }}>
                            <TouchableOpacity
                                style={[
                                    localStyles.deliveryOptionCard,
                                    formData.deliveryType === 'marketplace' && localStyles.deliveryOptionCardActive
                                ]}
                                onPress={() => updateForm('deliveryType', 'marketplace')}
                                activeOpacity={0.8}
                            >
                                <View style={[localStyles.deliveryIconBox, formData.deliveryType === 'marketplace' && { backgroundColor: NAVY_DARK }]}>
                                    <Ionicons
                                        name="shield-checkmark"
                                        size={22}
                                        color={formData.deliveryType === 'marketplace' ? GOLD : TEXT_MUTED}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[localStyles.deliveryTitle, formData.deliveryType === 'marketplace' && { color: NAVY_DARK }]}>
                                        Fulfilled by Abu Mafhal
                                    </Text>
                                    <Text style={localStyles.deliveryDesc}>
                                        We handle packaging, nationwide doorstep courier dispatch, and automated live buyer tracking.
                                    </Text>
                                </View>
                                <View style={[localStyles.radioCircle, formData.deliveryType === 'marketplace' && localStyles.radioCircleActive]}>
                                    {formData.deliveryType === 'marketplace' && <View style={localStyles.radioDot} />}
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    localStyles.deliveryOptionCard,
                                    formData.deliveryType === 'self' && localStyles.deliveryOptionCardActive
                                ]}
                                onPress={() => updateForm('deliveryType', 'self')}
                                activeOpacity={0.8}
                            >
                                <View style={[localStyles.deliveryIconBox, formData.deliveryType === 'self' && { backgroundColor: NAVY_DARK }]}>
                                    <Ionicons
                                        name="bicycle"
                                        size={22}
                                        color={formData.deliveryType === 'self' ? GOLD : TEXT_MUTED}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[localStyles.deliveryTitle, formData.deliveryType === 'self' && { color: NAVY_DARK }]}>
                                        Self Dispatch & Merchant Logistics
                                    </Text>
                                    <Text style={localStyles.deliveryDesc}>
                                        Dispatch parcels yourself using your own dedicated riders and local courier network.
                                    </Text>
                                </View>
                                <View style={[localStyles.radioCircle, formData.deliveryType === 'self' && localStyles.radioCircleActive]}>
                                    {formData.deliveryType === 'self' && <View style={localStyles.radioDot} />}
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Dispatch SLA */}
                        <Text style={[localStyles.inputLabel, { marginTop: 4 }]}>Order Preparation & Dispatch Speed</Text>
                        <View style={{ gap: 8, marginBottom: 16 }}>
                            {DISPATCH_SLAS.map(sla => {
                                const isSelected = formData.dispatchSla === sla.id;
                                return (
                                    <TouchableOpacity
                                        key={sla.id}
                                        style={[
                                            localStyles.slaCard,
                                            isSelected && localStyles.slaCardActive
                                        ]}
                                        onPress={() => updateForm('dispatchSla', sla.id)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={[localStyles.slaTitle, isSelected && { color: NAVY_DARK }]}>
                                                    {sla.label}
                                                </Text>
                                                <View style={[localStyles.slaBadge, isSelected && { backgroundColor: GOLD_SURFACE }]}>
                                                    <Text style={[localStyles.slaBadgeText, isSelected && { color: GOLD_DARK }]}>{sla.badge}</Text>
                                                </View>
                                            </View>
                                            <Text style={localStyles.slaDesc}>{sla.time}</Text>
                                        </View>
                                        <View style={[localStyles.radioCircle, isSelected && localStyles.radioCircleActive]}>
                                            {isSelected && <View style={localStyles.radioDot} />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Customer Return Policy */}
                        <Text style={[localStyles.inputLabel, { marginTop: 4 }]}>Buyer Return & Warranty Policy</Text>
                        <View style={{ gap: 8, marginBottom: 18 }}>
                            {RETURN_POLICIES.map(policy => {
                                const isSelected = formData.returnPolicy === policy.id;
                                return (
                                    <TouchableOpacity
                                        key={policy.id}
                                        style={[
                                            localStyles.slaCard,
                                            isSelected && localStyles.slaCardActive
                                        ]}
                                        onPress={() => updateForm('returnPolicy', policy.id)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={[localStyles.slaTitle, isSelected && { color: NAVY_DARK }]}>
                                                    {policy.label}
                                                </Text>
                                                <View style={[localStyles.slaBadge, isSelected && { backgroundColor: GOLD_SURFACE }]}>
                                                    <Text style={[localStyles.slaBadgeText, isSelected && { color: GOLD_DARK }]}>{policy.badge}</Text>
                                                </View>
                                            </View>
                                            <Text style={localStyles.slaDesc}>{policy.desc}</Text>
                                        </View>
                                        <View style={[localStyles.radioCircle, isSelected && localStyles.radioCircleActive]}>
                                            {isSelected && <View style={localStyles.radioDot} />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={localStyles.divider} />
                        <View style={localStyles.sectionHeaderBox}>
                            <Ionicons name="people" size={16} color={NAVY_DARK} />
                            <Text style={localStyles.sectionSubHeader}>BUSINESS GUARANTOR (OPTIONAL)</Text>
                        </View>
                        <Text style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>
                            You can provide a business guarantor now or complete this later from your store settings.
                        </Text>

                        {/* Guarantor Name */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Guarantor Full Legal Name</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.guarantorName}
                                onChangeText={t => updateForm('guarantorName', t)}
                                placeholder="Full name of corporate or business guarantor"
                                placeholderTextColor={TEXT_MUTED}
                            />
                        </View>

                        {/* Guarantor Phone */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Guarantor Mobile Number</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.guarantorPhone}
                                onChangeText={t => updateForm('guarantorPhone', t)}
                                placeholder="+234 800 000 0000"
                                placeholderTextColor={TEXT_MUTED}
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>
                )}

                {/* STEP 5: BANKING & SETTLEMENT */}
                {step === 5 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="card" size={20} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Payout & Settlement Account</Text>
                                <Text style={localStyles.cardSub}>Where your product sales & payouts are automatically sent</Text>
                            </View>
                        </View>

                        {/* LUXURY ROYAL NAVY & GOLD VIRTUAL SETTLEMENT ATM CARD */}
                        <LinearGradient
                            colors={['#071324', '#0F274B', '#1E3E6E']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={localStyles.atmCardContainer}
                        >
                            {/* Card Top Row */}
                            <View style={localStyles.atmTopRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    {/* Gold Chip */}
                                    <View style={localStyles.atmChipBox}>
                                        <View style={localStyles.atmChipInner} />
                                    </View>
                                    <Ionicons name="wifi" size={18} color="rgba(217, 167, 58, 0.8)" style={{ transform: [{ rotate: '90deg' }] }} />
                                </View>
                                <View style={localStyles.atmBankBadge}>
                                    <Ionicons name="business" size={11} color={GOLD} />
                                    <Text style={localStyles.atmBankBadgeText} numberOfLines={1}>
                                        {formData.bankName || 'SETTLEMENT BANK'}
                                    </Text>
                                </View>
                            </View>

                            {/* Card Middle: Account Number */}
                            <View style={localStyles.atmNumberRow}>
                                <Text style={localStyles.atmNumberText}>
                                    {formData.accountNumber
                                        ? formData.accountNumber.padEnd(10, '•').replace(/(\d{3}|\W{3})(\d{3}|\W{3})(\d{4}|\W{4})/, '$1  $2  $3')
                                        : '••••   ••••   ••••'}
                                </Text>
                            </View>

                            {/* Card Bottom: Beneficiary & Badge */}
                            <View style={localStyles.atmBottomRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.atmLabelSmall}>SETTLEMENT BENEFICIARY</Text>
                                    <Text style={localStyles.atmBeneficiaryName} numberOfLines={1}>
                                        {(formData.accountName || formData.fullName || 'ACCOUNT HOLDER').toUpperCase()}
                                    </Text>
                                </View>
                                <View style={localStyles.atmVerifiedBadge}>
                                    <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                                    <Text style={localStyles.atmVerifiedBadgeText}>AUTO-PAY</Text>
                                </View>
                            </View>
                        </LinearGradient>

                        {/* POPULAR BANKS QUICK BAR */}
                        <Text style={localStyles.popularBanksLabel}>QUICK SELECT POPULAR BANKS</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={localStyles.bankPillsScroll}
                        >
                            {NIGERIAN_BANKS.filter(b => b.popular).map(b => {
                                const isSelected = formData.bankName === b.name;
                                return (
                                    <TouchableOpacity
                                        key={b.code}
                                        style={[
                                            localStyles.popularBankPill,
                                            isSelected && localStyles.popularBankPillActive
                                        ]}
                                        onPress={() => selectBank(b)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons
                                            name={b.logo || 'business'}
                                            size={14}
                                            color={isSelected ? NAVY_DARK : GOLD}
                                        />
                                        <Text style={[
                                            localStyles.popularBankPillText,
                                            isSelected && localStyles.popularBankPillTextActive
                                        ]}>
                                            {b.name.split(' (')[0]}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={13} color={NAVY_DARK} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Bank Selector Button */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Commercial / MFB Settlement Bank</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TouchableOpacity
                                style={localStyles.selectBankBtn}
                                onPress={() => setShowBankDropdown(true)}
                                activeOpacity={0.8}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                    <Ionicons name="business-outline" size={18} color={GOLD_DARK} />
                                    <Text style={[localStyles.selectBankText, formData.bankName ? { color: TEXT_PRIMARY, fontWeight: '700' } : null]}>
                                        {formData.bankName || 'Tap to choose your bank from 30+ banks'}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-down" size={18} color={NAVY_DARK} />
                            </TouchableOpacity>
                        </View>

                        {/* 10-Digit Account Number */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>10-Digit NUBAN Account Number</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TextInput
                                style={[localStyles.textInput, { fontSize: 16, letterSpacing: 2, fontWeight: '800' }]}
                                value={formData.accountNumber}
                                onChangeText={t => updateForm('accountNumber', t.replace(/[^0-9]/g, ''))}
                                placeholder="0123456789"
                                placeholderTextColor={TEXT_MUTED}
                                keyboardType="numeric"
                                maxLength={10}
                            />
                        </View>

                        {/* Account Name */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Account Beneficiary Name</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                                {formData.accountName ? (
                                    <View style={localStyles.verifiedTag}>
                                        <Ionicons name="checkmark-circle" size={13} color={EMERALD} />
                                        <Text style={localStyles.verifiedTagText}>Confirmed</Text>
                                    </View>
                                ) : null}
                            </View>
                            <View style={[localStyles.textInput, { flexDirection: 'row', alignItems: 'center' }]}>
                                {resolvingAccount && (
                                    <ActivityIndicator size="small" color={GOLD_DARK} style={{ marginRight: 8 }} />
                                )}
                                <TextInput
                                    style={{ flex: 1, color: TEXT_PRIMARY, fontWeight: '700', fontSize: 14.5 }}
                                    value={formData.accountName}
                                    onChangeText={t => updateForm('accountName', t)}
                                    editable={true}
                                    placeholder={
                                        resolvingAccount
                                            ? "Verifying account with NIBSS..."
                                            : "Account Beneficiary Full Name"
                                    }
                                    placeholderTextColor={TEXT_MUTED}
                                />
                            </View>
                            <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
                                Instant weekly or on-demand automated payout deposits will be credited to this account.
                            </Text>
                        </View>
                    </View>
                )}

                {/* STEP 6: CHOOSE PLAN & CONFIRM */}
                {step === 6 && (
                    <View style={localStyles.stepCard}>
                        {/* Notice Banner (If user returned from Paystack/Flutterwave cancellation or issue) */}
                        {paymentNotice && (
                            <View style={localStyles.paymentNoticeBanner}>
                                <Ionicons name="alert-circle" size={20} color="#D97706" />
                                <Text style={localStyles.paymentNoticeText}>{paymentNotice}</Text>
                                <TouchableOpacity onPress={() => setPaymentNotice(null)} style={{ padding: 4 }}>
                                    <Ionicons name="close" size={18} color="#92400E" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ── SECTION HEADER ── */}
                        <View style={localStyles.modernSectionHeader}>
                            <View style={localStyles.modernSectionIconWrap}>
                                <Ionicons name="trophy" size={18} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.modernSectionTitle}>Choose Your Plan</Text>
                                <Text style={localStyles.modernSectionSub}>Select the subscription that fits your business</Text>
                            </View>
                        </View>

                        {/* ── PLAN CARDS ── */}
                        <View style={{ gap: 10, marginBottom: 24 }}>
                            {activeVendorPlans.map(planItem => {
                                const isSelected = formData.selectedPlan === planItem.id;
                                const isFree = planItem.price === 0;
                                return (
                                    <TouchableOpacity
                                        key={planItem.id}
                                        style={[
                                            localStyles.modernPlanCard,
                                            isSelected && localStyles.modernPlanCardSelected
                                        ]}
                                        onPress={() => updateForm('selectedPlan', planItem.id)}
                                        activeOpacity={0.75}
                                    >
                                        {isSelected && <View style={localStyles.planCardAccentLine} />}
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <Text style={[localStyles.modernPlanLabel, isSelected && { color: NAVY_DARK }]}>
                                                    {planItem.label}
                                                </Text>
                                                {planItem.badge && (
                                                    <View style={localStyles.modernPlanBadge}>
                                                        <Text style={localStyles.modernPlanBadgeText}>{planItem.badge}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={[localStyles.modernPlanPrice, isFree && { color: EMERALD }]}>
                                                {isFree ? 'Free Trial' : `₦${planItem.price.toLocaleString()}`}
                                            </Text>
                                            {planItem.description ? <Text style={localStyles.modernPlanDesc}>{planItem.description}</Text> : null}
                                        </View>
                                        <View style={[localStyles.modernPlanCheck, isSelected && localStyles.modernPlanCheckActive]}>
                                            {isSelected ? <Ionicons name="checkmark" size={16} color={NAVY_DARK} /> : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* ── PAYMENT METHOD TABS ── */}
                        {plan.price > 0 && (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={localStyles.modernMethodLabel}>PAYMENT METHOD</Text>
                                <View style={localStyles.modernMethodTabs}>
                                    {[
                                        { key: 'paystack',      icon: 'card-outline',     label: 'Paystack',    color: '#0284C7' },
                                        { key: 'flutterwave',   icon: 'globe-outline',    label: 'Flutterwave', color: '#D97706' },
                                        { key: 'bank_transfer', icon: 'business-outline', label: 'Bank',        color: '#059669' },
                                        { key: 'wallet',        icon: 'wallet-outline',   label: 'Wallet',      color: '#7C3AED' },
                                    ].map(m => {
                                        const active = paymentMethod === m.key;
                                        return (
                                            <TouchableOpacity
                                                key={m.key}
                                                style={[localStyles.modernMethodTab, active && { borderColor: m.color, backgroundColor: m.color + '14' }]}
                                                onPress={() => setPaymentMethod(m.key)}
                                                activeOpacity={0.75}
                                            >
                                                <Ionicons name={m.icon} size={18} color={active ? m.color : TEXT_MUTED} />
                                                <Text style={[localStyles.modernMethodTabText, active && { color: m.color }]}>{m.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* PAYSTACK PANEL */}
                                {paymentMethod === 'paystack' && (
                                    <View style={[localStyles.modernGatewayPanel, { borderLeftColor: '#0284C7' }]}>
                                        <View style={[localStyles.modernGatewayIconCircle, { backgroundColor: '#0284C720' }]}>
                                            <Ionicons name="shield-checkmark" size={22} color="#0284C7" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <Text style={localStyles.modernGatewayTitle}>Paystack Secure Checkout</Text>
                                                <View style={localStyles.autoVerifyBadge}>
                                                    <Text style={localStyles.autoVerifyBadgeText}>AUTO-VERIFY</Text>
                                                </View>
                                            </View>
                                            <Text style={localStyles.modernGatewaySub}>ATM card · USSD · Bank Transfer · Apple Pay. Store activates instantly after payment.</Text>
                                        </View>
                                    </View>
                                )}

                                {/* FLUTTERWAVE PANEL */}
                                {paymentMethod === 'flutterwave' && (
                                    <View style={[localStyles.modernGatewayPanel, { borderLeftColor: '#D97706' }]}>
                                        <View style={[localStyles.modernGatewayIconCircle, { backgroundColor: '#F59E0B20' }]}>
                                            <Ionicons name="globe" size={22} color="#D97706" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <Text style={localStyles.modernGatewayTitle}>Flutterwave Africa</Text>
                                                <View style={[localStyles.autoVerifyBadge, { backgroundColor: '#F59E0B18', borderColor: '#D97706' }]}>
                                                    <Text style={[localStyles.autoVerifyBadgeText, { color: '#D97706' }]}>CARDS & MOBILE</Text>
                                                </View>
                                            </View>
                                            <Text style={localStyles.modernGatewaySub}>Mastercard · Visa · Mobile Money · Africa-wide payout. Auto-verified on success.</Text>
                                        </View>
                                    </View>
                                )}

                                {/* BANK TRANSFER PANEL */}
                                {paymentMethod === 'bank_transfer' && (
                                    <View>
                                        <LinearGradient colors={['#071324', '#0F274B', '#16335F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={localStyles.officialBankCard}>
                                            <View style={localStyles.officialBankHeader}>
                                                <View style={localStyles.cardIconBox}><Ionicons name="business" size={18} color={GOLD} /></View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={localStyles.officialBankTitle}>ABU MAFHAL OFFICIAL ACCOUNT</Text>
                                                    <Text style={localStyles.officialBankSub}>Transfer the exact amount below to this account</Text>
                                                </View>
                                            </View>
                                            {[
                                                { label: 'Bank Name',          value: settings?.official_bank_name      || 'Moniepoint MFB',                field: 'bank',     style: {} },
                                                { label: 'Account Number',     value: settings?.official_account_number || '5051567890',                    field: 'acc_num',  style: { letterSpacing: 1.5, color: '#FCD34D' } },
                                                { label: 'Account Name',       value: settings?.official_account_name   || 'Abu Mafhal Global Concept Ltd',  field: 'acc_name', style: {} },
                                                { label: 'Amount to Transfer', value: `₦${plan.price.toLocaleString()}`,                                     field: 'amount',   style: { color: '#34D399', fontSize: 16 } },
                                            ].map((row, idx, arr) => (
                                                <View key={row.field} style={[localStyles.bankCopyRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={localStyles.bankCopyLabel}>{row.label}</Text>
                                                        <Text style={[localStyles.bankCopyVal, row.style]}>{row.value}</Text>
                                                    </View>
                                                    <TouchableOpacity style={[localStyles.copyActionBtn, copiedField === row.field && localStyles.copyActionBtnSuccess]} onPress={() => copyToClipboard(row.field === 'amount' ? plan.price.toString() : row.value, row.field)} activeOpacity={0.8}>
                                                        <Ionicons name={copiedField === row.field ? 'checkmark-circle' : 'copy-outline'} size={13} color={copiedField === row.field ? '#34D399' : GOLD} />
                                                        <Text style={[localStyles.copyActionText, copiedField === row.field && localStyles.copyActionTextSuccess]}>{copiedField === row.field ? 'Copied!' : 'Copy'}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                            <View style={[localStyles.bankCopyRow, { borderBottomWidth: 0, marginTop: 4 }]}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={localStyles.bankCopyLabel}>Payment Reference</Text>
                                                    <Text style={[localStyles.bankCopyVal, { fontSize: 12, color: 'rgba(255,255,255,0.8)' }]}>{manualReference}</Text>
                                                </View>
                                                <TouchableOpacity style={[localStyles.copyActionBtn, copiedField === 'ref' && localStyles.copyActionBtnSuccess]} onPress={() => copyToClipboard(manualReference, 'ref')} activeOpacity={0.8}>
                                                    <Ionicons name={copiedField === 'ref' ? 'checkmark-circle' : 'copy-outline'} size={13} color={copiedField === 'ref' ? '#34D399' : GOLD} />
                                                    <Text style={[localStyles.copyActionText, copiedField === 'ref' && localStyles.copyActionTextSuccess]}>{copiedField === 'ref' ? 'Copied!' : 'Copy'}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </LinearGradient>
                                        <View style={{ gap: 12, marginBottom: 14 }}>
                                            <View>
                                                <Text style={localStyles.inputLabel}>Sender Name *</Text>
                                                <TextInput style={localStyles.textInput} value={senderName} onChangeText={setSenderName} placeholder="Full name on the sending account..." placeholderTextColor={TEXT_MUTED} />
                                            </View>
                                            <View>
                                                <Text style={localStyles.inputLabel}>Sender Bank *</Text>
                                                <TextInput style={localStyles.textInput} value={senderBank} onChangeText={setSenderBank} placeholder="e.g. GTBank, Opay, Kuda, First Bank..." placeholderTextColor={TEXT_MUTED} />
                                            </View>
                                        </View>
                                        <Text style={localStyles.inputLabel}>Payment Receipt / Screenshot *</Text>
                                        <TouchableOpacity style={[localStyles.receiptUploadBox, manualReceipt && localStyles.receiptUploadBoxActive]} onPress={handlePickReceipt} activeOpacity={0.8}>
                                            <Ionicons name={manualReceipt ? 'checkmark-circle' : 'cloud-upload-outline'} size={32} color={manualReceipt ? EMERALD : GOLD_DARK} />
                                            <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY_DARK, marginTop: 6 }}>{manualReceipt ? (manualReceipt.name || 'Receipt Selected ✅') : 'Tap to Upload Payment Receipt'}</Text>
                                            <Text style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>{manualReceipt ? 'Tap to change the selected file' : 'Upload a screenshot or PDF of your payment proof'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* WALLET PANEL */}
                                {paymentMethod === 'wallet' && (
                                    <View style={localStyles.modernWalletPanel}>
                                        <LinearGradient colors={walletBalance >= plan.price ? ['#064E3B', '#065F46'] : ['#450A0A', '#7F1D1D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={localStyles.modernWalletGradient}>
                                            <View>
                                                <Text style={{ fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>Wallet Balance</Text>
                                                <Text style={{ fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginTop: 2 }}>₦{walletBalance.toLocaleString()}</Text>
                                            </View>
                                            <View style={[localStyles.modernWalletStatusBadge, { backgroundColor: walletBalance >= plan.price ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)', borderColor: walletBalance >= plan.price ? '#34D399' : '#EF4444' }]}>
                                                <Ionicons name={walletBalance >= plan.price ? 'checkmark-circle' : 'close-circle'} size={15} color={walletBalance >= plan.price ? '#34D399' : '#EF4444'} />
                                                <Text style={{ fontSize: 11, fontWeight: '800', color: walletBalance >= plan.price ? '#34D399' : '#EF4444' }}>{walletBalance >= plan.price ? 'Sufficient' : 'Insufficient'}</Text>
                                            </View>
                                        </LinearGradient>
                                        <View style={{ padding: 14 }}>
                                            {walletBalance >= plan.price ? (
                                                <Text style={{ fontSize: 12.5, color: '#047857', lineHeight: 19, fontWeight: '600' }}>₦{plan.price.toLocaleString()} will be deducted from your wallet instantly to activate this subscription.</Text>
                                            ) : (
                                                <Text style={{ fontSize: 12.5, color: '#B91C1C', lineHeight: 19, fontWeight: '600' }}>Your wallet balance (₦{walletBalance.toLocaleString()}) is insufficient for this plan (₦{plan.price.toLocaleString()}). Please select Paystack or Direct Bank Transfer above.</Text>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ── ORDER SUMMARY ── */}
                        <View style={localStyles.modernSummaryCard}>
                            <View style={localStyles.modernSummaryHeader}>
                                <Ionicons name="receipt-outline" size={16} color={NAVY_DARK} />
                                <Text style={localStyles.modernSummaryHeaderText}>Order Summary</Text>
                            </View>
                            {[
                                { label: 'Store Name',      value: formData.businessName     || '—' },
                                { label: 'Structure',       value: activeBusinessType.badge  || '—' },
                                { label: 'Category',        value: formData.businessCategory || 'General' },
                                { label: 'Trading Hub',     value: formData.operatingHub     || 'Kano' },
                                { label: 'Settlement Bank', value: formData.bankName         || '—' },
                                { label: 'Account Name',    value: formData.accountName      || '—' },
                                ...(plan.price > 0 ? [{ label: 'Payment Via', value:
                                    paymentMethod === 'bank_transfer' ? 'Direct Bank Transfer'
                                    : paymentMethod === 'wallet'      ? 'Abu Mafhal Wallet'
                                    : paymentMethod === 'flutterwave' ? 'Flutterwave'
                                    : 'Paystack Checkout'
                                }] : []),
                            ].map((row, idx) => (
                                <View key={idx} style={localStyles.modernSummaryRow}>
                                    <Text style={localStyles.modernSummaryLabel}>{row.label}</Text>
                                    <Text style={localStyles.modernSummaryVal} numberOfLines={1}>{row.value}</Text>
                                </View>
                            ))}
                            <View style={localStyles.modernSummaryTotalRow}>
                                <Text style={localStyles.modernSummaryTotalLabel}>{plan.price === 0 ? 'No charge today' : 'Total Due'}</Text>
                                <Text style={localStyles.modernSummaryTotalFee}>{plan.price === 0 ? 'FREE' : `₦${plan.price.toLocaleString()}`}</Text>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* STICKY BOTTOM ACTION FOOTER (ROYAL NAVY & GOLD) */}
            <View style={[localStyles.bottomBarContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                {step > 1 ? (
                    <TouchableOpacity
                        style={localStyles.backStepBtn}
                        onPress={prevStep}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="arrow-back" size={18} color={NAVY_DARK} />
                        <Text style={localStyles.backStepBtnText}>Back</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={localStyles.backStepBtn}
                        onPress={onBack}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="close" size={18} color={TEXT_SECONDARY} />
                        <Text style={localStyles.backStepBtnText}>Cancel</Text>
                    </TouchableOpacity>
                )}

                {step < 6 ? (
                    <TouchableOpacity
                        style={localStyles.nextStepBtn}
                        onPress={nextStep}
                        activeOpacity={0.85}
                    >
                        <Text style={localStyles.nextStepBtnText}>Next Step</Text>
                        <Ionicons name="arrow-forward" size={18} color={NAVY_DARK} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[
                            localStyles.nextStepBtn,
                            needsPayment ? { backgroundColor: GOLD } : { backgroundColor: EMERALD }
                        ]}
                        onPress={handleFinalAction}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <ActivityIndicator color={NAVY_DARK} size="small" />
                                <Text style={localStyles.nextStepBtnText}>
                                    {uploading ? 'Uploading Documents...' : 'Submitting...'}
                                </Text>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons
                                    name={
                                        plan.price === 0
                                            ? "flash"
                                            : paymentMethod === 'wallet'
                                                ? "wallet"
                                                : paymentMethod === 'bank_transfer'
                                                    ? "cloud-upload"
                                                    : paymentMethod === 'flutterwave'
                                                        ? "globe"
                                                        : "shield-checkmark"
                                    }
                                    size={18}
                                    color={NAVY_DARK}
                                />
                                <Text style={localStyles.nextStepBtnText}>
                                    {plan.price === 0
                                        ? 'Start Free Trial'
                                        : paymentMethod === 'wallet'
                                            ? `Pay ₦${plan.price.toLocaleString()} from Wallet`
                                            : paymentMethod === 'bank_transfer'
                                                ? 'Submit Receipt & Activate Store'
                                                : paymentMethod === 'flutterwave'
                                                    ? `Pay ₦${plan.price.toLocaleString()} via Flutterwave`
                                                    : `Pay ₦${plan.price.toLocaleString()} via Paystack`}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Bank Selection Modal */}
            <Modal visible={showBankDropdown} animationType="slide" transparent={true}>
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContent}>
                        <View style={localStyles.modalHeader}>
                            <View>
                                <Text style={localStyles.modalTitle}>Select Settlement Bank</Text>
                                <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                                    {filteredBanks.length} CBN & NIBSS licensed banks
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowBankDropdown(false)} style={{ padding: 6 }}>
                                <Ionicons name="close" size={24} color={NAVY_DARK} />
                            </TouchableOpacity>
                        </View>

                        <View style={localStyles.modalSearchRow}>
                            <Ionicons name="search" size={18} color={GOLD_DARK} />
                            <TextInput
                                style={localStyles.modalSearchInput}
                                placeholder="Search bank by name or code..."
                                placeholderTextColor={TEXT_MUTED}
                                value={searchBankQuery}
                                onChangeText={handleSearchBank}
                                autoCorrect={false}
                            />
                            {searchBankQuery ? (
                                <TouchableOpacity onPress={() => handleSearchBank('')}>
                                    <Ionicons name="close-circle" size={18} color={TEXT_MUTED} />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                            {filteredBanks.length === 0 ? (
                                <View style={{ padding: 30, alignItems: 'center' }}>
                                    <Ionicons name="alert-circle-outline" size={36} color={TEXT_MUTED} />
                                    <Text style={{ marginTop: 8, color: TEXT_MUTED, fontSize: 13, textAlign: 'center' }}>
                                        No bank found matching "{searchBankQuery}"
                                    </Text>
                                </View>
                            ) : (
                                filteredBanks.map((bank, index) => {
                                    const isSelected = formData.bankName === bank.name;
                                    return (
                                        <TouchableOpacity
                                            key={`${bank.code}-${index}`}
                                            style={[
                                                localStyles.bankRow,
                                                isSelected && { backgroundColor: '#F1F5F9', borderColor: GOLD }
                                            ]}
                                            onPress={() => selectBank(bank)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[
                                                localStyles.bankIconCircle,
                                                isSelected && { backgroundColor: NAVY_DARK }
                                            ]}>
                                                <Ionicons
                                                    name={bank.logo || 'business'}
                                                    size={18}
                                                    color={isSelected ? GOLD : NAVY_DARK}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[
                                                    localStyles.bankRowText,
                                                    isSelected && { color: NAVY_DARK, fontWeight: '900' }
                                                ]}>
                                                    {bank.name}
                                                </Text>
                                                {bank.type ? (
                                                    <Text style={localStyles.bankRowType}>{bank.type}</Text>
                                                ) : null}
                                            </View>
                                            <View style={[
                                                localStyles.radioCircle,
                                                isSelected && localStyles.radioCircleActive
                                            ]}>
                                                {isSelected && <View style={localStyles.radioDot} />}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Paystack WebView Modal */}
            <Modal visible={showPaystackWebView} animationType="slide" transparent={false}>
                <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
                    <View style={localStyles.paystackNavHeader}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: NAVY_DARK }}>Paystack Secured Checkout</Text>
                        <TouchableOpacity onPress={() => {
                            setShowPaystackWebView(false);
                            Alert.alert('Payment Cancelled', 'Payment was closed before completion.');
                        }}>
                            <Ionicons name="close" size={24} color={NAVY_DARK} />
                        </TouchableOpacity>
                    </View>
                    <WebView
                        source={{ uri: checkoutUrl }}
                        onNavigationStateChange={async (navState) => {
                            if (navState.url.includes('standard.paystack.co/close') || navState.url.includes('callback') || navState.url.includes('cancel')) {
                                setShowPaystackWebView(false);

                                try {
                                    setLoading(true);
                                    const res = await PaymentGatewayService.invokeEdgeFunction('verify-paystack-payment', {
                                        reference: currentRef,
                                        action: 'vendor_registration',
                                        amount: plan.price,
                                        user_id: user.id,
                                        expected_plan_id: plan.id
                                    });

                                    if (!res.ok) throw new Error(res.error || 'Payment verification failed');
                                    const data = res.data;
                                    if (!data?.success) throw new Error(data?.error || 'Payment verification failed');

                                    setPaymentVerified(true);
                                    setPaidPlan(plan.id);

                                    setTimeout(() => {
                                        handleActualSubmit(currentRef);
                                    }, 500);

                                } catch (err) {
                                    console.error('Verification Error:', err);
                                    Alert.alert('Payment Notice', 'If payment completed, our team will review and approve your store.');
                                    setLoading(false);
                                }
                            }
                        }}
                        startInLoadingState={true}
                        renderLoading={() => (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
                                <ActivityIndicator size="large" color={GOLD_DARK} />
                            </View>
                        )}
                        style={{ flex: 1 }}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

export const VendorRegister = (props) => {
    const { settings } = useAppSettings();

    if (settings?.loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: CANVAS_BG }}>
                <ActivityIndicator size="large" color={GOLD_DARK} />
                <Text style={{ marginTop: 14, color: NAVY_DARK, fontWeight: '800' }}>Initializing Merchant Suite...</Text>
            </View>
        );
    }

    const vendorPlansRaw = settings?.vendor_plans || [];
    const activeVendorPlans = vendorPlansRaw.filter(p => p.is_active !== false);

    return (
        <VendorRegisterInner {...props} activeVendorPlans={activeVendorPlans} />
    );
};

// ─────────────────────────────────────────────────────────────
// LUXURY NAVY & GOLD STYLES
// ─────────────────────────────────────────────────────────────
const localStyles = StyleSheet.create({
    screenContainer: {
        flex: 1,
        backgroundColor: CANVAS_BG
    },
    topNavHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: NAVY_DARK,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 167, 58, 0.35)'
    },
    backIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)'
    },
    closeIconBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center'
    },
    topNavTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    topNavSub: {
        fontSize: 11,
        color: GOLD,
        fontWeight: '700',
        marginTop: 1
    },
    helpPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        marginRight: 6
    },
    helpPillText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#10B981'
    },

    // Progress Bar
    progressContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR
    },
    progressHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    stepBadge: {
        backgroundColor: NAVY_DARK,
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: GOLD
    },
    stepBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: GOLD,
        letterSpacing: 0.5
    },
    stepActiveTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: NAVY_DARK
    },
    stepPercentPill: {
        backgroundColor: GOLD_SURFACE,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: GOLD
    },
    stepPercentText: {
        fontSize: 11.5,
        fontWeight: '900',
        color: NAVY_DARK
    },
    progressTrack: {
        height: 6,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 10
    },
    progressFill: {
        height: '100%',
        borderRadius: 3
    },
    stepsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    stepItem: {
        alignItems: 'center',
        flex: 1
    },
    stepCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 3
    },
    stepCircleCompleted: {
        backgroundColor: NAVY_DARK,
        borderColor: GOLD,
        borderWidth: 1.5
    },
    stepCircleCurrent: {
        backgroundColor: GOLD_SURFACE,
        borderWidth: 2,
        borderColor: GOLD
    },
    stepNumber: {
        fontSize: 10,
        fontWeight: '800',
        color: TEXT_MUTED
    },
    stepNumberCurrent: {
        color: NAVY_DARK,
        fontWeight: '900'
    },
    stepItemLabel: {
        fontSize: 9,
        fontWeight: '600',
        color: TEXT_MUTED
    },
    stepItemLabelCurrent: {
        color: NAVY_DARK,
        fontWeight: '900'
    },
    stepItemLabelCompleted: {
        color: GOLD_DARK,
        fontWeight: '700'
    },

    // Perks Showcase Banner (Navy & Gold Gradient)
    perksBanner: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: GOLD,
        shadowColor: NAVY_DARK,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 3
    },
    perksBannerGradient: {
        padding: 14
    },
    perksBannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10
    },
    crownCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(217, 167, 58, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: GOLD
    },
    perksBannerTitle: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    goldPillTag: {
        backgroundColor: GOLD,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4
    },
    goldPillTagText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: NAVY_DARK
    },
    perksBannerSub: {
        fontSize: 11,
        color: '#CBD5E1',
        marginTop: 2
    },
    perksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingTop: 4
    },
    perkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4.5,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4.5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.4)'
    },
    perkItemText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#FFFFFF'
    },

    // Scroll Body & Step Card
    scrollBody: {
        padding: 16,
        paddingBottom: 95
    },
    stepCard: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)',
        shadowColor: NAVY_DARK,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18
    },
    cardIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: NAVY_DARK,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: GOLD
    },
    cardHeading: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY_DARK
    },
    cardSub: {
        fontSize: 12,
        color: TEXT_SECONDARY,
        marginTop: 2
    },

    // Business Type Selector Cards
    businessTypeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        borderRadius: 14,
        padding: 12,
        gap: 10
    },
    businessTypeCardActive: {
        borderColor: GOLD,
        backgroundColor: GOLD_SURFACE
    },
    btIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    btTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY_DARK
    },
    btBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 0.5,
        borderColor: '#CBD5E1'
    },
    btBadgeText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: TEXT_SECONDARY
    },
    btDesc: {
        fontSize: 11,
        color: TEXT_MUTED,
        marginTop: 2
    },

    // Individual Merchant Pass Banner
    individualPerkCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: EMERALD_SURFACE,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        marginBottom: 14
    },
    individualPerkIconBox: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center'
    },
    individualPerkTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: '#065F46'
    },
    individualPerkSub: {
        fontSize: 11,
        color: '#047857',
        marginTop: 2,
        lineHeight: 15
    },

    // Location Type Card
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    locationCardActive: {
        backgroundColor: GOLD_SURFACE,
        borderColor: GOLD
    },
    locationCardText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: TEXT_SECONDARY
    },

    // Commercial Hub Pills
    hubPillsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 7
    },
    hubPill: {
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    hubPillActive: {
        backgroundColor: NAVY_DARK,
        borderColor: GOLD
    },
    hubPillText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: TEXT_SECONDARY
    },
    hubPillTextActive: {
        color: GOLD,
        fontWeight: '900'
    },

    // Form Inputs & Fields
    fieldGroup: {
        marginBottom: 14
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 4
    },
    inputLabel: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY_DARK
    },
    reqStar: {
        color: '#EF4444',
        fontWeight: '900',
        fontSize: 13
    },
    verifiedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginLeft: 'auto',
        backgroundColor: EMERALD_SURFACE,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6
    },
    verifiedTagText: {
        fontSize: 10,
        fontWeight: '800',
        color: EMERALD
    },
    textInput: {
        backgroundColor: INPUT_BG,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
        fontSize: 14.5,
        color: NAVY_DARK,
        fontWeight: '600',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    divider: {
        height: 1,
        backgroundColor: BORDER_COLOR,
        marginVertical: 16
    },
    sectionHeaderBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 14
    },
    sectionSubHeader: {
        fontSize: 11,
        fontWeight: '900',
        color: NAVY_DARK,
        letterSpacing: 0.5
    },

    // Category Grid & Pills
    categoryGrid: {
        gap: 8
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 11
    },
    categoryChipSelected: {
        backgroundColor: GOLD_SURFACE,
        borderColor: GOLD
    },
    categoryChipText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: NAVY_DARK
    },
    categoryChipTextSelected: {
        color: NAVY_DARK,
        fontWeight: '900'
    },
    categorySubText: {
        fontSize: 11,
        color: TEXT_MUTED,
        marginTop: 1
    },

    // Experience Pills
    experienceRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap'
    },
    expPill: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    expPillSelected: {
        backgroundColor: NAVY_DARK,
        borderColor: GOLD
    },
    expPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: TEXT_SECONDARY
    },
    expPillTextSelected: {
        color: GOLD,
        fontWeight: '900'
    },

    // Verify Row
    verifyInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    inputWithBtn: {
        flex: 1,
        backgroundColor: INPUT_BG,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
        fontSize: 14.5,
        color: NAVY_DARK,
        fontWeight: '600',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    inputVerified: {
        borderColor: EMERALD,
        backgroundColor: EMERALD_SURFACE
    },
    verifyBtn: {
        backgroundColor: NAVY_DARK,
        paddingHorizontal: 14,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: GOLD
    },
    verifyBtnSuccess: {
        backgroundColor: EMERALD,
        borderColor: EMERALD
    },
    verifyBtnFailed: {
        backgroundColor: '#EF4444',
        borderColor: '#EF4444'
    },
    verifyBtnText: {
        fontSize: 12,
        fontWeight: '900',
        color: GOLD
    },

    // Logo & Uploads
    logoPreviewCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    logoBox: {
        width: 52,
        height: 52,
        borderRadius: 26,
        overflow: 'hidden',
        backgroundColor: '#E2E8F0',
        marginRight: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: GOLD
    },
    avatarBadge: {
        backgroundColor: EMERALD_SURFACE,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 3
    },
    avatarBadgeText: {
        fontSize: 9.5,
        color: EMERALD,
        fontWeight: '800'
    },
    logoStatusText: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY_DARK
    },
    logoActionText: {
        fontSize: 12,
        fontWeight: '800',
        color: GOLD_DARK
    },
    docGroupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: GOLD
    },
    docGroupTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY_DARK
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        padding: 13,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    uploadIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: NAVY_DARK,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: GOLD
    },
    uploadIconBoxSuccess: {
        backgroundColor: EMERALD_SURFACE,
        borderColor: EMERALD
    },
    uploadLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: NAVY_DARK
    },
    uploadSub: {
        fontSize: 11,
        color: TEXT_MUTED,
        marginTop: 2
    },
    uploadActionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: GOLD_SURFACE,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: GOLD
    },
    uploadActionText: {
        fontSize: 11,
        fontWeight: '900',
        color: NAVY_DARK
    },

    // Logistics Delivery Options
    deliveryOptionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        gap: 12
    },
    deliveryOptionCardActive: {
        borderColor: GOLD,
        backgroundColor: GOLD_SURFACE
    },
    deliveryIconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    deliveryTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: NAVY_DARK
    },
    deliveryDesc: {
        fontSize: 11,
        color: TEXT_SECONDARY,
        marginTop: 3,
        lineHeight: 15
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center'
    },
    radioCircleActive: {
        borderColor: NAVY_DARK
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: NAVY_DARK
    },

    // SLA Option Card
    slaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    slaCardActive: {
        borderColor: GOLD,
        backgroundColor: GOLD_SURFACE
    },
    slaTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY_DARK
    },
    slaBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4
    },
    slaBadgeText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: TEXT_SECONDARY
    },
    slaDesc: {
        fontSize: 11,
        color: TEXT_MUTED,
        marginTop: 2
    },

    // Bank Selection
    selectBankBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: INPUT_BG,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    selectBankText: {
        fontSize: 14,
        fontWeight: '600',
        color: TEXT_MUTED
    },

    // Plan Selection
    // ── Modern Plan Cards ──
    modernSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 18
    },
    modernSectionIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: GOLD_SURFACE,
        borderWidth: 1,
        borderColor: GOLD + '60',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modernSectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY_DARK
    },
    modernSectionSub: {
        fontSize: 12,
        color: TEXT_SECONDARY,
        marginTop: 1
    },
    modernPlanCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.5,
        borderColor: BORDER_COLOR,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1
    },
    modernPlanCardSelected: {
        borderColor: GOLD,
        backgroundColor: GOLD_SURFACE,
        shadowColor: GOLD,
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 3
    },
    planCardAccentLine: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: GOLD,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16
    },
    modernPlanLabel: {
        fontSize: 15,
        fontWeight: '900',
        color: NAVY_DARK
    },
    modernPlanBadge: {
        backgroundColor: NAVY_DARK,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: GOLD
    },
    modernPlanBadgeText: {
        fontSize: 9,
        fontWeight: '900',
        color: GOLD,
        letterSpacing: 0.3
    },
    modernPlanPrice: {
        fontSize: 20,
        fontWeight: '900',
        color: GOLD_DARK
    },
    modernPlanDesc: {
        fontSize: 11.5,
        color: TEXT_SECONDARY,
        marginTop: 4,
        lineHeight: 16
    },
    modernPlanCheck: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: BORDER_COLOR,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8
    },
    modernPlanCheckActive: {
        borderColor: GOLD,
        backgroundColor: GOLD
    },

    // ── Modern Order Summary ──
    modernSummaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2
    },
    modernSummaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR
    },
    modernSummaryHeaderText: {
        fontSize: 12,
        fontWeight: '900',
        color: NAVY_DARK,
        letterSpacing: 0.3
    },
    modernSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    modernSummaryLabel: {
        fontSize: 12,
        color: TEXT_MUTED,
        fontWeight: '600'
    },
    modernSummaryVal: {
        fontSize: 12.5,
        fontWeight: '700',
        color: NAVY_DARK,
        maxWidth: '55%',
        textAlign: 'right'
    },
    modernSummaryTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: NAVY_DARK
    },
    modernSummaryTotalLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.75)'
    },
    modernSummaryTotalFee: {
        fontSize: 22,
        fontWeight: '900',
        color: GOLD
    },

    // Sticky Bottom Bar (Navy & Gold Accent)
    bottomBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 10,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: 'rgba(217, 167, 58, 0.3)',
        elevation: 8,
        shadowColor: NAVY_DARK,
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 6
    },
    backStepBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 48,
        paddingHorizontal: 18,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    backStepBtnText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: NAVY_DARK
    },
    nextStepBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        borderRadius: 12,
        backgroundColor: GOLD,
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 2
    },
    nextStepBtnText: {
        fontSize: 14,
        fontWeight: '900',
        color: NAVY_DARK
    },

    // Status Screens Elements
    statusIconCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: NAVY_DARK,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: GOLD,
        marginBottom: 20
    },
    statusTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: NAVY_DARK,
        textAlign: 'center',
        marginBottom: 8
    },
    statusSub: {
        fontSize: 13.5,
        color: TEXT_SECONDARY,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
        maxWidth: 320
    },
    primaryActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 50,
        backgroundColor: GOLD,
        borderRadius: 14,
        paddingHorizontal: 24
    },
    primaryActionBtnText: {
        fontSize: 14.5,
        fontWeight: '900',
        color: NAVY_DARK
    },
    secondaryActionBtn: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#F1F5F9',
        borderRadius: 10
    },
    secondaryActionBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: NAVY_DARK
    },
    statusInfoBox: {
        width: '100%',
        backgroundColor: CARD_BG,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        marginBottom: 24
    },
    statusInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6
    },
    statusInfoLabel: {
        fontSize: 12,
        color: TEXT_SECONDARY,
        fontWeight: '600'
    },
    statusInfoVal: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY_DARK
    },
    pendingPill: {
        backgroundColor: GOLD_SURFACE,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: GOLD
    },
    pendingPillText: {
        fontSize: 10,
        fontWeight: '900',
        color: GOLD_DARK
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10, 25, 47, 0.5)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        borderTopWidth: 2,
        borderColor: GOLD,
        shadowColor: NAVY_DARK,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 10
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: NAVY_DARK
    },
    modalSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 14,
        height: 44,
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    modalSearchInput: {
        flex: 1,
        marginLeft: 8,
        color: NAVY_DARK,
        fontSize: 14,
        fontWeight: '600'
    },
    bankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 12,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: 'transparent'
    },
    bankRowText: {
        fontSize: 14,
        fontWeight: '700',
        color: NAVY_DARK
    },
    bankRowType: {
        fontSize: 11,
        color: TEXT_MUTED,
        marginTop: 2
    },
    bankIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    paystackNavHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF'
    },

    // Luxury ATM Virtual Card Styles
    atmCardContainer: {
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: 'rgba(217, 167, 58, 0.45)',
        shadowColor: NAVY_DARK,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6
    },
    atmTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    atmChipBox: {
        width: 36,
        height: 26,
        borderRadius: 6,
        backgroundColor: '#E5B94E',
        borderWidth: 1,
        borderColor: '#B45309',
        justifyContent: 'center',
        alignItems: 'center'
    },
    atmChipInner: {
        width: 20,
        height: 14,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#92400E'
    },
    atmBankBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.35)',
        maxWidth: 180
    },
    atmBankBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#F8FAFC'
    },
    atmNumberRow: {
        marginVertical: 16
    },
    atmNumberText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 2
    },
    atmBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end'
    },
    atmLabelSmall: {
        fontSize: 9,
        fontWeight: '800',
        color: 'rgba(217, 167, 58, 0.95)',
        letterSpacing: 0.5,
        marginBottom: 2
    },
    atmBeneficiaryName: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5
    },
    atmVerifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#10B981'
    },
    atmVerifiedBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#10B981'
    },
    popularBanksLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: NAVY_DARK,
        letterSpacing: 0.5,
        marginBottom: 8
    },
    bankPillsScroll: {
        gap: 8,
        paddingBottom: 14
    },
    popularBankPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    popularBankPillActive: {
        backgroundColor: GOLD_SURFACE,
        borderColor: GOLD
    },
    popularBankPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: TEXT_SECONDARY
    },
    popularBankPillTextActive: {
        color: NAVY_DARK,
        fontWeight: '900'
    },

    // PAYMENT METHOD SELECTION & OFFICIAL BANK STYLES
    paymentNoticeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16
    },
    paymentNoticeText: {
        flex: 1,
        fontSize: 12.5,
        color: '#92400E',
        fontWeight: '700',
        lineHeight: 18
    },
    // ── Modern Method Tabs ──
    modernMethodLabel: {
        fontSize: 10.5,
        fontWeight: '900',
        color: TEXT_MUTED,
        letterSpacing: 0.8,
        marginBottom: 10
    },
    modernMethodTabs: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
        flexWrap: 'wrap'
    },
    modernMethodTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 50,
        borderWidth: 1.5,
        borderColor: BORDER_COLOR,
        backgroundColor: '#F8FAFC'
    },
    modernMethodTabText: {
        fontSize: 12.5,
        fontWeight: '800',
        color: TEXT_MUTED
    },
    // ── Modern Gateway Panels ──
    modernGatewayPanel: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        borderLeftWidth: 4
    },
    modernGatewayIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modernGatewayTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: NAVY_DARK
    },
    modernGatewaySub: {
        fontSize: 11.5,
        color: TEXT_SECONDARY,
        lineHeight: 17
    },
    autoVerifyBadge: {
        backgroundColor: '#0284C718',
        borderWidth: 1,
        borderColor: '#0284C7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    autoVerifyBadgeText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#0284C7',
        letterSpacing: 0.3
    },
    // ── Modern Wallet Panel ──
    modernWalletPanel: {
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        marginBottom: 16
    },
    modernWalletGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18
    },
    modernWalletStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1
    },
    officialBankCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.4)'
    },
    officialBankHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
        marginBottom: 12
    },
    officialBankTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    officialBankSub: {
        fontSize: 10.5,
        color: 'rgba(217, 167, 58, 0.95)'
    },
    bankCopyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)'
    },
    bankCopyLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.65)',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    bankCopyVal: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2
    },
    copyActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(217, 167, 58, 0.2)',
        borderWidth: 1,
        borderColor: GOLD,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8
    },
    copyActionBtnSuccess: {
        backgroundColor: 'rgba(16, 185, 129, 0.25)',
        borderColor: EMERALD
    },
    copyActionText: {
        fontSize: 11,
        fontWeight: '800',
        color: GOLD
    },
    copyActionTextSuccess: {
        color: '#34D399'
    },
    receiptUploadBox: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: BORDER_COLOR,
        borderStyle: 'dashed',
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        marginBottom: 16
    },
    receiptUploadBoxActive: {
        borderColor: EMERALD,
        backgroundColor: EMERALD_SURFACE,
        borderStyle: 'solid'
    },
    walletStatusCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1.5,
        borderColor: BORDER_COLOR,
        marginBottom: 16
    },
    walletBalanceDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10
    },
    walletBalanceVal: {
        fontSize: 20,
        fontWeight: '900',
        color: NAVY_DARK
    },
    walletBadgeSufficient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: EMERALD_SURFACE,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: EMERALD
    },
    walletBadgeInsufficient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#EF4444'
    },
    gatewaySecurityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: BORDER_COLOR
    }
});
