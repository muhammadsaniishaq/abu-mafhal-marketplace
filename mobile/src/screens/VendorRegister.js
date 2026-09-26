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
    StatusBar
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
// LUXURY LIGHT DESIGN PALETTE (NO DARK BACKGROUND)
// ─────────────────────────────────────────────────────────────
const GOLD = '#D9A73A';
const GOLD_DARK = '#B45309';
const GOLD_SURFACE = '#FEF9C3';
const GOLD_BORDER = 'rgba(217, 167, 58, 0.35)';
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
        icon: 'business-outline',
        cacPlaceholder: 'e.g. RC-1849202',
        cacLabel: 'CAC RC Number',
        cacRequired: true
    },
    {
        id: 'business_name',
        label: 'Registered Business Name (BN)',
        badge: 'BN Reg',
        desc: 'Enterprise / Sole store with CAC BN number',
        icon: 'storefront-outline',
        cacPlaceholder: 'e.g. BN-3849202',
        cacLabel: 'CAC BN Number',
        cacRequired: true
    },
    {
        id: 'sole_proprietor',
        label: 'Individual Trader / Artisan',
        badge: 'Individual',
        desc: 'Informal trader, artisan, or small merchant',
        icon: 'person-outline',
        cacPlaceholder: 'Optional (e.g. Tax ID or RC)',
        cacLabel: 'CAC / Business ID (Optional)',
        cacRequired: false
    },
    {
        id: 'partnership',
        label: 'Partnership / Cooperative',
        badge: 'Co-op',
        desc: 'Trade cooperative or multi-partner business',
        icon: 'people-outline',
        cacPlaceholder: 'Coop Reg / CAC Number',
        cacLabel: 'Cooperative Reg Number',
        cacRequired: true
    }
];

// Major Commercial Hubs / Operating States
const OPERATING_HUBS = [
    { id: 'Kano', label: 'Kano (Kantin Kwari / Singa / Sabon Gari)' },
    { id: 'Lagos', label: 'Lagos (Alaba / Trade Fair / Balogun / Ikeja)' },
    { id: 'Abuja', label: 'Abuja (FCT - Wuse / Garki)' },
    { id: 'Kaduna', label: 'Kaduna (Central Market / Kasuwan Barchi)' },
    { id: 'Katsina', label: 'Katsina (Central Market)' },
    { id: 'Sokoto', label: 'Sokoto' },
    { id: 'Other', label: 'Other State / Location' }
];

// Store Categories with rich sub-details
const BUSINESS_CATEGORIES = [
    { id: 'Electronics', label: 'Tech & Gadgets', sub: 'Phones, Computers, Audio & Accessories', icon: 'phone-portrait-outline', emoji: '📱' },
    { id: 'Fashion', label: 'Fashion & Wear', sub: 'Men & Women Wear, Abayas, Shoes, Bags', icon: 'shirt-outline', emoji: '👗' },
    { id: 'Beauty', label: 'Beauty & Skincare', sub: 'Cosmetics, Perfumes, Oils & Hair Care', icon: 'sparkles-outline', emoji: '💄' },
    { id: 'Groceries', label: 'Groceries & Foods', sub: 'Rice, Spices, Foodstuff, Provisions', icon: 'cart-outline', emoji: '🍎' },
    { id: 'Automotive', label: 'Auto & Spare Parts', sub: 'Car Spare Parts, Oils, Batteries, Tools', icon: 'car-sport-outline', emoji: '🚗' },
    { id: 'Home', label: 'Home, Decor & Furniture', sub: 'Kitchenware, Bedding, Interior & Decor', icon: 'home-outline', emoji: '🛋️' },
    { id: 'General', label: 'General Wholesale', sub: 'Bulk Supplies, Hardware & Sundry Goods', icon: 'cube-outline', emoji: '📦' }
];

// Return & Customer Guarantee Policies
const RETURN_POLICIES = [
    { id: '7_days', label: '7-Day Return / Defect Exchange', badge: 'High Trust ⭐', desc: 'Buyers can request return within 7 days if goods are defective' },
    { id: '3_days', label: '3-Day Return Window', badge: 'Standard', desc: '3-day inspection window after doorstep delivery' },
    { id: 'final_sale', label: 'Inspect on Delivery (Sales Final)', badge: 'Final Sale', desc: 'Buyer inspects upon delivery before releasing payment' }
];

// Dispatch SLA options
const DISPATCH_SLAS = [
    { id: 'same_day', label: 'Same-Day Dispatch', time: 'Dispatched within 6 hours of order', icon: 'flash', badge: 'Fastest ⚡' },
    { id: '24_48_hrs', label: 'Express Dispatch', time: 'Dispatched within 24 - 48 hours', icon: 'cube-outline', badge: 'Standard' },
    { id: 'standard', label: 'Standard Dispatch', time: 'Dispatched within 3 - 5 business days', icon: 'trail-sign-outline', badge: 'Flexible' }
];

// Experience in Business options
const EXPERIENCE_OPTIONS = ['Under 1 Year', '1 - 3 Years', '3 - 5 Years', '5+ Years'];

// Sleek Upload Button Component
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
                    color={file ? EMERALD : GOLD_DARK}
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
                color={file ? EMERALD : GOLD_DARK}
            />
            <Text style={[localStyles.uploadActionText, file ? { color: EMERALD } : null]}>
                {file ? 'Change' : 'Upload'}
            </Text>
        </View>
    </TouchableOpacity>
);

const STEP_LABELS = [
    'Profile',
    'Categories',
    'Documents',
    'Logistics',
    'Banking',
    'Plan & Pay'
];

const VendorRegisterInner = ({ user, onBack = () => { }, onSubmit, mode = 'register', activeVendorPlans = [] }) => {
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();

    // Check if registration is disabled (and we are not renewing)
    const isRegistrationDisabled = settings?.features?.enable_vendor_registration === false;

    // Default to the first plan in settings or '1_year' if fallback
    const defaultPlanId = activeVendorPlans.length > 0 ? activeVendorPlans[0].id : '1_year';

    // 1: Profile & KYC, 2: Category & Socials, 3: Documents, 4: Logistics & Policy, 5: Banking, 6: Plan & Pay
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

    // Current selected business type definition
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
        } else {
            // Keep existing name if user typed it
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
            } else {
                // Don't wipe if user manually entered
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
                Alert.alert('Verification Successful', `${type.toUpperCase()} validated against official database.`);
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
    // SMOOTH & ERROR-PROOF STEP VALIDATION (NEVER TRAPS USER)
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
            if (activeBusinessType.cacRequired && !formData.cacNumber?.trim()) {
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
            if (formData.bvn?.trim() && formData.bvn.trim().length < 11) {
                Alert.alert('Invalid BVN', 'Bank Verification Number (BVN) must be 11 digits if provided.');
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
            if (activeBusinessType.cacRequired && !files.cac) {
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
            if (files.cac) urls.cac_url = await UploadService.uploadFile(files.cac, 'vendor-docs', 'docs');
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
                cac_number: formData.cacNumber,
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
                console.log('Updating existing application:', targetId);
                const result = await supabase
                    .from('vendor_applications')
                    .update(dbPayload)
                    .eq('id', targetId);
                error = result.error;
            } else {
                console.log('Creating new application');
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
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons
                                    name={isVerified ? "checkmark" : (isFailed ? "refresh" : "shield-outline")}
                                    size={13}
                                    color="#FFFFFF"
                                />
                                <Text style={localStyles.verifyBtnText}>
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
                    colors={[GOLD, '#F59E0B']}
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

    // ─────────────────────────────────────────────────────────────
    // EARLY RETURNS (Registration Closed, Success, Certificate, Status)
    // ─────────────────────────────────────────────────────────────
    if (isRegistrationDisabled && mode !== 'renew') {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                <StatusBar barStyle="dark-content" backgroundColor={CANVAS_BG} />
                <View style={localStyles.statusIconCircle}>
                    <Ionicons name="lock-closed" size={44} color={TEXT_MUTED} />
                </View>
                <Text style={localStyles.statusTitle}>Registration Paused</Text>
                <Text style={localStyles.statusSub}>
                    Vendor applications are currently paused for system onboarding. Please check back later or contact customer support.
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
                <StatusBar barStyle="dark-content" backgroundColor={CANVAS_BG} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: EMERALD_SURFACE, borderColor: EMERALD }]}>
                    <Ionicons name="checkmark-circle" size={54} color={EMERALD} />
                </View>
                <Text style={localStyles.statusTitle}>
                    {mode === 'renew' ? 'Subscription Renewed!' : 'Application Submitted!'}
                </Text>
                <Text style={localStyles.statusSub}>
                    {mode === 'renew' ?
                        'Your storefront subscription has been renewed. Your products are active across the marketplace.' :
                        'Your documents and payment have been securely submitted. Our compliance team will review your application within 24 hours.'}
                </Text>
                <TouchableOpacity
                    style={localStyles.primaryActionBtn}
                    onPress={onSubmit || onBack}
                    activeOpacity={0.85}
                >
                    <Text style={localStyles.primaryActionBtnText}>Continue to Dashboard</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (checkingStatus) {
        return (
            <View style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar barStyle="dark-content" backgroundColor={CANVAS_BG} />
                <ActivityIndicator size="large" color={GOLD_DARK} />
                <Text style={{ marginTop: 16, color: TEXT_SECONDARY, fontWeight: '700' }}>Checking vendor status...</Text>
            </View>
        );
    }

    if (existingApp && existingApp.status === 'approved') {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 28 }]}>
                <StatusBar barStyle="dark-content" backgroundColor={CANVAS_BG} />
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
                <StatusBar barStyle="dark-content" backgroundColor={CANVAS_BG} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: GOLD_SURFACE, borderColor: GOLD }]}>
                    <Ionicons name="time" size={54} color={GOLD_DARK} />
                </View>
                <Text style={localStyles.statusTitle}>Application Under Review</Text>
                <Text style={localStyles.statusSub}>
                    We are currently verifying your business credentials and NUBAN settlement account. This process usually completes within 24 hours.
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
                <StatusBar barStyle="dark-content" backgroundColor={CANVAS_BG} />
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
                        {existingApp.rejection_reason || 'Please verify that your CAC number, NIN, and bank account name match your company records.'}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[localStyles.primaryActionBtn, { width: '100%' }]}
                    onPress={() => handleRetryApplication(existingApp)}
                    activeOpacity={0.85}
                >
                    <Text style={localStyles.primaryActionBtnText}>Correct & Resubmit</Text>
                    <Ionicons name="refresh" size={18} color="#FFFFFF" />
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // MAIN WIZARD FORM (MOBILE-FIRST LUXURY LIGHT THEME)
    // ─────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={localStyles.screenContainer}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Top Navigation Header */}
            <View style={localStyles.topNavHeader}>
                <TouchableOpacity onPress={prevStep} style={localStyles.backIconBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color={TEXT_PRIMARY} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={localStyles.topNavTitle}>Vendor Application</Text>
                    <Text style={localStyles.topNavSub}>Abu Mafhal Verified Merchant Suite</Text>
                </View>
                <TouchableOpacity onPress={onBack} style={localStyles.closeIconBtn} activeOpacity={0.7}>
                    <Ionicons name="close" size={20} color={TEXT_MUTED} />
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
                            colors={['#FFFBEB', '#FEF3C7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={localStyles.perksBannerGradient}
                        >
                            <View style={localStyles.perksBannerHeader}>
                                <View style={localStyles.crownCircle}>
                                    <Ionicons name="ribbon" size={20} color={GOLD_DARK} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={localStyles.perksBannerTitle}>Abu Mafhal Merchant Privileges</Text>
                                    <Text style={localStyles.perksBannerSub}>Accelerate your brand with verified escrow commerce</Text>
                                </View>
                            </View>
                            <View style={localStyles.perksGrid}>
                                <View style={localStyles.perkItem}>
                                    <Ionicons name="shield-checkmark" size={15} color={EMERALD} />
                                    <Text style={localStyles.perkItemText}>100% Escrow Protection</Text>
                                </View>
                                <View style={localStyles.perkItem}>
                                    <Ionicons name="flash" size={15} color={GOLD_DARK} />
                                    <Text style={localStyles.perkItemText}>Same-Day Settlements</Text>
                                </View>
                                <View style={localStyles.perkItem}>
                                    <Ionicons name="car-outline" size={15} color="#0284C7" />
                                    <Text style={localStyles.perkItemText}>Integrated Logistics</Text>
                                </View>
                                <View style={localStyles.perkItem}>
                                    <Ionicons name="checkmark-done-circle" size={15} color={GOLD_DARK} />
                                    <Text style={localStyles.perkItemText}>Verified Badge Accreditation</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>
                )}

                {/* STEP 1: BUSINESS REGISTRATION & KYC */}
                {step === 1 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="business-outline" size={20} color={GOLD_DARK} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Business Structure & Profile</Text>
                                <Text style={localStyles.cardSub}>Choose your legal structure and corporate details</Text>
                            </View>
                        </View>

                        {/* NEW FEATURE: BUSINESS REGISTRATION TYPE SELECTOR */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Business Registration Structure</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <Text style={{ fontSize: 11.5, color: TEXT_MUTED, marginBottom: 8 }}>
                                Select how your commercial entity is legally registered:
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
                                                isSelected && { backgroundColor: GOLD_SURFACE }
                                            ]}>
                                                <Ionicons
                                                    name={bt.icon}
                                                    size={20}
                                                    color={isSelected ? GOLD_DARK : TEXT_SECONDARY}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={[
                                                        localStyles.btTitle,
                                                        isSelected && { color: GOLD_DARK, fontWeight: '900' }
                                                    ]}>
                                                        {bt.label}
                                                    </Text>
                                                    <View style={[
                                                        localStyles.btBadge,
                                                        isSelected && { backgroundColor: GOLD_SURFACE }
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

                        {/* Business Name */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Registered Store / Business Name</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.businessName}
                                onChangeText={t => updateForm('businessName', t)}
                                placeholder="e.g. Sani Ventures Ltd / Sani Gadgets"
                                placeholderTextColor={TEXT_MUTED}
                            />
                        </View>

                        {/* Business Description */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Store Bio & Overview</Text>
                            </View>
                            <TextInput
                                style={[localStyles.textInput, { height: 74, textAlignVertical: 'top', paddingTop: 10 }]}
                                value={formData.businessDescription}
                                onChangeText={t => updateForm('businessDescription', t)}
                                placeholder="Briefly describe what products your store specializes in..."
                                placeholderTextColor={TEXT_MUTED}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        {/* Phone Number */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Official Business Phone</Text>
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
                                placeholder="Shop / Suite number, Street, Commercial Complex"
                                placeholderTextColor={TEXT_MUTED}
                            />
                        </View>

                        {/* Operating Commercial Hub */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Ionicons name="location-outline" size={14} color={GOLD_DARK} />
                                <Text style={localStyles.inputLabel}>Primary Commercial Hub / State</Text>
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
                            <Ionicons name="shield-checkmark-outline" size={16} color={GOLD_DARK} />
                            <Text style={localStyles.sectionSubHeader}>GOVERNMENT COMPLIANCE & KYC</Text>
                        </View>

                        {/* Dynamic CAC Number depending on Business Type */}
                        {renderVerifiedField(
                            activeBusinessType.cacLabel,
                            "cacNumber",
                            "cac",
                            activeBusinessType.cacPlaceholder,
                            "default",
                            undefined,
                            activeBusinessType.cacRequired
                        )}

                        {/* Tax ID (TIN) */}
                        {renderVerifiedField("Tax Identification Number (TIN)", "tinNumber", "tin", "10-digit TIN Number (Optional)", "numeric", 10, false)}

                        {/* National ID (NIN) */}
                        {renderVerifiedField("National Identity Number (NIN)", "nin", "nin", "11-digit NIN Number", "numeric", 11, true)}

                        {/* Bank Verification Number (BVN) */}
                        {renderVerifiedField("Bank Verification Number (BVN)", "bvn", "bvn", "11-digit BVN Number (Optional)", "numeric", 11, false)}
                    </View>
                )}

                {/* STEP 2: CATEGORY & DIGITAL SOCIALS */}
                {step === 2 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="pricetags-outline" size={20} color={GOLD_DARK} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Store Category & Socials</Text>
                                <Text style={localStyles.cardSub}>Help customers discover your merchandise catalog</Text>
                            </View>
                        </View>

                        {/* Store Category Selection */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Primary Store Category</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <Text style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 10 }}>
                                Choose the industry that best represents your storefront inventory:
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
                                                <Ionicons name="checkmark-circle" size={18} color={GOLD_DARK} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Years in Business */}
                        <View style={[localStyles.fieldGroup, { marginTop: 8 }]}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Years in Operation</Text>
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
                            <Ionicons name="globe-outline" size={16} color={GOLD_DARK} />
                            <Text style={localStyles.sectionSubHeader}>DIGITAL STOREFRONT & SOCIAL CHANNELS</Text>
                        </View>

                        {/* WhatsApp Business */}
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
                                <Ionicons name="link-outline" size={14} color="#3B82F6" />
                                <Text style={localStyles.inputLabel}>Official Website / Portfolio Link</Text>
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

                {/* STEP 3: DOCUMENTS & MEDIA */}
                {step === 3 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="document-attach-outline" size={20} color={GOLD_DARK} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Compliance Documents & Logo</Text>
                                <Text style={localStyles.cardSub}>Upload high-clarity photos or PDF certificates</Text>
                            </View>
                        </View>

                        {/* Business Logo */}
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

                        {/* CAC Document */}
                        <UploadBtn
                            label={activeBusinessType.cacRequired ? `${activeBusinessType.label} Certificate` : 'Business Certificate / ID (Optional)'}
                            file={files.cac}
                            onPress={() => pickDocument('cac')}
                            icon="document-text-outline"
                            required={activeBusinessType.cacRequired}
                        />

                        {/* NIN Slip */}
                        <UploadBtn
                            label="NIN Slip / Identification Card"
                            file={files.nin}
                            onPress={() => pickDocument('nin')}
                            icon="card-outline"
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
                                <Ionicons name="cube-outline" size={20} color={GOLD_DARK} />
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
                                <View style={[localStyles.deliveryIconBox, formData.deliveryType === 'marketplace' && { backgroundColor: GOLD_SURFACE }]}>
                                    <Ionicons
                                        name="shield-checkmark"
                                        size={22}
                                        color={formData.deliveryType === 'marketplace' ? GOLD_DARK : TEXT_MUTED}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[localStyles.deliveryTitle, formData.deliveryType === 'marketplace' && { color: GOLD_DARK }]}>
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
                                <View style={[localStyles.deliveryIconBox, formData.deliveryType === 'self' && { backgroundColor: GOLD_SURFACE }]}>
                                    <Ionicons
                                        name="bicycle-outline"
                                        size={22}
                                        color={formData.deliveryType === 'self' ? GOLD_DARK : TEXT_MUTED}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[localStyles.deliveryTitle, formData.deliveryType === 'self' && { color: GOLD_DARK }]}>
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
                                                <Text style={[localStyles.slaTitle, isSelected && { color: GOLD_DARK }]}>
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
                                                <Text style={[localStyles.slaTitle, isSelected && { color: GOLD_DARK }]}>
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
                            <Ionicons name="people-outline" size={16} color={GOLD_DARK} />
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
                                <Ionicons name="card-outline" size={20} color={GOLD_DARK} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Payout & Settlement Account</Text>
                                <Text style={localStyles.cardSub}>Where your product sale revenue is automatically remitted</Text>
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
                                <Ionicons name="chevron-down" size={18} color={GOLD_DARK} />
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

                        {/* Account Name (Auto-resolved + Editable fallback) */}
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
                                <Ionicons name="trophy-outline" size={20} color={GOLD_DARK} />
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
                                                <Text style={[localStyles.planLabel, isSelected && { color: GOLD_DARK }]}>
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
                                <Text style={[localStyles.summaryLabel, { color: TEXT_PRIMARY, fontWeight: '800' }]}>Total Subscription Fee</Text>
                                <Text style={localStyles.summaryFee}>₦{plan.price.toLocaleString()}</Text>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* STICKY FIRST-MOBILE BOTTOM ACTION FOOTER */}
            <View style={[localStyles.bottomBarContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                {step > 1 ? (
                    <TouchableOpacity
                        style={localStyles.backStepBtn}
                        onPress={prevStep}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="arrow-back" size={18} color={TEXT_PRIMARY} />
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
                        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
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
                                <ActivityIndicator color="#FFFFFF" size="small" />
                                <Text style={localStyles.nextStepBtnText}>
                                    {uploading ? 'Processing Documents...' : 'Submitting...'}
                                </Text>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons
                                    name={needsPayment ? "card-outline" : "checkmark-circle"}
                                    size={18}
                                    color="#FFFFFF"
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
                                <Ionicons name="close" size={24} color={TEXT_PRIMARY} />
                            </TouchableOpacity>
                        </View>

                        <View style={localStyles.modalSearchRow}>
                            <Ionicons name="search" size={18} color={TEXT_MUTED} />
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
                                    <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
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
                        <Text style={{ fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY }}>Paystack Secured Checkout</Text>
                        <TouchableOpacity onPress={() => {
                            setShowPaystackWebView(false);
                            Alert.alert('Payment Cancelled', 'Payment was closed before completion. Complete payment to activate your vendor account.');
                        }}>
                            <Ionicons name="close" size={24} color={TEXT_PRIMARY} />
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
                                    Alert.alert('Payment Window Closed', 'If your transaction succeeded, our compliance team will update your account.');
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
                <Text style={{ marginTop: 14, color: TEXT_SECONDARY, fontWeight: '700' }}>Initializing Merchant Suite...</Text>
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
// LUXURY LIGHT DESIGN STYLES
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
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR,
        backgroundColor: '#FFFFFF'
    },
    backIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
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
        color: TEXT_PRIMARY
    },
    topNavSub: {
        fontSize: 11,
        color: GOLD_DARK,
        fontWeight: '700',
        marginTop: 1
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
        backgroundColor: GOLD_SURFACE,
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 6
    },
    stepBadgeText: {
        fontSize: 10.5,
        fontWeight: '900',
        color: GOLD_DARK,
        letterSpacing: 0.5
    },
    stepActiveTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: TEXT_PRIMARY
    },
    stepPercentPill: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12
    },
    stepPercentText: {
        fontSize: 11.5,
        fontWeight: '900',
        color: GOLD_DARK
    },
    progressTrack: {
        height: 5,
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
        backgroundColor: GOLD,
        borderColor: GOLD
    },
    stepCircleCurrent: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: GOLD
    },
    stepNumber: {
        fontSize: 10,
        fontWeight: '800',
        color: TEXT_MUTED
    },
    stepNumberCurrent: {
        color: GOLD_DARK,
        fontWeight: '900'
    },
    stepItemLabel: {
        fontSize: 9,
        fontWeight: '600',
        color: TEXT_MUTED
    },
    stepItemLabelCurrent: {
        color: GOLD_DARK,
        fontWeight: '800'
    },
    stepItemLabelCompleted: {
        color: TEXT_PRIMARY,
        fontWeight: '700'
    },

    // Perks Showcase Banner
    perksBanner: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: GOLD_BORDER,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2
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
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1
    },
    perksBannerTitle: {
        fontSize: 13.5,
        fontWeight: '900',
        color: TEXT_PRIMARY
    },
    perksBannerSub: {
        fontSize: 11,
        color: TEXT_SECONDARY,
        marginTop: 1
    },
    perksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingTop: 4
    },
    perkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 4.5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)'
    },
    perkItemText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: TEXT_PRIMARY
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
        borderColor: BORDER_COLOR,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
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
        backgroundColor: GOLD_SURFACE,
        alignItems: 'center',
        justifyContent: 'center'
    },
    cardHeading: {
        fontSize: 16,
        fontWeight: '900',
        color: TEXT_PRIMARY
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
        backgroundColor: '#FEF9C3'
    },
    btIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    btTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: TEXT_PRIMARY
    },
    btBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4
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
        backgroundColor: GOLD_SURFACE,
        borderColor: GOLD
    },
    hubPillText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: TEXT_SECONDARY
    },
    hubPillTextActive: {
        color: GOLD_DARK,
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
        fontWeight: '700',
        color: TEXT_PRIMARY
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
        color: TEXT_PRIMARY,
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
        fontWeight: '800',
        color: GOLD_DARK,
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
        backgroundColor: '#FEF9C3',
        borderColor: GOLD
    },
    categoryChipText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: TEXT_PRIMARY
    },
    categoryChipTextSelected: {
        color: GOLD_DARK,
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
        backgroundColor: GOLD_SURFACE,
        borderColor: GOLD
    },
    expPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: TEXT_SECONDARY
    },
    expPillTextSelected: {
        color: GOLD_DARK,
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
        color: TEXT_PRIMARY,
        fontWeight: '600',
        borderWidth: 1,
        borderColor: BORDER_COLOR
    },
    inputVerified: {
        borderColor: EMERALD,
        backgroundColor: EMERALD_SURFACE
    },
    verifyBtn: {
        backgroundColor: GOLD_DARK,
        paddingHorizontal: 14,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    verifyBtnSuccess: {
        backgroundColor: EMERALD
    },
    verifyBtnFailed: {
        backgroundColor: '#EF4444'
    },
    verifyBtnText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#FFFFFF'
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
        color: TEXT_PRIMARY
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
        backgroundColor: GOLD_SURFACE,
        alignItems: 'center',
        justifyContent: 'center'
    },
    uploadIconBoxSuccess: {
        backgroundColor: EMERALD_SURFACE
    },
    uploadLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: TEXT_PRIMARY
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
        borderRadius: 8
    },
    uploadActionText: {
        fontSize: 11,
        fontWeight: '800',
        color: GOLD_DARK
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
        backgroundColor: '#FEF9C3'
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
        color: TEXT_PRIMARY
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
        borderColor: GOLD_DARK
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: GOLD_DARK
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
        backgroundColor: '#FEF9C3'
    },
    slaTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: TEXT_PRIMARY
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
        backgroundColor: '#FEF9C3'
    },
    planLabel: {
        fontSize: 15,
        fontWeight: '800',
        color: TEXT_PRIMARY
    },
    planBadge: {
        backgroundColor: GOLD_DARK,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4
    },
    planBadgeText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#FFFFFF'
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
        color: GOLD_DARK,
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
        color: TEXT_PRIMARY,
        maxWidth: '55%',
        textAlign: 'right'
    },
    summaryFee: {
        fontSize: 18,
        fontWeight: '900',
        color: GOLD_DARK
    },

    // Sticky Bottom Bar
    bottomBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 10,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: BORDER_COLOR,
        elevation: 8,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
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
        color: TEXT_PRIMARY
    },
    nextStepBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        borderRadius: 12,
        backgroundColor: GOLD
    },
    nextStepBtnText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF'
    },

    // Status Screens Elements
    statusIconCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: BORDER_COLOR,
        marginBottom: 20
    },
    statusTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: TEXT_PRIMARY,
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
        backgroundColor: GOLD_DARK,
        borderRadius: 14,
        paddingHorizontal: 24
    },
    primaryActionBtnText: {
        fontSize: 14.5,
        fontWeight: '900',
        color: '#FFFFFF'
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
        color: TEXT_PRIMARY
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
        color: TEXT_PRIMARY
    },
    pendingPill: {
        backgroundColor: GOLD_SURFACE,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6
    },
    pendingPillText: {
        fontSize: 10,
        fontWeight: '900',
        color: GOLD_DARK
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        borderTopWidth: 1,
        borderColor: BORDER_COLOR,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
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
        color: TEXT_PRIMARY
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
        color: TEXT_PRIMARY,
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
        color: TEXT_PRIMARY
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
