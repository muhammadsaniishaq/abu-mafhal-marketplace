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
    KeyboardAvoidingView,
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

const GOLD = '#D9A73A';
const GOLD_LIGHT = '#FDE68A';
const NAVY = '#070D1B';
const CARD_BG = '#0E1A2E';
const INPUT_BG = '#14233D';

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
                    color={file ? '#10B981' : GOLD}
                />
            </View>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={localStyles.uploadLabel}>{label}</Text>
                    {required && <Text style={{ color: '#EF4444', fontWeight: '700' }}>*</Text>}
                </View>
                <Text
                    style={[localStyles.uploadSub, file ? { color: '#10B981', fontWeight: '700' } : null]}
                    numberOfLines={1}
                >
                    {file ? (file.name || 'File Attached ✓') : 'Tap to select document'}
                </Text>
            </View>
        </View>
        <View style={localStyles.uploadActionBadge}>
            <Ionicons
                name={file ? "pencil" : "cloud-upload-outline"}
                size={14}
                color={file ? '#CBD5E1' : GOLD}
            />
            <Text style={[localStyles.uploadActionText, file ? { color: '#CBD5E1' } : null]}>
                {file ? 'Change' : 'Upload'}
            </Text>
        </View>
    </TouchableOpacity>
);

const STEP_LABELS = [
    'Business',
    'Documents',
    'Logistics',
    'Banking',
    'Plan',
    'Review'
];

const VendorRegisterInner = ({ user, onBack = () => { }, onSubmit, mode = 'register', activeVendorPlans = [] }) => {
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();

    // Check if registration is disabled (and we are not renewing)
    const isRegistrationDisabled = settings?.features?.enable_vendor_registration === false;

    // Default to the first plan in settings or '1_year' if fallback
    const defaultPlanId = activeVendorPlans.length > 0 ? activeVendorPlans[0].id : '1_year';

    // 1: Info, 2: Docs, 3: Logistics, 4: Banking, 5: Plan, 6: Confirm/Pay
    const [step, setStep] = useState(mode === 'renew' ? 5 : 1);

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
        businessName: '',
        businessDescription: '',
        businessCategory: '',
        businessAddress: '',
        cacNumber: '',
        tinNumber: '',
        bvn: '',
        nin: '',
        deliveryType: 'marketplace',
        guarantorName: '',
        guarantorPhone: '',
        bankName: '',
        accountNumber: '',
        accountName: '',
        revenue: '',
        yearsInBusiness: '',
        website: '',
        facebook: '',
        instagram: '',
        selectedPlan: defaultPlanId
    });

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
        logo: avatarUrl ? { uri: avatarUrl, name: 'Current Profile Picture', isAvatar: true } : null,
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
            updateForm('accountName', '');
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
                updateForm('accountName', '');
                Alert.alert('Verification Failed', json.message || 'Could not verify account. Please check your account number and bank.');
            }
        } catch (error) {
            console.log('Error resolving account:', error);
            Alert.alert('Error', 'Failed to verify account details.');
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
                payload.company_type = 'RC';
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
                Alert.alert('Verification Successful', `${type.toUpperCase()} verified successfully.`);
            } else {
                setVerificationStatus(prev => ({ ...prev, [field]: 'failed' }));
                Alert.alert('Verification Failed', json.error || `Could not verify ${type.toUpperCase()}.`);
            }
        } catch (error) {
            console.log(`Error verifying ${type}:`, error);
            setVerificationStatus(prev => ({ ...prev, [field]: 'failed' }));
            Alert.alert('Error', 'Verification service is unreachable. Please try again later.');
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

    const validateStep = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (step === 1) {
            if (!formData.businessName || !formData.phone || !formData.businessAddress || !formData.cacNumber || !formData.nin || !formData.bvn) {
                Alert.alert('Missing Fields', 'Please fill all required business details marked with *.');
                return false;
            }
            if (verificationStatus.cacNumber !== 'verified') {
                Alert.alert('Verification Required', 'Please click the "Verify" button to validate your CAC Registration Number.');
                return false;
            }
            if (verificationStatus.nin !== 'verified') {
                Alert.alert('Verification Required', 'Please click the "Verify" button to validate your NIN.');
                return false;
            }
            if (verificationStatus.bvn !== 'verified') {
                Alert.alert('Verification Required', 'Please click the "Verify" button to validate your BVN.');
                return false;
            }
        }
        if (step === 2) {
            if (!files.logo || !files.video || !files.cac) {
                Alert.alert('Missing Documents', 'Please upload Logo, Intro Video, and CAC Document.');
                return false;
            }
        }
        if (step === 3) {
            if (!formData.guarantorName || !formData.guarantorPhone) {
                Alert.alert('Missing Guarantor', 'Please provide guarantor details.');
                return false;
            }
        }
        if (step === 4) {
            if (!formData.bankName || !formData.accountNumber || !formData.accountName) {
                Alert.alert('Missing Banking Info', 'Please provide complete banking details for payouts.');
                return false;
            }
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
            throw new Error(`Failed to upload documents: ${errorMsg}. Check if storage bucket is ready.`);
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
                business_location: 'Mobile Submission',
                business_category: formData.businessCategory || 'General',
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
                    facebook: formData.facebook,
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
                businessName: app.business_name || '',
                businessDescription: app.business_description || '',
                businessCategory: app.business_category || '',
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
                facebook: app.socials?.facebook || '',
                instagram: app.socials?.instagram || '',
                website: app.socials?.website || '',
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
            Alert.alert('Application Restored', 'Details restored. Please correct the highlighted issues and submit again.');
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
                            <Ionicons name="shield-checkmark" size={13} color="#10B981" />
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
                        placeholderTextColor="#64748B"
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
                            <ActivityIndicator size="small" color="#070D1B" />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons
                                    name={isVerified ? "checkmark" : (isFailed ? "refresh" : "shield-outline")}
                                    size={13}
                                    color={isVerified ? "#FFFFFF" : (isFailed ? "#FFFFFF" : "#070D1B")}
                                />
                                <Text style={[
                                    localStyles.verifyBtnText,
                                    (isVerified || isFailed) && { color: '#FFFFFF' }
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
                <Text style={localStyles.stepPercentText}>
                    {Math.round((step / 6) * 100)}%
                </Text>
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
                                    <Ionicons name="checkmark" size={12} color="#070D1B" />
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
                <View style={localStyles.statusIconCircle}>
                    <Ionicons name="lock-closed" size={44} color="#94A3B8" />
                </View>
                <Text style={localStyles.statusTitle}>Registration Paused</Text>
                <Text style={localStyles.statusSub}>
                    Vendor applications are currently closed. Please check back later or contact marketplace support.
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
                <StatusBar barStyle="light-content" backgroundColor={NAVY} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }]}>
                    <Ionicons name="checkmark-circle" size={54} color="#10B981" />
                </View>
                <Text style={localStyles.statusTitle}>
                    {mode === 'renew' ? 'Subscription Renewed!' : 'Application Submitted!'}
                </Text>
                <Text style={localStyles.statusSub}>
                    {mode === 'renew' ?
                        'Your store subscription has been renewed. Products are visible across the marketplace.' :
                        'Your documents and payment have been received. Our compliance team will review your application within 24-48 hours.'}
                </Text>
                <TouchableOpacity
                    style={localStyles.primaryActionBtn}
                    onPress={onSubmit || onBack}
                    activeOpacity={0.85}
                >
                    <Text style={localStyles.primaryActionBtnText}>Continue to Dashboard</Text>
                    <Ionicons name="arrow-forward" size={18} color="#070D1B" />
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (checkingStatus) {
        return (
            <View style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={GOLD} />
                <Text style={{ marginTop: 16, color: '#94A3B8', fontWeight: '600' }}>Checking application status...</Text>
            </View>
        );
    }

    if (existingApp && existingApp.status === 'approved') {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 28 }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }]}>
                    <Ionicons name="shield-checkmark" size={54} color="#10B981" />
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
                    <Text style={{ color: GOLD, fontWeight: '700', fontSize: 14 }}>View Merchant Certificate</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (existingApp && existingApp.status === 'pending') {
        return (
            <SafeAreaView style={[localStyles.screenContainer, { justifyContent: 'center', alignItems: 'center', padding: 28 }]}>
                <StatusBar barStyle="light-content" backgroundColor={NAVY} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: 'rgba(217, 167, 58, 0.15)', borderColor: GOLD }]}>
                    <Ionicons name="time" size={54} color={GOLD} />
                </View>
                <Text style={localStyles.statusTitle}>Application Under Review</Text>
                <Text style={localStyles.statusSub}>
                    We are currently verifying your business credentials and NUBAN account. This typically completes within 24 hours.
                </Text>

                <View style={localStyles.statusInfoBox}>
                    <View style={localStyles.statusInfoRow}>
                        <Text style={localStyles.statusInfoLabel}>Submitted On</Text>
                        <Text style={localStyles.statusInfoVal}>{new Date(existingApp.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={localStyles.statusInfoRow}>
                        <Text style={localStyles.statusInfoLabel}>Store Plan</Text>
                        <Text style={[localStyles.statusInfoVal, { color: GOLD }]}>{existingApp.subscription_plan}</Text>
                    </View>
                    <View style={localStyles.statusInfoRow}>
                        <Text style={localStyles.statusInfoLabel}>Current Status</Text>
                        <View style={localStyles.pendingPill}>
                            <Text style={localStyles.pendingPillText}>Pending Approval</Text>
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
                <StatusBar barStyle="light-content" backgroundColor={NAVY} />
                <View style={[localStyles.statusIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' }]}>
                    <Ionicons name="close-circle" size={54} color="#EF4444" />
                </View>
                <Text style={localStyles.statusTitle}>Application Needs Review</Text>
                <Text style={localStyles.statusSub}>
                    Your application could not be verified automatically with the details provided.
                </Text>

                <View style={[localStyles.statusInfoBox, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 }}>
                        Reason for Rejection
                    </Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 18 }}>
                        {existingApp.rejection_reason || 'Please verify that your CAC number, NIN, and bank account name match exactly.'}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[localStyles.primaryActionBtn, { width: '100%' }]}
                    onPress={() => handleRetryApplication(existingApp)}
                    activeOpacity={0.85}
                >
                    <Text style={localStyles.primaryActionBtnText}>Correct & Resubmit</Text>
                    <Ionicons name="refresh" size={18} color="#070D1B" />
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // MAIN WIZARD FORM (MOBILE-FIRST LUXURY STEPPER)
    // ─────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={localStyles.screenContainer}>
            <StatusBar barStyle="light-content" backgroundColor={NAVY} />

            {/* Top Navigation Header */}
            <View style={localStyles.topNavHeader}>
                <TouchableOpacity onPress={prevStep} style={localStyles.backIconBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={localStyles.topNavTitle}>Vendor Application</Text>
                    <Text style={localStyles.topNavSub}>Abu Mafhal Verified Merchant</Text>
                </View>
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
                {/* STEP 1: BUSINESS INFORMATION */}
                {step === 1 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="business" size={20} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Business Information</Text>
                                <Text style={localStyles.cardSub}>Enter your registered business identity</Text>
                            </View>
                        </View>

                        {/* Business Name */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Business / Store Name</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.businessName}
                                onChangeText={t => updateForm('businessName', t)}
                                placeholder="e.g. Sani Gadgets & Co."
                                placeholderTextColor="#64748B"
                            />
                        </View>

                        {/* Business Description */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Store Description</Text>
                            </View>
                            <TextInput
                                style={[localStyles.textInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                                value={formData.businessDescription}
                                onChangeText={t => updateForm('businessDescription', t)}
                                placeholder="Describe the products or services you provide..."
                                placeholderTextColor="#64748B"
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        {/* Phone Number */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Official Phone Number</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.phone}
                                onChangeText={t => updateForm('phone', t)}
                                placeholder="+234 800 000 0000"
                                placeholderTextColor="#64748B"
                                keyboardType="phone-pad"
                            />
                        </View>

                        {/* Business Address */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Business Address (Physical Location)</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.businessAddress}
                                onChangeText={t => updateForm('businessAddress', t)}
                                placeholder="Shop Number, Street, City, State"
                                placeholderTextColor="#64748B"
                            />
                        </View>

                        <View style={localStyles.divider} />
                        <Text style={localStyles.sectionSubHeader}>GOVERNMENT COMPLIANCE & KYC</Text>

                        {/* CAC Registration Number */}
                        {renderVerifiedField("CAC Registration Number", "cacNumber", "cac", "RC-123456 or BN-123456", "default", undefined, true)}

                        {/* Tax ID (TIN) */}
                        {renderVerifiedField("Tax Identification Number (TIN)", "tinNumber", "tin", "10-digit TIN Number", "numeric", 10, false)}

                        {/* National ID (NIN) */}
                        {renderVerifiedField("National Identity Number (NIN)", "nin", "nin", "11-digit NIN Number", "numeric", 11, true)}

                        {/* Bank Verification Number (BVN) */}
                        {renderVerifiedField("Bank Verification Number (BVN)", "bvn", "bvn", "11-digit BVN Number", "numeric", 11, true)}
                    </View>
                )}

                {/* STEP 2: DOCUMENTS & MEDIA */}
                {step === 2 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="document-attach" size={20} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Documents & Media</Text>
                                <Text style={localStyles.cardSub}>Upload high-resolution scans or photos</Text>
                            </View>
                        </View>

                        {/* Business Logo */}
                        <Text style={localStyles.inputLabel}>Storefront Brand Logo</Text>
                        <View style={localStyles.logoPreviewCard}>
                            <View style={localStyles.logoBox}>
                                {files.logo?.uri ? (
                                    <Image source={{ uri: files.logo.uri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                                ) : (
                                    <Ionicons name="image-outline" size={28} color="#64748B" />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                {files.logo?.isAvatar && (
                                    <View style={localStyles.avatarBadge}>
                                        <Text style={localStyles.avatarBadgeText}>Using Account Profile Picture</Text>
                                    </View>
                                )}
                                <Text style={localStyles.logoStatusText}>
                                    {files.logo ? 'Store Logo Ready' : 'No Logo Uploaded'}
                                </Text>
                                <TouchableOpacity onPress={() => pickDocument('logo', true)} style={{ marginTop: 4 }}>
                                    <Text style={localStyles.logoActionText}>
                                        {files.logo ? 'Change Logo Image' : 'Tap to Upload Store Logo'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Intro Video */}
                        <UploadBtn
                            label="Store Intro / Verification Video"
                            file={files.video}
                            onPress={() => pickDocument('video', false)}
                            icon="videocam"
                            required
                        />

                        {/* CAC Document */}
                        <UploadBtn
                            label="CAC Incorporation Certificate"
                            file={files.cac}
                            onPress={() => pickDocument('cac')}
                            icon="document-text"
                            required
                        />

                        {/* NIN Slip */}
                        <UploadBtn
                            label="NIN Slip / Card Document"
                            file={files.nin}
                            onPress={() => pickDocument('nin')}
                            icon="card"
                        />
                    </View>
                )}

                {/* STEP 3: LOGISTICS & GUARANTOR */}
                {step === 3 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="cube" size={20} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Logistics & Fulfillment</Text>
                                <Text style={localStyles.cardSub}>Select your preferred dispatch method</Text>
                            </View>
                        </View>

                        <Text style={localStyles.inputLabel}>Fulfillment Method</Text>
                        <View style={{ gap: 12, marginBottom: 20 }}>
                            {/* Marketplace Fulfillment */}
                            <TouchableOpacity
                                style={[
                                    localStyles.deliveryOptionCard,
                                    formData.deliveryType === 'marketplace' && localStyles.deliveryOptionCardActive
                                ]}
                                onPress={() => updateForm('deliveryType', 'marketplace')}
                                activeOpacity={0.8}
                            >
                                <View style={[localStyles.deliveryIconBox, formData.deliveryType === 'marketplace' && { backgroundColor: GOLD }]}>
                                    <Ionicons
                                        name="shield-checkmark"
                                        size={22}
                                        color={formData.deliveryType === 'marketplace' ? '#070D1B' : '#94A3B8'}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[localStyles.deliveryTitle, formData.deliveryType === 'marketplace' && { color: GOLD }]}>
                                        Fulfilled by Abu Mafhal
                                    </Text>
                                    <Text style={localStyles.deliveryDesc}>
                                        We handle packaging, nationwide doorstep dispatch, and automated buyer tracking.
                                    </Text>
                                </View>
                                <View style={[localStyles.radioCircle, formData.deliveryType === 'marketplace' && localStyles.radioCircleActive]}>
                                    {formData.deliveryType === 'marketplace' && <View style={localStyles.radioDot} />}
                                </View>
                            </TouchableOpacity>

                            {/* Self Delivery */}
                            <TouchableOpacity
                                style={[
                                    localStyles.deliveryOptionCard,
                                    formData.deliveryType === 'self' && localStyles.deliveryOptionCardActive
                                ]}
                                onPress={() => updateForm('deliveryType', 'self')}
                                activeOpacity={0.8}
                            >
                                <View style={[localStyles.deliveryIconBox, formData.deliveryType === 'self' && { backgroundColor: GOLD }]}>
                                    <Ionicons
                                        name="bicycle"
                                        size={22}
                                        color={formData.deliveryType === 'self' ? '#070D1B' : '#94A3B8'}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[localStyles.deliveryTitle, formData.deliveryType === 'self' && { color: GOLD }]}>
                                        Self Delivery
                                    </Text>
                                    <Text style={localStyles.deliveryDesc}>
                                        Dispatch orders yourself using your dedicated courier with custom shipping rates.
                                    </Text>
                                </View>
                                <View style={[localStyles.radioCircle, formData.deliveryType === 'self' && localStyles.radioCircleActive]}>
                                    {formData.deliveryType === 'self' && <View style={localStyles.radioDot} />}
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={localStyles.divider} />
                        <Text style={localStyles.sectionSubHeader}>BUSINESS GUARANTOR</Text>

                        {/* Guarantor Name */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Guarantor Full Name</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.guarantorName}
                                onChangeText={t => updateForm('guarantorName', t)}
                                placeholder="Full name of business reference"
                                placeholderTextColor="#64748B"
                            />
                        </View>

                        {/* Guarantor Phone */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Guarantor Phone Number</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TextInput
                                style={localStyles.textInput}
                                value={formData.guarantorPhone}
                                onChangeText={t => updateForm('guarantorPhone', t)}
                                placeholder="+234 800 000 0000"
                                placeholderTextColor="#64748B"
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>
                )}

                {/* STEP 4: BANKING & SETTLEMENT */}
                {step === 4 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="card" size={20} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Payout Bank Account</Text>
                                <Text style={localStyles.cardSub}>Where your product sales are remitted</Text>
                            </View>
                        </View>

                        {/* Bank Selector */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Settlement Bank</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                            </View>
                            <TouchableOpacity
                                style={localStyles.selectBankBtn}
                                onPress={() => setShowBankDropdown(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={[localStyles.selectBankText, formData.bankName ? { color: '#FFFFFF' } : null]}>
                                    {formData.bankName || 'Select bank name'}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={GOLD} />
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
                                placeholderTextColor="#64748B"
                                keyboardType="numeric"
                                maxLength={10}
                            />
                        </View>

                        {/* Account Name (Auto-resolved) */}
                        <View style={localStyles.fieldGroup}>
                            <View style={localStyles.labelRow}>
                                <Text style={localStyles.inputLabel}>Verified Account Name</Text>
                                <Text style={localStyles.reqStar}>*</Text>
                                {formData.accountName && (
                                    <View style={localStyles.verifiedTag}>
                                        <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                                        <Text style={localStyles.verifiedTagText}>Confirmed</Text>
                                    </View>
                                )}
                            </View>
                            <View style={[localStyles.textInput, { flexDirection: 'row', alignItems: 'center' }]}>
                                {resolvingAccount && (
                                    <ActivityIndicator size="small" color={GOLD} style={{ marginRight: 8 }} />
                                )}
                                <TextInput
                                    style={{ flex: 1, color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}
                                    value={formData.accountName}
                                    editable={false}
                                    placeholder={
                                        formData.accountNumber.length === 10 && !resolvingAccount
                                            ? "Account name not found"
                                            : "Enter 10 digits to auto-verify"
                                    }
                                    placeholderTextColor="#64748B"
                                />
                            </View>
                        </View>
                    </View>
                )}

                {/* STEP 5: CHOOSE VENDOR PLAN */}
                {step === 5 && (
                    <View style={localStyles.stepCard}>
                        <View style={localStyles.cardHeaderRow}>
                            <View style={localStyles.cardIconBox}>
                                <Ionicons name="trophy" size={20} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.cardHeading}>Select Vendor Plan</Text>
                                <Text style={localStyles.cardSub}>Choose your storefront subscription package</Text>
                            </View>
                        </View>

                        <View style={{ gap: 12 }}>
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
                                                <Text style={[localStyles.planLabel, isSelected && { color: GOLD }]}>
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
                    </View>
                )}

                {/* STEP 6: REVIEW & CONFIRM */}
                {step === 6 && (
                    <View style={localStyles.stepCard}>
                        <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                            <View style={[localStyles.statusIconCircle, { width: 68, height: 68, borderRadius: 34 }]}>
                                <Ionicons
                                    name={needsPayment ? "wallet-outline" : "shield-checkmark-outline"}
                                    size={34}
                                    color={needsPayment ? GOLD : "#10B981"}
                                />
                            </View>
                            <Text style={localStyles.confirmTitle}>
                                {needsPayment ? 'Payment & Activation' : 'Ready for Verification'}
                            </Text>
                            <Text style={localStyles.confirmSub}>
                                Selected Package: <Text style={{ color: GOLD, fontWeight: '800' }}>{plan.label}</Text>
                            </Text>
                        </View>

                        <View style={localStyles.summaryBox}>
                            <View style={localStyles.summaryRow}>
                                <Text style={localStyles.summaryLabel}>Store Name</Text>
                                <Text style={localStyles.summaryVal} numberOfLines={1}>{formData.businessName}</Text>
                            </View>
                            <View style={localStyles.summaryRow}>
                                <Text style={localStyles.summaryLabel}>Phone</Text>
                                <Text style={localStyles.summaryVal}>{formData.phone}</Text>
                            </View>
                            <View style={localStyles.summaryRow}>
                                <Text style={localStyles.summaryLabel}>Settlement Bank</Text>
                                <Text style={localStyles.summaryVal}>{formData.bankName}</Text>
                            </View>
                            <View style={localStyles.summaryRow}>
                                <Text style={localStyles.summaryLabel}>Account Name</Text>
                                <Text style={localStyles.summaryVal} numberOfLines={1}>{formData.accountName}</Text>
                            </View>
                            <View style={[localStyles.summaryRow, { borderBottomWidth: 0, paddingTop: 10 }]}>
                                <Text style={[localStyles.summaryLabel, { color: '#FFFFFF', fontWeight: '800' }]}>Total Fee Due</Text>
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
                        <Ionicons name="arrow-back" size={18} color="#CBD5E1" />
                        <Text style={localStyles.backStepBtnText}>Back</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={localStyles.backStepBtn}
                        onPress={onBack}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="close" size={18} color="#CBD5E1" />
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
                        <Ionicons name="arrow-forward" size={18} color="#070D1B" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[
                            localStyles.nextStepBtn,
                            needsPayment ? { backgroundColor: GOLD } : { backgroundColor: '#10B981' }
                        ]}
                        onPress={handleFinalAction}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <ActivityIndicator color="#070D1B" size="small" />
                                <Text style={localStyles.nextStepBtnText}>
                                    {uploading ? 'Processing Files...' : 'Submitting...'}
                                </Text>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons
                                    name={needsPayment ? "card" : "checkmark-circle"}
                                    size={18}
                                    color="#070D1B"
                                />
                                <Text style={localStyles.nextStepBtnText}>
                                    {needsPayment ? `Pay ₦${plan.price.toLocaleString()} & Join` : 'Submit Application'}
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
                                <Ionicons name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={localStyles.modalSearchRow}>
                            <Ionicons name="search" size={18} color="#94A3B8" />
                            <TextInput
                                style={localStyles.modalSearchInput}
                                placeholder="Search bank name..."
                                placeholderTextColor="#64748B"
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
                                    <Ionicons name="chevron-forward" size={16} color="#64748B" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Paystack WebView Modal */}
            <Modal visible={showPaystackWebView} animationType="slide" transparent={false}>
                <SafeAreaView style={{ flex: 1, backgroundColor: NAVY }}>
                    <View style={localStyles.paystackNavHeader}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>Paystack Secured Checkout</Text>
                        <TouchableOpacity onPress={() => {
                            setShowPaystackWebView(false);
                            Alert.alert('Payment Cancelled', 'Payment cancelled. Complete payment to activate your vendor account.');
                        }}>
                            <Ionicons name="close" size={24} color="#FFFFFF" />
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
                                    Alert.alert('Processing Notice', 'Payment window closed. If you paid, our team will verify your application.');
                                    setLoading(false);
                                }
                            }
                        }}
                        startInLoadingState={true}
                        renderLoading={() => (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: NAVY }}>
                                <ActivityIndicator size="large" color={GOLD} />
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
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: NAVY }}>
                <ActivityIndicator size="large" color={GOLD} />
                <Text style={{ marginTop: 14, color: '#94A3B8', fontWeight: '700' }}>Initializing Merchant Suite...</Text>
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
// CALIBRATED LUXURY DESIGN STYLES
// ─────────────────────────────────────────────────────────────
const localStyles = StyleSheet.create({
    screenContainer: {
        flex: 1,
        backgroundColor: NAVY
    },
    topNavHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 167, 58, 0.15)',
        backgroundColor: '#091122'
    },
    backIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
        color: '#FFFFFF'
    },
    topNavSub: {
        fontSize: 11,
        color: GOLD,
        fontWeight: '700',
        marginTop: 1
    },

    // Progress Bar
    progressContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
        backgroundColor: '#0A1326',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)'
    },
    progressHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    stepBadge: {
        backgroundColor: 'rgba(217, 167, 58, 0.2)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6
    },
    stepBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: GOLD,
        letterSpacing: 0.5
    },
    stepActiveTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    stepPercentText: {
        fontSize: 12,
        fontWeight: '900',
        color: GOLD
    },
    progressTrack: {
        height: 5,
        backgroundColor: '#1E293B',
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
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 3
    },
    stepCircleCompleted: {
        backgroundColor: GOLD
    },
    stepCircleCurrent: {
        backgroundColor: '#0E1A2E',
        borderWidth: 2,
        borderColor: GOLD
    },
    stepNumber: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B'
    },
    stepNumberCurrent: {
        color: GOLD
    },
    stepItemLabel: {
        fontSize: 9,
        fontWeight: '600',
        color: '#64748B'
    },
    stepItemLabelCurrent: {
        color: GOLD,
        fontWeight: '800'
    },
    stepItemLabelCompleted: {
        color: '#CBD5E1'
    },

    // Scroll Body & Step Card
    scrollBody: {
        padding: 16,
        paddingBottom: 90
    },
    stepCard: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4
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
        backgroundColor: 'rgba(217, 167, 58, 0.18)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    cardHeading: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    cardSub: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2
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
        color: '#E2E8F0'
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
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 6
    },
    verifiedTagText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#10B981'
    },
    textInput: {
        backgroundColor: INPUT_BG,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 46,
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '600',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginVertical: 16
    },
    sectionSubHeader: {
        fontSize: 11,
        fontWeight: '800',
        color: GOLD,
        letterSpacing: 0.5,
        marginBottom: 14
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
        height: 46,
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '600',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    inputVerified: {
        borderColor: 'rgba(16, 185, 129, 0.5)'
    },
    verifyBtn: {
        backgroundColor: GOLD,
        paddingHorizontal: 14,
        height: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    verifyBtnSuccess: {
        backgroundColor: '#10B981'
    },
    verifyBtnFailed: {
        backgroundColor: '#EF4444'
    },
    verifyBtnText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#070D1B'
    },

    // Logo & Uploads
    logoPreviewCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: INPUT_BG,
        borderRadius: 14,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    logoBox: {
        width: 52,
        height: 52,
        borderRadius: 26,
        overflow: 'hidden',
        backgroundColor: '#091326',
        marginRight: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: GOLD
    },
    avatarBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 3
    },
    avatarBadgeText: {
        fontSize: 9.5,
        color: '#10B981',
        fontWeight: '800'
    },
    logoStatusText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF'
    },
    logoActionText: {
        fontSize: 12,
        fontWeight: '800',
        color: GOLD
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: INPUT_BG,
        padding: 13,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    uploadIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    uploadIconBoxSuccess: {
        backgroundColor: 'rgba(16, 185, 129, 0.18)'
    },
    uploadLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF'
    },
    uploadSub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2
    },
    uploadActionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8
    },
    uploadActionText: {
        fontSize: 11,
        fontWeight: '800',
        color: GOLD
    },

    // Logistics Delivery Options
    deliveryOptionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: INPUT_BG,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        gap: 12
    },
    deliveryOptionCardActive: {
        borderColor: GOLD,
        backgroundColor: '#162846'
    },
    deliveryIconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    deliveryTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    deliveryDesc: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 3,
        lineHeight: 15
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#64748B',
        alignItems: 'center',
        justifyContent: 'center'
    },
    radioCircleActive: {
        borderColor: GOLD
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: GOLD
    },

    // Bank Selection
    selectBankBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: INPUT_BG,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 46,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    selectBankText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B'
    },

    // Plan Selection
    planCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: INPUT_BG,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    planCardSelected: {
        borderColor: GOLD,
        backgroundColor: '#162846'
    },
    planLabel: {
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    planBadge: {
        backgroundColor: GOLD,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4
    },
    planBadgeText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#070D1B'
    },
    planPrice: {
        fontSize: 16,
        fontWeight: '900',
        color: GOLD,
        marginTop: 2
    },

    // Summary Box
    summaryBox: {
        backgroundColor: INPUT_BG,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.06)'
    },
    summaryLabel: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600'
    },
    summaryVal: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
        maxWidth: '55%',
        textAlign: 'right'
    },
    summaryFee: {
        fontSize: 18,
        fontWeight: '900',
        color: GOLD
    },
    confirmTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 10
    },
    confirmSub: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 4
    },

    // Sticky Bottom Bar
    bottomBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 10,
        backgroundColor: '#081020',
        borderTopWidth: 1,
        borderTopColor: 'rgba(217, 167, 58, 0.2)',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.2,
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
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)'
    },
    backStepBtnText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#CBD5E1'
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
        color: '#070D1B'
    },

    // Status Screens Elements
    statusIconCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        marginBottom: 20
    },
    statusTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8
    },
    statusSub: {
        fontSize: 13.5,
        color: '#94A3B8',
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
        color: '#070D1B'
    },
    secondaryActionBtn: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 10
    },
    secondaryActionBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#CBD5E1'
    },
    statusInfoBox: {
        width: '100%',
        backgroundColor: CARD_BG,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.2)',
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
        color: '#94A3B8',
        fontWeight: '600'
    },
    statusInfoVal: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    pendingPill: {
        backgroundColor: 'rgba(217, 167, 58, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6
    },
    pendingPillText: {
        fontSize: 10,
        fontWeight: '900',
        color: GOLD
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: '#0D182E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        borderTopWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)'
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
        color: '#FFFFFF'
    },
    modalSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: INPUT_BG,
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 14,
        height: 44,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    modalSearchInput: {
        flex: 1,
        marginLeft: 8,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600'
    },
    bankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)'
    },
    bankRowText: {
        fontSize: 14.5,
        fontWeight: '600',
        color: '#FFFFFF'
    },
    paystackNavHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0A1326'
    }
});
