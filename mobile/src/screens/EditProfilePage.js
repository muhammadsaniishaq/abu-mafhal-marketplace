import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    SafeAreaView, Alert, ActivityIndicator, Image, Platform, StyleSheet, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { UserAvatar } from '../components/UserAvatar';
import { StoreService } from '../services/storeService';

const CATEGORY_PRESETS = [
    'Official Mall & Flagship Store',
    'Electronics & Smart Devices',
    'Fashion & Designer Apparel',
    'Beauty, Perfumes & Personal Care',
    'Home, Kitchen & Living',
    'Groceries & Supermarket',
    'Phones & Accessories',
    'Automotive & Motor Spares',
    'General Merchant'
];

export const EditProfilePage = ({ user, onBack, onUpdateUser }) => {
    // User Personal Info
    const [fullName, setFullName] = useState(
        user?.fullName || user?.user_metadata?.full_name || user?.full_name || ''
    );
    const [phone, setPhone] = useState(
        user?.phoneNumber || user?.user_metadata?.phone_number || user?.phone || user?.phone_number || ''
    );
    const [gender, setGender] = useState(user?.gender || user?.user_metadata?.gender || '');
    const [bio, setBio] = useState(user?.bio || user?.user_metadata?.bio || '');
    const [username, setUsername] = useState(user?.username || user?.user_metadata?.username || '');
    const [location, setLocation] = useState(user?.location || user?.address || user?.user_metadata?.location || '');
    const [dob, setDob] = useState(user?.dob || user?.user_metadata?.dob || null);
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || user?.user_metadata?.avatar_url || null);

    // Store & Business Branding Info
    const [businessName, setBusinessName] = useState(
        user?.business_name || user?.businessName || (user?.role === 'admin' ? 'Abu Mafhal Official Store' : '')
    );
    const [aboutStore, setAboutStore] = useState(user?.about || '');
    const [coverImage, setCoverImage] = useState(user?.cover_image || user?.coverImage || '');
    const [businessCategory, setBusinessCategory] = useState(
        user?.business_category || (user?.role === 'admin' ? 'Official Mall & Flagship Store' : 'General Merchant')
    );
    const [tagline, setTagline] = useState(user?.tagline || '');
    const [workingHours, setWorkingHours] = useState(user?.working_hours || '');
    const [policy, setPolicy] = useState(user?.policy || '');

    // Social Media Handles
    const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
    const [instagram, setInstagram] = useState(user?.instagram || '');
    const [facebook, setFacebook] = useState(user?.facebook || '');
    const [twitter, setTwitter] = useState(user?.twitter || '');

    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);

    // Determine if user has store privileges
    const isStoreOwner = user?.role === 'admin' || user?.role === 'vendor' || !!user?.business_name;

    useEffect(() => {
        loadLatestProfile();
    }, [user?.id]);

    const loadLatestProfile = async () => {
        if (!user?.id) return;
        try {
            // Load both profiles and stores table
            const [profRes, storeRes] = await Promise.allSettled([
                supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
                supabase.from('stores').select('*').eq('user_id', user.id).maybeSingle()
            ]);

            const p = profRes.status === 'fulfilled' && profRes.value?.data ? profRes.value.data : null;
            const s = storeRes.status === 'fulfilled' && storeRes.value?.data ? storeRes.value.data : null;

            if (p) {
                if (p.full_name) setFullName(p.full_name);
                if (p.phone || p.phone_number) setPhone(p.phone || p.phone_number);
                if (p.avatar_url) setAvatarUrl(p.avatar_url);
                if (p.username) setUsername(p.username);
                if (p.gender) setGender(p.gender);
                if (p.dob) setDob(p.dob);
                if (p.address || p.state) setLocation(p.address || p.state);
                if (p.business_name) setBusinessName(p.business_name);
                if (p.business_category) setBusinessCategory(p.business_category);
                if (p.about) setAboutStore(p.about);
                if (p.cover_image) setCoverImage(p.cover_image);
                if (p.tagline) setTagline(p.tagline);
                if (p.whatsapp) setWhatsapp(p.whatsapp);
                if (p.instagram) setInstagram(p.instagram);
                if (p.facebook) setFacebook(p.facebook);
                if (p.twitter) setTwitter(p.twitter);
                if (p.working_hours) setWorkingHours(p.working_hours);
                if (p.policy) setPolicy(p.policy);
            }

            // Prefer explicit store table details if present
            if (s) {
                if (s.name) setBusinessName(s.name);
                if (s.category) setBusinessCategory(s.category);
                if (s.about) setAboutStore(s.about);
                if (s.cover_image) setCoverImage(s.cover_image);
                if (s.logo) setAvatarUrl(s.logo);
                if (s.tagline) setTagline(s.tagline);
                if (s.whatsapp) setWhatsapp(s.whatsapp);
                if (s.instagram) setInstagram(s.instagram);
                if (s.facebook) setFacebook(s.facebook);
                if (s.twitter) setTwitter(s.twitter);
                if (s.working_hours) setWorkingHours(s.working_hours);
                if (s.policy) setPolicy(s.policy);
                if (s.address) setLocation(s.address);
                if (s.phone && !phone) setPhone(s.phone);
            }
        } catch (err) {
            console.log('[EditProfile] Profile load note:', err);
        }
    };

    // Pick Avatar from Gallery
    const pickAvatar = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please allow gallery access to upload a profile photo.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                base64: true,
                allowsEditing: true,
                aspect: [1, 1]
            });

            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                if (!asset.base64) {
                    Alert.alert('Error', 'Image data could not be read. Please try another image.');
                    return;
                }
                uploadImageFile(asset, 'avatar');
            }
        } catch (error) {
            Alert.alert('Gallery Error', error.message);
        }
    };

    // Pick Store Cover Banner from Gallery
    const pickCover = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please allow gallery access to upload a cover banner.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.75,
                base64: true,
                allowsEditing: true,
                aspect: [16, 9]
            });

            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                if (!asset.base64) {
                    Alert.alert('Error', 'Image data could not be read. Please try another image.');
                    return;
                }
                uploadImageFile(asset, 'cover');
            }
        } catch (error) {
            Alert.alert('Gallery Error', error.message);
        }
    };

    const uploadImageFile = async (imageAsset, type = 'avatar') => {
        const isAvatar = type === 'avatar';
        if (isAvatar) setUploadingAvatar(true);
        else setUploadingCover(true);

        try {
            const fileExt = imageAsset.uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${user?.id || 'public'}/${type}_${Date.now()}.${fileExt}`;
            const bucketName = 'avatars';

            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(fileName, decode(imageAsset.base64), {
                    contentType: imageAsset.mimeType || 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
            if (isAvatar) {
                setAvatarUrl(data.publicUrl);
            } else {
                setCoverImage(data.publicUrl);
            }
            Alert.alert('Success', `${isAvatar ? 'Profile Avatar' : 'Store Cover Banner'} uploaded successfully!`);
        } catch (error) {
            Alert.alert('Upload Failed', error.message || 'Storage error');
        } finally {
            if (isAvatar) setUploadingAvatar(false);
            else setUploadingCover(false);
        }
    };

    const handleSave = async () => {
        if (!fullName || !fullName.trim()) {
            Alert.alert('Required Field', 'Full Name is required.');
            return;
        }

        setLoading(true);
        try {
            const cleanFullName = fullName.trim();
            const cleanPhone = phone ? phone.trim() : '';
            const cleanStoreName = businessName ? businessName.trim() : cleanFullName;
            const cleanAddress = location ? location.trim() : '';
            const cleanWhatsapp = whatsapp ? whatsapp.trim() : (cleanPhone || '');
            const cleanInstagram = instagram ? instagram.replace(/^@/, '').trim() : '';
            const cleanFacebook = facebook ? facebook.trim() : '';
            const cleanTwitter = twitter ? twitter.replace(/^@/, '').trim() : '';
            const cleanTagline = tagline ? tagline.trim() : '';
            const cleanHours = workingHours ? workingHours.trim() : '';
            const cleanPolicy = policy ? policy.trim() : '';
            const cleanBio = aboutStore ? aboutStore.trim() : '';

            // 1. Update Auth Metadata
            await supabase.auth.updateUser({
                data: {
                    full_name: cleanFullName,
                    phone_number: cleanPhone,
                    avatar_url: avatarUrl,
                    username: username,
                    location: cleanAddress,
                    gender: gender,
                    business_name: cleanStoreName,
                    about: cleanBio,
                    cover_image: coverImage
                }
            }).catch(() => {});

            // 2. Update profiles & stores table through StoreService
            await StoreService.updateStoreProfile({
                userId: user?.id,
                fullName: cleanFullName,
                storeName: cleanStoreName,
                category: businessCategory,
                about: cleanBio,
                coverImage: coverImage,
                logoUrl: avatarUrl,
                phone: cleanPhone,
                whatsapp: cleanWhatsapp,
                address: cleanAddress,
                tagline: cleanTagline,
                workingHours: cleanHours,
                policy: cleanPolicy,
                instagram: cleanInstagram,
                facebook: cleanFacebook,
                twitter: cleanTwitter,
                username: username,
                gender: gender,
                dob: dob
            });

            // 3. Notify app parent state
            const updatedUserObj = {
                ...user,
                full_name: cleanFullName,
                fullName: cleanFullName,
                phone: cleanPhone,
                phoneNumber: cleanPhone,
                avatar_url: avatarUrl,
                username: username,
                gender: gender,
                location: cleanAddress,
                address: cleanAddress,
                business_name: cleanStoreName,
                business_category: businessCategory,
                about: cleanBio,
                cover_image: coverImage,
                tagline: cleanTagline,
                whatsapp: cleanWhatsapp,
                instagram: cleanInstagram,
                facebook: cleanFacebook,
                twitter: cleanTwitter,
                working_hours: cleanHours,
                policy: cleanPolicy
            };

            if (onUpdateUser) {
                onUpdateUser(updatedUserObj);
            }

            Alert.alert('Saved Successfully', 'Your profile and store details have been updated and verified!');
            onBack();
        } catch (error) {
            Alert.alert('Save Failed', error.message || 'Unable to save profile changes. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={s.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* ════ TOP HEADER (FIXED, CLEAN, NO OVERLAP) ════ */}
            <SafeAreaView style={s.safeTop}>
                <View style={s.headerRow}>
                    <TouchableOpacity
                        onPress={onBack}
                        style={s.headerBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="arrow-back" size={20} color="#0F172A" />
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text numberOfLines={1} style={s.headerTitle}>
                            {isStoreOwner ? 'Edit Profile & Store' : 'Edit Profile'}
                        </Text>
                        <Text numberOfLines={1} style={s.headerSub}>
                            {isStoreOwner ? 'Manage your storefront & verified identity' : 'Manage account settings'}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={loading}
                        style={[s.saveBtn, loading && { opacity: 0.7 }]}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={s.saveBtnText}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ════ 1. STORE & BUSINESS BRANDING (FOR VENDORS & ADMINS) ════ */}
                <View style={s.card}>
                    <View style={s.cardHeader}>
                        <View style={s.cardHeaderLeft}>
                            <View style={s.cardIconBox}>
                                <Ionicons name="storefront" size={16} color="#0A192F" />
                            </View>
                            <View>
                                <Text style={s.cardTitle}>Store & Business Branding</Text>
                                <Text style={s.cardSub}>How buyers view your store nationwide</Text>
                            </View>
                        </View>
                        {user?.role === 'admin' ? (
                            <View style={s.adminBadge}>
                                <Text style={s.adminBadgeText}>OFFICIAL MALL</Text>
                            </View>
                        ) : (
                            <View style={s.verifiedBadge}>
                                <Text style={s.verifiedBadgeText}>VERIFIED STORE</Text>
                            </View>
                        )}
                    </View>

                    {/* Store Cover Banner */}
                    <Text style={s.fieldLabel}>Store Cover Banner Image</Text>
                    <View style={s.coverBox}>
                        {coverImage ? (
                            <Image source={{ uri: coverImage }} style={s.coverImg} resizeMode="cover" />
                        ) : (
                            <View style={s.coverPlaceholder}>
                                <Ionicons name="images-outline" size={28} color="#94A3B8" />
                                <Text style={s.coverPlaceholderText}>No Cover Image Set</Text>
                            </View>
                        )}
                        <View style={s.coverActionOverlay}>
                            <TouchableOpacity
                                onPress={pickCover}
                                disabled={uploadingCover}
                                style={s.coverPickBtn}
                                activeOpacity={0.8}
                            >
                                {uploadingCover ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="camera" size={13} color="#FFFFFF" />
                                        <Text style={s.coverPickBtnText}>Upload Banner</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Direct Banner URL input */}
                    <View style={s.inputGroup}>
                        <Text style={s.subLabel}>Or Paste Direct Banner Image URL</Text>
                        <TextInput
                            style={s.input}
                            value={coverImage}
                            onChangeText={setCoverImage}
                            placeholder="https://... image link"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Store / Brand Name */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Store / Brand Name *</Text>
                        <TextInput
                            style={s.input}
                            value={businessName}
                            onChangeText={setBusinessName}
                            placeholder={user?.role === 'admin' ? 'Abu Mafhal Official Store' : 'e.g. Kano Tech Hub'}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* Store Tagline */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Store Tagline / Slogan</Text>
                        <TextInput
                            style={s.input}
                            value={tagline}
                            onChangeText={setTagline}
                            placeholder="e.g. 100% Genuine Tech • Nationwide Express Dispatch"
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* Store Category */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Store Category</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={s.categoryScroll}
                        >
                            {CATEGORY_PRESETS.map((cat) => {
                                const selected = businessCategory === cat;
                                return (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setBusinessCategory(cat)}
                                        style={[s.catPill, selected && s.catPillActive]}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[s.catPillText, selected && s.catPillTextActive]}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Store Bio / About */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>About Your Store (Bio & Warranty Commitment)</Text>
                        <TextInput
                            style={s.inputMultiline}
                            value={aboutStore}
                            onChangeText={setAboutStore}
                            placeholder="Describe your products, warranty guarantees, delivery locations, and business background..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* Operating Hours */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Working Hours / Dispatch Days</Text>
                        <TextInput
                            style={s.input}
                            value={workingHours}
                            onChangeText={setWorkingHours}
                            placeholder="e.g. Mon - Sat: 8:00 AM - 8:00 PM"
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* Return Policy */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Store Return & Refund Policy</Text>
                        <TextInput
                            style={s.input}
                            value={policy}
                            onChangeText={setPolicy}
                            placeholder="e.g. 7 Days Nationwide Return Policy • 100% Escrow Protection"
                            placeholderTextColor="#94A3B8"
                        />
                    </View>
                </View>

                {/* ════ 2. SOCIAL MEDIA & DIRECT CHANNELS (CLEARLY ORGANIZED) ════ */}
                <View style={s.card}>
                    <View style={s.cardHeader}>
                        <View style={s.cardHeaderLeft}>
                            <View style={[s.cardIconBox, { backgroundColor: '#ECFDF5' }]}>
                                <Ionicons name="share-social" size={16} color="#059669" />
                            </View>
                            <View>
                                <Text style={s.cardTitle}>Social Media & Direct Channels</Text>
                                <Text style={s.cardSub}>Displayed as clean icons on your store view</Text>
                            </View>
                        </View>
                    </View>

                    {/* WhatsApp */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>WhatsApp (Direct Customer Chat)</Text>
                        <View style={s.iconInputRow}>
                            <View style={[s.inputIconWrap, { backgroundColor: '#ECFDF5' }]}>
                                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                            </View>
                            <TextInput
                                style={s.iconInput}
                                value={whatsapp}
                                onChangeText={setWhatsapp}
                                placeholder="e.g. 08145853539 or +234..."
                                placeholderTextColor="#94A3B8"
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>

                    {/* Instagram */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Instagram Handle</Text>
                        <View style={s.iconInputRow}>
                            <View style={[s.inputIconWrap, { backgroundColor: '#FDF2F8' }]}>
                                <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                            </View>
                            <TextInput
                                style={s.iconInput}
                                value={instagram}
                                onChangeText={setInstagram}
                                placeholder="e.g. @abumafhal or store_name"
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="none"
                            />
                        </View>
                    </View>

                    {/* Facebook */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Facebook Page / Handle</Text>
                        <View style={s.iconInputRow}>
                            <View style={[s.inputIconWrap, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                            </View>
                            <TextInput
                                style={s.iconInput}
                                value={facebook}
                                onChangeText={setFacebook}
                                placeholder="e.g. Abu Mafhal Marketplace"
                                placeholderTextColor="#94A3B8"
                            />
                        </View>
                    </View>

                    {/* X / Twitter */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>X / Twitter Handle</Text>
                        <View style={s.iconInputRow}>
                            <View style={[s.inputIconWrap, { backgroundColor: '#F8FAFC' }]}>
                                <Ionicons name="logo-twitter" size={18} color="#0F172A" />
                            </View>
                            <TextInput
                                style={s.iconInput}
                                value={twitter}
                                onChangeText={setTwitter}
                                placeholder="e.g. @abumafhal"
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="none"
                            />
                        </View>
                    </View>
                </View>

                {/* ════ 3. PERSONAL CREDENTIALS & AVATAR ════ */}
                <View style={s.card}>
                    <View style={s.cardHeader}>
                        <View style={s.cardHeaderLeft}>
                            <View style={[s.cardIconBox, { backgroundColor: '#F1F5F9' }]}>
                                <Ionicons name="person" size={16} color="#0F172A" />
                            </View>
                            <View>
                                <Text style={s.cardTitle}>Account & Contact Person</Text>
                                <Text style={s.cardSub}>Verified owner & contact details</Text>
                            </View>
                        </View>
                    </View>

                    {/* Avatar Upload */}
                    <View style={s.avatarSection}>
                        <TouchableOpacity onPress={pickAvatar} style={s.avatarWrap} activeOpacity={0.85}>
                            <UserAvatar sourceUrl={avatarUrl} size={84} border="#0284C7" />
                            {uploadingAvatar && (
                                <View style={s.avatarLoadingOverlay}>
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                </View>
                            )}
                            <View style={s.avatarCameraBadge}>
                                <Ionicons name="camera" size={13} color="#FFFFFF" />
                            </View>
                        </TouchableOpacity>
                        <Text style={s.avatarHint}>Tap to change store logo / personal avatar</Text>
                    </View>

                    {/* Full Name */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Full Name / Contact Person *</Text>
                        <TextInput
                            style={s.input}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="e.g. Muhammad Sani Ishaq"
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* Username */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Username</Text>
                        <TextInput
                            style={s.input}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="@username"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Phone Number */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Primary Phone Number</Text>
                        <TextInput
                            style={s.input}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="e.g. 08145853539"
                            placeholderTextColor="#94A3B8"
                            keyboardType="phone-pad"
                        />
                    </View>

                    {/* Physical Address */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Physical Store / Delivery Address</Text>
                        <TextInput
                            style={s.input}
                            value={location}
                            onChangeText={setLocation}
                            placeholder="e.g. Main Commercial Plaza, Gashua, Yobe State, Nigeria"
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* Gender */}
                    <View style={s.inputGroup}>
                        <Text style={s.fieldLabel}>Gender</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {['Male', 'Female'].map((option) => {
                                const active = gender === option;
                                return (
                                    <TouchableOpacity
                                        key={option}
                                        onPress={() => setGender(option)}
                                        style={[s.genderBtn, active && s.genderBtnActive]}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[s.genderBtnText, active && s.genderBtnTextActive]}>
                                            {option}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Email Read-Only */}
                    <View style={[s.inputGroup, { opacity: 0.75 }]}>
                        <Text style={s.fieldLabel}>Registered Email (Secure)</Text>
                        <TextInput
                            style={[s.input, { backgroundColor: '#F8FAFC' }]}
                            value={user?.email}
                            editable={false}
                        />
                    </View>
                </View>

                {/* ════ BOTTOM SAVE ACTION BUTTON ════ */}
                <TouchableOpacity
                    style={[s.bigSaveBtn, loading && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="checkmark-circle" size={19} color="#38BDF8" />
                            <Text style={s.bigSaveBtnText}>Save Profile & Store Changes</Text>
                        </View>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    safeTop: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingTop: Platform.OS === 'android' ? 12 : 4
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 52
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.2
    },
    headerSub: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 1
    },
    saveBtn: {
        backgroundColor: '#0A192F',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    saveBtnText: {
        color: '#FCD34D',
        fontWeight: '800',
        fontSize: 12.5
    },
    scrollContent: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 80
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1
    },
    cardIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FEF9EC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    cardTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    cardSub: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 1
    },
    adminBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    adminBadgeText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#92400E',
        letterSpacing: 0.4
    },
    verifiedBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#A7F3D0'
    },
    verifiedBadgeText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#059669',
        letterSpacing: 0.4
    },
    coverBox: {
        height: 120,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#0A192F',
        position: 'relative',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    coverImg: {
        width: '100%',
        height: '100%'
    },
    coverPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1E293B'
    },
    coverPlaceholderText: {
        color: '#94A3B8',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 4
    },
    coverActionOverlay: {
        position: 'absolute',
        bottom: 8,
        right: 8
    },
    coverPickBtn: {
        backgroundColor: 'rgba(10, 25, 47, 0.88)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    coverPickBtnText: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800'
    },
    inputGroup: {
        marginBottom: 11
    },
    fieldLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 5
    },
    subLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 4
    },
    input: {
        height: 42,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        fontSize: 12.5,
        color: '#0F172A'
    },
    inputMultiline: {
        minHeight: 74,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 8,
        fontSize: 12.5,
        color: '#0F172A',
        textAlignVertical: 'top'
    },
    categoryScroll: {
        gap: 6,
        paddingVertical: 3
    },
    catPill: {
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#F8FAFC'
    },
    catPillActive: {
        borderColor: '#0284C7',
        backgroundColor: '#E0F2FE'
    },
    catPillText: {
        fontSize: 10.5,
        fontWeight: '600',
        color: '#475569'
    },
    catPillTextActive: {
        fontWeight: '800',
        color: '#0369A1'
    },
    iconInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 42,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden'
    },
    inputIconWrap: {
        width: 40,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: '#F1F5F9'
    },
    iconInput: {
        flex: 1,
        height: '100%',
        paddingHorizontal: 10,
        fontSize: 12.5,
        color: '#0F172A'
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 14
    },
    avatarWrap: {
        position: 'relative'
    },
    avatarLoadingOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: 42,
        alignItems: 'center',
        justifyContent: 'center'
    },
    avatarCameraBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#0A192F',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center'
    },
    avatarHint: {
        fontSize: 10.5,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 6
    },
    genderBtn: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center'
    },
    genderBtnActive: {
        borderColor: '#0284C7',
        backgroundColor: '#F0F9FF'
    },
    genderBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B'
    },
    genderBtnTextActive: {
        color: '#0284C7',
        fontWeight: '800'
    },
    bigSaveBtn: {
        height: 48,
        borderRadius: 11,
        backgroundColor: '#0A192F',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#D4AF37',
        marginTop: 4,
        marginBottom: 16,
        shadowColor: '#0A192F',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 2
    },
    bigSaveBtnText: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#FCD34D',
        letterSpacing: 0.3
    }
});
