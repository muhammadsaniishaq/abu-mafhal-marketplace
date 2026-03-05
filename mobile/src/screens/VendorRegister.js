import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Alert, StyleSheet, ActivityIndicator, LayoutAnimation, Platform, UIManager, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';

import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { UploadService } from '../services/uploadService';
import { WebView } from 'react-native-webview';
import { VendorCertificate } from './VendorCertificate';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    try {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    } catch (e) {
        // No-op in New Architecture
    }
}

const UploadBtn = ({ label, file, onPress, icon }) => (
    <TouchableOpacity onPress={onPress} style={localStyles.uploadBtn}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: file ? '#DCFCE7' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={file ? "checkmark" : icon} size={20} color={file ? '#16A34A' : '#64748B'} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }}>{label}</Text>
                <Text style={{ fontSize: 12, color: file ? '#16A34A' : '#64748B' }} numberOfLines={1}>
                    {file ? (file.name || 'File Selected') : 'Tap to upload'}
                </Text>
            </View>
        </View>
        {file && <Ionicons name="create-outline" size={16} color="#94A3B8" />}
    </TouchableOpacity>
);

const localStyles = StyleSheet.create({
    stepTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#0F172A' },
    sectionHeader: { fontSize: 14, fontWeight: '700', color: '#64748B', marginTop: 8, marginBottom: 12, textTransform: 'uppercase' },
    uploadBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16,
        backgroundColor: '#FFFFFF'
    },
    radioBtn: {
        flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
        alignItems: 'center', gap: 8, justifyContent: 'center'
    },
    radioActive: { borderColor: '#0F172A', backgroundColor: '#F8FAFC' },
    planCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12
    },
    planActive: { borderColor: '#0F172A', backgroundColor: '#F8FAFC' },
    badge: { backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }
});

import { useAppSettings } from '../context/AppSettingsContext';

// ...

const VendorRegisterInner = ({ user, onBack = () => { }, onSubmit, mode = 'register', activeVendorPlans = [] }) => {
    const { settings } = useAppSettings();

    // Check if registration is disabled (and we are not renewing)
    const isRegistrationDisabled = settings?.features?.enable_vendor_registration === false;

    // Default to the first plan in settings or '1_year' if fallback
    const defaultPlanId = activeVendorPlans.length > 0 ? activeVendorPlans[0].id : '1_year';

    // 1: Info, 2: Docs, 3: Logistics, 4: Banking, 5: Plan, 6: Confirm/Pay
    const [step, setStep] = useState(mode === 'renew' ? 5 : 1);

    if (isRegistrationDisabled && mode !== 'renew') {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 20 }}>
                <Ionicons name="lock-closed" size={60} color="#94A3B8" />
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#0F172A', marginTop: 16 }}>Registration Closed</Text>
                <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 8 }}>
                    Target Vendor Application is currently closed. Please check back later.
                </Text>
                <TouchableOpacity onPress={onBack} style={{ marginTop: 24, padding: 12, backgroundColor: '#E2E8F0', borderRadius: 8 }}>
                    <Text style={{ color: '#475569', fontWeight: '600' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ...
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [existingApp, setExistingApp] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [paidPlan, setPaidPlan] = useState(null); // [NEW] Track the plan ID that was paid for
    const [savedPaymentRef, setSavedPaymentRef] = useState(null); // [NEW] Track old payment ref
    const [paymentVerified, setPaymentVerified] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [editingAppId, setEditingAppId] = useState(null); // [NEW] Track ID when retrying
    const [showCertificate, setShowCertificate] = useState(false); // [NEW] Certificate Modal

    // [NEW] Custom Paystack Integration State
    const [showPaystackWebView, setShowPaystackWebView] = useState(false);
    const [currentRef, setCurrentRef] = useState(null);
    const [checkoutUrl, setCheckoutUrl] = useState(null);

    // [NEW] Bank Account Resolution State
    const [bankCode, setBankCode] = useState('');
    const [banks, setBanks] = useState([]);
    const [filteredBanks, setFilteredBanks] = useState([]);
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [searchBankQuery, setSearchBankQuery] = useState('');
    const [resolvingAccount, setResolvingAccount] = useState(false);

    React.useEffect(() => {
        checkApplicationStatus();
        fetchBanks();
    }, []);



    const checkApplicationStatus = async () => {
        try {
            const { data, error } = await supabase
                .from('vendor_applications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false }) // Get latest
                .limit(1)
                .maybeSingle(); // Safer than .single()

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


    // FORM STATE
    const [formData, setFormData] = useState({
        // Personal
        fullName: user?.user_metadata?.full_name || '',
        phone: user?.user_metadata?.phone_number || '', // Pre-fill from auth
        // Business
        businessName: '',
        businessDescription: '',
        businessCategory: '',
        businessAddress: '',
        cacNumber: '',
        tinNumber: '',
        bvn: '',
        nin: '',
        // Logistics
        deliveryType: 'marketplace', // marketplace | self
        guarantorName: '',
        guarantorPhone: '',
        // Banking
        bankName: '',
        accountNumber: '',
        accountName: '',
        // Extras
        revenue: '',
        yearsInBusiness: '',
        website: '',
        facebook: '',
        instagram: '',
        // Subscription
        selectedPlan: defaultPlanId
    });

    // VERIFICATION STATE
    const [verificationStatus, setVerificationStatus] = useState({
        cacNumber: null, // null | 'loading' | 'verified' | 'failed'
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

    const updateForm = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    React.useEffect(() => {
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

            // If CAC, we also pass the business name to help with cross-referencing (Prembly specific)
            if (type === 'cac') {
                payload.company_name = formData.businessName;
                payload.company_type = 'RC'; // Defaulting to RC for simplicity
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
                if (type === 'cac') {
                    // [DEPRECATED] Auto-fill removed by user request until Live mode is active
                    Alert.alert('Verification Successful', `${type.toUpperCase()} verified successfully.`);
                } else {
                    Alert.alert('Verification Successful', `${type.toUpperCase()} verified successfully.`);
                }
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
                    urls.logo_url = files.logo.uri; // Just use the existing avatar URL
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
                // ... (renew logic remains same, unrelated to this fix) 
                // Determine expiry days
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
                socials: {
                    facebook: formData.facebook,
                    instagram: formData.instagram,
                    website: formData.website
                },
                subscription_plan: plan.label,
                subscription_fee: plan.price,
                // [FIXED] Check if already paid (retry) or just paid (paymentRef)
                payment_status: (paymentRef || (paymentVerified && paidPlan === plan.id)) ? 'paid' : (plan.price === 0 ? 'free_trial' : 'pending'),
                payment_reference: paymentRef || (paymentVerified && paidPlan === plan.id ? savedPaymentRef : ('REF-' + Date.now())),
                status: 'pending', // IMPORTANT: Reset status to pending on retry
                rejection_reason: null // Clear previous rejection reason
            };

            let error;

            // [Adjusted] Check if we are updating an existing (rejected) application or creating a new one
            // Use editingAppId if available (for retries), otherwise fall back to existingApp.id (rare)
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

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsSuccess(true);

        } catch (error) {
            console.error('Final Submission Error:', error);
            Alert.alert('Submission Failed', error.message || 'An unexpected error occurred during submission.');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalAction = () => {
        const plan = activeVendorPlans.find(p => p.id === formData.selectedPlan) || activeVendorPlans[0] || { id: 'fallback', label: 'Unavailable', price: 0 };

        if (needsPayment) { // Use needsPayment here
            setLoading(true);

            setTimeout(async () => {
                try {
                    const fallbackEmail = user?.email || `user_${user?.id?.substring(0, 6) || Math.floor(Math.random() * 10000)}@abumafhal.com`;
                    const ref = `RV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                    const { data, error } = await supabase.functions.invoke('initiate-paystack-payment', {
                        body: {
                            amount: plan.price,
                            email: fallbackEmail,
                            reference: ref
                        }
                    });

                    if (error) throw error;
                    if (!data?.success) throw new Error(data?.error || 'Failed to initialize payment');

                    setCurrentRef(ref);
                    setCheckoutUrl(data.authorization_url);
                    setShowPaystackWebView(true);
                } catch (err) {
                    console.error('[DEBUG-PAYSTACK] Init Error:', err);
                    Alert.alert('Payment Error', 'Could not initialize payment. Please try again.');
                } finally {
                    setLoading(false);
                }
            }, 200);
        } else {
            handleActualSubmit();
        }
    };

    const renderProgressBar = () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingHorizontal: 4 }}>
            {[1, 2, 3, 4, 5, 6].map((s) => (
                <View key={s} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{
                        width: 24, height: 24, borderRadius: 12,
                        backgroundColor: step >= s ? '#0F172A' : '#E2E8F0',
                        alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Text style={{ color: step >= s ? 'white' : '#64748B', fontSize: 12, fontWeight: '700' }}>{s}</Text>
                    </View>
                    {s < 6 && <View style={{ flex: 1, height: 2, backgroundColor: step > s ? '#0F172A' : '#E2E8F0', marginHorizontal: 4 }} />}
                </View>
            ))}
        </View>
    );

    const plan = activeVendorPlans.find(p => p.id === formData.selectedPlan) || activeVendorPlans[0] || { id: 'fallback', label: 'Unavailable', price: 0 };

    if (showCertificate) {
        return <VendorCertificate user={user} vendorData={existingApp} onBack={() => setShowCertificate(false)} />;
    }

    if (isSuccess) {
        return (
            <View style={[styles.authContainer, { backgroundColor: '#F8FAFC' }]}>
                <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                    <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
                        <Ionicons name="checkmark-circle" size={60} color="#16A34A" />
                    </View>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 12, textAlign: 'center' }}>
                        {mode === 'renew' ? 'Subscription Renewed!' : 'Application Submitted!'}
                    </Text>
                    <Text style={{ fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 40, lineHeight: 24 }}>
                        {mode === 'renew' ?
                            'Your shop is now active and your products are visible to customers.' :
                            'We have received your application and payment. Our team will review your documents within 24-48 hours.'}
                    </Text>

                    <TouchableOpacity
                        style={[styles.modernBtn, { width: '100%', height: 56 }]}
                        onPress={onSubmit}
                    >
                        <Text style={styles.modernBtnText}>Go to Profile</Text>
                        <Ionicons name="arrow-forward" size={20} color="white" />
                    </TouchableOpacity>
                </SafeAreaView>
            </View>
        );
    }

    if (checkingStatus) {
        return (
            <View style={[styles.authContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#0F172A" />
                <Text style={{ marginTop: 16, color: '#64748B' }}>Checking application status...</Text>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={[styles.authContainer, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
                <ActivityIndicator size="large" color="#0F172A" />
                <Text style={{ marginTop: 24, fontSize: 18, fontWeight: '700', color: '#0F172A', textAlign: 'center' }}>
                    {uploading ? 'Uploading Documents...' : 'Processing Application...'}
                </Text>
                <Text style={{ marginTop: 12, color: '#64748B', textAlign: 'center' }}>
                    Please wait while we secure your application. Do not close the app.
                </Text>
            </View>
        );
    }

    if (existingApp && existingApp.status === 'approved') {
        return (
            <View style={styles.authContainer}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.shopHeader}>
                        <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
                            <Ionicons name="close" size={24} color="#0F172A" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginLeft: 16 }}>Status</Text>
                    </View>
                </SafeAreaView>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                        <Ionicons name="checkmark-done" size={40} color="#16A34A" />
                    </View>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>Application Approved!</Text>
                    <Text style={{ fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 32 }}>
                        Congratulations! Your vendor account is active. You can now start selling on Abu Mafhal.
                    </Text>

                    <TouchableOpacity style={[styles.modernBtn, { width: '100%', marginBottom: 16 }]} onPress={() => {
                        // The button should just close the modal and let the MainApp handle the view
                        if (onSubmit) {
                            onSubmit();
                        } else {
                            onBack();
                        }
                    }}>
                        <Text style={styles.modernBtnText}>Go to Dashboard</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setShowCertificate(true)}>
                        <Text style={{ color: '#3B82F6', fontWeight: '700' }}>View Certificate</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (existingApp && existingApp.status === 'pending') {
        return (
            <View style={styles.authContainer}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.shopHeader}>
                        <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
                            <Ionicons name="close" size={24} color="#0F172A" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginLeft: 16 }}>Status</Text>
                    </View>
                </SafeAreaView>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                        <Ionicons name="time" size={40} color="#F59E0B" />
                    </View>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>Application Pending</Text>
                    <Text style={{ fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 32 }}>
                        We are currently reviewing your documents and business details. This usually takes 24-48 hours.
                    </Text>
                    <View style={{ width: '100%', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 32 }}>
                        <Text style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>Applied On</Text>
                        <Text style={{ fontWeight: '600', marginTop: 4 }}>{new Date(existingApp.created_at).toLocaleDateString()}</Text>
                        <View style={{ height: 12 }} />
                        <Text style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>Plan</Text>
                        <Text style={{ fontWeight: '600', marginTop: 4 }}>{existingApp.subscription_plan}</Text>
                    </View>
                    <TouchableOpacity style={[styles.modernBtn, { width: '100%' }]} onPress={onBack}>
                        <Text style={styles.modernBtnText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const handleRetryApplication = async (staleApp) => {
        setLoading(true);
        try {
            // [NEW] Refetch the latest application data to ensure we have the correct payment_status
            // This fixes the issue where manual DB updates aren't reflected until reload
            const { data: freshApp, error } = await supabase
                .from('vendor_applications')
                .select('*')
                .eq('id', staleApp.id)
                .single();

            const app = freshApp || staleApp; // Fallback to stale if fetch fails

            // 1. Pre-fill form with existing data
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

            // 2. Preserve Payment Status if already paid
            const status = app.payment_status?.toLowerCase();
            console.log('Retry Payment Status:', status);

            // [HOTFIX] Force Pay for specific stuck application ID
            const isStuckApp = app.id === 'eb8793ae-9817-42e6-97c0-bc1468f9fdbe';

            if (status === 'paid' || isStuckApp) {
                setPaymentVerified(true);
                setPaidPlan(matchedPlan?.id || defaultPlanId);
                setSavedPaymentRef(app.payment_reference || 'REF-FORCED-FIX');
                if (isStuckApp) Alert.alert('Payment Verified', 'System manually verified your payment.');
            }

            // 3. Reset View to Form & Track ID
            setEditingAppId(app.id); // [IMPORTANT] Remember this ID for UPDATE
            setExistingApp(null);
            setStep(1);
            Alert.alert('Application Restored', 'We have restored your details. Please correct the issues and submit again.');
        } catch (err) {
            console.error('Retry Fetch Error:', err);
            Alert.alert('Error', 'Could not refresh application details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (existingApp && existingApp.status === 'rejected') {
        return (
            <View style={styles.authContainer}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.shopHeader}>
                        <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
                            <Ionicons name="close" size={24} color="#0F172A" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginLeft: 16 }}>Application</Text>
                    </View>
                </SafeAreaView>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                        <Ionicons name="close-circle" size={40} color="#EF4444" />
                    </View>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>Application Rejected</Text>
                    <Text style={{ fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 32 }}>
                        Unfortunately, your application was not approved at this time.
                    </Text>
                    <View style={{ width: '100%', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 32 }}>
                        <Text style={{ fontSize: 12, color: '#EF4444', textTransform: 'uppercase', fontWeight: '700' }}>Reason</Text>
                        <Text style={{ color: '#0F172A', marginTop: 4 }}>
                            {existingApp.rejection_reason || 'Please check your email or contact support for more details regarding the rejection.'}
                        </Text>
                    </View>
                    <TouchableOpacity style={[styles.modernBtn, { width: '100%' }]} onPress={() => handleRetryApplication(existingApp)}>
                        <Text style={styles.modernBtnText}>Fix & Apply Again</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Helper to determine if we should skip payment
    const isPaymentValid = () => {
        if (plan.price === 0) return true; // Free plan
        if (paymentVerified) {
            // Only valid if the selected plan matches the one they paid for
            if (paidPlan && paidPlan !== plan.id) return false;
            return true;
        }
        return false;
    };

    const needsPayment = !isPaymentValid();

    return (
        <View style={styles.authContainer}>
            <View style={styles.circle1} />
            <View style={styles.circle3} />

            <SafeAreaView style={styles.safeArea}>
                <View style={[styles.shopHeader, { borderBottomWidth: 0 }]}>
                    <TouchableOpacity onPress={prevStep} style={{ padding: 4 }}>
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginLeft: 16 }}>
                        Vendor Application
                    </Text>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
                {renderProgressBar()}

                <View style={styles.authCard}>
                    {step === 1 && (
                        <View>
                            <Text style={localStyles.stepTitle}>Business Information</Text>
                            <Text style={styles.label}>Business Name *</Text>
                            <TextInput style={styles.modernInput} value={formData.businessName} onChangeText={t => updateForm('businessName', t)} placeholder="e.g. Sani Gadgets" />
                            <View style={{ height: 16 }} />
                            <Text style={styles.label}>Description</Text>
                            <TextInput style={styles.modernInput} value={formData.businessDescription} onChangeText={t => updateForm('businessDescription', t)} placeholder="What do you sell?" />
                            <View style={{ height: 16 }} />
                            <Text style={styles.label}>Phone Number *</Text>
                            <TextInput style={styles.modernInput} value={formData.phone} onChangeText={t => updateForm('phone', t)} placeholder="+234..." keyboardType="phone-pad" />
                            <View style={{ height: 16 }} />
                            <Text style={styles.label}>Business Address *</Text>
                            <TextInput style={styles.modernInput} value={formData.businessAddress} onChangeText={t => updateForm('businessAddress', t)} placeholder="Street, City, State" />
                            <View style={{ height: 16 }} />
                            <Text style={styles.label}>CAC Registration Number *</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TextInput style={[styles.modernInput, { flex: 1, marginBottom: 0 }]} value={formData.cacNumber} onChangeText={t => { updateForm('cacNumber', t); setVerificationStatus(p => ({ ...p, cacNumber: null })); }} placeholder="RC-123456" />
                                <TouchableOpacity
                                    style={[styles.modernBtn, { marginLeft: 8, paddingHorizontal: 16, height: '100%', borderRadius: 12, backgroundColor: verificationStatus.cacNumber === 'verified' ? '#10B981' : '#0F172A' }]}
                                    onPress={() => verifyField('cacNumber', 'cac')}
                                    disabled={verificationStatus.cacNumber === 'loading' || verificationStatus.cacNumber === 'verified'}
                                >
                                    {verificationStatus.cacNumber === 'loading' ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>{verificationStatus.cacNumber === 'verified' ? 'Verified' : 'Verify'}</Text>}
                                </TouchableOpacity>
                            </View>
                            <View style={{ height: 16 }} />

                            <Text style={styles.label}>Tax ID (TIN)</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TextInput style={[styles.modernInput, { flex: 1, marginBottom: 0 }]} value={formData.tinNumber} onChangeText={t => { updateForm('tinNumber', t); setVerificationStatus(p => ({ ...p, tinNumber: null })); }} placeholder="102030..." />
                                <TouchableOpacity
                                    style={[styles.modernBtn, { marginLeft: 8, paddingHorizontal: 16, height: '100%', borderRadius: 12, backgroundColor: verificationStatus.tinNumber === 'verified' ? '#10B981' : '#0F172A' }]}
                                    onPress={() => verifyField('tinNumber', 'tin')}
                                    disabled={verificationStatus.tinNumber === 'loading' || verificationStatus.tinNumber === 'verified'}
                                >
                                    {verificationStatus.tinNumber === 'loading' ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>{verificationStatus.tinNumber === 'verified' ? 'Verified' : 'Verify'}</Text>}
                                </TouchableOpacity>
                            </View>
                            <View style={{ height: 16 }} />

                            <Text style={styles.label}>National ID (NIN) *</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TextInput style={[styles.modernInput, { flex: 1, marginBottom: 0 }]} value={formData.nin} onChangeText={t => { updateForm('nin', t); setVerificationStatus(p => ({ ...p, nin: null })); }} placeholder="11-digit NIN" keyboardType="numeric" maxLength={11} />
                                <TouchableOpacity
                                    style={[styles.modernBtn, { marginLeft: 8, paddingHorizontal: 16, height: '100%', borderRadius: 12, backgroundColor: verificationStatus.nin === 'verified' ? '#10B981' : '#0F172A' }]}
                                    onPress={() => verifyField('nin', 'nin')}
                                    disabled={verificationStatus.nin === 'loading' || verificationStatus.nin === 'verified'}
                                >
                                    {verificationStatus.nin === 'loading' ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>{verificationStatus.nin === 'verified' ? 'Verified' : 'Verify'}</Text>}
                                </TouchableOpacity>
                            </View>
                            <View style={{ height: 16 }} />

                            <Text style={styles.label}>Bank Verification Number (BVN) *</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TextInput style={[styles.modernInput, { flex: 1, marginBottom: 0 }]} value={formData.bvn} onChangeText={t => { updateForm('bvn', t); setVerificationStatus(p => ({ ...p, bvn: null })); }} placeholder="11-digit BVN" keyboardType="numeric" maxLength={11} />
                                <TouchableOpacity
                                    style={[styles.modernBtn, { marginLeft: 8, paddingHorizontal: 16, height: '100%', borderRadius: 12, backgroundColor: verificationStatus.bvn === 'verified' ? '#10B981' : '#0F172A' }]}
                                    onPress={() => verifyField('bvn', 'bvn')}
                                    disabled={verificationStatus.bvn === 'loading' || verificationStatus.bvn === 'verified'}
                                >
                                    {verificationStatus.bvn === 'loading' ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>{verificationStatus.bvn === 'verified' ? 'Verified' : 'Verify'}</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {step === 2 && (
                        <View>
                            <Text style={localStyles.stepTitle}>Documents & Media</Text>
                            <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>Upload clear images or PDFs.</Text>

                            <Text style={styles.label}>Business Logo</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                <View style={{ width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: '#F1F5F9', marginRight: 16, alignItems: 'center', justifyContent: 'center' }}>
                                    {files.logo?.uri ? (
                                        <Image source={{ uri: files.logo.uri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                                    ) : (
                                        <Ionicons name="business" size={32} color="#CBD5E1" />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    {files.logo?.isAvatar && (
                                        <View style={{ backgroundColor: '#DCFCE7', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginBottom: 4 }}>
                                            <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: '700' }}>Using Your Avatar</Text>
                                        </View>
                                    )}
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A', marginBottom: 2 }}>
                                        {files.logo ? 'Logo Selected' : 'Upload Business Logo'}
                                    </Text>
                                    <TouchableOpacity onPress={() => pickDocument('logo', true)}>
                                        <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: '600' }}>
                                            {files.logo ? 'Change Logo' : 'Tap to Upload'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <UploadBtn label="Intro Video (Mandatory)" file={files.video} onPress={() => pickDocument('video', false)} icon="videocam" />
                            <UploadBtn label="CAC Certificate" file={files.cac} onPress={() => pickDocument('cac')} icon="document-text" />
                            <UploadBtn label="NIN Slip" file={files.nin} onPress={() => pickDocument('nin')} icon="card" />
                        </View>
                    )}

                    {step === 3 && (
                        <View>
                            <Text style={localStyles.stepTitle}>Logistics & Guarantor</Text>
                            <Text style={styles.label}>Delivery Method</Text>
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                                <TouchableOpacity
                                    style={[localStyles.radioBtn, formData.deliveryType === 'marketplace' && localStyles.radioActive]}
                                    onPress={() => updateForm('deliveryType', 'marketplace')}
                                >
                                    <Ionicons name="cube" size={20} color={formData.deliveryType === 'marketplace' ? '#0F172A' : '#94A3B8'} />
                                    <Text style={{ fontSize: 12, fontWeight: '600', width: '80%', textAlign: 'center' }}>Fulfilled by Abu Mafhal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[localStyles.radioBtn, formData.deliveryType === 'self' && localStyles.radioActive]}
                                    onPress={() => updateForm('deliveryType', 'self')}
                                >
                                    <Ionicons name="bicycle" size={20} color={formData.deliveryType === 'self' ? '#0F172A' : '#94A3B8'} />
                                    <Text style={{ fontSize: 12, fontWeight: '600' }}>Self Delivery</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={localStyles.sectionHeader}>Guarantor Details</Text>
                            <Text style={styles.label}>Guarantor Name *</Text>
                            <TextInput style={styles.modernInput} value={formData.guarantorName} onChangeText={t => updateForm('guarantorName', t)} />
                            <View style={{ height: 16 }} />
                            <Text style={styles.label}>Guarantor Phone *</Text>
                            <TextInput style={styles.modernInput} value={formData.guarantorPhone} onChangeText={t => updateForm('guarantorPhone', t)} keyboardType="phone-pad" />
                        </View>
                    )}

                    {step === 4 && (
                        <View>
                            <Text style={localStyles.stepTitle}>Banking & Details</Text>
                            <Text style={localStyles.sectionHeader}>Payout Account</Text>

                            <Text style={styles.label}>Bank Name *</Text>
                            <TouchableOpacity
                                style={[styles.modernInput, { justifyContent: 'center' }]}
                                onPress={() => setShowBankDropdown(true)}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ color: formData.bankName ? '#0F172A' : '#94A3B8' }}>
                                        {formData.bankName || 'Select your bank'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                                </View>
                            </TouchableOpacity>
                            <View style={{ height: 16 }} />

                            <Text style={styles.label}>Account Number *</Text>
                            <TextInput
                                style={styles.modernInput}
                                value={formData.accountNumber}
                                onChangeText={t => updateForm('accountNumber', t)}
                                keyboardType="numeric"
                                maxLength={10}
                                placeholder="10 digit account number"
                            />
                            <View style={{ height: 16 }} />

                            <Text style={styles.label}>Account Name (Auto-fetched) *</Text>
                            <View style={[styles.modernInput, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderColor: 'transparent' }]}>
                                {resolvingAccount ? (
                                    <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 10 }} />
                                ) : null}
                                <TextInput
                                    style={{ flex: 1, color: '#0F172A', fontWeight: '700' }}
                                    value={formData.accountName}
                                    editable={false}
                                    placeholder={formData.accountNumber.length === 10 && !resolvingAccount ? "Account name not found" : "Enter account number first"}
                                />
                            </View>
                        </View>
                    )}

                    {step === 5 && (
                        <View>
                            <Text style={localStyles.stepTitle}>Choose a Plan</Text>
                            {activeVendorPlans.map((plan) => (
                                <TouchableOpacity
                                    key={plan.id}
                                    style={[localStyles.planCard, formData.selectedPlan === plan.id && localStyles.planActive]}
                                    onPress={() => updateForm('selectedPlan', plan.id)}
                                >
                                    <View>
                                        <Text style={{ fontWeight: '700', fontSize: 16 }}>{plan.label}</Text>
                                        <Text style={{ color: '#64748B' }}>{plan.price === 0 ? 'Free' : `₦${plan.price.toLocaleString()}`}</Text>
                                    </View>
                                    {plan.badge && <View style={localStyles.badge}><Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{plan.badge}</Text></View>}
                                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: formData.selectedPlan === plan.id ? '#0F172A' : '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}>
                                        {formData.selectedPlan === plan.id && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#0F172A' }} />}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {step === 6 && (
                        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                <Ionicons
                                    name={needsPayment ? "wallet" : "shield-checkmark"}
                                    size={32}
                                    color={needsPayment ? "#F59E0B" : "#16A34A"}
                                />
                            </View>
                            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                                {needsPayment ? 'Payment Required' : 'Ready to Submit?'}
                            </Text>
                            <Text style={{ color: '#64748B', textAlign: 'center', marginBottom: 24 }}>
                                Plan: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{plan.label} (₦{plan.price.toLocaleString()})</Text>
                                {needsPayment && "\nPayment must be completed before joining."}
                                {!needsPayment && paidPlan && plan.id !== paidPlan && "\n(Plan changed - Payment required)"}
                            </Text>

                            {/* Warning if they are forfeiting a payment */}
                            {paymentVerified && paidPlan && plan.id !== paidPlan && (
                                <View style={{ backgroundColor: '#FFF7ED', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                                    <Text style={{ color: '#C2410C', fontSize: 12, textAlign: 'center' }}>
                                        Note: You previously paid for a different plan. Changing plans requires a new payment.
                                    </Text>
                                </View>
                            )}

                            <View style={{ width: '100%', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12 }}>
                                <Text style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>Business</Text>
                                <Text style={{ fontWeight: '600', marginTop: 4 }}>{formData.businessName}</Text>
                                <View style={{ height: 12 }} />
                                <Text style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>Total Due</Text>
                                <Text style={{ fontWeight: '700', fontSize: 18, color: '#0F172A' }}>₦{plan.price.toLocaleString()}</Text>
                            </View>
                        </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 32 }}>
                        {step < 6 ? (
                            <TouchableOpacity style={styles.modernBtn} onPress={nextStep}>
                                <Text style={styles.modernBtnText}>Next Step</Text>
                                <Ionicons name="arrow-forward" size={20} color="white" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={[styles.modernBtn, needsPayment && { backgroundColor: '#F59E0B' }]} onPress={handleFinalAction} disabled={loading}>
                                {loading ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <ActivityIndicator color="white" />
                                        <Text style={{ color: 'white', fontWeight: '600' }}>{uploading ? 'Processing Files...' : 'Submitting...'}</Text>
                                    </View>
                                ) : (
                                    <>
                                        <Text style={styles.modernBtnText}>
                                            {needsPayment ? 'Pay Now & Join' : 'Submit Application'}
                                        </Text>
                                        <Ionicons name={needsPayment ? "card" : "checkmark-circle"} size={20} color="white" />
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Bank Selection Modal */}
            <Modal visible={showBankDropdown} animationType="slide" transparent={true}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', padding: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>Select Bank</Text>
                            <TouchableOpacity onPress={() => setShowBankDropdown(false)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 16, marginBottom: 16 }}>
                            <Ionicons name="search" size={20} color="#94A3B8" />
                            <TextInput
                                style={{ flex: 1, paddingVertical: 12, marginLeft: 8, color: '#0F172A' }}
                                placeholder="Search bank..."
                                value={searchBankQuery}
                                onChangeText={handleSearchBank}
                            />
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {filteredBanks.map((bank, index) => (
                                <TouchableOpacity
                                    key={`${bank.code}-${index}`}
                                    style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                                    onPress={() => {
                                        updateForm('bankName', bank.name);
                                        setBankCode(bank.code);
                                        setShowBankDropdown(false);
                                    }}
                                >
                                    <Text style={{ fontSize: 16, color: '#0F172A' }}>{bank.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Custom Paystack WebView Modal */}
            <Modal visible={showPaystackWebView} animationType="slide" transparent={false}>
                <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
                    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700' }}>Secure Checkout</Text>
                        <TouchableOpacity onPress={() => {
                            setShowPaystackWebView(false);
                            console.log('Paystack: Payment Cancelled by user');
                            Alert.alert('Payment Cancelled', 'You must complete payment to join the marketplace.');
                        }}>
                            <Ionicons name="close" size={24} color="#0F172A" />
                        </TouchableOpacity>
                    </View>
                    <WebView
                        source={{ uri: checkoutUrl }}
                        onNavigationStateChange={async (navState) => {
                            if (navState.url.includes('standard.paystack.co/close') || navState.url.includes('callback') || navState.url.includes('cancel')) {
                                setShowPaystackWebView(false);

                                try {
                                    setLoading(true); // lock the form 
                                    const { data, error } = await supabase.functions.invoke('verify-paystack-payment', {
                                        body: {
                                            reference: currentRef,
                                            action: 'vendor_registration',
                                            amount: plan.price,
                                            user_id: user.id,
                                            expected_plan_id: plan.id
                                        }
                                    });

                                    if (error) throw error;
                                    if (!data?.success) throw new Error(data?.error || 'Vendor payment verification failed');

                                    setPaymentVerified(true);
                                    setPaidPlan(plan.id); // Mark this plan as paid

                                    setTimeout(() => {
                                        handleActualSubmit(currentRef);
                                    }, 500);

                                } catch (err) {
                                    console.error('Verification Error:', err);
                                    Alert.alert('Processing Notice', 'Payment window closed. If you paid, it might take a moment to verify your application.');
                                    setLoading(false);
                                }
                            }
                        }}
                        startInLoadingState={true}
                        renderLoading={() => (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#0F172A" />
                            </View>
                        )}
                        style={{ flex: 1 }}
                    />
                </SafeAreaView>
            </Modal>
        </View>
    );
};

export const VendorRegister = (props) => {
    const { settings } = useAppSettings();

    if (settings?.loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <ActivityIndicator size="large" color="#0F172A" />
                <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600' }}>Initializing Gateway...</Text>
            </View>
        );
    }

    const vendorPlansRaw = settings?.vendor_plans || [];
    const activeVendorPlans = vendorPlansRaw.filter(p => p.is_active !== false);

    return (
        <VendorRegisterInner {...props} activeVendorPlans={activeVendorPlans} />
    );
};


