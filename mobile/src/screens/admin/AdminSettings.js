import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    View, Text, Switch, TouchableOpacity, ScrollView, TextInput,
    Alert, ActivityIndicator, Image, Animated, Dimensions,
    StatusBar, Modal, FlatList, Clipboard, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../../context/AppSettingsContext';
import * as ImagePicker from 'expo-image-picker';
import { UploadService } from '../../services/uploadService';

const { width: W } = Dimensions.get('window');
const TAB_W = W / 7;

const CATEGORIES = [
    { id: 'branding',  label: 'Brand',    icon: 'color-palette', color: '#8B5CF6' },
    { id: 'financial', label: 'Finance',   icon: 'cash',          color: '#10B981' },
    { id: 'security',  label: 'Security',  icon: 'shield',        color: '#EF4444' },
    { id: 'vendors',   label: 'Vendors',   icon: 'business',      color: '#F59E0B' },
    { id: 'contact',   label: 'Contact',   icon: 'call',          color: '#0EA5E9' },
    { id: 'features',  label: 'More',      icon: 'construct',     color: '#3B82F6' },
    { id: 'advanced',  label: 'Advanced',  icon: 'settings',      color: '#6366F1' },
];

const CURRENCIES = [
    { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira' },
    { code: 'USD', symbol: '$',   name: 'US Dollar' },
    { code: 'GBP', symbol: '£',   name: 'British Pound' },
    { code: 'EUR', symbol: '€',   name: 'Euro' },
    { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
    { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
    { code: 'ZAR', symbol: 'R',   name: 'South African Rand' },
];

const QUICK_COLORS = ['#0F172A','#1E3A8A','#065F46','#7C2D12','#4C1D95','#831843','#134E4A'];

const NIGERIA_STATES = [
    'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
    'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT (Abuja)','Gombe',
    'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara',
    'Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau',
    'Rivers','Sokoto','Taraba','Yobe','Zamfara'
];

const DEFAULT_SHIPPING_FEES = NIGERIA_STATES.reduce((acc, state) => {
    // Lagos, Abuja, Rivers, Kano = lower rates; others = standard
    const premium = ['Lagos','FCT (Abuja)','Rivers','Kano','Ogun'].includes(state);
    acc[state] = premium ? 1500 : 3000;
    return acc;
}, {});

// ─────────────────────────────────────────────────────────────────────────────
export const AdminSettings = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { settings, updateSettings, refreshSettings } = useAppSettings();
    const [loading,            setLoading]            = useState(false);
    const [activeTab,          setActiveTab]          = useState('branding');
    const [searchQuery,        setSearchQuery]        = useState('');
    const [darkMode,           setDarkMode]           = useState(false);
    const [showCurrencyModal,  setShowCurrencyModal]  = useState(false);
    const [showExportModal,    setShowExportModal]    = useState(false);
    const [unsaved,            setUnsaved]            = useState(false);
    const deployPulse = useRef(new Animated.Value(1)).current;
    const slideAnim   = useMemo(() => new Animated.Value(0), []);

    const T = darkMode ? DARK : LIGHT;

    // ── Existing settings ──────────────────────────────────────
    const [appName,                setAppName]               = useState(settings?.app_name || '');
    const [logoUrl,                setLogoUrl]               = useState(settings?.logo_url || null);
    const [certLogoUrl,            setCertLogoUrl]           = useState(settings?.cert_logo_url || null);
    const [certBadgeUrl,           setCertBadgeUrl]          = useState(settings?.cert_badge_url || null);
    const [certSignatureUrl,       setCertSignatureUrl]      = useState(settings?.cert_signature_url || null);
    const [primaryColor,           setPrimaryColor]          = useState(settings?.primary_color || '#0F172A');
    const [secondaryColor,         setSecondaryColor]        = useState(settings?.secondary_color || '#3B82F6');
    const [defaultShippingAddress, setDefaultShippingAddress]= useState(settings?.default_shipping_address || '');
    const [paymentMethods,         setPaymentMethods]        = useState(settings?.payment_methods || {});
    const [paystackPublicKey,      setPaystackPublicKey]     = useState(settings?.paystack_public_key || '');
    const [paystackSecretKey,      setPaystackSecretKey]     = useState(settings?.paystack_secret_key || '');
    const [premblyAppId,           setPremblyAppId]          = useState(settings?.prembly_app_id || '');
    const [premblySecretKey,       setPremblySecretKey]      = useState(settings?.prembly_secret_key || '');
    const [geminiApiKey,           setGeminiApiKey]          = useState(settings?.gemini_api_key || '');
    const [openaiApiKey,           setOpenaiApiKey]          = useState(settings?.openai_api_key || '');
    const [features,               setFeatures]              = useState(settings?.features || {});
    const [vendorPlans,            setVendorPlans]           = useState(settings?.vendor_plans || []);

    // ── Phase-2 settings ───────────────────────────────────────
    const [currency,         setCurrency]         = useState(settings?.currency || 'NGN');
    const [commissionRate,   setCommissionRate]   = useState(settings?.commission_rate?.toString() || '5');
    const [minOrderAmount,   setMinOrderAmount]   = useState(settings?.min_order_amount?.toString() || '500');
    const [freeShippingMin,  setFreeShippingMin]  = useState(settings?.free_shipping_min?.toString() || '5000');
    const [notifOnOrder,     setNotifOnOrder]     = useState(settings?.notif_on_order !== false);
    const [notifOnVendor,    setNotifOnVendor]    = useState(settings?.notif_on_vendor !== false);
    const [notifOnReview,    setNotifOnReview]    = useState(settings?.notif_on_review !== false);
    const [allowGuestBrowse, setAllowGuestBrowse] = useState(settings?.allow_guest_browse !== false);

    // ── NEW Phase-3 settings ────────────────────────────────────
    const [supportEmail,     setSupportEmail]     = useState(settings?.support_email || '');
    const [supportPhone,     setSupportPhone]     = useState(settings?.support_phone || '');
    const [whatsappNumber,   setWhatsappNumber]   = useState(settings?.whatsapp_number || '');
    const [instagramHandle,  setInstagramHandle]  = useState(settings?.instagram_handle || '');
    const [twitterHandle,    setTwitterHandle]    = useState(settings?.twitter_handle || '');
    const [facebookUrl,      setFacebookUrl]      = useState(settings?.facebook_url || '');
    const [tiktokHandle,     setTiktokHandle]     = useState(settings?.tiktok_handle || '');
    const [enableCoupons,    setEnableCoupons]    = useState(settings?.enable_coupons !== false);
    const [maxDiscountPct,   setMaxDiscountPct]   = useState(settings?.max_discount_pct?.toString() || '30');
    const [returnWindowDays, setReturnWindowDays] = useState(settings?.return_window_days?.toString() || '7');
    const [enableReturns,    setEnableReturns]    = useState(settings?.enable_returns !== false);
    const [enableReviews,    setEnableReviews]    = useState(settings?.enable_reviews !== false);
    const [enableRatings,    setEnableRatings]    = useState(settings?.enable_ratings !== false);
    const [enableLiveChat,   setEnableLiveChat]   = useState(settings?.enable_live_chat || false);
    const [enableWaitlist,   setEnableWaitlist]   = useState(settings?.enable_waitlist || false);
    const [appStoreUrl,      setAppStoreUrl]      = useState(settings?.app_store_url || '');
    const [playStoreUrl,     setPlayStoreUrl]     = useState(settings?.play_store_url || '');
    const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState(settings?.privacy_policy_url || '');
    const [termsUrl,         setTermsUrl]         = useState(settings?.terms_url || '');

    // ── Phase-5: Shipping & Tax ───────────────────────────
    const [shippingFees,          setShippingFees]          = useState({ ...DEFAULT_SHIPPING_FEES, ...(settings?.shipping_fees || {}) });
    const [taxEnabled,            setTaxEnabled]            = useState(settings?.tax_enabled !== false);
    const [taxRate,               setTaxRate]               = useState(settings?.tax_rate?.toString() || '7.5');
    const [freeNationwideShipping,setFreeNationwideShipping]= useState(settings?.free_nationwide_shipping || false);
    const [defaultShippingFee,    setDefaultShippingFee]    = useState(settings?.default_shipping_fee?.toString() || '3000');

    // -- Phase-4 Advanced settings --
    const [adminName,          setAdminName]          = useState(settings?.admin_name || '');
    const [adminTitle,         setAdminTitle]         = useState(settings?.admin_title || 'Platform Administrator');
    const [announcementText,   setAnnouncementText]   = useState(settings?.announcement_text || '');
    const [announcementActive, setAnnouncementActive] = useState(settings?.announcement_active || false);
    const [announcementColor,  setAnnouncementColor]  = useState(settings?.announcement_color || '#3B82F6');
    const [platformLocale,     setPlatformLocale]     = useState(settings?.platform_locale || 'en');
    const [seoTitle,           setSeoTitle]           = useState(settings?.seo_title || '');
    const [seoDescription,     setSeoDescription]     = useState(settings?.seo_description || '');
    const [seoKeywords,        setSeoKeywords]        = useState(settings?.seo_keywords || '');
    const [enableWatermark,    setEnableWatermark]    = useState(settings?.enable_watermark || false);
    const [watermarkText,      setWatermarkText]      = useState(settings?.watermark_text || '');
    const [orderLabelPending,  setOrderLabelPending]  = useState(settings?.order_label_pending  || 'Pending');
    const [orderLabelShipped,  setOrderLabelShipped]  = useState(settings?.order_label_shipped  || 'Shipped');
    const [orderLabelDelivered,setOrderLabelDelivered]= useState(settings?.order_label_delivered|| 'Delivered');
    const [orderLabelCancelled,setOrderLabelCancelled]= useState(settings?.order_label_cancelled|| 'Cancelled');
    const [enableAffiliate,    setEnableAffiliate]    = useState(settings?.enable_affiliate     || false);
    const [affiliateRate,      setAffiliateRate]      = useState(settings?.affiliate_rate?.toString() || '5');
    const [maxProductImages,   setMaxProductImages]   = useState(settings?.max_product_images?.toString() || '6');
    const [vendorAutoApprove,  setVendorAutoApprove]  = useState(settings?.vendor_auto_approve  || false);

    const [uploadingLogo,          setUploadingLogo]         = useState(false);
    const [uploadingCertLogo,      setUploadingCertLogo]     = useState(false);
    const [uploadingCertBadge,     setUploadingCertBadge]    = useState(false);
    const [uploadingCertSignature, setUploadingCertSignature]= useState(false);

    const selectedCurrency = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];

    // ── Health score ───────────────────────────────────────────
    const healthScore = useMemo(() => {
        let s = 0;
        if (appName)            s += 10;
        if (logoUrl)            s += 10;
        if (paystackPublicKey)  s += 15;
        if (paystackSecretKey)  s += 15;
        if (geminiApiKey)       s += 10;
        if (premblyAppId)       s += 10;
        if (supportEmail)       s += 10;
        if (supportPhone)       s += 10;
        if (privacyPolicyUrl)   s += 5;
        if (termsUrl)           s += 5;
        return Math.min(s, 100);
    }, [appName, logoUrl, paystackPublicKey, paystackSecretKey, geminiApiKey, premblyAppId, supportEmail, supportPhone, privacyPolicyUrl, termsUrl]);

    const healthColor = healthScore >= 70 ? '#10B981' : healthScore >= 40 ? '#F59E0B' : '#EF4444';
    const healthLabel = healthScore >= 70 ? 'Fully Configured' : healthScore >= 40 ? 'Partially Set Up' : 'Needs Attention';

    // Mark unsaved on any change
    const markChanged = (setter) => (val) => { setter(val); setUnsaved(true); };

    // Tab animation
    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: CATEGORIES.findIndex(c => c.id === activeTab) * TAB_W,
            useNativeDriver: false, tension: 68, friction: 12,
        }).start();
    }, [activeTab]);

    const handleSave = async () => {
        setLoading(true);
        Animated.sequence([
            Animated.spring(deployPulse, { toValue: 0.92, useNativeDriver: true }),
            Animated.spring(deployPulse, { toValue: 1,    useNativeDriver: true }),
        ]).start();

        const { error } = await updateSettings({
            app_name: appName, logo_url: logoUrl,
            cert_logo_url: certLogoUrl, cert_badge_url: certBadgeUrl, cert_signature_url: certSignatureUrl,
            primary_color: primaryColor, secondary_color: secondaryColor,
            default_shipping_address: defaultShippingAddress,
            payment_methods: paymentMethods,
            paystack_public_key: paystackPublicKey, paystack_secret_key: paystackSecretKey,
            prembly_app_id: premblyAppId, prembly_secret_key: premblySecretKey,
            gemini_api_key: geminiApiKey, openai_api_key: openaiApiKey,
            features, vendor_plans: vendorPlans,
            currency, commission_rate: parseFloat(commissionRate) || 5,
            min_order_amount: parseFloat(minOrderAmount) || 500,
            free_shipping_min: parseFloat(freeShippingMin) || 5000,
            notif_on_order: notifOnOrder, notif_on_vendor: notifOnVendor, notif_on_review: notifOnReview,
            allow_guest_browse: allowGuestBrowse,
            support_email: supportEmail, support_phone: supportPhone, whatsapp_number: whatsappNumber,
            instagram_handle: instagramHandle, twitter_handle: twitterHandle,
            facebook_url: facebookUrl, tiktok_handle: tiktokHandle,
            enable_coupons: enableCoupons, max_discount_pct: parseFloat(maxDiscountPct) || 30,
            enable_returns: enableReturns, return_window_days: parseInt(returnWindowDays) || 7,
            enable_reviews: enableReviews, enable_ratings: enableRatings,
            enable_live_chat: enableLiveChat, enable_waitlist: enableWaitlist,
            app_store_url: appStoreUrl, play_store_url: playStoreUrl,
            privacy_policy_url: privacyPolicyUrl, terms_url: termsUrl,
            // Phase-4
            admin_name: adminName, admin_title: adminTitle,
            announcement_text: announcementText, announcement_active: announcementActive, announcement_color: announcementColor,
            platform_locale: platformLocale,
            seo_title: seoTitle, seo_description: seoDescription, seo_keywords: seoKeywords,
            enable_watermark: enableWatermark, watermark_text: watermarkText,
            order_label_pending: orderLabelPending, order_label_shipped: orderLabelShipped,
            order_label_delivered: orderLabelDelivered, order_label_cancelled: orderLabelCancelled,
            enable_affiliate: enableAffiliate, affiliate_rate: parseFloat(affiliateRate) || 5,
            max_product_images: parseInt(maxProductImages) || 6,
            vendor_auto_approve: vendorAutoApprove,
            // Phase-5 Shipping & Tax
            shipping_fees: shippingFees,
            tax_enabled: taxEnabled,
            tax_rate: parseFloat(taxRate) || 7.5,
            free_nationwide_shipping: freeNationwideShipping,
            default_shipping_fee: parseFloat(defaultShippingFee) || 3000,
        });

        setLoading(false);
        if (error) Alert.alert('Sync Failed ❌', 'Could not push changes. Check connectivity.');
        else {
            setUnsaved(false);
            Alert.alert('Deployed! ✅', 'All configurations are now live across the platform.');
            if (refreshSettings) refreshSettings();
        }
    };

    const handleExportSettings = () => {
        const exportData = JSON.stringify({
            app_name: appName, primary_color: primaryColor, secondary_color: secondaryColor,
            currency, commission_rate: commissionRate, min_order_amount: minOrderAmount,
            free_shipping_min: freeShippingMin, support_email: supportEmail,
            support_phone: supportPhone, enable_coupons: enableCoupons,
            max_discount_pct: maxDiscountPct, enable_returns: enableReturns,
            return_window_days: returnWindowDays,
        }, null, 2);
        Clipboard.setString(exportData);
        Alert.alert('Copied! 📋', 'Settings snapshot copied to clipboard. Paste it somewhere safe to back up your config.');
    };

    const handlePickImage = async (type) => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
            if (!result.canceled && result.assets?.length > 0) {
                const asset = result.assets[0];
                if (type === 'logo') setUploadingLogo(true);
                else if (type === 'cert_logo') setUploadingCertLogo(true);
                else if (type === 'cert_badge') setUploadingCertBadge(true);
                else if (type === 'cert_signature') setUploadingCertSignature(true);
                try {
                    const url = await UploadService.uploadFile(asset, 'app-assets', 'logos');
                    if (type === 'logo') { setLogoUrl(url); setUnsaved(true); }
                    else if (type === 'cert_logo') { setCertLogoUrl(url); setUnsaved(true); }
                    else if (type === 'cert_badge') { setCertBadgeUrl(url); setUnsaved(true); }
                    else if (type === 'cert_signature') { setCertSignatureUrl(url); setUnsaved(true); }
                    Alert.alert('Staged ✅', 'Hit Deploy to publish changes.');
                } catch { Alert.alert('Upload Failed', 'Storage rejected — check permissions.'); }
                finally { setUploadingLogo(false); setUploadingCertLogo(false); setUploadingCertBadge(false); setUploadingCertSignature(false); }
            }
        } catch (e) { console.log('Pick error:', e); }
    };

    const togglePaymentMethod = m => { setPaymentMethods(p => ({ ...p, [m]: !(p[m] !== false) })); setUnsaved(true); };
    const toggleFeature = f => { setFeatures(p => ({ ...p, [f]: !p[f] })); setUnsaved(true); };
    const updateVendorPlan = (i, field, val) => {
        const np = [...vendorPlans];
        np[i][field] = field === 'price' ? parseInt(val) || 0 : val;
        setVendorPlans(np); setUnsaved(true);
    };

    // ── Inner shared components ────────────────────────────────
    const Sect = ({ title, subtitle, icon, children }) => (
        <View style={{ marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 8 }}>
                {icon && <Ionicons name={icon} size={16} color={T.muted} />}
                <View>
                    <Text style={[S.sTitle, { color: T.text }]}>{title}</Text>
                    {subtitle && <Text style={[S.sSub, { color: T.muted }]}>{subtitle}</Text>}
                </View>
            </View>
            {children}
        </View>
    );

    const Card = ({ children, style }) => (
        <View style={[S.card, { backgroundColor: T.card, borderColor: T.border }, style]}>{children}</View>
    );

    const Inp = ({ label, value, onChange, placeholder, secure, icon, color = '#64748B', keyboard = 'default', multi, hint }) => (
        <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 }}>
                {icon && <Ionicons name={icon} size={12} color={color} />}
                <Text style={[S.iLabel, { color: T.muted }]}>{label}</Text>
            </View>
            <TextInput
                style={[S.iInput, { backgroundColor: T.surface, borderColor: T.border, color: T.text }, multi && { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                value={value} onChangeText={v => { onChange(v); setUnsaved(true); }}
                placeholder={placeholder} placeholderTextColor={T.muted}
                secureTextEntry={secure} keyboardType={keyboard} multiline={multi}
            />
            {hint && <Text style={[S.hint, { color: T.muted }]}>{hint}</Text>}
        </View>
    );

    const Tog = ({ label, desc, value, onToggle, color = '#3B82F6', icon }) => (
        <TouchableOpacity activeOpacity={0.7} onPress={onToggle} style={[S.togRow, { borderColor: T.border }]}>
            <View style={[S.togIcon, { backgroundColor: color + '18' }]}>
                <Ionicons name={icon} size={18} color={color} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[S.togLabel, { color: T.text }]}>{label}</Text>
                {desc && <Text style={[S.togDesc, { color: T.muted }]}>{desc}</Text>}
            </View>
            <Switch value={!!value} onValueChange={v => { onToggle(v); setUnsaved(true); }}
                trackColor={{ false: T.border, true: color }} thumbColor="white" />
        </TouchableOpacity>
    );

    const SocialInput = ({ label, icon, color, value, onChange, placeholder }) => (
        <View style={[S.socialRow, { backgroundColor: T.surface, borderColor: T.border }]}>
            <View style={[S.socialIcon, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={18} color={color} />
            </View>
            <TextInput
                style={[S.socialInput, { color: T.text }]}
                value={value} onChangeText={v => { onChange(v); setUnsaved(true); }}
                placeholder={placeholder} placeholderTextColor={T.muted}
                autoCapitalize="none"
            />
        </View>
    );

    // ── Tab Renderers ──────────────────────────────────────────
    const renderBranding = () => (
        <View style={S.section}>
            <Sect title="Identity & Logo" icon="image">
                <Card>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                        <TouchableOpacity onPress={() => handlePickImage('logo')} style={S.logoPicker}>
                            {logoUrl ? <Image source={{ uri: logoUrl }} style={S.fullImg} /> : <Ionicons name="image" size={30} color={T.muted} />}
                            {uploadingLogo && <ActivityIndicator style={S.imgLoader} color="white" />}
                            <View style={S.editBadge}><Ionicons name="camera" size={11} color="white" /></View>
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 16 }}>
                            <Text style={[S.cardTitle, { color: T.text }]}>App Logo</Text>
                            <Text style={[S.cardSub, { color: T.muted }]}>Header, splash & auth screens</Text>
                        </View>
                    </View>
                    <Inp label="Marketplace Name" value={appName} onChange={v => { setAppName(v); setUnsaved(true); }} icon="business" placeholder="e.g. Abu Mafhal" />
                    <Inp label="Fallback Shipping Address" value={defaultShippingAddress} onChange={v => { setDefaultShippingAddress(v); setUnsaved(true); }} icon="location" placeholder="HQ address" multi />
                </Card>
            </Sect>

            <Sect title="Brand Colors" icon="color-fill">
                <Card>
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                        {QUICK_COLORS.map(c => (
                            <TouchableOpacity key={c} onPress={() => { setPrimaryColor(c); setUnsaved(true); }}
                                style={[S.swatch, { backgroundColor: c, borderWidth: primaryColor === c ? 3 : 0, borderColor: '#60A5FA' }]} />
                        ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <View style={[S.colorDot, { backgroundColor: primaryColor }]} />
                                <Text style={[S.iLabel, { color: T.muted }]}>PRIMARY</Text>
                            </View>
                            <TextInput style={[S.iInput, { backgroundColor: T.surface, borderColor: T.border, color: T.text }]}
                                value={primaryColor} onChangeText={v => { setPrimaryColor(v); setUnsaved(true); }} placeholder="#0F172A" placeholderTextColor={T.muted} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <View style={[S.colorDot, { backgroundColor: secondaryColor }]} />
                                <Text style={[S.iLabel, { color: T.muted }]}>ACCENT</Text>
                            </View>
                            <TextInput style={[S.iInput, { backgroundColor: T.surface, borderColor: T.border, color: T.text }]}
                                value={secondaryColor} onChangeText={v => { setSecondaryColor(v); setUnsaved(true); }} placeholder="#3B82F6" placeholderTextColor={T.muted} />
                        </View>
                    </View>
                </Card>
            </Sect>

            <Sect title="Certificate Authority" icon="document-text">
                <Card>
                    <Text style={[S.cardSub, { color: T.muted, marginBottom: 14 }]}>Branding for vendor certificates & seals</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {[{ type: 'cert_logo', label: 'Logo', icon: 'document-text', url: certLogoUrl, uploading: uploadingCertLogo },
                          { type: 'cert_badge', label: 'Badge', icon: 'ribbon', url: certBadgeUrl, uploading: uploadingCertBadge }].map(item => (
                            <TouchableOpacity key={item.type} onPress={() => handlePickImage(item.type)} style={[S.certBox, { borderColor: T.border, backgroundColor: T.surface }]}>
                                {item.url ? <Image source={{ uri: item.url }} style={S.fullImg} /> : <Ionicons name={item.icon} size={22} color={T.muted} />}
                                {item.uploading && <ActivityIndicator style={S.imgLoader} color="#3B82F6" />}
                                <Text style={[S.certLabel, { color: T.muted }]}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity onPress={() => handlePickImage('cert_signature')} style={[S.certBox, { width: '100%', height: 60, borderColor: T.border, backgroundColor: T.surface }]}>
                            {certSignatureUrl ? <Image source={{ uri: certSignatureUrl }} style={S.fullImg} /> : <Ionicons name="pencil" size={22} color={T.muted} />}
                            {uploadingCertSignature && <ActivityIndicator style={S.imgLoader} color="#3B82F6" />}
                            <Text style={[S.certLabel, { color: T.muted }]}>Authority Signature</Text>
                        </TouchableOpacity>
                    </View>
                </Card>
            </Sect>

            <Sect title="App Store Links" icon="phone-portrait">
                <Card>
                    <Inp label="App Store URL (iOS)" value={appStoreUrl} onChange={v => { setAppStoreUrl(v); setUnsaved(true); }} icon="logo-apple" placeholder="https://apps.apple.com/..." color="#555" keyboard="url" />
                    <Inp label="Google Play URL (Android)" value={playStoreUrl} onChange={v => { setPlayStoreUrl(v); setUnsaved(true); }} icon="logo-google-playstore" placeholder="https://play.google.com/..." color="#10B981" keyboard="url" />
                </Card>
            </Sect>
        </View>
    );

    const renderFinancial = () => (
        <View style={S.section}>
            <Sect title="Commerce Engine" icon="trending-up">
                <Card>
                    <TouchableOpacity onPress={() => setShowCurrencyModal(true)}
                        style={[S.currRow, { backgroundColor: T.surface, borderColor: T.border }]}>
                        <View>
                            <Text style={[S.iLabel, { color: T.muted }]}>PLATFORM CURRENCY</Text>
                            <Text style={[S.currValue, { color: T.text }]}>{selectedCurrency.symbol} — {selectedCurrency.code} · {selectedCurrency.name}</Text>
                        </View>
                        <Ionicons name="chevron-down" size={16} color={T.muted} />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <Inp label="Commission (%)" value={commissionRate} onChange={v => { setCommissionRate(v); setUnsaved(true); }} icon="pie-chart" keyboard="numeric" placeholder="5" color="#10B981" hint="% of each sale" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Inp label={`Min Order (${selectedCurrency.symbol})`} value={minOrderAmount} onChange={v => { setMinOrderAmount(v); setUnsaved(true); }} icon="cart" keyboard="numeric" placeholder="500" color="#F59E0B" />
                        </View>
                    </View>
                    <Inp label={`Free Shipping From (${selectedCurrency.symbol})`} value={freeShippingMin} onChange={v => { setFreeShippingMin(v); setUnsaved(true); }} icon="bicycle" keyboard="numeric" placeholder="5000" color="#3B82F6" hint="Orders above this amount get free delivery" />
                </Card>
            </Sect>

            <Sect title="Coupons & Discounts" icon="pricetag">
                <Card>
                    <Tog label="Enable Coupon Codes" desc="Allow customers to use promo codes at checkout" icon="pricetag" value={enableCoupons} onToggle={() => { setEnableCoupons(p => !p); setUnsaved(true); }} color="#8B5CF6" />
                    {enableCoupons && (
                        <View style={{ marginTop: 8 }}>
                            <Inp label="Max Discount Allowed (%)" value={maxDiscountPct} onChange={v => { setMaxDiscountPct(v); setUnsaved(true); }} icon="percent" keyboard="numeric" placeholder="30" color="#8B5CF6" hint="Cap on any single coupon's discount" />
                        </View>
                    )}
                </Card>
            </Sect>

            <Sect title="Returns & Refunds" icon="return-up-back">
                <Card>
                    <Tog label="Enable Product Returns" desc="Allow buyers to request return within a set window" icon="return-up-back" value={enableReturns} onToggle={() => { setEnableReturns(p => !p); setUnsaved(true); }} color="#EF4444" />
                    {enableReturns && (
                        <View style={{ marginTop: 8 }}>
                            <Inp label="Return Window (Days)" value={returnWindowDays} onChange={v => { setReturnWindowDays(v); setUnsaved(true); }} icon="time" keyboard="numeric" placeholder="7" color="#EF4444" hint="How many days after delivery can buyers return?" />
                        </View>
                    )}
                </Card>
            </Sect>

            <Sect title="Payment Gateways" icon="card">
                <Card>
                    <Tog label="Paystack" desc="Naira card & bank transfers" icon="card" value={paymentMethods.paystack !== false} onToggle={() => togglePaymentMethod('paystack')} color="#3B82F6" />
                    <Tog label="Coinbase Commerce" desc="Crypto payments (BTC, ETH, USDC)" icon="logo-bitcoin" value={paymentMethods.crypto !== false} onToggle={() => togglePaymentMethod('crypto')} color="#F59E0B" />
                    <Tog label="Customer Wallet" desc="Allow buyers to pay using their platform wallet balance" icon="wallet" value={paymentMethods.wallet !== false} onToggle={() => togglePaymentMethod('wallet')} color="#10B981" />
                    <Tog label="Flutterwave" desc="Pan-African multi-currency gateway" icon="flash" value={paymentMethods.flutterwave !== false} onToggle={() => togglePaymentMethod('flutterwave')} color="#DB2777" />
                </Card>
            </Sect>

            <Sect title="Paystack API Credentials" icon="key">
                <Card>
                    <Inp label="Public Key" value={paystackPublicKey} onChange={v => { setPaystackPublicKey(v); setUnsaved(true); }} icon="key" secure placeholder="pk_..." color="#3B82F6" />
                    <Inp label="Secret Key" value={paystackSecretKey} onChange={v => { setPaystackSecretKey(v); setUnsaved(true); }} icon="lock-closed" secure placeholder="sk_..." color="#EF4444" />
                </Card>
            </Sect>

            {/* ━━ SHIPPING & DELIVERY ━━ */}
            <Sect title="Shipping & Delivery Fees" icon="bicycle">
                <Card>
                    <Tog label="Free Nationwide Shipping"
                        desc="Override all fees — Nigeria ships free"
                        icon="airplane" value={freeNationwideShipping}
                        onToggle={() => {
                            const next = !freeNationwideShipping;
                            setFreeNationwideShipping(next);
                            setShippingFees(next
                                ? NIGERIA_STATES.reduce((a, s) => ({ ...a, [s]: 0 }), {})
                                : { ...DEFAULT_SHIPPING_FEES, ...(settings?.shipping_fees || {}) }
                            );
                            setUnsaved(true);
                        }} color="#10B981" />
                    <Inp label={`Default Fallback Fee (${selectedCurrency.symbol})`}
                        value={defaultShippingFee}
                        onChange={v => { setDefaultShippingFee(v); setUnsaved(true); }}
                        icon="globe" keyboard="numeric" placeholder="3000"
                        hint="Applied when buyer's state is not in the list" color="#3B82F6" />
                </Card>
                <Card>
                    <Text style={[S.iLabel, { color: T.muted, marginBottom: 14 }]}>PER-STATE FEES ({selectedCurrency.symbol})</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {NIGERIA_STATES.map(state => (
                            <View key={state} style={[S.stateCell, { backgroundColor: T.surface, borderColor: T.border }]}>
                                <Text style={[S.stateName, { color: T.muted }]} numberOfLines={1}>{state}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ color: T.muted, fontSize: 11, marginRight: 2 }}>{selectedCurrency.symbol}</Text>
                                    <TextInput
                                        style={[S.stateFeeInput, { color: T.text, borderColor: T.border }]}
                                        value={(shippingFees[state] ?? 0).toString()}
                                        onChangeText={v => { setShippingFees(p => ({ ...p, [state]: parseInt(v) || 0 })); setUnsaved(true); }}
                                        keyboardType="numeric" placeholder="0" placeholderTextColor={T.muted}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                </Card>
            </Sect>

            {/* ━━ TAX & VAT ━━ */}
            <Sect title="Tax & VAT Control" icon="receipt">
                <Card>
                    <Tog label="Enable Tax / VAT" desc="Display tax row in the checkout invoice" icon="receipt"
                        value={taxEnabled} onToggle={() => { setTaxEnabled(p => !p); setUnsaved(true); }} color="#8B5CF6" />
                    {taxEnabled && (
                        <View style={{ marginTop: 10 }}>
                            <Inp label="Tax / VAT Rate (%)" value={taxRate}
                                onChange={v => { setTaxRate(v); setUnsaved(true); }}
                                icon="percent" keyboard="numeric" placeholder="7.5"
                                color="#8B5CF6" hint="Applied to item subtotal at checkout" />
                        </View>
                    )}
                </Card>
            </Sect>
        </View>
    );

    const renderSecurity = () => (
        <View style={S.section}>
            <Sect title="AI Intelligence APIs" icon="sparkles">
                <Card>
                    <Inp label="Gemini Ultra Key"  value={geminiApiKey}  onChange={v => { setGeminiApiKey(v); setUnsaved(true); }}  icon="sparkles"  secure placeholder="AIza..." color="#8B5CF6" />
                    <Inp label="OpenAI GPT Key"    value={openaiApiKey}  onChange={v => { setOpenaiApiKey(v); setUnsaved(true); }}  icon="brain"     secure placeholder="sk-..."  color="#10B981" />
                </Card>
            </Sect>

            <Sect title="Identity Verification — Prembly" icon="finger-print">
                <Card>
                    <Inp label="App ID"     value={premblyAppId}    onChange={v => { setPremblyAppId(v); setUnsaved(true); }}    icon="finger-print"    secure placeholder="Prembly App ID" color="#0EA5E9" />
                    <Inp label="Secret Key" value={premblySecretKey} onChange={v => { setPremblySecretKey(v); setUnsaved(true); }} icon="shield-checkmark" secure placeholder="Live Secret..."  color="#EF4444" />
                    <View style={[S.infoBox, { backgroundColor: darkMode ? '#1E3A5F' : '#EFF6FF' }]}>
                        <Ionicons name="information-circle" size={15} color="#3B82F6" />
                        <Text style={{ fontSize: 12, color: darkMode ? '#93C5FD' : '#1E40AF', flex: 1 }}>Enables TIN, CAC, NIN & BVN verification at vendor onboarding.</Text>
                    </View>
                </Card>
            </Sect>

            <Sect title="Legal Pages" icon="document-text">
                <Card>
                    <Inp label="Privacy Policy URL" value={privacyPolicyUrl} onChange={v => { setPrivacyPolicyUrl(v); setUnsaved(true); }} icon="shield" placeholder="https://..." color="#64748B" keyboard="url" />
                    <Inp label="Terms of Service URL" value={termsUrl} onChange={v => { setTermsUrl(v); setUnsaved(true); }} icon="document" placeholder="https://..." color="#64748B" keyboard="url" />
                </Card>
            </Sect>

            {/* Settings Backup */}
            <Sect title="Config Snapshot" icon="save">
                <TouchableOpacity onPress={handleExportSettings} style={[S.exportBtn, { backgroundColor: T.surface, borderColor: T.border }]}>
                    <Ionicons name="clipboard-outline" size={22} color="#3B82F6" />
                    <View style={{ flex: 1 }}>
                        <Text style={[S.cardTitle, { color: T.text }]}>Export to Clipboard</Text>
                        <Text style={[S.cardSub, { color: T.muted }]}>Copy all non-secret settings as JSON backup</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={T.muted} />
                </TouchableOpacity>
            </Sect>
        </View>
    );

    const renderVendors = () => (
        <View style={S.section}>
            <Sect title="Subscription Plans" icon="ribbon">
                {vendorPlans.map((plan, idx) => (
                    <Card key={plan.id}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={[S.planBadge, { backgroundColor: plan.is_active !== false ? '#D1FAE5' : '#FEE2E2' }]}>
                                    <Ionicons name="ribbon" size={19} color={plan.is_active !== false ? '#10B981' : '#EF4444'} />
                                </View>
                                <View>
                                    <Text style={[S.togLabel, { color: T.text }]}>{plan.label}</Text>
                                    <Text style={[S.togDesc, { color: T.muted }]}>ID: {plan.id}</Text>
                                </View>
                            </View>
                            <Switch value={plan.is_active !== false}
                                onValueChange={val => updateVendorPlan(idx, 'is_active', val)}
                                trackColor={{ false: T.border, true: '#10B981' }} thumbColor="white" />
                        </View>
                        {plan.is_active !== false && (
                            <View style={{ marginTop: 14 }}>
                                <Inp label={`Price (${selectedCurrency.symbol})`} value={plan.price.toString()}
                                    onChange={val => updateVendorPlan(idx, 'price', val)} icon="cash" keyboard="numeric" hint="Set 0 for unlimited free trial" />
                            </View>
                        )}
                    </Card>
                ))}
            </Sect>
        </View>
    );

    const renderContact = () => (
        <View style={S.section}>
            <Sect title="Support Channels" icon="headset">
                <Card>
                    <Inp label="Support Email" value={supportEmail} onChange={v => { setSupportEmail(v); setUnsaved(true); }} icon="mail" placeholder="support@abumafhal.com" keyboard="email-address" color="#3B82F6" />
                    <Inp label="Support Phone" value={supportPhone} onChange={v => { setSupportPhone(v); setUnsaved(true); }} icon="call" placeholder="+234 XXX XXXX" keyboard="phone-pad" color="#10B981" />
                    <Inp label="WhatsApp Number" value={whatsappNumber} onChange={v => { setWhatsappNumber(v); setUnsaved(true); }} icon="logo-whatsapp" placeholder="+234 XXX XXXX" keyboard="phone-pad" color="#22C55E" hint="Customers tap to open chat directly" />
                </Card>
            </Sect>

            <Sect title="Social Media Presence" icon="share-social">
                <Card>
                    <SocialInput label="Instagram" icon="logo-instagram" color="#E1306C" value={instagramHandle}  onChange={setInstagramHandle}  placeholder="@abumafhal" />
                    <SocialInput label="Twitter / X" icon="logo-twitter"   color="#1DA1F2" value={twitterHandle}   onChange={setTwitterHandle}   placeholder="@abumafhal" />
                    <SocialInput label="Facebook"   icon="logo-facebook"  color="#1877F2" value={facebookUrl}     onChange={setFacebookUrl}     placeholder="https://facebook.com/..." />
                    <SocialInput label="TikTok"     icon="logo-tiktok"    color="#010101" value={tiktokHandle}   onChange={setTiktokHandle}    placeholder="@abumafhal" />
                </Card>
            </Sect>
        </View>
    );

    const renderFeatures = () => (
        <View style={S.section}>
            <Sect title="Platform Toggles" icon="toggle">
                <Card>
                    <Tog label="Vendor Onboarding"    desc="Allow new vendors to apply"              icon="person-add"    value={features.enable_vendor_registration !== false} onToggle={() => toggleFeature('enable_vendor_registration')} color="#3B82F6" />
                    <Tog label="Guest Browsing"       desc="Non-logged-in users can browse"          icon="eye"           value={allowGuestBrowse} onToggle={() => { setAllowGuestBrowse(p => !p); setUnsaved(true); }} color="#8B5CF6" />
                    <Tog label="Product Reviews"      desc="Buyers can leave product reviews"        icon="star"          value={enableReviews} onToggle={() => { setEnableReviews(p => !p); setUnsaved(true); }} color="#F59E0B" />
                    <Tog label="Star Ratings"         desc="Show star rating on products"            icon="star-half"     value={enableRatings} onToggle={() => { setEnableRatings(p => !p); setUnsaved(true); }} color="#F59E0B" />
                    <Tog label="Live Chat"            desc="Enable in-app live support chat"         icon="chatbubbles"   value={enableLiveChat} onToggle={() => { setEnableLiveChat(p => !p); setUnsaved(true); }} color="#0EA5E9" />
                    <Tog label="Product Waitlist"     desc="Let users join waitlist for sold-out items" icon="hourglass" value={enableWaitlist} onToggle={() => { setEnableWaitlist(p => !p); setUnsaved(true); }} color="#6366F1" />
                </Card>
            </Sect>

            <Sect title="Push Notification Triggers" icon="notifications">
                <Card>
                    <Tog label="New Orders"     desc="Notify admin when a new order is placed"  icon="bag"      value={notifOnOrder}  onToggle={() => { setNotifOnOrder(p => !p);  setUnsaved(true); }} color="#10B981" />
                    <Tog label="Vendor Events"  desc="Notify on vendor apply / approval"        icon="business" value={notifOnVendor} onToggle={() => { setNotifOnVendor(p => !p); setUnsaved(true); }} color="#F59E0B" />
                    <Tog label="New Reviews"    desc="Notify on new product or driver review"   icon="star"     value={notifOnReview} onToggle={() => { setNotifOnReview(p => !p); setUnsaved(true); }} color="#3B82F6" />
                </Card>
            </Sect>

            {/* Danger Zone */}
            <Sect title="⚠️ Danger Zone" icon="warning">
                <View style={[S.dangerCard, { borderColor: '#FCA5A5', backgroundColor: darkMode ? '#2D1515' : '#FFF5F5' }]}>
                    <Tog label="Maintenance Mode" desc="Lock platform from all non-admin users" icon="warning" value={features.maintenance_mode || false} onToggle={() => toggleFeature('maintenance_mode')} color="#EF4444" />
                    <TouchableOpacity style={[S.dangerBtn, { marginTop: 12 }]}
                        onPress={() => Alert.alert('Factory Reset', 'This will erase all settings and cannot be undone. Are you certain?', [{ text: 'Cancel' }, { text: 'Reset', style: 'destructive', onPress: () => Alert.alert('Contact Support', 'Factory reset must be done from Supabase dashboard for safety.') }])}>
                        <Ionicons name="trash" size={16} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>Factory Reset Settings</Text>
                    </TouchableOpacity>
                </View>
            </Sect>
        </View>
    );

    const LOCALES = [
        { code: 'en', label: 'English', flag: '🇬🇧' },
        { code: 'ha', label: 'Hausa',   flag: '🇳🇬' },
        { code: 'yo', label: 'Yoruba',  flag: '🇳🇬' },
        { code: 'ig', label: 'Igbo',    flag: '🇳🇬' },
        { code: 'fr', label: 'French',  flag: '🇫🇷' },
        { code: 'ar', label: 'Arabic',  flag: '🇸🇦' },
    ];

    const BANNER_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#0F172A'];

    const renderAdvanced = () => (
        <View style={S.section}>
            {/* Admin Profile Card */}
            <Sect title="Admin Identity" icon="person-circle">
                <Card>
                    <View style={[S.adminProfileRow, { borderColor: T.border }]}>
                        <View style={[S.adminAvatar, { backgroundColor: activeCat?.color + '20' }]}>
                            <Ionicons name="person" size={28} color="#6366F1" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Inp label="Admin Display Name" value={adminName} onChange={v => { setAdminName(v); setUnsaved(true); }} icon="person" placeholder="Your name" />
                            <Inp label="Admin Title / Role" value={adminTitle} onChange={v => { setAdminTitle(v); setUnsaved(true); }} icon="briefcase" placeholder="Platform Administrator" />
                        </View>
                    </View>
                </Card>
            </Sect>

            {/* Platform Announcement Banner */}
            <Sect title="Announcement Banner" icon="megaphone">
                <Card>
                    <Tog label="Show Banner to All Users" desc="Display a sitewide announcement at top of every page" icon="megaphone" value={announcementActive} onToggle={() => { setAnnouncementActive(p => !p); setUnsaved(true); }} color="#F59E0B" />
                    {announcementActive && (
                        <View style={{ marginTop: 12 }}>
                            <Inp label="Banner Message" value={announcementText} onChange={v => { setAnnouncementText(v); setUnsaved(true); }} icon="text" placeholder="e.g. Free delivery this weekend!" multi hint="Keep it short and impactful" />
                            <Text style={[S.iLabel, { color: T.muted, marginBottom: 10 }]}>BANNER ACCENT COLOR</Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                {BANNER_COLORS.map(c => (
                                    <TouchableOpacity key={c} onPress={() => { setAnnouncementColor(c); setUnsaved(true); }}
                                        style={[S.swatch, { backgroundColor: c, width: 32, height: 32, borderWidth: announcementColor === c ? 3 : 0, borderColor: '#93C5FD' }]} />
                                ))}
                            </View>
                            <View style={[S.bannerPreview, { backgroundColor: announcementColor }]}>
                                <Ionicons name="megaphone" size={14} color="white" />
                                <Text style={{ color: 'white', fontWeight: '700', fontSize: 12, flex: 1, marginLeft: 8 }}>{announcementText || 'Your announcement will appear here...'}</Text>
                            </View>
                        </View>
                    )}
                </Card>
            </Sect>

            {/* Language & Locale */}
            <Sect title="Language & Locale" icon="language">
                <Card>
                    <Text style={[S.iLabel, { color: T.muted, marginBottom: 12 }]}>SELECT PLATFORM LANGUAGE</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {LOCALES.map(loc => (
                            <TouchableOpacity key={loc.code} onPress={() => { setPlatformLocale(loc.code); setUnsaved(true); }}
                                style={[S.localeChip, { borderColor: platformLocale === loc.code ? '#6366F1' : T.border, backgroundColor: platformLocale === loc.code ? '#EEF2FF' : T.surface }]}>
                                <Text style={{ fontSize: 16 }}>{loc.flag}</Text>
                                <Text style={[S.localeLabel, { color: platformLocale === loc.code ? '#4F46E5' : T.text }]}>{loc.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Card>
            </Sect>

            {/* SEO / Meta */}
            <Sect title="SEO & Web Metadata" icon="globe">
                <Card>
                    <Inp label="Page Title (SEO)"       value={seoTitle}       onChange={v => { setSeoTitle(v); setUnsaved(true); }}       icon="text"    placeholder="Abu Mafhal — Nigeria's #1 Marketplace" />
                    <Inp label="Meta Description"        value={seoDescription} onChange={v => { setSeoDescription(v); setUnsaved(true); }} icon="create" placeholder="Discover amazing products..." multi hint="Ideally 150–160 characters" />
                    <Inp label="Meta Keywords (comma-sep)" value={seoKeywords}  onChange={v => { setSeoKeywords(v); setUnsaved(true); }}    icon="pricetags" placeholder="marketplace, fashion, electronics" hint="Helps search engine indexing" />
                </Card>
            </Sect>

            {/* Product Image Watermark */}
            <Sect title="Product Image Watermark" icon="image">
                <Card>
                    <Tog label="Enable Watermark" desc="Overlay a text stamp on all vendor product images" icon="water" value={enableWatermark} onToggle={() => { setEnableWatermark(p => !p); setUnsaved(true); }} color="#0EA5E9" />
                    {enableWatermark && (
                        <View style={{ marginTop: 10 }}>
                            <Inp label="Watermark Text" value={watermarkText} onChange={v => { setWatermarkText(v); setUnsaved(true); }} icon="text" placeholder="© Abu Mafhal" hint="Applied bottom-right corner of uploaded product photos" />
                        </View>
                    )}
                    <Inp label="Max Images per Product Listing" value={maxProductImages} onChange={v => { setMaxProductImages(v); setUnsaved(true); }} icon="images" keyboard="numeric" placeholder="6" hint="Vendors cannot upload more than this number of photos" />
                </Card>
            </Sect>

            {/* Custom Order Status Labels */}
            <Sect title="Order Status Labels" icon="receipt">
                <Card>
                    <Text style={[S.iLabel, { color: T.muted, marginBottom: 12 }]}>CUSTOMIZE WHAT CUSTOMERS SEE</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                        <View style={{ flex: 1 }}>
                            <Inp label="⏳ Pending"   value={orderLabelPending}   onChange={v => { setOrderLabelPending(v);   setUnsaved(true); }} icon="time"          placeholder="Pending" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Inp label="🚚 Shipped"   value={orderLabelShipped}   onChange={v => { setOrderLabelShipped(v);   setUnsaved(true); }} icon="car"           placeholder="Shipped" />
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Inp label="✅ Delivered" value={orderLabelDelivered} onChange={v => { setOrderLabelDelivered(v); setUnsaved(true); }} icon="checkmark-circle" placeholder="Delivered" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Inp label="❌ Cancelled" value={orderLabelCancelled} onChange={v => { setOrderLabelCancelled(v); setUnsaved(true); }} icon="close-circle"    placeholder="Cancelled" />
                        </View>
                    </View>
                </Card>
            </Sect>

            {/* Affiliate / Referral Program */}
            <Sect title="Affiliate & Referral Program" icon="people">
                <Card>
                    <Tog label="Enable Affiliate Program" desc="Registered affiliates earn commission on referred sales" icon="people" value={enableAffiliate} onToggle={() => { setEnableAffiliate(p => !p); setUnsaved(true); }} color="#10B981" />
                    {enableAffiliate && (
                        <View style={{ marginTop: 10 }}>
                            <Inp label="Affiliate Commission Rate (%)" value={affiliateRate} onChange={v => { setAffiliateRate(v); setUnsaved(true); }} icon="percent" keyboard="numeric" placeholder="5" hint="% earned on every sale referral" color="#10B981" />
                        </View>
                    )}
                </Card>
            </Sect>

            {/* Vendor Auto-Approve */}
            <Sect title="Vendor Automation" icon="git-pull-request">
                <Card>
                    <Tog label="Auto-Approve Vendors" desc="Skip manual review — new vendors go live immediately" icon="flash" value={vendorAutoApprove} onToggle={() => { setVendorAutoApprove(p => !p); setUnsaved(true); }} color="#EF4444" />
                    <View style={[S.infoBox, { backgroundColor: darkMode ? '#1C1A00' : '#FFFBEB', marginTop: 8 }]}>
                        <Ionicons name="warning" size={14} color="#D97706" />
                        <Text style={{ fontSize: 12, color: darkMode ? '#FCD34D' : '#92400E', flex: 1 }}>Use with caution — auto-approved vendors bypass compliance checks.</Text>
                    </View>
                </Card>
            </Sect>
        </View>
    );

    const isSearching = searchQuery.length > 0;
    const activeCat = CATEGORIES.find(c => c.id === activeTab) || CATEGORIES[0];

    return (
        <View style={[S.root, { backgroundColor: T.bg }]}>
            <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={T.card} />

            {/* ════ HEADER ════ */}
            <View style={[S.header, { backgroundColor: T.card, borderColor: T.border, paddingTop: insets.top + 8 }]}>

                {/* Row 1: Nav + Title + Actions */}
                <View style={S.hRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[S.iconBtn, { backgroundColor: T.surface }]}>
                        <Ionicons name="chevron-back" size={21} color={T.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                        <Text style={[S.hTitle, { color: T.text }]}>System Config</Text>
                        <Text style={[S.hSub, { color: T.muted }]}>GLOBAL PLATFORM CONTROLS</Text>
                    </View>
                    {/* Dark mode */}
                    <TouchableOpacity onPress={() => setDarkMode(d => !d)} style={[S.iconBtn, { backgroundColor: T.surface, marginRight: 8 }]}>
                        <Ionicons name={darkMode ? 'sunny' : 'moon'} size={17} color={darkMode ? '#F59E0B' : '#8B5CF6'} />
                    </TouchableOpacity>
                    {/* Deploy button */}
                    <Animated.View style={{ transform: [{ scale: deployPulse }] }}>
                        <TouchableOpacity onPress={handleSave} disabled={loading}
                            style={[S.deployBtn, { backgroundColor: unsaved ? activeCat.color : '#64748B' }]}>
                            {loading
                                ? <ActivityIndicator size="small" color="white" />
                                : <><Ionicons name="cloud-upload" size={13} color="white" /><Text style={S.deployTxt}>{unsaved ? 'Deploy' : 'Saved'}</Text></>
                            }
                        </TouchableOpacity>
                    </Animated.View>
                </View>

                {/* Health Bar */}
                <View style={[S.healthWrap, { backgroundColor: T.surface }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={[S.iLabel, { color: T.muted }]}>CONFIGURATION HEALTH</Text>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: healthColor }}>{healthLabel} · {healthScore}%</Text>
                    </View>
                    <View style={[S.healthTrack, { backgroundColor: T.border }]}>
                        <View style={[S.healthFill, { width: `${healthScore}%`, backgroundColor: healthColor }]} />
                    </View>
                </View>

                {/* Search */}
                <View style={[S.searchWrap, { backgroundColor: T.surface, borderColor: T.border }]}>
                    <Ionicons name="search" size={16} color={T.muted} />
                    <TextInput style={[S.searchIp, { color: T.text }]}
                        placeholder="Search any setting…" placeholderTextColor={T.muted}
                        value={searchQuery} onChangeText={setSearchQuery} />
                    {isSearching
                        ? <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={16} color={T.muted} /></TouchableOpacity>
                        : <View style={S.dot} />
                    }
                </View>

                {/* Tabs */}
                {!isSearching && (
                    <View style={S.tabsRow}>
                        {CATEGORIES.map(cat => {
                            const active = activeTab === cat.id;
                            return (
                                <TouchableOpacity key={cat.id} style={S.tab} onPress={() => setActiveTab(cat.id)}>
                                    <Ionicons name={cat.icon} size={16} color={active ? cat.color : T.muted} />
                                    <Text style={[S.tabTxt, { color: active ? cat.color : T.muted, fontWeight: active ? '800' : '600' }]}>{cat.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                        <Animated.View style={[S.indicator, { left: slideAnim, backgroundColor: activeCat.color }]} />
                    </View>
                )}
            </View>

            {/* ════ BODY ════ */}
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                {isSearching ? (
                    <View style={{ padding: 20 }}>
                        <Text style={[S.sTitle, { color: T.text, marginBottom: 4 }]}>Results for "{searchQuery}"</Text>
                        <Text style={[S.sSub, { color: T.muted, marginBottom: 16 }]}>Searching across all system nodes…</Text>
                        {renderBranding()}{renderFinancial()}{renderSecurity()}
                        {renderVendors()}{renderContact()}{renderFeatures()}{renderAdvanced()}
                    </View>
                ) : (
                    <>
                        {activeTab === 'branding'  && renderBranding()}
                        {activeTab === 'financial' && renderFinancial()}
                        {activeTab === 'security'  && renderSecurity()}
                        {activeTab === 'vendors'   && renderVendors()}
                        {activeTab === 'contact'   && renderContact()}
                        {activeTab === 'features'  && renderFeatures()}
                        {activeTab === 'advanced'  && renderAdvanced()}
                    </>
                )}
            </ScrollView>

            {/* ════ CURRENCY MODAL ════ */}
            <Modal visible={showCurrencyModal} transparent animationType="slide" onRequestClose={() => setShowCurrencyModal(false)}>
                <View style={S.modalBg}>
                    <View style={[S.modalSheet, { backgroundColor: T.card }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={[S.sTitle, { color: T.text }]}>Select Currency</Text>
                            <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                                <Ionicons name="close" size={22} color={T.muted} />
                            </TouchableOpacity>
                        </View>
                        <FlatList data={CURRENCIES} keyExtractor={i => i.code}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => { setCurrency(item.code); setUnsaved(true); setShowCurrencyModal(false); }}
                                    style={[S.currItem, { borderColor: T.border, backgroundColor: currency === item.code ? (darkMode ? '#1E3A5F' : '#EFF6FF') : 'transparent' }]}>
                                    <View>
                                        <Text style={[S.currValue, { color: T.text }]}>{item.symbol}  {item.code}</Text>
                                        <Text style={[S.cardSub, { color: T.muted }]}>{item.name}</Text>
                                    </View>
                                    {currency === item.code && <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />}
                                </TouchableOpacity>
                            )} />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// ─── Themes ───────────────────────────────────────────────────
const LIGHT = { bg: '#F1F5F9', card: '#FFFFFF', text: '#0F172A', muted: '#94A3B8', border: '#E2E8F0', surface: '#F8FAFC' };
const DARK  = { bg: '#0B1120', card: '#1E293B', text: '#F1F5F9', muted: '#64748B', border: '#334155', surface: '#0F172A' };

// ─── Styles ────────────────────────────────────────────────────
const S = {
    root:       { flex: 1 },
    header:     { paddingHorizontal: 18, paddingBottom: 0, borderBottomWidth: 1 },
    hRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    hTitle:     { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
    hSub:       { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginTop: 2 },
    iconBtn:    { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    deployBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 11 },
    deployTxt:  { color: 'white', fontWeight: '800', fontSize: 13 },
    healthWrap: { borderRadius: 12, padding: 12, marginBottom: 14 },
    healthTrack:{ height: 5, borderRadius: 3, overflow: 'hidden' },
    healthFill: { height: 5, borderRadius: 3 },
    searchWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 11, paddingHorizontal: 13, height: 40, borderWidth: 1, marginBottom: 14, gap: 9 },
    searchIp:   { flex: 1, fontSize: 14, fontWeight: '600' },
    dot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
    tabsRow:    { flexDirection: 'row', borderTopWidth: 1, borderColor: '#E2E8F0' },
    tab:        { flex: 1, alignItems: 'center', paddingVertical: 11, gap: 2 },
    tabTxt:     { fontSize: 9 },
    indicator:  { position: 'absolute', bottom: 0, width: TAB_W, height: 3, borderRadius: 3 },
    section:    { padding: 18 },
    sTitle:     { fontSize: 15, fontWeight: '900', letterSpacing: -0.3 },
    sSub:       { fontSize: 12, marginTop: 1 },
    card:       { borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
    cardTitle:  { fontSize: 14, fontWeight: '800' },
    cardSub:    { fontSize: 12, lineHeight: 17 },
    iLabel:     { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
    iInput:     { borderRadius: 11, padding: 12, fontSize: 14, fontWeight: '600', borderWidth: 1 },
    hint:       { fontSize: 11, marginTop: 4 },
    togRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
    togIcon:    { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    togLabel:   { fontSize: 14, fontWeight: '800' },
    togDesc:    { fontSize: 12, marginTop: 1 },
    logoPicker: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    fullImg:    { width: '100%', height: '100%', resizeMode: 'cover' },
    imgLoader:  { position: 'absolute', zIndex: 10, backgroundColor: '#00000055', width: '100%', height: '100%', justifyContent: 'center' },
    editBadge:  { position: 'absolute', bottom: 4, right: 4, width: 19, height: 19, borderRadius: 10, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
    certBox:    { width: '48%', height: 78, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
    certLabel:  { fontSize: 9, fontWeight: '800', marginTop: 4, textTransform: 'uppercase' },
    planBadge:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    swatch:     { width: 24, height: 24, borderRadius: 8 },
    colorDot:   { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: '#CBD5E1' },
    currRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 11, padding: 13, borderWidth: 1, marginBottom: 16 },
    currValue:  { fontSize: 14, fontWeight: '700', marginTop: 2 },
    currItem:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 8, borderBottomWidth: 1 },
    socialRow:  { flexDirection: 'row', alignItems: 'center', borderRadius: 11, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
    socialIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
    socialInput:{ flex: 1, fontSize: 14, fontWeight: '600', paddingHorizontal: 12 },
    exportBtn:  { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, borderWidth: 1 },
    infoBox:    { flexDirection: 'row', gap: 9, padding: 12, borderRadius: 11, marginTop: 4 },
    dangerCard: { borderRadius: 18, padding: 16, borderWidth: 1.5 },
    dangerBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#FCA5A5' },
    aiTip:      { flexDirection: 'row', gap: 12, backgroundColor: '#FFFBEB', padding: 14, borderRadius: 13, borderLeftWidth: 4, borderColor: '#F59E0B', marginBottom: 10 },
    aiTitle:    { fontSize: 13, fontWeight: '800', color: '#92400E' },
    aiDesc:     { fontSize: 12, color: '#B45309', marginTop: 3 },
    modalBg:    { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
    modalSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, maxHeight: '65%' },
    // Phase-4 Advanced
    adminProfileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    adminAvatar:     { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    bannerPreview:   { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, marginTop: 14 },
    localeChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
    localeLabel:     { fontSize: 13, fontWeight: '700' },
    // Phase-5 Shipping
    stateCell:       { width: '48%', borderRadius: 12, borderWidth: 1, padding: 10, gap: 4 },
    stateName:       { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
    stateFeeInput:   { flex: 1, fontSize: 14, fontWeight: '700', borderBottomWidth: 1, paddingBottom: 2, minWidth: 60 },
};
