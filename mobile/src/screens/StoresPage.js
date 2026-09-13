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
import {
    FOLLOWED_STORES_KEY,
    getFollowedStoreMap,
    toggleFollowStore,
    subscribeToFollowChanges
} from '../services/vendorFollowerService';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

const fmtPrice = (n) => {
    const num = Number(n);
    if (!num) return '₦0';
    return `₦${num.toLocaleString()}`;
};

export const StoresPage = ({
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
    const [stores, setStores] = useState([]);
    const [popularProducts, setPopularProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [followedStores, setFollowedStores] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Selected Store for Dedicated Store Detail View
    const [selectedStore, setSelectedStore] = useState(null);
    const [storeSearchQuery, setStoreSearchQuery] = useState('');
    const [selectedStoreCategory, setSelectedStoreCategory] = useState('All');

    // Toast feedback
    const [toastMessage, setToastMessage] = useState('');
    const toastAnim = useRef(new Animated.Value(0)).current;

    const showToast = (msg) => {
        setToastMessage(msg);
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.delay(2200),
            Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true })
        ]).start();
    };

    useEffect(() => {
        loadFollowedState();
        fetchStoresAndProducts();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('stores-realtime-sync-v2')
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

        return () => {
            supabase.removeChannel(channel);
            if (typeof unsub === 'function') unsub();
        };
    }, []);

    const loadFollowedState = async () => {
        try {
            const map = await getFollowedStoreMap();
            if (map) setFollowedStores(map);
        } catch (_) {}
    };

    const toggleFollow = async (storeId, storeName) => {
        try {
            const res = await toggleFollowStore(storeId, storeName);
            if (res && res.updatedMap) setFollowedStores(res.updatedMap);
            showToast(res.isFollowed ? `Following ${storeName}` : `Unfollowed ${storeName}`);
        } catch (_) {
            const isCurrentlyFollowed = !!followedStores[storeId];
            const updated = { ...followedStores, [storeId]: !isCurrentlyFollowed };
            setFollowedStores(updated);
            AsyncStorage.setItem(FOLLOWED_STORES_KEY, JSON.stringify(updated)).catch(() => {});
            showToast(!isCurrentlyFollowed ? `Following ${storeName}` : `Unfollowed ${storeName}`);
        }
    };

    const fetchStoresAndProducts = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [profilesRes, productsRes, categoriesRes] = await Promise.allSettled([
                supabase
                    .from('profiles')
                    .select('id, full_name, username, business_name, avatar_url, role, phone, created_at')
                    .or('role.eq.vendor,role.eq.seller,business_name.not.is.null')
                    .limit(50),
                supabase
                    .from('products')
                    .select('id, name, description, price, compare_at_price, image_url, images, category, rating, reviews, stock, total_sales, is_active, status, vendor_id, created_at')
                    .eq('status', 'approved')
                    .order('created_at', { ascending: false })
                    .limit(100),
                supabase
                    .from('categories')
                    .select('id, name, slug, icon, is_active')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true })
            ]);

            const realProducts = (productsRes.status === 'fulfilled' && productsRes.value?.data) ? productsRes.value.data : [];
            const realCategories = (categoriesRes.status === 'fulfilled' && categoriesRes.value?.data) ? categoriesRes.value.data : [];
            setCategories(realCategories);
            setPopularProducts(realProducts);

            // Official Flagship Store (Always Verified, Active, and Houses Flagship Goods)
            const officialStoreProducts = realProducts.filter(p => !p.vendor_id || p.vendor_id === 'official-abumafhal');
            const officialStore = {
                id: 'official-abumafhal',
                name: 'Abu Mafhal Official Store',
                category: 'Official Mall & Flagship Store',
                rating: 5.0,
                reviews: '3.8K',
                baseFollowers: 1250,
                products: officialStoreProducts.length > 0 ? officialStoreProducts : realProducts,
                productsCount: officialStoreProducts.length > 0 ? officialStoreProducts.length : realProducts.length,
                logo: null,
                banner: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=900&auto=format&fit=crop',
                isVerified: true,
                isOfficial: true,
                phone: '2349021486162',
                address: 'Main Commercial Plaza, Gashua, Yobe State, Nigeria',
                bio: 'The official verified flagship mall of Abu Mafhal Marketplace. Genuine brand warranty, authentic products, and 100% buyer protection across Nigeria.',
                memberSince: '2023'
            };

            const vendorProfiles = (profilesRes.status === 'fulfilled' && profilesRes.value?.data) ? profilesRes.value.data : [];
            const mappedVendors = vendorProfiles.map(vp => {
                const storeProds = realProducts.filter(p => p.vendor_id === vp.id);
                const year = vp.created_at ? new Date(vp.created_at).getFullYear() : '2024';
                return {
                    id: vp.id,
                    name: vp.business_name || vp.full_name || vp.username || 'Verified Merchant',
                    category: vp.role === 'vendor' ? 'Verified Seller' : 'Registered Merchant',
                    rating: 4.9,
                    reviews: '120+',
                    baseFollowers: 140,
                    products: storeProds,
                    productsCount: storeProds.length,
                    logo: vp.avatar_url || null,
                    banner: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=900&auto=format&fit=crop',
                    isVerified: true,
                    isOfficial: false,
                    phone: vp.phone || '2349021486162',
                    address: 'Verified Merchant Center, Nigeria',
                    bio: `Authentic merchant verified on Abu Mafhal Marketplace since ${year}. Providing top quality goods with trusted direct delivery.`,
                    memberSince: year
                };
            });

            setStores([officialStore, ...mappedVendors]);
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
        const phone = store.phone ? store.phone.replace(/[^0-9]/g, '') : '2349021486162';
        const msg = encodeURIComponent(`Hello ${store.name}, I am contacting you directly from Abu Mafhal Marketplace regarding your products.`);
        Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {
            Alert.alert('Contact Store', `Store Phone: ${store.phone || '+234 902 148 6162'}`);
        });
    };

    const handleCallStore = (store) => {
        const phone = store.phone ? store.phone.replace(/[^0-9]/g, '') : '2349021486162';
        Linking.openURL(`tel:+${phone}`).catch(() => {
            Alert.alert('Phone Number', `+${phone}`);
        });
    };

    const handleShareStore = async (store) => {
        try {
            await Share.share({
                message: `Check out ${store.name} on Abu Mafhal Marketplace! High quality goods with fast delivery: https://abumafhal.com/store/${store.id}`,
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

    // Filter stores & products by search query
    const filteredStores = stores.filter(st => {
        const matchSearch = st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            st.category.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchSearch) return false;

        if (activeSubTab === 'top_rated') return Number(st.rating) >= 4.9;
        if (activeSubTab === 'official') return st.isOfficial;
        return true;
    });

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
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            {/* Top Modern Header */}
            <View style={s.header}>
                <View style={s.headerTop}>
                    <View style={s.brandGroup}>
                        <Image source={AM_LOGO} style={s.logo} />
                        <View>
                            <Text style={s.brandTitle}>
                                ABU <Text style={s.brandTitleAccent}>MAFHAL</Text>
                            </Text>
                            <Text style={s.brandSubtitle}>
                                Verified Stores Directory
                            </Text>
                        </View>
                    </View>

                    <View style={s.actionRow}>
                        <TouchableOpacity
                            onPress={() => onGoToShop && onGoToShop('')}
                            style={s.shopPillBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="bag-handle" size={13} color="#0284C7" />
                            <Text style={s.shopPillTxt}>Shop</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onGoToNotifications} style={s.iconBtn}>
                            <Ionicons name="notifications-outline" size={23} color="#0F172A" />
                            <View style={s.notifBadge} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onGoToCart} style={s.iconBtn}>
                            <Ionicons name="cart-outline" size={24} color="#0F172A" />
                            {cartCount > 0 && (
                                <View style={s.cartBadge}>
                                    <Text style={s.cartBadgeTxt}>{cartCount > 99 ? '99+' : cartCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Mobile Search Input */}
                <View style={s.searchBar}>
                    <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search verified stores, merchants or items..."
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

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 130 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0284C7']} />
                }
            >
                {/* Hero Banner: Verified Stores */}
                <View style={s.heroWrapper}>
                    <View style={s.heroCard}>
                        <View style={s.heroContent}>
                            <View style={s.verifiedPill}>
                                <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                                <Text style={s.verifiedPillTxt}>100% VERIFIED MERCHANTS</Text>
                            </View>
                            <Text style={s.heroTitle}>Authentic Marketplace Stores</Text>
                            <Text style={s.heroDesc}>
                                Buy directly from vetted Nigerian merchants with verified warranties and express delivery.
                            </Text>

                            <TouchableOpacity
                                style={s.heroBtn}
                                activeOpacity={0.85}
                                onPress={() => onGoToShop && onGoToShop('')}
                            >
                                <Text style={s.heroBtnTxt}>Explore All Products</Text>
                                <Ionicons name="arrow-forward" size={13} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=400&auto=format&fit=crop' }}
                            style={s.heroImg}
                        />
                    </View>
                </View>

                {/* Sub-tabs Row */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.subTabsScroll}
                >
                    {[
                        { key: 'all_stores', label: 'All Stores', icon: 'storefront-outline' },
                        { key: 'official', label: 'Official Mall', icon: 'ribbon-outline' },
                        { key: 'top_rated', label: 'Top Rated', icon: 'star-outline' },
                        { key: 'popular_products', label: 'Popular Products', icon: 'flame-outline' },
                        { key: 'categories', label: 'Categories', icon: 'grid-outline' },
                    ].map(tab => {
                        const active = activeSubTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setActiveSubTab(tab.key)}
                                style={[s.subTabBtn, active && s.subTabBtnActive]}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={tab.icon}
                                    size={15}
                                    color={active ? '#0284C7' : '#64748B'}
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
                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#0284C7" />
                        <Text style={{ color: '#64748B', fontSize: 12, marginTop: 10, fontWeight: '600' }}>
                            Loading live stores and verified products...
                        </Text>
                    </View>
                )}

                {/* ════ STORES SECTION ════ */}
                {(!loading && activeSubTab !== 'popular_products') && (
                    <View style={{ marginTop: 8 }}>
                        <View style={s.sectionHead}>
                            <View>
                                <Text style={s.sectionTitle}>
                                    {activeSubTab === 'top_rated' ? 'Highest Rated Stores' : activeSubTab === 'official' ? 'Official Flagship Mall' : 'Verified Stores & Merchants'}
                                </Text>
                                <Text style={s.sectionSub}>
                                    {filteredStores.length} registered and authentic merchant{filteredStores.length !== 1 ? 's' : ''}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => onGoToShop && onGoToShop('')}
                                style={s.seeAllRow}
                            >
                                <Text style={s.seeAllTxt}>All Items</Text>
                                <Ionicons name="chevron-forward" size={13} color="#0284C7" />
                            </TouchableOpacity>
                        </View>

                        {/* Stores List */}
                        <View style={s.storesGrid}>
                            {filteredStores.map(store => {
                                const isFollowed = !!followedStores[store.id];
                                const currentFollowers = (store.baseFollowers || 100) + (isFollowed ? 1 : 0);

                                return (
                                    <View key={store.id} style={s.storeCard}>
                                        <TouchableOpacity
                                            activeOpacity={0.92}
                                            onPress={() => setSelectedStore(store)}
                                            style={s.storeTopRow}
                                        >
                                            <View style={s.avatarBox}>
                                                {store.logo ? (
                                                    <Image source={{ uri: store.logo }} style={s.storeAvatar} />
                                                ) : store.isOfficial ? (
                                                    <Image source={AM_LOGO} style={s.storeAvatar} resizeMode="contain" />
                                                ) : (
                                                    <View style={s.avatarPlaceholder}>
                                                        <Ionicons name="storefront" size={26} color="#0284C7" />
                                                    </View>
                                                )}

                                                {store.isVerified && (
                                                    <View style={s.verifiedIconBadge}>
                                                        <Ionicons name="checkmark-sharp" size={10} color="white" />
                                                    </View>
                                                )}
                                            </View>

                                            <View style={s.storeDetails}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                    <Text numberOfLines={1} style={s.storeName}>
                                                        {store.name}
                                                    </Text>
                                                    {store.isOfficial && (
                                                        <View style={s.officialPill}>
                                                            <Text style={s.officialPillTxt}>OFFICIAL</Text>
                                                        </View>
                                                    )}
                                                </View>

                                                <Text numberOfLines={1} style={s.storeCategory}>
                                                    {store.category}
                                                </Text>

                                                <View style={s.storeMetaRow}>
                                                    <View style={s.metaItem}>
                                                        <Ionicons name="star" size={12} color="#F59E0B" />
                                                        <Text style={s.metaTxtBold}>{store.rating}</Text>
                                                        <Text style={s.metaTxtDim}>({store.reviews})</Text>
                                                    </View>
                                                    <Text style={s.metaDot}>•</Text>
                                                    <View style={s.metaItem}>
                                                        <Ionicons name="cube-outline" size={12} color="#64748B" />
                                                        <Text style={s.metaTxtDim}>{store.productsCount} Items</Text>
                                                    </View>
                                                    <Text style={s.metaDot}>•</Text>
                                                    <View style={s.metaItem}>
                                                        <Ionicons name="people-outline" size={12} color="#64748B" />
                                                        <Text style={s.metaTxtDim}>{currentFollowers}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </TouchableOpacity>

                                        {/* Action Buttons */}
                                        <View style={s.storeActionRow}>
                                            <TouchableOpacity
                                                onPress={() => toggleFollow(store.id, store.name)}
                                                style={[s.btnFollow, isFollowed && s.btnFollowing]}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons
                                                    name={isFollowed ? "checkmark-circle" : "add"}
                                                    size={14}
                                                    color={isFollowed ? "#0284C7" : "#0F172A"}
                                                />
                                                <Text style={[s.btnFollowTxt, isFollowed && s.btnFollowingTxt]}>
                                                    {isFollowed ? 'Following' : 'Follow'}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => handleContactWhatsApp(store)}
                                                style={s.btnContact}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="logo-whatsapp" size={14} color="#10B981" />
                                                <Text style={s.btnContactTxt}>WhatsApp</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => setSelectedStore(store)}
                                                style={s.btnViewStore}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={s.btnViewStoreTxt}>View Store</Text>
                                                <Ionicons name="chevron-forward" size={12} color="white" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* ════ POPULAR PRODUCTS SECTION ════ */}
                {!loading && (
                    <View style={{ marginTop: 24 }}>
                        <View style={s.sectionHead}>
                            <View>
                                <Text style={s.sectionTitle}>Popular Products in Store</Text>
                                <Text style={s.sectionSub}>Authentic live products from verified sellers</Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => onGoToShop && onGoToShop('')}
                                style={s.seeAllRow}
                            >
                                <Text style={s.seeAllTxt}>See All</Text>
                                <Ionicons name="chevron-forward" size={13} color="#0284C7" />
                            </TouchableOpacity>
                        </View>

                        {filteredPopular.length === 0 ? (
                            <View style={s.emptyBox}>
                                <Ionicons name="bag-remove-outline" size={38} color="#94A3B8" />
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

                                                {/* Add to Cart Quick Button */}
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

                {/* ════ BECOME A VENDOR PROMO CARD ════ */}
                <View style={s.vendorBannerWrapper}>
                    <View style={s.vendorBannerCard}>
                        <View style={s.vendorBannerLeft}>
                            <View style={s.vendorBannerBadge}>
                                <Ionicons name="sparkles" size={12} color="#F59E0B" />
                                <Text style={s.vendorBannerBadgeTxt}>GROW YOUR BUSINESS</Text>
                            </View>
                            <Text style={s.vendorBannerTitle}>Buɗe Shagonka a Abu Mafhal</Text>
                            <Text style={s.vendorBannerSub}>
                                Register as a verified merchant today. Reach millions of active buyers across Nigeria with zero hassle.
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
                </View>

                {/* ════ CATEGORIES PILLS ════ */}
                {categories.length > 0 && (
                    <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
                        <Text style={s.sectionTitle}>Marketplace Departments</Text>
                        <Text style={s.sectionSub}>Shop items organized by verified departments</Text>

                        <View style={[s.catPillGrid, { marginTop: 12 }]}>
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={s.catPill}
                                    activeOpacity={0.8}
                                    onPress={() => onGoToShop && onGoToShop(cat.name)}
                                >
                                    <Ionicons name="pricetag-outline" size={13} color="#0284C7" />
                                    <Text style={s.catPillTxt}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* ══════════════════════════════════════════════════
                DEDICATED STORE DETAIL VIEW (MODAL)
            ══════════════════════════════════════════════════ */}
            <Modal
                visible={!!selectedStore}
                animationType="slide"
                onRequestClose={() => setSelectedStore(null)}
            >
                {selectedStore && (
                    <View style={s.modalContainer}>
                        <StatusBar barStyle="light-content" backgroundColor="#0A192F" />

                        {/* Top Sticky Bar */}
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

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                            {/* Store Hero Profile */}
                            <View style={s.storeHeroBox}>
                                <Image
                                    source={{ uri: selectedStore.banner }}
                                    style={s.storeHeroBanner}
                                    resizeMode="cover"
                                />
                                <View style={s.storeHeroOverlay} />

                                <View style={s.storeHeroProfileRow}>
                                    <View style={s.storeHeroAvatarWrap}>
                                        {selectedStore.logo ? (
                                            <Image source={{ uri: selectedStore.logo }} style={s.storeHeroAvatar} />
                                        ) : selectedStore.isOfficial ? (
                                            <Image source={AM_LOGO} style={s.storeHeroAvatar} resizeMode="contain" />
                                        ) : (
                                            <View style={[s.storeHeroAvatar, { backgroundColor: '#0284C7', alignItems: 'center', justifyContent: 'center' }]}>
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
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={s.storeHeroName} numberOfLines={1}>{selectedStore.name}</Text>
                                            {selectedStore.isOfficial && (
                                                <View style={s.officialPill}>
                                                    <Text style={s.officialPillTxt}>OFFICIAL</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={s.storeHeroCategory}>{selectedStore.category}</Text>
                                        <Text style={s.storeHeroLocation}>
                                            <Ionicons name="location-outline" size={11} color="#94A3B8" /> {selectedStore.address}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Store Stats Strip */}
                            <View style={s.storeStatsCard}>
                                <View style={s.statBox}>
                                    <Text style={s.statVal}>{selectedStore.productsCount}</Text>
                                    <Text style={s.statLbl}>Products</Text>
                                </View>
                                <View style={s.statDivider} />
                                <View style={s.statBox}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                        <Ionicons name="star" size={14} color="#F59E0B" />
                                        <Text style={s.statVal}>{selectedStore.rating}</Text>
                                    </View>
                                    <Text style={s.statLbl}>{selectedStore.reviews} Reviews</Text>
                                </View>
                                <View style={s.statDivider} />
                                <View style={s.statBox}>
                                    <Text style={s.statVal}>
                                        {(selectedStore.baseFollowers || 100) + (followedStores[selectedStore.id] ? 1 : 0)}
                                    </Text>
                                    <Text style={s.statLbl}>Followers</Text>
                                </View>
                            </View>

                            {/* Store Action Buttons */}
                            <View style={s.storeDetailActionRow}>
                                <TouchableOpacity
                                    onPress={() => toggleFollow(selectedStore.id, selectedStore.name)}
                                    style={[s.storeDetailBtnFollow, followedStores[selectedStore.id] && s.storeDetailBtnFollowing]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={followedStores[selectedStore.id] ? "checkmark-circle" : "add"}
                                        size={16}
                                        color={followedStores[selectedStore.id] ? "#0284C7" : "white"}
                                    />
                                    <Text style={[s.storeDetailBtnFollowTxt, followedStores[selectedStore.id] && s.storeDetailBtnFollowingTxt]}>
                                        {followedStores[selectedStore.id] ? 'Following' : 'Follow Store'}
                                    </Text>
                                </TouchableOpacity>

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
                                    <Ionicons name="call" size={16} color="#0F172A" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleShareStore(selectedStore)}
                                    style={s.storeDetailBtnCall}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="share-social-outline" size={16} color="#0F172A" />
                                </TouchableOpacity>
                            </View>

                            {/* Store Bio Card */}
                            <View style={s.storeBioCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <Ionicons name="information-circle-outline" size={16} color="#0284C7" />
                                    <Text style={s.storeBioTitle}>About This Store</Text>
                                </View>
                                <Text style={s.storeBioTxt}>{selectedStore.bio}</Text>
                            </View>

                            {/* Store Catalog Section */}
                            <View style={s.storeCatalogHeader}>
                                <Text style={s.storeCatalogTitle}>Store Catalog ({storeFilteredProducts.length})</Text>
                                <Text style={s.storeCatalogSub}>Authentic products sold directly by {selectedStore.name}</Text>
                            </View>

                            {/* Store Search & Category Pills */}
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

                            {storeCategories.length > 1 && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={s.storeCatScroll}
                                >
                                    {storeCategories.map(cat => (
                                        <TouchableOpacity
                                            key={cat}
                                            onPress={() => setSelectedStoreCategory(cat)}
                                            style={[s.storeCatPill, selectedStoreCategory === cat && s.storeCatPillActive]}
                                        >
                                            <Text style={[s.storeCatPillTxt, selectedStoreCategory === cat && s.storeCatPillTxtActive]}>
                                                {cat}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}

                            {/* Store Products Grid */}
                            {storeFilteredProducts.length === 0 ? (
                                <View style={s.storeEmptyBox}>
                                    <Ionicons name="bag-handle-outline" size={48} color="#94A3B8" />
                                    <Text style={s.storeEmptyTitle}>No Products Found</Text>
                                    <Text style={s.storeEmptySub}>
                                        {storeSearchQuery ? 'No products match your search in this store.' : 'This merchant currently has no approved products listed. Contact them directly on WhatsApp for requests.'}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleContactWhatsApp(selectedStore)}
                                        style={s.storeEmptyContactBtn}
                                    >
                                        <Ionicons name="logo-whatsapp" size={16} color="white" />
                                        <Text style={s.storeEmptyContactBtnTxt}>Chat With Seller</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={s.storeProductsGrid}>
                                    {storeFilteredProducts.map(prod => {
                                        const hasDiscount = Number(prod.compare_at_price) > Number(prod.price);
                                        const discountPercent = hasDiscount
                                            ? Math.round(((Number(prod.compare_at_price) - Number(prod.price)) / Number(prod.compare_at_price)) * 100)
                                            : null;

                                        return (
                                            <TouchableOpacity
                                                key={prod.id}
                                                activeOpacity={0.88}
                                                onPress={() => {
                                                    setSelectedStore(null);
                                                    onProductClick && onProductClick(prod);
                                                }}
                                                style={s.storeGridCard}
                                            >
                                                <View style={s.storeGridImgBox}>
                                                    <Image
                                                        source={{ uri: getProductImage(prod) }}
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
                                                        {prod.category || 'General'}
                                                    </Text>
                                                    <Text style={s.storeGridName} numberOfLines={2}>
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
                                </View>
                            )}
                        </ScrollView>
                    </View>
                )}
            </Modal>

            {/* ════ FLOATING TOAST NOTIFICATION ════ */}
            {toastMessage.length > 0 && (
                <Animated.View style={[s.toastContainer, { opacity: toastAnim }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
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
        backgroundColor: 'white',
        paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 24) + 10,
        paddingBottom: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        zIndex: 10
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
    },
    brandGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9
    },
    logo: {
        width: 32,
        height: 32,
        borderRadius: 8
    },
    brandTitle: {
        fontSize: 14.5,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.5
    },
    brandTitleAccent: {
        color: '#0284C7'
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
        color: '#0284C7'
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
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 42
    },
    searchInput: {
        flex: 1,
        fontSize: 12.5,
        color: '#0F172A',
        fontWeight: '600',
        padding: 0
    },
    heroWrapper: {
        paddingHorizontal: 16,
        paddingTop: 14
    },
    heroCard: {
        backgroundColor: '#0A192F',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative'
    },
    heroContent: {
        flex: 1,
        zIndex: 2
    },
    verifiedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)'
    },
    verifiedPillTxt: {
        color: '#10B981',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    heroTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: '900',
        lineHeight: 20,
        marginBottom: 4
    },
    heroDesc: {
        color: '#94A3B8',
        fontSize: 10.5,
        lineHeight: 14,
        marginBottom: 12
    },
    heroBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'white',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
        alignSelf: 'flex-start'
    },
    heroBtnTxt: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '900'
    },
    heroImg: {
        width: 100,
        height: 100,
        borderRadius: 14,
        opacity: 0.85
    },
    subTabsScroll: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 8
    },
    subTabBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'white',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    subTabBtnActive: {
        backgroundColor: '#E0F2FE',
        borderColor: '#0284C7'
    },
    subTabTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B'
    },
    subTabTxtActive: {
        color: '#0284C7',
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
        gap: 2
    },
    seeAllTxt: {
        fontSize: 12,
        color: '#0284C7',
        fontWeight: '800'
    },
    storesGrid: {
        paddingHorizontal: 16,
        gap: 12
    },
    storeCard: {
        backgroundColor: 'white',
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2
    },
    storeTopRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12
    },
    avatarBox: {
        position: 'relative'
    },
    storeAvatar: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#F8FAFC'
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center'
    },
    verifiedIconBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#0284C7',
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'white'
    },
    verifiedIconBadgeLarge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#0284C7',
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white'
    },
    storeDetails: {
        flex: 1,
        justifyContent: 'center'
    },
    storeName: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A'
    },
    officialPill: {
        backgroundColor: '#F59E0B',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5
    },
    officialPillTxt: {
        color: 'white',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    storeCategory: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 1,
        marginBottom: 3
    },
    storeMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3
    },
    metaTxtBold: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0F172A'
    },
    metaTxtDim: {
        fontSize: 10.5,
        color: '#64748B',
        fontWeight: '600'
    },
    metaDot: {
        color: '#CBD5E1',
        fontSize: 11
    },
    storeActionRow: {
        flexDirection: 'row',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
        paddingTop: 10
    },
    btnFollow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#F1F5F9',
        paddingVertical: 8,
        borderRadius: 10
    },
    btnFollowing: {
        backgroundColor: '#E0F2FE'
    },
    btnFollowTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0F172A'
    },
    btnFollowingTxt: {
        color: '#0284C7'
    },
    btnContact: {
        flex: 1.1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        paddingVertical: 8,
        borderRadius: 10
    },
    btnContactTxt: {
        fontSize: 11,
        fontWeight: '900',
        color: '#059669'
    },
    btnViewStore: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#0A192F',
        paddingVertical: 8,
        borderRadius: 10
    },
    btnViewStoreTxt: {
        color: 'white',
        fontSize: 11,
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
        color: '#0284C7',
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
        color: '#0284C7'
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
        backgroundColor: '#0A192F',
        paddingVertical: 5,
        borderRadius: 8
    },
    quickCartBtnTxt: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900'
    },
    vendorBannerWrapper: {
        paddingHorizontal: 16,
        marginTop: 24
    },
    vendorBannerCard: {
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: '#1E293B',
        position: 'relative',
        overflow: 'hidden'
    },
    vendorBannerLeft: {
        zIndex: 2
    },
    vendorBannerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 7,
        alignSelf: 'flex-start',
        marginBottom: 8
    },
    vendorBannerBadgeTxt: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    vendorBannerTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 4
    },
    vendorBannerSub: {
        color: '#94A3B8',
        fontSize: 11,
        lineHeight: 16,
        marginBottom: 14
    },
    vendorBannerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'white',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        alignSelf: 'flex-start'
    },
    vendorBannerBtnTxt: {
        color: '#0F172A',
        fontSize: 11.5,
        fontWeight: '900'
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
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12
    },
    catPillTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155'
    },
    emptyBox: {
        paddingVertical: 24,
        alignItems: 'center',
        gap: 6
    },
    emptyTxt: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600'
    },

    // ── Dedicated Store Detail View Modal ─────────────────────────
    modalContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    modalHeader: {
        backgroundColor: '#0A192F',
        paddingTop: Platform.OS === 'ios' ? 48 : (StatusBar.currentHeight || 24) + 6,
        paddingBottom: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
    },
    modalBackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    modalBackTxt: {
        color: 'white',
        fontSize: 13,
        fontWeight: '800'
    },
    modalHeaderTitle: {
        flex: 1,
        textAlign: 'center',
        color: 'white',
        fontSize: 13.5,
        fontWeight: '900',
        marginHorizontal: 10
    },
    modalCartBtn: {
        padding: 4,
        position: 'relative'
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
        position: 'relative',
        backgroundColor: '#0A192F',
        paddingBottom: 16
    },
    storeHeroBanner: {
        width: '100%',
        height: 120,
        opacity: 0.6
    },
    storeHeroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 25, 47, 0.45)'
    },
    storeHeroProfileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: -30,
        gap: 12
    },
    storeHeroAvatarWrap: {
        position: 'relative'
    },
    storeHeroAvatar: {
        width: 68,
        height: 68,
        borderRadius: 20,
        backgroundColor: 'white',
        borderWidth: 3,
        borderColor: 'white'
    },
    storeHeroNameCol: {
        flex: 1,
        paddingTop: 24
    },
    storeHeroName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '900'
    },
    storeHeroCategory: {
        color: '#38BDF8',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 1
    },
    storeHeroLocation: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '500',
        marginTop: 2
    },
    storeStatsCard: {
        backgroundColor: 'white',
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 2
    },
    statBox: {
        alignItems: 'center'
    },
    statVal: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A'
    },
    statLbl: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 2
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
        marginHorizontal: 16,
        marginTop: 12
    },
    storeDetailBtnFollow: {
        flex: 1.4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#0284C7',
        paddingVertical: 10,
        borderRadius: 12
    },
    storeDetailBtnFollowing: {
        backgroundColor: '#E0F2FE'
    },
    storeDetailBtnFollowTxt: {
        color: 'white',
        fontSize: 12,
        fontWeight: '900'
    },
    storeDetailBtnFollowingTxt: {
        color: '#0284C7'
    },
    storeDetailBtnWhatsApp: {
        flex: 1.4,
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
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    storeBioCard: {
        backgroundColor: 'white',
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    storeBioTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A'
    },
    storeBioTxt: {
        fontSize: 11,
        color: '#475569',
        lineHeight: 16
    },
    storeCatalogHeader: {
        paddingHorizontal: 16,
        marginTop: 20,
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
        marginTop: 1
    },
    storeSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        marginHorizontal: 16,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginTop: 8
    },
    storeSearchInput: {
        flex: 1,
        fontSize: 12,
        color: '#0F172A',
        padding: 0
    },
    storeCatScroll: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 6
    },
    storeCatPill: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10
    },
    storeCatPillActive: {
        backgroundColor: '#0284C7',
        borderColor: '#0284C7'
    },
    storeCatPillTxt: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '700'
    },
    storeCatPillTxtActive: {
        color: 'white',
        fontWeight: '900'
    },
    storeProductsGrid: {
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
        gap: 8
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
    storeEmptyContactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#10B981',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        marginTop: 8
    },
    storeEmptyContactBtnTxt: {
        color: 'white',
        fontSize: 11.5,
        fontWeight: '900'
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
    }
});
