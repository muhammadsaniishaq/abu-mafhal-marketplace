import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert, ActivityIndicator, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import DateTimePicker from '@react-native-community/datetimepicker';
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
    const [location, setLocation] = useState(user?.location || user?.user_metadata?.location || '');
    const [dob, setDob] = useState(user?.dob || user?.user_metadata?.dob || null);
    const [showDatePicker, setShowDatePicker] = useState(false);
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
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (data && !error) {
                if (data.full_name) setFullName(data.full_name);
                if (data.phone) setPhone(data.phone);
                if (data.avatar_url) setAvatarUrl(data.avatar_url);
                if (data.username) setUsername(data.username);
                if (data.business_name) setBusinessName(data.business_name);
                if (data.business_category) setBusinessCategory(data.business_category);
                if (data.cover_image) setCoverImage(data.cover_image);
                if (data.about) setAboutStore(data.about);

                // Check JSON address fallback
                if (data.address && data.address.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(data.address);
                        if (!data.about && parsed.about) setAboutStore(parsed.about);
                        if (!data.cover_image && parsed.cover_image) setCoverImage(parsed.cover_image);
                        if (!data.business_category && parsed.category) setBusinessCategory(parsed.category);
                        if (!data.business_name && parsed.business_name) setBusinessName(parsed.business_name);
                    } catch (_) {}
                }
            }
        } catch (err) {
            console.log('[EditProfile] Profile load error:', err);
        }
    };

    // Pick Avatar from Gallery
    const pickAvatar = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please enable media library access in settings.');
                return;
            }

            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.6,
                base64: true,
                allowsEditing: true,
                aspect: [1, 1]
            });

            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                if (!asset.base64) {
                    Alert.alert('Error', 'Image data missing. Please try again.');
                    return;
                }
                uploadImageFile(asset, 'avatar');
            }
        } catch (error) {
            Alert.alert('Gallery Error', error.message);
        }
    };

    // Pick Cover Banner from Gallery
    const pickCover = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please enable media library access in settings.');
                return;
            }

            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                base64: true,
                allowsEditing: true,
                aspect: [16, 9]
            });

            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                if (!asset.base64) {
                    Alert.alert('Error', 'Image data missing. Please try again.');
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

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || dob;
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            const formatted = currentDate.toISOString().split('T')[0];
            setDob(formatted);
        }
    };

    const handleSave = async () => {
        if (!fullName) {
            Alert.alert('Error', 'Full Name is required.');
            return;
        }

        setLoading(true);
        try {
            // 1. Update Auth Metadata
            await supabase.auth.updateUser({
                data: {
                    full_name: fullName,
                    phone_number: phone,
                    avatar_url: avatarUrl,
                    bio: bio,
                    dob: dob,
                    username: username,
                    location: location,
                    gender: gender,
                    business_name: businessName,
                    about: aboutStore,
                    cover_image: coverImage
                }
            }).catch(() => {});

            // 2. Update Store Profile & Profiles Table through StoreService safely
            await StoreService.updateStoreProfile({
                userId: user?.id,
                storeName: businessName || fullName,
                category: businessCategory,
                about: aboutStore,
                coverImage: coverImage,
                logoUrl: avatarUrl,
                phone: phone,
                address: location
            });

            Alert.alert('Success', 'Profile and Store details updated successfully!');

            if (onUpdateUser) {
                onUpdateUser({
                    ...user,
                    full_name: fullName,
                    fullName: fullName,
                    phone: phone,
                    phoneNumber: phone,
                    avatar_url: avatarUrl,
                    business_name: businessName,
                    about: aboutStore,
                    cover_image: coverImage
                });
            }

            onBack();
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Top Navigation Bar */}
            <View style={styles.topHeader}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={[styles.headerRow, { justifyContent: 'space-between' }]}>
                        <TouchableOpacity onPress={onBack} style={{ padding: 6 }}>
                            <Ionicons name="arrow-back" size={24} color="#0F172A" />
                        </TouchableOpacity>
                        <Text style={styles.sectionTitle}>
                            {isStoreOwner ? 'Edit Profile & Store' : 'Edit Profile'}
                        </Text>
                        <TouchableOpacity onPress={handleSave} disabled={loading} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#0284C7', borderRadius: 12 }}>
                            {loading ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>Save</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                
                {/* ══════════════════════════════════════════════════════════
                    STORE & BUSINESS BRANDING (FOR VENDORS & ADMINS)
                ══════════════════════════════════════════════════════════ */}
                <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="storefront" size={18} color="#0284C7" />
                            </View>
                            <View>
                                <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>Store & Business Branding</Text>
                                <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Customize how customers see your store</Text>
                            </View>
                        </View>
                        {user?.role === 'admin' ? (
                            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                <Text style={{ fontSize: 10, fontWeight: '900', color: '#D97706' }}>OFFICIAL MALL</Text>
                            </View>
                        ) : (
                            <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                <Text style={{ fontSize: 10, fontWeight: '900', color: '#059669' }}>VERIFIED STORE</Text>
                            </View>
                        )}
                    </View>

                    {/* Store Cover Image Banner Preview & Upload */}
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 }}>
                        Store Cover Banner Image
                    </Text>
                    <View style={{ height: 130, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0F172A', position: 'relative', marginBottom: 12 }}>
                        {coverImage ? (
                            <Image source={{ uri: coverImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B', padding: 12 }}>
                                <Ionicons name="images-outline" size={32} color="#94A3B8" />
                                <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', marginTop: 4 }}>No Cover Image Set</Text>
                            </View>
                        )}
                        <View style={{ position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                                onPress={pickCover}
                                disabled={uploadingCover}
                                style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            >
                                {uploadingCover ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <>
                                        <Ionicons name="camera" size={13} color="white" />
                                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>Choose Photo</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Manual Cover Banner URL input */}
                    <View style={{ marginBottom: 14 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>
                            Or Paste Direct Cover Image URL
                        </Text>
                        <TextInput
                            style={[styles.modernInput, { fontSize: 12, height: 44 }]}
                            value={coverImage}
                            onChangeText={setCoverImage}
                            placeholder="https://images.unsplash.com/... or image link"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Store / Business Name */}
                    <View style={{ marginBottom: 14 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 }}>
                            Store / Brand Name *
                        </Text>
                        <TextInput
                            style={styles.modernInput}
                            value={businessName}
                            onChangeText={setBusinessName}
                            placeholder={user?.role === 'admin' ? 'Abu Mafhal Official Store' : 'e.g. Kano Tech & Gadgets Hub'}
                        />
                    </View>

                    {/* Business Category */}
                    <View style={{ marginBottom: 14 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 }}>
                            Store Category
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                            {CATEGORY_PRESETS.map((cat) => {
                                const selected = businessCategory === cat;
                                return (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setBusinessCategory(cat)}
                                        style={{
                                            paddingHorizontal: 12,
                                            paddingVertical: 7,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: selected ? '#0284C7' : '#CBD5E1',
                                            backgroundColor: selected ? '#E0F2FE' : '#F8FAFC'
                                        }}
                                    >
                                        <Text style={{ fontSize: 11, fontWeight: selected ? '800' : '600', color: selected ? '#0369A1' : '#475569' }}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* About Your Store / Bio */}
                    <View style={{ marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 }}>
                            About Your Store (Store Bio & Policy)
                        </Text>
                        <TextInput
                            style={[styles.modernInput, { height: 90, textAlignVertical: 'top', fontSize: 12 }]}
                            value={aboutStore}
                            onChangeText={setAboutStore}
                            placeholder="Tell buyers what your store sells, brand warranty, delivery locations, and customer commitment..."
                            multiline
                        />
                    </View>
                </View>

                {/* ══════════════════════════════════════════════════════════
                    PERSONAL CREDENTIALS & AVATAR
                ══════════════════════════════════════════════════════════ */}
                <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24 }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#0F172A', marginBottom: 14 }}>
                        Account & Personal Details
                    </Text>

                    {/* Avatar Upload */}
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                        <TouchableOpacity onPress={pickAvatar} style={{ position: 'relative' }}>
                            <UserAvatar sourceUrl={avatarUrl} size={90} border="#0284C7" />
                            {uploadingAvatar && (
                                <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 45, justifyContent: 'center', alignItems: 'center' }}>
                                    <ActivityIndicator color="white" />
                                </View>
                            )}
                            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#0284C7', padding: 7, borderRadius: 20, borderWidth: 2, borderColor: 'white' }}>
                                <Ionicons name="camera" size={14} color="white" />
                            </View>
                        </TouchableOpacity>
                        <Text style={{ marginTop: 8, color: '#64748B', fontSize: 12, fontWeight: '600' }}>Tap to change logo/avatar</Text>
                    </View>

                    {/* Full Name */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name / Contact Person</Text>
                        <TextInput
                            style={styles.modernInput}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="e.g. Muhammad Sani Ishaq"
                        />
                    </View>

                    {/* Username */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            style={styles.modernInput}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="@username"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Phone / WhatsApp */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number (WhatsApp Direct)</Text>
                        <TextInput
                            style={styles.modernInput}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="e.g. 2349021486162"
                            keyboardType="phone-pad"
                        />
                    </View>

                    {/* Location / Address */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Store Location / Physical Address</Text>
                        <TextInput
                            style={styles.modernInput}
                            value={location}
                            onChangeText={setLocation}
                            placeholder="e.g. Commercial Hub, Gashua, Yobe State, Nigeria"
                        />
                    </View>

                    {/* Gender */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Gender</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            {['Male', 'Female'].map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    onPress={() => setGender(option)}
                                    style={{
                                        flex: 1, padding: 12, borderRadius: 12, borderWidth: 1,
                                        borderColor: gender === option ? '#0284C7' : '#E2E8F0',
                                        backgroundColor: gender === option ? '#F0F9FF' : 'white',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Text style={{ fontWeight: '700', color: gender === option ? '#0284C7' : '#64748B', fontSize: 13 }}>
                                        {option}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Email Read-Only */}
                    <View style={[styles.inputGroup, { opacity: 0.7 }]}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                            style={[styles.modernInput, { backgroundColor: '#F8FAFC' }]}
                            value={user?.email}
                            editable={false}
                        />
                    </View>
                </View>

                {/* Bottom Save Button */}
                <TouchableOpacity
                    style={[styles.modernBtn, { height: 54, backgroundColor: '#0A192F' }]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="checkmark-circle" size={18} color="#38BDF8" />
                            <Text style={[styles.modernBtnText, { fontSize: 15, fontWeight: '900' }]}>Save Profile & Store</Text>
                        </View>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};
