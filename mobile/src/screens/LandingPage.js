import React, { useRef, useState, useEffect } from 'react';
import {
    View, Text, Image, TouchableOpacity, ScrollView, Dimensions,
    Platform, StatusBar, StyleSheet, TextInput, RefreshControl,
    Animated, Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../context/AppSettingsContext';
import { supabase } from '../lib/supabase';
import { CountdownTimer } from '../components/CountdownTimer';

const { width } = Dimensions.get('window');

const AM_LOGO = require('../../assets/am_logo.png');
const HERO_MOCKUP = require('../../assets/hero_mockup.png');

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

// Trust Strip Items
const TRUST_ITEMS = [
    { icon: 'shield-checkmark', label: '100% Escrow Vault', color: '#10B981', desc: 'Kuɗi yana amana har a karɓi kaya' },
    { icon: 'airplane', label: 'Priority Cargo', color: '#3B82F6', desc: 'Isar da sako cikin sauri' },
    { icon: 'lock-closed', label: '256-Bit SSL Safe', color: '#D9A73A', desc: 'Tsaron babban banki' },
    { icon: 'headset', label: '24/7 Live Support', color: '#8B5CF6', desc: 'Taimako a kowane lokaci' },
];

// Why Choose Us Items
const WHY_CHOOSE_US = [
    {
        id: 1,
        icon: 'shield-checkmark',
        title: '100% Escrow Protection',
        desc: 'Kuɗin sayayya na zaune a amana. Ba za a taɓa sakin kuɗi ga mai sayarwa ba sai mai saye ya gamsu.',
        color: '#10B981',
        bgColor: '#ECFDF5'
    },
    {
        id: 2,
        icon: 'card-outline',
        title: 'Bank-Grade Payment Security',
        desc: 'Hadin gwiwa da manyan hanyoyin biyan kuɗi masu lasisin CBN (Paystack, Flutterwave, Monnify).',
        color: '#D9A73A',
        bgColor: '#FEF3C7'
    },
    {
        id: 3,
        icon: 'checkmark-circle-outline',
        title: 'Tantantattun Masu Sayarwa',
        desc: 'Dukkan masu sayarwa an tantance su da lambar rajista ta CAC ko lambar zama ɗan ƙasa ta NIN.',
        color: '#3B82F6',
        bgColor: '#EFF6FF'
    },
    {
        id: 4,
        icon: 'refresh-circle-outline',
        title: 'Garantin Mayar da Kuɗi',
        desc: 'Idan kaya bai zo daidai yadda kake buƙata ba, ana mayar da kuɗin ka cikin gaggawa ba tare da bata lokaci ba.',
        color: '#EF4444',
        bgColor: '#FEF2F2'
    },
    {
        id: 5,
        icon: 'airplane-outline',
        title: 'Sufuri Cikin Sauri',
        desc: 'Sufuri na musamman da bibiyar sako (live tracking) kai tsaye a cikin manhaja har ƙofar gida.',
        color: '#8B5CF6',
        bgColor: '#F5F3FF'
    },
];

// Fallback Popular Products
const POPULAR_FALLBACKS = [
    {
        id: 'pop-1',
        name: 'iPhone 15 Pro Max 256GB',
        price: 1250000,
        compare_at_price: 1470000,
        discount: 15,
        rating: 4.9,
        reviews_count: 142,
        category: 'Phones & Tablets',
        images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400']
    },
    {
        id: 'pop-2',
        name: 'Apple Watch Series 9 GPS',
        price: 390000,
        compare_at_price: 450000,
        discount: 20,
        rating: 4.8,
        reviews_count: 98,
        category: 'Electronics',
        images: ['https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=400']
    },
    {
        id: 'pop-3',
        name: 'Nike Air Jordan 1 Retro',
        price: 85000,
        compare_at_price: 95000,
        discount: 10,
        rating: 4.7,
        reviews_count: 76,
        category: 'Fashion & Apparel',
        images: ['https://images.unsplash.com/photo-1552346154-21d32810aba3?w=400']
    },
    {
        id: 'pop-4',
        name: 'Dior Sauvage Eau De Parfum',
        price: 78000,
        compare_at_price: 95000,
        discount: 18,
        rating: 4.9,
        reviews_count: 65,
        category: 'Beauty & Health',
        images: ['https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=400']
    }
];

// Fallback Testimonials
const TESTIMONIALS_FALLBACK = [
    {
        id: 't-1',
        quote: "Tsarin Escrow na Abu Mafhal shine ya bani kwarin gwiwar siya a yanar gizo. Kudina basu taba tafiya ba tare da na karbi kaya na ba.",
        name: "Ibrahim Sani",
        role: "Tabbataccen Mai Saye (Kano)",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        rating: 5,
        is_verified: true
    },
    {
        id: 't-2',
        quote: "Tun lokacin da na yi rajistar shagona a Abu Mafhal, samun kwastomomi ya zama mai sauki sosai kuma biyan kudi na zuwa cikin amana.",
        name: "Amina Yusuf",
        role: "Tantantacciyar Mai Sayarwa (Abuja)",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        rating: 5,
        is_verified: true
    },
    {
        id: 't-3',
        quote: "Na yi odar waya daga Legas zuwa Kaduna, cikin kwanaki 2 ta iso. Kayan ya zo lafiya kuma komai ya tafi daidai.",
        name: "Usman Bello",
        role: "Tabbataccen Mai Saye (Kaduna)",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
        rating: 5,
        is_verified: true
    }
];

// Default categories
const DEFAULT_CATEGORIES = [
    { id: 'cat-phones', name: 'Phones & Tablets', icon: 'phone-portrait-outline' },
    { id: 'cat-fashion', name: 'Fashion & Apparel', icon: 'shirt-outline' },
    { id: 'cat-electronics', name: 'Electronics & Gadgets', icon: 'desktop-outline' },
    { id: 'cat-shoes', name: 'Shoes & Footwear', icon: 'footsteps-outline' },
    { id: 'cat-beauty', name: 'Beauty & Health', icon: 'sparkles-outline' },
    { id: 'cat-home', name: 'Home & Living', icon: 'home-outline' },
    { id: 'cat-digital', name: 'Digital Services', icon: 'code-slash-outline' },
];

// Animated Counter component
const AnimatedCounter = ({ target, suffix = '', duration = 1200 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let start = 0;
        const end = parseFloat(target);
        if (isNaN(end) || start === end) return;
        const steps = 30;
        const increment = end / steps;
        const stepTime = duration / steps;
        let currentStep = 0;
        const timer = setInterval(() => {
            currentStep += 1;
            const currentVal = currentStep * increment;
            setCount(end % 1 === 0 ? Math.round(currentVal) : parseFloat(currentVal.toFixed(1)));
            if (currentStep >= steps) {
                setCount(end);
                clearInterval(timer);
            }
        }, stepTime);
        return () => clearInterval(timer);
    }, [target]);

    return (
        <Text style={styles.statsNumber}>
            {count.toLocaleString()}
            {suffix}
        </Text>
    );
};

export const LandingPage = ({
    navigation,
    onEnterShop,
    cartCount = 0,
    cartLines = [],
    onAddToCart,
    addToCart,
    onLogin,
    user,
    onGoToProfile,
    onNavigate
}) => {
    const { settings } = useAppSettings();

    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
    const [popularProducts, setPopularProducts] = useState(POPULAR_FALLBACKS);
    const [flashSaleProducts, setFlashSaleProducts] = useState([]);
    const [testimonials, setTestimonials] = useState(TESTIMONIALS_FALLBACK);
    const [banners, setBanners] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [wishlist, setWishlist] = useState({});
    const [newsletterEmail, setNewsletterEmail] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: '' });

    const toastAnim = useRef(new Animated.Value(0)).current;

    const showToast = (message) => {
        setToast({ visible: true, message });
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2200),
            Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true })
        ]).start(() => setToast({ visible: false, message: '' }));
    };

    // Navigation safe helpers
    const handleEnterShop = (tab = 'home', params = {}) => {
        const routeParams = typeof params === 'string' ? { category: params } : params;
        if (typeof onEnterShop === 'function') {
            onEnterShop(tab, routeParams);
        } else if (navigation) {
            navigation.navigate('Main', { screen: tab, ...routeParams });
        }
    };

    const handleProductPress = (product) => {
        if (onNavigate) {
            onNavigate('ProductDetails', { product, id: product.id });
        } else if (navigation) {
            navigation.navigate('ProductDetails', { product, id: product.id });
        }
    };

    const handleSearchSubmit = () => {
        if (!searchQuery.trim()) {
            handleEnterShop('shop');
            return;
        }
        handleEnterShop('shop', { query: searchQuery.trim() });
    };

    const handleBecomeSeller = () => {
        if (!user) {
            if (onNavigate) {
                onNavigate('Auth', { redirectTo: 'VendorRegister' });
            } else if (onLogin) {
                onLogin();
            } else if (navigation) {
                navigation.navigate('Auth', { redirectTo: 'VendorRegister' });
            }
        } else {
            if (onNavigate) {
                onNavigate('VendorRegister');
            } else if (navigation) {
                navigation.navigate('VendorRegister');
            }
        }
    };

    const handleAddToCartPress = (product, e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        const addFn = onAddToCart || addToCart;
        if (typeof addFn === 'function') {
            addFn(product);
            showToast(`An ƙara "${product.name || 'kayan'}" a kwandon sayayya! 🛒`);
        } else {
            handleEnterShop('shop');
        }
    };

    const toggleWishlist = async (id) => {
        const updated = { ...wishlist, [id]: !wishlist[id] };
        setWishlist(updated);
        try {
            await AsyncStorage.setItem('@abumafhal_wishlist', JSON.stringify(updated));
        } catch (_) {}
    };

    const handleNewsletterSubmit = () => {
        if (!newsletterEmail || !newsletterEmail.includes('@')) {
            Alert.alert('Sanarwa', 'Da fatan za a saka ingantaccen adireshin email.');
            return;
        }
        Alert.alert('Godiya', `Mun gode! An yi rajistar ${newsletterEmail} don samun rangwame da sabbin bayanai.`);
        setNewsletterEmail('');
    };

    // Load initial wishlist
    useEffect(() => {
        AsyncStorage.getItem('@abumafhal_wishlist').then(cached => {
            if (cached) {
                try { setWishlist(JSON.parse(cached)); } catch (_) {}
            }
        }).catch(() => {});
    }, []);

    // Load Live Supabase Data
    const loadData = async () => {
        try {
            const [catsRes, prodsRes, testRes, bansRes] = await Promise.allSettled([
                supabase
                    .from('categories')
                    .select('id, name, icon')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true })
                    .limit(10),
                supabase
                    .from('products')
                    .select('*')
                    .eq('is_active', true)
                    .order('rating', { ascending: false })
                    .limit(12),
                supabase
                    .from('testimonials')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true })
                    .limit(6),
                supabase
                    .from('banners')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true })
            ]);

            // Categories
            if (catsRes.status === 'fulfilled' && catsRes.value.data?.length > 0) {
                const dbCats = catsRes.value.data;
                const merged = [...DEFAULT_CATEGORIES];
                dbCats.forEach(dbC => {
                    if (!merged.some(c => c.name.toLowerCase() === dbC.name.toLowerCase())) {
                        merged.push({
                            id: `cat-${dbC.id}`,
                            name: dbC.name,
                            icon: dbC.icon || 'grid-outline'
                        });
                    }
                });
                setCategories(merged);
            }

            // Products
            if (prodsRes.status === 'fulfilled' && prodsRes.value.data?.length > 0) {
                const dbProds = prodsRes.value.data;
                setPopularProducts(dbProds);
                const deals = dbProds.filter(p => p.compare_at_price && p.compare_at_price > p.price);
                setFlashSaleProducts(deals.length > 0 ? deals : dbProds.slice(0, 4));
            }

            // Testimonials
            if (testRes.status === 'fulfilled' && testRes.value.data?.length > 0) {
                setTestimonials(testRes.value.data);
            }

            // Banners
            if (bansRes.status === 'fulfilled' && bansRes.value.data?.length > 0) {
                setBanners(bansRes.value.data);
            }
        } catch (err) {
            console.warn('LandingPage: Supabase fetch error, using safe fallback data', err);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    return (
        <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

            {/* Floating Toast Notification */}
            {toast.visible && (
                <Animated.View
                    style={[
                        styles.toastContainer,
                        {
                            opacity: toastAnim,
                            transform: [
                                {
                                    translateY: toastAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-20, 0]
                                    })
                                }
                            ]
                        }
                    ]}
                >
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
                    <Text style={styles.toastText} numberOfLines={2}>{toast.message}</Text>
                </Animated.View>
            )}

            {/* ─── LUXURY CENTERED BRANDING HEADER ─── */}
            <View style={styles.headerCentered}>
                <View style={styles.headerLeftButtonPlaceholder}>
                    {/* Cart Quick Access */}
                    <TouchableOpacity
                        onPress={() => handleEnterShop('cart')}
                        style={styles.headerCartButton}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="cart-outline" size={22} color="#070F1E" />
                        {cartCount > 0 && (
                            <View style={styles.cartBadge}>
                                <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Logo & Central Identity */}
                <TouchableOpacity
                    style={styles.logoAndBrandContainer}
                    activeOpacity={0.9}
                    onPress={() => handleEnterShop('home')}
                >
                    <View style={styles.logoCircleContainer}>
                        <Image
                            source={settings?.logo_url ? { uri: settings.logo_url } : AM_LOGO}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                    </View>
                    <View style={styles.brandTitleRow}>
                        <Text style={styles.brandTitleAbu}>ABU </Text>
                        <Text style={styles.brandTitleMafhal}>MAFHAL</Text>
                    </View>
                    <Text style={styles.brandSubtitle}>ONLINE MARKETPLACE</Text>
                </TouchableOpacity>

                {/* Sign In / Account Action */}
                <View style={styles.headerRightAction}>
                    <TouchableOpacity
                        onPress={user ? () => handleEnterShop('profile') : (onLogin || (() => handleEnterShop('shop')))}
                        style={styles.headerLoginButton}
                        activeOpacity={0.85}
                    >
                        <Ionicons
                            name={user ? 'person-circle-outline' : 'log-in-outline'}
                            size={16}
                            color="#D9A73A"
                            style={{ marginRight: 4 }}
                        />
                        <Text style={styles.headerLoginText} numberOfLines={1}>
                            {user ? (user.full_name?.split(' ')[0] || 'Profile') : 'Sign In'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ─── SCROLLABLE PAGE CONTAINER ─── */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D9A73A']} />}
                contentContainerStyle={{ paddingBottom: 60 }}
            >
                {/* ─── 1. SIGNATURE LUXURY HERO SECTION ─── */}
                <View style={styles.heroSection}>
                    <View style={styles.heroRow}>
                        {/* Left Column: Copy & Actions */}
                        <View style={styles.heroLeftCol}>
                            {/* Security Trust Pill */}
                            <View style={styles.trustPillBadge}>
                                <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                                <Text style={styles.trustPillBadgeText}>100% Escrow & Verified Market</Text>
                            </View>

                            {/* Headline */}
                            <View style={styles.heroHeadlineBlock}>
                                <Text style={styles.heroHeadlineDark}>Shop Smart.</Text>
                                <Text style={styles.heroHeadlineDark}>Sell More.</Text>
                                <Text style={styles.heroHeadlineGold}>Grow Together.</Text>
                            </View>

                            <Text style={styles.heroDescriptionText}>
                                Babban dandali mai amana a Najeriya. Sayi, sayar, kuma sami kariya 100% ta hanyar Asusun Amana (Escrow Vault).
                            </Text>

                            {/* Dual Call To Actions */}
                            <View style={styles.heroButtonsStack}>
                                <TouchableOpacity
                                    onPress={() => handleEnterShop('shop')}
                                    style={styles.btnStartShopping}
                                    activeOpacity={0.9}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="bag-handle" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                                        <Text style={styles.btnStartShoppingText} numberOfLines={1}>Start Shopping</Text>
                                    </View>
                                    <View style={styles.circleArrowNavy}>
                                        <Ionicons name="arrow-forward" size={12} color="#070F1E" />
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleBecomeSeller}
                                    style={styles.btnStartSelling}
                                    activeOpacity={0.9}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="storefront-outline" size={15} color="#D9A73A" style={{ marginRight: 6 }} />
                                        <Text style={styles.btnStartSellingText} numberOfLines={1}>Start Selling</Text>
                                    </View>
                                    <View style={styles.circleArrowGold}>
                                        <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Right Column: Hero Graphic Illustration */}
                        <View style={styles.heroRightCol}>
                            <View style={styles.decorCircleLarge} />
                            <View style={styles.decorCircleRing} />
                            <Image
                                source={HERO_MOCKUP}
                                style={styles.heroMockupImage}
                                resizeMode="contain"
                            />
                        </View>
                    </View>
                </View>

                {/* ─── 2. FORTIFIED 100% ESCROW PROTECTION VAULT (TSARO & AMANA) ─── */}
                <View style={styles.escrowVaultContainer}>
                    <LinearGradient
                        colors={['#070F1E', '#0A192F', '#0E2A4D']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.escrowVaultCard}
                    >
                        {/* Escrow Header with Glowing Vault Badge */}
                        <View style={styles.escrowHeaderRow}>
                            <View style={styles.escrowIconBadge}>
                                <Ionicons name="shield-checkmark" size={22} color="#10B981" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.escrowCardTitle}>100% ESCROW PROTECTION VAULT</Text>
                                    <View style={styles.liveVerifiedTag}>
                                        <Text style={styles.liveVerifiedTagText}>ACTIVE</Text>
                                    </View>
                                </View>
                                <Text style={styles.escrowCardSubtitle}>Kariyar Biyan Kuɗi & Sayayya Ta Amana</Text>
                            </View>
                        </View>

                        {/* Guarantee Statement */}
                        <View style={styles.escrowGuaranteeBox}>
                            <Ionicons name="lock-closed" size={14} color="#D9A73A" style={{ marginRight: 6 }} />
                            <Text style={styles.escrowGuaranteeText}>
                                Ba za a taɓa sakin kuɗi ga mai sayarwa ba har sai ka karɓi kayanka lafiya kuma ka gamsu 100%.
                            </Text>
                        </View>

                        {/* 3 Steps of Safe Escrow Execution */}
                        <View style={styles.escrowStepsRow}>
                            {/* Step 1 */}
                            <View style={styles.escrowStepItem}>
                                <View style={styles.escrowStepCircle}>
                                    <Ionicons name="wallet-outline" size={16} color="#D9A73A" />
                                    <View style={styles.stepNumBadge}><Text style={styles.stepNumText}>1</Text></View>
                                </View>
                                <Text style={styles.escrowStepTitle}>Killace Kuɗi</Text>
                                <Text style={styles.escrowStepDesc}>Kudinka na zaune a amana ba tare da mai shago ya taba ba.</Text>
                            </View>

                            <View style={styles.escrowStepArrow}>
                                <Ionicons name="chevron-forward" size={16} color="#475569" />
                            </View>

                            {/* Step 2 */}
                            <View style={styles.escrowStepItem}>
                                <View style={styles.escrowStepCircle}>
                                    <Ionicons name="cube-outline" size={16} color="#3B82F6" />
                                    <View style={styles.stepNumBadge}><Text style={styles.stepNumText}>2</Text></View>
                                </View>
                                <Text style={styles.escrowStepTitle}>Isar da Sako</Text>
                                <Text style={styles.escrowStepDesc}>Mai sayarwa zai tura kaya tare da lambar bibiya (tracking).</Text>
                            </View>

                            <View style={styles.escrowStepArrow}>
                                <Ionicons name="chevron-forward" size={16} color="#475569" />
                            </View>

                            {/* Step 3 */}
                            <View style={styles.escrowStepItem}>
                                <View style={styles.escrowStepCircle}>
                                    <Ionicons name="checkmark-done-circle" size={16} color="#10B981" />
                                    <View style={styles.stepNumBadge}><Text style={styles.stepNumText}>3</Text></View>
                                </View>
                                <Text style={styles.escrowStepTitle}>Gamsuwa / Refund</Text>
                                <Text style={styles.escrowStepDesc}>Sakin kudi bayan ka gamsu, ko mayar da kudi idan an samu kuskure.</Text>
                            </View>
                        </View>

                        {/* Security Certification Strip */}
                        <View style={styles.escrowBadgesRow}>
                            <View style={styles.escrowBadgeMini}>
                                <Ionicons name="finger-print-outline" size={12} color="#10B981" />
                                <Text style={styles.escrowBadgeMiniText}>256-Bit SSL Safe</Text>
                            </View>
                            <View style={styles.escrowBadgeMini}>
                                <Ionicons name="ribbon-outline" size={12} color="#D9A73A" />
                                <Text style={styles.escrowBadgeMiniText}>CAC & NIN Verified</Text>
                            </View>
                            <View style={styles.escrowBadgeMini}>
                                <Ionicons name="refresh-outline" size={12} color="#38BDF8" />
                                <Text style={styles.escrowBadgeMiniText}>Fast Refund Guarantee</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* ─── 3. MODERN SEARCH & DISCOVERY BAR ─── */}
                <View style={styles.searchBarSection}>
                    <View style={styles.searchBox}>
                        <Ionicons name="search-outline" size={19} color="#64748B" style={{ marginRight: 8 }} />
                        <TextInput
                            placeholder="Search products, verified sellers, brands..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearchSubmit}
                            style={styles.searchBoxInput}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 ? (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                                <Ionicons name="close-circle" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={() => handleEnterShop('shop')}
                                style={styles.searchFilterButton}
                            >
                                <Ionicons name="options-outline" size={18} color="#070F1E" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* ─── 4. SECURITY & TRUST VALUES STRIP ─── */}
                <View style={styles.trustStripContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trustStripContent}>
                        {TRUST_ITEMS.map((item, idx) => (
                            <View key={idx} style={styles.trustPillItem}>
                                <View style={[styles.trustIconCircle, { backgroundColor: item.color + '15' }]}>
                                    <Ionicons name={item.icon} size={15} color={item.color} />
                                </View>
                                <View>
                                    <Text style={styles.trustItemLabel}>{item.label}</Text>
                                    <Text style={styles.trustItemDesc}>{item.desc}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* ─── 5. FLASH DEALS WITH COUNTDOWN TIMER ─── */}
                {flashSaleProducts.length > 0 && (
                    <View style={styles.flashDealsSection}>
                        <View style={styles.flashHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.flashIconBox}>
                                    <Ionicons name="flash" size={18} color="#EF4444" />
                                </View>
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.flashSectionTitle}>Flash Deals</Text>
                                    <Text style={styles.flashSectionSub}>Farashin ragi mai karewa nan kusa</Text>
                                </View>
                            </View>
                            <CountdownTimer />
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.flashProductsScroll}
                        >
                            {flashSaleProducts.map((p) => {
                                const discountPct = p.compare_at_price && p.compare_at_price > p.price
                                    ? Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100)
                                    : (p.discount || 15);

                                return (
                                    <TouchableOpacity
                                        key={p.id}
                                        style={styles.flashDealCard}
                                        activeOpacity={0.9}
                                        onPress={() => handleProductPress(p)}
                                    >
                                        <View style={styles.flashImgWrapper}>
                                            <Image
                                                source={{ uri: resolveImage(p) }}
                                                style={styles.flashProductImg}
                                                resizeMode="cover"
                                            />
                                            <View style={styles.flashDiscountBadge}>
                                                <Text style={styles.flashDiscountBadgeText}>-{discountPct}%</Text>
                                            </View>
                                        </View>
                                        <View style={styles.flashCardBody}>
                                            <Text style={styles.flashProductName} numberOfLines={1}>{p.name}</Text>
                                            <Text style={styles.flashProductPrice}>{fmtPrice(p.price)}</Text>
                                            {p.compare_at_price ? (
                                                <Text style={styles.flashOldPrice}>{fmtPrice(p.compare_at_price)}</Text>
                                            ) : null}

                                            <TouchableOpacity
                                                style={styles.btnFlashAddToCart}
                                                onPress={(e) => handleAddToCartPress(p, e)}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="cart-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                                                <Text style={styles.btnFlashAddToCartText}>Add to Cart</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* ─── 6. MARKET CATEGORIES ─── */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderRow}>
                        <View>
                            <Text style={styles.sectionTitleText}>Market Categories</Text>
                            <Text style={styles.sectionSubtitleText}>Zaɓi rukuni don ganin kayayyaki masu inganci</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleEnterShop('shop')} style={styles.sectionLinkBtn}>
                            <Text style={styles.sectionLinkText}>Duba Duka</Text>
                            <Ionicons name="chevron-forward" size={14} color="#D9A73A" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoriesScrollContainer}
                    >
                        {categories.map((cat, index) => (
                            <TouchableOpacity
                                key={cat.id || index}
                                style={styles.categoryCardItem}
                                activeOpacity={0.85}
                                onPress={() => handleEnterShop('shop', cat.name)}
                            >
                                <View style={styles.categoryIconCircle}>
                                    <Ionicons name={cat.icon || 'grid-outline'} size={22} color="#D9A73A" />
                                </View>
                                <Text style={styles.categoryCardLabel} numberOfLines={2}>{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ─── 7. POPULAR PRODUCTS (REAL DATA + ESCROW TAG) ─── */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderRow}>
                        <View>
                            <Text style={styles.sectionTitleText}>Popular Right Now</Text>
                            <Text style={styles.sectionSubtitleText}>Kayan da suka fi samun sha'awa da kyakkyawan sharhi</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleEnterShop('shop')} style={styles.sectionLinkBtn}>
                            <Text style={styles.sectionLinkText}>View All</Text>
                            <Ionicons name="arrow-forward" size={14} color="#D9A73A" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.popularGridContainer}>
                        {popularProducts.slice(0, 6).map((product) => {
                            const isLiked = !!wishlist[product.id];
                            return (
                                <TouchableOpacity
                                    key={product.id}
                                    style={styles.productGridCard}
                                    activeOpacity={0.92}
                                    onPress={() => handleProductPress(product)}
                                >
                                    {/* Image Wrapper */}
                                    <View style={styles.productImgContainer}>
                                        <Image
                                            source={{ uri: resolveImage(product) }}
                                            style={styles.productImg}
                                            resizeMode="cover"
                                        />

                                        {/* Escrow badge pill */}
                                        <View style={styles.productEscrowPill}>
                                            <Ionicons name="shield-checkmark" size={10} color="#10B981" />
                                            <Text style={styles.productEscrowPillText}>Escrow Safe</Text>
                                        </View>

                                        {/* Wishlist toggle button */}
                                        <TouchableOpacity
                                            style={styles.productWishlistBtn}
                                            onPress={(e) => {
                                                if (e && e.stopPropagation) e.stopPropagation();
                                                toggleWishlist(product.id);
                                            }}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons
                                                name={isLiked ? 'heart' : 'heart-outline'}
                                                size={16}
                                                color={isLiked ? '#EF4444' : '#64748B'}
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Product Details */}
                                    <View style={styles.productCardDetails}>
                                        <Text style={styles.productCardCategory} numberOfLines={1}>
                                            {product.category || 'Marketplace'}
                                        </Text>
                                        <Text style={styles.productCardTitle} numberOfLines={2}>
                                            {product.name}
                                        </Text>

                                        {/* Rating Stars */}
                                        <View style={styles.productRatingRow}>
                                            <Ionicons name="star" size={12} color="#F59E0B" />
                                            <Text style={styles.productRatingText}>
                                                {product.rating ? Number(product.rating).toFixed(1) : '4.8'}
                                            </Text>
                                            <Text style={styles.productReviewsCount}>
                                                ({product.reviews_count || 45})
                                            </Text>
                                        </View>

                                        {/* Pricing Row */}
                                        <View style={styles.productPriceRow}>
                                            <View>
                                                <Text style={styles.productCurrentPrice}>{fmtPrice(product.price)}</Text>
                                                {product.compare_at_price ? (
                                                    <Text style={styles.productComparePrice}>
                                                        {fmtPrice(product.compare_at_price)}
                                                    </Text>
                                                ) : null}
                                            </View>

                                            <TouchableOpacity
                                                style={styles.productAddToCartIconBtn}
                                                onPress={(e) => handleAddToCartPress(product, e)}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* ─── 8. WHY ABU MAFHAL (FEATURE HIGHLIGHTS) ─── */}
                <View style={styles.whySectionContainer}>
                    <View style={styles.centerSectionHeader}>
                        <Text style={styles.centerSectionTitle}>Me Yasa Za Ka Zabi Abu Mafhal?</Text>
                        <Text style={styles.centerSectionSub}>Ingantaccen tsaro da amana da aka gina domin cigaban kowa</Text>
                        <View style={styles.goldUnderline} />
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.whyCardsScroll}
                    >
                        {WHY_CHOOSE_US.map((item) => (
                            <View key={item.id} style={styles.whyCardItem}>
                                <View style={[styles.whyCardIconBox, { backgroundColor: item.bgColor }]}>
                                    <Ionicons name={item.icon} size={24} color={item.color} />
                                </View>
                                <Text style={styles.whyCardTitleText}>{item.title}</Text>
                                <Text style={styles.whyCardDescText}>{item.desc}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* ─── 9. LIVE PLATFORM IMPACT & STATS (ANIMATED) ─── */}
                <View style={styles.statsSectionContainer}>
                    <View style={styles.statsGridCard}>
                        <View style={styles.statsItemCol}>
                            <Ionicons name="people-outline" size={18} color="#D9A73A" style={{ marginBottom: 4 }} />
                            <AnimatedCounter target={50} suffix="K+" />
                            <Text style={styles.statsItemLabel}>Active Buyers</Text>
                        </View>
                        <View style={styles.statsDividerVertical} />

                        <View style={styles.statsItemCol}>
                            <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" style={{ marginBottom: 4 }} />
                            <AnimatedCounter target={2.5} suffix="B+" />
                            <Text style={styles.statsItemLabel}>₦ Escrow Secured</Text>
                        </View>
                        <View style={styles.statsDividerVertical} />

                        <View style={styles.statsItemCol}>
                            <Ionicons name="storefront-outline" size={18} color="#3B82F6" style={{ marginBottom: 4 }} />
                            <AnimatedCounter target={15} suffix="K+" />
                            <Text style={styles.statsItemLabel}>Verified Sellers</Text>
                        </View>
                        <View style={styles.statsDividerVertical} />

                        <View style={styles.statsItemCol}>
                            <Ionicons name="star-outline" size={18} color="#F59E0B" style={{ marginBottom: 4 }} />
                            <AnimatedCounter target={4.9} suffix="/5" />
                            <Text style={styles.statsItemLabel}>Satisfaction</Text>
                        </View>
                    </View>
                </View>

                {/* ─── 10. MISSION STATEMENT SECTION ─── */}
                <View style={styles.missionCardContainer}>
                    <View style={styles.missionInnerCard}>
                        <View style={styles.missionTagBadge}>
                            <Text style={styles.missionTagText}>OUR MISSION</Text>
                        </View>
                        <Text style={styles.missionTitleText}>
                            Empowering People. Building Opportunities. Stronger Community.
                        </Text>
                        <Text style={styles.missionParagraphText}>
                            Abu Mafhal ya wuce kawai kasuwa ta saye da sayarwa. Mun sadaukar da kai wajen bunkasa kasuwancin 'yan gida da basu kariya ta tsarin Escrow domin tabbatar da amana a kowace hulɗa.
                        </Text>

                        <View style={styles.missionPhotoContainer}>
                            <Image
                                source={{ uri: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=800' }}
                                style={styles.missionImage}
                                resizeMode="cover"
                            />
                            <View style={styles.missionImageOverlay}>
                                <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                                <Text style={styles.missionImageOverlayText}>
                                    Amintacciyar kasuwar da ta haɗa dubban 'yan kasuwa da masu saye.
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ─── 11. SELLER CALL-TO-ACTION BANNER ─── */}
                <View style={styles.sellerBannerContainer}>
                    <LinearGradient
                        colors={['#070F1E', '#0B2240']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.sellerBannerCard}
                    >
                        <View style={styles.sellerBannerContent}>
                            <Text style={styles.sellerBannerHeadline}>
                                Sell Anything.{"\n"}
                                <Text style={{ color: '#D9A73A' }}>Earn With 100% Peace of Mind.</Text>
                            </Text>
                            <Text style={styles.sellerBannerSubtitle}>
                                Bude shagonka a Abu Mafhal. Sami kwastomomi daga ko'ina a Najeriya tare da garantin samun kudadenka ba tare da fargaba ba.
                            </Text>

                            <TouchableOpacity
                                onPress={handleBecomeSeller}
                                style={styles.btnBecomeSellerCard}
                                activeOpacity={0.9}
                            >
                                <Text style={styles.btnBecomeSellerCardText}>Start Selling Today</Text>
                                <View style={styles.circleArrowNavy}>
                                    <Ionicons name="arrow-forward" size={13} color="#070F1E" />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Visual Badge Indicator */}
                        <View style={styles.sellerVisualBadge}>
                            <Ionicons name="trending-up" size={32} color="#10B981" />
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#94A3B8', marginTop: 4 }}>MONTHLY PAYOUT</Text>
                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF', marginTop: 2 }}>₦2,500,000+</Text>
                            <Text style={{ fontSize: 8, fontWeight: '800', color: '#10B981', marginTop: 2 }}>Instant Settlements</Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* ─── 12. VERIFIED CUSTOMER TESTIMONIALS ─── */}
                <View style={styles.sectionContainer}>
                    <View style={styles.centerSectionHeader}>
                        <Text style={styles.centerSectionTitle}>Abin da Kwastomominmu Ke Faɗi</Text>
                        <Text style={styles.centerSectionSub}>Tabbacin gaskiya da amana daga bakin masu amfani da manhaja</Text>
                        <View style={styles.goldUnderline} />
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.testimonialsScrollContent}
                    >
                        {testimonials.map((t) => (
                            <View key={t.id} style={styles.testimonialCardItem}>
                                <View style={styles.testimonialStarsRow}>
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <Ionicons key={s} name="star" size={14} color="#F59E0B" style={{ marginRight: 2 }} />
                                    ))}
                                </View>
                                <Text style={styles.testimonialQuoteText}>"{t.quote}"</Text>
                                <View style={styles.testimonialAuthorRow}>
                                    <Image
                                        source={{ uri: t.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' }}
                                        style={styles.testimonialAvatar}
                                    />
                                    <View style={{ marginLeft: 10, flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={styles.testimonialNameText}>{t.name}</Text>
                                            <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginLeft: 4 }} />
                                        </View>
                                        <Text style={styles.testimonialRoleText}>{t.role || 'Verified User'}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* ─── 13. RICH FOOTER & LEGAL CERTIFICATIONS ─── */}
                <View style={styles.footerSection}>
                    <View style={styles.footerBrandRow}>
                        <View style={styles.footerLogoFrame}>
                            <Image
                                source={settings?.logo_url ? { uri: settings.logo_url } : AM_LOGO}
                                style={styles.footerLogoImg}
                                resizeMode="contain"
                            />
                        </View>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={styles.footerBrandTitle}>ABU MAFHAL</Text>
                            <Text style={styles.footerBrandSub}>ONLINE MARKETPLACE</Text>
                        </View>
                    </View>

                    <Text style={styles.footerMissionBlurb}>
                        Buy. Sell. Earn. Grow Together. Dandalin kasuwanci na zamani da ke ba da kariya 100% ga mai saye da mai sayarwa ta hanyar Asusun Amana na Escrow.
                    </Text>

                    {/* Social Media Links */}
                    <View style={styles.footerSocialIconsRow}>
                        {[
                            { icon: 'logo-facebook', url: 'https://facebook.com/abumafhal' },
                            { icon: 'logo-instagram', url: 'https://instagram.com/abumafhal' },
                            { icon: 'logo-twitter', url: 'https://x.com/abumafhal' },
                            { icon: 'logo-whatsapp', url: 'https://wa.me/2348000000000' }
                        ].map((soc, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={styles.footerSocialCircle}
                                onPress={() => Linking.openURL(soc.url).catch(() => {})}
                                activeOpacity={0.8}
                            >
                                <Ionicons name={soc.icon} size={18} color="#D9A73A" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Multi-column Navigation Links */}
                    <View style={styles.footerLinksGrid}>
                        <View style={styles.footerLinkCol}>
                            <Text style={styles.footerColTitle}>Kasuwa</Text>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}><Text style={styles.footerLinkText}>All Products</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop', 'Phones & Tablets')}><Text style={styles.footerLinkText}>Phones & Gadgets</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop', 'Fashion & Apparel')}><Text style={styles.footerLinkText}>Fashion & Shoes</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('cart')}><Text style={styles.footerLinkText}>My Cart</Text></TouchableOpacity>
                        </View>

                        <View style={styles.footerLinkCol}>
                            <Text style={styles.footerColTitle}>Hukuma</Text>
                            <TouchableOpacity onPress={handleBecomeSeller}><Text style={styles.footerLinkText}>Become a Seller</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}><Text style={styles.footerLinkText}>Escrow Policy</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}><Text style={styles.footerLinkText}>Buyer Protection</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}><Text style={styles.footerLinkText}>Seller Terms</Text></TouchableOpacity>
                        </View>

                        <View style={styles.footerLinkCol}>
                            <Text style={styles.footerColTitle}>Taimako</Text>
                            <TouchableOpacity onPress={() => handleEnterShop('profile')}><Text style={styles.footerLinkText}>Support Center</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}><Text style={styles.footerLinkText}>Order Tracking</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}><Text style={styles.footerLinkText}>Refunds & Dispute</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}><Text style={styles.footerLinkText}>Contact Us</Text></TouchableOpacity>
                        </View>
                    </View>

                    {/* Newsletter Box */}
                    <View style={styles.newsletterCard}>
                        <Text style={styles.newsletterCardTitle}>Kasance tare da mu</Text>
                        <Text style={styles.newsletterCardSub}>Sami labaran ragi da sabbin kayayyaki kai tsaye a email dinka.</Text>
                        <View style={styles.newsletterInputRow}>
                            <TextInput
                                placeholder="Shigar da email dinka..."
                                placeholderTextColor="#64748B"
                                value={newsletterEmail}
                                onChangeText={setNewsletterEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                style={styles.newsletterInput}
                            />
                            <TouchableOpacity
                                onPress={handleNewsletterSubmit}
                                style={styles.btnNewsletterSubmit}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="paper-plane" size={16} color="#070F1E" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bottom Legal & Copyright Bar */}
                    <View style={styles.footerBottomLegal}>
                        <Text style={styles.footerBottomCopy}>
                            © 2026 Abu Mafhal Marketplace. All rights reserved.
                        </Text>
                        <Text style={styles.footerBottomBadge}>
                            🔒 100% Escrow Protection • 256-Bit SSL Encrypted • NDIC & CBN Partners
                        </Text>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    toastContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        left: 20,
        right: 20,
        backgroundColor: '#070F1E',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 9999,
        borderWidth: 1,
        borderColor: '#D9A73A40',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    toastText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        flex: 1,
    },
    headerCentered: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 8 : 14,
        paddingBottom: 14,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerLeftButtonPlaceholder: {
        width: 44,
        alignItems: 'flex-start',
    },
    headerCartButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        position: 'relative',
    },
    cartBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    cartBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
    },
    logoAndBrandContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoCircleContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#D9A73A40',
        shadowColor: '#070F1E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    logoImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    brandTitleRow: {
        flexDirection: 'row',
        marginTop: 6,
        alignItems: 'center',
    },
    brandTitleAbu: {
        fontSize: 18,
        fontWeight: '900',
        color: '#070F1E',
        letterSpacing: 0.5,
    },
    brandTitleMafhal: {
        fontSize: 18,
        fontWeight: '900',
        color: '#D9A73A',
        letterSpacing: 0.5,
    },
    brandSubtitle: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 2,
        marginTop: 2,
    },
    headerRightAction: {
        width: 70,
        alignItems: 'flex-end',
    },
    headerLoginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(217, 167, 58, 0.1)',
        borderWidth: 1,
        borderColor: '#D9A73A',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
    },
    headerLoginText: {
        color: '#D9A73A',
        fontSize: 10,
        fontWeight: '800',
    },

    // ─── Hero Styles ───
    heroSection: {
        backgroundColor: '#F8FAFC',
        paddingTop: 10,
        paddingBottom: 6,
    },
    heroRow: {
        flexDirection: 'row',
        paddingLeft: 16,
        paddingRight: 0,
        alignItems: 'center',
        minHeight: 390,
        position: 'relative',
    },
    heroLeftCol: {
        width: '50%',
        paddingRight: 6,
        zIndex: 2,
    },
    heroRightCol: {
        position: 'absolute',
        right: -20,
        top: 0,
        bottom: 0,
        width: '60%',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    decorCircleLarge: {
        position: 'absolute',
        width: 230,
        height: 230,
        borderRadius: 115,
        backgroundColor: '#E2E8F0',
        bottom: 20,
        right: -10,
        opacity: 0.5,
        zIndex: 0,
    },
    decorCircleRing: {
        position: 'absolute',
        width: 170,
        height: 170,
        borderRadius: 85,
        borderWidth: 2,
        borderColor: '#D9A73A30',
        top: 20,
        right: -20,
        opacity: 0.4,
        zIndex: 0,
    },
    heroMockupImage: {
        width: '100%',
        height: '100%',
        zIndex: 1,
    },
    trustPillBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        marginBottom: 8,
        gap: 4,
    },
    trustPillBadgeText: {
        fontSize: 8,
        fontWeight: '800',
        color: '#070F1E',
    },
    heroHeadlineBlock: {
        marginTop: 2,
    },
    heroHeadlineDark: {
        fontSize: 27,
        fontWeight: '900',
        color: '#070F1E',
        letterSpacing: -0.6,
        lineHeight: 31,
    },
    heroHeadlineGold: {
        fontSize: 27,
        fontWeight: '900',
        color: '#D9A73A',
        letterSpacing: -0.6,
        lineHeight: 31,
        marginTop: 1,
        marginBottom: 8,
    },
    heroDescriptionText: {
        fontSize: 11,
        color: '#475569',
        lineHeight: 16,
        fontWeight: '600',
    },
    heroButtonsStack: {
        flexDirection: 'column',
        gap: 9,
        marginTop: 14,
        width: '100%',
    },
    btnStartShopping: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#070F1E',
        paddingLeft: 12,
        paddingRight: 6,
        paddingVertical: 10,
        borderRadius: 10,
        shadowColor: '#070F1E',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3,
    },
    btnStartShoppingText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12,
    },
    circleArrowNavy: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnStartSelling: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#D9A73A',
        paddingLeft: 10,
        paddingRight: 6,
        paddingVertical: 9,
        borderRadius: 10,
    },
    btnStartSellingText: {
        color: '#070F1E',
        fontWeight: '800',
        fontSize: 12,
    },
    circleArrowGold: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#D9A73A',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ─── Fortified Escrow Vault Card ───
    escrowVaultContainer: {
        paddingHorizontal: 16,
        marginTop: 12,
    },
    escrowVaultCard: {
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: '#D9A73A40',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3,
    },
    escrowHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    escrowIconBadge: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    escrowCardTitle: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    liveVerifiedTag: {
        backgroundColor: '#10B981',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 6,
    },
    liveVerifiedTagText: {
        color: '#FFFFFF',
        fontSize: 7.5,
        fontWeight: '900',
    },
    escrowCardSubtitle: {
        color: '#D9A73A',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },
    escrowGuaranteeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginTop: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#D9A73A',
    },
    escrowGuaranteeText: {
        color: '#E2E8F0',
        fontSize: 9.5,
        fontWeight: '600',
        flex: 1,
        lineHeight: 14,
    },
    escrowStepsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    escrowStepItem: {
        flex: 1,
        alignItems: 'center',
    },
    escrowStepCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        position: 'relative',
        marginBottom: 6,
    },
    stepNumBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#D9A73A',
        width: 14,
        height: 14,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumText: {
        color: '#070F1E',
        fontSize: 8,
        fontWeight: '900',
    },
    escrowStepTitle: {
        color: '#FFFFFF',
        fontSize: 9.5,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 2,
    },
    escrowStepDesc: {
        color: '#94A3B8',
        fontSize: 7.5,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 11,
    },
    escrowStepArrow: {
        paddingHorizontal: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    escrowBadgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    escrowBadgeMini: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    escrowBadgeMiniText: {
        color: '#CBD5E1',
        fontSize: 8,
        fontWeight: '700',
    },

    // ─── Search Bar ───
    searchBarSection: {
        paddingHorizontal: 16,
        marginTop: 18,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: Platform.OS === 'ios' ? 11 : 6,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    searchBoxInput: {
        flex: 1,
        color: '#070F1E',
        fontWeight: '600',
        fontSize: 12.5,
        paddingVertical: 4,
    },
    searchFilterButton: {
        paddingLeft: 6,
    },

    // ─── Trust Values Strip ───
    trustStripContainer: {
        marginTop: 14,
    },
    trustStripContent: {
        paddingHorizontal: 16,
        gap: 10,
    },
    trustPillItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 8,
    },
    trustIconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trustItemLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#070F1E',
    },
    trustItemDesc: {
        fontSize: 8.5,
        color: '#64748B',
        fontWeight: '500',
    },

    // ─── Flash Deals ───
    flashDealsSection: {
        marginTop: 24,
        backgroundColor: '#FFF7ED',
        paddingVertical: 18,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#FFEDD5',
    },
    flashHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    flashIconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    flashSectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#070F1E',
    },
    flashSectionSub: {
        fontSize: 9.5,
        color: '#64748B',
        fontWeight: '600',
    },
    flashProductsScroll: {
        paddingHorizontal: 16,
        gap: 12,
    },
    flashDealCard: {
        width: 145,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FED7AA',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    flashImgWrapper: {
        width: '100%',
        height: 120,
        position: 'relative',
        backgroundColor: '#F1F5F9',
    },
    flashProductImg: {
        width: '100%',
        height: '100%',
    },
    flashDiscountBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: '#EF4444',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    flashDiscountBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
    },
    flashCardBody: {
        padding: 10,
    },
    flashProductName: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 3,
    },
    flashProductPrice: {
        fontSize: 13,
        fontWeight: '900',
        color: '#070F1E',
    },
    flashOldPrice: {
        fontSize: 10,
        color: '#94A3B8',
        textDecorationLine: 'line-through',
    },
    btnFlashAddToCart: {
        marginTop: 8,
        backgroundColor: '#070F1E',
        borderRadius: 8,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnFlashAddToCartText: {
        color: '#FFFFFF',
        fontSize: 9.5,
        fontWeight: '800',
    },

    // ─── Categories ───
    sectionContainer: {
        marginTop: 26,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        marginBottom: 14,
    },
    sectionTitleText: {
        fontSize: 17,
        fontWeight: '900',
        color: '#070F1E',
        letterSpacing: -0.3,
    },
    sectionSubtitleText: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '500',
        marginTop: 2,
    },
    sectionLinkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionLinkText: {
        color: '#D9A73A',
        fontWeight: '800',
        fontSize: 11.5,
        marginRight: 2,
    },
    categoriesScrollContainer: {
        paddingHorizontal: 16,
        gap: 12,
    },
    categoryCardItem: {
        width: 76,
        alignItems: 'center',
    },
    categoryIconCircle: {
        width: 58,
        height: 58,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
        marginBottom: 6,
    },
    categoryCardLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569',
        textAlign: 'center',
        lineHeight: 13,
    },

    // ─── Popular Products Grid ───
    popularGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        justifyContent: 'space-between',
        gap: 12,
    },
    productGridCard: {
        width: (width - 44) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    productImgContainer: {
        width: '100%',
        height: 145,
        backgroundColor: '#F1F5F9',
        position: 'relative',
    },
    productImg: {
        width: '100%',
        height: '100%',
    },
    productEscrowPill: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(7, 15, 30, 0.85)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 3,
    },
    productEscrowPillText: {
        color: '#10B981',
        fontSize: 8,
        fontWeight: '800',
    },
    productWishlistBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    productCardDetails: {
        padding: 10,
    },
    productCardCategory: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    productCardTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#070F1E',
        marginTop: 3,
        lineHeight: 16,
        minHeight: 32,
    },
    productRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 3,
    },
    productRatingText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#1E293B',
    },
    productReviewsCount: {
        fontSize: 9,
        color: '#94A3B8',
    },
    productPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    productCurrentPrice: {
        fontSize: 13,
        fontWeight: '900',
        color: '#070F1E',
    },
    productComparePrice: {
        fontSize: 9,
        color: '#94A3B8',
        textDecorationLine: 'line-through',
    },
    productAddToCartIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#070F1E',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ─── Why Abu Mafhal ───
    whySectionContainer: {
        marginTop: 32,
        backgroundColor: '#FFFFFF',
        paddingVertical: 24,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
    },
    centerSectionHeader: {
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    centerSectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#070F1E',
        textAlign: 'center',
    },
    centerSectionSub: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 3,
    },
    goldUnderline: {
        width: 44,
        height: 3,
        backgroundColor: '#D9A73A',
        borderRadius: 2,
        marginTop: 8,
    },
    whyCardsScroll: {
        paddingHorizontal: 16,
        gap: 12,
        paddingBottom: 4,
    },
    whyCardItem: {
        width: 210,
        backgroundColor: '#F8FAFC',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    whyCardIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    whyCardTitleText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#070F1E',
        marginBottom: 4,
    },
    whyCardDescText: {
        fontSize: 10.5,
        fontWeight: '500',
        color: '#64748B',
        lineHeight: 15,
    },

    // ─── Live Stats ───
    statsSectionContainer: {
        paddingHorizontal: 16,
        marginTop: 24,
    },
    statsGridCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    statsItemCol: {
        flex: 1,
        alignItems: 'center',
    },
    statsNumber: {
        fontSize: 14,
        fontWeight: '900',
        color: '#070F1E',
    },
    statsItemLabel: {
        fontSize: 8,
        fontWeight: '700',
        color: '#64748B',
        textAlign: 'center',
        marginTop: 2,
    },
    statsDividerVertical: {
        width: 1,
        height: 28,
        backgroundColor: '#E2E8F0',
    },

    // ─── Mission ───
    missionCardContainer: {
        paddingHorizontal: 16,
        marginTop: 26,
    },
    missionInnerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    missionTagBadge: {
        backgroundColor: '#070F1E',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    missionTagText: {
        color: '#D9A73A',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 1,
    },
    missionTitleText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#070F1E',
        lineHeight: 23,
        marginBottom: 8,
    },
    missionParagraphText: {
        fontSize: 11,
        color: '#64748B',
        lineHeight: 17,
        fontWeight: '500',
        marginBottom: 14,
    },
    missionPhotoContainer: {
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        height: 150,
    },
    missionImage: {
        width: '100%',
        height: '100%',
    },
    missionImageOverlay: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        right: 10,
        backgroundColor: 'rgba(7, 15, 30, 0.88)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    missionImageOverlayText: {
        color: '#FFFFFF',
        fontSize: 9.5,
        fontWeight: '700',
        flex: 1,
    },

    // ─── Seller CTA ───
    sellerBannerContainer: {
        paddingHorizontal: 16,
        marginTop: 24,
    },
    sellerBannerCard: {
        borderRadius: 20,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#D9A73A40',
    },
    sellerBannerContent: {
        width: '64%',
    },
    sellerBannerHeadline: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        lineHeight: 21,
    },
    sellerBannerSubtitle: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '500',
        lineHeight: 14,
        marginTop: 5,
        marginBottom: 12,
    },
    btnBecomeSellerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#D9A73A',
        borderRadius: 10,
        paddingLeft: 12,
        paddingRight: 6,
        paddingVertical: 8,
        alignSelf: 'flex-start',
        gap: 6,
    },
    btnBecomeSellerCardText: {
        color: '#070F1E',
        fontWeight: '900',
        fontSize: 11,
    },
    sellerVisualBadge: {
        width: '32%',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 14,
        padding: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },

    // ─── Testimonials ───
    testimonialsScrollContent: {
        paddingHorizontal: 16,
        gap: 12,
        paddingBottom: 6,
    },
    testimonialCardItem: {
        width: 250,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    testimonialStarsRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    testimonialQuoteText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#334155',
        lineHeight: 16,
        fontStyle: 'italic',
        minHeight: 48,
    },
    testimonialAuthorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    testimonialAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#E2E8F0',
    },
    testimonialNameText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#070F1E',
    },
    testimonialRoleText: {
        fontSize: 9,
        color: '#64748B',
        fontWeight: '500',
    },

    // ─── Footer ───
    footerSection: {
        backgroundColor: '#070F1E',
        marginTop: 36,
        paddingTop: 28,
        paddingBottom: 24,
        paddingHorizontal: 16,
    },
    footerBrandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    footerLogoFrame: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#D9A73A',
    },
    footerLogoImg: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    footerBrandTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    footerBrandSub: {
        fontSize: 8,
        fontWeight: '800',
        color: '#D9A73A',
        letterSpacing: 1.5,
    },
    footerMissionBlurb: {
        fontSize: 10.5,
        color: '#94A3B8',
        lineHeight: 16,
        marginTop: 12,
        fontWeight: '500',
    },
    footerSocialIconsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
        marginBottom: 20,
    },
    footerSocialCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
    },
    footerLinksGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    footerLinkCol: {
        flex: 1,
    },
    footerColTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#D9A73A',
        marginBottom: 8,
    },
    footerLinkText: {
        fontSize: 9.5,
        color: '#CBD5E1',
        fontWeight: '500',
        marginBottom: 6,
    },
    newsletterCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 16,
        padding: 14,
        marginTop: 18,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    newsletterCardTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    newsletterCardSub: {
        fontSize: 9,
        color: '#94A3B8',
        marginTop: 2,
        marginBottom: 10,
    },
    newsletterInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    newsletterInput: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 9 : 5,
        color: '#FFFFFF',
        fontSize: 11,
    },
    btnNewsletterSubmit: {
        backgroundColor: '#D9A73A',
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    footerBottomLegal: {
        marginTop: 20,
        alignItems: 'center',
    },
    footerBottomCopy: {
        fontSize: 9,
        color: '#64748B',
        textAlign: 'center',
    },
    footerBottomBadge: {
        fontSize: 8,
        color: '#10B981',
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 4,
    },
});
