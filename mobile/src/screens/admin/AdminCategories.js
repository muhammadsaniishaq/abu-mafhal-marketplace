import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, Image, Alert,
    Modal, TextInput, ActivityIndicator, RefreshControl, StyleSheet,
    ScrollView, Platform, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const BRAND = {
    navy: '#0A192F',
    navyLight: '#0E223D',
    gold: '#D9A73A',
    goldLight: '#FEF3C7',
    emerald: '#10B981',
    emeraldLight: '#ECFDF5',
    sky: '#0284C7',
    skyLight: '#E0F2FE',
    slate: '#64748B',
    slateDark: '#0F172A',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    danger: '#EF4444',
};

export const AdminCategories = ({ navigation }) => {
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
    const [formDisplayOrder, setFormDisplayOrder] = useState('0');
    const [formIsActive, setFormIsActive] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchCategoriesAndCounts();

        const channel = supabase
            .channel('admin-categories-realtime-v4')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
                fetchCategoriesAndCounts(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchCategoriesAndCounts = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [catsRes, prodsRes] = await Promise.allSettled([
                supabase
                    .from('categories')
                    .select('*')
                    .order('display_order', { ascending: true, nullsFirst: false }),
                supabase
                    .from('products')
                    .select('id, category')
            ]);

            const cats = (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value?.data)) ? catsRes.value.data : [];
            const prods = (prodsRes.status === 'fulfilled' && Array.isArray(prodsRes.value?.data)) ? prodsRes.value.data : [];

            // Compute counts
            const counts = {};
            prods.forEach(p => {
                if (p.category) {
                    const norm = p.category.toLowerCase().trim();
                    counts[norm] = (counts[norm] || 0) + 1;
                }
            });

            setCategories(cats);
            setProductCounts(counts);
        } catch (e) {
            console.error('Fetch categories crash:', e);
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
                quality: 0.8,
                base64: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                if (asset.base64) {
                    setUploading(true);
                    const fileName = `cat_${Date.now()}.png`;
                    const { error: uploadError } = await supabase.storage
                        .from('product-images')
                        .upload(fileName, decode(asset.base64), {
                            contentType: 'image/png',
                            upsert: true
                        });

                    if (!uploadError) {
                        const { data: publicUrlData } = supabase.storage
                            .from('product-images')
                            .getPublicUrl(fileName);
                        setFormImageUrl(publicUrlData.publicUrl);
                    } else {
                        setFormImageUrl(asset.uri);
                    }
                } else if (asset.uri) {
                    setFormImageUrl(asset.uri);
                }
            }
        } catch (err) {
            console.error('Image pick error:', err);
            Alert.alert('Upload Error', 'Could not process selected image.');
        } finally {
            setUploading(false);
        }
    };

    const openAddModal = () => {
        setEditingCategory(null);
        setFormName('');
        setFormSlug('');
        setFormImageUrl('');
        setFormDisplayOrder(String(categories.length + 1));
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
            const generatedSlug = text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
            setFormSlug(generatedSlug);
        }
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            return Alert.alert('Validation Error', 'Please enter a category name.');
        }

        const slug = formSlug.trim() || formName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
        const displayOrder = parseInt(formDisplayOrder, 10) || 0;

        try {
            setSaving(true);

            if (editingCategory) {
                // Update
                const { error } = await supabase
                    .from('categories')
                    .update({
                        name: formName.trim(),
                        slug,
                        image_url: formImageUrl.trim() || null,
                        display_order: displayOrder,
                        is_active: formIsActive
                    })
                    .eq('id', editingCategory.id);

                if (error) throw error;
                Alert.alert('Success', 'Category updated successfully.');
            } else {
                // Insert
                const { error } = await supabase
                    .from('categories')
                    .insert([{
                        name: formName.trim(),
                        slug,
                        image_url: formImageUrl.trim() || null,
                        display_order: displayOrder,
                        is_active: formIsActive
                    }]);

                if (error) throw error;
                Alert.alert('Success', 'New category created successfully.');
            }

            setModalVisible(false);
            fetchCategoriesAndCounts();
        } catch (err) {
            Alert.alert('Error Saving', err.message || 'Failed to save category.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (cat) => {
        const nextStatus = !cat.is_active;
        // Optimistic update
        setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: nextStatus } : c));

        try {
            const { error } = await supabase
                .from('categories')
                .update({ is_active: nextStatus })
                .eq('id', cat.id);

            if (error) {
                // Revert on error
                setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !nextStatus } : c));
                Alert.alert('Error', 'Could not update category status.');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const deleteCat = (cat) => {
        const count = productCounts[(cat.name || '').toLowerCase().trim()] || 0;
        const warning = count > 0 ? ` This category currently has ${count} linked products.` : '';

        Alert.alert(
            'Delete Category',
            `Are you sure you want to delete "${cat.name}"?${warning}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase.from('categories').delete().eq('id', cat.id);
                        if (!error) {
                            setCategories(prev => prev.filter(c => c.id !== cat.id));
                            Alert.alert('Deleted', 'Category removed successfully.');
                        } else {
                            Alert.alert('Error', error.message);
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

    return (
        <View style={s.container}>
            {/* Header Area */}
            <View style={s.header}>
                <View style={s.headerTopRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>
                            Category Management
                        </Text>
                        <Text style={s.headerSubtitle}>
                            Manage marketplace departments, order priority & status
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={openAddModal}
                        style={s.addBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add" size={18} color="#FFFFFF" />
                        <Text style={s.addBtnTxt}>Add Category</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={s.searchBar}>
                    <Ionicons name="search" size={17} color={BRAND.slate} style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search category name or slug..."
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
                        { key: 'all', label: `All (${categories.length})` },
                        { key: 'active', label: `Active (${categories.filter(c => c.is_active !== false).length})` },
                        { key: 'inactive', label: `Inactive (${categories.filter(c => c.is_active === false).length})` },
                    ].map(f => (
                        <TouchableOpacity
                            key={f.key}
                            onPress={() => setStatusFilter(f.key)}
                            style={[s.filterPill, statusFilter === f.key && s.filterPillActive]}
                            activeOpacity={0.75}
                        >
                            <Text style={[s.filterPillTxt, statusFilter === f.key && s.filterPillTxtActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Content List */}
            {loading && !refreshing ? (
                <View style={s.loadingCenter}>
                    <ActivityIndicator size="large" color={BRAND.navy} />
                    <Text style={s.loadingTxt}>Loading taxonomy categories...</Text>
                </View>
            ) : filteredCategories.length === 0 ? (
                <View style={s.emptyBox}>
                    <Ionicons name="layers-outline" size={44} color="#94A3B8" />
                    <Text style={s.emptyTitle}>No categories found</Text>
                    <Text style={s.emptySub}>Try adjusting your search query or add a new category.</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredCategories}
                    keyExtractor={item => String(item.id)}
                    contentContainerStyle={s.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCategoriesAndCounts(); }} colors={[BRAND.sky, BRAND.navy]} />
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
                                            <Ionicons name="folder-outline" size={24} color={BRAND.sky} />
                                        )}
                                    </View>

                                    {/* Info */}
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <Text numberOfLines={1} style={s.catName}>
                                                {item.name}
                                            </Text>
                                            <View style={[s.statusPill, isActive ? s.statusPillActive : s.statusPillInactive]}>
                                                <Text style={[s.statusPillTxt, isActive ? s.statusPillTxtActive : s.statusPillTxtInactive]}>
                                                    {isActive ? 'ACTIVE' : 'INACTIVE'}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text numberOfLines={1} style={s.catSlug}>
                                            /{item.slug || 'category'}
                                        </Text>

                                        {/* Micro stats */}
                                        <View style={s.catMetaRow}>
                                            <View style={s.metaItem}>
                                                <Ionicons name="cube-outline" size={12} color={BRAND.slate} />
                                                <Text style={s.metaTxt}>{count} products</Text>
                                            </View>
                                            <Text style={s.metaDot}>•</Text>
                                            <View style={s.metaItem}>
                                                <Ionicons name="swap-vertical-outline" size={12} color={BRAND.slate} />
                                                <Text style={s.metaTxt}>Order: #{item.display_order ?? 0}</Text>
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
                                        title="Toggle Active Status"
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons
                                            name={isActive ? "checkmark-circle" : "ellipse-outline"}
                                            size={15}
                                            color={isActive ? BRAND.emerald : BRAND.slate}
                                        />
                                    </TouchableOpacity>

                                    {/* Edit */}
                                    <TouchableOpacity
                                        onPress={() => openEditModal(item)}
                                        style={s.editBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="pencil" size={14} color={BRAND.navy} />
                                    </TouchableOpacity>

                                    {/* Delete */}
                                    <TouchableOpacity
                                        onPress={() => deleteCat(item)}
                                        style={s.delBtn}
                                        activeOpacity={0.7}
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
                        <View style={s.modalHeader}>
                            <View>
                                <Text style={s.modalTitle}>
                                    {editingCategory ? 'Edit Category' : 'Add New Category'}
                                </Text>
                                <Text style={s.modalSub}>
                                    Configure department display details and live icon
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={s.closeBtn}>
                                <Ionicons name="close" size={20} color={BRAND.slate} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18 }}>
                            {/* Image Preview & Picker */}
                            <View style={s.imageUploadSection}>
                                <View style={s.imagePreviewBox}>
                                    {formImageUrl ? (
                                        <Image source={{ uri: formImageUrl }} style={s.imagePreviewImg} />
                                    ) : (
                                        <Ionicons name="image-outline" size={36} color="#94A3B8" />
                                    )}
                                    {uploading && (
                                        <View style={s.uploadingOverlay}>
                                            <ActivityIndicator color="#FFFFFF" />
                                        </View>
                                    )}
                                </View>

                                <View style={{ flex: 1, gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={handlePickImage}
                                        disabled={uploading}
                                        style={s.pickImageBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                                        <Text style={s.pickImageTxt}>
                                            {uploading ? 'Uploading...' : 'Choose Image'}
                                        </Text>
                                    </TouchableOpacity>

                                    <Text style={s.imageHintTxt}>
                                        Square ratio (1:1) recommended. PNG or JPG.
                                    </Text>
                                </View>
                            </View>

                            {/* Image URL Manual Input */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Image URL (Optional Direct Link)</Text>
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
                                <Text style={s.fieldLabel}>Category Name *</Text>
                                <TextInput
                                    placeholder="e.g. Phones & Tablets"
                                    value={formName}
                                    onChangeText={handleNameChange}
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* Slug */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Category Slug (URL Identifier)</Text>
                                <TextInput
                                    placeholder="e.g. phones-tablets"
                                    value={formSlug}
                                    onChangeText={setFormSlug}
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Display Order */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Display Priority / Order (Lower numbers appear first)</Text>
                                <TextInput
                                    placeholder="e.g. 1"
                                    value={formDisplayOrder}
                                    onChangeText={setFormDisplayOrder}
                                    keyboardType="numeric"
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* Active Toggle */}
                            <View style={s.switchFieldRow}>
                                <View>
                                    <Text style={s.fieldLabel}>Active Status</Text>
                                    <Text style={s.switchSubTxt}>Visible to customers on the app & web</Text>
                                </View>
                                <Switch
                                    value={formIsActive}
                                    onValueChange={setFormIsActive}
                                    trackColor={{ false: '#CBD5E1', true: BRAND.sky }}
                                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                                />
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={saving}
                                style={s.submitBtn}
                                activeOpacity={0.8}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                                        <Text style={s.submitBtnTxt}>
                                            {editingCategory ? 'Update Category' : 'Create Category'}
                                        </Text>
                                    </>
                                )}
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
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: BRAND.navy,
    },
    headerSubtitle: {
        color: BRAND.slate,
        fontSize: 11.5,
        marginTop: 2,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: BRAND.navy,
        paddingHorizontal: 13,
        paddingVertical: 8,
        borderRadius: 12,
        shadowColor: BRAND.navy,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 2,
    },
    addBtnTxt: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 42,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
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
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
    },
    filterPillActive: {
        backgroundColor: BRAND.navy,
    },
    filterPillTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.slate,
    },
    filterPillTxtActive: {
        color: '#FFFFFF',
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
    emptyTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: BRAND.slateDark,
        marginTop: 10,
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
        shadowOpacity: 0.03,
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
        borderWidth: 1,
        borderColor: '#E2E8F0',
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
        borderRadius: 6,
    },
    statusPillActive: {
        backgroundColor: '#ECFDF5',
    },
    statusPillInactive: {
        backgroundColor: '#F1F5F9',
    },
    statusPillTxt: {
        fontSize: 9,
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
        backgroundColor: 'rgba(10, 25, 47, 0.65)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: BRAND.slateDark,
    },
    modalSub: {
        fontSize: 11.5,
        color: BRAND.slate,
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
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
        borderWidth: 1,
        borderColor: '#CBD5E1',
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
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: BRAND.navy,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
    },
    pickImageTxt: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
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
        borderColor: '#E2E8F0',
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: BRAND.navy,
        paddingVertical: 14,
        borderRadius: 14,
        marginTop: 6,
        marginBottom: 24,
        shadowColor: BRAND.navy,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    submitBtnTxt: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
    },
});
