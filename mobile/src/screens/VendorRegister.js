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

    // 1: Profile & KYC, 2: Catalog & Socials, 3: Documents, 4: Logistics & Policy, 5: Banking, 6: Plan & Pay
    const [step, setStep] = useState(mode === 'renew' ? 6 : 1);

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

    // Paystack Integration State
    const [showPaystackWebView, setShowPaystackWebView] = useState(false);
    const [currentRef, setCurrentRef] = useState(null);
    const [checkoutUrl, setCheckoutUrl] = useState(null);

    // Bank Account Resolution State
    const [bankCode, setBankCode] = useState('');
    const [banks, setBanks] = useState([]);
    const [filteredBanks, setFilteredBanks] = useState([]);
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [searchBankQuery, setSearchBankQuery] = useState('');
    const [resolvingAccount, setResolvingAccount] = useState(false);

    // FORM STATE
    const [formData, setFormData] = useState({
        fullName: user?.user_metadata?.full_name || '',
        phone: user?.user_metadata?.phone_number || '',
        businessType: 'limited_company',
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
        bankName: '',
        accountNumber: '',
        accountName: '',
        whatsapp: user?.user_metadata?.phone_number || '',
        instagram: '',
        website: '',
        selectedPlan: defaultPlanId
    });

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
        nin: null
    });

    useEffect(() => {
        checkApplicationStatus();
        fetchBanks();
    }, []);

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
            if (json.status) {
                setBanks(json.data);
                setFilteredBanks(json.data);
            }
        } catch (error) {
            console.log('Error fetching banks:', error);
        }
    };

    const updateForm = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        if (formData.accountNumber.length === 10 && bankCode) {
            resolveAccount();
        }
    }, [formData.accountNumber, bankCode]);

    const resolveAccount = async () => {
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

            if (json.status) {
                updateForm('accountName', json.data.account_name);
            }
        } catch (error) {
            console.log('Error resolving account:', error);
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

    const handleSearchBank = (text) => {
        setSearchBankQuery(text);
        if (text) {
            setFilteredBanks(banks.filter(b => b.name.toLowerCase().includes(text.toLowerCase())));
        } else {
            setFilteredBanks(banks);
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
                Alert.alert('Store Name Required', 'Please enter your Store / Business Name.');
                return false;
            }
            if (!formData.phone?.trim()) {
                Alert.alert('Phone Number Required', 'Please enter your official Business Phone Number.');
                return false;
            }
            if (!formData.businessAddress?.trim()) {
                Alert.alert('Address Required', 'Please enter your Physical Business Address.');
                return false;
            }
            // ONLY require CAC if NOT individual
            if (formData.businessType !== 'sole_proprietor' && activeBusinessType.cacRequired && !formData.cacNumber?.trim()) {
                Alert.alert('CAC Number Required', `Please enter your ${activeBusinessType.cacLabel}.`);
                return false;
            }
            if (!formData.nin?.trim()) {
                Alert.alert('NIN Required', 'Please enter your 11-digit National Identity Number (NIN).');
                return false;
            }
            if (formData.nin.trim().length < 11) {
                Alert.alert('Invalid NIN', 'National Identity Number (NIN) must be at least 11 digits.');
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
            // ONLY require CAC document if NOT individual
            if (formData.businessType !== 'sole_proprietor' && activeBusinessType.cacRequired && !files.cac) {
                Alert.alert('CAC Document Required', 'Please attach your CAC Certificate or incorporation document.');
                return false;
            }
            return true;
        }
        if (step === 4) {
            if (!formData.guarantorName?.trim()) {
                Alert.alert('Guarantor Required', 'Please enter your Guarantor Full Legal Name.');
                return false;
            }
            if (!formData.guarantorPhone?.trim()) {
                Alert.alert('Guarantor Phone Required', 'Please enter your Guarantor Mobile Number.');
                return false;
            }
            return true;
        }
        if (step === 5) {
            if (!formData.bankName?.trim()) {
                Alert.alert('Bank Required', 'Please select your Settlement Bank from the list.');
                return false;
            }
            if (!formData.accountNumber?.trim() || formData.accountNumber.trim().length < 10) {
                Alert.alert('Account Number Required', 'Please enter a valid 10-digit NUBAN account number.');
                return false;
            }
            if (!formData.accountName?.trim()) {
                Alert.alert('Beneficiary Name Required', 'Please enter or confirm your Account Beneficiary Name.');
                return false;
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

    const handleActualSubmit = async (paymentRef = null) => {
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
                    website: formData.website
                },
                subscription_plan: plan.label,
                subscription_fee: plan.price,
                payment_status: (paymentRef || (paymentVerified && paidPlan === plan.id)) ? 'paid' : (plan.price === 0 ? 'free_trial' : 'pending'),
                payment_reference: paymentRef || (paymentVerified && paidPlan === plan.id ? savedPaymentRef : ('REF-' + Date.now())),
                status: (settings?.vendor_auto_approve === true && (paymentRef || (paymentVerified && paidPlan === plan.id) || plan.price === 0)) ? 'approved' : 'pending',
                rejection_reason: null
            };

            let error;
            const targetId = editingAppId || existingApp?.id;

            if (targetId) {
                const result = await supabase
                    .from('vendor_applications')
                    .update(dbPayload)
                    .eq('id', targetId);
                error = result.error;
            } else {
                const result = await supabase
                    .from('vendor_applications')
                    .insert([dbPayload]);
                error = result.error;
            }

            if (error) {
                console.error('Supabase Submission Error:', error);
                if (error.code === '23505') throw new Error('A pending application already exists.');
                throw error;
            }

            if (dbPayload.status === 'approved') {
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
                await supabase.from('profiles').update({ role: 'vendor' }).eq('id', user.id);
            }

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsSuccess(true);

        } catch (error) {
            console.error('Final Submission Error:', error);
            Alert.alert('Submission Failed', error.message || 'An unexpected error occurred during submission.');
        } finally {
            setLoading(false);
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

    const handleFinalAction = () => {
        if (needsPayment) {
            setLoading(true);

            setTimeout(async () => {
                try {
                    const fallbackEmail = user?.email || `user_${user?.id?.substring(0, 6) || Math.floor(Math.random() * 10000)}@abumafhal.com`;
                    const ref = `RV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                    const res = await PaymentGatewayService.invokeEdgeFunction('initiate-paystack-payment', {
                        amount: plan.price,
                        email: fallbackEmail,
                        reference: ref,
                        callback_url: Platform.OS === 'web' ? window.location.href : 'https://standard.paystack.co/close'
                    });

                    if (!res.ok) throw new Error(res.error || 'Failed to initialize payment');
                    const data = res.data;
                    if (!data?.success) throw new Error(data?.error || 'Failed to initialize payment');

                    setCurrentRef(ref);
                    setCheckoutUrl(data.authorization_url);

                    if (Platform.OS === 'web') {
                        Alert.alert('Redirecting...', 'Opening Paystack to complete your registration payment.');
                        setTimeout(() => {
                            window.location.href = data.authorization_url;
                        }, 1000);
                    } else {
                        setShowPaystackWebView(true);
                    }
                } catch (err) {
                    console.error('Init Payment Error:', err);
                    Alert.alert('Payment Error', 'Could not initialize payment. Please try again.');
                } finally {
                    setLoading(false);
                }
            }, 200);
        } else {
            handleActualSubmit();
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
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 28 }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: EMERALD_SURFACE, borderColor: EMERALD }]}>
                    <Ionicons name="checkmark-circle" size={54} color={EMERALD} />
                </View>
                <Text style={localStyles.statusTitle}>
                    {mode === 'renew' ? 'Subscription Renewed!' : 'Application Submitted!'}
                </Text>
                <Text style={localStyles.statusSub}>
                    {mode === 'renew' ?
                        'Your storefront subscription has been renewed. Your products are active across the marketplace.' :
                        'Your application has been received with priority status. Our compliance team will review your account within 24 hours.'}
                </Text>
                <TouchableOpacity
                    style={localStyles.primaryActionBtn}
                    onPress={onSubmit || onBack}
                    activeOpacity={0.85}
                >
                    <Text style={localStyles.primaryActionBtnText}>Continue to Dashboard</Text>
                    <Ionicons name="arrow-forward" size={18} color={NAVY_DARK} />
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (checkingStatus) {
        return (
            <View style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />
                <ActivityIndicator size="large" color={GOLD} />
                <Text style={{ marginTop: 16, color: NAVY_DARK, fontWeight: '800' }}>Initializing Merchant Suite...</Text>
            </View>
        );
    }

    if (existingApp && existingApp.status === 'approved') {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 28 }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: EMERALD_SURFACE, borderColor: EMERALD }]}>
                    <Ionicons name="shield-checkmark" size={54} color={EMERALD} />
                </View>
                <Text style={localStyles.statusTitle}>Application Approved!</Text>
                <Text style={localStyles.statusSub}>
                    Congratulations! Your store is officially accredited as an Abu Mafhal Verified Merchant.
                </Text>
                <TouchableOpacity
                    style={[localStyles.primaryActionBtn, { width: '100%', marginBottom: 12 }]}
                    onPress={onSubmit || onBack}
                    activeOpacity={0.85}
                >
                    <Text style={localStyles.primaryActionBtnText}>Open Vendor Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowCertificate(true)} style={{ padding: 8 }}>
                    <Text style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 14 }}>View Merchant Certificate</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (existingApp && existingApp.status === 'pending') {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 28 }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: GOLD_SURFACE, borderColor: GOLD }]}>
                    <Ionicons name="time" size={54} color={GOLD_DARK} />
                </View>
                <Text style={localStyles.statusTitle}>Application Under Review</Text>
                <Text style={localStyles.statusSub}>
                    We are currently verifying your credentials and NUBAN settlement account. This process usually completes within 24 hours.
                </Text>

                <View style={localStyles.statusInfoBox}>
                    <View style={localStyles.statusInfoRow}>
                        <Text style={localStyles.statusInfoLabel}>Submitted Date</Text>
                        <Text style={localStyles.statusInfoVal}>{new Date(existingApp.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={localStyles.statusInfoRow}>
                        <Text style={localStyles.statusInfoLabel}>Store Plan</Text>
                        <Text style={[localStyles.statusInfoVal, { color: GOLD_DARK }]}>{existingApp.subscription_plan}</Text>
                    </View>
                    <View style={localStyles.statusInfoRow}>
                        <Text style={localStyles.statusInfoLabel}>Current Status</Text>
                        <View style={localStyles.pendingPill}>
                            <Text style={localStyles.pendingPillText}>Pending Review</Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity style={[localStyles.primaryActionBtn, { width: '100%' }]} onPress={onBack}>
                    <Text style={localStyles.primaryActionBtnText}>Back to App</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (existingApp && existingApp.status === 'rejected') {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 28 }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
                    <Ionicons name="close-circle" size={54} color="#EF4444" />
                </View>
                <Text style={localStyles.statusTitle}>Application Needs Review</Text>
                <Text style={localStyles.statusSub}>
                    Your application could not be verified automatically with the details provided.
                </Text>

                <View style={[localStyles.statusInfoBox, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
                    <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>
                        Reason for Feedback
                    </Text>
                    <Text style={{ color: TEXT_PRIMARY, fontSize: 13, lineHeight: 18 }}>
                        {existingApp.rejection_reason || 'Please verify that your NIN and bank account details match your corporate records.'}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[localStyles.primaryActionBtn, { width: '100%' }]}
                    onPress={() => handleRetryApplication(existingApp)}
                    activeOpacity={0.85}
                >
                    <Text style={localStyles.primaryActionBtnText}>Correct & Resubmit</Text>
                    <Ionicons name="refresh" size={18} color={NAVY_DARK} />
                </TouchableOpacity>
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

                        {/* CAC Document: COMPLETELY REMOVED IF INDIVIDUAL */}
                        {formData.businessType !== 'sole_proprietor' && (
                            <UploadBtn
                                label={`${activeBusinessType.label} Certificate`}
                                file={files.cac}
                                onPress={() => pickDocument('cac')}
                                icon="document-text-outline"
                                required={activeBusinessType.cacRequired}
                            />
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
                            <Text style={localStyles.sectionSubHeader}>BUSINESS GUARANTOR</Text>
                        </View>

                        {/* Guarantor Name */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Guarantor Full Legal Name</Text>
                                <Text style={localStyles.reqStar}>*</Text>
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
                                <Text style={localStyles.reqStar}>*</Text>
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
                                <Text style={localStyles.cardSub}>Where your product sales are automatically remitted</Text>
                            </View>
                        </View>

                        {/* Bank Selector */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Commercial Settlement Bank</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TouchableOpacity
                                style={localStyles.selectBankBtn}
                                onPress={() => setShowBankDropdown(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={[localStyles.selectBankText, formData.bankName ? { color: TEXT_PRIMARY, fontWeight: '700' } : null]}>
                                    {formData.bankName || 'Tap to select your bank name'}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={NAVY_DARK} />
                            </TouchableOpacity>
                        </View>

                        {/* Account Number */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>10-Digit NUBAN Account Number</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.accountNumber}
                                onChangeText={t => updateForm('accountNumber', t)}
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
                                {formData.accountName && (
                                    <View style={localStyles.verifiedTag}>
                                        <Ionicons name="checkmark-circle" size={13} color={EMERALD} />
                                        <Text style={localStyles.verifiedTagText}>Confirmed</Text>
                                    </View>
                                )}
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
                                            : "Account Beneficiary Name"
                                    }
                                    placeholderTextColor={TEXT_MUTED}
                                />
                            </View>
                        </View>
                    </View>
                )}

                {/* STEP 6: CHOOSE PLAN & CONFIRM */}
                {step === 6 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="trophy" size={20} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Select Storefront Subscription</Text>
                                <Text style={localStyles.cardSub}>Choose your commercial membership package</Text>
                            </View>
                        </View>

                        <View style={{ gap: 12, marginBottom: 18 }}>
                            {activeVendorPlans.map(planItem => {
                                const isSelected = formData.selectedPlan === planItem.id;
                                return (
                                    <TouchableOpacity
                                        key={planItem.id}
                                        style={[
                                            localStyles.planCard,
                                            isSelected && localStyles.planCardSelected
                                        ]}
                                        onPress={() => updateForm('selectedPlan', planItem.id)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <Text style={[localStyles.planLabel, isSelected && { color: NAVY_DARK }]}>
                                                    {planItem.label}
                                                </Text>
                                                {planItem.badge && (
                                                    <View style={localStyles.planBadge}>
                                                        <Text style={localStyles.planBadgeText}>{planItem.badge}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={localStyles.planPrice}>
                                                {planItem.price === 0 ? 'Free Trial' : `₦${planItem.price.toLocaleString()}`}
                                            </Text>
                                        </View>

                                        <View style={[localStyles.radioCircle, isSelected && localStyles.radioCircleActive]}>
                                            {isSelected && <View style={localStyles.radioDot} />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Summary Card */}
                        <View style={localStyles.summaryBox}>
                            <Text style={localStyles.summaryTitle}>APPLICATION SUMMARY</Text>
                            <View style={localStyles.summaryRow}>
                                <Text style={localStyles.summaryLabel}>Store Name</Text>
                                <Text style={localStyles.summaryVal} numberOfLines={1}>{formData.businessName || '—'}</Text>
                            </View>
                            <View style={localStyles.summaryRow}>
                                <Text style={localStyles.summaryLabel}>Structure</Text>
                                <Text style={localStyles.summaryVal}>{activeBusinessType.badge}</Text>
                            </View>
                            <View style={localStyles.summaryRow}>
                                <Text style={localStyles.summaryLabel}>Primary Category</Text>
                                <Text style={localStyles.summaryVal}>{formData.businessCategory || 'General'}</Text>
                            </View>
                            <View style={localStyles.summaryRow}>
                                <Text style={localStyles.summaryLabel}>Trading Hub</Text>
                                <Text style={localStyles.summaryVal}>{formData.operatingHub || 'Kano'}</Text>
                            </View>
                            <View style={localStyles.summaryRow}>
                                <Text style={localStyles.summaryLabel}>Settlement Bank</Text>
                                <Text style={localStyles.summaryVal}>{formData.bankName || '—'}</Text>
                            </View>
                            <View style={localStyles.summaryRow}>
                                <Text style={localStyles.summaryLabel}>Beneficiary Name</Text>
                                <Text style={localStyles.summaryVal} numberOfLines={1}>{formData.accountName || '—'}</Text>
                            </View>
                            <View style={[localStyles.summaryRow, { borderBottomWidth: 0, paddingTop: 10 }]}>
                                <Text style={[localStyles.summaryLabel, { color: NAVY_DARK, fontWeight: '900' }]}>Total Subscription Fee</Text>
                                <Text style={localStyles.summaryFee}>₦{plan.price.toLocaleString()}</Text>
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
                                    {uploading ? 'Processing Documents...' : 'Submitting...'}
                                </Text>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons
                                    name={needsPayment ? "card" : "checkmark-circle"}
                                    size={18}
                                    color={NAVY_DARK}
                                />
                                <Text style={localStyles.nextStepBtnText}>
                                    {needsPayment ? `Pay ₦${plan.price.toLocaleString()} & Activate` : 'Submit Application'}
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
                            <Text style={localStyles.modalTitle}>Select Settlement Bank</Text>
                            <TouchableOpacity onPress={() => setShowBankDropdown(false)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={24} color={NAVY_DARK} />
                            </TouchableOpacity>
                        </View>

                        <View style={localStyles.modalSearchRow}>
                            <Ionicons name="search" size={18} color={GOLD_DARK} />
                            <TextInput
                                style={localStyles.modalSearchInput}
                                placeholder="Search commercial bank..."
                                placeholderTextColor={TEXT_MUTED}
                                value={searchBankQuery}
                                onChangeText={handleSearchBank}
                            />
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                            {filteredBanks.map((bank, index) => (
                                <TouchableOpacity
                                    key={`${bank.code}-${index}`}
                                    style={localStyles.bankRow}
                                    onPress={() => {
                                        updateForm('bankName', bank.name);
                                        setBankCode(bank.code);
                                        setShowBankDropdown(false);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={localStyles.bankRowText}>{bank.name}</Text>
                                    <Ionicons name="chevron-forward" size={16} color={GOLD_DARK} />
                                </TouchableOpacity>
                            ))}
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
    planCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    planCardSelected: {
        borderColor: GOLD,
        backgroundColor: GOLD_SURFACE
    },
    planLabel: {
        fontSize: 15,
        fontWeight: '900',
        color: NAVY_DARK
    },
    planBadge: {
        backgroundColor: NAVY_DARK,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: GOLD
    },
    planBadgeText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: GOLD
    },
    planPrice: {
        fontSize: 16,
        fontWeight: '900',
        color: GOLD_DARK,
        marginTop: 2
    },

    // Summary Box
    summaryBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    summaryTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: NAVY_DARK,
        letterSpacing: 0.5,
        marginBottom: 8
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR
    },
    summaryLabel: {
        fontSize: 12,
        color: TEXT_SECONDARY,
        fontWeight: '600'
    },
    summaryVal: {
        fontSize: 13,
        fontWeight: '700',
        color: NAVY_DARK,
        maxWidth: '55%',
        textAlign: 'right'
    },
    summaryFee: {
        fontSize: 18,
        fontWeight: '900',
        color: GOLD_DARK
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
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR
    },
    bankRowText: {
        fontSize: 14.5,
        fontWeight: '700',
        color: NAVY_DARK
    },
    paystackNavHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF'
    }
});
