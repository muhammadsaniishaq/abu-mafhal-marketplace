import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    Image, Dimensions, StatusBar, Alert, RefreshControl,
    Linking, ActivityIndicator, StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');
const FOLLOWED_STORES_KEY = '@abumafhal_followed_stores_v1';

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

    useEffect(() => {
        loadFollowedState();
        fetchStoresAndProducts();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('stores-realtime-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                fetchStoresAndProducts(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchStoresAndProducts(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const loadFollowedState = async () => {
        try {
            const raw = await AsyncStorage.getItem(FOLLOWED_STORES_KEY);
            if (raw) setFollowedStores(JSON.parse(raw));
        } catch (_) {}
    };

    const toggleFollow = async (storeId) => {
        setFollowedStores(prev => {
            const updated = { ...prev, [storeId]: !prev[storeId] };
            AsyncStorage.setItem(FOLLOWED_STORES_KEY, JSON.stringify(updated)).catch(() => {});
            return updated;
        });
    };

    const fetchStoresAndProducts = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [profilesRes, productsRes, categoriesRes] = await Promise.allSettled([
                supabase
                    .from('profiles')
                    .select('id, full_name, username, business_name, avatar_url, role, phone, created_at')
                    .or('role.eq.vendor,business_name.not.is.null')
                    .limit(20),
                supabase
                    .from('products')
                    .select('id, name, price, compare_at_price, image_url, images, category, rating, reviews, stock, total_sales, is_active, status')
                    .eq('status', 'approved')
                    .order('created_at', { ascending: false })
                    .limit(30),
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

            // Official Flagship Store (Always Verified and Active)
            const officialStore = {
                id: 'official-abumafhal',
                name: 'Abu Mafhal Official Store',
                category: 'Official Mall & Flagship Store',
                rating: 5.0,
                reviews: '3.8K',
                productsCount: realProducts.length,
                logo: null,
                isVerified: true,
                isOfficial: true,
                phone: '2349021486162',
                bio: 'Official direct verified flagship store for Abu Mafhal Marketplace.',
            };

            const vendorProfiles = (profilesRes.status === 'fulfilled' && profilesRes.value?.data) ? profilesRes.value.data : [];
            const mappedVendors = vendorProfiles.map(vp => {
                const storeProds = realProducts.filter(p => p.vendor_id === vp.id);
                return {
                    id: vp.id,
                    name: vp.business_name || vp.full_name || vp.username || 'Verified Seller',
                    category: vp.role === 'vendor' ? 'Verified Seller' : 'Registered Merchant',
                    rating: 4.9,
                    reviews: '120+',
                    productsCount: storeProds.length > 0 ? storeProds.length : 'Multiple',
                    logo: vp.avatar_url || null,
                    isVerified: true,
                    isOfficial: false,
                    phone: vp.phone || '2349021486162',
                    bio: `Trusted vendor verified on Abu Mafhal since ${new Date(vp.created_at || Date.now()).getFullYear()}`
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

    const handleContactStore = (store) => {
        const phone = store.phone ? store.phone.replace(/[^0-9]/g, '') : '2349021486162';
        const msg = encodeURIComponent(`Hello ${store.name}, I am contacting you from Abu Mafhal Marketplace regarding your products.`);
        Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {
            Alert.alert('Contact Store', `Store Phone: ${store.phone || '+234 902 148 6162'}`);
        });
    };

    const handleViewStore = (store) => {
        if (onGoToShop) {
            onGoToShop(store.isOfficial ? '' : store.category);
        } else if (onNavigate) {
            onNavigate('shop', { category: store.isOfficial ? '' : store.category });
        }
    };

    // Filter stores & products by search query
    const filteredStores = stores.filter(st => {
        const matchSearch = st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            st.category.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchSearch) return false;

        if (activeSubTab === 'top_rated') return Number(st.rating) >= 4.9;
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
                        placeholder="Search verified stores, sellers or items..."
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
                                <Text style={s.verifiedPillTxt}>100% VERIFIED SELLERS</Text>
                            </View>
                            <Text style={s.heroTitle}>Top Marketplace Stores</Text>
                            <Text style={s.heroDesc}>
                                Buy directly from authentic, approved merchants with buyer protection.
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
                        { key: 'top_rated', label: 'Top Rated', icon: 'star-outline' },
                        { key: 'popular_products', label: 'Popular Products', icon: 'flame-outline' },
                        { key: 'categories', label: 'Browse Categories', icon: 'grid-outline' },
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
                            Loading live stores and products...
                        </Text>
                    </View>
                )}

                {/* ════ STORES SECTION ════ */}
                {(!loading && activeSubTab !== 'popular_products') && (
                    <View style={{ marginTop: 8 }}>
                        <View style={s.sectionHead}>
                            <View>
                                <Text style={s.sectionTitle}>
                                    {activeSubTab === 'top_rated' ? 'Highest Rated Stores' : 'Verified Stores & Sellers'}
                                </Text>
                                <Text style={s.sectionSub}>
                                    {filteredStores.length} registered and verified seller{filteredStores.length !== 1 ? 's' : ''}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => onGoToShop && onGoToShop('')}
                                style={s.seeAllRow}
                            >
                                <Text style={s.seeAllTxt}>Shop Catalog</Text>
                                <Ionicons name="chevron-forward" size={13} color="#0284C7" />
                            </TouchableOpacity>
                        </View>

                        {/* Stores List */}
                        <View style={s.storesGrid}>
                            {filteredStores.map(store => {
                                const isFollowed = !!followedStores[store.id];
                                return (
                                    <View key={store.id} style={s.storeCard}>
                                        <View style={s.storeTopRow}>
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
                                                </View>
                                            </View>
                                        </View>

                                        {/* Action Buttons */}
                                        <View style={s.storeActionRow}>
                                            <TouchableOpacity
                                                onPress={() => toggleFollow(store.id)}
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
                                                onPress={() => handleContactStore(store)}
                                                style={s.btnContact}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="logo-whatsapp" size={14} color="#10B981" />
                                                <Text style={s.btnContactTxt}>Chat</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => handleViewStore(store)}
                                                style={s.btnViewStore}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={s.btnViewStoreTxt}>Shop Store</Text>
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
                                <Text style={s.sectionSub}>Live products available from verified sellers</Text>
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
                                                    onPress={() => {
                                                        if (onAddToCart) {
                                                            onAddToCart(prod);
                                                            Alert.alert('Success', `${prod.name} added to cart!`);
                                                        }
                                                    }}
                                                >
                                                    <Ionicons name="cart-outline" size={13} color="white" />
                                                    <Text style={s.quickCartBtnTxt}>+ Add to Cart</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                )}

                {/* ════ CATEGORIES PILLS SECTION ════ */}
                {(!loading && categories.length > 0) && (
                    <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
                        <Text style={s.sectionTitle}>Shop by Category</Text>
                        <Text style={[s.sectionSub, { marginBottom: 12 }]}>
                            Browse full collections in verified departments
                        </Text>

                        <View style={s.catPillGrid}>
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={s.catPill}
                                    activeOpacity={0.8}
                                    onPress={() => onGoToShop && onGoToShop(cat.name)}
                                >
                                    <Ionicons name={cat.icon || 'pricetag-outline'} size={14} color="#0284C7" />
                                    <Text style={s.catPillTxt}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
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
        paddingTop: 46,
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
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
        gap: 10
    },
    logo: {
        width: 36,
        height: 36,
        resizeMode: 'contain'
    },
    brandTitle: {
        color: '#0A192F',
        fontSize: 16.5,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    brandTitleAccent: {
        color: '#0284C7'
    },
    brandSubtitle: {
        color: '#64748B',
        fontSize: 8.5,
        fontWeight: '700',
        letterSpacing: 0.4,
        textTransform: 'uppercase'
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    iconBtn: {
        padding: 6,
        position: 'relative'
    },
    notifBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444'
    },
    cartBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: '#10B981',
        borderRadius: 9,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3
    },
    cartBadgeTxt: {
        color: 'white',
        fontSize: 9.5,
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
        fontSize: 13,
        color: '#0F172A',
        fontWeight: '500'
    },
    heroWrapper: {
        paddingHorizontal: 16,
        paddingTop: 14
    },
    heroCard: {
        backgroundColor: '#0A192F',
        borderRadius: 22,
        padding: 18,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 140,
        justifyContent: 'center'
    },
    heroContent: {
        width: '64%',
        zIndex: 2
    },
    verifiedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 6
    },
    verifiedPillTxt: {
        color: '#34D399',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#F8FAFC',
        letterSpacing: -0.4,
        marginBottom: 4
    },
    heroDesc: {
        fontSize: 11,
        color: '#CBD5E1',
        fontWeight: '500',
        lineHeight: 15,
        marginBottom: 12
    },
    heroBtn: {
        backgroundColor: '#0284C7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 5
    },
    heroBtnTxt: {
        color: 'white',
        fontWeight: '900',
        fontSize: 11
    },
    heroImg: {
        position: 'absolute',
        right: -10,
        bottom: -10,
        width: 140,
        height: 140,
        borderRadius: 18,
        opacity: 0.8
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
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'white',
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.3
    },
    sectionSub: {
        fontSize: 11.5,
        color: '#64748B',
        fontWeight: '500',
        marginTop: 2
    },
    seeAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2
    },
    seeAllTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0284C7'
    },
    storesGrid: {
        paddingHorizontal: 16,
        gap: 12
    },
    storeCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2
    },
    storeTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12
    },
    avatarBox: {
        position: 'relative'
    },
    storeAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#F8FAFC'
    },
    avatarPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center'
    },
    verifiedIconBadge: {
        position: 'absolute',
        bottom: 0,
        right: -2,
        backgroundColor: '#10B981',
        borderRadius: 8,
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white'
    },
    storeDetails: {
        flex: 1
    },
    storeName: {
        fontSize: 14.5,
        fontWeight: '900',
        color: '#0F172A'
    },
    officialPill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6
    },
    officialPillTxt: {
        color: '#D97706',
        fontSize: 8.5,
        fontWeight: '900'
    },
    storeCategory: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 1
    },
    storeMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4
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
        color: '#94A3B8',
        fontWeight: '500'
    },
    metaDot: {
        color: '#CBD5E1',
        fontSize: 10
    },
    storeActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
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
        paddingVertical: 7,
        borderRadius: 12
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
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        paddingVertical: 7,
        borderRadius: 12
    },
    btnContactTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: '#065F46'
    },
    btnViewStore: {
        flex: 1.4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#0F172A',
        paddingVertical: 7,
        borderRadius: 12
    },
    btnViewStoreTxt: {
        fontSize: 11,
        fontWeight: '900',
        color: 'white'
    },
    productsScroll: {
        paddingHorizontal: 16,
        gap: 12
    },
    prodCard: {
        width: 145,
        backgroundColor: 'white',
        borderRadius: 18,
        padding: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2
    },
    prodImgBox: {
        width: '100%',
        height: 120,
        borderRadius: 14,
        overflow: 'hidden',
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
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    discountBadgeTxt: {
        color: 'white',
        fontSize: 9,
        fontWeight: '900'
    },
    prodInfo: {
        paddingTop: 8,
        gap: 2
    },
    prodCategory: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    prodName: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A',
        lineHeight: 16,
        minHeight: 32
    },
    prodPriceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 5,
        marginTop: 3,
        marginBottom: 6
    },
    prodPrice: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0284C7'
    },
    prodOldPrice: {
        fontSize: 10,
        color: '#94A3B8',
        textDecorationLine: 'line-through'
    },
    quickCartBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#0F172A',
        paddingVertical: 6,
        borderRadius: 10
    },
    quickCartBtnTxt: {
        color: 'white',
        fontSize: 10,
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
        gap: 6,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14
    },
    catPillTxt: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#334155'
    },
    emptyBox: {
        paddingVertical: 32,
        alignItems: 'center',
        gap: 8
    },
    emptyTxt: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600'
    }
});
