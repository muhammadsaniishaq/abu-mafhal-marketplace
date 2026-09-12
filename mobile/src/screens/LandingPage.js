import React, { useRef, useState, useEffect } from 'react';
import {
    View, Text, Image, TouchableOpacity, ScrollView, Dimensions,
    Platform, StatusBar, StyleSheet, TextInput, RefreshControl,
    Animated, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../context/AppSettingsContext';
import { supabase } from '../lib/supabase';
import { CountdownTimer } from '../components/CountdownTimer';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

// Format price into clean Nigerian Naira currency string
const fmtPrice = (val) => {
    const num = Number(val);
    if (!num || isNaN(num)) return '₦0';
    return `₦${num.toLocaleString()}`;
};

// Clean image URL resolver without broken placeholders
const resolveImage = (item) => {
    if (!item) return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400';
    if (item.image_url) return item.image_url;
    if (Array.isArray(item.images) && item.images.length > 0 && typeof item.images[0] === 'string') return item.images[0];
    if (typeof item.images === 'string' && item.images.startsWith('http')) return item.images;
    if (item.image && typeof item.image === 'string') return item.image;
    return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400';
};

const DEFAULT_CATEGORIES = [
    { id: '1', name: 'Phones & Tablets', icon: 'phone-portrait-outline' },
    { id: '2', name: 'Fashion & Apparel', icon: 'shirt-outline' },
    { id: '3', name: 'Electronics & Gadgets', icon: 'tv-outline' },
    { id: '4', name: 'Shoes & Footwear', icon: 'footsteps-outline' },
    { id: '5', name: 'Beauty & Health', icon: 'sparkles-outline' },
    { id: '6', name: 'Home & Living', icon: 'home-outline' },
];

export const LandingPage = ({
    navigation,
    onEnterShop,
    cartCount = 0,
    cartLines = [],
    onAddToCart,
    onLogin,
    user,
    onNavigate
}) => {
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [wishlist, setWishlist] = useState({});
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
    const [toast, setToast] = useState({ visible: false, message: '' });

    const bannerScrollRef = useRef(null);
    const toastAnim = useRef(new Animated.Value(0)).current;

    const showToast = (message) => {
        setToast({ visible: true, message });
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2200),
            Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true })
        ]).start(() => setToast({ visible: false, message: '' }));
    };

    // Load wishlist from storage
    useEffect(() => {
        AsyncStorage.getItem('@abumafhal_wishlist').then((data) => {
            if (data) {
                try { setWishlist(JSON.parse(data)); } catch (_) {}
            }
        }).catch(() => {});
    }, []);

    const toggleWishlist = async (id) => {
        const updated = { ...wishlist, [id]: !wishlist[id] };
        setWishlist(updated);
        try {
            await AsyncStorage.setItem('@abumafhal_wishlist', JSON.stringify(updated));
        } catch (_) {}
    };

    // Fetch 100% REAL data from Supabase
    const loadRealData = async () => {
        try {
            const [prodsRes, catsRes, bansRes] = await Promise.allSettled([
                supabase
                    .from('products')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('categories')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true }),
                supabase
                    .from('banners')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true })
            ]);

            if (prodsRes.status === 'fulfilled' && prodsRes.value.data) {
                setProducts(prodsRes.value.data);
            }

            if (catsRes.status === 'fulfilled' && catsRes.value.data?.length > 0) {
                setCategories(catsRes.value.data);
            }

            if (bansRes.status === 'fulfilled' && bansRes.value.data?.length > 0) {
                setBanners(bansRes.value.data);
            }
        } catch (e) {
            console.error('Error fetching live landing data:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadRealData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadRealData();
    };

    // Banner auto-sliding logic
    useEffect(() => {
        if (banners.length > 1) {
            const timer = setInterval(() => {
                setCurrentBannerIndex((prev) => {
                    const next = (prev + 1) % banners.length;
                    bannerScrollRef.current?.scrollTo({ x: next * (width - 32), animated: true });
                    return next;
                });
            }, 5000);
            return () => clearInterval(timer);
        }
    }, [banners.length]);

    // Handle product click -> opens real ProductDetails
    const handleProductPress = (product) => {
        if (onNavigate) {
            onNavigate('ProductDetails', { product });
        } else if (navigation) {
            navigation.navigate('ProductDetails', { product });
        }
    };

    // Handle Add to Cart -> 100% working
    const handleAddToCartPress = (product, e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (typeof onAddToCart === 'function') {
            onAddToCart(product);
            showToast(`Added "${product.name}" to cart! 🛒`);
        }
    };

    // Filter products by search query if typed
    const filteredProducts = searchQuery.trim()
        ? products.filter(p =>
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : products;

    // Flash deals: products with compare_at_price > price, or first 3 products
    const flashDeals = products.filter(p => p.compare_at_price && p.compare_at_price > p.price);
    const displayFlash = flashDeals.length > 0 ? flashDeals : products.slice(0, 3);

    return (
        <View style={s.root}>
            <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />

            {/* ─── 1. TOP APP BAR ─── */}
            <View style={[s.topBar, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) + 6 }]}>
                {/* Brand Row */}
                <View style={s.topRow}>
                    <TouchableOpacity
                        style={s.brandBlock}
                        onPress={() => onEnterShop ? onEnterShop('home') : null}
                        activeOpacity={0.8}
                    >
                        <Image source={AM_LOGO} style={s.brandLogo} resizeMode="contain" />
                        <View>
                            <View style={s.brandNameRow}>
                                <Text style={s.brandNameNavy}>ABU </Text>
                                <Text style={s.brandNameGold}>MAFHAL</Text>
                            </View>
                            <Text style={s.brandTagline}>ONLINE MARKETPLACE</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Right Action Buttons */}
                    <View style={s.topActions}>
                        {/* Cart Button with Live Badge */}
                        <TouchableOpacity
                            style={s.iconButton}
                            onPress={() => onEnterShop ? onEnterShop('cart') : null}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="cart-outline" size={24} color="#0A192F" />
                            {cartCount > 0 && (
                                <View style={s.cartBadge}>
                                    <Text style={s.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Sign In / Profile Pill */}
                        <TouchableOpacity
                            style={s.userPill}
                            onPress={() => user ? (onEnterShop ? onEnterShop('profile') : null) : (onLogin ? onLogin() : null)}
                            activeOpacity={0.85}
                        >
                            <Ionicons
                                name={user ? 'person-circle-outline' : 'log-in-outline'}
                                size={18}
                                color="#FFFFFF"
                            />
                            <Text style={s.userPillText} numberOfLines={1}>
                                {user ? (user.full_name?.split(' ')[0] || 'Account') : 'Sign In'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar Input */}
                <View style={s.searchContainer}>
                    <Ionicons name="search-outline" size={19} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search products, brands, categories..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={() => onEnterShop ? onEnterShop('shop', { query: searchQuery }) : null}
                        style={s.searchInput}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => onEnterShop ? onEnterShop('categories') : null}
                            style={{ padding: 4 }}
                        >
                            <Ionicons name="options-outline" size={18} color="#0A192F" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ─── SCROLLABLE CONTENT ─── */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D9A73A']} />}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 75 }}
            >
                {/* ─── 2. HERO / PROMO BANNER CAROUSEL ─── */}
                <View style={s.bannerSection}>
                    <ScrollView
                        ref={bannerScrollRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={(e) => {
                            const newIdx = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
                            setCurrentBannerIndex(newIdx);
                        }}
                    >
                        {banners.length > 0 ? (
                            banners.map((b, idx) => (
                                <TouchableOpacity
                                    key={b.id || idx}
                                    activeOpacity={0.92}
                                    onPress={() => onEnterShop ? onEnterShop('shop') : null}
                                    style={s.bannerCard}
                                >
                                    <Image
                                        source={{ uri: b.image_url }}
                                        style={s.bannerImage}
                                        resizeMode="cover"
                                    />
                                    <LinearGradient
                                        colors={['rgba(10,25,47,0.15)', 'rgba(10,25,47,0.85)']}
                                        style={StyleSheet.absoluteFillObject}
                                    />
                                    <View style={s.bannerContent}>
                                        <View style={s.badgePill}>
                                            <Text style={s.badgePillText}>EXCLUSIVE OFFER</Text>
                                        </View>
                                        <Text style={s.bannerTitle}>{b.title || 'Mega Deals on Abu Mafhal'}</Text>
                                        {b.subtitle && (
                                            <Text style={s.bannerSubtitle}>{b.subtitle}</Text>
                                        )}
                                        <View style={s.bannerCta}>
                                            <Text style={s.bannerCtaText}>Shop Now</Text>
                                            <Ionicons name="arrow-forward" size={13} color="#0A192F" />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <TouchableOpacity
                                activeOpacity={0.92}
                                onPress={() => onEnterShop ? onEnterShop('shop') : null}
                                style={s.bannerCard}
                            >
                                <LinearGradient
                                    colors={['#0A192F', '#0E2A4D', '#1B3B6F']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFillObject}
                                />
                                <View style={s.bannerContent}>
                                    <View style={s.badgePill}>
                                        <Text style={s.badgePillText}>VERIFIED MARKETPLACE</Text>
                                    </View>
                                    <Text style={s.bannerTitle}>Buy & Sell with Confidence</Text>
                                    <Text style={s.bannerSubtitle}>Escrow protected payments & fast cargo nationwide.</Text>
                                    <View style={s.bannerCta}>
                                        <Text style={s.bannerCtaText}>Explore Market</Text>
                                        <Ionicons name="arrow-forward" size={13} color="#0A192F" />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    {/* Banner Dots */}
                    {banners.length > 1 && (
                        <View style={s.dotsContainer}>
                            {banners.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        s.dot,
                                        currentBannerIndex === i ? s.dotActive : null
                                    ]}
                                />
                            ))}
                        </View>
                    )}
                </View>

                {/* ─── 3. CATEGORIES QUICK SELECTOR ─── */}
                <View style={s.sectionBlock}>
                    <View style={s.sectionHeader}>
                        <View style={s.sectionTitleRow}>
                            <Ionicons name="grid-outline" size={18} color="#D9A73A" />
                            <Text style={s.sectionTitle}>Categories</Text>
                        </View>
                        <TouchableOpacity onPress={() => onEnterShop ? onEnterShop('shop') : null}>
                            <Text style={s.sectionAction}>See All &gt;</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.categoriesScroll}
                    >
                        {categories.map((cat, idx) => (
                            <TouchableOpacity
                                key={cat.id || idx}
                                style={s.categoryItem}
                                onPress={() => onEnterShop ? onEnterShop('shop', { category: cat.name }) : null}
                                activeOpacity={0.75}
                            >
                                <View style={s.categoryIconCircle}>
                                    <Ionicons name={cat.icon || 'apps-outline'} size={22} color="#0A192F" />
                                </View>
                                <Text style={s.categoryLabel} numberOfLines={1}>
                                    {cat.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ─── 4. FLASH DEALS (WITH LIVE TIMER) ─── */}
                {displayFlash.length > 0 && (
                    <View style={s.sectionBlock}>
                        <View style={s.sectionHeader}>
                            <View style={s.sectionTitleRow}>
                                <Ionicons name="flash" size={19} color="#EF4444" />
                                <Text style={s.sectionTitle}>Flash Deals</Text>
                                <View style={{ marginLeft: 6 }}>
                                    <CountdownTimer />
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => onEnterShop ? onEnterShop('shop') : null}>
                                <Text style={s.sectionAction}>See All &gt;</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={s.flashScroll}
                        >
                            {displayFlash.map((item, i) => {
                                const discountPct = item.compare_at_price && item.compare_at_price > item.price
                                    ? Math.round(((item.compare_at_price - item.price) / item.compare_at_price) * 100)
                                    : 15;

                                return (
                                    <TouchableOpacity
                                        key={item.id || i}
                                        style={s.flashCard}
                                        onPress={() => handleProductPress(item)}
                                        activeOpacity={0.88}
                                    >
                                        <View style={s.flashDiscountBadge}>
                                            <Text style={s.flashDiscountText}>-{discountPct}%</Text>
                                        </View>

                                        <Image
                                            source={{ uri: resolveImage(item) }}
                                            style={s.flashImage}
                                            resizeMode="cover"
                                        />

                                        <View style={s.flashBody}>
                                            <Text style={s.flashName} numberOfLines={1}>{item.name}</Text>
                                            <View style={s.flashPriceRow}>
                                                <Text style={s.flashPrice}>{fmtPrice(item.price)}</Text>
                                                {item.compare_at_price && (
                                                    <Text style={s.flashOldPrice}>{fmtPrice(item.compare_at_price)}</Text>
                                                )}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* ─── 5. POPULAR & ALL PRODUCTS (2-COLUMN MODERN GRID) ─── */}
                <View style={s.sectionBlock}>
                    <View style={s.sectionHeader}>
                        <View style={s.sectionTitleRow}>
                            <Ionicons name="sparkles" size={18} color="#D9A73A" />
                            <Text style={s.sectionTitle}>
                                {searchQuery.trim() ? `Search Results (${filteredProducts.length})` : 'Popular Products'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => onEnterShop ? onEnterShop('shop') : null}>
                            <Text style={s.sectionAction}>View All &gt;</Text>
                        </TouchableOpacity>
                    </View>

                    {filteredProducts.length > 0 ? (
                        <View style={s.productGrid}>
                            {filteredProducts.map((p) => {
                                const isLiked = !!wishlist[p.id];
                                const hasDiscount = p.compare_at_price && p.compare_at_price > p.price;
                                const discountVal = hasDiscount
                                    ? Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100)
                                    : null;

                                return (
                                    <View key={p.id} style={s.productCol}>
                                        <TouchableOpacity
                                            style={s.productCard}
                                            onPress={() => handleProductPress(p)}
                                            activeOpacity={0.88}
                                        >
                                            {/* Top Media Container */}
                                            <View style={s.productMediaWrapper}>
                                                <Image
                                                    source={{ uri: resolveImage(p) }}
                                                    style={s.productImage}
                                                    resizeMode="cover"
                                                />

                                                {/* Discount Pill */}
                                                {discountVal && (
                                                    <View style={s.prodDiscountTag}>
                                                        <Text style={s.prodDiscountText}>-{discountVal}%</Text>
                                                    </View>
                                                )}

                                                {/* Wishlist Heart */}
                                                <TouchableOpacity
                                                    style={s.prodLikeBtn}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        toggleWishlist(p.id);
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons
                                                        name={isLiked ? 'heart' : 'heart-outline'}
                                                        size={16}
                                                        color={isLiked ? '#EF4444' : '#64748B'}
                                                    />
                                                </TouchableOpacity>
                                            </View>

                                            {/* Product Details */}
                                            <View style={s.productDetails}>
                                                <Text style={s.productCategoryText} numberOfLines={1}>
                                                    {p.category || 'Marketplace'}
                                                </Text>
                                                <Text style={s.productTitle} numberOfLines={2}>
                                                    {p.name}
                                                </Text>

                                                {/* Rating */}
                                                <View style={s.ratingRow}>
                                                    <Ionicons name="star" size={12} color="#F59E0B" />
                                                    <Text style={s.ratingScore}>{p.rating || 5.0}</Text>
                                                    <Text style={s.reviewsCount}>({p.reviews || p.reviews_count || 12})</Text>
                                                </View>

                                                {/* Price & Add to Cart Button */}
                                                <View style={s.priceActionRow}>
                                                    <View style={s.priceColumn}>
                                                        <Text style={s.productPrice}>{fmtPrice(p.price)}</Text>
                                                        {hasDiscount && (
                                                            <Text style={s.productOldPrice}>{fmtPrice(p.compare_at_price)}</Text>
                                                        )}
                                                    </View>

                                                    <TouchableOpacity
                                                        style={s.quickAddBtn}
                                                        onPress={(e) => handleAddToCartPress(p, e)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Ionicons name="cart-outline" size={15} color="#FFFFFF" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={s.emptyBox}>
                            <Ionicons name="cube-outline" size={44} color="#94A3B8" />
                            <Text style={s.emptyTitle}>No products found</Text>
                            <Text style={s.emptySubtitle}>Try searching with different keywords</Text>
                        </View>
                    )}
                </View>

                {/* ─── 6. BECOME A SELLER / VENDOR CALLOUT ─── */}
                <View style={s.sellerCardContainer}>
                    <LinearGradient
                        colors={['#0A192F', '#064E3B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.sellerBanner}
                    >
                        <View style={s.sellerBannerContent}>
                            <View style={s.sellerIconCircle}>
                                <Ionicons name="storefront" size={24} color="#10B981" />
                            </View>
                            <Text style={s.sellerHeadline}>Sell on Abu Mafhal</Text>
                            <Text style={s.sellerDesc}>
                                Reach thousands of verified buyers across Nigeria. Enjoy 100% secure escrow settlements and low fees.
                            </Text>

                            <TouchableOpacity
                                style={s.sellerButton}
                                onPress={() => {
                                    if (!user) {
                                        if (onLogin) onLogin();
                                    } else {
                                        if (onNavigate) onNavigate('VendorRegister');
                                    }
                                }}
                                activeOpacity={0.85}
                            >
                                <Text style={s.sellerButtonText}>Become a Seller</Text>
                                <Ionicons name="arrow-forward" size={14} color="#0A192F" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                {/* ─── 7. TRUST & SAFETY STRIP (CLEAN & COMPACT) ─── */}
                <View style={s.trustStripContainer}>
                    <View style={s.trustCard}>
                        <Ionicons name="shield-checkmark" size={22} color="#10B981" />
                        <Text style={s.trustCardTitle}>Escrow Secured</Text>
                        <Text style={s.trustCardDesc}>Safe payment release upon order confirmation</Text>
                    </View>

                    <View style={s.trustCard}>
                        <Ionicons name="airplane" size={22} color="#0284C7" />
                        <Text style={s.trustCardTitle}>Fast Delivery</Text>
                        <Text style={s.trustCardDesc}>Speedy, tracked shipping across all states</Text>
                    </View>

                    <View style={s.trustCard}>
                        <Ionicons name="headset" size={22} color="#D9A73A" />
                        <Text style={s.trustCardTitle}>24/7 Verified Help</Text>
                        <Text style={s.trustCardDesc}>Dedicated support whenever you need</Text>
                    </View>
                </View>

                {/* ─── 8. CLEAN MOBILE BRAND FOOTER ─── */}
                <View style={s.footerContainer}>
                    <View style={s.footerBrandRow}>
                        <Image source={AM_LOGO} style={s.footerLogo} resizeMode="contain" />
                        <Text style={s.footerBrandTitle}>Abu Mafhal Marketplace</Text>
                    </View>
                    <Text style={s.footerSlogan}>Your Marketplace, Your Choice.</Text>
                    <Text style={s.footerCopyright}>© 2026 Abu Mafhal. All Rights Reserved.</Text>
                </View>
            </ScrollView>

            {/* ─── 9. FIXED BOTTOM NAVIGATION BAR ─── */}
            <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8) }]}>
                {/* Home (Active) */}
                <TouchableOpacity
                    style={s.tabItem}
                    onPress={() => onEnterShop ? onEnterShop('home') : null}
                    activeOpacity={0.7}
                >
                    <Ionicons name="home" size={22} color="#D9A73A" />
                    <Text style={[s.tabLabel, s.tabLabelActive]}>Home</Text>
                </TouchableOpacity>

                {/* Shop */}
                <TouchableOpacity
                    style={s.tabItem}
                    onPress={() => onEnterShop ? onEnterShop('shop') : null}
                    activeOpacity={0.7}
                >
                    <Ionicons name="bag-handle-outline" size={22} color="#64748B" />
                    <Text style={s.tabLabel}>Shop</Text>
                </TouchableOpacity>

                {/* Cart with Live Badge */}
                <TouchableOpacity
                    style={s.tabItem}
                    onPress={() => onEnterShop ? onEnterShop('cart') : null}
                    activeOpacity={0.7}
                >
                    <View style={{ position: 'relative' }}>
                        <Ionicons name="cart-outline" size={23} color="#64748B" />
                        {cartCount > 0 && (
                            <View style={s.bottomCartBadge}>
                                <Text style={s.bottomCartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={s.tabLabel}>Cart</Text>
                </TouchableOpacity>

                {/* Account */}
                <TouchableOpacity
                    style={s.tabItem}
                    onPress={() => user ? (onEnterShop ? onEnterShop('profile') : null) : (onLogin ? onLogin() : null)}
                    activeOpacity={0.7}
                >
                    <Ionicons name={user ? 'person' : 'person-outline'} size={22} color="#64748B" />
                    <Text style={s.tabLabel}>{user ? 'Account' : 'Sign In'}</Text>
                </TouchableOpacity>
            </View>

            {/* ─── TOAST NOTIFICATION ─── */}
            {toast.visible && (
                <Animated.View style={[s.toastBox, { opacity: toastAnim }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={s.toastText}>{toast.message}</Text>
                </Animated.View>
            )}
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },

    /* ─── Header ─── */
    topBar: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        zIndex: 10,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    brandBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    brandLogo: {
        width: 36,
        height: 36,
    },
    brandNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandNameNavy: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.5,
    },
    brandNameGold: {
        fontSize: 16,
        fontWeight: '900',
        color: '#D9A73A',
        letterSpacing: 0.5,
    },
    brandTagline: {
        fontSize: 7.5,
        fontWeight: '700',
        color: '#64748B',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    topActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconButton: {
        position: 'relative',
        padding: 4,
    },
    cartBadge: {
        position: 'absolute',
        top: -2,
        right: -4,
        backgroundColor: '#EF4444',
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    cartBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
    },
    userPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#0A192F',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    userPillText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },

    /* ─── Search ─── */
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 42,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0F172A',
        fontWeight: '500',
    },

    /* ─── Banner Carousel ─── */
    bannerSection: {
        paddingHorizontal: 16,
        paddingTop: 12,
        marginBottom: 16,
    },
    bannerCard: {
        width: width - 32,
        height: 155,
        borderRadius: 18,
        overflow: 'hidden',
        position: 'relative',
        justifyContent: 'flex-end',
        padding: 16,
        backgroundColor: '#0A192F',
    },
    bannerImage: {
        ...StyleSheet.absoluteFillObject,
    },
    bannerContent: {
        zIndex: 2,
    },
    badgePill: {
        backgroundColor: '#D9A73A',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginBottom: 6,
    },
    badgePillText: {
        color: '#0A192F',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    bannerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 3,
    },
    bannerSubtitle: {
        color: '#CBD5E1',
        fontSize: 11,
        fontWeight: '500',
        marginBottom: 10,
    },
    bannerCta: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        alignSelf: 'flex-start',
    },
    bannerCtaText: {
        color: '#0A192F',
        fontSize: 11,
        fontWeight: '800',
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#CBD5E1',
    },
    dotActive: {
        width: 16,
        backgroundColor: '#D9A73A',
    },

    /* ─── Section Layout ─── */
    sectionBlock: {
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0A192F',
    },
    sectionAction: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0284C7',
    },

    /* ─── Categories ─── */
    categoriesScroll: {
        paddingHorizontal: 16,
        gap: 12,
    },
    categoryItem: {
        alignItems: 'center',
        width: 68,
    },
    categoryIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    categoryLabel: {
        fontSize: 10.5,
        fontWeight: '600',
        color: '#334155',
        textAlign: 'center',
    },

    /* ─── Flash Deals ─── */
    flashScroll: {
        paddingHorizontal: 16,
        gap: 12,
    },
    flashCard: {
        width: 140,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        position: 'relative',
    },
    flashDiscountBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#EF4444',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
        zIndex: 2,
    },
    flashDiscountText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
    },
    flashImage: {
        width: '100%',
        height: 100,
        backgroundColor: '#F1F5F9',
    },
    flashBody: {
        padding: 10,
    },
    flashName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    flashPriceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    flashPrice: {
        fontSize: 12,
        fontWeight: '900',
        color: '#0A192F',
    },
    flashOldPrice: {
        fontSize: 9.5,
        color: '#94A3B8',
        textDecorationLine: 'line-through',
    },

    /* ─── Product Grid (2 Columns) ─── */
    productGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
    },
    productCol: {
        width: '50%',
        paddingHorizontal: 4,
        marginBottom: 10,
    },
    productCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
    },
    productMediaWrapper: {
        width: '100%',
        height: 140,
        backgroundColor: '#F8FAFC',
        position: 'relative',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    prodDiscountTag: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#EF4444',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
    },
    prodDiscountText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
    },
    prodLikeBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productDetails: {
        padding: 10,
    },
    productCategoryText: {
        fontSize: 9.5,
        color: '#64748B',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    productTitle: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#0F172A',
        lineHeight: 16,
        marginBottom: 4,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginBottom: 6,
    },
    ratingScore: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0A192F',
    },
    reviewsCount: {
        fontSize: 9,
        color: '#94A3B8',
    },
    priceActionRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    priceColumn: {
        flex: 1,
    },
    productPrice: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0A192F',
    },
    productOldPrice: {
        fontSize: 9.5,
        color: '#94A3B8',
        textDecorationLine: 'line-through',
    },
    quickAddBtn: {
        backgroundColor: '#0A192F',
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* ─── Empty state ─── */
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
        marginTop: 8,
    },
    emptySubtitle: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },

    /* ─── Seller Invitation Card ─── */
    sellerCardContainer: {
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    sellerBanner: {
        borderRadius: 18,
        padding: 18,
    },
    sellerBannerContent: {
        alignItems: 'flex-start',
    },
    sellerIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    sellerHeadline: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
        marginBottom: 4,
    },
    sellerDesc: {
        color: '#94A3B8',
        fontSize: 11.5,
        lineHeight: 16,
        marginBottom: 14,
    },
    sellerButton: {
        backgroundColor: '#D9A73A',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    sellerButtonText: {
        color: '#0A192F',
        fontSize: 12,
        fontWeight: '800',
    },

    /* ─── Trust Strip ─── */
    trustStripContainer: {
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 24,
    },
    trustCard: {
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    trustCardTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0A192F',
        width: 90,
    },
    trustCardDesc: {
        fontSize: 10,
        color: '#64748B',
        flex: 1,
    },

    /* ─── Footer ─── */
    footerContainer: {
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    footerBrandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    footerLogo: {
        width: 24,
        height: 24,
    },
    footerBrandTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0A192F',
    },
    footerSlogan: {
        fontSize: 9.5,
        fontWeight: '600',
        color: '#94A3B8',
        marginBottom: 8,
    },
    footerCopyright: {
        fontSize: 9,
        color: '#CBD5E1',
    },

    /* ─── Bottom Nav Bar ─── */
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingTop: 8,
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        zIndex: 20,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 2,
    },
    tabLabelActive: {
        color: '#D9A73A',
        fontWeight: '800',
    },
    bottomCartBadge: {
        position: 'absolute',
        top: -4,
        right: -8,
        backgroundColor: '#EF4444',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    bottomCartBadgeText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
    },

    /* ─── Toast ─── */
    toastBox: {
        position: 'absolute',
        bottom: 70,
        alignSelf: 'center',
        backgroundColor: '#0A192F',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        zIndex: 999,
    },
    toastText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
});
