import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, SafeAreaView, TextInput,
    FlatList, Image, ImageBackground, Animated,
    StyleSheet, Platform, StatusBar, RefreshControl, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WIDTH, COLUMN_WIDTH } from '../styles/theme';
import { useComparison } from '../context/ComparisonContext';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { geminiService } from '../services/geminiService';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { CountdownTimer } from '../components/CountdownTimer';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPrice = (n) => {
    const num = Number(n);
    if (!num) return '—';
    if (num >= 1_000_000) return `₦${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000)     return `₦${(num / 1_000).toFixed(0)}K`;
    return `₦${num}`;
};

const CATS = [
    { label: 'All',     icon: 'apps-outline' },
    { label: 'Phones',  icon: 'phone-portrait-outline' },
    { label: 'Fashion', icon: 'shirt-outline' },
    { label: 'Shoes',   icon: 'footsteps-outline' },
    { label: 'Gaming',  icon: 'game-controller-outline' },
    { label: 'Home',    icon: 'home-outline' },
];

// ─── Shimmer Skeleton ──────────────────────────────────────────────────────────
const SkeletonCard = () => {
    const shimmer = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
                Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
            ])
        ).start();
    }, []);
    const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });
    return (
        <Animated.View style={[sk.card, { opacity }]}>
            <View style={sk.img} />
            <View style={{ padding: 10, gap: 6 }}>
                <View style={sk.line} />
                <View style={[sk.line, { width: '55%' }]} />
                <View style={[sk.line, { width: '38%', backgroundColor: '#C7D2FE' }]} />
            </View>
        </Animated.View>
    );
};
const sk = StyleSheet.create({
    card: { width: COLUMN_WIDTH, backgroundColor: '#F0F4F9', borderRadius: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E8EDF5' },
    img:  { height: 140, backgroundColor: '#E2E8F0' },
    line: { height: 10, borderRadius: 5, backgroundColor: '#E2E8F0', width: '80%' },
});

// ═══════════════════════════════════════════════════════════════════════════════
export const ShopPage = ({ onBack, cartCount, onGoToCart, addToCart, onProductClick, onCompareClick }) => {
    const { addToComparison, isInComparison, comparisonCount } = useComparison();

    const [products,         setProducts]         = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading,          setLoading]          = useState(true);
    const [refreshing,       setRefreshing]       = useState(false);
    const [activeCategory,   setActiveCategory]   = useState('All');
    const [searchQuery,      setSearchQuery]      = useState('');
    const [sortBy,           setSortBy]           = useState('default');
    const [wishlist,         setWishlist]         = useState([]);
    const [showVoiceModal,   setShowVoiceModal]   = useState(false);
    const [recording,        setRecording]        = useState(null);
    const [showScrollTop,    setShowScrollTop]    = useState(false);

    // Banners
    const [banners,          setBanners]          = useState([]);
    const [promoBanners,     setPromoBanners]     = useState([]);
    const [currentPromoIdx,  setCurrentPromoIdx]  = useState(0);
    const promoFlatListRef = useRef(null);
    const promoScrollX     = useRef(new Animated.Value(0)).current;
    const scrollX          = useRef(new Animated.Value(0)).current;
    const slideRef         = useRef(null);
    const flatListRef      = useRef(null);

    // Toast & animations
    const [toast,   setToast]   = useState({ visible: false, message: '', icon: 'checkmark-circle' });
    const fadeAnim  = useRef(new Animated.Value(0)).current;
    const fabScale  = useRef(new Animated.Value(1)).current;
    const topBtnAnim = useRef(new Animated.Value(0)).current;

    // ── Effects ───────────────────────────────────────────────────────────────
    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (banners.length > 1) {
            const t = setInterval(() => {
                setBanners(prev => {
                    slideRef.current?.scrollTo({ x: ((banners.indexOf(prev[0]) + 1) % banners.length) * (WIDTH - 32), animated: true });
                    return prev;
                });
            }, 3000);
            return () => clearInterval(t);
        }
    }, [banners.length]);

    useEffect(() => {
        if (promoBanners.length > 1) {
            const t = setInterval(() => {
                setCurrentPromoIdx(prev => {
                    const next = (prev + 1) % promoBanners.length;
                    promoFlatListRef.current?.scrollToIndex({ index: next, animated: true });
                    return next;
                });
            }, 4000);
            return () => clearInterval(t);
        }
    }, [promoBanners.length]);

    useEffect(() => { filterProducts(); }, [activeCategory, searchQuery, products, sortBy]);

    useEffect(() => {
        (async () => {
            await Audio.requestPermissionsAsync();
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        })();
        return () => { recording?.stopAndUnloadAsync(); };
    }, []);

    // Scroll-to-top visibility
    const onScroll = (e) => {
        const y = e.nativeEvent.contentOffset.y;
        const shouldShow = y > 300;
        if (shouldShow !== showScrollTop) {
            setShowScrollTop(shouldShow);
            Animated.spring(topBtnAnim, { toValue: shouldShow ? 1 : 0, useNativeDriver: true, tension: 80, friction: 8 }).start();
        }
    };

    // ── Data ──────────────────────────────────────────────────────────────────
    const fetchData = async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const { data: bAll } = await supabase.from('banners').select('*').eq('is_active', true).order('display_order');
            setBanners((bAll || []).filter(b => !b.section || b.section === 'shop' || b.section === 'all' || b.section === ''));

            const { data: promoData } = await supabase.from('banners').select('*').eq('section', 'promo').eq('is_active', true).order('created_at', { ascending: false });
            const validPromos = (promoData || []).map(p => {
                let linkData = { text: p.action_link || '', locations: ['home'] };
                try { const parsed = JSON.parse(p.action_link); if (parsed && typeof parsed === 'object') linkData = { ...linkData, ...parsed }; } catch (_) {}
                return { ...p, linkData };
            }).filter(p => {
                const loc = p.linkData.locations?.includes('shop');
                const exp = p.linkData?.timerEnd ? (isNaN(new Date(p.linkData.timerEnd)) || new Date() <= new Date(p.linkData.timerEnd)) : true;
                return loc && exp;
            });
            setPromoBanners(validPromos);

            const { data } = await supabase.from('products').select('*').eq('status', 'approved').limit(100);
            setProducts((data || []).map(p => ({ ...p, rating: p.rating || 5, reviews: p.reviews || 0 })));
            console.log('ShopPage: Real Data Fetched', (data || []).length);

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: wData } = await supabase.from('wishlists').select('items').eq('id', user.id).single();
                if (wData?.items) setWishlist(wData.items);
            }
        } catch (err) {
            console.log('ShopPage fetchData error:', err);
            setProducts([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => { setRefreshing(true); fetchData(true); };

    const filterProducts = () => {
        let r = [...products];
        if (activeCategory !== 'All') r = r.filter(p => p.category === activeCategory || p.name?.includes(activeCategory));
        if (searchQuery) r = r.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()));
        if (sortBy === 'priceLow')  r.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        if (sortBy === 'priceHigh') r.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        if (sortBy === 'reviews')   r.sort((a, b) => b.reviews - a.reviews);
        setFilteredProducts(r);
    };

    const getImageUrl = (images) => {
        if (!images) return null;
        if (typeof images === 'string') { try { const p = JSON.parse(images); return Array.isArray(p) && p.length > 0 ? p[0] : p; } catch { return images; } }
        if (Array.isArray(images) && images.length > 0) return images[0];
        return null;
    };

    // ── Toast ─────────────────────────────────────────────────────────────────
    const showToast = (message, icon = 'checkmark-circle') => {
        setToast({ visible: true, message, icon });
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
            Animated.delay(2000),
            Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
        ]).start(() => setToast(t => ({ ...t, visible: false })));
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleAddToCart = (item) => {
        // Pulse FAB
        Animated.sequence([
            Animated.spring(fabScale, { toValue: 1.3, useNativeDriver: true, tension: 200 }),
            Animated.spring(fabScale, { toValue: 1,   useNativeDriver: true, tension: 200 }),
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

    // ── Voice / Image ──────────────────────────────────────────────────────────
    const handleVoiceSearch = async () => {
        try {
            if (recording) {
                await stopRecording();
            } else {
                await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
                const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
                setRecording(rec); setShowVoiceModal(true);
                setTimeout(() => stopRecording(rec), 4000);
            }
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

    const handleImageSearch = async () => {
        try {
            const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.5, base64: true });
            if (!res.canceled && res.assets[0].base64) {
                showToast('Analyzing image…', 'scan');
                const kw = await geminiService.searchByImage(res.assets[0].base64);
                if (kw) { setSearchQuery(kw); showToast(`Found: ${kw}`, 'checkmark-circle'); }
                else showToast('Could not identify product', 'help-circle');
            }
        } catch (e) { showToast('Gallery Error', 'alert-circle'); }
    };

    // ── Render Helpers ─────────────────────────────────────────────────────────
    const SORT_LABELS = { default: 'Default', priceLow: 'Price ↑', priceHigh: 'Price ↓', reviews: 'Top Rated' };
    const nextSort = () => setSortBy(p => p === 'default' ? 'priceLow' : p === 'priceLow' ? 'priceHigh' : p === 'priceHigh' ? 'reviews' : 'default');

    const hotDeals = products.filter(p => Number(p.discount) > 0).slice(0, 10);

    const renderPromoDots = () => {
        if (promoBanners.length <= 1) return null;
        return (
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
                {promoBanners.map((_, i) => {
                    const w  = promoScrollX.interpolate({ inputRange: [(i-1)*(WIDTH-32), i*(WIDTH-32), (i+1)*(WIDTH-32)], outputRange: [5, 18, 5], extrapolate: 'clamp' });
                    const op = promoScrollX.interpolate({ inputRange: [(i-1)*(WIDTH-32), i*(WIDTH-32), (i+1)*(WIDTH-32)], outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
                    return <Animated.View key={i} style={{ height: 5, width: w, borderRadius: 3, backgroundColor: '#6366F1', marginHorizontal: 2, opacity: op }} />;
                })}
            </View>
        );
    };

    // ── 🔥 HOT DEALS horizontal strip ─────────────────────────────────────────
    const renderHotDeals = () => {
        if (hotDeals.length === 0) return null;
        return (
            <View style={styles.sectionBlock}>
                {/* Section Header */}
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <View style={styles.sectionAccent} />
                        <Text style={styles.sectionTitle}>🔥 Hot Deals</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSortBy('priceLow')}>
                        <Text style={styles.seeAll}>See all</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
                    {hotDeals.map(item => (
                        <TouchableOpacity key={item.id} style={styles.dealCard} activeOpacity={0.84} onPress={() => onProductClick(item)}>
                            <Image
                                source={{ uri: getImageUrl(item.images) || 'https://placehold.co/200x160' }}
                                style={styles.dealImg}
                                resizeMode="cover"
                            />
                            {/* Discount badge */}
                            <View style={styles.dealBadge}>
                                <Text style={styles.dealBadgeTxt}>-{item.discount}%</Text>
                            </View>
                            {/* Info */}
                            <View style={styles.dealInfo}>
                                <Text style={styles.dealName} numberOfLines={1}>{item.name}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Text style={styles.dealPrice}>{fmtPrice(item.price)}</Text>
                                    <Text style={styles.dealOld}>{fmtPrice(Number(item.price) * (1 + Number(item.discount) / 100))}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        );
    };

    // ── Product Card ───────────────────────────────────────────────────────────
    const renderProduct = ({ item }) => {
        if (!item) return null;
        const inWishlist = wishlist.includes(item.id);
        const inCompare  = isInComparison(item.id);
        const isFreeShip = Number(item.price) >= 50000;
        const isLowStock = item.stock != null && item.stock > 0 && item.stock <= 5;
        const isOutStock = item.stock != null && item.stock === 0;

        return (
            <TouchableOpacity style={styles.card} activeOpacity={0.84} onPress={() => onProductClick(item)}>
                {/* IMAGE */}
                <View style={styles.imgBox}>
                    <Image
                        source={{ uri: getImageUrl(item?.images) || 'https://placehold.co/400x300' }}
                        style={styles.imgFull}
                        resizeMode="cover"
                    />
                    <View style={styles.imgBottomFade} />

                    {isOutStock && (
                        <View style={styles.outOverlay}>
                            <View style={styles.outPill}><Text style={styles.outTxt}>OUT OF STOCK</Text></View>
                        </View>
                    )}

                    {item.discount > 0 ? (
                        <View style={styles.badge}><Text style={styles.badgeTxt}>-{item.discount}%</Text></View>
                    ) : item.isNew ? (
                        <View style={[styles.badge, { backgroundColor: '#6366F1' }]}><Text style={styles.badgeTxt}>NEW</Text></View>
                    ) : null}

                    {/* Icon stack */}
                    <View style={styles.iconStack}>
                        <TouchableOpacity style={[styles.iconBtn, inWishlist && styles.iconBtnHeart]} onPress={() => toggleWishlist(item.id)}>
                            <Ionicons name={inWishlist ? 'heart' : 'heart-outline'} size={13} color={inWishlist ? '#EF4444' : '#64748B'} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconBtn, inCompare && styles.iconBtnCompare]} onPress={() => addToComparison(item)}>
                            <Ionicons name={inCompare ? 'git-compare' : 'git-compare-outline'} size={13} color={inCompare ? '#6366F1' : '#64748B'} />
                        </TouchableOpacity>
                    </View>

                    {isFreeShip && !isOutStock && (
                        <View style={styles.freeTag}>
                            <Ionicons name="bicycle-outline" size={9} color="#059669" />
                            <Text style={styles.freeTxt}>FREE</Text>
                        </View>
                    )}
                </View>

                {/* INFO */}
                <View style={styles.info}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item?.name || 'Product'}</Text>

                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={9} color="#FBBF24" />
                        <Text style={styles.ratingVal}>{item.rating?.toFixed(1) || '5.0'}</Text>
                        <Text style={styles.ratingCnt}> ({item.reviews ?? 0})</Text>
                        {isLowStock && (
                            <View style={styles.stockPill}><Text style={styles.stockWarn}>{item.stock} left</Text></View>
                        )}
                    </View>

                    <View style={styles.priceCartRow}>
                        <View>
                            <Text style={styles.price}>{fmtPrice(item.price)}</Text>
                            {item.discount > 0 && <Text style={styles.oldPrice}>{fmtPrice(Number(item.price) * (1 + Number(item.discount) / 100))}</Text>}
                        </View>
                        {!isOutStock && (
                            <TouchableOpacity style={styles.cartBtn} onPress={() => handleAddToCart(item)}>
                                <Ionicons name="bag-add-outline" size={14} color="white" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // ── Empty ──────────────────────────────────────────────────────────────────
    const renderEmpty = () => (
        <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
                <Ionicons name="search-outline" size={40} color="#A5B4FC" />
            </View>
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptySub}>Try adjusting your filters or search term.</Text>
            <TouchableOpacity onPress={() => { setActiveCategory('All'); setSearchQuery(''); }} style={styles.clearBtn}>
                <Ionicons name="refresh-outline" size={14} color="white" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Clear Filters</Text>
            </TouchableOpacity>
        </View>
    );

    // ── Memoized banners header ────────────────────────────────────────────────
    const memoizedHeader = React.useMemo(() => (
        <View style={{ marginBottom: 4 }}>
            {banners.length > 0 && (
                <>
                    <Animated.ScrollView
                        ref={slideRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                        style={{ marginHorizontal: 14, marginTop: 14, height: 150, borderRadius: 18, overflow: 'hidden' }}
                        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                        onMomentumScrollEnd={e => { const i = Math.round(e.nativeEvent.contentOffset.x / (WIDTH - 32)); }}
                        scrollEventThrottle={16}
                    >
                        {banners.map(banner => (
                            <TouchableOpacity key={banner.id} activeOpacity={0.9} style={{ width: WIDTH - 28, height: 150 }}>
                                <ImageBackground
                                    source={{ uri: banner.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=800' }}
                                    style={{ width: '100%', height: '100%' }}
                                    imageStyle={{ borderRadius: 18 }}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>
                        ))}
                    </Animated.ScrollView>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
                        {banners.map((_, i) => {
                            const w  = scrollX.interpolate({ inputRange: [(i-1)*(WIDTH-32), i*(WIDTH-32), (i+1)*(WIDTH-32)], outputRange: [5, 18, 5], extrapolate: 'clamp' });
                            const op = scrollX.interpolate({ inputRange: [(i-1)*(WIDTH-32), i*(WIDTH-32), (i+1)*(WIDTH-32)], outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
                            return <Animated.View key={i} style={{ height: 5, width: w, borderRadius: 3, backgroundColor: '#6366F1', marginHorizontal: 2, opacity: op }} />;
                        })}
                    </View>
                </>
            )}

            {promoBanners.length > 0 && (
                <View style={{ marginTop: 16 }}>
                    <FlatList
                        ref={promoFlatListRef} data={promoBanners} horizontal pagingEnabled
                        showsHorizontalScrollIndicator={false} snapToInterval={WIDTH} decelerationRate="fast"
                        scrollEventThrottle={16}
                        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: promoScrollX } } }], { useNativeDriver: false })}
                        onMomentumScrollEnd={e => { const i = Math.round(e.nativeEvent.contentOffset.x / WIDTH); setCurrentPromoIdx(i); }}
                        keyExtractor={item => item.id.toString()}
                        renderItem={({ item: promo }) => (
                            <TouchableOpacity activeOpacity={0.9}
                                onPress={() => {
                                    if (promo.linkData?.productId) {
                                        supabase.from('products').select('*').eq('id', promo.linkData.productId).single()
                                            .then(({ data }) => { if (data) onProductClick({ ...data, promoDiscount: promo.linkData.discountValue ? { type: promo.linkData.discountType || 'percent', value: promo.linkData.discountValue } : null }); })
                                            .catch(() => {});
                                    }
                                }}
                                style={{ width: WIDTH - 28, marginHorizontal: 14, borderRadius: 20, overflow: 'hidden', height: 128, backgroundColor: '#0F172A' }}
                            >
                                <Image source={{ uri: promo.image_url }} style={{ width: '100%', height: '100%', position: 'absolute', opacity: 0.45 }} resizeMode="cover" />
                                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.45)' }} />
                                <View style={{ padding: 18, justifyContent: 'center', height: '100%' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ backgroundColor: '#EF4444', alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginBottom: 6 }}>
                                                <Text style={{ color: 'white', fontWeight: '900', fontSize: 9, letterSpacing: 0.8 }}>{promo.subtitle?.toUpperCase() || 'LIMITED OFFER'}</Text>
                                            </View>
                                            <Text style={{ fontSize: 18, fontWeight: '900', color: 'white', lineHeight: 22, paddingRight: 8 }} numberOfLines={2}>{promo.title || 'Special Promotion'}</Text>
                                        </View>
                                        {promo.linkData?.timerEnd && (
                                            <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' }}>
                                                <Text style={{ color: 'white', fontSize: 8, fontWeight: '800', marginBottom: 3, letterSpacing: 0.8 }}>ENDS IN</Text>
                                                <CountdownTimer targetDate={promo.linkData.timerEnd} lightMode />
                                            </View>
                                        )}
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                                        <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 12 }}>{promo.linkData?.text || 'Explore Offer'}</Text>
                                        <Ionicons name="arrow-forward" size={12} color="#F8FAFC" />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                    {renderPromoDots()}
                </View>
            )}
        </View>
    ), [banners, promoBanners, scrollX, promoScrollX]);

    // ── Sub-header ─────────────────────────────────────────────────────────────
    const renderSubHeader = () => (
        <View style={styles.subHeader}>
            {/* "ALL PRODUCTS" decorated label */}
            <View style={styles.sectionTitleRow}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>📦 All Products</Text>
                <View style={styles.countBubble}>
                    <Text style={styles.countBubbleTxt}>{filteredProducts.length}</Text>
                </View>
            </View>
            <TouchableOpacity style={[styles.sortPill, sortBy !== 'default' && styles.sortPillActive]} onPress={nextSort}>
                <Ionicons name="swap-vertical-outline" size={12} color={sortBy !== 'default' ? 'white' : '#64748B'} />
                <Text style={[styles.sortTxt, sortBy !== 'default' && { color: 'white' }]}>{SORT_LABELS[sortBy]}</Text>
            </TouchableOpacity>
        </View>
    );

    // ── Main Render ────────────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safe}>

                {/* ── DECORATED HEADER ── */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.iconCircle}>
                        <Ionicons name="arrow-back" size={20} color="#0F172A" />
                    </TouchableOpacity>

                    {/* Center: brand + search */}
                    <View style={{ flex: 1 }}>
                        <View style={styles.searchBar}>
                            <Ionicons name="search-outline" size={15} color="#94A3B8" />
                            <TextInput
                                placeholder="Search products…"
                                placeholderTextColor="#94A3B8"
                                style={styles.searchInput}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length === 0 ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <TouchableOpacity onPress={handleVoiceSearch}>
                                        <Ionicons name="mic-outline" size={16} color="#6366F1" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleImageSearch}>
                                        <Ionicons name="camera-outline" size={16} color="#6366F1" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={15} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Compare */}
                    <TouchableOpacity onPress={onCompareClick} style={[styles.iconCircle, { position: 'relative' }]}>
                        <Ionicons name="git-compare-outline" size={20} color="#0F172A" />
                        {comparisonCount > 0 && (
                            <View style={styles.compareBadge}>
                                <Text style={{ color: 'white', fontSize: 9, fontWeight: '800' }}>{comparisonCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ── Gradient accent strip ── */}
                <View style={styles.accentStrip}>
                    <View style={styles.accentInner} />
                </View>

                {/* ── Category Chips ── */}
                <FlatList
                    horizontal data={CATS} keyExtractor={i => i.label}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 9, gap: 7 }}
                    renderItem={({ item: cat }) => {
                        const active = activeCategory === cat.label;
                        return (
                            <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={() => setActiveCategory(cat.label)}>
                                <Ionicons name={cat.icon} size={12} color={active ? 'white' : '#64748B'} />
                                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{cat.label}</Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            </SafeAreaView>

            {/* ── Product Grid ── */}
            {loading ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingTop: 16, gap: 12 }}>
                    {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={filteredProducts}
                    keyExtractor={(item, i) => i.toString()}
                    renderItem={renderProduct}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    ListHeaderComponent={
                        <View>
                            {memoizedHeader}
                            {renderHotDeals()}
                            {!loading && renderSubHeader()}
                        </View>
                    }
                    ListEmptyComponent={renderEmpty}
                    numColumns={2}
                    columnWrapperStyle={filteredProducts.length > 0
                        ? { justifyContent: 'space-between', paddingHorizontal: 14 }
                        : null}
                    contentContainerStyle={{ paddingTop: 6, paddingBottom: 110, flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#6366F1']}
                            tintColor="#6366F1"
                        />
                    }
                />
            )}

            {/* ── FLOATING CART FAB ── */}
            {onGoToCart && (
                <Animated.View style={[styles.fabCart, { transform: [{ scale: fabScale }] }]}>
                    <TouchableOpacity style={styles.fabInner} onPress={onGoToCart} activeOpacity={0.85}>
                        <Ionicons name="bag-outline" size={22} color="white" />
                        {(cartCount ?? 0) > 0 && (
                            <View style={styles.fabBadge}>
                                <Text style={styles.fabBadgeTxt}>{cartCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* ── SCROLL TO TOP ── */}
            <Animated.View style={[styles.scrollTopBtn, {
                opacity: topBtnAnim,
                transform: [{ scale: topBtnAnim }],
            }]}>
                <TouchableOpacity
                    style={styles.scrollTopInner}
                    onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
                >
                    <Ionicons name="chevron-up" size={20} color="white" />
                </TouchableOpacity>
            </Animated.View>

            {/* ── Voice modal ── */}
            {showVoiceModal && (
                <View style={styles.voiceOverlay}>
                    <View style={styles.voiceCard}>
                        <View style={styles.voicePulse}>
                            <Ionicons name="mic" size={32} color="white" />
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 14 }}>Listening…</Text>
                        <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>Say "Phones" or "Fashion"</Text>
                    </View>
                </View>
            )}

            {/* ── Toast ── */}
            {toast.visible && (
                <Animated.View style={[styles.toast, {
                    opacity: fadeAnim,
                    transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }]
                }]}>
                    <Ionicons name={toast.icon} size={18} color="#10B981" />
                    <Text style={styles.toastTxt}>{toast.message}</Text>
                </Animated.View>
            )}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F3FA' },
    safe: {
        backgroundColor: 'white',
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) : 0,
    },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: 'white',
        gap: 8,
    },
    iconCircle: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: '#F4F6FB',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: '#E9EDF5',
    },
    compareBadge: {
        position: 'absolute', top: -2, right: -2,
        backgroundColor: '#6366F1', borderRadius: 8,
        minWidth: 16, height: 16,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
    },
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F4F6FB', borderRadius: 22,
        paddingHorizontal: 12, height: 40,
        borderWidth: 1, borderColor: '#E9EDF5', gap: 6,
    },
    searchInput: { flex: 1, fontSize: 13, color: '#1E293B', paddingVertical: 0 },

    // ── Gradient accent strip ──────────────────────────────────────────────────
    accentStrip: { height: 3, backgroundColor: '#EEF2F8', overflow: 'hidden' },
    accentInner: {
        height: 3, width: '35%',
        backgroundColor: '#6366F1',
        borderRadius: 2,
    },

    // ── Chips ─────────────────────────────────────────────────────────────────
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: 22, backgroundColor: '#F1F5F9',
        borderWidth: 1, borderColor: '#E9EDF5',
    },
    chipActive: {
        backgroundColor: '#6366F1', borderColor: '#6366F1',
        elevation: 5, shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8,
    },
    chipTxt:       { fontSize: 12, fontWeight: '700', color: '#64748B' },
    chipTxtActive: { color: 'white' },

    // ── Section blocks ────────────────────────────────────────────────────────
    sectionBlock: { marginTop: 18, marginBottom: 4 },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14, marginBottom: 12,
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    sectionAccent: {
        width: 4, height: 18, borderRadius: 2,
        backgroundColor: '#6366F1',
    },
    sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
    seeAll: { fontSize: 12, fontWeight: '700', color: '#6366F1' },

    // Product count bubble
    countBubble: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 7, paddingVertical: 2,
        borderRadius: 10, marginLeft: 4,
    },
    countBubbleTxt: { fontSize: 11, fontWeight: '800', color: '#6366F1' },

    // ── Sub header ────────────────────────────────────────────────────────────
    subHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 14, paddingVertical: 12,
        backgroundColor: 'white',
        borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEF2F8',
        marginBottom: 10, marginTop: 8,
    },
    sortPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 14, backgroundColor: '#F1F5F9',
        borderWidth: 1, borderColor: '#E9EDF5',
    },
    sortPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    sortTxt: { fontSize: 11, fontWeight: '700', color: '#64748B' },

    // ── Hot Deals card ────────────────────────────────────────────────────────
    dealCard: {
        width: 140,
        backgroundColor: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1, borderColor: '#E8EDF5',
        elevation: 3, shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8,
    },
    dealImg:   { width: '100%', height: 100 },
    dealBadge: {
        position: 'absolute', top: 7, left: 7,
        backgroundColor: '#EF4444',
        paddingHorizontal: 6, paddingVertical: 3,
        borderRadius: 7,
    },
    dealBadgeTxt: { color: 'white', fontSize: 9, fontWeight: '900' },
    dealInfo:  { padding: 9 },
    dealName:  { fontSize: 11, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
    dealPrice: { fontSize: 13, fontWeight: '900', color: '#6366F1' },
    dealOld:   { fontSize: 10, color: '#CBD5E1', textDecorationLine: 'line-through' },

    // ── Product card ──────────────────────────────────────────────────────────
    card: {
        width: COLUMN_WIDTH,
        backgroundColor: 'white',
        marginBottom: 12,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1, borderColor: '#E8EDF5',
        elevation: 4,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.09, shadowRadius: 12,
    },
    imgBox:       { height: 140, position: 'relative', overflow: 'hidden', backgroundColor: '#EBF0F8' },
    imgFull:      { width: '100%', height: '100%' },
    imgBottomFade:{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 45, backgroundColor: 'rgba(255,255,255,0.15)' },

    badge:    { position: 'absolute', top: 8, left: 8, backgroundColor: '#EF4444', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, zIndex: 10 },
    badgeTxt: { color: 'white', fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },

    iconStack:    { position: 'absolute', top: 8, right: 8, flexDirection: 'column', gap: 5, zIndex: 10 },
    iconBtn:      { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3 },
    iconBtnHeart: { backgroundColor: 'rgba(239,68,68,0.1)' },
    iconBtnCompare: { backgroundColor: 'rgba(99,102,241,0.1)' },

    freeTag: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
    freeTxt: { fontSize: 8, fontWeight: '800', color: '#059669' },

    outOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.62)', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
    outPill:    { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    outTxt:     { color: 'white', fontSize: 9, fontWeight: '900', letterSpacing: 1 },

    info:      { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 },
    cardTitle: { fontSize: 12, fontWeight: '700', color: '#1E293B', lineHeight: 16, marginBottom: 5 },

    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
    ratingVal: { fontSize: 10, fontWeight: '800', color: '#F59E0B', marginLeft: 2 },
    ratingCnt: { fontSize: 10, color: '#94A3B8' },
    stockPill: { marginLeft: 4, backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
    stockWarn: { fontSize: 9, color: '#DC2626', fontWeight: '700' },

    priceCartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    price:        { fontSize: 14, fontWeight: '900', color: '#6366F1', lineHeight: 18 },
    oldPrice:     { fontSize: 10, color: '#CBD5E1', textDecorationLine: 'line-through', marginTop: 1 },

    cartBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#0F172A',
        alignItems: 'center', justifyContent: 'center',
        elevation: 5, shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6,
    },

    // ── Empty ─────────────────────────────────────────────────────────────────
    emptyBox:   { alignItems: 'center', padding: 44, marginTop: 20 },
    emptyIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { color: '#1E293B', fontSize: 16, fontWeight: '800' },
    emptySub:   { color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 18 },
    clearBtn:   { marginTop: 18, backgroundColor: '#6366F1', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6 },

    // ── Floating Cart FAB ────────────────────────────────────────────────────
    fabCart: {
        position: 'absolute', bottom: 28, right: 20,
        elevation: 10, zIndex: 90,
        shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12,
    },
    fabInner: {
        width: 58, height: 58, borderRadius: 29,
        backgroundColor: '#0F172A',
        alignItems: 'center', justifyContent: 'center',
    },
    fabBadge: {
        position: 'absolute', top: -2, right: -2,
        backgroundColor: '#EF4444', borderRadius: 10,
        minWidth: 20, height: 20,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
        borderWidth: 2, borderColor: 'white',
    },
    fabBadgeTxt: { color: 'white', fontSize: 10, fontWeight: '900' },

    // ── Scroll to top ────────────────────────────────────────────────────────
    scrollTopBtn: {
        position: 'absolute', bottom: 100, right: 20,
        elevation: 8, zIndex: 89,
    },
    scrollTopInner: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#6366F1',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },

    // ── Voice ─────────────────────────────────────────────────────────────────
    voiceOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
    voiceCard:    { backgroundColor: 'white', padding: 30, borderRadius: 26, alignItems: 'center', width: 230 },
    voicePulse:   { width: 76, height: 76, borderRadius: 38, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center' },

    // ── Toast ─────────────────────────────────────────────────────────────────
    toast: {
        position: 'absolute', bottom: 40, alignSelf: 'center',
        backgroundColor: 'rgba(15,23,42,0.95)',
        paddingHorizontal: 18, paddingVertical: 11,
        borderRadius: 30, flexDirection: 'row', alignItems: 'center', gap: 8,
        elevation: 10, zIndex: 100,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10,
    },
    toastTxt: { color: 'white', fontWeight: '700', fontSize: 12, letterSpacing: 0.3 },
});
