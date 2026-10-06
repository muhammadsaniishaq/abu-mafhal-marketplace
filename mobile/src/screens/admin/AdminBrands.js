import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, Image, Alert,
    Modal, TextInput, ActivityIndicator, RefreshControl, StyleSheet,
    ScrollView, Platform, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import {
    fetchAllBrands,
    saveBrand,
    deleteBrand,
    toggleBrandFeatured,
    seedPresetBrands,
    subscribeToBrandChanges,
    GLOBAL_BRAND_PRESETS
} from '../../services/brandService';

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
    slate: '#64748B',
    slateDark: '#0F172A',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderGold: 'rgba(217, 167, 58, 0.35)',
    danger: '#EF4444',
};

// Canvas compression for web
const compressImageOnWeb = (dataUrl, callback) => {
    try {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            callback(dataUrl);
            return;
        }
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const MAX_HEIGHT = 400;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => callback(dataUrl);
        img.src = dataUrl;
    } catch (e) {
        callback(dataUrl);
    }
};

export const AdminBrands = ({ navigation, onBack }) => {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState('all'); // 'all' | 'featured' | 'standard'

    // Add / Edit Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [editingBrand, setEditingBrand] = useState(null);
    const [formName, setFormName] = useState('');
    const [formLogoUrl, setFormLogoUrl] = useState('');
    const [formIsFeatured, setFormIsFeatured] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modalFeedback, setModalFeedback] = useState(null);

    // Preset Picker Modal state
    const [presetModalVisible, setPresetModalVisible] = useState(false);
    const [presetSearch, setPresetSearch] = useState('');

    useEffect(() => {
        fetchBrandsData();

        const unsubscribe = subscribeToBrandChanges((updated) => {
            if (Array.isArray(updated)) {
                setBrands(updated);
            }
        });

        const channel = supabase
            .channel('admin-brands-live-sync-v1')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'brands' }, () => {
                fetchBrandsData(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
                fetchBrandsData(true);
            })
            .subscribe();

        return () => {
            unsubscribe();
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchBrandsData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const data = await fetchAllBrands({ forceRefresh: true });
            setBrands(data || []);
        } catch (e) {
            console.error('Fetch brands error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleBack = () => {
        if (typeof onBack === 'function') {
            onBack();
        } else if (navigation && typeof navigation.goBack === 'function') {
            navigation.goBack();
        }
    };

    // Quick Image Picker (Universal Web & Native)
    const handlePickLogo = async () => {
        setUploading(true);
        setModalFeedback(null);
        try {
            if (Platform.OS === 'web' && typeof document !== 'undefined') {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';

                fileInput.onchange = async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                        setUploading(false);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        const rawDataUrl = re.target?.result;
                        if (rawDataUrl) {
                            compressImageOnWeb(rawDataUrl, (compressed) => {
                                setFormLogoUrl(compressed);
                                setUploading(false);
                                setModalFeedback({ type: 'success', text: 'Logo image attached successfully.' });
                            });
                        } else {
                            setUploading(false);
                        }
                    };
                    reader.onerror = () => {
                        setUploading(false);
                        setModalFeedback({ type: 'error', text: 'Failed to read image.' });
                    };
                    reader.readAsDataURL(file);
                };

                document.body.appendChild(fileInput);
                fileInput.click();
                setTimeout(() => {
                    if (fileInput.parentNode) fileInput.parentNode.removeChild(fileInput);
                }, 1000);
                return;
            }

            // Native Expo Image Picker
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Storage permission is required to choose brand logos.');
                setUploading(false);
                return;
            }

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
                    setFormLogoUrl(`data:image/jpeg;base64,${asset.base64}`);
                } else if (asset.uri) {
                    setFormLogoUrl(asset.uri);
                }
                setModalFeedback({ type: 'success', text: 'Logo selected.' });
            }
        } catch (err) {
            console.error('Logo picker error:', err);
            setModalFeedback({ type: 'error', text: err.message || 'Error choosing logo' });
        } finally {
            if (Platform.OS !== 'web') setUploading(false);
        }
    };

    const openAddModal = (preset = null) => {
        setEditingBrand(null);
        if (preset) {
            setFormName(preset.name);
            setFormLogoUrl(preset.logo_url);
            setFormIsFeatured(preset.is_featured !== undefined ? preset.is_featured : true);
        } else {
            setFormName('');
            setFormLogoUrl('');
            setFormIsFeatured(false);
        }
        setModalFeedback(null);
        setModalVisible(true);
    };

    const openEditModal = (brand) => {
        setEditingBrand(brand);
        setFormName(brand.name || '');
        setFormLogoUrl(brand.logo_url || '');
        setFormIsFeatured(!!brand.is_featured);
        setModalFeedback(null);
        setModalVisible(true);
    };

    const handleSaveBrand = async () => {
        if (!formName.trim()) {
            setModalFeedback({ type: 'error', text: 'Please enter a brand name.' });
            return;
        }

        try {
            setSaving(true);
            setModalFeedback(null);

            await saveBrand({
                id: editingBrand?.id,
                name: formName.trim(),
                logo_url: formLogoUrl.trim() || null,
                is_featured: formIsFeatured
            });

            setModalFeedback({
                type: 'success',
                text: `Brand "${formName.trim()}" saved successfully!`
            });

            setTimeout(() => {
                setModalVisible(false);
                fetchBrandsData(true);
            }, 750);
        } catch (err) {
            console.error('Save brand error:', err);
            setModalFeedback({ type: 'error', text: err.message || 'Failed to save brand.' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleFeatured = async (brand) => {
        try {
            // Optimistic update
            const newFeatured = !brand.is_featured;
            setBrands(prev => prev.map(b => b.id === brand.id ? { ...b, is_featured: newFeatured } : b));
            await toggleBrandFeatured(brand.id, brand.is_featured);
        } catch (e) {
            console.error('Toggle featured error:', e);
            fetchBrandsData(true);
        }
    };

    const handleDeleteBrand = (brand) => {
        const doDelete = async () => {
            try {
                setBrands(prev => prev.filter(b => b.id !== brand.id));
                await deleteBrand(brand.id);
            } catch (err) {
                console.error('Delete brand error:', err);
                fetchBrandsData(true);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Are you sure you want to delete brand "${brand.name}"?`)) {
                doDelete();
            }
        } else {
            Alert.alert(
                'Delete Brand',
                `Are you sure you want to delete "${brand.name}"?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: doDelete }
                ]
            );
        }
    };

    // 1-Tap Quick Seed of all top presets
    const handleQuickSeedAll = async () => {
        const unaddedPresets = GLOBAL_BRAND_PRESETS.filter(
            p => !brands.some(b => (b.name || '').toLowerCase() === p.name.toLowerCase())
        );

        if (unaddedPresets.length === 0) {
            if (Platform.OS === 'web') {
                window.alert('All 32 global brand presets are already in your catalog!');
            } else {
                Alert.alert('Catalog Up to Date', 'All 32 top brand presets already exist.');
            }
            return;
        }

        const confirmMsg = `Do you want to add ${unaddedPresets.length} global top brands (Apple, Samsung, Nike, Sony, etc.) with official verified logos?`;
        const executeSeed = async () => {
            setLoading(true);
            try {
                await seedPresetBrands(unaddedPresets);
                await fetchBrandsData(true);
                if (Platform.OS === 'web') {
                    window.alert(`Successfully imported ${unaddedPresets.length} global brands!`);
                } else {
                    Alert.alert('Success', `Imported ${unaddedPresets.length} global brands.`);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) executeSeed();
        } else {
            Alert.alert('Import Global Brands', confirmMsg, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Import All', onPress: executeSeed }
            ]);
        }
    };

    // Filter & Search
    const filteredBrands = useMemo(() => {
        return brands.filter(b => {
            const matchesSearch = !searchQuery.trim() ||
                (b.name || '').toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;

            if (filterTab === 'featured') return !!b.is_featured;
            if (filterTab === 'standard') return !b.is_featured;
            return true;
        });
    }, [brands, searchQuery, filterTab]);

    // Metrics
    const totalCount = brands.length;
    const featuredCount = brands.filter(b => b.is_featured).length;
    const withLogoCount = brands.filter(b => b.logo_url).length;
    const standardCount = totalCount - featuredCount;

    // Presets filtered for picker modal
    const filteredPresets = useMemo(() => {
        return GLOBAL_BRAND_PRESETS.filter(p => {
            if (!presetSearch.trim()) return true;
            return p.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
                (p.category || '').toLowerCase().includes(presetSearch.toLowerCase());
        });
    }, [presetSearch]);

    const renderBrandCard = ({ item }) => {
        const isFeatured = !!item.is_featured;
        const logoUri = item.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'Brand')}&background=0A192F&color=D9A73A&bold=true&size=128`;

        return (
            <View style={styles.brandCard}>
                {/* Logo & Info */}
                <View style={styles.brandCardHeader}>
                    <View style={styles.logoContainer}>
                        <Image
                            source={{ uri: logoUri }}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                    </View>

                    <View style={styles.brandDetails}>
                        <View style={styles.brandTitleRow}>
                            <Text style={styles.brandName} numberOfLines={1}>
                                {item.name}
                            </Text>
                            {isFeatured && (
                                <View style={styles.featuredBadge}>
                                    <Ionicons name="star" size={10} color={BRAND.gold} />
                                    <Text style={styles.featuredBadgeText}>FEATURED</Text>
                                </View>
                            )}
                        </View>

                        <Text style={styles.brandSubtitle}>
                            Official Verified Partner Store
                        </Text>
                    </View>
                </View>

                {/* Status Switch & Actions */}
                <View style={styles.brandCardFooter}>
                    <TouchableOpacity
                        onPress={() => handleToggleFeatured(item)}
                        activeOpacity={0.7}
                        style={[
                            styles.featureToggleChip,
                            isFeatured ? styles.featureToggleChipActive : styles.featureToggleChipInactive
                        ]}
                    >
                        <Ionicons
                            name={isFeatured ? "star" : "star-outline"}
                            size={14}
                            color={isFeatured ? BRAND.goldDark : BRAND.slate}
                        />
                        <Text style={[
                            styles.featureToggleChipText,
                            isFeatured ? styles.featureToggleChipTextActive : styles.featureToggleChipTextInactive
                        ]}>
                            {isFeatured ? "Featured on Home" : "Make Featured"}
                        </Text>
                        <Switch
                            value={isFeatured}
                            onValueChange={() => handleToggleFeatured(item)}
                            trackColor={{ false: '#CBD5E1', true: BRAND.goldLight }}
                            thumbColor={isFeatured ? BRAND.gold : '#94A3B8'}
                            style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }], marginLeft: 2 }}
                        />
                    </TouchableOpacity>

                    <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                            onPress={() => openEditModal(item)}
                            style={styles.actionEditBtn}
                            title="Edit"
                        >
                            <Ionicons name="create-outline" size={15} color={BRAND.navy} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleDeleteBrand(item)}
                            style={styles.actionDeleteBtn}
                            title="Delete"
                        >
                            <Ionicons name="trash-outline" size={15} color={BRAND.danger} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* ── TOP LUXURY GRADIENT HEADER ── */}
            <LinearGradient
                colors={[BRAND.navyDark, BRAND.navy, BRAND.navyLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerGradient}
            >
                <View style={styles.headerTopRow}>
                    <View style={styles.headerLeftGroup}>
                        <TouchableOpacity
                            onPress={handleBack}
                            style={styles.backButton}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
                        </TouchableOpacity>

                        <View>
                            <View style={styles.livePill}>
                                <View style={styles.liveDot} />
                                <Text style={styles.livePillText}>BRAND CENTER</Text>
                            </View>
                            <Text style={styles.headerTitle}>Featured Brands</Text>
                        </View>
                    </View>

                    <View style={styles.headerRightGroup}>
                        <TouchableOpacity
                            onPress={handleQuickSeedAll}
                            style={styles.importPresetsBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="flash" size={14} color={BRAND.gold} />
                            <Text style={styles.importPresetsBtnText}>Presets</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => openAddModal()}
                            style={styles.addBrandBtn}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="add" size={18} color={BRAND.navyDark} />
                            <Text style={styles.addBrandBtnText}>NEW</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Subtitle */}
                <Text style={styles.headerSubtitle}>
                    Curate official marketplace manufacturer brands and homepage featured stores.
                </Text>

                {/* ── 4 KPI METRIC CARDS ── */}
                <View style={styles.kpiRow}>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>TOTAL BRANDS</Text>
                        <Text style={styles.kpiValue}>{totalCount}</Text>
                        <Text style={styles.kpiSub}>In Catalog</Text>
                    </View>

                    <View style={[styles.kpiCard, styles.kpiCardFeatured]}>
                        <View style={styles.kpiLabelRow}>
                            <Ionicons name="star" size={11} color={BRAND.gold} />
                            <Text style={[styles.kpiLabel, { color: BRAND.goldDark }]}>FEATURED</Text>
                        </View>
                        <Text style={[styles.kpiValue, { color: BRAND.goldDark }]}>{featuredCount}</Text>
                        <Text style={styles.kpiSub}>On Homepage</Text>
                    </View>

                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>WITH LOGO</Text>
                        <Text style={styles.kpiValue}>{withLogoCount}</Text>
                        <Text style={styles.kpiSub}>Verified HD</Text>
                    </View>

                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>STANDARD</Text>
                        <Text style={styles.kpiValue}>{standardCount}</Text>
                        <Text style={styles.kpiSub}>Catalog Only</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* ── 1-TAP QUICK-ADD GLOBAL BRANDS STRIP ── */}
            <View style={styles.presetsStripContainer}>
                <View style={styles.presetsStripHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="sparkles" size={13} color={BRAND.gold} />
                        <Text style={styles.presetsStripTitle}>1-Tap Popular Brands</Text>
                    </View>
                    <TouchableOpacity onPress={() => setPresetModalVisible(true)}>
                        <Text style={styles.presetsViewAll}>Browse All 32 →</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetsScrollContent}
                >
                    {GLOBAL_BRAND_PRESETS.slice(0, 10).map((p, idx) => {
                        const alreadyExists = brands.some(
                            b => (b.name || '').toLowerCase() === p.name.toLowerCase()
                        );
                        return (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => openAddModal(p)}
                                style={[
                                    styles.presetChip,
                                    alreadyExists && styles.presetChipExists
                                ]}
                                activeOpacity={0.75}
                            >
                                <Image
                                    source={{ uri: p.logo_url }}
                                    style={styles.presetChipLogo}
                                    resizeMode="contain"
                                />
                                <Text style={styles.presetChipName} numberOfLines={1}>{p.name}</Text>
                                {alreadyExists ? (
                                    <Ionicons name="checkmark-circle" size={13} color={BRAND.emerald} />
                                ) : (
                                    <Ionicons name="add-circle" size={13} color={BRAND.gold} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ── SEARCH & FILTER CONTROLS ── */}
            <View style={styles.filterSection}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={16} color={BRAND.slate} />
                    <TextInput
                        placeholder="Search brands (e.g. Apple, Nike, Samsung)..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={styles.searchInput}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color={BRAND.slate} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Tabs */}
                <View style={styles.tabsRow}>
                    {[
                        { id: 'all', label: `All (${totalCount})` },
                        { id: 'featured', label: `⭐ Featured (${featuredCount})` },
                        { id: 'standard', label: `Standard (${standardCount})` }
                    ].map(tab => {
                        const active = filterTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setFilterTab(tab.id)}
                                style={[
                                    styles.tabBtn,
                                    active && styles.tabBtnActive
                                ]}
                            >
                                <Text style={[
                                    styles.tabBtnText,
                                    active && styles.tabBtnTextActive
                                ]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* ── BRAND LIST OR EMPTY STATE ── */}
            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={BRAND.gold} />
                    <Text style={styles.loadingText}>Loading brand catalog...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredBrands}
                    keyExtractor={item => String(item.id || item.name)}
                    renderItem={renderBrandCard}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchBrandsData(); }}
                            colors={[BRAND.gold, BRAND.navy]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="pricetag-outline" size={36} color={BRAND.gold} />
                            </View>
                            <Text style={styles.emptyTitle}>
                                {searchQuery ? 'No Matching Brands Found' : 'No Brands in Catalog'}
                            </Text>
                            <Text style={styles.emptySubtitle}>
                                {searchQuery
                                    ? 'Try adjusting your search query or reset filters.'
                                    : 'Start by importing official presets or adding your first custom brand.'}
                            </Text>
                            <TouchableOpacity
                                onPress={handleQuickSeedAll}
                                style={styles.emptyActionBtn}
                            >
                                <Ionicons name="flash" size={16} color={BRAND.navyDark} />
                                <Text style={styles.emptyActionBtnText}>Import Top 32 Global Brands</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            {/* ── CREATE / EDIT BRAND MODAL ── */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>
                                    {editingBrand ? 'Edit Brand' : 'Add New Brand'}
                                </Text>
                                <Text style={styles.modalSubtitle}>
                                    Configure official store presence & featured status
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={styles.modalCloseBtn}
                            >
                                <Ionicons name="close" size={20} color={BRAND.slate} />
                            </TouchableOpacity>
                        </View>

                        {/* Modal Feedback Banner */}
                        {modalFeedback && (
                            <View style={[
                                styles.feedbackBanner,
                                modalFeedback.type === 'error' ? styles.feedbackBannerError : styles.feedbackBannerSuccess
                            ]}>
                                <Ionicons
                                    name={modalFeedback.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
                                    size={16}
                                    color={modalFeedback.type === 'error' ? BRAND.danger : BRAND.emerald}
                                />
                                <Text style={[
                                    styles.feedbackBannerText,
                                    modalFeedback.type === 'error' ? styles.feedbackBannerTextError : styles.feedbackBannerTextSuccess
                                ]}>
                                    {modalFeedback.text}
                                </Text>
                            </View>
                        )}

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Logo Preview & Picker */}
                            <Text style={styles.inputLabel}>BRAND LOGO</Text>
                            <View style={styles.logoPickerRow}>
                                <View style={styles.modalLogoPreviewContainer}>
                                    {formLogoUrl ? (
                                        <Image
                                            source={{ uri: formLogoUrl }}
                                            style={styles.modalLogoPreview}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <Ionicons name="image-outline" size={32} color="#94A3B8" />
                                    )}
                                </View>

                                <View style={styles.logoPickerControls}>
                                    <TouchableOpacity
                                        onPress={handlePickLogo}
                                        disabled={uploading}
                                        style={styles.uploadLogoBtn}
                                    >
                                        {uploading ? (
                                            <ActivityIndicator size="small" color={BRAND.navyDark} />
                                        ) : (
                                            <>
                                                <Ionicons name="cloud-upload-outline" size={16} color={BRAND.navyDark} />
                                                <Text style={styles.uploadLogoBtnText}>Choose File / Photo</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setPresetModalVisible(true)}
                                        style={styles.choosePresetBtn}
                                    >
                                        <Ionicons name="sparkles-outline" size={14} color={BRAND.goldDark} />
                                        <Text style={styles.choosePresetBtnText}>Select from Presets</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Direct URL Input */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>OR DIRECT LOGO URL</Text>
                            <TextInput
                                placeholder="https://example.com/logo.png"
                                placeholderTextColor="#94A3B8"
                                value={formLogoUrl}
                                onChangeText={setFormLogoUrl}
                                style={styles.textInput}
                                autoCapitalize="none"
                            />

                            {/* Brand Name Input */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>BRAND NAME *</Text>
                            <TextInput
                                placeholder="e.g. Apple, Nike, Samsung, Sony..."
                                placeholderTextColor="#94A3B8"
                                value={formName}
                                onChangeText={setFormName}
                                style={styles.textInput}
                            />

                            {/* Featured on Homepage Toggle */}
                            <View style={styles.featuredToggleBox}>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="star" size={16} color={BRAND.gold} />
                                        <Text style={styles.featuredToggleTitle}>Featured on Homepage</Text>
                                    </View>
                                    <Text style={styles.featuredToggleSub}>
                                        Displays brand prominently in the homepage Featured Brands carousel.
                                    </Text>
                                </View>
                                <Switch
                                    value={formIsFeatured}
                                    onValueChange={setFormIsFeatured}
                                    trackColor={{ false: '#CBD5E1', true: BRAND.goldLight }}
                                    thumbColor={formIsFeatured ? BRAND.gold : '#94A3B8'}
                                />
                            </View>
                        </ScrollView>

                        {/* Modal Footer */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={styles.modalCancelBtn}
                            >
                                <Text style={styles.modalCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSaveBrand}
                                disabled={saving}
                                style={styles.modalSaveBtn}
                            >
                                <LinearGradient
                                    colors={[BRAND.navyDark, BRAND.navyLight]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.modalSaveGradient}
                                >
                                    {saving ? (
                                        <ActivityIndicator color={BRAND.gold} />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={17} color={BRAND.gold} />
                                            <Text style={styles.modalSaveBtnText}>
                                                {editingBrand ? 'Save Changes' : 'Create Brand'}
                                            </Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── ALL 32 PRESET SELECTOR MODAL ── */}
            <Modal
                visible={presetModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setPresetModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Global Brand Presets</Text>
                                <Text style={styles.modalSubtitle}>
                                    Select any world-renowned brand with verified HD logo
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setPresetModalVisible(false)}
                                style={styles.modalCloseBtn}
                            >
                                <Ionicons name="close" size={20} color={BRAND.slate} />
                            </TouchableOpacity>
                        </View>

                        {/* Preset Search */}
                        <View style={[styles.searchBar, { marginHorizontal: 16, marginTop: 12, marginBottom: 8 }]}>
                            <Ionicons name="search" size={15} color={BRAND.slate} />
                            <TextInput
                                placeholder="Search presets (e.g. Nike, Apple, Zara)..."
                                placeholderTextColor="#94A3B8"
                                value={presetSearch}
                                onChangeText={setPresetSearch}
                                style={styles.searchInput}
                            />
                        </View>

                        <FlatList
                            data={filteredPresets}
                            keyExtractor={item => item.name}
                            contentContainerStyle={{ padding: 16 }}
                            renderItem={({ item }) => {
                                const alreadyInCatalog = brands.some(
                                    b => (b.name || '').toLowerCase() === item.name.toLowerCase()
                                );
                                return (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setPresetModalVisible(false);
                                            openAddModal(item);
                                        }}
                                        style={styles.presetListItem}
                                    >
                                        <View style={styles.presetListLogoBox}>
                                            <Image
                                                source={{ uri: item.logo_url }}
                                                style={{ width: 32, height: 32 }}
                                                resizeMode="contain"
                                            />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.presetListName}>{item.name}</Text>
                                            <Text style={styles.presetListCategory}>{item.category}</Text>
                                        </View>
                                        {alreadyInCatalog ? (
                                            <View style={styles.presetStatusBadgeExists}>
                                                <Ionicons name="checkmark" size={12} color={BRAND.emerald} />
                                                <Text style={styles.presetStatusTextExists}>Added</Text>
                                            </View>
                                        ) : (
                                            <View style={styles.presetStatusBadgeAdd}>
                                                <Ionicons name="add" size={12} color={BRAND.goldDark} />
                                                <Text style={styles.presetStatusTextAdd}>Select</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BRAND.bg,
    },
    headerGradient: {
        paddingTop: Platform.OS === 'web' ? 16 : 24,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: BRAND.borderGold,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLeftGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    livePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: BRAND.borderGold,
    },
    liveDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: BRAND.gold,
    },
    livePillText: {
        fontSize: 9,
        fontWeight: '900',
        color: BRAND.gold,
        letterSpacing: 0.5,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.3,
        marginTop: 2,
    },
    headerRightGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    importPresetsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(217, 167, 58, 0.18)',
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BRAND.gold,
    },
    importPresetsBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: BRAND.gold,
    },
    addBrandBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: BRAND.gold,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        shadowColor: BRAND.gold,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 2,
    },
    addBrandBtnText: {
        fontSize: 11.5,
        fontWeight: '900',
        color: BRAND.navyDark,
        letterSpacing: 0.3,
    },
    headerSubtitle: {
        fontSize: 11.5,
        color: '#94A3B8',
        marginTop: 8,
        lineHeight: 16,
    },
    kpiRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 14,
    },
    kpiCard: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    kpiCardFeatured: {
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        borderColor: BRAND.borderGold,
    },
    kpiLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    kpiLabel: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5,
    },
    kpiValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2,
    },
    kpiSub: {
        fontSize: 8.5,
        color: '#64748B',
        marginTop: 1,
    },
    presetsStripContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: BRAND.border,
    },
    presetsStripHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    presetsStripTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: BRAND.navy,
    },
    presetsViewAll: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.goldDark,
    },
    presetsScrollContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    presetChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: BRAND.bg,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: BRAND.border,
    },
    presetChipExists: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
    },
    presetChipLogo: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    presetChipName: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.navy,
        maxWidth: 75,
    },
    filterSection: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderColor: BRAND.border,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: BRAND.bg,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: BRAND.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 12.5,
        color: BRAND.navy,
    },
    tabsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    tabBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: BRAND.bg,
        borderWidth: 1,
        borderColor: BRAND.border,
    },
    tabBtnActive: {
        backgroundColor: BRAND.navy,
        borderColor: BRAND.navy,
    },
    tabBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.slate,
    },
    tabBtnTextActive: {
        color: BRAND.gold,
        fontWeight: '800',
    },
    listContent: {
        padding: 16,
        paddingBottom: 80,
    },
    brandCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: BRAND.border,
        shadowColor: BRAND.navy,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 1,
    },
    brandCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F8FAFC',
        padding: 6,
        borderWidth: 1.5,
        borderColor: BRAND.borderGold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoImage: {
        width: 36,
        height: 36,
    },
    brandDetails: {
        flex: 1,
        marginLeft: 12,
    },
    brandTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    brandName: {
        fontSize: 14.5,
        fontWeight: '900',
        color: BRAND.navy,
        flex: 1,
    },
    featuredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: BRAND.goldLight,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: BRAND.borderGold,
    },
    featuredBadgeText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: BRAND.goldDark,
        letterSpacing: 0.3,
    },
    brandSubtitle: {
        fontSize: 11,
        color: BRAND.slate,
        marginTop: 2,
    },
    brandCardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderColor: '#F1F5F9',
    },
    featureToggleChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
    },
    featureToggleChipActive: {
        backgroundColor: BRAND.goldLight,
        borderColor: BRAND.borderGold,
    },
    featureToggleChipInactive: {
        backgroundColor: BRAND.bg,
        borderColor: BRAND.border,
    },
    featureToggleChipText: {
        fontSize: 11,
        fontWeight: '700',
    },
    featureToggleChipTextActive: {
        color: BRAND.goldDark,
        fontWeight: '800',
    },
    featureToggleChipTextInactive: {
        color: BRAND.slate,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionEditBtn: {
        backgroundColor: '#F1F5F9',
        padding: 7,
        borderRadius: 8,
    },
    actionDeleteBtn: {
        backgroundColor: '#FEE2E2',
        padding: 7,
        borderRadius: 8,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 12,
        fontWeight: '700',
        color: BRAND.slate,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
        paddingHorizontal: 24,
    },
    emptyIconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: BRAND.goldLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: BRAND.navy,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 12,
        color: BRAND.slate,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
    },
    emptyActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: BRAND.gold,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        marginTop: 18,
    },
    emptyActionBtnText: {
        fontSize: 12.5,
        fontWeight: '900',
        color: BRAND.navyDark,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(7, 20, 34, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 480,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        borderBottomWidth: 1,
        borderColor: BRAND.border,
        backgroundColor: BRAND.bg,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: BRAND.navy,
    },
    modalSubtitle: {
        fontSize: 11,
        color: BRAND.slate,
        marginTop: 2,
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedbackBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    feedbackBannerError: {
        backgroundColor: '#FEF2F2',
    },
    feedbackBannerSuccess: {
        backgroundColor: '#ECFDF5',
    },
    feedbackBannerText: {
        fontSize: 12,
        fontWeight: '700',
        flex: 1,
    },
    feedbackBannerTextError: {
        color: BRAND.danger,
    },
    feedbackBannerTextSuccess: {
        color: BRAND.emerald,
    },
    modalBody: {
        padding: 18,
        maxHeight: 400,
    },
    inputLabel: {
        fontSize: 10.5,
        fontWeight: '800',
        color: BRAND.slate,
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    logoPickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    modalLogoPreviewContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: BRAND.bg,
        borderWidth: 1.5,
        borderColor: BRAND.borderGold,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    modalLogoPreview: {
        width: 50,
        height: 50,
    },
    logoPickerControls: {
        flex: 1,
        gap: 8,
    },
    uploadLogoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: BRAND.goldLight,
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BRAND.borderGold,
    },
    uploadLogoBtnText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: BRAND.goldDark,
    },
    choosePresetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: BRAND.bg,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BRAND.border,
    },
    choosePresetBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.slate,
    },
    textInput: {
        backgroundColor: BRAND.bg,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: BRAND.border,
        fontSize: 13,
        color: BRAND.navy,
        fontWeight: '600',
    },
    featuredToggleBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFBEB',
        borderRadius: 14,
        padding: 14,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    featuredToggleTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#92400E',
    },
    featuredToggleSub: {
        fontSize: 10.5,
        color: '#B45309',
        marginTop: 3,
        lineHeight: 14,
    },
    modalFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        padding: 16,
        borderTopWidth: 1,
        borderColor: BRAND.border,
        backgroundColor: BRAND.bg,
    },
    modalCancelBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
    },
    modalCancelBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: BRAND.slate,
    },
    modalSaveBtn: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    modalSaveGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    modalSaveBtnText: {
        fontSize: 12.5,
        fontWeight: '900',
        color: BRAND.gold,
    },
    presetListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
    },
    presetListLogoBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: BRAND.bg,
        borderWidth: 1,
        borderColor: BRAND.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    presetListName: {
        fontSize: 13,
        fontWeight: '800',
        color: BRAND.navy,
    },
    presetListCategory: {
        fontSize: 11,
        color: BRAND.slate,
        marginTop: 1,
    },
    presetStatusBadgeExists: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    presetStatusTextExists: {
        fontSize: 10,
        fontWeight: '800',
        color: '#166534',
    },
    presetStatusBadgeAdd: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: BRAND.goldLight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    presetStatusTextAdd: {
        fontSize: 10,
        fontWeight: '800',
        color: BRAND.goldDark,
    },
});
