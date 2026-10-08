import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    ActivityIndicator,
    Platform,
    FlatList,
    Alert,
    StyleSheet,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { geminiService } from '../../services/geminiService';
import { Toast } from '../../components/Toast';

// ─── Compact Executive Tokens ────────────────────────────────────────────────
const C = {
    canvas: '#F8FAFC',
    card: '#FFFFFF',
    navy: '#0F172A',
    slate: '#1E293B',
    muted: '#64748B',
    subtle: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    emerald: '#059669',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    amber: '#D97706',
    amberBg: '#FFFBEB',
    amberBorder: '#FDE68A',
    rose: '#E11D48',
    roseBg: '#FFE4E6',
    roseBorder: '#FECDD3',
    indigo: '#4F46E5',
    indigoBg: '#EEF2FF',
    indigoBorder: '#C7D2FE',
    gold: '#D9A73A',
    goldBg: '#FEF9C3',
    goldBorder: '#FACC15',
    blue: '#2563EB',
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE',
};

// ─── Search Modal for Live Products ──────────────────────────────────────────
const ProductSearchModal = ({ visible, onClose, onSearch, results, onSelect, loading }) => {
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!visible) setQuery('');
    }, [visible]);

    if (!visible) return null;

    return (
        <View style={S.modalOverlay}>
            <View style={S.modalCard}>
                <View style={S.modalHeader}>
                    <View>
                        <Text style={S.modalTitle}>Link Store Product</Text>
                        <Text style={S.modalSub}>Select a live product to connect to this promo banner</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={S.iconButton}>
                        <Ionicons name="close" size={18} color={C.navy} />
                    </TouchableOpacity>
                </View>

                <View style={S.searchBar}>
                    <Ionicons name="search" size={16} color={C.muted} />
                    <TextInput
                        placeholder="Search product by name or keyword..."
                        placeholderTextColor={C.subtle}
                        value={query}
                        onChangeText={(t) => { setQuery(t); onSearch(t); }}
                        style={S.searchInput}
                        autoFocus
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => { setQuery(''); onSearch(''); }}>
                            <Ionicons name="close-circle" size={16} color={C.muted} />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                    {loading ? (
                        <View style={{ padding: 24, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color={C.navy} />
                            <Text style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>Searching store catalog...</Text>
                        </View>
                    ) : results.length === 0 ? (
                        <View style={{ padding: 24, alignItems: 'center' }}>
                            <Ionicons name="cube-outline" size={32} color={C.muted} />
                            <Text style={{ textAlign: 'center', color: C.muted, marginTop: 8, fontSize: 12 }}>
                                {query ? 'No matching products found.' : 'Type a product name to search catalog.'}
                            </Text>
                        </View>
                    ) : (
                        results.map(item => (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => { onSelect(item); onClose(); }}
                                style={S.searchResultItem}
                                activeOpacity={0.8}
                            >
                                <Image
                                    source={{ uri: item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100' }}
                                    style={S.productThumb}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={S.productTitle} numberOfLines={1}>{item.title}</Text>
                                    <Text style={S.productPrice}>₦{Number(item.price || 0).toLocaleString()}</Text>
                                </View>
                                <View style={S.selectBadge}>
                                    <Text style={S.selectBadgeText}>Select</Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </View>
        </View>
    );
};

// ─── Main AdminPromoBanners Component ─────────────────────────────────────────
export const AdminPromoBanners = ({ navigation, onBack }) => {
    // ── Live Banners State (Strictly from Supabase) ───────────────────────────
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // ── Editor State ─────────────────────────────────────────────────────────
    const [isEditing, setIsEditing] = useState(false);
    const initialPromoState = {
        id: null,
        title: '',
        subtitle: '',
        image_url: '',
        is_active: true,
        linkData: {
            text: '',
            timerEnd: '',
            productId: '',
            productName: '',
            locations: ['home'],
            discountType: 'percent',
            discountValue: ''
        },
        tempBase64: ''
    };
    const [promoBanner, setPromoBanner] = useState(initialPromoState);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // ── AI Generator State ───────────────────────────────────────────────────
    const [generatingAI, setGeneratingAI] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState(null);

    // ── Product Search Modal State ───────────────────────────────────────────
    const [searchModalVisible, setSearchModalVisible] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchingProducts, setSearchingProducts] = useState(false);

    // ── Filters & Search ─────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
    const [locationFilter, setLocationFilter] = useState('all'); // 'all', 'home', 'shop', 'landing'

    // ── Toast Notifications ──────────────────────────────────────────────────
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2600);
    };

    // ── Fetch Live Promo Banners from Supabase ────────────────────────────────
    const fetchLiveBanners = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('banners')
                .select('*')
                .eq('section', 'promo')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data && Array.isArray(data)) {
                const formatted = data.map(b => {
                    let linkData = {
                        text: '',
                        timerEnd: '',
                        productId: '',
                        productName: '',
                        locations: ['home'],
                        discountType: 'percent',
                        discountValue: ''
                    };

                    try {
                        if (b.action_link) {
                            const parsed = JSON.parse(b.action_link);
                            linkData = {
                                ...linkData,
                                ...parsed,
                                locations: Array.isArray(parsed.locations) ? parsed.locations : ['home'],
                                discountType: parsed.discountType || 'percent',
                                discountValue: parsed.discountValue || ''
                            };
                        }
                    } catch {
                        linkData.text = b.action_link || '';
                    }

                    return { ...b, linkData };
                });
                setBanners(formatted);
            } else {
                setBanners([]);
            }
        } catch (err) {
            console.error('Fetch promo banners error:', err);
            showToast('Could not load promo banners: ' + err.message, 'error');
            setBanners([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchLiveBanners();
    }, [fetchLiveBanners]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchLiveBanners();
    };

    // ── KPI Metrics (Strictly Live) ───────────────────────────────────────────
    const metrics = useMemo(() => {
        const total = banners.length;
        const activeCount = banners.filter(b => b.is_active).length;
        const timerCount = banners.filter(b => !!b.linkData?.timerEnd).length;
        const productCount = banners.filter(b => !!b.linkData?.productId).length;

        return {
            total,
            activeCount,
            timerCount,
            productCount
        };
    }, [banners]);

    // ── Filtered Banners ──────────────────────────────────────────────────────
    const filteredBanners = useMemo(() => {
        let result = banners;

        // Status filter
        if (statusFilter === 'active') {
            result = result.filter(b => b.is_active);
        } else if (statusFilter === 'inactive') {
            result = result.filter(b => !b.is_active);
        }

        // Location filter
        if (locationFilter !== 'all') {
            result = result.filter(b => b.linkData?.locations?.includes(locationFilter));
        }

        // Search query
        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            result = result.filter(b =>
                (b.title || '').toLowerCase().includes(q) ||
                (b.subtitle || '').toLowerCase().includes(q) ||
                (b.linkData?.text || '').toLowerCase().includes(q) ||
                (b.linkData?.productName || '').toLowerCase().includes(q)
            );
        }

        return result;
    }, [banners, statusFilter, locationFilter, searchQuery]);

    // ── Quick Toggle Live Status ──────────────────────────────────────────────
    const handleToggleStatus = async (banner) => {
        const newStatus = !banner.is_active;
        try {
            const { error } = await supabase
                .from('banners')
                .update({ is_active: newStatus, updated_at: new Date().toISOString() })
                .eq('id', banner.id);

            if (error) throw error;

            setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: newStatus } : b));
            showToast(`Banner marked as ${newStatus ? 'ACTIVE' : 'HIDDEN'}`, 'success');
        } catch (e) {
            showToast('Error updating status: ' + e.message, 'error');
        }
    };

    // ── Live Delete Banner ────────────────────────────────────────────────────
    const handleDelete = (id) => {
        Alert.alert(
            'Delete Promo Banner',
            'Are you sure you want to permanently delete this promo banner from the storefront?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.from('banners').delete().eq('id', id);
                            if (error) throw error;
                            showToast('Banner deleted successfully', 'success');
                            setBanners(prev => prev.filter(b => b.id !== id));
                        } catch (err) {
                            showToast('Error deleting: ' + err.message, 'error');
                        }
                    }
                }
            ]
        );
    };

    // ── Edit & Add Handlers ───────────────────────────────────────────────────
    const handleEdit = (banner) => {
        setPromoBanner({
            ...banner,
            linkData: {
                text: banner.linkData?.text || '',
                timerEnd: banner.linkData?.timerEnd || '',
                productId: banner.linkData?.productId || '',
                productName: banner.linkData?.productName || '',
                locations: banner.linkData?.locations || ['home'],
                discountType: banner.linkData?.discountType || 'percent',
                discountValue: banner.linkData?.discountValue || ''
            },
            tempBase64: ''
        });
        setAiSuggestions(null);
        setIsEditing(true);
    };

    const handleAddNew = () => {
        setPromoBanner(initialPromoState);
        setAiSuggestions(null);
        setIsEditing(true);
    };

    // ── Image Upload via Supabase Storage ─────────────────────────────────────
    const handlePickBannerImage = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission Needed', 'Please allow gallery access to pick banner image.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.85,
                base64: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setUploadingBanner(true);

                const fileName = `promo_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                const fileData = decode(asset.base64);

                let uploadRes = await supabase.storage
                    .from('banners')
                    .upload(fileName, fileData, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                let bucketUsed = 'banners';
                if (uploadRes.error) {
                    uploadRes = await supabase.storage
                        .from('products')
                        .upload(fileName, fileData, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });
                    bucketUsed = 'products';
                }

                if (uploadRes.error) {
                    showToast('Upload failed: ' + uploadRes.error.message, 'error');
                    setUploadingBanner(false);
                    return;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from(bucketUsed)
                    .getPublicUrl(fileName);

                setPromoBanner(prev => ({ ...prev, image_url: publicUrl, tempBase64: asset.base64 }));
                setUploadingBanner(false);
                showToast('Image uploaded successfully!', 'success');
            }
        } catch (error) {
            showToast('Error uploading image', 'error');
            setUploadingBanner(false);
        }
    };

    // ── Live Product Search from Supabase ─────────────────────────────────────
    const performProductSearch = async (query) => {
        setSearchingProducts(true);
        try {
            let req = supabase.from('products').select('id, name, price, images');
            if (query && query.trim().length > 0) {
                req = req.ilike('name', `%${query.trim()}%`);
            }
            const { data, error } = await req.limit(15);
            if (error) throw error;

            const formatted = (data || []).map(p => ({
                id: p.id,
                title: p.name,
                price: p.price,
                image: Array.isArray(p.images) ? p.images[0] : p.images
            }));

            setSearchResults(formatted);
        } catch {
            setSearchResults([]);
        } finally {
            setSearchingProducts(false);
        }
    };

    const handleSelectProduct = (product) => {
        setPromoBanner(prev => ({
            ...prev,
            linkData: {
                ...prev.linkData,
                productId: product.id,
                productName: product.title
            }
        }));
        showToast('Linked product: ' + product.title, 'success');
    };

    // ── Location Toggle ───────────────────────────────────────────────────────
    const toggleLocation = (loc) => {
        setPromoBanner(prev => {
            const current = prev.linkData?.locations || [];
            const next = current.includes(loc) ? current.filter(l => l !== loc) : [...current, loc];
            return {
                ...prev,
                linkData: {
                    ...prev.linkData,
                    locations: next.length > 0 ? next : ['home']
                }
            };
        });
    };

    // ── Gemini AI Copywriter Generator ────────────────────────────────────────
    const handleAIGenerate = async () => {
        if (generatingAI) return;
        setGeneratingAI(true);
        try {
            const context = {
                productName: promoBanner.linkData?.productName || '',
                subtitle: promoBanner.subtitle || '',
                discount: promoBanner.linkData?.discountValue
                    ? `${promoBanner.linkData.discountValue}${promoBanner.linkData.discountType === 'percent' ? '%' : '₦'}`
                    : '',
                base64Image: promoBanner.tempBase64 || null
            };

            const result = await geminiService.generatePromoCopy(context);
            if (result) {
                setAiSuggestions(result);
                setPromoBanner(prev => ({
                    ...prev,
                    title: result.title || prev.title,
                    subtitle: result.subtitle || prev.subtitle,
                    linkData: {
                        ...prev.linkData,
                        text: result.buttonText || prev.linkData?.text
                    }
                }));
                showToast('Gemini AI created promo copy!', 'success');
            } else {
                showToast('Could not generate copy at this time.', 'error');
            }
        } catch (e) {
            console.error('AI Copy error:', e);
            showToast('AI Error: ' + e.message, 'error');
        } finally {
            setGeneratingAI(false);
        }
    };

    // ── Save Promo Banner Live ────────────────────────────────────────────────
    const handleSavePromo = async () => {
        if (!promoBanner.image_url) {
            Alert.alert('Required Image', 'Please upload or provide a banner image URL.');
            return;
        }

        if (!promoBanner.title.trim()) {
            Alert.alert('Required Headline', 'Please specify a banner headline or use AI Copy.');
            return;
        }

        try {
            setSaving(true);
            const linkDataToSave = { ...promoBanner.linkData };
            const stringifiedLink = JSON.stringify(linkDataToSave);

            const payload = {
                title: promoBanner.title.trim(),
                subtitle: promoBanner.subtitle.trim(),
                image_url: promoBanner.image_url.trim(),
                is_active: promoBanner.is_active ?? true,
                action_link: stringifiedLink,
                section: 'promo',
                updated_at: new Date().toISOString()
            };

            if (promoBanner.id) {
                payload.id = promoBanner.id;
            }

            const { error } = await supabase.from('banners').upsert(payload);
            if (error) throw error;

            showToast('Promo banner saved live!', 'success');
            setIsEditing(false);
            fetchLiveBanners();
        } catch (err) {
            showToast('Error saving: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Render Individual Banner Card (Compact & Modern) ──────────────────────
    const renderBannerCard = ({ item }) => {
        const isActive = item.is_active;
        const hasTimer = !!item.linkData?.timerEnd;
        const hasDiscount = !!item.linkData?.discountValue;
        const hasProduct = !!item.linkData?.productId;

        return (
            <View style={S.bannerCard}>
                {/* 16:9 Live Preview Aspect */}
                <View style={S.cardHero}>
                    <Image
                        source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600' }}
                        style={S.cardHeroImage}
                    />
                    <View style={S.cardHeroOverlay} />

                    {/* Status Pill */}
                    <TouchableOpacity
                        onPress={() => handleToggleStatus(item)}
                        style={[S.statusPill, { backgroundColor: isActive ? C.emeraldBg : '#F1F5F9', borderColor: isActive ? C.emeraldBorder : C.border }]}
                    >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isActive ? C.emerald : C.muted }} />
                        <Text style={[S.statusPillText, { color: isActive ? C.emerald : C.muted }]}>
                            {isActive ? 'ACTIVE' : 'HIDDEN'}
                        </Text>
                    </TouchableOpacity>

                    {/* Overlay Headings */}
                    <View style={S.heroTextWrap}>
                        {item.subtitle ? (
                            <View style={S.badgeHighlight}>
                                <Text style={S.badgeHighlightText}>{item.subtitle.toUpperCase()}</Text>
                            </View>
                        ) : null}
                        <Text style={S.heroTitleText} numberOfLines={2}>
                            {item.title || 'Untitled Promo'}
                        </Text>
                    </View>
                </View>

                {/* Metadata Strip */}
                <View style={S.cardBody}>
                    <View style={S.metaTagsRow}>
                        {/* Locations */}
                        {(item.linkData?.locations || ['home']).map(loc => (
                            <View key={loc} style={S.locTag}>
                                <Text style={S.locTagText}>{loc.toUpperCase()}</Text>
                            </View>
                        ))}

                        {/* Linked Product */}
                        {hasProduct && (
                            <View style={S.linkedProductTag}>
                                <Ionicons name="link" size={10} color={C.indigo} />
                                <Text style={S.linkedProductText} numberOfLines={1}>
                                    {item.linkData?.productName || 'PRODUCT'}
                                </Text>
                            </View>
                        )}

                        {/* Countdown */}
                        {hasTimer && (
                            <View style={S.timerTag}>
                                <Ionicons name="time-outline" size={10} color={C.amber} />
                                <Text style={S.timerTagText}>
                                    EXP: {new Date(item.linkData.timerEnd).toLocaleDateString()}
                                </Text>
                            </View>
                        )}

                        {/* Discount */}
                        {hasDiscount && (
                            <View style={S.discountTag}>
                                <Ionicons name="pricetag-outline" size={10} color={C.emerald} />
                                <Text style={S.discountTagText}>
                                    {item.linkData.discountValue}{item.linkData.discountType === 'percent' ? '%' : '₦'} OFF
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Card Actions */}
                    <View style={S.cardActionsRow}>
                        <TouchableOpacity
                            onPress={() => handleToggleStatus(item)}
                            style={S.quickToggleBtn}
                        >
                            <Ionicons name={isActive ? 'eye-off-outline' : 'eye-outline'} size={13} color={C.slate} />
                            <Text style={S.quickToggleText}>{isActive ? 'Hide' : 'Activate'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleEdit(item)}
                            style={S.editBtn}
                        >
                            <Ionicons name="create-outline" size={13} color={C.navy} />
                            <Text style={S.editBtnText}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleDelete(item.id)}
                            style={S.deleteBtn}
                        >
                            <Ionicons name="trash-outline" size={13} color={C.rose} />
                            <Text style={S.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    // ── Editor Form View ──────────────────────────────────────────────────────
    if (isEditing) {
        return (
            <ScrollView style={S.container} contentContainerStyle={S.editScroll}>
                <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />

                {/* Compact Edit Top Bar */}
                <View style={S.editTopBar}>
                    <TouchableOpacity onPress={() => setIsEditing(false)} style={S.backButton}>
                        <Ionicons name="arrow-back" size={16} color={C.navy} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={S.headerTitle}>{promoBanner.id ? 'Edit Promo' : 'New Promo Campaign'}</Text>
                        <Text style={S.headerSubtitle}>AI Copywriting & Interactive Countdown</Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleAIGenerate}
                        disabled={generatingAI}
                        style={S.aiGenerateBtn}
                    >
                        {generatingAI ? (
                            <ActivityIndicator size="small" color={C.navy} />
                        ) : (
                            <>
                                <Ionicons name="sparkles" size={14} color={C.navy} />
                                <Text style={S.aiGenerateBtnText}>AI Copy</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ── Dynamic Live Preview Aspect ─────────────────────────────── */}
                <View style={S.livePreviewWrapper}>
                    <Text style={S.sectionLabel}>LIVE STOREFRONT PREVIEW</Text>
                    <View style={S.previewHero}>
                        <Image
                            source={{ uri: promoBanner.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600' }}
                            style={S.previewImage}
                        />
                        <View style={S.previewOverlay} />

                        {promoBanner.subtitle ? (
                            <View style={S.previewBadge}>
                                <Text style={S.previewBadgeText}>{promoBanner.subtitle.toUpperCase()}</Text>
                            </View>
                        ) : null}

                        <Text style={S.previewTitle} numberOfLines={2}>
                            {promoBanner.title || 'Enter banner headline below...'}
                        </Text>

                        {promoBanner.linkData?.text ? (
                            <View style={S.previewCtaBtn}>
                                <Text style={S.previewCtaText}>{promoBanner.linkData.text}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {/* ── Editor Form Fields ───────────────────────────────────────── */}
                <View style={S.formCard}>
                    {/* Status & Display Locations */}
                    <View style={S.rowBetween}>
                        <Text style={S.inputTitle}>BANNER STATUS</Text>
                        <TouchableOpacity
                            onPress={() => setPromoBanner(p => ({ ...p, is_active: !p.is_active }))}
                            style={[S.statusToggle, { backgroundColor: promoBanner.is_active ? C.emeraldBg : '#F1F5F9', borderColor: promoBanner.is_active ? C.emeraldBorder : C.border }]}
                        >
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: promoBanner.is_active ? C.emerald : C.muted }} />
                            <Text style={[S.statusToggleText, { color: promoBanner.is_active ? C.emerald : C.muted }]}>
                                {promoBanner.is_active ? 'ACTIVE' : 'HIDDEN'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Display Locations */}
                    <View style={{ marginTop: 12, marginBottom: 14 }}>
                        <Text style={S.inputTitle}>TARGET PAGES</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                            {['home', 'shop', 'landing'].map(loc => {
                                const selected = promoBanner.linkData?.locations?.includes(loc);
                                return (
                                    <TouchableOpacity
                                        key={loc}
                                        onPress={() => toggleLocation(loc)}
                                        style={[S.locSelectChip, selected && S.locSelectChipActive]}
                                    >
                                        <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={14} color={selected ? C.navy : C.muted} />
                                        <Text style={[S.locSelectText, selected && S.locSelectTextActive]}>
                                            {loc === 'home' ? 'Home' : loc === 'shop' ? 'Shop' : 'Landing'}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Banner Image Source */}
                    <View style={{ marginBottom: 14 }}>
                        <Text style={S.inputTitle}>BANNER IMAGE</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            <TouchableOpacity
                                onPress={handlePickBannerImage}
                                disabled={uploadingBanner}
                                style={S.uploadImageBtn}
                            >
                                {uploadingBanner ? (
                                    <ActivityIndicator size="small" color={C.navy} />
                                ) : (
                                    <>
                                        <Ionicons name="cloud-upload-outline" size={15} color={C.navy} />
                                        <Text style={S.uploadImageText}>Upload File</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TextInput
                                style={S.imageUrlInput}
                                placeholder="Or paste public image URL..."
                                placeholderTextColor={C.subtle}
                                value={promoBanner.image_url}
                                onChangeText={url => setPromoBanner(p => ({ ...p, image_url: url }))}
                            />
                        </View>
                    </View>

                    {/* Headline, Badge & Button CTA */}
                    <View style={{ gap: 10 }}>
                        <View>
                            <Text style={S.inputTitle}>MAIN HEADLINE</Text>
                            <TextInput
                                style={S.formInput}
                                placeholder="e.g. End of Month Mega Sale 50% Off"
                                placeholderTextColor={C.subtle}
                                value={promoBanner.title}
                                onChangeText={t => setPromoBanner(p => ({ ...p, title: t }))}
                            />
                            {aiSuggestions?.title && (
                                <Text style={S.aiTip}>AI Idea: {aiSuggestions.title}</Text>
                            )}
                        </View>

                        <View>
                            <Text style={S.inputTitle}>BADGE TEXT (HIGHLIGHT)</Text>
                            <TextInput
                                style={S.formInput}
                                placeholder="e.g. FLASH SALE or LIMITED TIME"
                                placeholderTextColor={C.subtle}
                                value={promoBanner.subtitle}
                                onChangeText={t => setPromoBanner(p => ({ ...p, subtitle: t }))}
                            />
                        </View>

                        <View>
                            <Text style={S.inputTitle}>BUTTON CALL-TO-ACTION</Text>
                            <TextInput
                                style={S.formInput}
                                placeholder="e.g. SHOP NOW or CLAIM 30% OFF"
                                placeholderTextColor={C.subtle}
                                value={promoBanner.linkData?.text}
                                onChangeText={t => setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, text: t } }))}
                            />
                        </View>

                        {/* Countdown Date & Linked Product */}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            {/* Countdown Date Picker */}
                            <View style={{ flex: 1 }}>
                                <Text style={S.inputTitle}>EXPIRY COUNTDOWN</Text>
                                <TouchableOpacity
                                    onPress={() => setShowDatePicker(true)}
                                    style={[S.pickerBtn, promoBanner.linkData?.timerEnd && S.pickerBtnActive]}
                                >
                                    <Text style={[S.pickerText, promoBanner.linkData?.timerEnd && S.pickerTextActive]} numberOfLines={1}>
                                        {promoBanner.linkData?.timerEnd
                                            ? new Date(promoBanner.linkData.timerEnd).toLocaleDateString()
                                            : 'Select Date...'}
                                    </Text>
                                    {promoBanner.linkData?.timerEnd ? (
                                        <TouchableOpacity onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, timerEnd: '' } }))}>
                                            <Ionicons name="close-circle" size={15} color={C.muted} />
                                        </TouchableOpacity>
                                    ) : (
                                        <Ionicons name="calendar-outline" size={15} color={C.muted} />
                                    )}
                                </TouchableOpacity>

                                {showDatePicker && (
                                    Platform.OS === 'web' ? (
                                        <View style={{ marginTop: 6 }}>
                                            <input
                                                type="date"
                                                value={promoBanner.linkData?.timerEnd || ''}
                                                onChange={(e) => {
                                                    setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, timerEnd: e.target.value } }));
                                                    setShowDatePicker(false);
                                                }}
                                                style={{
                                                    padding: '8px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #CBD5E1',
                                                    backgroundColor: '#FFFFFF',
                                                    fontSize: '12px',
                                                    color: '#0F172A',
                                                    width: '100%'
                                                }}
                                            />
                                        </View>
                                    ) : (
                                        <DateTimePicker
                                            value={promoBanner.linkData?.timerEnd ? new Date(promoBanner.linkData.timerEnd) : new Date()}
                                            mode="date"
                                            display="default"
                                            minimumDate={new Date()}
                                            onChange={(event, selectedDate) => {
                                                setShowDatePicker(Platform.OS === 'ios');
                                                if (selectedDate) {
                                                    const formatted = selectedDate.toISOString().split('T')[0];
                                                    setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, timerEnd: formatted } }));
                                                }
                                            }}
                                        />
                                    )
                                )}
                            </View>

                            {/* Linked Product Selector */}
                            <View style={{ flex: 1 }}>
                                <Text style={S.inputTitle}>LINKED PRODUCT</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        performProductSearch('');
                                        setSearchModalVisible(true);
                                    }}
                                    style={[S.pickerBtn, promoBanner.linkData?.productId && S.pickerBtnActive]}
                                >
                                    <Text style={[S.pickerText, promoBanner.linkData?.productId && S.pickerTextActive]} numberOfLines={1}>
                                        {promoBanner.linkData?.productName || 'Pick Product...'}
                                    </Text>
                                    {promoBanner.linkData?.productId ? (
                                        <TouchableOpacity onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, productId: '', productName: '' } }))}>
                                            <Ionicons name="close-circle" size={15} color={C.muted} />
                                        </TouchableOpacity>
                                    ) : (
                                        <Ionicons name="link-outline" size={15} color={C.muted} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Promotional Discount */}
                        <View style={S.discountBox}>
                            <Text style={S.inputTitle}>PROMOTIONAL DISCOUNT</Text>
                            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
                                <TouchableOpacity
                                    onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, discountType: 'percent' } }))}
                                    style={[S.discountTypeBtn, promoBanner.linkData?.discountType === 'percent' && S.discountTypeBtnActive]}
                                >
                                    <Text style={[S.discountTypeText, promoBanner.linkData?.discountType === 'percent' && S.discountTypeTextActive]}>
                                        Percentage (%)
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, discountType: 'amount' } }))}
                                    style={[S.discountTypeBtn, promoBanner.linkData?.discountType === 'amount' && S.discountTypeBtnActive]}
                                >
                                    <Text style={[S.discountTypeText, promoBanner.linkData?.discountType === 'amount' && S.discountTypeTextActive]}>
                                        Fixed (₦)
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <TextInput
                                style={S.formInput}
                                placeholder={promoBanner.linkData?.discountType === 'percent' ? 'e.g. 25' : 'e.g. 5000'}
                                placeholderTextColor={C.subtle}
                                keyboardType="numeric"
                                value={promoBanner.linkData?.discountValue}
                                onChangeText={v => setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, discountValue: v } }))}
                            />
                        </View>

                        {/* Save Banner Button */}
                        <TouchableOpacity
                            onPress={handleSavePromo}
                            disabled={saving}
                            style={S.saveButton}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                                    <Text style={S.saveButtonText}>Publish Live Promo Banner</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Product Search Modal */}
                <ProductSearchModal
                    visible={searchModalVisible}
                    onClose={() => setSearchModalVisible(false)}
                    onSearch={performProductSearch}
                    results={searchResults}
                    onSelect={handleSelectProduct}
                    loading={searchingProducts}
                />
            </ScrollView>
        );
    }

    // ── List View (Compact & Executive) ───────────────────────────────────────
    return (
        <View style={S.container}>
            <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />

            {/* ── Compact Header ────────────────────────────────────────────── */}
            <View style={S.header}>
                <View style={S.headerTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {onBack ? (
                            <TouchableOpacity onPress={onBack} style={S.backButton}>
                                <Ionicons name="arrow-back" size={16} color={C.navy} />
                            </TouchableOpacity>
                        ) : navigation?.canGoBack?.() ? (
                            <TouchableOpacity onPress={() => navigation.goBack()} style={S.backButton}>
                                <Ionicons name="arrow-back" size={16} color={C.navy} />
                            </TouchableOpacity>
                        ) : null}

                        <View>
                            <Text style={S.headerTitle}>AI Promo Banners</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <View style={S.liveDot} />
                                <Text style={S.headerSubtitle}>Countdown Campaigns & Gemini AI Copy</Text>
                            </View>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                            onPress={onRefresh}
                            style={S.iconBtn}
                            disabled={refreshing}
                        >
                            <Ionicons name="refresh" size={15} color={C.navy} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleAddNew}
                            style={S.addNewBtn}
                        >
                            <Ionicons name="add" size={15} color="#FFFFFF" />
                            <Text style={S.addNewBtnText}>New Promo</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── 4-Tile KPI Summary Ribbon ────────────────────────────── */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={S.kpiScroll}
                >
                    <View style={S.kpiCard}>
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.indigoBg }]}>
                                <Ionicons name="sparkles-outline" size={12} color={C.indigo} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.indigo, backgroundColor: '#E0E7FF' }]}>
                                CAMPAIGNS
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{metrics.total}</Text>
                        <Text style={S.kpiSub}>Total Banners</Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                        style={[S.kpiCard, statusFilter === 'active' && S.kpiCardActive]}
                    >
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.emeraldBg }]}>
                                <Ionicons name="checkmark-done-circle-outline" size={12} color={C.emerald} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.emerald, backgroundColor: '#DCFCE7' }]}>
                                LIVE NOW
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{metrics.activeCount}</Text>
                        <Text style={S.kpiSub}>Active On Store</Text>
                    </TouchableOpacity>

                    <View style={S.kpiCard}>
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.amberBg }]}>
                                <Ionicons name="hourglass-outline" size={12} color={C.amber} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.amber, backgroundColor: '#FEF3C7' }]}>
                                TIMERS
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{metrics.timerCount}</Text>
                        <Text style={S.kpiSub}>Countdown Deals</Text>
                    </View>

                    <View style={S.kpiCard}>
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.blueBg }]}>
                                <Ionicons name="link-outline" size={12} color={C.blue} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.blue, backgroundColor: '#DBEAFE' }]}>
                                LINKED
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{metrics.productCount}</Text>
                        <Text style={S.kpiSub}>Direct Products</Text>
                    </View>
                </ScrollView>
            </View>

            {/* ── Search & Filter Controls ────────────────────────────────── */}
            <View style={S.filterSection}>
                <View style={S.searchBox}>
                    <Ionicons name="search" size={15} color={C.muted} />
                    <TextInput
                        style={S.searchInput}
                        placeholder="Search headline, badge, product link..."
                        placeholderTextColor={C.subtle}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={15} color={C.muted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Tabs & Location Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.tabRow}>
                    {[
                        { id: 'all', label: 'All Banners' },
                        { id: 'active', label: 'Active Live' },
                        { id: 'inactive', label: 'Hidden' }
                    ].map(tab => {
                        const active = statusFilter === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setStatusFilter(tab.id)}
                                style={[S.tabPill, active && S.tabPillActive]}
                            >
                                <Text style={[S.tabPillText, active && S.tabPillTextActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}

                    <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 2 }} />

                    {[
                        { id: 'all', label: 'All Pages' },
                        { id: 'home', label: 'Home Page' },
                        { id: 'shop', label: 'Shop' },
                        { id: 'landing', label: 'Landing' }
                    ].map(loc => {
                        const active = locationFilter === loc.id;
                        return (
                            <TouchableOpacity
                                key={loc.id}
                                onPress={() => setLocationFilter(loc.id)}
                                style={[S.chipPill, active && S.chipPillActive]}
                            >
                                <Text style={[S.chipPillText, active && S.chipPillTextActive]}>{loc.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ── Main List ───────────────────────────────────────────────── */}
            {loading && !refreshing ? (
                <View style={S.centerLoader}>
                    <ActivityIndicator size="small" color={C.navy} />
                    <Text style={S.loaderText}>Syncing live AI promo banners...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredBanners}
                    renderItem={renderBannerCard}
                    keyExtractor={item => item.id ? item.id.toString() : Math.random().toString()}
                    contentContainerStyle={S.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.navy, C.gold]} />
                    }
                    ListEmptyComponent={
                        <View style={S.emptyStateBox}>
                            <View style={S.emptyIconWrap}>
                                <Ionicons name="sparkles-outline" size={32} color={C.gold} />
                            </View>
                            <Text style={S.emptyTitle}>No Live Promo Banners</Text>
                            <Text style={S.emptySubtitle}>
                                {searchQuery
                                    ? `No campaigns match "${searchQuery}".`
                                    : 'Create your first interactive countdown promo with Gemini AI copywriting.'}
                            </Text>
                            <TouchableOpacity
                                onPress={handleAddNew}
                                style={S.createEmptyBtn}
                            >
                                <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                                <Text style={S.createEmptyBtnText}>+ Create Promo with AI</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    );
};

// ─── Compact Stylesheet ──────────────────────────────────────────────────────
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.canvas
    },
    header: {
        backgroundColor: C.card,
        paddingTop: 12,
        paddingBottom: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: C.border
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    backButton: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3
    },
    headerSubtitle: {
        fontSize: 10,
        fontWeight: '600',
        color: C.muted
    },
    liveDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: C.emerald
    },
    iconBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    addNewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: C.navy
    },
    addNewBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800'
    },
    kpiScroll: {
        gap: 8,
        paddingRight: 6
    },
    kpiCard: {
        width: 122,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 10,
        padding: 9
    },
    kpiCardActive: {
        borderColor: C.navy,
        backgroundColor: '#FFFFFF',
        shadowColor: C.navy,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1
    },
    kpiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    kpiIconWrap: {
        width: 22,
        height: 22,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center'
    },
    kpiBadge: {
        fontSize: 7.5,
        fontWeight: '900',
        paddingHorizontal: 4,
        paddingVertical: 1.5,
        borderRadius: 3
    },
    kpiValue: {
        fontSize: 15,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3
    },
    kpiSub: {
        fontSize: 9.5,
        fontWeight: '600',
        color: C.muted,
        marginTop: 1
    },
    filterSection: {
        backgroundColor: C.card,
        paddingHorizontal: 14,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: C.border
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: C.canvas,
        borderRadius: 9,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 8
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        color: C.navy,
        padding: 0
    },
    tabRow: {
        gap: 6,
        marginBottom: 2
    },
    tabPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    tabPillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy
    },
    tabPillText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: C.muted
    },
    tabPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '800'
    },
    chipPill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    chipPillActive: {
        backgroundColor: '#E0E7FF',
        borderColor: C.indigoBorder
    },
    chipPillText: {
        fontSize: 10,
        fontWeight: '700',
        color: C.muted
    },
    chipPillTextActive: {
        color: C.indigo,
        fontWeight: '800'
    },
    listContent: {
        padding: 12,
        paddingBottom: 90
    },
    bannerCard: {
        backgroundColor: C.card,
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
        shadowColor: C.navy,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1
    },
    cardHero: {
        height: 125,
        backgroundColor: C.navy,
        position: 'relative',
        justifyContent: 'flex-end',
        padding: 12
    },
    cardHeroImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        opacity: 0.5
    },
    cardHeroOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)'
    },
    statusPill: {
        position: 'absolute',
        top: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 5,
        borderWidth: 1
    },
    statusPillText: {
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.4
    },
    heroTextWrap: {
        zIndex: 2
    },
    badgeHighlight: {
        alignSelf: 'flex-start',
        backgroundColor: C.rose,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
        marginBottom: 3
    },
    badgeHighlightText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    heroTitleText: {
        color: '#FFFFFF',
        fontSize: 14.5,
        fontWeight: '900',
        lineHeight: 18
    },
    cardBody: {
        padding: 10
    },
    metaTagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
        marginBottom: 8
    },
    locTag: {
        backgroundColor: C.canvas,
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: C.borderLight
    },
    locTagText: {
        fontSize: 9,
        fontWeight: '800',
        color: C.muted
    },
    linkedProductTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: C.indigoBg,
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 4
    },
    linkedProductText: {
        fontSize: 9,
        fontWeight: '800',
        color: C.indigo
    },
    timerTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: C.amberBg,
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 4
    },
    timerTagText: {
        fontSize: 9,
        fontWeight: '800',
        color: C.amber
    },
    discountTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: C.emeraldBg,
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 4
    },
    discountTagText: {
        fontSize: 9,
        fontWeight: '800',
        color: C.emerald
    },
    cardActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: C.borderLight
    },
    quickToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    quickToggleText: {
        fontSize: 10,
        fontWeight: '700',
        color: C.slate
    },
    editBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: C.blueBg,
        borderWidth: 1,
        borderColor: C.blueBorder
    },
    editBtnText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.blue
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: C.roseBg,
        borderWidth: 1,
        borderColor: C.roseBorder
    },
    deleteBtnText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.rose
    },
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30
    },
    loaderText: {
        marginTop: 8,
        fontSize: 11,
        fontWeight: '600',
        color: C.muted
    },
    emptyStateBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        backgroundColor: C.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        marginTop: 14
    },
    emptyIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: C.canvas,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: C.navy,
        marginBottom: 3
    },
    emptySubtitle: {
        fontSize: 11,
        color: C.muted,
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 14
    },
    createEmptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: C.navy
    },
    createEmptyBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800'
    },
    editScroll: {
        padding: 12,
        paddingBottom: 90
    },
    editTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12
    },
    aiGenerateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: C.goldBg,
        borderWidth: 1,
        borderColor: C.goldBorder
    },
    aiGenerateBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.navy
    },
    livePreviewWrapper: {
        marginBottom: 12
    },
    sectionLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: C.muted,
        marginBottom: 4,
        letterSpacing: 0.5
    },
    previewHero: {
        height: 120,
        backgroundColor: C.navy,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        justifyContent: 'flex-end',
        padding: 12,
        borderWidth: 1,
        borderColor: C.border
    },
    previewImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        opacity: 0.5
    },
    previewOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)'
    },
    previewBadge: {
        alignSelf: 'flex-start',
        backgroundColor: C.rose,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 3,
        marginBottom: 3
    },
    previewBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '900'
    },
    previewTitle: {
        color: '#FFFFFF',
        fontSize: 13.5,
        fontWeight: '900',
        lineHeight: 17
    },
    previewCtaBtn: {
        alignSelf: 'flex-start',
        backgroundColor: C.gold,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        marginTop: 6
    },
    previewCtaText: {
        color: C.navy,
        fontSize: 8.5,
        fontWeight: '900'
    },
    formCard: {
        backgroundColor: C.card,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: C.border
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    inputTitle: {
        fontSize: 9.5,
        fontWeight: '800',
        color: C.muted,
        letterSpacing: 0.4
    },
    statusToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1
    },
    statusToggleText: {
        fontSize: 9,
        fontWeight: '800'
    },
    locSelectChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    locSelectChipActive: {
        backgroundColor: '#FFFBEB',
        borderColor: C.goldBorder
    },
    locSelectText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: C.muted
    },
    locSelectTextActive: {
        color: C.navy,
        fontWeight: '800'
    },
    uploadImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    uploadImageText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.navy
    },
    imageUrlInput: {
        flex: 1,
        backgroundColor: C.canvas,
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 7,
        fontSize: 11,
        color: C.navy,
        borderWidth: 1,
        borderColor: C.border
    },
    formInput: {
        backgroundColor: C.canvas,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 12,
        color: C.navy,
        borderWidth: 1,
        borderColor: C.border,
        marginTop: 4
    },
    aiTip: {
        fontSize: 10,
        color: C.emerald,
        fontWeight: '700',
        marginTop: 3
    },
    pickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: C.canvas,
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: C.border,
        marginTop: 4
    },
    pickerBtnActive: {
        backgroundColor: '#FFFBEB',
        borderColor: C.goldBorder
    },
    pickerText: {
        fontSize: 11,
        color: C.muted,
        fontWeight: '600',
        flex: 1
    },
    pickerTextActive: {
        color: C.navy,
        fontWeight: '800'
    },
    discountBox: {
        backgroundColor: C.canvas,
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: C.borderLight,
        marginTop: 4
    },
    discountTypeBtn: {
        flex: 1,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center'
    },
    discountTypeBtnActive: {
        backgroundColor: C.navy,
        borderColor: C.navy
    },
    discountTypeText: {
        fontSize: 10,
        fontWeight: '700',
        color: C.muted
    },
    discountTypeTextActive: {
        color: '#FFFFFF',
        fontWeight: '800'
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: C.navy,
        paddingVertical: 12,
        borderRadius: 9,
        marginTop: 8
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800'
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        padding: 14,
        zIndex: 99
    },
    modalCard: {
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 14,
        maxHeight: '75%',
        borderWidth: 1,
        borderColor: C.border
    },
    modalTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: C.navy
    },
    modalSub: {
        fontSize: 10,
        color: C.muted,
        marginTop: 1
    },
    iconButton: {
        width: 26,
        height: 26,
        borderRadius: 6,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: C.canvas,
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: C.border,
        marginVertical: 10
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 7,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.borderLight
    },
    productThumb: {
        width: 34,
        height: 34,
        borderRadius: 6,
        backgroundColor: '#E2E8F0'
    },
    productTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: C.navy
    },
    productPrice: {
        fontSize: 10.5,
        fontWeight: '700',
        color: C.gold,
        marginTop: 1
    },
    selectBadge: {
        backgroundColor: C.navy,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    selectBadgeText: {
        color: '#FFFFFF',
        fontSize: 9.5,
        fontWeight: '800'
    }
});
