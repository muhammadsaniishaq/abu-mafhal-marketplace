import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    Image, Dimensions, StatusBar, ActivityIndicator,
    RefreshControl, StyleSheet, Animated, Linking, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

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
};

const DEFAULT_CATEGORY_IMAGES = {
    'phones & tablets': 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?q=80&w=400&auto=format&fit=crop',
    'fashion & apparel': 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400&auto=format&fit=crop',
    'electronics & gadgets': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400&auto=format&fit=crop',
    'shoes & footwear': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=400&auto=format&fit=crop',
    'beauty & health': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=400&auto=format&fit=crop',
    'home & living': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=400&auto=format&fit=crop',
    'automotive': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=400&auto=format&fit=crop',
    'groceries & food': 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&auto=format&fit=crop',
};

const CATEGORY_BANNERS = {
    'phones & tablets': {
        banner: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=700&auto=format&fit=crop',
        tagline: 'Up to 35% OFF Smartphones & Tablets',
        highlight: 'Genuine Brand Warranty'
    },
    'electronics & gadgets': {
        banner: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=700&auto=format&fit=crop',
        tagline: 'Premium Laptops, TVs & Smart Audio',
        highlight: '100% Authentic Tech'
    },
    'fashion & apparel': {
        banner: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=700&auto=format&fit=crop',
        tagline: 'New Season Men & Women Collections',
        highlight: 'Trending Urban & Traditional'
    },
    'shoes & footwear': {
        banner: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=700&auto=format&fit=crop',
        tagline: 'Top Brand Sneakers, Sandals & Loafers',
        highlight: 'Comfort & Durability Guaranteed'
    },
    'beauty & health': {
        banner: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=700&auto=format&fit=crop',
        tagline: 'Luxury Perfumes & Radiant Skincare',
        highlight: 'Original Brands Only'
    },
    'home & living': {
        banner: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=700&auto=format&fit=crop',
        tagline: 'Modern Living & Kitchen Essentials',
        highlight: 'Fast Express Delivery'
    },
};

const SUBCATEGORIES_MAP = {
    'phones & tablets': [
        { name: 'All Phones', query: '' },
        { name: 'Smartphones', query: 'smartphone' },
        { name: 'iPhones', query: 'iphone' },
        { name: 'Android', query: 'android' },
        { name: 'Tablets & iPads', query: 'tablet' },
        { name: 'Earbuds & Audio', query: 'audio' },
        { name: 'Power & Cables', query: 'charger' },
        { name: 'Cases & Covers', query: 'case' },
    ],
    'electronics & gadgets': [
        { name: 'All Electronics', query: '' },
        { name: 'Laptops & PCs', query: 'laptop' },
        { name: 'Smart TVs', query: 'tv' },
        { name: 'Smart Watches', query: 'watch' },
        { name: 'Cameras', query: 'camera' },
        { name: 'Gaming Consoles', query: 'gaming' },
        { name: 'Audio Systems', query: 'speaker' },
    ],
    'fashion & apparel': [
        { name: 'All Fashion', query: '' },
        { name: 'Men\'s Wear', query: 'men' },
        { name: 'Women\'s Wear', query: 'women' },
        { name: 'Traditional & Kaftans', query: 'kaftan' },
        { name: 'Bags & Wallets', query: 'bag' },
        { name: 'Watches & Jewelry', query: 'jewelry' },
        { name: 'Caps & Accessories', query: 'cap' },
    ],
    'shoes & footwear': [
        { name: 'All Shoes', query: '' },
        { name: 'Sneakers & Sports', query: 'sneaker' },
        { name: 'Formal Shoes', query: 'formal' },
        { name: 'Sandals & Slippers', query: 'sandal' },
        { name: 'Boots & Casual', query: 'boot' },
        { name: 'Women\'s Heels', query: 'heels' },
    ],
    'beauty & health': [
        { name: 'All Beauty', query: '' },
        { name: 'Skincare & Glow', query: 'skincare' },
        { name: 'Perfumes & Scents', query: 'perfume' },
        { name: 'Hair Care', query: 'hair' },
        { name: 'Makeup & Cosmetics', query: 'makeup' },
        { name: 'Personal Care', query: 'care' },
    ],
    'home & living': [
        { name: 'All Home', query: '' },
        { name: 'Kitchenware', query: 'kitchen' },
        { name: 'Furniture & Decor', query: 'furniture' },
        { name: 'Bedding & Linen', query: 'bedding' },
        { name: 'Home Appliances', query: 'appliance' },
        { name: 'Lighting & Lamps', query: 'light' },
    ],
};

const getCategoryImage = (cat) => {
    if (cat?.image_url) return cat.image_url;
    const key = (cat?.name || '').toLowerCase().trim();
    for (const [k, img] of Object.entries(DEFAULT_CATEGORY_IMAGES)) {
        if (key.includes(k) || k.includes(key)) return img;
    }
    return 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=400&auto=format&fit=crop';
};

const getCategoryBanner = (cat) => {
    const key = (cat?.name || '').toLowerCase().trim();
    for (const [k, b] of Object.entries(CATEGORY_BANNERS)) {
        if (key.includes(k) || k.includes(key)) return b;
    }
    return {
        banner: getCategoryImage(cat),
        tagline: `Discover ${cat?.name || 'Top'} Collections`,
        highlight: 'Verified Escrow Guarantee'
    };
};

const getSubcategories = (cat) => {
    const key = (cat?.name || '').toLowerCase().trim();
    for (const [k, list] of Object.entries(SUBCATEGORIES_MAP)) {
        if (key.includes(k) || k.includes(key)) return list;
    }
    return [
        { name: 'All Items', query: '' },
        { name: 'Popular Picks', query: 'popular' },
        { name: 'Top Deals', query: 'deals' },
        { name: 'New Arrivals', query: 'new' },
        { name: 'Accessories', query: 'accessories' }
    ];
};

const fmtPrice = (n) => {
    const num = Number(n);
    if (!num) return '₦0';
    return `₦${num.toLocaleString()}`;
};

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

export const CategoriesPage = ({
    onSelectCategory,
    onGoToCart,
    cartCount = 0,
    onProductClick,
    onAddToCart,
    onGoToShop,
    onNavigate
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('explorer'); // 'explorer' | 'grid'
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [activeSubcategory, setActiveSubcategory] = useState(null);
    const [products, setProducts] = useState([]);
    const [categoryCounts, setCategoryCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Toast feedback
    const [toastMessage, setToastMessage] = useState('');
    const toastAnim = useRef(new Animated.Value(0)).current;

    const showToast = (msg) => {
        setToastMessage(msg);
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2000),
            Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true })
        ]).start();
    };

    useEffect(() => {
        fetchCategoriesAndProducts();

        const catChannel = supabase
            .channel('categories-page-realtime-v4')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
                fetchCategoriesAndProducts(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                fetchCategoriesAndProducts(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(catChannel);
        };
    }, []);

    const fetchCategoriesAndProducts = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [catsRes, prodsRes] = await Promise.allSettled([
                supabase
                    .from('categories')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true, nullsFirst: false }),
                supabase
                    .from('products')
                    .select('id, name, description, price, compare_at_price, image_url, images, category, rating, reviews, stock, total_sales, is_active, status, vendor_id, created_at')
                    .eq('status', 'approved')
                    .order('created_at', { ascending: false })
                    .limit(150)
            ]);

            const catsList = (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value?.data)) ? catsRes.value.data : [];
            const prodsList = (prodsRes.status === 'fulfilled' && Array.isArray(prodsRes.value?.data)) ? prodsRes.value.data : [];

            setCategories(catsList);
            setProducts(prodsList);

            // Compute product counts per category
            const counts = {};
            prodsList.forEach(p => {
                if (p.category) {
                    const norm = p.category.toLowerCase().trim();
                    counts[norm] = (counts[norm] || 0) + 1;
                }
            });
            setCategoryCounts(counts);

            // Set initial active category if none selected
            if (!selectedCategory && catsList.length > 0) {
                setSelectedCategory(catsList[0]);
                setActiveSubcategory(null);
            } else if (selectedCategory) {
                const refreshedSelected = catsList.find(c => c.id === selectedCategory.id) || catsList[0];
                setSelectedCategory(refreshedSelected);
            }
        } catch (err) {
            console.log('CategoriesPage fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchCategoriesAndProducts(true);
    };

    const handleWhatsAppConcierge = (cat) => {
        const catName = cat ? cat.name : 'General Catalog';
        const phone = '2349021486162';
        const msg = encodeURIComponent(`Hello Abu Mafhal Marketplace, I need help finding items in the "${catName}" category.`);
        Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {});
    };

    const handleAddToCartItem = (product) => {
        if (onAddToCart) {
            onAddToCart(product);
            showToast(`Added "${product.name}" to cart!`);
        }
    };

    // Filter categories by search
    const filteredCategories = categories.filter(cat =>
        (cat.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Filter live products for the active selected category
    const activeCategoryProducts = products.filter(p => {
        if (!selectedCategory) return true;
        const catName = (selectedCategory.name || '').toLowerCase().trim();
        const pCat = (p.category || '').toLowerCase().trim();
        const matchesCategory = pCat.includes(catName) || catName.includes(pCat);
        if (!matchesCategory) return false;

        if (activeSubcategory && activeSubcategory.query) {
            const q = activeSubcategory.query.toLowerCase();
            return (p.name || '').toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q);
        }
        return true;
    });

    const activeSubcategories = selectedCategory ? getSubcategories(selectedCategory) : [];
    const activeBanner = selectedCategory ? getCategoryBanner(selectedCategory) : null;

    return (
        <View style={s.container}>
            <StatusBar barStyle="light-content" backgroundColor={BRAND.navy} />

            {/* ══════════════════════════════════════════════════
                1. LUXURY MOBILE TOP HEADER
            ══════════════════════════════════════════════════ */}
            <View style={s.header}>
                <View style={s.headerTopRow}>
                    <View style={s.brandGroup}>
                        <Image source={AM_LOGO} style={s.brandLogo} resizeMode="contain" />
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Text style={s.brandTitle}>
                                    ABU <Text style={s.brandTitleAccent}>MAFHAL</Text>
                                </Text>
                                <View style={s.brandBadgePill}>
                                    <Text style={s.brandBadgeTxt}>DEPARTMENTS</Text>
                                </View>
                            </View>
                            <Text style={s.brandSubtitle}>
                                Smart Category Explorer
                            </Text>
                        </View>
                    </View>

                    <View style={s.headerActions}>
                        {/* View Mode Switcher */}
                        <TouchableOpacity
                            onPress={() => setViewMode(viewMode === 'explorer' ? 'grid' : 'explorer')}
                            style={s.modeToggleBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={viewMode === 'explorer' ? 'grid-outline' : 'git-branch-outline'}
                                size={17}
                                color="#FFFFFF"
                            />
                            <Text style={s.modeToggleTxt}>
                                {viewMode === 'explorer' ? 'Grid' : 'Explorer'}
                            </Text>
                        </TouchableOpacity>

                        {/* Cart Button */}
                        <TouchableOpacity
                            onPress={onGoToCart}
                            style={s.cartBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="cart-outline" size={23} color="#FFFFFF" />
                            {cartCount > 0 && (
                                <View style={s.cartBadge}>
                                    <Text style={s.cartBadgeTxt}>
                                        {cartCount > 99 ? '99+' : cartCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={s.searchBar}>
                    <Ionicons name="search" size={17} color={BRAND.slate} style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search departments, items, brands..."
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
            </View>

            {/* ══════════════════════════════════════════════════
                2. MAIN CATEGORIES CONTENT (EXPLORER VS GRID)
            ══════════════════════════════════════════════════ */}
            {loading && !refreshing ? (
                <View style={s.loadingBox}>
                    <ActivityIndicator size="large" color={BRAND.sky} />
                    <Text style={s.loadingTxt}>Loading smart catalog taxonomy...</Text>
                </View>
            ) : viewMode === 'explorer' && filteredCategories.length > 0 ? (
                /* ─── DUAL-PANE CATEGORY EXPLORER (AliExpress / Shopee Style) ─── */
                <View style={s.explorerContainer}>
                    {/* Left Vertical Category Rail */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={s.railScroll}
                        contentContainerStyle={s.railScrollContent}
                    >
                        {filteredCategories.map((cat, idx) => {
                            const isSelected = selectedCategory?.id === cat.id;
                            const count = categoryCounts[(cat.name || '').toLowerCase().trim()] || 0;

                            return (
                                <TouchableOpacity
                                    key={'rail-' + cat.id}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        setSelectedCategory(cat);
                                        setActiveSubcategory(null);
                                    }}
                                    style={[
                                        s.railItem,
                                        isSelected && s.railItemActive
                                    ]}
                                >
                                    {/* Active Left Pill Bar */}
                                    {isSelected && <View style={s.railActiveIndicator} />}

                                    <View style={[
                                        s.railIconBox,
                                        isSelected && s.railIconBoxActive
                                    ]}>
                                        <Image
                                            source={{ uri: getCategoryImage(cat) }}
                                            style={s.railIconImg}
                                        />
                                    </View>

                                    <Text
                                        numberOfLines={2}
                                        style={[
                                            s.railItemTitle,
                                            isSelected && s.railItemTitleActive
                                        ]}
                                    >
                                        {cat.name}
                                    </Text>

                                    {count > 0 && (
                                        <Text style={[
                                            s.railItemCount,
                                            isSelected && s.railItemCountActive
                                        ]}>
                                            {count} items
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Right Dynamic Content Pane */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={s.showcaseScroll}
                        contentContainerStyle={s.showcaseContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND.sky]} />
                        }
                    >
                        {selectedCategory && (
                            <View>
                                {/* Category Spotlight Hero Banner */}
                                <TouchableOpacity
                                    activeOpacity={0.92}
                                    onPress={() => onSelectCategory ? onSelectCategory(selectedCategory.name) : onGoToShop && onGoToShop(selectedCategory.name)}
                                    style={s.heroBannerCard}
                                >
                                    <Image
                                        source={{ uri: activeBanner.banner }}
                                        style={s.heroBannerImg}
                                    />
                                    <View style={s.heroBannerOverlay} />

                                    <View style={s.heroBannerContent}>
                                        <View style={s.heroBadgeRow}>
                                            <Ionicons name="sparkles" size={11} color="#FFFFFF" />
                                            <Text style={s.heroBadgeTxt}>{activeBanner.highlight}</Text>
                                        </View>

                                        <Text style={s.heroBannerTitle} numberOfLines={2}>
                                            {selectedCategory.name}
                                        </Text>
                                        <Text style={s.heroBannerSub} numberOfLines={1}>
                                            {activeBanner.tagline}
                                        </Text>

                                        <View style={s.heroCtaPill}>
                                            <Text style={s.heroCtaTxt}>Explore All Items</Text>
                                            <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                {/* ─── Subcategories Filter Chips ─── */}
                                <View style={s.subcategoriesWrap}>
                                    <Text style={s.sectionHeaderTitle}>
                                        POPULAR SECTIONS
                                    </Text>

                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={s.subcatChipsRow}
                                    >
                                        {activeSubcategories.map((sub, sIdx) => {
                                            const isActive = (activeSubcategory?.name === sub.name) || (!activeSubcategory && sIdx === 0);

                                            return (
                                                <TouchableOpacity
                                                    key={'sub-' + sIdx}
                                                    onPress={() => {
                                                        if (sub.query === '') {
                                                            setActiveSubcategory(null);
                                                        } else {
                                                            setActiveSubcategory(sub);
                                                        }
                                                    }}
                                                    style={[
                                                        s.subcatChip,
                                                        isActive && s.subcatChipActive
                                                    ]}
                                                    activeOpacity={0.75}
                                                >
                                                    <Text style={[
                                                        s.subcatChipTxt,
                                                        isActive && s.subcatChipTxtActive
                                                    ]}>
                                                        {sub.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>

                                {/* ─── Live Products in Selected Category ─── */}
                                <View style={s.productsSection}>
                                    <View style={s.productsHeadRow}>
                                        <Text style={s.sectionHeaderTitle}>
                                            IN-STOCK PRODUCTS ({activeCategoryProducts.length})
                                        </Text>

                                        <TouchableOpacity
                                            onPress={() => onSelectCategory ? onSelectCategory(selectedCategory.name) : onGoToShop && onGoToShop(selectedCategory.name)}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                                        >
                                            <Text style={s.seeAllTxt}>See All in Shop</Text>
                                            <Ionicons name="chevron-forward" size={12} color={BRAND.sky} />
                                        </TouchableOpacity>
                                    </View>

                                    {activeCategoryProducts.length === 0 ? (
                                        <View style={s.emptyCategoryBox}>
                                            <Ionicons name="cube-outline" size={32} color="#94A3B8" />
                                            <Text style={s.emptyCategoryTitle}>
                                                No items match this filter yet
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => onSelectCategory ? onSelectCategory(selectedCategory.name) : onGoToShop && onGoToShop(selectedCategory.name)}
                                                style={s.emptyCategoryBtn}
                                            >
                                                <Text style={s.emptyCategoryBtnTxt}>Browse Marketplace</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={s.productsGrid}>
                                            {activeCategoryProducts.slice(0, 10).map((prod) => {
                                                const hasDiscount = Number(prod.compare_at_price) > Number(prod.price);

                                                return (
                                                    <TouchableOpacity
                                                        key={'cat-prod-' + prod.id}
                                                        activeOpacity={0.9}
                                                        onPress={() => onProductClick && onProductClick(prod)}
                                                        style={s.prodCard}
                                                    >
                                                        <View style={s.prodImgBox}>
                                                            <Image
                                                                source={{ uri: getProductImage(prod) }}
                                                                style={s.prodImg}
                                                                resizeMode="cover"
                                                            />
                                                            {hasDiscount && (
                                                                <View style={s.discountBadge}>
                                                                    <Text style={s.discountTxt}>SALE</Text>
                                                                </View>
                                                            )}
                                                        </View>

                                                        <View style={s.prodBody}>
                                                            <Text numberOfLines={2} style={s.prodName}>
                                                                {prod.name}
                                                            </Text>

                                                            <View style={s.prodPriceRow}>
                                                                <Text style={s.prodPrice}>
                                                                    {fmtPrice(prod.price)}
                                                                </Text>

                                                                <TouchableOpacity
                                                                    onPress={() => handleAddToCartItem(prod)}
                                                                    style={s.prodAddBtn}
                                                                    activeOpacity={0.7}
                                                                >
                                                                    <Ionicons name="add" size={16} color="#FFFFFF" />
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>

                                {/* WhatsApp Help Concierge */}
                                <TouchableOpacity
                                    activeOpacity={0.88}
                                    onPress={() => handleWhatsAppConcierge(selectedCategory)}
                                    style={s.conciergePill}
                                >
                                    <View style={s.conciergeIconBox}>
                                        <Ionicons name="logo-whatsapp" size={18} color="#10B981" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.conciergeTitle}>Need help finding {selectedCategory.name}?</Text>
                                        <Text style={s.conciergeSub}>Ask our concierge assistant on WhatsApp</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={14} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </View>
            ) : (
                /* ─── 3-COLUMN LUXURY VISUAL GRID SHOWCASE ─── */
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={s.gridContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND.sky]} />
                    }
                >
                    <View style={s.gridHeaderNote}>
                        <Text style={s.gridHeaderTitle}>ALL MARKETPLACE DEPARTMENTS</Text>
                        <Text style={s.gridHeaderSub}>Tap any department to shop or drill down</Text>
                    </View>

                    <View style={s.gridCardsWrap}>
                        {filteredCategories.map((cat) => {
                            const count = categoryCounts[(cat.name || '').toLowerCase().trim()] || 0;

                            return (
                                <TouchableOpacity
                                    key={'grid-cat-' + cat.id}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        setSelectedCategory(cat);
                                        setViewMode('explorer');
                                    }}
                                    style={s.gridCard}
                                >
                                    <View style={s.gridCardImgWrap}>
                                        <Image
                                            source={{ uri: getCategoryImage(cat) }}
                                            style={s.gridCardImg}
                                        />
                                    </View>

                                    <Text numberOfLines={2} style={s.gridCardTitle}>
                                        {cat.name}
                                    </Text>

                                    <View style={s.gridCountBadge}>
                                        <Text style={s.gridCountTxt}>
                                            {count > 0 ? `${count} items` : 'Explore'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            )}

            {/* ════ FLOATING TOAST NOTIFICATION ════ */}
            {toastMessage.length > 0 && (
                <Animated.View style={[s.toastContainer, { opacity: toastAnim }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={s.toastTxt} numberOfLines={1}>{toastMessage}</Text>
                </Animated.View>
            )}
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    // Top Header
    header: {
        backgroundColor: BRAND.navy,
        paddingTop: Platform.OS === 'ios' ? 50 : 44,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    brandGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    brandLogo: {
        width: 36,
        height: 36,
    },
    brandTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    brandTitleAccent: {
        color: '#38BDF8',
    },
    brandBadgePill: {
        backgroundColor: 'rgba(56, 189, 248, 0.18)',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.35)',
    },
    brandBadgeTxt: {
        color: '#38BDF8',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    brandSubtitle: {
        color: '#94A3B8',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    modeToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    modeToggleTxt: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    cartBtn: {
        position: 'relative',
        padding: 4,
    },
    cartBadge: {
        position: 'absolute',
        top: 0,
        right: -3,
        backgroundColor: '#F59E0B',
        borderRadius: 10,
        minWidth: 17,
        height: 17,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        borderWidth: 1.5,
        borderColor: BRAND.navy,
    },
    cartBadgeTxt: {
        color: '#0A192F',
        fontSize: 9,
        fontWeight: '900',
    },
    // Search Bar
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 44,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: BRAND.slateDark,
        fontWeight: '600',
    },
    // Loading
    loadingBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    loadingTxt: {
        marginTop: 10,
        fontSize: 12,
        color: BRAND.slate,
        fontWeight: '700',
    },
    // Explorer Layout
    explorerContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    // Left Category Rail
    railScroll: {
        width: 95,
        backgroundColor: '#F1F5F9',
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
    },
    railScrollContent: {
        paddingVertical: 10,
        paddingBottom: 100,
    },
    railItem: {
        paddingVertical: 12,
        paddingHorizontal: 6,
        alignItems: 'center',
        position: 'relative',
        borderBottomWidth: 1,
        borderBottomColor: '#E8EDF5',
    },
    railItemActive: {
        backgroundColor: '#FFFFFF',
    },
    railActiveIndicator: {
        position: 'absolute',
        left: 0,
        top: 10,
        bottom: 10,
        width: 3.5,
        backgroundColor: BRAND.sky,
        borderTopRightRadius: 3,
        borderBottomRightRadius: 3,
    },
    railIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    railIconBoxActive: {
        borderColor: BRAND.sky,
        backgroundColor: BRAND.skyLight,
    },
    railIconImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    railItemTitle: {
        fontSize: 10.5,
        fontWeight: '700',
        color: BRAND.slate,
        textAlign: 'center',
        lineHeight: 13,
    },
    railItemTitleActive: {
        color: BRAND.sky,
        fontWeight: '900',
    },
    railItemCount: {
        fontSize: 9,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 2,
    },
    railItemCountActive: {
        color: '#0284C7',
    },
    // Right Showcase Area
    showcaseScroll: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    showcaseContent: {
        padding: 12,
        paddingBottom: 130,
    },
    // Hero Banner Card
    heroBannerCard: {
        height: 125,
        borderRadius: 18,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 14,
        backgroundColor: BRAND.navy,
        shadowColor: BRAND.navy,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    heroBannerImg: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        opacity: 0.55,
    },
    heroBannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 25, 47, 0.5)',
    },
    heroBannerContent: {
        padding: 12,
        justifyContent: 'space-between',
        height: '100%',
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(2, 132, 199, 0.75)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    heroBadgeTxt: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    heroBannerTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    heroBannerSub: {
        color: '#E0F2FE',
        fontSize: 10.5,
        fontWeight: '600',
    },
    heroCtaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    heroCtaTxt: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    // Subcategories Section
    subcategoriesWrap: {
        marginBottom: 16,
    },
    sectionHeaderTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: BRAND.slate,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    subcatChipsRow: {
        gap: 8,
        paddingBottom: 2,
    },
    subcatChip: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    subcatChipActive: {
        backgroundColor: BRAND.navy,
        borderColor: BRAND.navy,
    },
    subcatChipTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.slateDark,
    },
    subcatChipTxtActive: {
        color: '#FFFFFF',
    },
    // Products Section
    productsSection: {
        marginBottom: 14,
    },
    productsHeadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    seeAllTxt: {
        fontSize: 11,
        color: BRAND.sky,
        fontWeight: '800',
    },
    productsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'space-between',
    },
    prodCard: {
        width: (width - 95 - 24 - 10) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 1.5,
    },
    prodImgBox: {
        width: '100%',
        height: 105,
        backgroundColor: '#F8FAFC',
        position: 'relative',
    },
    prodImg: {
        width: '100%',
        height: '100%',
    },
    discountBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        backgroundColor: '#EF4444',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 6,
    },
    discountTxt: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
    },
    prodBody: {
        padding: 8,
    },
    prodName: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.slateDark,
        lineHeight: 14,
        height: 28,
        marginBottom: 6,
    },
    prodPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    prodPrice: {
        fontSize: 12,
        fontWeight: '900',
        color: BRAND.navy,
    },
    prodAddBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: BRAND.sky,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCategoryBox: {
        paddingVertical: 35,
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 16,
    },
    emptyCategoryTitle: {
        color: BRAND.slate,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 8,
        textAlign: 'center',
    },
    emptyCategoryBtn: {
        marginTop: 10,
        backgroundColor: BRAND.navy,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 10,
    },
    emptyCategoryBtnTxt: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    // Concierge Pill
    conciergePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F0FDF4',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#DCFCE7',
        marginTop: 10,
    },
    conciergeIconBox: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#DCFCE7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    conciergeTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#166534',
    },
    conciergeSub: {
        fontSize: 10,
        color: '#15803D',
        marginTop: 1,
    },
    // Visual Grid Mode
    gridContainer: {
        padding: 14,
        paddingBottom: 130,
    },
    gridHeaderNote: {
        marginBottom: 12,
    },
    gridHeaderTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: BRAND.navy,
        letterSpacing: 0.5,
    },
    gridHeaderSub: {
        fontSize: 11,
        color: BRAND.slate,
        marginTop: 2,
    },
    gridCardsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'space-between',
    },
    gridCard: {
        width: (width - 28 - 20) / 3,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1.5,
        marginBottom: 4,
    },
    gridCardImgWrap: {
        width: 58,
        height: 58,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    gridCardImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    gridCardTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: BRAND.slateDark,
        textAlign: 'center',
        lineHeight: 14,
        height: 28,
    },
    gridCountBadge: {
        marginTop: 6,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 8,
    },
    gridCountTxt: {
        fontSize: 9.5,
        fontWeight: '700',
        color: BRAND.sky,
    },
    // Toast
    toastContainer: {
        position: 'absolute',
        bottom: 95,
        left: 20,
        right: 20,
        backgroundColor: BRAND.navy,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
        zIndex: 9999,
    },
    toastTxt: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        flex: 1,
    },
});
