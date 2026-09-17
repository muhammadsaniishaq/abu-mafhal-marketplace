import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    Image, Dimensions, StatusBar, Alert, RefreshControl,
    Linking, ActivityIndicator, StyleSheet, Animated, Modal,
    Share, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { StoreService } from '../services/storeService';
import {
    FOLLOWED_STORES_KEY,
    getFollowedStoreMap,
    toggleFollowStore,
    subscribeToFollowChanges
} from '../services/vendorFollowerService';
import { whatsappService } from '../services/whatsappService';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

const BRAND = {
    navy: '#0A192F',
    navyLight: '#0E223D',
    gold: '#D9A73A',
    goldLight: '#FEF3C7',
    goldDark: '#B45309',
    emerald: '#10B981',
    emeraldLight: '#ECFDF5',
    sky: '#0284C7',
    skyLight: '#E0F2FE',
    slate: '#64748B',
    slateDark: '#0F172A',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
};

const fmtPrice = (n) => {
    const num = Number(n);
    if (!num) return '₦0';
    return `₦${num.toLocaleString()}`;
};

export const StoresPage = ({
    user = null,
    onGoToCart,
    onGoToNotifications,
    cartCount = 0,
    onProductClick,
    onAddToCart,
    onGoToShop,
    onNavigate
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSubTab, setActiveSubTab] = useState('all_stores');
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
    const [stores, setStores] = useState([]);
    const [popularProducts, setPopularProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [followedStores, setFollowedStores] = useState({});
    const [currentUser, setCurrentUser] = useState(user || null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Selected Store for Dedicated Store Detail Modal
    const [selectedStore, setSelectedStore] = useState(null);
    const [storeSearchQuery, setStoreSearchQuery] = useState('');
    const [selectedStoreCategory, setSelectedStoreCategory] = useState('All');

    // Toast feedback
    const [toastMessage, setToastMessage] = useState('');
    const toastAnim = useRef(new Animated.Value(0)).current;

    const showToast = (msg) => {
        setToastMessage(msg);
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
            Animated.delay(2000),
            Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true })
        ]).start();
    };

    useEffect(() => {
        loadFollowedState();
        fetchStoresAndProducts();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('stores-realtime-sync-v3')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                fetchStoresAndProducts(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchStoresAndProducts(true);
            })
            .subscribe();

        const unsub = subscribeToFollowChanges((updatedMap) => {
            if (updatedMap) setFollowedStores(updatedMap);
        });

        const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                getFollowedStoreMap(session.user.id).then(map => setFollowedStores(map || {}));
            } else {
                setFollowedStores({});
            }
        });

        return () => {
            supabase.removeChannel(channel);
            if (typeof unsub === 'function') unsub();
            if (authSub?.subscription?.unsubscribe) authSub.subscription.unsubscribe();
        };
    }, []);

    const loadFollowedState = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setCurrentUser(null);
                setFollowedStores({});
                return;
            }
            let userRole = (user.user_metadata?.role || '').toLowerCase();
            if (!userRole) {
                const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                if (prof?.role) userRole = (prof.role || '').toLowerCase();
            }
            setCurrentUser({ ...user, role: userRole });
            const map = await getFollowedStoreMap(user.id);
            if (map) setFollowedStores(map);
        } catch (_) {}
    };

    useEffect(() => {
        if (user) {
            setCurrentUser(prev => ({ ...(prev || {}), ...user }));
        }
    }, [user]);

    const isOwnStore = (store) => {
        if (!store || !currentUser) return false;
        const uid = String(currentUser.id || '').trim();
        const role = String(currentUser.role || currentUser.user_metadata?.role || '').toLowerCase();
        const isAdmin = role === 'admin';

        const officialAliases = [
            '46913c66-4474-4962-82e4-b459b89d33fd',
            '6d3df1f5-4983-412e-a45f-db146348aac2',
            'official-abumafhal',
            'official',
            'admin'
        ];
        const isOfficial = !!(
            store.is_official ||
            store.isOfficial ||
            officialAliases.includes(String(store.id)) ||
            officialAliases.includes(String(store.vendor_id)) ||
            officialAliases.includes(String(store.userId)) ||
            (store.name && String(store.name).toLowerCase().includes('abu mafhal') && isAdmin)
        );
        if (isOfficial && isAdmin) return true;

        const storeOwnerId = String(store.vendor_id || store.vendorId || store.user_id || store.userId || store.id || '');
        if (storeOwnerId === uid) {
            return true;
        }
        return false;
    };

    const toggleFollow = async (storeId, storeName, storeObj = null) => {
        if (storeObj && isOwnStore(storeObj)) {
            Alert.alert(
                'Notice',
                'Ba za ka iya bin (follow) shagon kanka ba / You cannot follow your own store.'
            );
            return;
        }
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const activeUser = authUser || currentUser;
            if (!activeUser) {
                Alert.alert(
                    'Login Required',
                    'Please login to follow your favorite stores and receive exclusive updates.',
                    [
                        { text: 'Login', onPress: () => { if (onNavigate) onNavigate('auth'); } },
                        { text: 'Cancel', style: 'cancel' }
                    ]
                );
                return;
            }

            const res = await toggleFollowStore(storeId, storeName, activeUser.id);
            if (res?.updatedMap) {
                setFollowedStores(res.updatedMap);
            }
            if (res?.isSelfFollow) {
                Alert.alert('Notice', res.message || 'Ba za ka iya bin (follow) shagon kanka ba.');
                return;
            }
            showToast(res.isFollowed ? `Following ${storeName}` : `Unfollowed ${storeName}`);
        } catch (err) {
            console.log('toggleFollow error:', err);
        }
    };

    const fetchStoresAndProducts = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [realStores, categoriesRes] = await Promise.allSettled([
                StoreService.fetchStores(),
                supabase
                    .from('categories')
                    .select('id, name, slug, icon, is_active')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true })
            ]);

            const storesList = (realStores.status === 'fulfilled' && Array.isArray(realStores.value)) ? realStores.value : [];
            const realCategories = (categoriesRes.status === 'fulfilled' && categoriesRes.value?.data) ? categoriesRes.value.data : [];
            setCategories(realCategories);
            setStores(storesList);

            // Collect all real products from stores
            const allProds = [];
            storesList.forEach(st => {
                if (Array.isArray(st.products)) {
                    allProds.push(...st.products);
                }
            });
            setPopularProducts(allProds);
        } catch (err) {
            console.log('StoresPage Fetch Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchStoresAndProducts(true);
    };

    const handleContactWhatsApp = (store) => {
        const rawPhone = store.whatsapp || store.phone || '2348145853539';
        const msg = `Hello ${store.name || 'Merchant'}, I am contacting you directly from Abu Mafhal Marketplace regarding your verified store catalog.`;
        whatsappService.openWhatsApp(rawPhone, msg);
    };

    const handleOpenSocial = (platform, rawValue, storeName) => {
        if (!rawValue) return;
        const val = String(rawValue).trim();
        if (!val) return;

        let url = '';
        if (platform === 'whatsapp') {
            let phone = val.replace(/[^0-9]/g, '');
            if (phone.startsWith('0') && phone.length === 11) {
                phone = '234' + phone.slice(1);
            }
            if (phone.length >= 7) {
                const msg = encodeURIComponent(`Hello ${storeName || 'Merchant'}, I am contacting you from Abu Mafhal Marketplace.`);
                url = `https://wa.me/${phone}?text=${msg}`;
            }
        } else if (platform === 'instagram') {
            let handle = val.replace(/^@+/, '').trim();
            if (handle.startsWith('http://') || handle.startsWith('https://')) {
                url = handle;
            } else {
                handle = handle.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, '').replace(/\/$/, '');
                if (handle) url = `https://instagram.com/${handle}`;
            }
        } else if (platform === 'facebook') {
            let handle = val.trim();
            if (handle.startsWith('http://') || handle.startsWith('https://')) {
                url = handle;
            } else {
                handle = handle.replace(/^(?:https?:\/\/)?(?:www\.)?facebook\.com\//i, '').replace(/\/$/, '');
                if (handle) url = `https://facebook.com/${handle}`;
            }
        } else if (platform === 'twitter') {
            let handle = val.replace(/^@+/, '').trim();
            if (handle.startsWith('http://') || handle.startsWith('https://')) {
                url = handle;
            } else {
                handle = handle.replace(/^(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\//i, '').replace(/\/$/, '');
                if (handle) url = `https://x.com/${handle}`;
            }
        }

        if (url) {
            Linking.openURL(url).catch(err => {
                console.warn('[StoresPage] Could not open social link:', url, err);
                Alert.alert('Social Link', `Unable to open link: ${url}`);
            });
        }
    };

    const handleCallStore = (store) => {
        const rawPhone = store.phone || store.whatsapp || '08145853539';
        const phone = rawPhone.replace(/[^0-9]/g, '');
        Linking.openURL(`tel:+${phone}`).catch(() => {
            Alert.alert('Phone Number', `+${phone}`);
        });
    };

    const handleShareStore = async (store) => {
        try {
            await Share.share({
                message: `Check out ${store.name} on Abu Mafhal Marketplace! Verified products with express delivery: https://abumafhal.com/mobile#store-${store.id}`,
                title: store.name
            });
        } catch (_) {}
    };

    const handleAddToCartItem = (product) => {
        if (onAddToCart) {
            onAddToCart(product);
            showToast(`Added "${product.name}" to cart!`);
        }
    };

    // Filter stores & products by search query and subtabs
    const filteredStores = stores.filter(st => {
        const matchSearch = (st.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (st.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (st.tagline || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (st.about || st.bio || '').toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchSearch) return false;

        if (activeSubTab === 'recommended') return !!st.is_recommended || !!st.isRecommended;
        if (activeSubTab === 'top_rated') return Number(st.rating) >= 4.8;
        if (activeSubTab === 'official') return st.is_official || st.isOfficial;
        return true;
    });

    const recommendedStores = stores.filter(st => !!st.is_recommended || !!st.isRecommended);

    const filteredPopular = popularProducts.filter(p => {
        if (!searchQuery) return true;
        return p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));
    });

    const getProductImage = (item) => {
        if (item?.image_url) return item.image_url;
        if (Array.isArray(item?.images) && item.images.length > 0) return item.images[0];
        if (typeof item?.images === 'string') {
            try {
                const parsed = JSON.parse(item.images);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
            } catch (_) {}
            return item.images;
        }
        return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400&auto=format&fit=crop';
    };

    // Store Detail View Product Filter
    const storeProducts = selectedStore?.products || [];
    const storeFilteredProducts = storeProducts.filter(p => {
        const matchesQuery = !storeSearchQuery ||
            p.name.toLowerCase().includes(storeSearchQuery.toLowerCase()) ||
            (p.category && p.category.toLowerCase().includes(storeSearchQuery.toLowerCase()));

        const matchesCat = selectedStoreCategory === 'All' ||
            (p.category && p.category.toLowerCase() === selectedStoreCategory.toLowerCase());

        return matchesQuery && matchesCat;
    });

    const storeCategories = ['All', ...new Set(storeProducts.map(p => p.category).filter(Boolean))];

    return (
        <View style={s.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* ══════════════════════════════════════════════════
                1. TOP LUXURY MOBILE HEADER
            ══════════════════════════════════════════════════ */}
            <View style={s.header}>
                <View style={s.headerTop}>
                    <View style={s.brandGroup}>
                        <View style={s.logoFrame}>
                            <Image source={AM_LOGO} style={s.logo} resizeMode="contain" />
                        </View>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={s.brandTitle}>
                                    ABU <Text style={s.brandTitleAccent}>MAFHAL</Text>
                                </Text>
                                <View style={s.officialMallTinyPill}>
                                    <Text style={s.officialMallTinyTxt}>STORES</Text>
                                </View>
                            </View>
                            <Text style={s.brandSubtitle}>
                                Verified Merchants & Flagships
                            </Text>
                        </View>
                    </View>

                    <View style={s.actionRow}>
                        <TouchableOpacity
                            onPress={() => onGoToShop && onGoToShop('')}
                            style={s.shopPillBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="bag-handle" size={13} color={BRAND.sky} />
                            <Text style={s.shopPillTxt}>Shop</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onGoToNotifications} style={s.iconBtn}>
                            <Ionicons name="notifications-outline" size={22} color={BRAND.slateDark} />
                            <View style={s.notifBadge} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onGoToCart} style={s.iconBtn}>
                            <Ionicons name="cart-outline" size={23} color={BRAND.slateDark} />
                            {cartCount > 0 && (
                                <View style={s.cartBadge}>
                                    <Text style={s.cartBadgeTxt}>{cartCount > 99 ? '99+' : cartCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ════ SEARCH & VIEW TOGGLE CONTROLS ════ */}
                <View style={s.searchControlsRow}>
                    <View style={s.searchBar}>
                        <Ionicons name="search" size={16} color={BRAND.slate} style={{ marginRight: 8 }} />
                        <TextInput
                            placeholder="Search verified stores, items, brands..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={s.searchInput}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                                <Ionicons name="close-circle" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* View Mode Switcher (List vs 2-Col Grid) */}
                    <TouchableOpacity
                        onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                        style={s.viewModeBtn}
                        activeOpacity={0.75}
                    >
                        <Ionicons
                            name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
                            size={18}
                            color={BRAND.slateDark}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 140 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND.sky]} />
                }
            >
                {/* ════ TRUST & METRICS STRIP ════ */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.trustTickerScroll}
                >
                    <View style={s.trustTickerItem}>
                        <Ionicons name="shield-checkmark" size={13} color={BRAND.emerald} />
                        <Text style={s.trustTickerTxt}>100% Vetted Merchants</Text>
                    </View>
                    <View style={s.trustTickerItem}>
                        <Ionicons name="lock-closed" size={12} color={BRAND.goldDark} />
                        <Text style={s.trustTickerTxt}>Buyer Escrow Protection</Text>
                    </View>
                    <View style={s.trustTickerItem}>
                        <Ionicons name="logo-whatsapp" size={13} color="#10B981" />
                        <Text style={s.trustTickerTxt}>Direct WhatsApp Chat</Text>
                    </View>
                    <View style={s.trustTickerItem}>
                        <Ionicons name="rocket-outline" size={13} color={BRAND.sky} />
                        <Text style={s.trustTickerTxt}>Fast Express Dispatch</Text>
                    </View>
                </ScrollView>

                {/* ════ 2. "FEATURED BRANDS" STORY RINGS (Instagram / Shopee Style) ════ */}
                {stores.length > 0 && (
                    <View style={s.storiesWrapper}>
                        <View style={s.storiesSectionHeader}>
                            <Text style={s.storiesTitle}>FEATURED BRANDS</Text>
                            <Text style={s.storiesSub}>Tap to open storefront</Text>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={s.storiesScroll}
                        >
                            {stores.slice(0, 10).map((st) => {
                                const isOfficial = st.is_official || st.isOfficial;
                                const isRec = st.is_recommended || st.isRecommended;

                                return (
                                    <TouchableOpacity
                                        key={'story-' + st.id}
                                        activeOpacity={0.8}
                                        onPress={() => setSelectedStore(st)}
                                        style={s.storyItem}
                                    >
                                        <View style={[
                                            s.storyRing,
                                            isOfficial && s.storyRingOfficial,
                                            isRec && s.storyRingRec
                                        ]}>
                                            <View style={s.storyAvatarInner}>
                                                {st.logo ? (
                                                    <Image source={{ uri: st.logo }} style={s.storyImg} />
                                                ) : isOfficial ? (
                                                    <Image source={AM_LOGO} style={s.storyImg} resizeMode="contain" />
                                                ) : (
                                                    <View style={[s.storyImg, { backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }]}>
                                                        <Ionicons name="storefront" size={22} color={BRAND.sky} />
                                                    </View>
                                                )}
                                            </View>

                                            {st.isVerified && (
                                                <View style={s.storyVerifiedBadge}>
                                                    <Ionicons name="checkmark-sharp" size={8} color="#FFFFFF" />
                                                </View>
                                            )}
                                        </View>
                                        <Text numberOfLines={1} style={s.storyNameTxt}>
                                            {st.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* ════ 3. SUBTABS / FILTER PILLS ROW ════ */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.subTabsScroll}
                >
                    {[
                        { key: 'all_stores', label: 'All Stores', icon: 'storefront-outline' },
                        { key: 'recommended', label: '⭐ Recommended', icon: 'star' },
                        { key: 'official', label: 'Official Mall', icon: 'ribbon-outline' },
                        { key: 'top_rated', label: 'Top Rated (4.8+)', icon: 'trending-up-outline' },
                        { key: 'popular_products', label: 'Popular Products', icon: 'flame-outline' },
                        { key: 'categories', label: 'Departments', icon: 'grid-outline' },
                    ].map(tab => {
                        const active = activeSubTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setActiveSubTab(tab.key)}
                                style={[s.subTabBtn, active && s.subTabBtnActive]}
                                activeOpacity={0.75}
                            >
                                <Ionicons
                                    name={tab.icon}
                                    size={14}
                                    color={active ? '#FFFFFF' : BRAND.slate}
                                />
                                <Text style={[s.subTabTxt, active && s.subTabTxtActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Loading Indicator */}
                {loading && (
                    <View style={{ paddingVertical: 45, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={BRAND.sky} />
                        <Text style={{ color: BRAND.slate, fontSize: 12, marginTop: 12, fontWeight: '700' }}>
                            Loading live stores & authentic catalogs...
                        </Text>
                    </View>
                )}

                {/* ════ 4. RECOMMENDED SPOTLIGHT CAROUSEL (If on All Stores) ════ */}
                {(!loading && recommendedStores.length > 0 && activeSubTab === 'all_stores' && !searchQuery) && (
                    <View style={{ marginTop: 10 }}>
                        <View style={s.sectionHead}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 6, height: 16, backgroundColor: BRAND.gold, borderRadius: 3 }} />
                                <Text style={s.sectionTitle}>⭐ Recommended Spotlight</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setActiveSubTab('recommended')}
                                style={s.seeAllRow}
                            >
                                <Text style={s.seeAllTxt}>View All ({recommendedStores.length})</Text>
                                <Ionicons name="chevron-forward" size={13} color={BRAND.sky} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 6 }}
                        >
                            {recommendedStores.map(recStore => {
                                const isFollowed = !!followedStores[recStore.id];
                                return (
                                    <TouchableOpacity
                                        key={'rec-' + recStore.id}
                                        activeOpacity={0.92}
                                        onPress={() => setSelectedStore(recStore)}
                                        style={s.spotlightCard}
                                    >
                                        <View style={s.spotlightBannerBox}>
                                            <Image
                                                source={{ uri: recStore.cover_image || recStore.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=600&auto=format&fit=crop' }}
                                                style={s.spotlightBannerImg}
                                            />
                                            <View style={s.spotlightBannerOverlay} />
                                            <View style={s.spotlightBadge}>
                                                <Ionicons name="star" size={10} color="#FFFFFF" />
                                                <Text style={s.spotlightBadgeTxt}>TOP PICK</Text>
                                            </View>
                                        </View>

                                        <View style={s.spotlightBody}>
                                            <View style={s.spotlightAvatarOverlap}>
                                                {recStore.logo ? (
                                                    <Image source={{ uri: recStore.logo }} style={s.spotlightAvatar} />
                                                ) : recStore.is_official || recStore.isOfficial ? (
                                                    <Image source={AM_LOGO} style={s.spotlightAvatar} resizeMode="contain" />
                                                ) : (
                                                    <View style={[s.spotlightAvatar, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                                                        <Ionicons name="storefront" size={20} color={BRAND.navy} />
                                                    </View>
                                                )}
                                                {recStore.isVerified && (
                                                    <View style={s.spotlightVerifiedBadge}>
                                                        <Ionicons name="checkmark-sharp" size={9} color="#FFFFFF" />
                                                    </View>
                                                )}
                                            </View>

                                            <Text style={s.spotlightName} numberOfLines={1}>
                                                {recStore.name}
                                            </Text>
                                            <Text style={s.spotlightCategory} numberOfLines={1}>
                                                {recStore.category || 'General Store'}
                                            </Text>

                                            <View style={s.spotlightFooter}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Ionicons name="star" size={12} color="#F59E0B" />
                                                    <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND.slateDark }}>
                                                        {recStore.rating || 5.0}
                                                    </Text>
                                                    <Text style={{ fontSize: 10.5, color: BRAND.slate, fontWeight: '600' }}>
                                                        ({recStore.productsCount || 0} items)
                                                    </Text>
                                                </View>

                                                {isOwnStore(recStore) ? (
                                                    <View style={s.spotlightOwnStoreBadge}>
                                                        <Ionicons name="person" size={10} color="#FCD34D" />
                                                        <Text style={s.spotlightOwnStoreTxt}>Your Store</Text>
                                                    </View>
                                                ) : (
                                                    <TouchableOpacity
                                                        onPress={() => toggleFollow(recStore.id, recStore.name, recStore)}
                                                        style={[s.spotlightFollowBtn, isFollowed && s.spotlightFollowBtnActive]}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Text style={[s.spotlightFollowTxt, isFollowed && s.spotlightFollowTxtActive]}>
                                                            {isFollowed ? 'Following' : '+ Follow'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* ════ 5. STORES SECTION: COMPACT LUXURY VENDOR CARDS ════ */}
                {(!loading && activeSubTab !== 'popular_products') && (
                    <View style={{ marginTop: 14 }}>
                        <View style={s.sectionHead}>
                            <View>
                                <Text style={s.sectionTitle}>
                                    {activeSubTab === 'recommended' ? '⭐ Recommended Merchants' : activeSubTab === 'top_rated' ? 'Highest Rated Stores' : activeSubTab === 'official' ? 'Official Flagship Mall' : 'Verified Stores Directory'}
                                </Text>
                                <Text style={s.sectionSub}>
                                    {filteredStores.length} authentic verified merchant{filteredStores.length !== 1 ? 's' : ''}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => onGoToShop && onGoToShop('')}
                                style={s.seeAllRow}
                            >
                                <Text style={s.seeAllTxt}>All Products</Text>
                                <Ionicons name="arrow-forward" size={12} color={BRAND.sky} />
                            </TouchableOpacity>
                        </View>

                        {/* Store Cards: Dual View Mode (Rich Card vs 2-Col Grid) */}
                        {filteredStores.length === 0 ? (
                            <View style={s.emptyBox}>
                                <Ionicons name="storefront-outline" size={42} color="#94A3B8" />
                                <Text style={s.emptyTxt}>No stores found matching "{searchQuery}"</Text>
                                <TouchableOpacity onPress={() => { setSearchQuery(''); setActiveSubTab('all_stores'); }} style={s.emptyBtn}>
                                    <Text style={s.emptyBtnTxt}>Reset Filters</Text>
                                </TouchableOpacity>
                            </View>
                        ) : viewMode === 'list' ? (
                            // ─── RICH COMPACT MOBILE-FIRST VENDOR CARDS ───
                            <View style={s.storesListContainer}>
                                {filteredStores.map(store => {
                                    const isFollowed = !!followedStores[store.id];
                                    const currentFollowers = (store.followersCount !== undefined ? store.followersCount : (store.baseFollowers || 0)) + (isFollowed ? 1 : 0);
                                    const previewProds = (store.products && Array.isArray(store.products)) ? store.products.slice(0, 3) : [];

                                    return (
                                        <View key={store.id} style={s.modernCard}>
                                            {/* Micro Cover Banner (68px) */}
                                            <TouchableOpacity
                                                activeOpacity={0.92}
                                                onPress={() => setSelectedStore(store)}
                                                style={s.cardCoverBox}
                                            >
                                                <Image
                                                    source={{ uri: store.cover_image || store.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=700&auto=format&fit=crop' }}
                                                    style={s.cardCoverImg}
                                                    resizeMode="cover"
                                                />
                                                <View style={s.cardCoverOverlay} />

                                                {/* Left Badge: Official or Recommended or Verified */}
                                                <View style={s.cardTopBadgesLeft}>
                                                    {(store.is_official || store.isOfficial) ? (
                                                        <View style={s.badgeOfficial}>
                                                            <Ionicons name="shield-checkmark" size={10} color="#FFFFFF" />
                                                            <Text style={s.badgeOfficialTxt}>OFFICIAL MALL</Text>
                                                        </View>
                                                    ) : (store.is_recommended || store.isRecommended) ? (
                                                        <View style={s.badgeRecommended}>
                                                            <Ionicons name="star" size={10} color="#FFFFFF" />
                                                            <Text style={s.badgeRecommendedTxt}>RECOMMENDED</Text>
                                                        </View>
                                                    ) : (
                                                        <View style={s.badgeVerified}>
                                                            <Ionicons name="checkmark-circle" size={10} color="#10B981" />
                                                            <Text style={s.badgeVerifiedTxt}>VERIFIED</Text>
                                                        </View>
                                                    )}
                                                </View>

                                                {/* Right: Quick Follow Toggle or Own Store Badge */}
                                                {isOwnStore(store) ? (
                                                    <View style={s.ownStoreBadgeTop}>
                                                        <Ionicons name="person" size={10} color="#FCD34D" />
                                                        <Text style={s.ownStoreBadgeTxt}>Your Store</Text>
                                                    </View>
                                                ) : (
                                                    <TouchableOpacity
                                                        onPress={() => toggleFollow(store.id, store.name, store)}
                                                        style={[s.quickFollowBtn, isFollowed && s.quickFollowBtnActive]}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Ionicons
                                                            name={isFollowed ? "heart" : "heart-outline"}
                                                            size={14}
                                                            color={isFollowed ? "#EF4444" : "#FFFFFF"}
                                                        />
                                                    </TouchableOpacity>
                                                )}
                                            </TouchableOpacity>

                                            {/* Store Identity & Meta Row */}
                                            <View style={s.cardBody}>
                                                <View style={s.cardIdentityRow}>
                                                    {/* Overlapping Avatar */}
                                                    <TouchableOpacity
                                                        activeOpacity={0.9}
                                                        onPress={() => setSelectedStore(store)}
                                                        style={s.cardAvatarWrap}
                                                    >
                                                        {store.logo ? (
                                                            <Image source={{ uri: store.logo }} style={s.cardAvatar} />
                                                        ) : (store.is_official || store.isOfficial) ? (
                                                            <Image source={AM_LOGO} style={s.cardAvatar} resizeMode="contain" />
                                                        ) : (
                                                            <View style={[s.cardAvatar, { backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }]}>
                                                                <Ionicons name="storefront" size={24} color={BRAND.sky} />
                                                            </View>
                                                        )}
                                                        {store.isVerified && (
                                                            <View style={s.cardVerifiedIcon}>
                                                                <Ionicons name="checkmark-sharp" size={10} color="#FFFFFF" />
                                                            </View>
                                                        )}
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        activeOpacity={0.9}
                                                        onPress={() => setSelectedStore(store)}
                                                        style={s.cardTitleCol}
                                                    >
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                            <Text numberOfLines={1} style={s.cardStoreName}>
                                                                {store.name}
                                                            </Text>
                                                            <Ionicons name="checkmark-circle" size={14} color={BRAND.sky} />
                                                        </View>

                                                        <Text numberOfLines={1} style={s.cardCategoryTxt}>
                                                            {store.category || 'Verified Marketplace Store'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Micro-Stats Inline Strip */}
                                                <View style={s.cardStatsStrip}>
                                                    <View style={s.cardStatItem}>
                                                        <Ionicons name="star" size={12} color="#F59E0B" />
                                                        <Text style={s.cardStatBold}>{store.rating || 5.0}</Text>
                                                        <Text style={s.cardStatDim}>({store.reviews || 0})</Text>
                                                    </View>
                                                    <Text style={s.cardStatDot}>•</Text>
                                                    <View style={s.cardStatItem}>
                                                        <Ionicons name="cube-outline" size={12} color={BRAND.slate} />
                                                        <Text style={s.cardStatBold}>{store.productsCount || 0}</Text>
                                                        <Text style={s.cardStatDim}>Products</Text>
                                                    </View>
                                                    <Text style={s.cardStatDot}>•</Text>
                                                    <View style={s.cardStatItem}>
                                                        <Ionicons name="people-outline" size={12} color={BRAND.slate} />
                                                        <Text style={s.cardStatBold}>{currentFollowers}</Text>
                                                        <Text style={s.cardStatDim}>Followers</Text>
                                                    </View>
                                                </View>

                                                {/* ─── MINI 3-PRODUCT PREVIEW STRIP (Shopify / TikTok Shop style) ─── */}
                                                {previewProds.length > 0 && (
                                                    <View style={s.miniPreviewStrip}>
                                                        {previewProds.map((prod, pIdx) => (
                                                            <TouchableOpacity
                                                                key={'p-prev-' + prod.id + '-' + pIdx}
                                                                activeOpacity={0.88}
                                                                onPress={() => onProductClick && onProductClick({ ...prod, vendor: prod.vendor || store })}
                                                                style={s.miniPreviewItem}
                                                            >
                                                                <Image
                                                                    source={{ uri: getProductImage(prod) }}
                                                                    style={s.miniPreviewImg}
                                                                />
                                                                <View style={s.miniPreviewPriceTag}>
                                                                    <Text style={s.miniPreviewPriceTxt} numberOfLines={1}>
                                                                        {fmtPrice(prod.price)}
                                                                    </Text>
                                                                </View>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                )}

                                                {/* Card Action Buttons: WhatsApp & Visit Store */}
                                                <View style={s.cardActionRow}>
                                                    <TouchableOpacity
                                                        onPress={() => handleContactWhatsApp(store)}
                                                        style={s.actionWhatsAppBtn}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Ionicons name="logo-whatsapp" size={15} color="#10B981" />
                                                        <Text style={s.actionWhatsAppTxt}>WhatsApp</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        onPress={() => handleCallStore(store)}
                                                        style={s.actionCallBtn}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Ionicons name="call-outline" size={15} color={BRAND.slateDark} />
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        onPress={() => setSelectedStore(store)}
                                                        style={s.actionVisitBtn}
                                                        activeOpacity={0.85}
                                                    >
                                                        <Text style={s.actionVisitTxt}>Visit Store</Text>
                                                        <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            // ─── 2-COLUMN COMPACT MOBILE GRID ───
                            <View style={s.storesGridContainer}>
                                {filteredStores.map(store => {
                                    return (
                                        <TouchableOpacity
                                            key={'grid-' + store.id}
                                            activeOpacity={0.9}
                                            onPress={() => setSelectedStore(store)}
                                            style={s.gridStoreCard}
                                        >
                                            <View style={s.gridBannerBox}>
                                                <Image
                                                    source={{ uri: store.cover_image || store.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=500&auto=format&fit=crop' }}
                                                    style={s.gridBannerImg}
                                                />
                                                <View style={s.gridBannerOverlay} />
                                                {(store.is_official || store.isOfficial) && (
                                                    <View style={s.gridOfficialBadge}>
                                                        <Text style={s.gridOfficialTxt}>OFFICIAL</Text>
                                                    </View>
                                                )}
                                            </View>

                                            <View style={s.gridBody}>
                                                <View style={s.gridAvatarWrap}>
                                                    {store.logo ? (
                                                        <Image source={{ uri: store.logo }} style={s.gridAvatar} />
                                                    ) : (store.is_official || store.isOfficial) ? (
                                                        <Image source={AM_LOGO} style={s.gridAvatar} resizeMode="contain" />
                                                    ) : (
                                                        <View style={[s.gridAvatar, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                                                            <Ionicons name="storefront" size={18} color={BRAND.navy} />
                                                        </View>
                                                    )}
                                                    {store.isVerified && (
                                                        <View style={s.gridVerifiedBadge}>
                                                            <Ionicons name="checkmark-sharp" size={8} color="#FFFFFF" />
                                                        </View>
                                                    )}
                                                </View>

                                                <Text style={s.gridStoreName} numberOfLines={1}>
                                                    {store.name}
                                                </Text>
                                                <Text style={s.gridCategory} numberOfLines={1}>
                                                    {store.category || 'Store'}
                                                </Text>

                                                <View style={s.gridMetaRow}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                        <Ionicons name="star" size={11} color="#F59E0B" />
                                                        <Text style={{ fontSize: 10.5, fontWeight: '800', color: BRAND.slateDark }}>{store.rating || 5.0}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 10, color: BRAND.slate, fontWeight: '600' }}>
                                                        {store.productsCount || 0} items
                                                    </Text>
                                                </View>

                                                <View style={s.gridActionRow}>
                                                    <View style={s.gridVisitBtn}>
                                                        <Text style={s.gridVisitTxt}>View Store</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                )}

                {/* ════ 6. POPULAR PRODUCTS IN STORE SECTION ════ */}
                {!loading && (
                    <View style={{ marginTop: 22 }}>
                        <View style={s.sectionHead}>
                            <View>
                                <Text style={s.sectionTitle}>Trending Store Catalog</Text>
                                <Text style={s.sectionSub}>Live products from verified merchants</Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => onGoToShop && onGoToShop('')}
                                style={s.seeAllRow}
                            >
                                <Text style={s.seeAllTxt}>Shop All</Text>
                                <Ionicons name="chevron-forward" size={13} color={BRAND.sky} />
                            </TouchableOpacity>
                        </View>

                        {filteredPopular.length === 0 ? (
                            <View style={s.emptyBox}>
                                <Ionicons name="bag-remove-outline" size={36} color="#94A3B8" />
                                <Text style={s.emptyTxt}>No products match your search</Text>
                            </View>
                        ) : (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={s.productsScroll}
                            >
                                {filteredPopular.map(prod => {
                                    const hasDiscount = Number(prod.compare_at_price) > Number(prod.price);
                                    const discountPercent = hasDiscount
                                        ? Math.round(((Number(prod.compare_at_price) - Number(prod.price)) / Number(prod.compare_at_price)) * 100)
                                        : null;

                                    return (
                                        <TouchableOpacity
                                            key={prod.id}
                                            activeOpacity={0.88}
                                            onPress={() => onProductClick && onProductClick(prod)}
                                            style={s.prodCard}
                                        >
                                            <View style={s.prodImgBox}>
                                                <Image
                                                    source={{ uri: getProductImage(prod) }}
                                                    style={s.prodImg}
                                                    resizeMode="cover"
                                                />
                                                {discountPercent && (
                                                    <View style={s.discountBadge}>
                                                        <Text style={s.discountBadgeTxt}>-{discountPercent}%</Text>
                                                    </View>
                                                )}
                                            </View>

                                            <View style={s.prodInfo}>
                                                <Text style={s.prodCategory} numberOfLines={1}>
                                                    {prod.category || 'General'}
                                                </Text>
                                                <Text style={s.prodName} numberOfLines={2}>
                                                    {prod.name}
                                                </Text>

                                                <View style={s.prodPriceRow}>
                                                    <Text style={s.prodPrice}>{fmtPrice(prod.price)}</Text>
                                                    {hasDiscount && (
                                                        <Text style={s.prodOldPrice}>{fmtPrice(prod.compare_at_price)}</Text>
                                                    )}
                                                </View>

                                                <TouchableOpacity
                                                    style={s.quickCartBtn}
                                                    activeOpacity={0.8}
                                                    onPress={() => handleAddToCartItem(prod)}
                                                >
                                                    <Ionicons name="cart" size={13} color="white" />
                                                    <Text style={s.quickCartBtnTxt}>+ Cart</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                )}

                {/* ════ 7. BECOME A VENDOR CALLOUT ════ */}
                <View style={s.vendorBannerWrapper}>
                    <View style={s.vendorBannerCard}>
                        <View style={s.vendorBannerBadge}>
                            <Ionicons name="sparkles" size={12} color="#F59E0B" />
                            <Text style={s.vendorBannerBadgeTxt}>MERCHANT EXPANSION</Text>
                        </View>
                        <Text style={s.vendorBannerTitle}>Open Your Store on Abu Mafhal</Text>
                        <Text style={s.vendorBannerSub}>
                            Register your business today. Reach buyers across Nigeria with zero listing friction and verified seller badges.
                        </Text>

                        <TouchableOpacity
                            style={s.vendorBannerBtn}
                            activeOpacity={0.85}
                            onPress={() => onNavigate ? onNavigate('VendorRegister') : Alert.alert('Register', 'Please visit Account > Become a Vendor to register your business.')}
                        >
                            <Text style={s.vendorBannerBtnTxt}>Start Selling Now</Text>
                            <Ionicons name="arrow-forward" size={14} color="#0F172A" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ════ 8. MARKETPLACE DEPARTMENTS ════ */}
                {categories.length > 0 && (
                    <View style={{ marginTop: 22, paddingHorizontal: 16 }}>
                        <Text style={s.sectionTitle}>Marketplace Departments</Text>
                        <Text style={s.sectionSub}>Shop items organized by verified categories</Text>

                        <View style={[s.catPillGrid, { marginTop: 12 }]}>
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={s.catPill}
                                    activeOpacity={0.8}
                                    onPress={() => onGoToShop && onGoToShop(cat.name)}
                                >
                                    <Ionicons name="pricetag-outline" size={13} color={BRAND.sky} />
                                    <Text style={s.catPillTxt}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* ══════════════════════════════════════════════════
                9. DEDICATED STOREFRONT MODAL (Luxury Store Experience)
            ══════════════════════════════════════════════════ */}
            <Modal
                visible={!!selectedStore}
                animationType="slide"
                onRequestClose={() => setSelectedStore(null)}
            >
                {selectedStore && (
                    <View style={s.modalContainer}>
                        <StatusBar barStyle="light-content" backgroundColor="#0A192F" />

                        {/* Top Sticky Header */}
                        <View style={s.modalHeader}>
                            <TouchableOpacity
                                onPress={() => setSelectedStore(null)}
                                style={s.modalBackBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="arrow-back" size={22} color="white" />
                                <Text style={s.modalBackTxt}>Stores</Text>
                            </TouchableOpacity>

                            <Text numberOfLines={1} style={s.modalHeaderTitle}>
                                {selectedStore.name}
                            </Text>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={() => handleShareStore(selectedStore)}
                                    style={s.modalIconBtn}
                                >
                                    <Ionicons name="share-social-outline" size={20} color="white" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => { setSelectedStore(null); onGoToCart && onGoToCart(); }}
                                    style={s.modalCartBtn}
                                >
                                    <Ionicons name="cart-outline" size={22} color="white" />
                                    {cartCount > 0 && (
                                        <View style={s.modalCartBadge}>
                                            <Text style={s.modalCartBadgeTxt}>{cartCount}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
                            {/* Store Hero Banner */}
                            <View style={s.storeHeroBox}>
                                <Image
                                    source={{ uri: selectedStore.cover_image || selectedStore.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=900&auto=format&fit=crop' }}
                                    style={s.storeHeroBanner}
                                    resizeMode="cover"
                                />
                                <View style={s.storeHeroOverlay} />

                                <View style={s.storeHeroProfileRow}>
                                    <View style={s.storeHeroAvatarWrap}>
                                        {selectedStore.logo ? (
                                            <Image source={{ uri: selectedStore.logo }} style={s.storeHeroAvatar} />
                                        ) : (selectedStore.is_official || selectedStore.isOfficial) ? (
                                            <Image source={AM_LOGO} style={s.storeHeroAvatar} resizeMode="contain" />
                                        ) : (
                                            <View style={[s.storeHeroAvatar, { backgroundColor: BRAND.sky, alignItems: 'center', justifyContent: 'center' }]}>
                                                <Ionicons name="storefront" size={32} color="white" />
                                            </View>
                                        )}
                                        {selectedStore.isVerified && (
                                            <View style={s.verifiedIconBadgeLarge}>
                                                <Ionicons name="checkmark-sharp" size={13} color="white" />
                                            </View>
                                        )}
                                    </View>

                                    <View style={s.storeHeroNameCol}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <Text style={s.storeHeroName} numberOfLines={1}>{selectedStore.name}</Text>
                                            {(selectedStore.is_official || selectedStore.isOfficial) && (
                                                <View style={s.officialPill}>
                                                    <Text style={s.officialPillTxt}>OFFICIAL</Text>
                                                </View>
                                            )}
                                            {(selectedStore.is_recommended || selectedStore.isRecommended) && (
                                                <View style={{ backgroundColor: BRAND.gold, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                                    <Ionicons name="star" size={10} color="#FFFFFF" />
                                                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>RECOMMENDED</Text>
                                                </View>
                                            )}
                                        </View>
                                        {selectedStore.tagline ? (
                                            <Text style={{ fontSize: 11.5, color: '#E2E8F0', fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                                                {selectedStore.tagline}
                                            </Text>
                                        ) : null}
                                        <Text style={s.storeHeroCategory}>{selectedStore.category || 'Verified Marketplace Merchant'}</Text>
                                        <Text style={s.storeHeroLocation}>
                                            <Ionicons name="location-outline" size={11} color="#94A3B8" /> {selectedStore.address || 'Nigeria'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Store Stats Strip */}
                            <View style={s.storeStatsCard}>
                                <View style={s.statBox}>
                                    <Text style={s.statVal}>{selectedStore.productsCount || 0}</Text>
                                    <Text style={s.statLbl}>Products</Text>
                                </View>
                                <View style={s.statDivider} />
                                <View style={s.statBox}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                        <Ionicons name="star" size={14} color="#F59E0B" />
                                        <Text style={s.statVal}>{selectedStore.rating || 5.0}</Text>
                                    </View>
                                    <Text style={s.statLbl}>{selectedStore.reviews || 0} Reviews</Text>
                                </View>
                                <View style={s.statDivider} />
                                <View style={s.statBox}>
                                    <Text style={s.statVal}>
                                        {(selectedStore.followersCount !== undefined ? selectedStore.followersCount : (selectedStore.baseFollowers || 0)) + (followedStores[selectedStore.id] ? 1 : 0)}
                                    </Text>
                                    <Text style={s.statLbl}>Followers</Text>
                                </View>
                            </View>

                            {/* Action Buttons Strip */}
                            <View style={s.storeDetailActionRow}>
                                {isOwnStore(selectedStore) ? (
                                    <View style={s.storeDetailBtnOwnStore}>
                                        <Ionicons name="person-circle" size={17} color="#FCD34D" />
                                        <Text style={s.storeDetailBtnOwnStoreTxt}>Your Store</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        onPress={() => toggleFollow(selectedStore.id, selectedStore.name, selectedStore)}
                                        style={[s.storeDetailBtnFollow, followedStores[selectedStore.id] && s.storeDetailBtnFollowing]}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons
                                            name={followedStores[selectedStore.id] ? "checkmark-circle" : "add"}
                                            size={16}
                                            color={followedStores[selectedStore.id] ? BRAND.sky : "white"}
                                        />
                                        <Text style={[s.storeDetailBtnFollowTxt, followedStores[selectedStore.id] && s.storeDetailBtnFollowingTxt]}>
                                            {followedStores[selectedStore.id] ? 'Following' : 'Follow Store'}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    onPress={() => handleContactWhatsApp(selectedStore)}
                                    style={s.storeDetailBtnWhatsApp}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="logo-whatsapp" size={16} color="white" />
                                    <Text style={s.storeDetailBtnWhatsAppTxt}>WhatsApp</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleCallStore(selectedStore)}
                                    style={s.storeDetailBtnCall}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="call" size={16} color={BRAND.navy} />
                                </TouchableOpacity>

                                {selectedStore.email ? (
                                    <TouchableOpacity
                                        onPress={() => Linking.openURL(`mailto:${selectedStore.email}`)}
                                        style={s.storeDetailBtnCall}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="mail" size={16} color={BRAND.navy} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            {/* Store Policies & Operating Hours */}
                            <View style={{ paddingHorizontal: 16, marginTop: 12, gap: 8 }}>
                                {selectedStore.working_hours ? (
                                    <View style={s.policyCard}>
                                        <View style={s.policyIconBox}>
                                            <Ionicons name="time-outline" size={15} color={BRAND.navy} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.policyLbl}>HOURS OF OPERATION</Text>
                                            <Text style={s.policyVal}>{selectedStore.working_hours}</Text>
                                        </View>
                                    </View>
                                ) : null}

                                {selectedStore.policy ? (
                                    <View style={[s.policyCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                                        <View style={[s.policyIconBox, { backgroundColor: 'rgba(217, 167, 58, 0.2)' }]}>
                                            <Ionicons name="shield-checkmark" size={15} color="#B45309" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[s.policyLbl, { color: '#92400E' }]}>BUYER WARRANTY & RETURNS</Text>
                                            <Text style={[s.policyVal, { color: '#78350F' }]}>{selectedStore.policy}</Text>
                                        </View>
                                    </View>
                                ) : null}

                                {(selectedStore.whatsapp || selectedStore.instagram || selectedStore.facebook || selectedStore.twitter) ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                                        {selectedStore.whatsapp ? (
                                            <TouchableOpacity
                                                activeOpacity={0.75}
                                                onPress={() => handleOpenSocial('whatsapp', selectedStore.whatsapp, selectedStore.name)}
                                                style={s.socialIconBtn}
                                            >
                                                <Ionicons name="logo-whatsapp" size={19} color="#16A34A" />
                                            </TouchableOpacity>
                                        ) : null}
                                        {selectedStore.instagram ? (
                                            <TouchableOpacity
                                                activeOpacity={0.75}
                                                onPress={() => handleOpenSocial('instagram', selectedStore.instagram, selectedStore.name)}
                                                style={[s.socialIconBtn, { backgroundColor: '#FDF2F8', borderColor: '#FBCFE8' }]}
                                            >
                                                <Ionicons name="logo-instagram" size={19} color="#DB2777" />
                                            </TouchableOpacity>
                                        ) : null}
                                        {selectedStore.facebook ? (
                                            <TouchableOpacity
                                                activeOpacity={0.75}
                                                onPress={() => handleOpenSocial('facebook', selectedStore.facebook, selectedStore.name)}
                                                style={[s.socialIconBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                                            >
                                                <Ionicons name="logo-facebook" size={19} color="#2563EB" />
                                            </TouchableOpacity>
                                        ) : null}
                                        {selectedStore.twitter ? (
                                            <TouchableOpacity
                                                activeOpacity={0.75}
                                                onPress={() => handleOpenSocial('twitter', selectedStore.twitter, selectedStore.name)}
                                                style={[s.socialIconBtn, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
                                            >
                                                <Ionicons name="logo-twitter" size={18} color="#0F172A" />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                ) : null}
                            </View>

                            {/* Store Bio */}
                            <View style={s.storeBioCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <Ionicons name="information-circle-outline" size={16} color={BRAND.sky} />
                                    <Text style={s.storeBioTitle}>About This Merchant</Text>
                                </View>
                                <Text style={s.storeBioTxt}>{selectedStore.about || selectedStore.bio || 'Verified merchant on Abu Mafhal Marketplace.'}</Text>
                            </View>

                            {/* Store Catalog Section */}
                            <View style={s.storeCatalogHeader}>
                                <Text style={s.storeCatalogTitle}>Store Catalog ({storeFilteredProducts.length})</Text>
                                <Text style={s.storeCatalogSub}>Authentic products sold directly by {selectedStore.name}</Text>
                            </View>

                            {/* In-Store Search Box */}
                            <View style={s.storeSearchBox}>
                                <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                                <TextInput
                                    placeholder={`Search in ${selectedStore.name}...`}
                                    placeholderTextColor="#94A3B8"
                                    value={storeSearchQuery}
                                    onChangeText={setStoreSearchQuery}
                                    style={s.storeSearchInput}
                                />
                                {storeSearchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setStoreSearchQuery('')}>
                                        <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Store Category Pills */}
                            {storeCategories.length > 1 && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={s.storeCategoryScroll}
                                >
                                    {storeCategories.map(cat => {
                                        const active = selectedStoreCategory === cat;
                                        return (
                                            <TouchableOpacity
                                                key={cat}
                                                onPress={() => setSelectedStoreCategory(cat)}
                                                style={[s.storeCatBtn, active && s.storeCatBtnActive]}
                                            >
                                                <Text style={[s.storeCatTxt, active && s.storeCatTxtActive]}>
                                                    {cat}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            )}

                            {/* Store Products 2-Column Grid */}
                            <View style={s.storeGridContainer}>
                                {storeFilteredProducts.length === 0 ? (
                                    <View style={s.storeEmptyBox}>
                                        <Ionicons name="file-tray-outline" size={40} color="#94A3B8" />
                                        <Text style={s.storeEmptyTitle}>No Products Found</Text>
                                        <Text style={s.storeEmptySub}>No items match your search in this store catalog.</Text>
                                    </View>
                                ) : (
                                    storeFilteredProducts.map(item => {
                                        const hasDiscount = Number(item.compare_at_price) > Number(item.price);
                                        const discountPercent = hasDiscount
                                            ? Math.round(((Number(item.compare_at_price) - Number(item.price)) / Number(item.compare_at_price)) * 100)
                                            : null;

                                        return (
                                            <TouchableOpacity
                                                key={'store-prod-' + item.id}
                                                activeOpacity={0.88}
                                                onPress={() => {
                                                    const enriched = {
                                                        ...item,
                                                        vendor_id: item.vendor_id || selectedStore.userId || selectedStore.id,
                                                        store_id: item.store_id || selectedStore.id,
                                                        vendor: item.vendor || {
                                                            id: selectedStore.id,
                                                            userId: selectedStore.userId,
                                                            name: selectedStore.name,
                                                            business_name: selectedStore.name,
                                                            role: selectedStore.is_official ? 'admin' : 'vendor',
                                                            isOfficial: !!selectedStore.is_official,
                                                            is_official: !!selectedStore.is_official,
                                                            avatar: selectedStore.logo,
                                                            logo: selectedStore.logo,
                                                            phone: selectedStore.phone,
                                                            whatsapp: selectedStore.whatsapp,
                                                            tagline: selectedStore.tagline,
                                                            about: selectedStore.about
                                                        }
                                                    };
                                                    setSelectedStore(null);
                                                    onProductClick && onProductClick(enriched);
                                                }}
                                                style={s.storeGridCard}
                                            >
                                                <View style={s.storeGridImgBox}>
                                                    <Image
                                                        source={{ uri: getProductImage(item) }}
                                                        style={s.storeGridImg}
                                                        resizeMode="cover"
                                                    />
                                                    {discountPercent && (
                                                        <View style={s.discountBadge}>
                                                            <Text style={s.discountBadgeTxt}>-{discountPercent}%</Text>
                                                        </View>
                                                    )}
                                                </View>

                                                <View style={s.storeGridInfo}>
                                                    <Text style={s.prodCategory} numberOfLines={1}>
                                                        {item.category || 'Catalog'}
                                                    </Text>
                                                    <Text style={s.storeGridName} numberOfLines={2}>
                                                        {item.name}
                                                    </Text>
                                                    <View style={s.prodPriceRow}>
                                                        <Text style={s.prodPrice}>{fmtPrice(item.price)}</Text>
                                                        {hasDiscount && (
                                                            <Text style={s.prodOldPrice}>{fmtPrice(item.compare_at_price)}</Text>
                                                        )}
                                                    </View>

                                                    <TouchableOpacity
                                                        style={s.quickCartBtn}
                                                        activeOpacity={0.8}
                                                        onPress={() => handleAddToCartItem(item)}
                                                    >
                                                        <Ionicons name="cart" size={13} color="white" />
                                                        <Text style={s.quickCartBtnTxt}>+ Cart</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </View>
                        </ScrollView>
                    </View>
                )}
            </Modal>

            {/* ════ FLOATING TOAST NOTIFICATION ════ */}
            {toastMessage.length > 0 && (
                <Animated.View style={[s.toastContainer, { opacity: toastAnim }]}>
                    <Ionicons name="checkmark-circle" size={18} color={BRAND.emerald} />
                    <Text style={s.toastTxt}>{toastMessage}</Text>
                </Animated.View>
            )}
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
        paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 20) + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        zIndex: 10
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10
    },
    brandGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9
    },
    logoFrame: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#0A192F',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: BRAND.gold,
        overflow: 'hidden'
    },
    logo: {
        width: 26,
        height: 26
    },
    brandTitle: {
        fontSize: 14.5,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.3
    },
    brandTitleAccent: {
        color: BRAND.gold
    },
    officialMallTinyPill: {
        backgroundColor: '#0A192F',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5
    },
    officialMallTinyTxt: {
        color: BRAND.gold,
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    brandSubtitle: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '600'
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    shopPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#BAE6FD'
    },
    shopPillTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: BRAND.sky
    },
    iconBtn: {
        padding: 5,
        position: 'relative'
    },
    notifBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#EF4444'
    },
    cartBadge: {
        position: 'absolute',
        top: 1,
        right: 1,
        backgroundColor: '#EF4444',
        borderRadius: 9,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3
    },
    cartBadgeTxt: {
        color: 'white',
        fontSize: 9,
        fontWeight: '900'
    },
    searchControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 42,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    searchInput: {
        flex: 1,
        fontSize: 12.5,
        color: '#0F172A',
        fontWeight: '600',
        padding: 0
    },
    viewModeBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    trustTickerScroll: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        backgroundColor: '#F8FAFC'
    },
    trustTickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 4.5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    trustTickerTxt: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#334155'
    },
    storiesWrapper: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    storiesSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 8
    },
    storiesTitle: {
        fontSize: 10.5,
        fontWeight: '900',
        color: BRAND.navy,
        letterSpacing: 0.6
    },
    storiesSub: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '600'
    },
    storiesScroll: {
        paddingHorizontal: 14,
        gap: 12
    },
    storyItem: {
        alignItems: 'center',
        width: 66
    },
    storyRing: {
        width: 58,
        height: 58,
        borderRadius: 29,
        padding: 2.5,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        position: 'relative'
    },
    storyRingOfficial: {
        borderColor: BRAND.navy,
        backgroundColor: '#0A192F10'
    },
    storyRingRec: {
        borderColor: BRAND.gold,
        backgroundColor: '#D9A73A15'
    },
    storyAvatarInner: {
        width: '100%',
        height: '100%',
        borderRadius: 26,
        overflow: 'hidden',
        backgroundColor: '#F8FAFC'
    },
    storyImg: {
        width: '100%',
        height: '100%'
    },
    storyVerifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: BRAND.sky,
        width: 15,
        height: 15,
        borderRadius: 7.5,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF'
    },
    storyNameTxt: {
        fontSize: 10,
        fontWeight: '700',
        color: '#1E293B',
        marginTop: 4,
        textAlign: 'center'
    },
    subTabsScroll: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8
    },
    subTabBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 13,
        paddingVertical: 7.5,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    subTabBtnActive: {
        backgroundColor: BRAND.navy,
        borderColor: BRAND.navy
    },
    subTabTxt: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#64748B'
    },
    subTabTxtActive: {
        color: '#FFFFFF',
        fontWeight: '900'
    },
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 10
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.3
    },
    sectionSub: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '500',
        marginTop: 1
    },
    seeAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3
    },
    seeAllTxt: {
        fontSize: 12,
        color: BRAND.sky,
        fontWeight: '800'
    },
    spotlightCard: {
        width: width * 0.68,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#D9A73A40',
        elevation: 2,
        shadowColor: '#0E1A2E',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 }
    },
    spotlightBannerBox: {
        height: 80,
        backgroundColor: '#CBD5E1',
        position: 'relative'
    },
    spotlightBannerImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    spotlightBannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(14,26,46,0.25)'
    },
    spotlightBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: BRAND.gold,
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3
    },
    spotlightBadgeTxt: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    spotlightBody: {
        padding: 12,
        paddingTop: 0
    },
    spotlightAvatarOverlap: {
        marginTop: -22,
        alignSelf: 'flex-start',
        position: 'relative'
    },
    spotlightAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF'
    },
    spotlightVerifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: BRAND.sky,
        width: 14,
        height: 14,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF'
    },
    spotlightName: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0E1A2E',
        marginTop: 4
    },
    spotlightCategory: {
        fontSize: 10.5,
        color: BRAND.goldDark,
        fontWeight: '700',
        marginTop: 1
    },
    spotlightFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    spotlightFollowBtn: {
        backgroundColor: '#0E1A2E',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8
    },
    spotlightFollowBtnActive: {
        backgroundColor: '#F1F5F9'
    },
    spotlightFollowTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    spotlightFollowTxtActive: {
        color: BRAND.sky
    },
    spotlightOwnStoreBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#0A192F',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    spotlightOwnStoreTxt: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#FCD34D'
    },
    storesListContainer: {
        paddingHorizontal: 16,
        gap: 14
    },
    modernCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    cardCoverBox: {
        height: 70,
        position: 'relative',
        backgroundColor: '#0A192F'
    },
    cardCoverImg: {
        width: '100%',
        height: '100%'
    },
    cardCoverOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 25, 47, 0.4)'
    },
    cardTopBadgesLeft: {
        position: 'absolute',
        top: 8,
        left: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    badgeOfficial: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3.5,
        backgroundColor: BRAND.navy,
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: BRAND.gold
    },
    badgeOfficialTxt: {
        color: BRAND.gold,
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    badgeRecommended: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: BRAND.gold,
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 6
    },
    badgeRecommendedTxt: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    badgeVerified: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 6
    },
    badgeVerifiedTxt: {
        color: '#065F46',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    quickFollowBtn: {
        position: 'absolute',
        top: 8,
        right: 10,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(10, 25, 47, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    quickFollowBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: '#EF4444'
    },
    ownStoreBadgeTop: {
        position: 'absolute',
        top: 8,
        right: 10,
        backgroundColor: '#0A192F',
        borderRadius: 14,
        paddingHorizontal: 8,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    ownStoreBadgeTxt: {
        color: '#FCD34D',
        fontSize: 9,
        fontWeight: '800'
    },
    cardBody: {
        paddingHorizontal: 14,
        paddingBottom: 14,
        paddingTop: 0
    },
    cardIdentityRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: -22,
        gap: 12
    },
    cardAvatarWrap: {
        position: 'relative'
    },
    cardAvatar: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 2.5,
        borderColor: '#FFFFFF'
    },
    cardVerifiedIcon: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: BRAND.sky,
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF'
    },
    cardTitleCol: {
        flex: 1,
        marginTop: 24
    },
    cardStoreName: {
        fontSize: 14.5,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.2
    },
    cardCategoryTxt: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 1
    },
    cardStatsStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    cardStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3
    },
    cardStatBold: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0F172A'
    },
    cardStatDim: {
        fontSize: 10.5,
        color: '#64748B',
        fontWeight: '600'
    },
    cardStatDot: {
        fontSize: 9,
        color: '#CBD5E1'
    },
    miniPreviewStrip: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10
    },
    miniPreviewItem: {
        flex: 1,
        height: 64,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        position: 'relative'
    },
    miniPreviewImg: {
        width: '100%',
        height: '100%'
    },
    miniPreviewPriceTag: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(10, 25, 47, 0.75)',
        paddingVertical: 2,
        paddingHorizontal: 4,
        alignItems: 'center'
    },
    miniPreviewPriceTxt: {
        fontSize: 9,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    cardActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    actionWhatsAppBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12
    },
    actionWhatsAppTxt: {
        fontSize: 11,
        fontWeight: '900',
        color: '#059669'
    },
    actionCallBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    actionVisitBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: BRAND.navy,
        paddingVertical: 8,
        borderRadius: 12
    },
    actionVisitTxt: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '900'
    },
    storesGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        gap: 10
    },
    gridStoreCard: {
        width: (width - 44) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5
    },
    gridBannerBox: {
        height: 52,
        backgroundColor: '#0A192F',
        position: 'relative'
    },
    gridBannerImg: {
        width: '100%',
        height: '100%'
    },
    gridBannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 25, 47, 0.35)'
    },
    gridOfficialBadge: {
        position: 'absolute',
        top: 5,
        left: 5,
        backgroundColor: BRAND.navy,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: BRAND.gold
    },
    gridOfficialTxt: {
        color: BRAND.gold,
        fontSize: 7.5,
        fontWeight: '900'
    },
    gridBody: {
        padding: 10,
        paddingTop: 0
    },
    gridAvatarWrap: {
        marginTop: -16,
        alignSelf: 'flex-start',
        position: 'relative'
    },
    gridAvatar: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#FFFFFF'
    },
    gridVerifiedBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: BRAND.sky,
        width: 12,
        height: 12,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FFFFFF'
    },
    gridStoreName: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: 4
    },
    gridCategory: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 1
    },
    gridMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    gridActionRow: {
        marginTop: 8
    },
    gridVisitBtn: {
        backgroundColor: '#0A192F',
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: 'center'
    },
    gridVisitTxt: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '900'
    },
    productsScroll: {
        paddingHorizontal: 16,
        gap: 12
    },
    prodCard: {
        width: 140,
        backgroundColor: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 2
    },
    prodImgBox: {
        width: '100%',
        height: 110,
        position: 'relative',
        backgroundColor: '#F8FAFC'
    },
    prodImg: {
        width: '100%',
        height: '100%'
    },
    discountBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        backgroundColor: '#EF4444',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 6
    },
    discountBadgeTxt: {
        color: 'white',
        fontSize: 9,
        fontWeight: '900'
    },
    prodInfo: {
        padding: 10
    },
    prodCategory: {
        fontSize: 9,
        fontWeight: '800',
        color: BRAND.sky,
        textTransform: 'uppercase',
        marginBottom: 2
    },
    prodName: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#0F172A',
        lineHeight: 15,
        minHeight: 30
    },
    prodPriceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        marginTop: 4,
        marginBottom: 6
    },
    prodPrice: {
        fontSize: 12.5,
        fontWeight: '900',
        color: BRAND.sky
    },
    prodOldPrice: {
        fontSize: 9.5,
        color: '#94A3B8',
        textDecorationLine: 'line-through'
    },
    quickCartBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: BRAND.navy,
        paddingVertical: 6,
        borderRadius: 8
    },
    quickCartBtnTxt: {
        color: 'white',
        fontSize: 10.5,
        fontWeight: '900'
    },
    vendorBannerWrapper: {
        paddingHorizontal: 16,
        marginTop: 22
    },
    vendorBannerCard: {
        backgroundColor: '#0A192F',
        borderRadius: 20,
        padding: 18,
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: BRAND.gold
    },
    vendorBannerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(217, 167, 58, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 8
    },
    vendorBannerBadgeTxt: {
        fontSize: 8.5,
        fontWeight: '900',
        color: BRAND.gold
    },
    vendorBannerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 4
    },
    vendorBannerSub: {
        fontSize: 11,
        color: '#94A3B8',
        lineHeight: 16,
        marginBottom: 12
    },
    vendorBannerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        alignSelf: 'flex-start'
    },
    vendorBannerBtnTxt: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#0A192F'
    },
    catPillGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    catPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    catPillTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155'
    },
    emptyBox: {
        paddingVertical: 35,
        alignItems: 'center',
        gap: 8
    },
    emptyTxt: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600'
    },
    emptyBtn: {
        backgroundColor: BRAND.navy,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8,
        marginTop: 4
    },
    emptyBtnTxt: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800'
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: BRAND.navy,
        paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 20) + 8,
        paddingBottom: 14,
        paddingHorizontal: 16,
        zIndex: 20
    },
    modalBackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    modalBackTxt: {
        color: 'white',
        fontSize: 13,
        fontWeight: '700'
    },
    modalHeaderTitle: {
        flex: 1,
        color: 'white',
        fontSize: 14,
        fontWeight: '900',
        textAlign: 'center',
        marginHorizontal: 12
    },
    modalIconBtn: {
        padding: 4
    },
    modalCartBtn: {
        position: 'relative',
        padding: 4
    },
    modalCartBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#EF4444',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3
    },
    modalCartBadgeTxt: {
        color: 'white',
        fontSize: 9,
        fontWeight: '900'
    },
    storeHeroBox: {
        height: 160,
        position: 'relative',
        backgroundColor: BRAND.navy
    },
    storeHeroBanner: {
        width: '100%',
        height: '100%'
    },
    storeHeroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 25, 47, 0.65)'
    },
    storeHeroProfileRow: {
        position: 'absolute',
        bottom: 14,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14
    },
    storeHeroAvatarWrap: {
        position: 'relative'
    },
    storeHeroAvatar: {
        width: 62,
        height: 62,
        borderRadius: 18,
        borderWidth: 3,
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF'
    },
    verifiedIconBadgeLarge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: BRAND.sky,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white'
    },
    storeHeroNameCol: {
        flex: 1
    },
    storeHeroName: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    officialPill: {
        backgroundColor: BRAND.gold,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5
    },
    officialPillTxt: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900'
    },
    storeHeroCategory: {
        fontSize: 11,
        color: BRAND.gold,
        fontWeight: '700',
        marginTop: 2
    },
    storeHeroLocation: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 2
    },
    storeStatsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: -10,
        borderRadius: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 3,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6
    },
    statBox: {
        flex: 1,
        alignItems: 'center'
    },
    statVal: {
        fontSize: 15,
        fontWeight: '900',
        color: BRAND.navy
    },
    statLbl: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '700',
        marginTop: 1
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#E2E8F0'
    },
    storeDetailActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        marginTop: 14
    },
    storeDetailBtnFollow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: BRAND.navy,
        paddingVertical: 10,
        borderRadius: 12
    },
    storeDetailBtnFollowing: {
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: BRAND.sky
    },
    storeDetailBtnFollowTxt: {
        color: 'white',
        fontSize: 12,
        fontWeight: '900'
    },
    storeDetailBtnFollowingTxt: {
        color: BRAND.sky
    },
    storeDetailBtnOwnStore: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: '#0A192F',
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        paddingVertical: 10,
        borderRadius: 12
    },
    storeDetailBtnOwnStoreTxt: {
        color: '#FCD34D',
        fontSize: 12,
        fontWeight: '900'
    },
    storeDetailBtnWhatsApp: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#10B981',
        paddingVertical: 10,
        borderRadius: 12
    },
    storeDetailBtnWhatsAppTxt: {
        color: 'white',
        fontSize: 12,
        fontWeight: '900'
    },
    storeDetailBtnCall: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    policyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    policyIconBox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    policyLbl: {
        fontSize: 9.5,
        color: '#64748B',
        fontWeight: '800',
        letterSpacing: 0.3
    },
    policyVal: {
        fontSize: 11.5,
        color: BRAND.navy,
        fontWeight: '800',
        marginTop: 1
    },
    socialChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FDF2F8',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FCE7F3'
    },
    storeBioCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    storeBioTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: BRAND.navy
    },
    storeBioTxt: {
        fontSize: 11.5,
        color: '#475569',
        lineHeight: 16
    },
    storeCatalogHeader: {
        paddingHorizontal: 16,
        marginTop: 18,
        marginBottom: 8
    },
    storeCatalogTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A'
    },
    storeCatalogSub: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '500',
        marginTop: 1
    },
    storeSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    storeSearchInput: {
        flex: 1,
        fontSize: 12,
        color: '#0F172A',
        fontWeight: '600',
        padding: 0
    },
    storeCategoryScroll: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8
    },
    storeCatBtn: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    storeCatBtnActive: {
        backgroundColor: BRAND.navy,
        borderColor: BRAND.navy
    },
    storeCatTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B'
    },
    storeCatTxtActive: {
        color: '#FFFFFF',
        fontWeight: '900'
    },
    storeGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        marginTop: 4
    },
    storeGridCard: {
        width: (width - 36) / 2,
        marginHorizontal: 4,
        marginBottom: 12,
        backgroundColor: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 2
    },
    storeGridImgBox: {
        width: '100%',
        height: 125,
        backgroundColor: '#F8FAFC',
        position: 'relative'
    },
    storeGridImg: {
        width: '100%',
        height: '100%'
    },
    storeGridInfo: {
        padding: 10
    },
    storeGridName: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#0F172A',
        lineHeight: 15,
        minHeight: 30
    },
    storeEmptyBox: {
        padding: 40,
        alignItems: 'center',
        gap: 8,
        width: '100%'
    },
    storeEmptyTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A'
    },
    storeEmptySub: {
        fontSize: 11,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 16
    },
    toastContainer: {
        position: 'absolute',
        bottom: 30,
        alignSelf: 'center',
        backgroundColor: '#0F172A',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 999
    },
    toastTxt: {
        color: 'white',
        fontSize: 12,
        fontWeight: '700'
    },
    socialIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#DCFCE7',
        borderWidth: 1.5,
        borderColor: '#86EFAC',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 3,
        elevation: 2,
    }
});
