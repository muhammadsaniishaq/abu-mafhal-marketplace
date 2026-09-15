import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, SafeAreaView, TextInput,
    FlatList, Image, ImageBackground, Animated,
    StyleSheet, Platform, StatusBar, RefreshControl, ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WIDTH, COLUMN_WIDTH } from '../styles/theme';
import { useComparison } from '../context/ComparisonContext';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { geminiService } from '../services/geminiService';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { CountdownTimer } from '../components/CountdownTimer';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Theme ────────────────────────────────────────────────────────────────────
const NAVY = '#0E1A2E';
const NAVY2 = '#162235';
const GOLD = '#D9A73A';
const GOLD_LIGHT = 'rgba(217,167,58,0.15)';
const GOLD_BORDER = 'rgba(217,167,58,0.3)';
const BG = '#F4F6FA';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPrice = (n) => {
    const num = Number(n);
    if (!num) return '—';
    if (num >= 1_000_000) return `₦${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000)     return `₦${(num / 1_000).toFixed(0)}K`;
    return `₦${num}`;
};

const getImageUrl = (item) => {
    const fallback = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400&auto=format&fit=crop';
    if (!item) return fallback;
    if (typeof item === 'string') {
        if (item.startsWith('http')) return item;
        try {
            const parsed = JSON.parse(item);
            if (Array.isArray(parsed) && parsed[0]) return parsed[0];
            if (typeof parsed === 'string' && parsed.startsWith('http')) return parsed;
        } catch (_) {}
        return item;
    }
    if (item.image_url) return item.image_url;
    const images = item.images;
    if (Array.isArray(images) && images.length > 0) return images[0];
    if (typeof images === 'string') {
        try {
            const p = JSON.parse(images);
            if (Array.isArray(p) && p.length > 0) return p[0];
        } catch (_) { return images; }
    }
    return fallback;
};

// ─── Shimmer Skeleton ─────────────────────────────────────────────────────────
const SkeletonCard = () => {
    const shimmer = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, []);
    const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
    return (
        <Animated.View style={[sk.card, { opacity }]}>
            <View style={sk.img} />
            <View style={{ padding: 10, gap: 7 }}>
                <View style={sk.line} />
                <View style={[sk.line, { width: '60%' }]} />
                <View style={[sk.line, { width: '40%', backgroundColor: GOLD_BORDER, height: 8 }]} />
            </View>
        </Animated.View>
    );
};
const sk = StyleSheet.create({
    card: { width: COLUMN_WIDTH, backgroundColor: '#E8EDF5', borderRadius: 18, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#DDE3EE' },
    img:  { height: 140, backgroundColor: '#D8E0EC' },
    line: { height: 10, borderRadius: 5, backgroundColor: '#CDD5E2', width: '80%' },
});

// ─── Product Card ─────────────────────────────────────────────────────────────
const ProductCard = ({ item, onPress, onAddToCart, onWishlist, inWishlist, inCompare, onCompare }) => {
    const pressAnim = useRef(new Animated.Value(1)).current;

    const onPressIn  = () => Animated.spring(pressAnim, { toValue: 0.96, useNativeDriver: true, tension: 200 }).start();
    const onPressOut = () => Animated.spring(pressAnim, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

    const stock = item.stock_quantity ?? item.stock;
    const isOutStock = stock != null && stock === 0;
    const isLowStock = stock != null && stock > 0 && stock <= 5;
    const isFreeShip = Number(item.price) >= 50000;

    const hasDiscount = Number(item.compare_at_price) > Number(item.price);
    const discountPct = hasDiscount
        ? Math.round(((Number(item.compare_at_price) - Number(item.price)) / Number(item.compare_at_price)) * 100)
        : (item.discount > 0 ? item.discount : null);
    const oldPrice = hasDiscount
        ? item.compare_at_price
        : (item.original_price || (item.discount > 0 ? Number(item.price) * (1 + Number(item.discount) / 100) : null));

    return (
        <Animated.View style={[S.card, { transform: [{ scale: pressAnim }] }]}>
            <TouchableOpacity
                activeOpacity={1}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                onPress={() => onPress(item)}
            >
                {/* IMAGE */}
                <View style={S.imgBox}>
                    <Image source={{ uri: getImageUrl(item) }} style={S.imgFull} resizeMode="cover" />

                    {/* Dark gradient overlay bottom */}
                    <LinearGradient
                        colors={['transparent', 'rgba(14,26,46,0.35)']}
                        style={S.imgGradient}
                    />

                    {isOutStock && (
                        <View style={S.outOverlay}>
                            <View style={S.outPill}><Text style={S.outTxt}>OUT OF STOCK</Text></View>
                        </View>
                    )}

                    {/* Badge */}
                    {discountPct ? (
                        <LinearGradient colors={['#EF4444', '#DC2626']} style={S.badge}>
                            <Text style={S.badgeTxt}>-{discountPct}%</Text>
                        </LinearGradient>
                    ) : (item.isNew || item.is_new) ? (
                        <LinearGradient colors={[GOLD, '#C4922A']} style={S.badge}>
                            <Text style={S.badgeTxt}>NEW</Text>
                        </LinearGradient>
                    ) : null}

                    {/* Action icons */}
                    <View style={S.iconStack}>
                        <TouchableOpacity style={[S.iconBtn, inWishlist && S.iconBtnHeart]} onPress={() => onWishlist(item.id)}>
                            <Ionicons name={inWishlist ? 'heart' : 'heart-outline'} size={13} color={inWishlist ? '#EF4444' : NAVY} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[S.iconBtn, inCompare && S.iconBtnCompare]} onPress={() => onCompare(item)}>
                            <Ionicons name={inCompare ? 'git-compare' : 'git-compare-outline'} size={13} color={inCompare ? GOLD : NAVY} />
                        </TouchableOpacity>
                    </View>

                    {isFreeShip && !isOutStock && (
                        <View style={S.freeTag}>
                            <Ionicons name="bicycle-outline" size={9} color="#059669" />
                            <Text style={S.freeTxt}>FREE</Text>
                        </View>
                    )}
                </View>

                {/* INFO */}
                <View style={S.info}>
                    <Text style={S.cardTitle} numberOfLines={1}>{item?.name || 'Product'}</Text>

                    <View style={S.ratingRow}>
                        <Ionicons name="star" size={9} color={GOLD} />
                        <Text style={S.ratingVal}>{item.rating?.toFixed(1) || '5.0'}</Text>
                        <Text style={S.ratingCnt}>({item.reviews ?? 0})</Text>
                        {isLowStock && (
                            <View style={S.stockPill}><Text style={S.stockWarn}>{stock} left</Text></View>
                        )}
                    </View>

                    <View style={S.priceCartRow}>
                        <View>
                            <Text style={S.price}>{fmtPrice(item.price)}</Text>
                            {oldPrice && <Text style={S.oldPrice}>{fmtPrice(oldPrice)}</Text>}
                        </View>
                        {!isOutStock && (
                            <TouchableOpacity style={S.cartBtn} onPress={() => onAddToCart(item)}>
                                <Ionicons name="bag-add-outline" size={14} color="white" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
export const ShopPage = ({ onBack, cartCount, onGoToCart, addToCart, onProductClick, onCompareClick, initialQuery, initialCategory }) => {
    const { addToComparison, isInComparison, comparisonCount } = useComparison();

    const [products,         setProducts]         = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [categories,       setCategories]       = useState([{ label: 'All', icon: 'apps-outline', slug: 'All' }]);
    const [loading,          setLoading]          = useState(true);
    const [refreshing,       setRefreshing]       = useState(false);
    const [activeCategory,   setActiveCategory]   = useState(initialCategory || 'All');
    const [searchQuery,      setSearchQuery]      = useState(initialQuery || '');
    const [sortBy,           setSortBy]           = useState('default');
    const [wishlist,         setWishlist]         = useState([]);
    const [recording,        setRecording]        = useState(null);
    const [showVoiceModal,   setShowVoiceModal]   = useState(false);
    const [showScrollTop,    setShowScrollTop]    = useState(false);

    // Banners
    const [banners,      setBanners]      = useState([]);
    const [promoBanners, setPromoBanners] = useState([]);
    const [currentBannerIdx, setCurrentBannerIdx] = useState(0);

    // Toast & anims
    const [toast, setToast] = useState({ visible: false, message: '', icon: 'checkmark-circle' });
    const fadeAnim   = useRef(new Animated.Value(0)).current;
    const fabScale   = useRef(new Animated.Value(1)).current;
    const topBtnAnim = useRef(new Animated.Value(0)).current;
    const bannerRef  = useRef(null);
    const flatListRef = useRef(null);
    const scrollX     = useRef(new Animated.Value(0)).current;

    const SHOP_CACHE_KEY = '@abumafhal_shop_cache_v4';
    const PROD_FIELDS = 'id,name,price,original_price,compare_at_price,image_url,images,category,rating,reviews,status,discount,stock,stock_quantity,is_featured,is_new,brand,isNew,total_sales';

    // ── Initial load from cache then fetch ────────────────────────────────────
    useEffect(() => {
        let mounted = true;
        const boot = async () => {
            try {
                const cached = await AsyncStorage.getItem(SHOP_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (mounted) {
                        if (parsed.products?.length) setProducts(parsed.products);
                        if (parsed.banners?.length)  setBanners(parsed.banners);
                        if (parsed.promoBanners?.length) setPromoBanners(parsed.promoBanners);
                        setLoading(false);
                    }
                }
            } catch (_) {}
            if (mounted) fetchData();
        };
        boot();
        return () => { mounted = false; recording?.stopAndUnloadAsync().catch(() => {}); };
    }, []);

    // ── Auto-advance banner ───────────────────────────────────────────────────
    useEffect(() => {
        if (banners.length <= 1) return;
        const t = setInterval(() => {
            setCurrentBannerIdx(prev => {
                const next = (prev + 1) % banners.length;
                bannerRef.current?.scrollToIndex({ index: next, animated: true });
                return next;
            });
        }, 3500);
        return () => clearInterval(t);
    }, [banners.length]);

    // ── Realtime ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const channel = supabase
            .channel('shop-realtime-v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchData(true))
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, []);

    // ── Filter whenever deps change ───────────────────────────────────────────
    useEffect(() => { filterProducts(); }, [activeCategory, searchQuery, products, sortBy]);

    useEffect(() => { if (initialQuery !== undefined) setSearchQuery(initialQuery); }, [initialQuery]);
    useEffect(() => { if (initialCategory !== undefined) setActiveCategory(initialCategory || 'All'); }, [initialCategory]);

    // ── Fetch data ────────────────────────────────────────────────────────────
    const fetchData = async (isRefresh = false) => {
        try {
            const [bannersRes, promoRes, prodRes, catRes, userRes] = await Promise.allSettled([
                supabase.from('banners').select('*').eq('is_active', true).order('display_order'),
                supabase.from('banners').select('*').eq('section', 'promo').eq('is_active', true).order('created_at', { ascending: false }),
                supabase.from('products')
                    .select(PROD_FIELDS)
                    .eq('status', 'approved')
                    .order('created_at', { ascending: false })
                    .limit(200),
                supabase.from('categories').select('*').eq('is_active', true).order('display_order', { ascending: true }),
                supabase.auth.getUser()
            ]);

            // ── Banners ───────────────────────────────────────────────────────
            let freshBanners = [];
            if (bannersRes.status === 'fulfilled' && bannersRes.value?.data?.length) {
                freshBanners = bannersRes.value.data.filter(
                    b => !b.section || b.section === 'shop' || b.section === 'all' || b.section === ''
                );
                setBanners(freshBanners);
            }

            // ── Promo banners ─────────────────────────────────────────────────
            let freshPromos = [];
            if (promoRes.status === 'fulfilled' && promoRes.value?.data?.length) {
                freshPromos = promoRes.value.data.map(p => {
                    let linkData = { text: p.action_link || '', locations: ['home'] };
                    try { const parsed = JSON.parse(p.action_link); if (parsed && typeof parsed === 'object') linkData = { ...linkData, ...parsed }; } catch (_) {}
                    return { ...p, linkData };
                }).filter(p => {
                    const loc = p.linkData?.locations?.includes('shop');
                    const exp = p.linkData?.timerEnd ? (!isNaN(new Date(p.linkData.timerEnd)) && new Date() <= new Date(p.linkData.timerEnd)) : true;
                    return loc && exp;
                });
                setPromoBanners(freshPromos);
            }

            // ── Products ──────────────────────────────────────────────────────
            let freshProducts = [];
            if (prodRes.status === 'fulfilled') {
                const rows = prodRes.value?.data;
                if (rows && rows.length > 0) {
                    freshProducts = rows.map(p => ({
                        ...p,
                        rating: p.rating || 5,
                        reviews: p.reviews || 0,
                    }));
                    setProducts(freshProducts);
                } else {
                    // Also try without status filter as fallback
                    const fallbackRes = await supabase
                        .from('products')
                        .select(PROD_FIELDS)
                        .order('created_at', { ascending: false })
                        .limit(200);
                    if (fallbackRes.data?.length) {
                        freshProducts = fallbackRes.data.map(p => ({
                            ...p,
                            rating: p.rating || 5,
                            reviews: p.reviews || 0,
                        }));
                        setProducts(freshProducts);
                    }
                }
            } else {
                console.log('ShopPage: prodRes failed:', prodRes.reason);
            }

            // ── Categories ───────────────────────────────────────────────────
            if (catRes.status === 'fulfilled' && catRes.value?.data?.length > 0) {
                setCategories([
                    { label: 'All', icon: 'apps-outline', slug: 'All' },
                    ...catRes.value.data.map(c => ({
                        label: c.name,
                        slug: c.slug || c.name,
                        icon: c.icon || 'pricetag-outline'
                    }))
                ]);
            }

            // ── Cache ─────────────────────────────────────────────────────────
            if (freshProducts.length > 0) {
                AsyncStorage.setItem(SHOP_CACHE_KEY, JSON.stringify({
                    products: freshProducts,
                    banners: freshBanners,
                    promoBanners: freshPromos,
                    savedAt: Date.now()
                })).catch(() => {});
            }

            // ── Wishlist ──────────────────────────────────────────────────────
            if (userRes.status === 'fulfilled' && userRes.value?.data?.user) {
                const uid = userRes.value.data.user.id;
                supabase.from('wishlists').select('items').eq('id', uid).maybeSingle()
                    .then(({ data: wData }) => { if (wData?.items) setWishlist(wData.items); })
                    .catch(() => {});
            }
        } catch (err) {
            console.log('ShopPage fetchData error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => { setRefreshing(true); fetchData(true); };

    const filterProducts = () => {
        let r = [...products];
        if (activeCategory && activeCategory !== 'All') {
            const needle = activeCategory.toLowerCase().trim();
            r = r.filter(p => {
                const cat = (p.category || '').toLowerCase().trim();
                const nm  = (p.name || '').toLowerCase();
                return cat === needle || cat.includes(needle) || needle.includes(cat) || nm.includes(needle);
            });
        }
        if (searchQuery) {
            const sq = searchQuery.toLowerCase().trim();
            r = r.filter(p =>
                (p.name || '').toLowerCase().includes(sq) ||
                (p.category || '').toLowerCase().includes(sq) ||
                (p.brand || '').toLowerCase().includes(sq)
            );
        }
        if (sortBy === 'priceLow')  r.sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
        if (sortBy === 'priceHigh') r.sort((a, b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
        if (sortBy === 'reviews')   r.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
        if (sortBy === 'newest')    r.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        setFilteredProducts(r);
    };

    // ── Toast ─────────────────────────────────────────────────────────────────
    const showToast = (message, icon = 'checkmark-circle') => {
        setToast({ visible: true, message, icon });
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
            Animated.delay(1800),
            Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start(() => setToast(t => ({ ...t, visible: false })));
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleAddToCart = (item) => {
        Animated.sequence([
            Animated.spring(fabScale, { toValue: 1.25, useNativeDriver: true, tension: 200 }),
            Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
        ]).start();
        addToCart(item);
        showToast(`${item.name} added to cart`, 'bag-add');
    };

    const toggleWishlist = async (id) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { showToast('Login to use Wishlist', 'lock-closed'); return; }
            const next = wishlist.includes(id) ? wishlist.filter(i => i !== id) : [...wishlist, id];
            setWishlist(next);
            showToast(wishlist.includes(id) ? 'Removed from Wishlist' : 'Saved to Wishlist ❤️', 'heart');
            await supabase.from('wishlists').upsert({ id: user.id, items: next, updated_at: new Date() });
        } catch (e) { console.log('wishlist err', e); }
    };

    // ── Voice search ──────────────────────────────────────────────────────────
    const handleVoiceSearch = async () => {
        try {
            if (recording) { await stopRecording(); return; }
            const perm = await Audio.requestPermissionsAsync();
            if (!perm.granted) { showToast('Microphone permission required', 'mic-off'); return; }
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(rec); setShowVoiceModal(true);
            setTimeout(() => stopRecording(rec), 4000);
        } catch (e) { console.log('voice error', e); setShowVoiceModal(false); }
    };

    const stopRecording = async (currentRec) => {
        const rec = currentRec || recording;
        if (!rec) return;
        setRecording(null); setShowVoiceModal(false);
        try {
            await rec.stopAndUnloadAsync();
            const b64 = await FileSystem.readAsStringAsync(rec.getURI(), { encoding: 'base64' });
            showToast('Processing voice…', 'sync');
            const text = await geminiService.searchByVoice(b64);
            if (text) { setSearchQuery(text); showToast(`Heard: "${text}"`, 'mic'); }
            else showToast('Could not understand', 'help-circle');
        } catch (e) { showToast('Processing error', 'alert-circle'); }
    };

    // ── Image search ──────────────────────────────────────────────────────────
    const handleImageSearch = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { showToast('Photo library permission required', 'images'); return; }
            const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.5, base64: true });
            if (!res.canceled && res.assets[0].base64) {
                showToast('Analyzing image…', 'scan');
                const kw = await geminiService.searchByImage(res.assets[0].base64);
                if (kw) { setSearchQuery(kw); showToast(`Found: ${kw}`, 'checkmark-circle'); }
                else showToast('Could not identify product', 'help-circle');
            }
        } catch (e) { showToast('Gallery Error', 'alert-circle'); }
    };

    // ── Scroll to top ─────────────────────────────────────────────────────────
    const onScroll = (e) => {
        const y = e.nativeEvent.contentOffset.y;
        const shouldShow = y > 400;
        if (shouldShow !== showScrollTop) {
            setShowScrollTop(shouldShow);
            Animated.spring(topBtnAnim, { toValue: shouldShow ? 1 : 0, useNativeDriver: true, tension: 80, friction: 8 }).start();
        }
    };

    // ── Sort ──────────────────────────────────────────────────────────────────
    const SORT_LABELS = { default: 'Default', priceLow: 'Price ↑', priceHigh: 'Price ↓', reviews: 'Top Rated', newest: 'Newest' };
    const nextSort = () => setSortBy(p =>
        p === 'default' ? 'priceLow' : p === 'priceLow' ? 'priceHigh' : p === 'priceHigh' ? 'reviews' : p === 'reviews' ? 'newest' : 'default'
    );

    const hotDeals = products.filter(p => (Number(p.compare_at_price) > Number(p.price)) || Number(p.discount) > 0).slice(0, 12);

    // ── HOT DEALS strip ───────────────────────────────────────────────────────
    const renderHotDeals = () => {
        if (hotDeals.length === 0) return null;
        return (
            <View style={{ marginTop: 18, marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: GOLD }} />
                        <Text style={{ fontSize: 15, fontWeight: '900', color: NAVY }}>🔥 Hot Deals</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSortBy('priceLow')}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: GOLD }}>See all</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
                    {hotDeals.map(item => {
                        const dHasDisc = Number(item.compare_at_price) > Number(item.price);
                        const dPct = dHasDisc
                            ? Math.round(((Number(item.compare_at_price) - Number(item.price)) / Number(item.compare_at_price)) * 100)
                            : (item.discount || 10);
                        const dOld = dHasDisc ? item.compare_at_price : (item.original_price || null);

                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={S.dealCard}
                                activeOpacity={0.84}
                                onPress={() => onProductClick(item)}
                            >
                                <Image source={{ uri: getImageUrl(item) }} style={S.dealImg} resizeMode="cover" />
                                <LinearGradient colors={['transparent', 'rgba(14,26,46,0.6)']} style={S.dealGrad} />
                                <LinearGradient colors={['#EF4444', '#DC2626']} style={S.dealBadge}>
                                    <Text style={S.dealBadgeTxt}>-{dPct}%</Text>
                                </LinearGradient>
                                <View style={S.dealInfo}>
                                    <Text style={S.dealName} numberOfLines={1}>{item.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Text style={S.dealPrice}>{fmtPrice(item.price)}</Text>
                                        {dOld && <Text style={S.dealOld}>{fmtPrice(dOld)}</Text>}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        );
    };

    // ── Banner carousel ───────────────────────────────────────────────────────
    const renderBanners = () => {
        if (banners.length === 0) return null;
        return (
            <View style={{ marginTop: 10 }}>
                <FlatList
                    ref={bannerRef}
                    data={banners}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={WIDTH - 28}
                    decelerationRate="fast"
                    keyExtractor={b => b.id.toString()}
                    onMomentumScrollEnd={e => {
                        const i = Math.round(e.nativeEvent.contentOffset.x / (WIDTH - 28));
                        setCurrentBannerIdx(i);
                    }}
                    renderItem={({ item: banner }) => (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            style={{ width: WIDTH - 28, height: 120, marginHorizontal: 14, borderRadius: 18, overflow: 'hidden' }}
                        >
                            <ImageBackground
                                source={{ uri: banner.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=800' }}
                                style={{ width: '100%', height: '100%' }}
                                imageStyle={{ borderRadius: 18 }}
                                resizeMode="cover"
                            >
                                <LinearGradient colors={['rgba(14,26,46,0.1)', 'rgba(14,26,46,0.5)']} style={{ ...StyleSheet.absoluteFillObject, borderRadius: 18 }} />
                            </ImageBackground>
                        </TouchableOpacity>
                    )}
                />
                {/* Dot indicators */}
                {banners.length > 1 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 4 }}>
                        {banners.map((_, i) => (
                            <View key={i} style={{
                                height: 4, borderRadius: 2,
                                width: i === currentBannerIdx ? 16 : 4,
                                backgroundColor: i === currentBannerIdx ? GOLD : 'rgba(14,26,46,0.2)',
                            }} />
                        ))}
                    </View>
                )}
            </View>
        );
    };

    // ── Sub header ────────────────────────────────────────────────────────────
    const renderSubHeader = () => (
        <View style={S.subHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: GOLD }} />
                <Text style={{ fontSize: 14, fontWeight: '900', color: NAVY }}>All Products</Text>
                <View style={S.countBubble}>
                    <Text style={S.countBubbleTxt}>{filteredProducts.length}</Text>
                </View>
            </View>
            <TouchableOpacity style={[S.sortPill, sortBy !== 'default' && S.sortPillActive]} onPress={nextSort}>
                <Ionicons name="swap-vertical-outline" size={12} color={sortBy !== 'default' ? NAVY : '#64748B'} />
                <Text style={[S.sortTxt, sortBy !== 'default' && { color: NAVY }]}>{SORT_LABELS[sortBy]}</Text>
            </TouchableOpacity>
        </View>
    );

    // ── Product render ────────────────────────────────────────────────────────
    const renderProduct = useCallback(({ item }) => {
        if (!item) return null;
        return (
            <ProductCard
                item={item}
                onPress={onProductClick}
                onAddToCart={handleAddToCart}
                onWishlist={toggleWishlist}
                inWishlist={wishlist.includes(item.id)}
                inCompare={isInComparison(item.id)}
                onCompare={addToComparison}
            />
        );
    }, [wishlist, isInComparison]);

    // ── Empty state ───────────────────────────────────────────────────────────
    const renderEmpty = () => (
        <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: GOLD_LIGHT, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1.5, borderColor: GOLD_BORDER }}>
                <Ionicons name="search-outline" size={36} color={GOLD} />
            </View>
            <Text style={{ color: NAVY, fontSize: 16, fontWeight: '900', marginBottom: 6 }}>No products found</Text>
            <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                Try adjusting your filters or search term.
            </Text>
            <TouchableOpacity
                onPress={() => { setActiveCategory('All'); setSearchQuery(''); }}
                style={{ marginTop: 18, backgroundColor: NAVY, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: GOLD_BORDER }}
            >
                <Ionicons name="refresh-outline" size={14} color={GOLD} />
                <Text style={{ color: GOLD, fontWeight: '800', fontSize: 12 }}>Clear Filters</Text>
            </TouchableOpacity>
        </View>
    );

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <View style={{ flex: 1, backgroundColor: BG }}>
            <StatusBar barStyle="light-content" backgroundColor={NAVY} />

            {/* ── NAVY & GOLD HEADER ── */}
            <LinearGradient
                colors={[NAVY, NAVY2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={S.header}
            >
                <SafeAreaView style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0 }}>

                    {/* Top row: back + title + cart */}
                    <View style={S.headerTop}>
                        <TouchableOpacity onPress={onBack} style={S.iconCircle} activeOpacity={0.8}>
                            <Ionicons name="arrow-back" size={18} color={GOLD} />
                        </TouchableOpacity>

                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: -0.3 }}>
                                Abu <Text style={{ color: GOLD }}>Mafhal</Text> Shop
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9.5, fontWeight: '600', letterSpacing: 1 }}>
                                {loading ? 'Loading...' : `${filteredProducts.length} Products Available`}
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                            {/* Compare */}
                            <TouchableOpacity onPress={onCompareClick} style={[S.iconCircle, { borderColor: GOLD_BORDER }]} activeOpacity={0.8}>
                                <Ionicons name="git-compare-outline" size={16} color={GOLD} />
                                {comparisonCount > 0 && (
                                    <View style={S.headerBadge}>
                                        <Text style={{ color: NAVY, fontSize: 7, fontWeight: '900' }}>{comparisonCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Cart */}
                            <TouchableOpacity onPress={onGoToCart} style={[S.iconCircle, { borderColor: GOLD_BORDER }]} activeOpacity={0.8}>
                                <Ionicons name="cart-outline" size={17} color={GOLD} />
                                {cartCount > 0 && (
                                    <View style={[S.headerBadge, { backgroundColor: '#EF4444' }]}>
                                        <Text style={{ color: 'white', fontSize: 7, fontWeight: '900' }}>{cartCount > 99 ? '99+' : cartCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Search bar */}
                    <View style={S.searchBar}>
                        <Ionicons name="search-outline" size={15} color="rgba(255,255,255,0.5)" />
                        <TextInput
                            placeholder="Search phones, fashion, electronics..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            style={S.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length === 0 ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TouchableOpacity onPress={handleVoiceSearch} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                                    <Ionicons name="mic-outline" size={16} color={GOLD} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleImageSearch} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                                    <Ionicons name="camera-outline" size={16} color={GOLD} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Category pills */}
                    <FlatList
                        horizontal
                        data={categories}
                        keyExtractor={(item, idx) => (item.slug || item.label || idx.toString())}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4, gap: 7, alignItems: 'center' }}
                        renderItem={({ item: cat }) => {
                            const active = activeCategory === cat.label || activeCategory === cat.slug;
                            return (
                                <TouchableOpacity
                                    style={[S.chip, active && S.chipActive]}
                                    onPress={() => setActiveCategory(cat.label)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name={cat.icon || 'pricetag-outline'} size={11} color={active ? NAVY : 'rgba(255,255,255,0.7)'} />
                                    <Text style={[S.chipTxt, active && S.chipTxtActive]}>{cat.label}</Text>
                                </TouchableOpacity>
                            );
                        }}
                    />
                </SafeAreaView>
            </LinearGradient>

            {/* ── PRODUCT GRID ── */}
            {loading ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingTop: 16, gap: 12 }}>
                    {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={filteredProducts}
                    keyExtractor={(item, i) => item?.id?.toString() || i.toString()}
                    renderItem={renderProduct}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    numColumns={2}
                    columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 14 }}
                    ListHeaderComponent={
                        <View>
                            {renderBanners()}
                            {renderHotDeals()}
                            {renderSubHeader()}
                        </View>
                    }
                    ListEmptyComponent={renderEmpty}
                    contentContainerStyle={{ paddingTop: 6, paddingBottom: 120, flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[GOLD, NAVY]}
                            tintColor={GOLD}
                        />
                    }
                />
            )}

            {/* ── FLOATING CART FAB ── */}
            <Animated.View style={[S.fabCart, { transform: [{ scale: fabScale }] }]}>
                <TouchableOpacity style={S.fabInner} onPress={onGoToCart} activeOpacity={0.85}>
                    <LinearGradient colors={[GOLD, '#C4922A']} style={S.fabGrad}>
                        <Ionicons name="cart-outline" size={22} color={NAVY} />
                        {(cartCount ?? 0) > 0 && (
                            <View style={S.fabBadge}>
                                <Text style={S.fabBadgeTxt}>{cartCount}</Text>
                            </View>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>

            {/* ── SCROLL TO TOP ── */}
            <Animated.View style={[S.scrollTopBtn, { opacity: topBtnAnim, transform: [{ scale: topBtnAnim }] }]}>
                <TouchableOpacity
                    style={S.scrollTopInner}
                    onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
                >
                    <Ionicons name="chevron-up" size={20} color={GOLD} />
                </TouchableOpacity>
            </Animated.View>

            {/* ── Voice Modal ── */}
            {showVoiceModal && (
                <View style={S.voiceOverlay}>
                    <View style={S.voiceCard}>
                        <LinearGradient colors={[NAVY, NAVY2]} style={S.voicePulse}>
                            <Ionicons name="mic" size={32} color={GOLD} />
                        </LinearGradient>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: NAVY, marginTop: 14 }}>Listening…</Text>
                        <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>Say "Phones" or "Fashion"</Text>
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 14 }}>
                            {[1, 2, 3, 4, 5].map(i => {
                                const h = [12, 20, 28, 20, 12][i - 1];
                                return <View key={i} style={{ width: 4, height: h, backgroundColor: GOLD, borderRadius: 2 }} />;
                            })}
                        </View>
                    </View>
                </View>
            )}

            {/* ── Toast ── */}
            {toast.visible && (
                <Animated.View style={[S.toast, {
                    opacity: fadeAnim,
                    transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }]
                }]}>
                    <Ionicons name={toast.icon} size={16} color={GOLD} />
                    <Text style={S.toastTxt}>{toast.message}</Text>
                </Animated.View>
            )}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
const S = StyleSheet.create({

    // Header
    header: {
        borderBottomWidth: 1,
        borderBottomColor: GOLD_BORDER,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 20,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 8,
        gap: 10,
    },
    iconCircle: {
        width: 34, height: 34,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
        position: 'relative', flexShrink: 0,
    },
    headerBadge: {
        position: 'absolute', top: -3, right: -3,
        backgroundColor: GOLD,
        borderRadius: 7, minWidth: 15, height: 15,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 2,
    },

    // Search
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        paddingHorizontal: 12, height: 40,
        marginHorizontal: 14, marginBottom: 10,
        borderWidth: 1, borderColor: GOLD_BORDER,
        gap: 8,
    },
    searchInput: {
        flex: 1, fontSize: 12.5, fontWeight: '500',
        color: '#FFFFFF', paddingVertical: 0, minWidth: 0,
    },

    // Category chips
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 11, paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
        height: 30,
    },
    chipActive: {
        backgroundColor: GOLD, borderColor: GOLD,
    },
    chipTxt: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
    chipTxtActive: { color: NAVY, fontWeight: '800' },

    // Sub-header
    subHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: 'white',
        borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEF2F8',
        marginBottom: 10, marginTop: 16,
    },
    countBubble: {
        backgroundColor: GOLD_LIGHT, paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: 10, borderWidth: 1, borderColor: GOLD_BORDER,
    },
    countBubbleTxt: { fontSize: 11, fontWeight: '800', color: GOLD },
    sortPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 14, backgroundColor: '#F1F5F9',
        borderWidth: 1, borderColor: '#E9EDF5',
    },
    sortPillActive: { backgroundColor: GOLD, borderColor: GOLD },
    sortTxt: { fontSize: 11, fontWeight: '700', color: '#64748B' },

    // Product card
    card: {
        width: COLUMN_WIDTH, marginBottom: 12,
        backgroundColor: 'white', borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1, borderColor: '#EEF2F8',
        elevation: 4,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12,
    },
    imgBox: { height: 145, position: 'relative', overflow: 'hidden', backgroundColor: '#F0F4FA' },
    imgFull: { width: '100%', height: '100%' },
    imgGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },

    badge: {
        position: 'absolute', top: 8, left: 8,
        paddingHorizontal: 7, paddingVertical: 3,
        borderRadius: 8, zIndex: 10,
    },
    badgeTxt: { color: 'white', fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },

    iconStack: { position: 'absolute', top: 8, right: 8, flexDirection: 'column', gap: 5, zIndex: 10 },
    iconBtn: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.92)',
        alignItems: 'center', justifyContent: 'center',
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3,
    },
    iconBtnHeart:   { backgroundColor: 'rgba(239,68,68,0.1)' },
    iconBtnCompare: { backgroundColor: GOLD_LIGHT },

    freeTag: {
        position: 'absolute', bottom: 8, left: 8,
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(16,185,129,0.15)',
        paddingHorizontal: 6, paddingVertical: 3,
        borderRadius: 6, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    },
    freeTxt: { fontSize: 8, fontWeight: '800', color: '#059669' },

    outOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,26,46,0.65)', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
    outPill:    { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    outTxt:     { color: 'white', fontSize: 9, fontWeight: '900', letterSpacing: 1 },

    info:      { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 },
    cardTitle: { fontSize: 12, fontWeight: '700', color: NAVY, lineHeight: 16, marginBottom: 5 },

    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
    ratingVal: { fontSize: 10, fontWeight: '800', color: GOLD, marginLeft: 2 },
    ratingCnt: { fontSize: 10, color: '#94A3B8' },
    stockPill: { marginLeft: 4, backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
    stockWarn: { fontSize: 9, color: '#DC2626', fontWeight: '700' },

    priceCartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    price:    { fontSize: 14, fontWeight: '900', color: NAVY, lineHeight: 18 },
    oldPrice: { fontSize: 10, color: '#94A3B8', textDecorationLine: 'line-through', marginTop: 1 },

    cartBtn: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: NAVY,
        alignItems: 'center', justifyContent: 'center',
        elevation: 5, shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6,
        borderWidth: 1, borderColor: GOLD_BORDER,
    },

    // Hot deals
    dealCard: {
        width: 145, backgroundColor: 'white',
        borderRadius: 18, overflow: 'hidden',
        borderWidth: 1, borderColor: '#EEF2F8',
        elevation: 4, shadowColor: NAVY,
        shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8,
    },
    dealImg:   { width: '100%', height: 105 },
    dealGrad:  { position: 'absolute', top: 0, left: 0, right: 0, height: 105 },
    dealBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7 },
    dealBadgeTxt: { color: 'white', fontSize: 9, fontWeight: '900' },
    dealInfo:  { padding: 9 },
    dealName:  { fontSize: 11, fontWeight: '700', color: NAVY, marginBottom: 4 },
    dealPrice: { fontSize: 13, fontWeight: '900', color: GOLD },
    dealOld:   { fontSize: 10, color: '#94A3B8', textDecorationLine: 'line-through' },

    // FAB Cart
    fabCart: {
        position: 'absolute', bottom: 28, right: 20,
        elevation: 10, zIndex: 90,
        shadowColor: NAVY, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12,
    },
    fabInner: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden' },
    fabGrad:  { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    fabBadge: {
        position: 'absolute', top: 0, right: 0,
        backgroundColor: '#EF4444', borderRadius: 10,
        minWidth: 18, height: 18,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
        borderWidth: 2, borderColor: 'white',
    },
    fabBadgeTxt: { color: 'white', fontSize: 9, fontWeight: '900' },

    // Scroll to top
    scrollTopBtn: { position: 'absolute', bottom: 100, right: 20, elevation: 8, zIndex: 89 },
    scrollTopInner: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: GOLD_BORDER,
        shadowColor: NAVY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },

    // Voice
    voiceOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
    voiceCard:  { backgroundColor: 'white', padding: 30, borderRadius: 28, alignItems: 'center', width: 230, borderWidth: 2, borderColor: GOLD_BORDER },
    voicePulse: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },

    // Toast
    toast: {
        position: 'absolute', bottom: 40, alignSelf: 'center',
        backgroundColor: NAVY,
        paddingHorizontal: 18, paddingVertical: 11,
        borderRadius: 30, flexDirection: 'row', alignItems: 'center', gap: 8,
        elevation: 10, zIndex: 100,
        borderWidth: 1, borderColor: GOLD_BORDER,
        shadowColor: NAVY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10,
    },
    toastTxt: { color: 'white', fontWeight: '700', fontSize: 12, letterSpacing: 0.3 },
});
