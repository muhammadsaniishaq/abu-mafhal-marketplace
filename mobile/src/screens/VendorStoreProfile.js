import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    Image, Alert, ActivityIndicator, StyleSheet, Dimensions,
    Platform, KeyboardAvoidingView
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
    'General Merchant'
];

export const VendorStoreProfile = ({ user, vendor, onBack, onSaved }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Store Form State
    const [storeName, setStoreName] = useState('');
    const [category, setCategory] = useState('General Merchant');
    const [about, setAbout] = useState('');
    const [coverImage, setCoverImage] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [isRecommended, setIsRecommended] = useState(false);

    useEffect(() => {
        loadCurrentStoreData();
    }, [user]);

    const loadCurrentStoreData = async () => {
        try {
            setLoading(true);
            const targetId = user?.id;
            if (!targetId) return;

            // Fetch profile & existing store row
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', targetId)
                .single();

            const localCache = await StoreService.getLocalMetadataCache();
            const local = localCache[targetId] || {};

            let parsedAddr = null;
            if (profile?.address && profile.address.startsWith('{')) {
                try { parsedAddr = JSON.parse(profile.address); } catch (_) {}
            }

            setStoreName(profile?.business_name || local.storeName || profile?.full_name || '');
            setAbout(profile?.about || parsedAddr?.about || local.about || '');
            setCoverImage(profile?.cover_image || parsedAddr?.cover_image || local.cover_image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop');
            setLogoUrl(profile?.avatar_url || local.logo || '');
            setPhone(profile?.phone || profile?.phone_number || local.phone || '');
            setCategory(profile?.business_category || parsedAddr?.category || local.category || (profile?.role === 'admin' ? 'Official Mall & Flagship Store' : 'General Merchant'));
            setAddress(parsedAddr?.address || profile?.address || local.address || '');
            setIsRecommended(profile?.is_recommended !== undefined ? !!profile.is_recommended : (local.is_recommended || false));

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
                Alert.alert('Permission Denied', 'Please allow gallery access to upload photos.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: type === 'banner' ? [16, 7] : [1, 1],
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
                    Alert.alert('Success', `${type === 'banner' ? 'Cover banner' : 'Logo'} uploaded successfully!`);
                } catch (uploadErr) {
                    // If storage upload fails, use local asset URI as preview
                    if (type === 'banner') setCoverImage(asset.uri);
                    else setLogoUrl(asset.uri);
                    Alert.alert('Photo Selected', 'Image loaded. Click Save Store Profile to commit changes.');
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
            Alert.alert('Validation Error', 'Please enter a valid store name.');
            return;
        }

        try {
            setSaving(true);
            await StoreService.updateStoreProfile({
                userId: user.id,
                storeName: storeName.trim(),
                about: about.trim(),
                coverImage: coverImage.trim(),
                logoUrl: logoUrl.trim(),
                phone: phone.trim(),
                category: category.trim(),
                address: address.trim(),
                isRecommended: isRecommended
            });

            Alert.alert('Success', 'Your store profile and branding have been saved and updated live!');
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
                <ActivityIndicator size="large" color={NAVY} />
                <Text style={s.loadingText}>Loading store details...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#F8FAFC' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                
                {/* Header info */}
                <View style={s.headerCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.headerTitle}>Store Profile & Branding</Text>
                            <Text style={s.headerSub}>Manage your store cover, bio, logo, and merchant identity</Text>
                        </View>
                        {onBack && (
                            <TouchableOpacity onPress={onBack} style={s.closeBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Live Preview Card */}
                <View style={s.sectionHeaderRow}>
                    <Ionicons name="eye-outline" size={16} color={GOLD} />
                    <Text style={s.sectionHeader}>Live Customer Preview</Text>
                </View>

                <View style={s.previewCard}>
                    {/* Cover Banner */}
                    <View style={s.bannerContainer}>
                        <Image
                            source={{ uri: coverImage || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop' }}
                            style={s.previewBanner}
                        />
                        <View style={s.bannerOverlay} />
                        {isRecommended && (
                            <View style={s.recPill}>
                                <Ionicons name="star" size={11} color="#FFFFFF" />
                                <Text style={s.recPillText}>RECOMMENDED</Text>
                            </View>
                        )}
                    </View>

                    {/* Logo & Info */}
                    <View style={s.previewBody}>
                        <View style={s.logoWrapper}>
                            {logoUrl ? (
                                <Image source={{ uri: logoUrl }} style={s.previewLogo} />
                            ) : (
                                <View style={[s.previewLogo, s.logoPlaceholder]}>
                                    <Ionicons name="storefront" size={26} color={NAVY} />
                                </View>
                            )}
                        </View>

                        <View style={{ marginTop: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={s.previewStoreName}>{storeName || 'Your Store Name'}</Text>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                            </View>
                            <Text style={s.previewCategory}>{category || 'Merchant Store'}</Text>
                        </View>

                        <Text style={s.previewAbout} numberOfLines={2}>
                            {about || 'Add an inspiring description of your store, products, and customer guarantees.'}
                        </Text>

                        <View style={s.previewMetaRow}>
                            <View style={s.metaItem}>
                                <Ionicons name="call-outline" size={13} color="#64748B" />
                                <Text style={s.metaText}>{phone || 'No phone set'}</Text>
                            </View>
                            <View style={s.metaItem}>
                                <Ionicons name="location-outline" size={13} color="#64748B" />
                                <Text style={s.metaText}>{address || 'Nigeria'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Form Fields */}
                <View style={s.formContainer}>
                    
                    {/* Store Name */}
                    <View style={s.inputGroup}>
                        <Text style={s.label}>Store / Business Name *</Text>
                        <TextInput
                            style={s.input}
                            value={storeName}
                            onChangeText={setStoreName}
                            placeholder="e.g. Abu Mafhal Tech Store"
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* Business Category */}
                    <View style={s.inputGroup}>
                        <Text style={s.label}>Business Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                            {CATEGORY_PRESETS.map((cat) => {
                                const selected = category === cat;
                                return (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setCategory(cat)}
                                        style={[s.catPill, selected && s.catPillActive]}
                                    >
                                        <Text style={[s.catPillText, selected && s.catPillTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <TextInput
                            style={[s.input, { marginTop: 8 }]}
                            value={category}
                            onChangeText={setCategory}
                            placeholder="Or type custom category..."
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* About Your Store */}
                    <View style={s.inputGroup}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={s.label}>About Your Store (Bio & Warranty)</Text>
                            <Text style={s.charCount}>{about.length}/500</Text>
                        </View>
                        <TextInput
                            style={[s.input, s.textArea]}
                            value={about}
                            onChangeText={setAbout}
                            placeholder="Describe your store history, genuine warranty, nationwide delivery, and customer protection..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            numberOfLines={4}
                            maxLength={500}
                        />
                    </View>

                    {/* Cover Banner Image */}
                    <View style={s.inputGroup}>
                        <Text style={s.label}>Store Cover Banner</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                            <TouchableOpacity
                                style={s.uploadBtn}
                                onPress={() => handlePickImage('banner')}
                                disabled={uploadingImage}
                            >
                                <Ionicons name="cloud-upload-outline" size={16} color={NAVY} />
                                <Text style={s.uploadBtnText}>Upload Banner</Text>
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={s.input}
                            value={coverImage}
                            onChangeText={setCoverImage}
                            placeholder="Or paste banner image URL (https://...)"
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* Store Logo */}
                    <View style={s.inputGroup}>
                        <Text style={s.label}>Store Logo</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                            <TouchableOpacity
                                style={s.uploadBtn}
                                onPress={() => handlePickImage('logo')}
                                disabled={uploadingImage}
                            >
                                <Ionicons name="image-outline" size={16} color={NAVY} />
                                <Text style={s.uploadBtnText}>Upload Logo</Text>
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={s.input}
                            value={logoUrl}
                            onChangeText={setLogoUrl}
                            placeholder="Or paste logo image URL (https://...)"
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* Contact Phone / WhatsApp */}
                    <View style={s.inputGroup}>
                        <Text style={s.label}>WhatsApp / Phone Number</Text>
                        <TextInput
                            style={s.input}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="e.g. 2349021486162"
                            placeholderTextColor="#94A3B8"
                            keyboardType="phone-pad"
                        />
                    </View>

                    {/* Store Address */}
                    <View style={s.inputGroup}>
                        <Text style={s.label}>Store Location / Physical Address</Text>
                        <TextInput
                            style={s.input}
                            value={address}
                            onChangeText={setAddress}
                            placeholder="e.g. Commercial Plaza, Gashua, Yobe State, Nigeria"
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[s.saveBtn, saving && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                                <Text style={s.saveBtnText}>Save Store Profile</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                </View>

            </ScrollView>
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
        fontWeight: '600',
        color: '#64748B'
    },
    headerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: BORDER
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: NAVY,
        letterSpacing: -0.3
    },
    headerSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 3
    },
    closeBtn: {
        padding: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 20
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
        textTransform: 'uppercase',
        letterSpacing: 0.6
    },
    previewCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: BORDER,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 }
    },
    bannerContainer: {
        position: 'relative',
        height: 125,
        backgroundColor: '#CBD5E1'
    },
    previewBanner: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    bannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(14, 26, 46, 0.25)'
    },
    recPill: {
        position: 'absolute',
        top: 10,
        right: 10,
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
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.4
    },
    previewBody: {
        padding: 14,
        paddingTop: 0
    },
    logoWrapper: {
        marginTop: -30,
        alignSelf: 'flex-start'
    },
    previewLogo: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF'
    },
    logoPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1F5F9'
    },
    previewStoreName: {
        fontSize: 16,
        fontWeight: '800',
        color: NAVY
    },
    previewCategory: {
        fontSize: 11.5,
        color: GOLD,
        fontWeight: '700',
        marginTop: 1
    },
    previewAbout: {
        fontSize: 12,
        color: '#475569',
        lineHeight: 17,
        marginTop: 8
    },
    previewMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    metaText: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600'
    },
    formContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER
    },
    inputGroup: {
        marginBottom: 16
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: NAVY,
        marginBottom: 6
    },
    charCount: {
        fontSize: 11,
        color: '#94A3B8'
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: NAVY
    },
    textArea: {
        minHeight: 85,
        textAlignVertical: 'top'
    },
    catPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: BORDER
    },
    catPillActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    catPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569'
    },
    catPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '700'
    },
    uploadBtn: {
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
    uploadBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: NAVY
    },
    saveBtn: {
        backgroundColor: NAVY,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        borderWidth: 1,
        borderColor: GOLD + '60'
    },
    saveBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.3
    }
});
