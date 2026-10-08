import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

// ─── Balanced Executive Design Tokens ─────────────────────────────────────────
// Calibrated for optimal visual harmony: never too small, never bulky
const C = {
    canvas: '#F8FAFC',
    card: '#FFFFFF',
    navy: '#0F172A',
    navySoft: '#1E293B',
    slate: '#334155',
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
    purple: '#7C3AED',
    purpleBg: '#F5F3FF',
    purpleBorder: '#DDD6FE'
};

// Preset Luxury Gradients & Background Themes for Quick Creative Polish
const BANNER_THEMES = [
    { id: 'midnight', name: 'Midnight Onyx', bg: '#0F172A', border: '#334155', accent: '#D9A73A' },
    { id: 'sunset', name: 'Sunset Crimson', bg: '#881337', border: '#BE123C', accent: '#FACC15' },
    { id: 'cyber', name: 'Cyber Indigo', bg: '#312E81', border: '#4338CA', accent: '#38BDF8' },
    { id: 'emerald', name: 'Emerald Boost', bg: '#064E3B', border: '#047857', accent: '#34D399' },
    { id: 'royal', name: 'Royal Sapphire', bg: '#1E3A8A', border: '#1D4ED8', accent: '#F59E0B' }
];

// AI Campaign Tones
const AI_CAMPAIGN_TONES = [
    { id: 'urgency', label: 'Flash Deal (FOMO)', icon: 'flash' },
    { id: 'luxury', label: 'Luxury & Premium', icon: 'diamond' },
    { id: 'weekend', label: 'Weekend Special', icon: 'calendar' },
    { id: 'clearance', label: 'Mega Discount', icon: 'pricetag' }
];

// Helper: Calculate Remaining Countdown Time string
const formatRemainingTime = (dateStr) => {
    if (!dateStr) return null;
    try {
        const target = new Date(dateStr).getTime();
        const now = Date.now();
        const diff = target - now;
        if (diff <= 0) return 'Expired';
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (days > 0) return `${days}d ${hours}h left`;
        return `${hours}h ${mins}m left`;
    } catch {
        return null;
    }
};

// ─── Product Linker Modal ─────────────────────────────────────────────────────
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
                    <View style={{ flex: 1 }}>
                        <Text style={S.modalTitle}>Link Catalog Product</Text>
                        <Text style={S.modalSub}>Select a store item to connect to this promo campaign</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={S.modalCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={18} color={C.navy} />
                    </TouchableOpacity>
                </View>

                <View style={S.searchBar}>
                    <Ionicons name="search" size={17} color={C.muted} />
                    <TextInput
                        placeholder="Search product by name or keyword..."
                        placeholderTextColor={C.subtle}
                        value={query}
                        onChangeText={(t) => { setQuery(t); onSearch(t); }}
                        style={S.modalSearchInput}
                        autoFocus
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => { setQuery(''); onSearch(''); }}>
                            <Ionicons name="close-circle" size={17} color={C.muted} />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
                    {loading ? (
                        <View style={{ padding: 32, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color={C.navy} />
                            <Text style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Searching live inventory...</Text>
                        </View>
                    ) : results.length === 0 ? (
                        <View style={{ padding: 32, alignItems: 'center' }}>
                            <Ionicons name="cube-outline" size={36} color={C.muted} />
                            <Text style={{ textAlign: 'center', color: C.muted, marginTop: 10, fontSize: 13, lineHeight: 18 }}>
                                {query ? 'No matching products found.' : 'Type a product name to search the catalog.'}
                            </Text>
                        </View>
                    ) : (
                        results.map(item => (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => { onSelect(item); onClose(); }}
                                style={S.searchResultItem}
                                activeOpacity={0.75}
                            >
                                <Image
                                    source={{ uri: item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120' }}
                                    style={S.productThumb}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={S.productTitle} numberOfLines={1}>{item.title}</Text>
                                    <Text style={S.productPrice}>₦{Number(item.price || 0).toLocaleString()}</Text>
                                </View>
                                <View style={S.selectBadge}>
                                    <Text style={S.selectBadgeText}>Link Product</Text>
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
    // ── Live Banners State ────────────────────────────────────────────────────
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
        theme_id: 'midnight',
        is_active: true,
        linkData: {
            text: 'Shop Deal Now →',
            timerEnd: '',
            productId: '',
            productName: '',
            productPrice: '',
            locations: ['home'],
            discountType: 'percent',
            discountValue: '20'
        },
        tempBase64: ''
    };
    const [promoBanner, setPromoBanner] = useState(initialPromoState);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // ── AI Generator State ───────────────────────────────────────────────────
    const [generatingAI, setGeneratingAI] = useState(false);
    const [aiTone, setAiTone] = useState('urgency');
    const [aiSuggestions, setAiSuggestions] = useState(null);

    // ── Product Search Modal State ───────────────────────────────────────────
    const [searchModalVisible, setSearchModalVisible] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchingProducts, setSearchingProducts] = useState(false);

    // ── Filters & Search ─────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
    const [locationFilter, setLocationFilter] = useState('all'); // 'all', 'home', 'shop', 'landing'

    // ── Live Ticking for Countdown Simulator ──────────────────────────────────
    const [clockNow, setClockNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setClockNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

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
                        text: 'Shop Deal Now →',
                        timerEnd: '',
                        productId: '',
                        productName: '',
                        productPrice: '',
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
                                locations: Array.isArray(parsed.locations) && parsed.locations.length > 0 ? parsed.locations : ['home'],
                                discountType: parsed.discountType || 'percent',
                                discountValue: parsed.discountValue || ''
                            };
                        }
                    } catch {
                        linkData.text = b.action_link || 'Shop Deal Now →';
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

        // Real-Time Supabase Sync
        const channel = supabase
            .channel('promo_banners_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, (payload) => {
                if (payload.new?.section === 'promo' || payload.old?.section === 'promo') {
                    fetchLiveBanners();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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
            // Optimistic update
            setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: newStatus } : b));

            const { error } = await supabase
                .from('banners')
                .update({ is_active: newStatus, updated_at: new Date().toISOString() })
                .eq('id', banner.id);

            if (error) {
                // Rollback
                setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: !newStatus } : b));
                throw error;
            }

            showToast(`Campaign is now ${newStatus ? 'LIVE ON STORE' : 'PAUSED'}`, 'success');
        } catch (e) {
            showToast('Error updating status: ' + e.message, 'error');
        }
    };

    // ── Duplicate / Clone Banner ──────────────────────────────────────────────
    const handleCloneBanner = async (banner) => {
        try {
            const clonedPayload = {
                title: `${banner.title} (Copy)`,
                subtitle: banner.subtitle || '',
                image_url: banner.image_url || '',
                is_active: false,
                action_link: JSON.stringify(banner.linkData || {}),
                section: 'promo',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase.from('banners').insert([clonedPayload]).select();
            if (error) throw error;

            showToast('Campaign duplicated as draft!', 'success');
            fetchLiveBanners();
        } catch (err) {
            showToast('Clone failed: ' + err.message, 'error');
        }
    };

    // ── Live Delete Banner ────────────────────────────────────────────────────
    const handleDelete = (id) => {
        Alert.alert(
            'Delete Promo Campaign',
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
                            showToast('Banner deleted permanently', 'success');
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
            theme_id: banner.theme_id || 'midnight',
            linkData: {
                text: banner.linkData?.text || 'Shop Deal Now →',
                timerEnd: banner.linkData?.timerEnd || '',
                productId: banner.linkData?.productId || '',
                productName: banner.linkData?.productName || '',
                productPrice: banner.linkData?.productPrice || '',
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

    // ── Quick Date Presets ────────────────────────────────────────────────────
    const applyDatePreset = (daysToAdd) => {
        const d = new Date();
        d.setDate(d.getDate() + daysToAdd);
        d.setHours(23, 59, 59, 0);
        const iso = d.toISOString().split('T')[0];
        setPromoBanner(p => ({
            ...p,
            linkData: { ...p.linkData, timerEnd: iso }
        }));
        showToast(`Expiry set to +${daysToAdd} days (${iso})`, 'success');
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
            title: prev.title || `Special Deal: ${product.title}`,
            linkData: {
                ...prev.linkData,
                productId: product.id,
                productName: product.title,
                productPrice: product.price || ''
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
            const selectedToneObj = AI_CAMPAIGN_TONES.find(t => t.id === aiTone) || AI_CAMPAIGN_TONES[0];
            const context = {
                productName: promoBanner.linkData?.productName || '',
                subtitle: `${selectedToneObj.label} ${promoBanner.subtitle || ''}`,
                discount: promoBanner.linkData?.discountValue
                    ? `${promoBanner.linkData.discountValue}${promoBanner.linkData.discountType === 'percent' ? '%' : '₦'}`
                    : '25%',
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
                showToast('Gemini AI created high-converting copy!', 'success');
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
        if (!promoBanner.title.trim()) {
            Alert.alert('Headline Required', 'Please enter a campaign headline or click "AI Copy" to generate one.');
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

            showToast('Campaign successfully published live!', 'success');
            setIsEditing(false);
            fetchLiveBanners();
        } catch (err) {
            showToast('Error saving: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Render Individual Banner Card (Balanced & Modern) ─────────────────────
    const renderBannerCard = ({ item }) => {
        const isActive = item.is_active;
        const countdownText = formatRemainingTime(item.linkData?.timerEnd);
        const hasDiscount = !!item.linkData?.discountValue;
        const hasProduct = !!item.linkData?.productId;

        return (
            <View style={S.bannerCard}>
                {/* 16:9 Hero Container with Contrast Overlay */}
                <View style={S.cardHero}>
                    <Image
                        source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600' }}
                        style={S.cardHeroImage}
                    />
                    <View style={S.cardHeroOverlay} />

                    {/* Top Row: Urgency Tag + Live Status Pill */}
                    <View style={S.cardHeroTop}>
                        {countdownText ? (
                            <View style={[S.timerPill, countdownText === 'Expired' && S.timerPillExpired]}>
                                <Ionicons name="time-outline" size={12} color={countdownText === 'Expired' ? C.rose : '#FFFFFF'} />
                                <Text style={[S.timerPillText, countdownText === 'Expired' && { color: C.rose }]}>
                                    {countdownText}
                                </Text>
                            </View>
                        ) : (
                            <View style={S.timerPill}>
                                <Ionicons name="flash" size={11} color={C.gold} />
                                <Text style={S.timerPillText}>STORE PROMO</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={() => handleToggleStatus(item)}
                            style={[S.statusPill, { backgroundColor: isActive ? C.emeraldBg : '#FFFFFF', borderColor: isActive ? C.emeraldBorder : C.border }]}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: isActive ? C.emerald : C.muted }} />
                            <Text style={[S.statusPillText, { color: isActive ? C.emerald : C.muted }]}>
                                {isActive ? 'ACTIVE' : 'PAUSED'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Overlay Content */}
                    <View style={S.heroBottomTextWrap}>
                        {item.subtitle ? (
                            <View style={S.badgeHighlight}>
                                <Text style={S.badgeHighlightText}>{item.subtitle.toUpperCase()}</Text>
                            </View>
                        ) : null}
                        <Text style={S.heroTitleText} numberOfLines={2}>
                            {item.title || 'Untitled Promo Campaign'}
                        </Text>
                    </View>
                </View>

                {/* Metadata Details Body */}
                <View style={S.cardBody}>
                    <View style={S.metaTagsRow}>
                        {/* Display Surface Locations */}
                        {(item.linkData?.locations || ['home']).map(loc => (
                            <View key={loc} style={S.locTag}>
                                <Ionicons name="location-outline" size={11} color={C.slate} />
                                <Text style={S.locTagText}>{loc.toUpperCase()}</Text>
                            </View>
                        ))}

                        {/* Linked Product Badge */}
                        {hasProduct && (
                            <View style={S.linkedProductTag}>
                                <Ionicons name="cube-outline" size={11} color={C.indigo} />
                                <Text style={S.linkedProductText} numberOfLines={1}>
                                    {item.linkData?.productName || 'Product'}
                                </Text>
                            </View>
                        )}

                        {/* Discount Badge */}
                        {hasDiscount && (
                            <View style={S.discountTag}>
                                <Ionicons name="pricetag-outline" size={11} color={C.emerald} />
                                <Text style={S.discountTagText}>
                                    {item.linkData.discountValue}{item.linkData.discountType === 'percent' ? '%' : '₦'} OFF
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Action Bar */}
                    <View style={S.cardActionsRow}>
                        <TouchableOpacity
                            onPress={() => handleToggleStatus(item)}
                            style={S.quickToggleBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name={isActive ? 'pause-outline' : 'play-outline'} size={14} color={C.slate} />
                            <Text style={S.quickToggleText}>{isActive ? 'Pause' : 'Activate'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleCloneBanner(item)}
                            style={S.cloneBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="copy-outline" size={13} color={C.purple} />
                            <Text style={S.cloneBtnText}>Clone</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleEdit(item)}
                            style={S.editBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="create-outline" size={13} color={C.blue} />
                            <Text style={S.editBtnText}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleDelete(item.id)}
                            style={S.deleteBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="trash-outline" size={13} color={C.rose} />
                            <Text style={S.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    // ── Editor Form View (Balanced & Modern) ──────────────────────────────────
    if (isEditing) {
        const remainingSim = formatRemainingTime(promoBanner.linkData?.timerEnd);

        return (
            <ScrollView style={S.container} contentContainerStyle={S.editScroll} showsVerticalScrollIndicator={false}>
                <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />

                {/* Top Action Bar */}
                <View style={S.editTopBar}>
                    <TouchableOpacity onPress={() => setIsEditing(false)} style={S.backButton}>
                        <Ionicons name="arrow-back" size={18} color={C.navy} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={S.headerTitle}>{promoBanner.id ? 'Edit Promo Campaign' : 'Create Promo Campaign'}</Text>
                        <Text style={S.headerSubtitle}>Countdown timer & Gemini AI copywriter</Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleAIGenerate}
                        disabled={generatingAI}
                        style={S.aiGenerateBtn}
                        activeOpacity={0.8}
                    >
                        {generatingAI ? (
                            <ActivityIndicator size="small" color={C.navy} />
                        ) : (
                            <>
                                <Ionicons name="sparkles" size={15} color={C.navy} />
                                <Text style={S.aiGenerateBtnText}>AI Copy</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ── Interactive Live Storefront Simulator ────────────────────── */}
                <View style={S.livePreviewWrapper}>
                    <View style={S.previewHeaderRow}>
                        <Text style={S.sectionLabel}>LIVE STOREFRONT PREVIEW</Text>
                        <View style={S.liveDotWrap}>
                            <View style={S.liveDot} />
                            <Text style={S.liveText}>Real-Time Preview</Text>
                        </View>
                    </View>

                    <View style={S.previewHero}>
                        <Image
                            source={{ uri: promoBanner.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600' }}
                            style={S.previewImage}
                        />
                        <View style={S.previewOverlay} />

                        {/* Top Ribbon inside Preview */}
                        <View style={S.previewTopRibbon}>
                            {promoBanner.subtitle ? (
                                <View style={S.previewBadge}>
                                    <Text style={S.previewBadgeText}>{promoBanner.subtitle.toUpperCase()}</Text>
                                </View>
                            ) : (
                                <View style={S.previewBadge}>
                                    <Text style={S.previewBadgeText}>LIMITED TIME</Text>
                                </View>
                            )}

                            {remainingSim && (
                                <View style={S.previewTimerTag}>
                                    <Ionicons name="time-outline" size={11} color="#FFFFFF" />
                                    <Text style={S.previewTimerText}>{remainingSim}</Text>
                                </View>
                            )}
                        </View>

                        {/* Headline */}
                        <Text style={S.previewTitle} numberOfLines={2}>
                            {promoBanner.title || 'Enter your promotional campaign headline below...'}
                        </Text>

                        {/* Bottom Row inside Preview */}
                        <View style={S.previewBottomRow}>
                            {promoBanner.linkData?.productName ? (
                                <View style={S.previewProductSnippet}>
                                    <Ionicons name="link" size={12} color="#FFFFFF" />
                                    <Text style={S.previewProductText} numberOfLines={1}>
                                        {promoBanner.linkData.productName}
                                    </Text>
                                    {promoBanner.linkData.discountValue && (
                                        <Text style={S.previewDiscountText}>
                                            -{promoBanner.linkData.discountValue}{promoBanner.linkData.discountType === 'percent' ? '%' : '₦'}
                                        </Text>
                                    )}
                                </View>
                            ) : null}

                            <View style={S.previewCtaBtn}>
                                <Text style={S.previewCtaText}>
                                    {promoBanner.linkData?.text || 'Shop Now →'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ── AI Copywriter Assistant Strip ───────────────────────────── */}
                <View style={S.aiAssistantCard}>
                    <View style={S.aiCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="sparkles" size={16} color={C.gold} />
                            <Text style={S.aiCardTitle}>Gemini Copy Assistant</Text>
                        </View>
                        <Text style={S.aiCardSub}>Select tone & tap AI Copy</Text>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.toneScroll}>
                        {AI_CAMPAIGN_TONES.map(tone => {
                            const isSelected = aiTone === tone.id;
                            return (
                                <TouchableOpacity
                                    key={tone.id}
                                    onPress={() => setAiTone(tone.id)}
                                    style={[S.toneChip, isSelected && S.toneChipActive]}
                                >
                                    <Ionicons name={tone.icon} size={13} color={isSelected ? C.navy : C.muted} />
                                    <Text style={[S.toneChipText, isSelected && S.toneChipTextActive]}>{tone.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {aiSuggestions && (
                        <View style={S.aiSuggestionsBox}>
                            <Text style={S.aiSuggestionHeader}>Recently Generated by AI:</Text>
                            <TouchableOpacity
                                onPress={() => setPromoBanner(p => ({
                                    ...p,
                                    title: aiSuggestions.title || p.title,
                                    subtitle: aiSuggestions.subtitle || p.subtitle,
                                    linkData: { ...p.linkData, text: aiSuggestions.buttonText || p.linkData.text }
                                }))}
                                style={S.aiSuggestionRow}
                            >
                                <Ionicons name="checkmark-circle" size={15} color={C.emerald} />
                                <View style={{ flex: 1 }}>
                                    <Text style={S.aiSuggestionHeadline}>{aiSuggestions.title}</Text>
                                    <Text style={S.aiSuggestionSub}>{aiSuggestions.subtitle} • CTA: {aiSuggestions.buttonText}</Text>
                                </View>
                                <Text style={S.aiApplyText}>Apply</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ── Campaign Settings Card ──────────────────────────────────── */}
                <View style={S.formCard}>
                    {/* Status Toggle & Surfaces */}
                    <View style={S.rowBetween}>
                        <Text style={S.inputTitle}>CAMPAIGN VISIBILITY</Text>
                        <TouchableOpacity
                            onPress={() => setPromoBanner(p => ({ ...p, is_active: !p.is_active }))}
                            style={[S.statusToggle, { backgroundColor: promoBanner.is_active ? C.emeraldBg : '#FFFFFF', borderColor: promoBanner.is_active ? C.emeraldBorder : C.border }]}
                        >
                            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: promoBanner.is_active ? C.emerald : C.muted }} />
                            <Text style={[S.statusToggleText, { color: promoBanner.is_active ? C.emerald : C.muted }]}>
                                {promoBanner.is_active ? 'ACTIVE (LIVE)' : 'PAUSED (DRAFT)'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Display Surfaces */}
                    <View style={{ marginTop: 14, marginBottom: 14 }}>
                        <Text style={S.inputSubLabel}>DISPLAY SURFACES IN STORE</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                            {[
                                { id: 'home', label: 'Home Page' },
                                { id: 'shop', label: 'Shop Catalog' },
                                { id: 'landing', label: 'Landing' }
                            ].map(loc => {
                                const active = promoBanner.linkData?.locations?.includes(loc.id);
                                return (
                                    <TouchableOpacity
                                        key={loc.id}
                                        onPress={() => toggleLocation(loc.id)}
                                        style={[S.locSelectChip, active && S.locSelectChipActive]}
                                    >
                                        <Ionicons name={active ? 'checkbox' : 'square-outline'} size={15} color={active ? C.navy : C.muted} />
                                        <Text style={[S.locSelectText, active && S.locSelectTextActive]}>{loc.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Headline */}
                    <View style={{ marginBottom: 14 }}>
                        <Text style={S.inputTitle}>CAMPAIGN HEADLINE</Text>
                        <TextInput
                            style={S.formInput}
                            placeholder="e.g., Ramadan Mega Deal: Up to 40% Off Selected Electronics"
                            placeholderTextColor={C.subtle}
                            value={promoBanner.title}
                            onChangeText={t => setPromoBanner(p => ({ ...p, title: t }))}
                        />
                    </View>

                    {/* Badge / Tagline */}
                    <View style={{ marginBottom: 14 }}>
                        <Text style={S.inputTitle}>TOP BADGE TEXT (TAGLINE)</Text>
                        <TextInput
                            style={S.formInput}
                            placeholder="e.g., FLASH SALE, LIMITED DEAL, WEEKEND SPECIAL"
                            placeholderTextColor={C.subtle}
                            value={promoBanner.subtitle}
                            onChangeText={t => setPromoBanner(p => ({ ...p, subtitle: t }))}
                        />
                    </View>

                    {/* CTA Button Text */}
                    <View style={{ marginBottom: 14 }}>
                        <Text style={S.inputTitle}>BUTTON CTA TEXT</Text>
                        <TextInput
                            style={S.formInput}
                            placeholder="e.g., Shop Deal Now →, Claim Voucher"
                            placeholderTextColor={C.subtle}
                            value={promoBanner.linkData?.text}
                            onChangeText={t => setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, text: t } }))}
                        />
                    </View>

                    {/* Banner Image URL / Upload */}
                    <View style={{ marginBottom: 14 }}>
                        <Text style={S.inputTitle}>BANNER BACKGROUND IMAGE</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={handlePickBannerImage}
                                disabled={uploadingBanner}
                                style={S.uploadImageBtn}
                            >
                                {uploadingBanner ? (
                                    <ActivityIndicator size="small" color={C.navy} />
                                ) : (
                                    <>
                                        <Ionicons name="cloud-upload-outline" size={16} color={C.navy} />
                                        <Text style={S.uploadImageText}>Upload</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TextInput
                                style={S.imageUrlInput}
                                placeholder="Paste image URL (https://...)"
                                placeholderTextColor={C.subtle}
                                value={promoBanner.image_url}
                                onChangeText={t => setPromoBanner(p => ({ ...p, image_url: t }))}
                            />
                        </View>
                    </View>

                    {/* Link Catalog Product */}
                    <View style={{ marginBottom: 14 }}>
                        <Text style={S.inputTitle}>LINK STORE PRODUCT</Text>
                        <TouchableOpacity
                            onPress={() => {
                                performProductSearch('');
                                setSearchModalVisible(true);
                            }}
                            style={[S.pickerBtn, promoBanner.linkData?.productId && S.pickerBtnActive]}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <Ionicons name="link" size={16} color={promoBanner.linkData?.productId ? C.indigo : C.muted} />
                                <Text style={[S.pickerText, promoBanner.linkData?.productId && S.pickerTextActive]} numberOfLines={1}>
                                    {promoBanner.linkData?.productName || 'Tap to link a product from catalog...'}
                                </Text>
                            </View>
                            {promoBanner.linkData?.productId ? (
                                <TouchableOpacity onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, productId: '', productName: '', productPrice: '' } }))}>
                                    <Ionicons name="close-circle" size={18} color={C.muted} />
                                </TouchableOpacity>
                            ) : (
                                <Ionicons name="chevron-forward" size={16} color={C.muted} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Countdown Expiry Date */}
                    <View style={{ marginBottom: 14 }}>
                        <View style={S.rowBetween}>
                            <Text style={S.inputTitle}>COUNTDOWN EXPIRY DATE</Text>
                            {promoBanner.linkData?.timerEnd && (
                                <TouchableOpacity onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, timerEnd: '' } }))}>
                                    <Text style={{ fontSize: 11, color: C.rose, fontWeight: '700' }}>Clear Timer</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Quick Presets */}
                        <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
                            <TouchableOpacity onPress={() => applyDatePreset(1)} style={S.datePresetBtn}>
                                <Text style={S.datePresetText}>+24 Hours</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => applyDatePreset(3)} style={S.datePresetBtn}>
                                <Text style={S.datePresetText}>+3 Days</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => applyDatePreset(7)} style={S.datePresetBtn}>
                                <Text style={S.datePresetText}>+7 Days</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[S.datePresetBtn, { backgroundColor: C.navy }]}>
                                <Text style={[S.datePresetText, { color: '#FFFFFF' }]}>Custom Date</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={() => setShowDatePicker(true)}
                            style={[S.pickerBtn, promoBanner.linkData?.timerEnd && S.pickerBtnActive]}
                        >
                            <Text style={[S.pickerText, promoBanner.linkData?.timerEnd && S.pickerTextActive]}>
                                {promoBanner.linkData?.timerEnd
                                    ? `Expires on: ${promoBanner.linkData.timerEnd} (${formatRemainingTime(promoBanner.linkData.timerEnd) || 'Active'})`
                                    : 'No countdown timer set'}
                            </Text>
                            <Ionicons name="calendar-outline" size={17} color={C.muted} />
                        </TouchableOpacity>

                        {showDatePicker && (
                            Platform.OS === 'web' ? (
                                <View style={{ marginTop: 8 }}>
                                    <input
                                        type="date"
                                        value={promoBanner.linkData?.timerEnd || ''}
                                        onChange={(e) => {
                                            setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, timerEnd: e.target.value } }));
                                            setShowDatePicker(false);
                                        }}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid #CBD5E1',
                                            backgroundColor: '#FFFFFF',
                                            fontSize: '13px',
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

                    {/* Promotional Discount Callout */}
                    <View style={S.discountBox}>
                        <Text style={S.inputTitle}>PROMOTIONAL DISCOUNT</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8 }}>
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
                                    Fixed Amount (₦)
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={S.formInput}
                            placeholder={promoBanner.linkData?.discountType === 'percent' ? 'e.g. 25 (for 25% OFF)' : 'e.g. 5000 (for ₦5,000 OFF)'}
                            placeholderTextColor={C.subtle}
                            keyboardType="numeric"
                            value={promoBanner.linkData?.discountValue}
                            onChangeText={v => setPromoBanner(p => ({ ...p, linkData: { ...p.linkData, discountValue: v } }))}
                        />
                    </View>

                    {/* Publish Campaign Button */}
                    <TouchableOpacity
                        onPress={handleSavePromo}
                        disabled={saving}
                        style={S.saveButton}
                        activeOpacity={0.85}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                                <Text style={S.saveButtonText}>Publish Live Promo Campaign</Text>
                            </>
                        )}
                    </TouchableOpacity>
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

    // ── Main List View (Balanced, Executive & Modern) ─────────────────────────
    return (
        <View style={S.container}>
            <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />

            {/* ── Executive Header ────────────────────────────────────────────── */}
            <View style={S.header}>
                <View style={S.headerTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {onBack ? (
                            <TouchableOpacity onPress={onBack} style={S.backButton}>
                                <Ionicons name="arrow-back" size={17} color={C.navy} />
                            </TouchableOpacity>
                        ) : navigation?.canGoBack?.() ? (
                            <TouchableOpacity onPress={() => navigation.goBack()} style={S.backButton}>
                                <Ionicons name="arrow-back" size={17} color={C.navy} />
                            </TouchableOpacity>
                        ) : null}

                        <View>
                            <Text style={S.headerTitle}>AI Promo Studio</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
                                <View style={S.livePulseDot} />
                                <Text style={S.headerSubtitle}>Real-Time Campaigns & Gemini AI Copy</Text>
                            </View>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                            onPress={onRefresh}
                            style={S.iconBtn}
                            disabled={refreshing}
                        >
                            <Ionicons name="refresh" size={16} color={C.navy} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleAddNew}
                            style={S.addNewBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add" size={16} color="#FFFFFF" />
                            <Text style={S.addNewBtnText}>New Promo</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── 4-Tile Live KPI Dashboard Ribbon ────────────────────────── */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={S.kpiScroll}
                >
                    <TouchableOpacity
                        onPress={() => setStatusFilter('all')}
                        style={[S.kpiCard, statusFilter === 'all' && S.kpiCardActive]}
                        activeOpacity={0.8}
                    >
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.indigoBg }]}>
                                <Ionicons name="sparkles" size={13} color={C.indigo} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.indigo, backgroundColor: '#E0E7FF' }]}>
                                ALL
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{metrics.total}</Text>
                        <Text style={S.kpiSub}>Total Campaigns</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                        style={[S.kpiCard, statusFilter === 'active' && S.kpiCardActive]}
                        activeOpacity={0.8}
                    >
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.emeraldBg }]}>
                                <Ionicons name="checkmark-circle" size={13} color={C.emerald} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.emerald, backgroundColor: '#DCFCE7' }]}>
                                LIVE
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{metrics.activeCount}</Text>
                        <Text style={S.kpiSub}>Active On Store</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
                        style={[S.kpiCard, statusFilter === 'inactive' && S.kpiCardActive]}
                        activeOpacity={0.8}
                    >
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.amberBg }]}>
                                <Ionicons name="time" size={13} color={C.amber} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.amber, backgroundColor: '#FEF3C7' }]}>
                                DEALS
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{metrics.timerCount}</Text>
                        <Text style={S.kpiSub}>Countdown Deals</Text>
                    </TouchableOpacity>

                    <View style={S.kpiCard}>
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.blueBg }]}>
                                <Ionicons name="cube" size={13} color={C.blue} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.blue, backgroundColor: '#DBEAFE' }]}>
                                LINKED
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{metrics.productCount}</Text>
                        <Text style={S.kpiSub}>Catalog Products</Text>
                    </View>
                </ScrollView>
            </View>

            {/* ── Search & Filter Controls ────────────────────────────────── */}
            <View style={S.filterSection}>
                <View style={S.searchBox}>
                    <Ionicons name="search" size={16} color={C.muted} />
                    <TextInput
                        style={S.searchInput}
                        placeholder="Search promo headlines, badges, or linked items..."
                        placeholderTextColor={C.subtle}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color={C.muted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Tabs & Location Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.tabRow}>
                    {[
                        { id: 'all', label: 'All Campaigns' },
                        { id: 'active', label: 'Active Live' },
                        { id: 'inactive', label: 'Paused' }
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

                    <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 4 }} />

                    {[
                        { id: 'all', label: 'All Surfaces' },
                        { id: 'home', label: 'Home Page' },
                        { id: 'shop', label: 'Shop Catalog' },
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
                    <Text style={S.loaderText}>Syncing live AI promo campaigns...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredBanners}
                    renderItem={renderBannerCard}
                    keyExtractor={item => item.id ? item.id.toString() : Math.random().toString()}
                    contentContainerStyle={S.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.navy, C.gold]} />
                    }
                    ListEmptyComponent={
                        <View style={S.emptyStateBox}>
                            <View style={S.emptyIconWrap}>
                                <Ionicons name="sparkles" size={32} color={C.gold} />
                            </View>
                            <Text style={S.emptyTitle}>No Promo Campaigns Found</Text>
                            <Text style={S.emptySubtitle}>
                                {searchQuery
                                    ? `No campaigns match "${searchQuery}".`
                                    : 'Create your first interactive countdown promo campaign with Gemini AI copywriting.'}
                            </Text>
                            <TouchableOpacity
                                onPress={handleAddNew}
                                style={S.createEmptyBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="sparkles" size={15} color="#FFFFFF" />
                                <Text style={S.createEmptyBtnText}>+ Create Promo with AI</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    );
};

// ─── Balanced & Elegant Stylesheet ────────────────────────────────────────────
// Calibrated with perfect visual hierarchy: zero micro-fonts, zero oversized padding
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.canvas
    },
    header: {
        backgroundColor: C.card,
        paddingTop: 14,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    backButton: {
        width: 34,
        height: 34,
        borderRadius: 9,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3
    },
    headerSubtitle: {
        fontSize: 11.5,
        fontWeight: '600',
        color: C.muted
    },
    livePulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.emerald
    },
    iconBtn: {
        width: 34,
        height: 34,
        borderRadius: 9,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    addNewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 9,
        backgroundColor: C.navy
    },
    addNewBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800'
    },
    kpiScroll: {
        gap: 10,
        paddingRight: 6
    },
    kpiCard: {
        width: 132,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 12,
        padding: 10
    },
    kpiCardActive: {
        borderColor: C.navy,
        backgroundColor: '#FFFFFF',
        shadowColor: C.navy,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 5,
        elevation: 2
    },
    kpiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
    },
    kpiIconWrap: {
        width: 24,
        height: 24,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center'
    },
    kpiBadge: {
        fontSize: 9.5,
        fontWeight: '900',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4
    },
    kpiValue: {
        fontSize: 17,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3
    },
    kpiSub: {
        fontSize: 11,
        fontWeight: '600',
        color: C.muted,
        marginTop: 2
    },
    filterSection: {
        backgroundColor: C.card,
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.border
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.canvas,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 10
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: C.navy,
        padding: 0
    },
    tabRow: {
        gap: 6,
        alignItems: 'center'
    },
    tabPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    tabPillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy
    },
    tabPillText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: C.muted
    },
    tabPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '800'
    },
    chipPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    chipPillActive: {
        backgroundColor: '#E0E7FF',
        borderColor: C.indigoBorder
    },
    chipPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.muted
    },
    chipPillTextActive: {
        color: C.indigo,
        fontWeight: '800'
    },
    listContent: {
        padding: 14,
        paddingBottom: 90
    },
    bannerCard: {
        backgroundColor: C.card,
        borderRadius: 14,
        marginBottom: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
        shadowColor: C.navy,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2
    },
    cardHero: {
        height: 140,
        backgroundColor: C.navy,
        position: 'relative',
        justifyContent: 'space-between',
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
        opacity: 0.55
    },
    cardHeroOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)'
    },
    cardHeroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 2
    },
    timerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)'
    },
    timerPillExpired: {
        backgroundColor: C.roseBg,
        borderColor: C.roseBorder
    },
    timerPillText: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800'
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 6,
        borderWidth: 1
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.4
    },
    heroBottomTextWrap: {
        zIndex: 2
    },
    badgeHighlight: {
        alignSelf: 'flex-start',
        backgroundColor: C.rose,
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 4,
        marginBottom: 4
    },
    badgeHighlightText: {
        color: '#FFFFFF',
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.4
    },
    heroTitleText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        lineHeight: 20
    },
    cardBody: {
        padding: 12,
        backgroundColor: C.card
    },
    metaTagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10
    },
    locTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: C.canvas,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: C.border
    },
    locTagText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.slate
    },
    linkedProductTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: C.indigoBg,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: C.indigoBorder
    },
    linkedProductText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.indigo
    },
    discountTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: C.emeraldBg,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: C.emeraldBorder
    },
    discountTagText: {
        fontSize: 10,
        fontWeight: '900',
        color: C.emerald
    },
    cardActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 6,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: C.borderLight
    },
    quickToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 7,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    quickToggleText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.slate
    },
    cloneBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 7,
        backgroundColor: C.purpleBg,
        borderWidth: 1,
        borderColor: C.purpleBorder
    },
    cloneBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.purple
    },
    editBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 7,
        backgroundColor: C.blueBg,
        borderWidth: 1,
        borderColor: C.blueBorder
    },
    editBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.blue
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 7,
        backgroundColor: C.roseBg,
        borderWidth: 1,
        borderColor: C.roseBorder
    },
    deleteBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.rose
    },
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 36
    },
    loaderText: {
        marginTop: 10,
        fontSize: 12.5,
        fontWeight: '600',
        color: C.muted
    },
    emptyStateBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: C.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.border,
        marginTop: 20
    },
    emptyIconWrap: {
        width: 54,
        height: 54,
        borderRadius: 16,
        backgroundColor: C.canvas,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: C.navy,
        marginBottom: 4
    },
    emptySubtitle: {
        fontSize: 12,
        color: C.muted,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 16
    },
    createEmptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 9,
        backgroundColor: C.navy
    },
    createEmptyBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800'
    },
    editScroll: {
        padding: 14,
        paddingBottom: 90
    },
    editTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14
    },
    aiGenerateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9,
        backgroundColor: C.goldBg,
        borderWidth: 1,
        borderColor: C.goldBorder
    },
    aiGenerateBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.navy
    },
    livePreviewWrapper: {
        marginBottom: 14
    },
    previewHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: C.muted,
        letterSpacing: 0.5
    },
    liveDotWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.emerald
    },
    liveText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.emerald
    },
    previewHero: {
        height: 140,
        backgroundColor: C.navy,
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
        justifyContent: 'space-between',
        padding: 14,
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
        opacity: 0.55
    },
    previewOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)'
    },
    previewTopRibbon: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 2
    },
    previewBadge: {
        backgroundColor: C.rose,
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 4
    },
    previewBadgeText: {
        color: '#FFFFFF',
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.4
    },
    previewTimerTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 4
    },
    previewTimerText: {
        color: '#FFFFFF',
        fontSize: 9.5,
        fontWeight: '800'
    },
    previewTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        lineHeight: 20,
        zIndex: 2
    },
    previewBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 2
    },
    previewProductSnippet: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 5
    },
    previewProductText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
        maxWidth: 140
    },
    previewDiscountText: {
        color: C.gold,
        fontSize: 10,
        fontWeight: '900'
    },
    previewCtaBtn: {
        backgroundColor: C.gold,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6
    },
    previewCtaText: {
        color: C.navy,
        fontSize: 10.5,
        fontWeight: '900'
    },
    aiAssistantCard: {
        backgroundColor: '#FFFDF5',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: C.goldBorder,
        marginBottom: 14
    },
    aiCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    aiCardTitle: {
        fontSize: 12.5,
        fontWeight: '900',
        color: C.navy
    },
    aiCardSub: {
        fontSize: 11,
        color: C.muted
    },
    toneScroll: {
        gap: 6
    },
    toneChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.border
    },
    toneChipActive: {
        backgroundColor: C.goldBg,
        borderColor: C.goldBorder
    },
    toneChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.muted
    },
    toneChipTextActive: {
        color: C.navy,
        fontWeight: '800'
    },
    aiSuggestionsBox: {
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(217, 167, 58, 0.3)'
    },
    aiSuggestionHeader: {
        fontSize: 10.5,
        fontWeight: '800',
        color: C.muted,
        marginBottom: 4
    },
    aiSuggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.card,
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.borderLight
    },
    aiSuggestionHeadline: {
        fontSize: 12,
        fontWeight: '800',
        color: C.navy
    },
    aiSuggestionSub: {
        fontSize: 10.5,
        color: C.muted,
        marginTop: 1
    },
    aiApplyText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.emerald
    },
    formCard: {
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    inputTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: C.muted,
        letterSpacing: 0.4
    },
    inputSubLabel: {
        fontSize: 10.5,
        fontWeight: '700',
        color: C.muted,
        letterSpacing: 0.3
    },
    statusToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
        borderWidth: 1
    },
    statusToggleText: {
        fontSize: 10.5,
        fontWeight: '800'
    },
    locSelectChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    locSelectChipActive: {
        backgroundColor: '#FFFBEB',
        borderColor: C.goldBorder
    },
    locSelectText: {
        fontSize: 11.5,
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
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 9,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    uploadImageText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.navy
    },
    imageUrlInput: {
        flex: 1,
        backgroundColor: C.canvas,
        borderRadius: 9,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 12,
        color: C.navy,
        borderWidth: 1,
        borderColor: C.border
    },
    formInput: {
        backgroundColor: C.canvas,
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: C.navy,
        borderWidth: 1,
        borderColor: C.border,
        marginTop: 6
    },
    pickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: C.canvas,
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: C.border,
        marginTop: 6
    },
    pickerBtnActive: {
        backgroundColor: '#FFFBEB',
        borderColor: C.goldBorder
    },
    pickerText: {
        fontSize: 12,
        color: C.muted,
        fontWeight: '600',
        flex: 1
    },
    pickerTextActive: {
        color: C.navy,
        fontWeight: '800'
    },
    datePresetBtn: {
        flex: 1,
        paddingVertical: 6,
        borderRadius: 7,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center'
    },
    datePresetText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: C.slate
    },
    discountBox: {
        backgroundColor: C.canvas,
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: C.borderLight,
        marginBottom: 16
    },
    discountTypeBtn: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 7,
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
        fontSize: 11,
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
        gap: 8,
        backgroundColor: C.navy,
        paddingVertical: 13,
        borderRadius: 10,
        marginTop: 4
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800'
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        padding: 16,
        zIndex: 99
    },
    modalCard: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 16,
        maxHeight: '75%',
        borderWidth: 1,
        borderColor: C.border
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: C.navy
    },
    modalSub: {
        fontSize: 11.5,
        color: C.muted,
        marginTop: 2
    },
    modalCloseBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.canvas,
        borderRadius: 9,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: C.border,
        marginVertical: 12
    },
    modalSearchInput: {
        flex: 1,
        fontSize: 13,
        color: C.navy,
        padding: 0
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 9,
        borderRadius: 9,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.borderLight
    },
    productThumb: {
        width: 38,
        height: 38,
        borderRadius: 8,
        backgroundColor: '#E2E8F0'
    },
    productTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: C.navy
    },
    productPrice: {
        fontSize: 11.5,
        fontWeight: '700',
        color: C.gold,
        marginTop: 2
    },
    selectBadge: {
        backgroundColor: C.navy,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 7
    },
    selectBadgeText: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800'
    }
});
