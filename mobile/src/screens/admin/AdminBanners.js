import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, Image, TextInput, ScrollView, 
    Alert, ActivityIndicator, Modal, StyleSheet, Dimensions, Platform, RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const { width } = Dimensions.get('window');
const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

export const AdminBanners = () => {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [activeSectionFilter, setActiveSectionFilter] = useState('all');

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        title: '',
        subtitle: '',
        image_url: '',
        action_link: '',
        display_order: '0',
        section: 'home',
        is_active: true
    });

    const SECTIONS = ['landing', 'home', 'shop', 'promo'];

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('banners')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) {
                console.warn('Error fetching banners:', error.message);
                Alert.alert('Error', error.message);
            } else {
                setBanners(data || []);
            }
        } catch (e) {
            console.error('Fetch banners catch:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchBanners();
    };

    const pickImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission', 'Gallery access is required to upload banner image.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: form.section === 'shop' ? [2, 1] : [16, 9],
                quality: 0.85,
                base64: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                await uploadImageToSupabase(asset);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick image.');
        }
    };

    const uploadImageToSupabase = async (asset) => {
        try {
            setUploading(true);
            const fileName = `banner_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const fileData = decode(asset.base64);

            // Try 'banners' bucket first, fallback to 'products' if not created
            let uploadRes = await supabase.storage.from('banners').upload(fileName, fileData, {
                contentType: 'image/jpeg',
                upsert: true
            });

            let finalBucket = 'banners';
            if (uploadRes.error) {
                // Fallback to products bucket
                uploadRes = await supabase.storage.from('products').upload(fileName, fileData, {
                    contentType: 'image/jpeg',
                    upsert: true
                });
                finalBucket = 'products';
            }

            if (uploadRes.error) throw uploadRes.error;

            const { data: publicUrlData } = supabase.storage.from(finalBucket).getPublicUrl(fileName);
            if (publicUrlData?.publicUrl) {
                setForm(prev => ({ ...prev, image_url: publicUrlData.publicUrl }));
                Alert.alert('Success', 'Banner image uploaded successfully!');
            }
        } catch (error) {
            Alert.alert('Upload Error', error.message || 'Failed to upload banner image.');
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = (banner) => {
        setEditingId(banner.id);
        setForm({
            title: banner.title || '',
            subtitle: banner.subtitle || '',
            image_url: banner.image_url || '',
            action_link: banner.action_link || '',
            display_order: String(banner.display_order ?? 0),
            section: banner.section || 'home',
            is_active: banner.is_active ?? true
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        Alert.alert('Delete Banner', 'Are you sure you want to delete this promotional banner?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('banners').delete().eq('id', id);
                    if (error) {
                        Alert.alert('Error', error.message);
                    } else {
                        fetchBanners();
                    }
                }
            }
        ]);
    };

    const handleSave = async () => {
        if (!form.image_url) {
            Alert.alert('Error', 'Banner image is required.');
            return;
        }

        setUploading(true);
        const bannerData = {
            title: form.title || '',
            subtitle: form.subtitle || '',
            image_url: form.image_url,
            action_link: form.action_link || '',
            display_order: parseInt(form.display_order, 10) || 0,
            section: form.section || 'home',
            is_active: form.is_active ?? true
        };

        let error;
        if (editingId) {
            const { error: updateError } = await supabase
                .from('banners')
                .update(bannerData)
                .eq('id', editingId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('banners')
                .insert([bannerData]);
            error = insertError;
        }

        setUploading(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setShowForm(false);
            resetForm();
            fetchBanners();
        }
    };

    const resetForm = () => {
        setForm({ 
            title: '', 
            subtitle: '', 
            image_url: '', 
            action_link: '', 
            display_order: '0', 
            section: 'home',
            is_active: true 
        });
        setEditingId(null);
    };

    const toggleActive = async (banner) => {
        const nextState = !banner.is_active;
        const { error } = await supabase
            .from('banners')
            .update({ is_active: nextState })
            .eq('id', banner.id);
            
        if (!error) {
            setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: nextState } : b));
        } else {
            Alert.alert('Error', error.message);
        }
    };

    const filteredBanners = activeSectionFilter === 'all' 
        ? banners 
        : banners.filter(b => (b.section || 'home') === activeSectionFilter);

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="images" size={24} color={GOLD} />
                        <Text style={s.headerTitle}>Promotional Banners</Text>
                    </View>
                    <Text style={s.headerSubtitle}>Manage hero banners and store campaigns in real-time</Text>
                </View>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => { resetForm(); setShowForm(true); }}
                    style={s.createButton}
                >
                    <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                    <Text style={s.createButtonText}>+ New</Text>
                </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={s.filterTabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                    <TouchableOpacity
                        onPress={() => setActiveSectionFilter('all')}
                        style={[s.filterChip, activeSectionFilter === 'all' && s.filterChipActive]}
                    >
                        <Text style={[s.filterChipText, activeSectionFilter === 'all' && s.filterChipTextActive]}>
                            All ({banners.length})
                        </Text>
                    </TouchableOpacity>
                    {SECTIONS.map(sec => {
                        const count = banners.filter(b => (b.section || 'home') === sec).length;
                        const isActive = activeSectionFilter === sec;
                        return (
                            <TouchableOpacity
                                key={sec}
                                onPress={() => setActiveSectionFilter(sec)}
                                style={[s.filterChip, isActive && s.filterChipActive]}
                            >
                                <Text style={[s.filterChipText, isActive && s.filterChipTextActive]}>
                                    {sec.toUpperCase()} ({count})
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Content List */}
            {loading ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={s.loadingText}>Loading banners...</Text>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
                >
                    {filteredBanners.length === 0 ? (
                        <View style={s.emptyStateContainer}>
                            <View style={s.emptyIconCircle}>
                                <Ionicons name="images-outline" size={48} color={GOLD} />
                            </View>
                            <Text style={s.emptyStateTitle}>No Banners Found</Text>
                            <Text style={s.emptyStateSub}>Tap '+ New' to create a promotional banner in the selected slot.</Text>
                            <TouchableOpacity
                                onPress={() => { resetForm(); setShowForm(true); }}
                                style={s.emptyCreateBtn}
                            >
                                <Ionicons name="add" size={18} color="#FFFFFF" />
                                <Text style={s.emptyCreateBtnText}>Create Banner Now</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        filteredBanners.map(item => (
                            <View key={item.id} style={s.bannerCard}>
                                <View style={s.bannerImageWrapper}>
                                    <Image 
                                        source={{ uri: item.image_url }} 
                                        style={s.bannerImage} 
                                        resizeMode="cover" 
                                    />
                                    {/* Section Tag */}
                                    <View style={s.sectionBadge}>
                                        <Text style={s.sectionBadgeText}>{(item.section || 'home').toUpperCase()}</Text>
                                    </View>
                                    {/* Order Tag */}
                                    <View style={s.orderBadge}>
                                        <Ionicons name="swap-vertical" size={12} color="#FFFFFF" />
                                        <Text style={s.orderBadgeText}>Order: #{item.display_order ?? 0}</Text>
                                    </View>
                                </View>

                                <View style={s.cardBody}>
                                    <View style={{ flex: 1 }}>
                                        {item.title ? (
                                            <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                                        ) : (
                                            <Text style={[s.cardTitle, { color: '#94A3B8' }]}>No Title</Text>
                                        )}
                                        {item.subtitle ? (
                                            <Text style={s.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                                        ) : null}
                                        {item.action_link ? (
                                            <View style={s.linkRow}>
                                                <Ionicons name="link" size={12} color="#64748B" />
                                                <Text style={s.linkText} numberOfLines={1}>{item.action_link}</Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    {/* Status and Action Buttons */}
                                    <View style={s.cardActions}>
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => toggleActive(item)}
                                            style={[
                                                s.statusBtn,
                                                { backgroundColor: item.is_active ? '#ECFDF5' : '#F1F5F9', borderColor: item.is_active ? '#10B981' : '#CBD5E1' }
                                            ]}
                                        >
                                            <Ionicons 
                                                name={item.is_active ? "eye" : "eye-off"} 
                                                size={16} 
                                                color={item.is_active ? '#059669' : '#64748B'} 
                                            />
                                            <Text style={[s.statusBtnText, { color: item.is_active ? '#059669' : '#64748B' }]}>
                                                {item.is_active ? 'Active' : 'Hidden'}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => handleEdit(item)}
                                            style={s.editBtn}
                                        >
                                            <Ionicons name="pencil" size={16} color={NAVY} />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => handleDelete(item.id)}
                                            style={s.deleteBtn}
                                        >
                                            <Ionicons name="trash" size={16} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {/* MODAL FORM FOR ADD/EDIT */}
            <Modal
                visible={showForm}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowForm(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        {/* Modal Header */}
                        <View style={s.modalHeader}>
                            <View>
                                <Text style={s.modalTitle}>{editingId ? 'Edit Banner' : 'New Promotional Banner'}</Text>
                                <Text style={s.modalSubtitle}>Upload banner image and configure action links</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowForm(false)} style={s.closeBtn}>
                                <Ionicons name="close" size={22} color={NAVY} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                            {/* Section Picker */}
                            <Text style={s.inputLabel}>Target Section</Text>
                            <View style={s.segmentRow}>
                                {SECTIONS.map(sec => {
                                    const isSel = form.section === sec;
                                    return (
                                        <TouchableOpacity
                                            key={sec}
                                            onPress={() => setForm({ ...form, section: sec })}
                                            style={[s.segmentBtn, isSel && s.segmentBtnActive]}
                                        >
                                            <Text style={[s.segmentBtnText, isSel && s.segmentBtnTextActive]}>
                                                {sec.toUpperCase()}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Banner Image Upload Box */}
                            <Text style={s.inputLabel}>Banner Image (Required)</Text>
                            <TouchableOpacity onPress={pickImage} style={s.imageUploadArea} activeOpacity={0.8}>
                                {form.image_url ? (
                                    <View style={s.uploadedImageContainer}>
                                        <Image source={{ uri: form.image_url }} style={s.uploadedImage} resizeMode="cover" />
                                        <View style={s.imageOverlayPill}>
                                            <Ionicons name="camera" size={16} color="#FFFFFF" />
                                            <Text style={s.imageOverlayPillText}>Change Image</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={s.uploadPlaceholder}>
                                        {uploading ? (
                                            <ActivityIndicator color={GOLD} size="small" />
                                        ) : (
                                            <>
                                                <View style={s.cameraIconBg}>
                                                    <Ionicons name="cloud-upload" size={28} color={GOLD} />
                                                </View>
                                                <Text style={s.uploadTextPrimary}>Select Image from Gallery</Text>
                                                <Text style={s.uploadTextSub}>HD landscape (16:9 or 2:1)</Text>
                                            </>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Title (Optional) */}
                            <Text style={s.inputLabel}>Main Title (Optional)</Text>
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. New Fashion Arrivals & Discounts"
                                placeholderTextColor="#94A3B8"
                                value={form.title}
                                onChangeText={t => setForm({ ...form, title: t })}
                            />

                            {/* Subtitle (Optional) */}
                            <Text style={s.inputLabel}>Subtitle (Optional)</Text>
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. Up to 30% discount this week"
                                placeholderTextColor="#94A3B8"
                                value={form.subtitle}
                                onChangeText={t => setForm({ ...form, subtitle: t })}
                            />

                            {/* Action Link / Deep Link */}
                            <Text style={s.inputLabel}>Action Link / Deep Link (Optional)</Text>
                            <TextInput
                                style={s.textInput}
                                placeholder="e.g. /shop/category or product ID"
                                placeholderTextColor="#94A3B8"
                                value={form.action_link}
                                onChangeText={t => setForm({ ...form, action_link: t })}
                            />

                            {/* Display Order */}
                            <Text style={s.inputLabel}>Display Order</Text>
                            <TextInput
                                style={s.textInput}
                                placeholder="0"
                                placeholderTextColor="#94A3B8"
                                keyboardType="numeric"
                                value={form.display_order}
                                onChangeText={t => setForm({ ...form, display_order: t })}
                            />

                            {/* Save Button */}
                            <TouchableOpacity
                                style={[s.saveButton, uploading && { opacity: 0.6 }]}
                                onPress={handleSave}
                                disabled={uploading}
                                activeOpacity={0.85}
                            >
                                {uploading ? (
                                    <ActivityIndicator color={NAVY} />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Ionicons name="checkmark-circle" size={20} color={NAVY} />
                                        <Text style={s.saveButtonText}>
                                            {editingId ? 'Save Changes' : 'Publish Banner'}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <View style={{ height: 30 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    header: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: NAVY
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    createButton: {
        backgroundColor: NAVY,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: GOLD
    },
    createButtonText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 13
    },
    filterTabsContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    filterChipActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B'
    },
    filterChipTextActive: {
        color: GOLD
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    loadingText: {
        marginTop: 12,
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600'
    },
    emptyStateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: NAVY,
        marginBottom: 6
    },
    emptyStateSub: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20
    },
    emptyCreateBtn: {
        backgroundColor: NAVY,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: GOLD
    },
    emptyCreateBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14
    },
    bannerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#0E1A2E',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 6
    },
    bannerImageWrapper: {
        height: 160,
        backgroundColor: '#E2E8F0',
        position: 'relative'
    },
    bannerImage: {
        width: '100%',
        height: '100%'
    },
    sectionBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: NAVY,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: GOLD
    },
    sectionBadgeText: {
        color: GOLD,
        fontSize: 11,
        fontWeight: '800'
    },
    orderBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(14, 26, 46, 0.85)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    orderBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700'
    },
    cardBody: {
        padding: 16
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: NAVY,
        marginBottom: 4
    },
    cardSubtitle: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 8
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8
    },
    linkText: {
        fontSize: 12,
        color: '#475569',
        flex: 1
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    statusBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1
    },
    statusBtnText: {
        fontSize: 12,
        fontWeight: '700'
    },
    editBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    deleteBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FECACA'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(14, 26, 46, 0.65)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 10
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: NAVY
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
        marginTop: 14,
        marginBottom: 8
    },
    segmentRow: {
        flexDirection: 'row',
        gap: 8
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    segmentBtnActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    segmentBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B'
    },
    segmentBtnTextActive: {
        color: GOLD
    },
    imageUploadArea: {
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        backgroundColor: '#F8FAFC',
        overflow: 'hidden',
        minHeight: 140,
        justifyContent: 'center',
        alignItems: 'center'
    },
    uploadedImageContainer: {
        width: '100%',
        height: 160,
        position: 'relative'
    },
    uploadedImage: {
        width: '100%',
        height: '100%'
    },
    imageOverlayPill: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: 'rgba(14, 26, 46, 0.85)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: GOLD
    },
    imageOverlayPillText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800'
    },
    uploadPlaceholder: {
        alignItems: 'center',
        padding: 24
    },
    cameraIconBg: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    uploadTextPrimary: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY
    },
    uploadTextSub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: NAVY,
        fontWeight: '600'
    },
    saveButton: {
        backgroundColor: GOLD,
        borderRadius: 16,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        elevation: 2,
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6
    },
    saveButtonText: {
        color: NAVY,
        fontSize: 15,
        fontWeight: '900'
    }
});
