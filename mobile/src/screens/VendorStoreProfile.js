import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    Image, Alert, ActivityIndicator, StyleSheet, Dimensions,
    Platform, KeyboardAvoidingView, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { StoreService } from '../services/storeService';
import { UploadService } from '../services/uploadService';

const { width } = Dimensions.get('window');
const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';
const BORDER = '#E2E8F0';

const CATEGORY_PRESETS = [
    'Official Mall & Flagship Store',
    'Phones & Tablets',
    'Electronics & Gadgets',
    'Fashion & Apparel',
    'Shoes & Footwear',
    'Beauty & Health',
    'Home & Living',
    'Groceries & Food',
    'General Merchant'
];

const WORKING_HOURS_PRESETS = [
    'Mon - Sat: 8:00 AM - 8:00 PM',
    'Mon - Fri: 9:00 AM - 5:00 PM',
    'Open 24/7 (Online Store)',
    'Mon - Sun: 8:00 AM - 10:00 PM'
];

const TABS = [
    { id: 'branding', label: 'Branding', icon: 'color-palette-outline' },
    { id: 'bio', label: 'Bio & Policies', icon: 'document-text-outline' },
    { id: 'contact', label: 'Contact & Shop', icon: 'call-outline' },
    { id: 'social', label: 'Socials', icon: 'share-social-outline' },
    { id: 'preview', label: 'Live Preview', icon: 'eye-outline' }
];

export const VendorStoreProfile = ({ user, vendor, isAdminStore = false, onBack, onSaved }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [activeTab, setActiveTab] = useState('branding');

    // Comprehensive Store Form State
    const [storeName, setStoreName] = useState('');
    const [tagline, setTagline] = useState('');
    const [category, setCategory] = useState('General Merchant');
    const [about, setAbout] = useState('');
    const [coverImage, setCoverImage] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [phone, setPhone] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [workingHours, setWorkingHours] = useState('Mon - Sat: 8:00 AM - 8:00 PM');
    const [policy, setPolicy] = useState('7 Days Nationwide Return Policy • 100% Genuine Guaranteed');
    const [instagram, setInstagram] = useState('');
    const [facebook, setFacebook] = useState('');
    const [twitter, setTwitter] = useState('');
    const [isRecommended, setIsRecommended] = useState(false);

    useEffect(() => {
        loadCurrentStoreData();
    }, [user]);

    const loadCurrentStoreData = async () => {
        try {
            setLoading(true);
            let targetId = user?.id;
            if (!targetId) {
                const { data: authData } = await supabase.auth.getUser();
                targetId = authData?.user?.id;
            }
            if (!targetId) return;

            // 1. Fetch profile & existing store row
            const [profileRes, storeRes] = await Promise.allSettled([
                supabase.from('profiles').select('*').eq('id', targetId).single(),
                supabase.from('stores').select('*').eq('user_id', targetId).maybeSingle()
            ]);

            const profile = profileRes.status === 'fulfilled' ? profileRes.value?.data : null;
            const storeRow = storeRes.status === 'fulfilled' ? storeRes.value?.data : null;

            const localCache = await StoreService.getLocalMetadataCache();
            const local = localCache[targetId] || {};

            let parsedAddr = null;
            if (profile?.address && typeof profile.address === 'string' && profile.address.startsWith('{')) {
                try { parsedAddr = JSON.parse(profile.address); } catch (_) {}
            }

            const initialName = storeRow?.name || profile?.business_name || local.storeName || profile?.full_name || (isAdminStore ? 'Abu Mafhal Official Store' : '');
            setStoreName(initialName);

            setTagline(storeRow?.tagline || parsedAddr?.tagline || local.tagline || (isAdminStore ? 'Official Flagship Mall • 100% Genuine Guaranteed' : 'Verified Merchant Store'));
            setAbout(storeRow?.about || profile?.about || parsedAddr?.about || local.about || (isAdminStore ? 'The official verified flagship store of Abu Mafhal Marketplace. Genuine brand warranty, authentic products, and 100% buyer protection nationwide.' : ''));
            setCoverImage(storeRow?.cover_image || profile?.cover_image || parsedAddr?.cover_image || local.cover_image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop');
            setLogoUrl(storeRow?.logo || profile?.avatar_url || local.logo || '');
            setPhone(storeRow?.phone || profile?.phone || profile?.phone_number || local.phone || '');
            setWhatsapp(storeRow?.whatsapp || parsedAddr?.whatsapp || local.whatsapp || profile?.phone || '');
            setEmail(storeRow?.email || parsedAddr?.email || profile?.email || local.email || '');
            setCategory(storeRow?.category || profile?.business_category || parsedAddr?.category || local.category || (isAdminStore ? 'Official Mall & Flagship Store' : 'General Merchant'));
            setAddress(storeRow?.address || parsedAddr?.address || profile?.address || local.address || 'Main Commercial Center, Gashua, Yobe State, Nigeria');
            setWorkingHours(storeRow?.working_hours || parsedAddr?.working_hours || local.working_hours || 'Mon - Sat: 8:00 AM - 8:00 PM');
            setPolicy(storeRow?.policy || parsedAddr?.policy || local.policy || '7 Days Nationwide Return Policy • 100% Genuine Guaranteed');
            setInstagram(storeRow?.instagram || parsedAddr?.instagram || local.instagram || '');
            setFacebook(storeRow?.facebook || parsedAddr?.facebook || local.facebook || '');
            setTwitter(storeRow?.twitter || parsedAddr?.twitter || local.twitter || '');
            setIsRecommended(storeRow?.is_recommended !== undefined ? !!storeRow.is_recommended : (profile?.is_recommended !== undefined ? !!profile.is_recommended : (local.is_recommended || false)));

        } catch (err) {
            console.error('Error loading store data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePickImage = async (type) => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please allow gallery access to choose a photo.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: type === 'banner' ? [16, 9] : [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setUploadingImage(true);
                try {
                    const uploadedUrl = await UploadService.uploadFile(asset, 'vendor-docs', type === 'banner' ? 'covers' : 'logos');
                    if (type === 'banner') {
                        setCoverImage(uploadedUrl);
                    } else {
                        setLogoUrl(uploadedUrl);
                    }
                    Alert.alert('Success', `${type === 'banner' ? 'Cover Banner' : 'Store Logo'} uploaded successfully!`);
                } catch (uploadErr) {
                    // Use asset URI as optimistic preview
                    if (type === 'banner') setCoverImage(asset.uri);
                    else setLogoUrl(asset.uri);
                    Alert.alert('Photo Selected', 'Photo loaded. Tap "Save Store Profile" below to publish.');
                }
            }
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to pick image.');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSave = async () => {
        if (!storeName.trim()) {
            Alert.alert('Validation Error', 'Please enter your Store / Business Name.');
            setActiveTab('branding');
            return;
        }

        try {
            setSaving(true);
            let targetUserId = user?.id;
            if (!targetUserId) {
                const { data: authData } = await supabase.auth.getUser();
                targetUserId = authData?.user?.id;
            }

            await StoreService.updateStoreProfile({
                userId: targetUserId,
                storeName: storeName.trim(),
                tagline: tagline.trim(),
                about: about.trim(),
                coverImage: coverImage.trim(),
                logoUrl: logoUrl.trim(),
                phone: phone.trim(),
                whatsapp: whatsapp.trim() || phone.trim(),
                email: email.trim(),
                category: category.trim(),
                address: address.trim(),
                workingHours: workingHours.trim(),
                policy: policy.trim(),
                instagram: instagram.trim(),
                facebook: facebook.trim(),
                twitter: twitter.trim(),
                isRecommended: isAdminStore ? true : isRecommended
            });

            Alert.alert(
                'Store Updated Successfully!',
                'Your store identity, cover banner, bio, and contact details have been updated and are live across the marketplace.'
            );
            if (onSaved) onSaved();
        } catch (err) {
            Alert.alert('Save Error', err.message || 'Failed to save store profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={s.centerBox}>
                <ActivityIndicator size="large" color={GOLD} />
                <Text style={s.loadingText}>Loading store studio...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#F8FAFC' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle="light-content" backgroundColor={NAVY} />

            {/* ════ TOP APP BAR ════ */}
            <View style={s.topBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={s.backIconBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                    <View>
                        <Text style={s.topBarTitle}>
                            {isAdminStore ? 'Official Store Studio' : 'Merchant Store Studio'}
                        </Text>
                        <Text style={s.topBarSub}>Customize branding, banner, bio & customer contact</Text>
                    </View>
                </View>

                <View style={[s.modeBadge, isAdminStore ? s.modeBadgeAdmin : s.modeBadgeVendor]}>
                    <Ionicons name={isAdminStore ? 'shield-checkmark' : 'storefront'} size={12} color="#FFFFFF" />
                    <Text style={s.modeBadgeText}>{isAdminStore ? 'OFFICIAL' : 'VENDOR'}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
                
                {/* ════ INTERACTIVE HERO BANNER & FLOATING LOGO ════ */}
                <View style={s.heroContainer}>
                    <View style={s.bannerBox}>
                        <Image
                            source={{ uri: coverImage || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop' }}
                            style={s.bannerImage}
                        />
                        <View style={s.bannerOverlay} />

                        {/* Top banner buttons */}
                        <View style={s.bannerActionsRow}>
                            {(isAdminStore || isRecommended) && (
                                <View style={s.recPill}>
                                    <Ionicons name="star" size={11} color="#FFFFFF" />
                                    <Text style={s.recPillText}>{isAdminStore ? 'OFFICIAL MALL' : 'RECOMMENDED'}</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={s.changeBannerBtn}
                                activeOpacity={0.85}
                                onPress={() => handlePickImage('banner')}
                                disabled={uploadingImage}
                            >
                                <Ionicons name="camera" size={14} color="#FFFFFF" />
                                <Text style={s.changeBannerBtnText}>Change Cover</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Overlapping Store Logo & Info Strip */}
                    <View style={s.heroMetaStrip}>
                        <View style={s.logoContainer}>
                            {logoUrl ? (
                                <Image source={{ uri: logoUrl }} style={s.logoAvatar} />
                            ) : (
                                <View style={[s.logoAvatar, s.logoPlaceholder]}>
                                    <Ionicons name="storefront" size={30} color={NAVY} />
                                </View>
                            )}
                            <TouchableOpacity
                                style={s.logoCameraBadge}
                                activeOpacity={0.85}
                                onPress={() => handlePickImage('logo')}
                                disabled={uploadingImage}
                            >
                                <Ionicons name="camera" size={13} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={s.heroTextCol}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={s.heroStoreName} numberOfLines={1}>
                                    {storeName || 'Enter Store Name'}
                                </Text>
                                <Ionicons name="checkmark-circle" size={17} color="#10B981" />
                            </View>
                            <Text style={s.heroTagline} numberOfLines={1}>
                                {tagline || 'Add a catchy slogan or tagline for buyers'}
                            </Text>
                            <View style={s.heroCategoryPill}>
                                <Text style={s.heroCategoryText}>{category || 'General Merchant'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ════ MOBILE SEGMENTED TABS ════ */}
                <View style={s.tabBarContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                        {TABS.map(tab => {
                            const active = activeTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[s.tabPill, active && s.tabPillActive]}
                                    activeOpacity={0.8}
                                    onPress={() => setActiveTab(tab.id)}
                                >
                                    <Ionicons
                                        name={tab.icon}
                                        size={14}
                                        color={active ? '#FFFFFF' : '#64748B'}
                                    />
                                    <Text style={[s.tabPillText, active && s.tabPillTextActive]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* ════ TAB CONTENT CONTAINER ════ */}
                <View style={s.contentCard}>

                    {/* ── TAB 1: BRANDING ── */}
                    {activeTab === 'branding' && (
                        <View>
                            <View style={s.tabHeaderRow}>
                                <Ionicons name="color-palette" size={18} color={GOLD} />
                                <Text style={s.tabTitle}>Store Identity & Visuals</Text>
                            </View>

                            {/* Store Name */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Store / Business Name *</Text>
                                <View style={s.inputWrapper}>
                                    <Ionicons name="storefront-outline" size={16} color="#94A3B8" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={storeName}
                                        onChangeText={setStoreName}
                                        placeholder="e.g. Abu Mafhal Tech Store"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            {/* Tagline / Slogan */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Tagline / Catchphrase</Text>
                                <View style={s.inputWrapper}>
                                    <Ionicons name="sparkles-outline" size={16} color="#94A3B8" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={tagline}
                                        onChangeText={setTagline}
                                        placeholder="e.g. Premium Gadgets, Genuine Warranty & 24h Delivery"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            {/* Business Category */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Select Category</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                                    {CATEGORY_PRESETS.map((cat) => {
                                        const selected = category === cat;
                                        return (
                                            <TouchableOpacity
                                                key={cat}
                                                onPress={() => setCategory(cat)}
                                                style={[s.presetChip, selected && s.presetChipActive]}
                                            >
                                                <Text style={[s.presetChipText, selected && s.presetChipTextActive]}>{cat}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                                <View style={[s.inputWrapper, { marginTop: 8 }]}>
                                    <Ionicons name="pricetag-outline" size={16} color="#94A3B8" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={category}
                                        onChangeText={setCategory}
                                        placeholder="Or type custom category..."
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            {/* Cover Banner URL */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Cover Banner Photo</Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                                    <TouchableOpacity
                                        style={s.actionBtnSecondary}
                                        onPress={() => handlePickImage('banner')}
                                        disabled={uploadingImage}
                                    >
                                        <Ionicons name="cloud-upload-outline" size={15} color={NAVY} />
                                        <Text style={s.actionBtnSecondaryText}>Upload from Gallery</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={s.inputWrapper}>
                                    <Ionicons name="image-outline" size={16} color="#94A3B8" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={coverImage}
                                        onChangeText={setCoverImage}
                                        placeholder="Or paste image URL (https://...)"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            {/* Store Logo URL */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Store Logo Photo</Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                                    <TouchableOpacity
                                        style={s.actionBtnSecondary}
                                        onPress={() => handlePickImage('logo')}
                                        disabled={uploadingImage}
                                    >
                                        <Ionicons name="image-outline" size={15} color={NAVY} />
                                        <Text style={s.actionBtnSecondaryText}>Upload Logo</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={s.inputWrapper}>
                                    <Ionicons name="link-outline" size={16} color="#94A3B8" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={logoUrl}
                                        onChangeText={setLogoUrl}
                                        placeholder="Or paste logo URL (https://...)"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            {/* Admin Recommended Toggle if applicable */}
                            {!isAdminStore && (
                                <View style={s.recToggleBox}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.recToggleTitle}>⭐ Recommended Store Status</Text>
                                        <Text style={s.recToggleSub}>Flagship visibility across homepage carousels</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[s.togglePill, isRecommended && s.togglePillActive]}
                                        onPress={() => setIsRecommended(!isRecommended)}
                                    >
                                        <Text style={[s.togglePillText, isRecommended && s.togglePillTextActive]}>
                                            {isRecommended ? 'RECOMMENDED' : 'STANDARD'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}

                    {/* ── TAB 2: BIO & POLICIES ── */}
                    {activeTab === 'bio' && (
                        <View>
                            <View style={s.tabHeaderRow}>
                                <Ionicons name="document-text" size={18} color={GOLD} />
                                <Text style={s.tabTitle}>Store Story & Customer Guarantees</Text>
                            </View>

                            {/* About Store */}
                            <View style={s.inputGroup}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={s.label}>About Your Store (Bio & Warranty) *</Text>
                                    <Text style={s.charCount}>{about.length}/600</Text>
                                </View>
                                <TextInput
                                    style={[s.input, s.textArea]}
                                    value={about}
                                    onChangeText={setAbout}
                                    placeholder="Describe your merchant history, products, authenticity guarantees, and delivery coverage..."
                                    placeholderTextColor="#94A3B8"
                                    multiline
                                    numberOfLines={5}
                                    maxLength={600}
                                />
                            </View>

                            {/* Working Hours */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Business / Operating Hours</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                                    {WORKING_HOURS_PRESETS.map((hrs) => {
                                        const selected = workingHours === hrs;
                                        return (
                                            <TouchableOpacity
                                                key={hrs}
                                                onPress={() => setWorkingHours(hrs)}
                                                style={[s.presetChip, selected && s.presetChipActive]}
                                            >
                                                <Text style={[s.presetChipText, selected && s.presetChipTextActive]}>{hrs}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                                <View style={[s.inputWrapper, { marginTop: 8 }]}>
                                    <Ionicons name="time-outline" size={16} color="#94A3B8" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={workingHours}
                                        onChangeText={setWorkingHours}
                                        placeholder="e.g. Mon - Sat: 8:00 AM - 8:00 PM"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            {/* Return & Delivery Policy */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Delivery & Return Policy</Text>
                                <TextInput
                                    style={[s.input, s.textArea, { minHeight: 70 }]}
                                    value={policy}
                                    onChangeText={setPolicy}
                                    placeholder="e.g. Same-day local delivery. 7 days money-back guarantee on all genuine products."
                                    placeholderTextColor="#94A3B8"
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>
                        </View>
                    )}

                    {/* ── TAB 3: CONTACT & LOCATION ── */}
                    {activeTab === 'contact' && (
                        <View>
                            <View style={s.tabHeaderRow}>
                                <Ionicons name="call" size={18} color={GOLD} />
                                <Text style={s.tabTitle}>Contact Details & Location</Text>
                            </View>

                            {/* WhatsApp */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>WhatsApp Business Number (Direct Chat)</Text>
                                <View style={s.inputWrapper}>
                                    <Ionicons name="logo-whatsapp" size={16} color="#10B981" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={whatsapp}
                                        onChangeText={setWhatsapp}
                                        placeholder="e.g. 2349021486162 (with country code)"
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="phone-pad"
                                    />
                                </View>
                            </View>

                            {/* Calling Phone */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Primary Phone Number (Voice Calls)</Text>
                                <View style={s.inputWrapper}>
                                    <Ionicons name="call-outline" size={16} color="#94A3B8" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={phone}
                                        onChangeText={setPhone}
                                        placeholder="e.g. 09021486162 or 2349021486162"
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="phone-pad"
                                    />
                                </View>
                            </View>

                            {/* Business Email */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Support / Business Email</Text>
                                <View style={s.inputWrapper}>
                                    <Ionicons name="mail-outline" size={16} color="#94A3B8" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={email}
                                        onChangeText={setEmail}
                                        placeholder="e.g. store@abumafhal.com"
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            {/* Store Location */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Physical Store Address / Plaza</Text>
                                <View style={s.inputWrapper}>
                                    <Ionicons name="location-outline" size={16} color="#94A3B8" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={address}
                                        onChangeText={setAddress}
                                        placeholder="e.g. Suite 12, Commercial Plaza, Gashua, Yobe State"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ── TAB 4: SOCIAL MEDIA ── */}
                    {activeTab === 'social' && (
                        <View>
                            <View style={s.tabHeaderRow}>
                                <Ionicons name="share-social" size={18} color={GOLD} />
                                <Text style={s.tabTitle}>Social Media Handles</Text>
                            </View>

                            {/* Instagram */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Instagram Username / Handle</Text>
                                <View style={s.inputWrapper}>
                                    <Ionicons name="logo-instagram" size={16} color="#E1306C" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={instagram}
                                        onChangeText={setInstagram}
                                        placeholder="e.g. @abumafhal"
                                        placeholderTextColor="#94A3B8"
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            {/* Facebook */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Facebook Page Name / Link</Text>
                                <View style={s.inputWrapper}>
                                    <Ionicons name="logo-facebook" size={16} color="#1877F2" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={facebook}
                                        onChangeText={setFacebook}
                                        placeholder="e.g. Abu Mafhal Marketplace"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            {/* Twitter / X */}
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Twitter / X Handle</Text>
                                <View style={s.inputWrapper}>
                                    <Ionicons name="logo-twitter" size={16} color="#0EA5E9" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        value={twitter}
                                        onChangeText={setTwitter}
                                        placeholder="e.g. @abumafhal"
                                        placeholderTextColor="#94A3B8"
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ── TAB 5: LIVE CUSTOMER PREVIEW ── */}
                    {activeTab === 'preview' && (
                        <View>
                            <View style={s.tabHeaderRow}>
                                <Ionicons name="eye" size={18} color={GOLD} />
                                <Text style={s.tabTitle}>Buyer Perspective (Live View)</Text>
                            </View>

                            {/* Card Preview */}
                            <View style={s.previewCard}>
                                <View style={s.previewBannerBox}>
                                    <Image
                                        source={{ uri: coverImage || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop' }}
                                        style={s.previewBannerImg}
                                    />
                                    <View style={s.bannerOverlay} />
                                    {(isAdminStore || isRecommended) && (
                                        <View style={s.recPill}>
                                            <Ionicons name="star" size={10} color="#FFFFFF" />
                                            <Text style={s.recPillText}>{isAdminStore ? 'OFFICIAL MALL' : 'RECOMMENDED'}</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={s.previewContent}>
                                    <View style={s.previewLogoRow}>
                                        <View style={s.previewLogoBox}>
                                            {logoUrl ? (
                                                <Image source={{ uri: logoUrl }} style={s.previewLogoImg} />
                                            ) : (
                                                <View style={[s.previewLogoImg, s.logoPlaceholder]}>
                                                    <Ionicons name="storefront" size={24} color={NAVY} />
                                                </View>
                                            )}
                                        </View>
                                        <View style={{ flex: 1, paddingTop: 4 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                <Text style={s.previewName} numberOfLines={1}>{storeName || 'Your Store Name'}</Text>
                                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                            </View>
                                            <Text style={s.previewCategoryTag}>{category || 'General Merchant'}</Text>
                                        </View>
                                    </View>

                                    <Text style={s.previewTaglineText} numberOfLines={1}>
                                        {tagline || 'Reliable vendor with fast dispatch across Nigeria.'}
                                    </Text>

                                    <Text style={s.previewAboutText} numberOfLines={3}>
                                        {about || 'Add an inspiring description of your store, products, and customer protection guarantees.'}
                                    </Text>

                                    {/* Action buttons simulation */}
                                    <View style={s.previewActionRow}>
                                        <View style={s.simBtnWhatsApp}>
                                            <Ionicons name="logo-whatsapp" size={13} color="#FFFFFF" />
                                            <Text style={s.simBtnText}>WhatsApp</Text>
                                        </View>
                                        <View style={s.simBtnCall}>
                                            <Ionicons name="call" size={13} color={NAVY} />
                                            <Text style={[s.simBtnText, { color: NAVY }]}>Call</Text>
                                        </View>
                                        <View style={s.simBtnFollow}>
                                            <Text style={[s.simBtnText, { color: '#FFFFFF' }]}>+ Follow</Text>
                                        </View>
                                    </View>

                                    {/* Location and hours */}
                                    <View style={s.previewMetaGrid}>
                                        <View style={s.metaLine}>
                                            <Ionicons name="location-outline" size={12} color="#64748B" />
                                            <Text style={s.metaLineText} numberOfLines={1}>{address || 'Nigeria'}</Text>
                                        </View>
                                        <View style={s.metaLine}>
                                            <Ionicons name="time-outline" size={12} color="#64748B" />
                                            <Text style={s.metaLineText} numberOfLines={1}>{workingHours || 'Mon - Sat: 8:00 AM - 8:00 PM'}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                </View>

            </ScrollView>

            {/* ════ STICKY BOTTOM SAVE ACTION BAR ════ */}
            <View style={s.bottomBar}>
                <TouchableOpacity
                    style={[s.saveButton, saving && { opacity: 0.75 }]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.88}
                >
                    {saving ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                            <Text style={s.saveButtonText}>Publishing Live Changes...</Text>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="checkmark-done-circle" size={20} color={GOLD} />
                            <Text style={s.saveButtonText}>Save Store Profile & Publish</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

        </KeyboardAvoidingView>
    );
};

const s = StyleSheet.create({
    centerBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    loadingText: {
        marginTop: 12,
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B'
    },
    topBar: {
        backgroundColor: NAVY,
        paddingTop: Platform.OS === 'ios' ? 44 : 36,
        paddingBottom: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 167, 58, 0.25)'
    },
    backIconBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.3
    },
    topBarSub: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 2
    },
    modeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    modeBadgeAdmin: {
        backgroundColor: 'rgba(217, 167, 58, 0.25)',
        borderWidth: 1,
        borderColor: GOLD
    },
    modeBadgeVendor: {
        backgroundColor: 'rgba(59, 130, 246, 0.25)',
        borderWidth: 1,
        borderColor: '#3B82F6'
    },
    modeBadgeText: {
        color: '#FFFFFF',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    heroContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
        paddingBottom: 16
    },
    bannerBox: {
        position: 'relative',
        height: 145,
        backgroundColor: '#CBD5E1'
    },
    bannerImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    bannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(14, 26, 46, 0.3)'
    },
    bannerActionsRow: {
        position: 'absolute',
        top: 10,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    recPill: {
        backgroundColor: GOLD,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    recPillText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    changeBannerBtn: {
        backgroundColor: 'rgba(14, 26, 46, 0.75)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)'
    },
    changeBannerBtnText: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800'
    },
    heroMetaStrip: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 0,
        alignItems: 'flex-start'
    },
    logoContainer: {
        marginTop: -32,
        position: 'relative',
        marginRight: 12
    },
    logoAvatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 3,
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF'
    },
    logoPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1F5F9'
    },
    logoCameraBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: NAVY,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF'
    },
    heroTextCol: {
        flex: 1,
        paddingTop: 6
    },
    heroStoreName: {
        fontSize: 17,
        fontWeight: '900',
        color: NAVY
    },
    heroTagline: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
        fontWeight: '600'
    },
    heroCategoryPill: {
        alignSelf: 'flex-start',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    heroCategoryText: {
        fontSize: 10,
        color: '#92400E',
        fontWeight: '800'
    },
    tabBarContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: BORDER
    },
    tabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: BORDER
    },
    tabPillActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    tabPillText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#64748B'
    },
    tabPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '800'
    },
    contentCard: {
        backgroundColor: '#FFFFFF',
        margin: 14,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER,
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 }
    },
    tabHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    tabTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY
    },
    inputGroup: {
        marginBottom: 16
    },
    label: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
        marginBottom: 6
    },
    charCount: {
        fontSize: 11,
        color: '#94A3B8'
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 12,
        paddingHorizontal: 10
    },
    inputIcon: {
        marginRight: 8
    },
    input: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 13,
        color: NAVY,
        fontWeight: '600'
    },
    textArea: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 85,
        textAlignVertical: 'top'
    },
    presetChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER
    },
    presetChipActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    presetChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569'
    },
    presetChipTextActive: {
        color: '#FFFFFF'
    },
    actionBtnSecondary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8
    },
    actionBtnSecondaryText: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY
    },
    recToggleBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 14,
        padding: 12,
        marginTop: 8
    },
    recToggleTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#92400E'
    },
    recToggleSub: {
        fontSize: 10.5,
        color: '#B45309',
        marginTop: 2
    },
    togglePill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: '#E2E8F0'
    },
    togglePillActive: {
        backgroundColor: GOLD
    },
    togglePillText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#64748B'
    },
    togglePillTextActive: {
        color: '#FFFFFF'
    },
    previewCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: BORDER,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8
    },
    previewBannerBox: {
        position: 'relative',
        height: 120,
        backgroundColor: '#CBD5E1'
    },
    previewBannerImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    previewContent: {
        padding: 14,
        paddingTop: 0
    },
    previewLogoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10
    },
    previewLogoBox: {
        marginTop: -28
    },
    previewLogoImg: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 3,
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF'
    },
    previewName: {
        fontSize: 15,
        fontWeight: '900',
        color: NAVY
    },
    previewCategoryTag: {
        fontSize: 11,
        color: GOLD,
        fontWeight: '800',
        marginTop: 1
    },
    previewTaglineText: {
        fontSize: 11.5,
        color: '#334155',
        fontWeight: '700',
        marginTop: 6
    },
    previewAboutText: {
        fontSize: 11.5,
        color: '#64748B',
        lineHeight: 16,
        marginTop: 4
    },
    previewActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12
    },
    simBtnWhatsApp: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#10B981',
        paddingVertical: 7,
        borderRadius: 8
    },
    simBtnCall: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: BORDER,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    simBtnFollow: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: NAVY
    },
    simBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    previewMetaGrid: {
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        gap: 6
    },
    metaLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    metaLineText: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600'
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 24 : 14,
        borderTopWidth: 1,
        borderTopColor: BORDER,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 8
    },
    saveButton: {
        backgroundColor: NAVY,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: GOLD
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.3
    }
});
