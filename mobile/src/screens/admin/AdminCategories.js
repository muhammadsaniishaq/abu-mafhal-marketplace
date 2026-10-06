import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, Image, Alert,
    Modal, TextInput, ActivityIndicator, RefreshControl, StyleSheet,
    ScrollView, Platform, Switch, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import {
    fetchAllCategories,
    saveCategory,
    deleteCategory,
    toggleCategoryStatus,
    subscribeToCategoryChanges,
    invalidateCategoryCaches,
    generateSlug
} from '../../services/categoryService';

const BRAND = {
    navyDark: '#071422',
    navy: '#0A192F',
    navyLight: '#0E2340',
    navyCard: '#112240',
    gold: '#D9A73A',
    goldLight: '#FEF3C7',
    goldGlow: '#F5C842',
    goldDark: '#A07820',
    emerald: '#10B981',
    emeraldLight: '#ECFDF5',
    sky: '#0284C7',
    skyLight: '#E0F2FE',
    slate: '#64748B',
    slateDark: '#0F172A',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderGold: 'rgba(217, 167, 58, 0.35)',
    danger: '#EF4444',
};

export const AdminCategories = ({ navigation, onBack }) => {
    const [categories, setCategories] = useState([]);
    const [productCounts, setProductCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

    // Modal state for Add / Edit
    const [modalVisible, setModalVisible] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formName, setFormName] = useState('');
    const [formSlug, setFormSlug] = useState('');
    const [formImageUrl, setFormImageUrl] = useState('');
    const [formDisplayOrder, setFormDisplayOrder] = useState('1');
    const [formIsActive, setFormIsActive] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchCategoriesAndCounts();

        // Subscribe to internal category service updates
        const unsubscribe = subscribeToCategoryChanges((newCats) => {
            if (Array.isArray(newCats)) {
                setCategories(newCats);
            }
        });

        // Also subscribe to Postgres Realtime changes
        const channel = supabase
            .channel('admin-categories-unified-v6')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
                fetchCategoriesAndCounts(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                fetchCategoriesAndCounts(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
                fetchCategoriesAndCounts(true);
            })
            .subscribe();

        return () => {
            unsubscribe();
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchCategoriesAndCounts = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [cats, prodsRes] = await Promise.all([
                fetchAllCategories({ forceRefresh: true }),
                supabase.from('products').select('id, category')
            ]);

            const prods = (Array.isArray(prodsRes?.data)) ? prodsRes.data : [];

            // Compute counts
            const counts = {};
            prods.forEach(p => {
                if (p.category) {
                    const norm = p.category.toLowerCase().trim();
                    counts[norm] = (counts[norm] || 0) + 1;
                }
            });

            setCategories(Array.isArray(cats) ? cats : []);
            setProductCounts(counts);
        } catch (e) {
            console.error('[AdminCategories] Fetch crash:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
                base64: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                if (asset.base64) {
                    setUploading(true);
                    let uploadedUrl = null;
                    const fileName = `categories/cat_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
                    
                    try {
                        const { error: uploadError } = await supabase.storage
                            .from('products')
                            .upload(fileName, decode(asset.base64), {
                                contentType: 'image/png',
                                upsert: true
                            });

                        if (!uploadError) {
                            const { data: publicUrlData } = supabase.storage
                                .from('products')
                                .getPublicUrl(fileName);
                            uploadedUrl = publicUrlData?.publicUrl;
                        }
                    } catch (_) {}

                    if (uploadedUrl) {
                        setFormImageUrl(uploadedUrl);
                    } else if (asset.base64) {
                        setFormImageUrl(`data:image/png;base64,${asset.base64}`);
                    } else {
                        setFormImageUrl(asset.uri);
                    }
                } else if (asset.uri) {
                    setFormImageUrl(asset.uri);
                }
            }
        } catch (err) {
            console.error('Image pick error:', err);
        } finally {
            setUploading(false);
        }
    };

    const openAddModal = () => {
        setEditingCategory(null);
        setFormName('');
        setFormSlug('');
        setFormImageUrl('');
        const maxOrder = categories.reduce((max, c) => Math.max(max, parseInt(c.display_order, 10) || 0), 0);
        setFormDisplayOrder(String(maxOrder + 1));
        setFormIsActive(true);
        setModalVisible(true);
    };

    const openEditModal = (cat) => {
        setEditingCategory(cat);
        setFormName(cat.name || '');
        setFormSlug(cat.slug || '');
        setFormImageUrl(cat.image_url || '');
        setFormDisplayOrder(String(cat.display_order ?? 0));
        setFormIsActive(cat.is_active !== false);
        setModalVisible(true);
    };

    const handleNameChange = (text) => {
        setFormName(text);
        if (!editingCategory) {
            setFormSlug(generateSlug(text));
        }
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            return Alert.alert('Kuskure (Error)', 'Da fatan a saka sunan Category (Please enter a category name).');
        }

        const slug = formSlug.trim() || generateSlug(formName);
        const displayOrder = parseInt(formDisplayOrder, 10) || 0;

        try {
            setSaving(true);

            await saveCategory({
                name: formName.trim(),
                slug,
                image_url: formImageUrl.trim() || null,
                display_order: displayOrder,
                is_active: formIsActive === true
            }, editingCategory);

            setModalVisible(false);
            await fetchCategoriesAndCounts(true);

            Alert.alert(
                'An Samu Nasara! 🎉',
                editingCategory
                    ? `An sabunta category "${formName.trim()}" kuma yana aiki 100% a dukkan manhajar.`
                    : `An kirkiri sabon category "${formName.trim()}" kuma ya hau kai tsaye 100%!`,
                [{ text: 'To Madalla', style: 'default' }]
            );
        } catch (err) {
            console.error('Save failed:', err);
            Alert.alert('Save Failed', err.message || 'An samu matsala wajen ajiye category.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (cat) => {
        const nextStatus = cat.is_active === false ? true : false;
        // Optimistic UI update
        setCategories(prev => prev.map(c => (c.id === cat.id || c.slug === cat.slug) ? { ...c, is_active: nextStatus } : c));

        try {
            await toggleCategoryStatus(cat);
        } catch (err) {
            console.error('Toggle status error:', err);
            // Revert
            setCategories(prev => prev.map(c => (c.id === cat.id || c.slug === cat.slug) ? { ...c, is_active: !nextStatus } : c));
            Alert.alert('Matsalar Status', 'Ba a iya canza matsayin category ba.');
        }
    };

    const deleteCat = (cat) => {
        const count = productCounts[(cat.name || '').toLowerCase().trim()] || 0;
        const warning = count > 0 ? `\n\nLURA: Wannan category yana da kayayyaki ${count} da aka danganta da shi.` : '';

        Alert.alert(
            'Goge Category (Delete)',
            `Kana da tabbacin kana son goge "${cat.name}"?${warning}`,
            [
                { text: 'A\'a (Cancel)', style: 'cancel' },
                {
                    text: 'Goge (Delete)',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setCategories(prev => prev.filter(c => c.id !== cat.id && c.slug !== cat.slug));
                            await deleteCategory(cat);
                            Alert.alert('An Goge', `An cire category "${cat.name}" cikin nasara.`);
                        } catch (delErr) {
                            Alert.alert('Delete Failed', delErr.message || 'An kasa goge category.');
                            fetchCategoriesAndCounts(true);
                        }
                    }
                }
            ]
        );
    };

    const filteredCategories = categories.filter(c => {
        const matchesQuery = !searchQuery.trim() ||
            (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.slug || '').toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesQuery) return false;

        if (statusFilter === 'active') return c.is_active !== false;
        if (statusFilter === 'inactive') return c.is_active === false;
        return true;
    });

    // Stats
    const totalCategories = categories.length;
    const activeCategories = categories.filter(c => c.is_active !== false).length;
    const inactiveCategories = categories.filter(c => c.is_active === false).length;
    const totalLinkedProds = Object.values(productCounts).reduce((sum, n) => sum + n, 0);

    return (
        <View style={s.container}>
            {/* Header Area with Luxury Navy & Gold styling */}
            <LinearGradient
                colors={[BRAND.navyDark, BRAND.navy, BRAND.navyLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.header}
            >
                <View style={s.headerTopRow}>
                    {(onBack || navigation?.goBack) && (
                        <TouchableOpacity
                            onPress={onBack || (() => navigation?.goBack())}
                            style={s.backBtn}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="arrow-back" size={20} color={BRAND.gold} />
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <View style={s.badgePill}>
                            <Ionicons name="sparkles" size={11} color={BRAND.gold} />
                            <Text style={s.badgePillTxt}>TSARIN KASUWA • TAXONOMY</Text>
                        </View>
                        <Text style={s.headerTitle}>Sarrafa Categories</Text>
                        <Text style={s.headerSubtitle}>
                            Bangarori, jerin fifiko & bayyana kai tsaye a manhaja 100%
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={openAddModal}
                        style={s.addBtn}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={[BRAND.gold, '#B8860B']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={s.addBtnGrad}
                        >
                            <Ionicons name="add" size={18} color="#071422" />
                            <Text style={s.addBtnTxt}>KARA SABO</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* 4 Top KPI Metric Cards */}
                <View style={s.kpiRow}>
                    <View style={s.kpiCard}>
                        <Text style={s.kpiValue}>{totalCategories}</Text>
                        <Text style={s.kpiLabel}>Duka (Total)</Text>
                    </View>
                    <View style={s.kpiCard}>
                        <Text style={[s.kpiValue, { color: BRAND.emerald }]}>{activeCategories}</Text>
                        <Text style={s.kpiLabel}>Masu Aiki</Text>
                    </View>
                    <View style={s.kpiCard}>
                        <Text style={[s.kpiValue, { color: BRAND.slate }]}>{inactiveCategories}</Text>
                        <Text style={s.kpiLabel}>An Dakatar</Text>
                    </View>
                    <View style={s.kpiCard}>
                        <Text style={[s.kpiValue, { color: BRAND.gold }]}>{totalLinkedProds}</Text>
                        <Text style={s.kpiLabel}>Kayayyaki</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={s.searchBar}>
                    <Ionicons name="search" size={16} color={BRAND.gold} style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Nemi category ko slug..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={s.searchInput}
                        placeholderTextColor="#94A3B8"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Pills Row */}
                <View style={s.filterPillsRow}>
                    {[
                        { key: 'all', label: `Duka (${totalCategories})` },
                        { key: 'active', label: `Masu Aiki (${activeCategories})` },
                        { key: 'inactive', label: `An Dakatar (${inactiveCategories})` },
                    ].map(f => (
                        <TouchableOpacity
                            key={f.key}
                            onPress={() => setStatusFilter(f.key)}
                            style={[s.filterPill, statusFilter === f.key && s.filterPillActive]}
                            activeOpacity={0.8}
                        >
                            <Text style={[s.filterPillTxt, statusFilter === f.key && s.filterPillTxtActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>

            {/* Content List */}
            {loading && !refreshing ? (
                <View style={s.loadingCenter}>
                    <ActivityIndicator size="large" color={BRAND.gold} />
                    <Text style={s.loadingTxt}>Ana loda categories na kasuwa...</Text>
                </View>
            ) : filteredCategories.length === 0 ? (
                <View style={s.emptyBox}>
                    <View style={s.emptyIconCircle}>
                        <Ionicons name="layers-outline" size={38} color={BRAND.gold} />
                    </View>
                    <Text style={s.emptyTitle}>Babu wani category a halin yanzu</Text>
                    <Text style={s.emptySub}>
                        {searchQuery ? 'Babu sakamako ga bincikenka.' : 'Danna "KARA SABO" a sama domin daura sabon category 100%.'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredCategories}
                    keyExtractor={item => String(item.id || item.slug)}
                    contentContainerStyle={s.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchCategoriesAndCounts(); }}
                            colors={[BRAND.gold, BRAND.navy]}
                            tintColor={BRAND.gold}
                        />
                    }
                    renderItem={({ item }) => {
                        const count = productCounts[(item.name || '').toLowerCase().trim()] || 0;
                        const isActive = item.is_active !== false;

                        return (
                            <View style={s.catCard}>
                                <View style={s.catCardLeft}>
                                    {/* Thumbnail */}
                                    <View style={s.catThumbWrap}>
                                        {item.image_url ? (
                                            <Image source={{ uri: item.image_url }} style={s.catThumbImg} />
                                        ) : (
                                            <Ionicons name={item.icon || "layers"} size={24} color={BRAND.gold} />
                                        )}
                                    </View>

                                    {/* Info */}
                                    <View style={{ flex: 1, marginRight: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <Text numberOfLines={1} style={s.catName}>
                                                {item.name}
                                            </Text>
                                            <View style={[s.statusPill, isActive ? s.statusPillActive : s.statusPillInactive]}>
                                                <Text style={[s.statusPillTxt, isActive ? s.statusPillTxtActive : s.statusPillTxtInactive]}>
                                                    {isActive ? 'YANA AIKI' : 'AN DAKATAR'}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text numberOfLines={1} style={s.catSlug}>
                                            /{item.slug || 'category'}
                                        </Text>

                                        {/* Micro stats */}
                                        <View style={s.catMetaRow}>
                                            <View style={s.metaItem}>
                                                <Ionicons name="cube-outline" size={12} color={BRAND.gold} />
                                                <Text style={s.metaTxt}>{count} kayayyaki</Text>
                                            </View>
                                            <Text style={s.metaDot}>•</Text>
                                            <View style={s.metaItem}>
                                                <Ionicons name="swap-vertical-outline" size={12} color={BRAND.slate} />
                                                <Text style={s.metaTxt}>Lambar #{item.display_order ?? 0}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={s.catActionsCol}>
                                    {/* Quick 1-Tap Toggle */}
                                    <TouchableOpacity
                                        onPress={() => handleToggleStatus(item)}
                                        style={[s.toggleBtn, isActive ? s.toggleBtnActive : s.toggleBtnInactive]}
                                        activeOpacity={0.75}
                                        title={isActive ? 'Dakatar da Category' : 'Kunna Category'}
                                    >
                                        <Ionicons
                                            name={isActive ? "checkmark-circle" : "pause-circle-outline"}
                                            size={17}
                                            color={isActive ? BRAND.emerald : BRAND.slate}
                                        />
                                    </TouchableOpacity>

                                    {/* Edit */}
                                    <TouchableOpacity
                                        onPress={() => openEditModal(item)}
                                        style={s.editBtn}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons name="pencil" size={14} color={BRAND.navy} />
                                    </TouchableOpacity>

                                    {/* Delete */}
                                    <TouchableOpacity
                                        onPress={() => deleteCat(item)}
                                        style={s.delBtn}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons name="trash-outline" size={14} color={BRAND.danger} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    }}
                />
            )}

            {/* ════ ADD / EDIT CATEGORY MODAL ════ */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.modalSheet}>
                        {/* Modal Header */}
                        <LinearGradient
                            colors={[BRAND.navyDark, BRAND.navy]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={s.modalHeader}
                        >
                            <View>
                                <Text style={s.modalTitle}>
                                    {editingCategory ? 'Gyara Category' : 'Dauki / Kara Sabon Category'}
                                </Text>
                                <Text style={s.modalSub}>
                                    Zai hau kai tsaye 100% a manhajar waya da yanar gizo
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={s.closeBtn}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </LinearGradient>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18 }}>
                            {/* Image Preview & Picker */}
                            <View style={s.imageUploadSection}>
                                <View style={s.imagePreviewBox}>
                                    {formImageUrl ? (
                                        <Image source={{ uri: formImageUrl }} style={s.imagePreviewImg} />
                                    ) : (
                                        <Ionicons name="image-outline" size={34} color={BRAND.gold} />
                                    )}
                                    {uploading && (
                                        <View style={s.uploadingOverlay}>
                                            <ActivityIndicator color={BRAND.gold} />
                                        </View>
                                    )}
                                </View>

                                <View style={{ flex: 1, gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={handlePickImage}
                                        disabled={uploading}
                                        style={s.pickImageBtn}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="cloud-upload-outline" size={15} color="#071422" />
                                        <Text style={s.pickImageTxt}>
                                            {uploading ? 'Ana lodawa...' : 'Zabi Hoto (Pick Image)'}
                                        </Text>
                                    </TouchableOpacity>

                                    <Text style={s.imageHintTxt}>
                                        Hoton murabba'i (1:1) ya fi kyau. PNG ko JPG.
                                    </Text>
                                </View>
                            </View>

                            {/* Image URL Manual Input */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Link na Hoto (Image URL kai tsaye)</Text>
                                <TextInput
                                    placeholder="https://images.unsplash.com/..."
                                    value={formImageUrl}
                                    onChangeText={setFormImageUrl}
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* Category Name */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Sunan Category (Category Name) *</Text>
                                <TextInput
                                    placeholder="misali: Kayan Mata & Turare"
                                    value={formName}
                                    onChangeText={handleNameChange}
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* Slug */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Lambar Mahada (Slug / URL Identifier)</Text>
                                <TextInput
                                    placeholder="misali: kayan-mata-turare"
                                    value={formSlug}
                                    onChangeText={setFormSlug}
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Display Order */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Lambar Tsari / Fifiko (Display Order)</Text>
                                <TextInput
                                    placeholder="misali: 1"
                                    value={formDisplayOrder}
                                    onChangeText={setFormDisplayOrder}
                                    keyboardType="numeric"
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* Active Toggle */}
                            <View style={s.switchFieldRow}>
                                <View style={{ flex: 1, paddingRight: 12 }}>
                                    <Text style={s.fieldLabel}>Bude Don Jama'a (Active Visibility)</Text>
                                    <Text style={s.switchSubTxt}>Zai fito a shafin farko da shagon kasuwa nan take</Text>
                                </View>
                                <Switch
                                    value={formIsActive}
                                    onValueChange={setFormIsActive}
                                    trackColor={{ false: '#CBD5E1', true: BRAND.emerald }}
                                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                                />
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={saving}
                                style={s.submitBtn}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={[BRAND.gold, '#B8860B']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={s.submitBtnGrad}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#071422" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={18} color="#071422" />
                                            <Text style={s.submitBtnTxt}>
                                                {editingCategory ? 'Ajiye Gyara (Update Category)' : 'Dauka & Fara Aiki (Create & Publish)'}
                                            </Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
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
        backgroundColor: '#F8FAFC',
    },
    header: {
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderColor: BRAND.borderGold,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: BRAND.borderGold,
    },
    badgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 0.8,
        borderColor: 'rgba(217, 167, 58, 0.4)',
        marginBottom: 4,
    },
    badgePillTxt: {
        color: BRAND.gold,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    headerSubtitle: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 2,
    },
    addBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: BRAND.gold,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    addBtnGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 13,
        paddingVertical: 9,
    },
    addBtnTxt: {
        color: '#071422',
        fontWeight: '900',
        fontSize: 12,
    },
    kpiRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    kpiCard: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 6,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    kpiValue: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    kpiLabel: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#94A3B8',
        marginTop: 1,
        textTransform: 'uppercase',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 42,
        borderWidth: 1.5,
        borderColor: BRAND.borderGold,
    },
    searchInput: {
        flex: 1,
        fontSize: 12.5,
        color: BRAND.slateDark,
        fontWeight: '600',
    },
    filterPillsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    filterPill: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    filterPillActive: {
        backgroundColor: BRAND.gold,
        borderColor: BRAND.gold,
    },
    filterPillTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#CBD5E1',
    },
    filterPillTxtActive: {
        color: '#071422',
        fontWeight: '900',
    },
    loadingCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingTxt: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: '700',
        color: BRAND.slate,
    },
    emptyBox: {
        paddingVertical: 60,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyIconCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: BRAND.slateDark,
    },
    emptySub: {
        fontSize: 12,
        color: BRAND.slate,
        textAlign: 'center',
        marginTop: 4,
    },
    listContent: {
        padding: 14,
        paddingBottom: 90,
        gap: 10,
    },
    catCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    catCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    catThumbWrap: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.2,
        borderColor: BRAND.borderGold,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    catThumbImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    catName: {
        fontSize: 13.5,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    catSlug: {
        fontSize: 11,
        color: BRAND.slate,
        marginTop: 1,
    },
    statusPill: {
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 5,
    },
    statusPillActive: {
        backgroundColor: '#ECFDF5',
    },
    statusPillInactive: {
        backgroundColor: '#F1F5F9',
    },
    statusPillTxt: {
        fontSize: 8.5,
        fontWeight: '900',
    },
    statusPillTxtActive: {
        color: BRAND.emerald,
    },
    statusPillTxtInactive: {
        color: BRAND.slate,
    },
    catMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    metaTxt: {
        fontSize: 10.5,
        color: BRAND.slate,
        fontWeight: '600',
    },
    metaDot: {
        color: '#CBD5E1',
        fontSize: 10,
    },
    catActionsCol: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    toggleBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleBtnActive: {
        backgroundColor: '#ECFDF5',
    },
    toggleBtnInactive: {
        backgroundColor: '#F1F5F9',
    },
    editBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    delBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Modal
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(7, 20, 34, 0.75)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        maxHeight: '90%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderColor: BRAND.borderGold,
    },
    modalTitle: {
        fontSize: 16.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    modalSub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    closeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    imageUploadSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    imagePreviewBox: {
        width: 72,
        height: 72,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: BRAND.borderGold,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    imagePreviewImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: BRAND.gold,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
    },
    pickImageTxt: {
        color: '#071422',
        fontSize: 12,
        fontWeight: '900',
    },
    imageHintTxt: {
        fontSize: 10.5,
        color: BRAND.slate,
    },
    formField: {
        marginBottom: 14,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: BRAND.slateDark,
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 13,
        color: BRAND.slateDark,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        fontWeight: '600',
    },
    switchFieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        marginBottom: 16,
    },
    switchSubTxt: {
        fontSize: 11,
        color: BRAND.slate,
        marginTop: 1,
    },
    submitBtn: {
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 6,
        marginBottom: 26,
        elevation: 3,
        shadowColor: BRAND.gold,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    submitBtnGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
    },
    submitBtnTxt: {
        color: '#071422',
        fontSize: 14,
        fontWeight: '900',
    },
});
