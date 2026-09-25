import React, { useRef, useState, useEffect } from 'react';
import {
    View, Text, Image, TouchableOpacity, ScrollView, Dimensions,
    Platform, StatusBar, StyleSheet, TextInput, RefreshControl,
    Animated, Linking, Alert, Modal
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

// Why Choose Us Items
const WHY_CHOOSE_US = [
    {
        id: 1,
        icon: 'shield-checkmark',
        title: '100% Escrow Protection',
        desc: 'Buyer funds are safeguarded in an independent vault. Payment is released only after you verify satisfaction.',
        color: '#10B981',
        bgColor: '#ECFDF5'
    },
    {
        id: 2,
        icon: 'card-outline',
        title: 'Bank-Grade Payment Gateways',
        desc: 'Seamless transactions secured by CBN-licensed financial channels (Paystack, Flutterwave, Monnify).',
        color: '#D9A73A',
        bgColor: '#FEF3C7'
    },
    {
        id: 3,
        icon: 'ribbon-outline',
        title: 'Identity-Verified Merchants',
        desc: 'Every seller undergoes stringent background authentication via government CAC registration or NIN credentials.',
        color: '#3B82F6',
        bgColor: '#EFF6FF'
    },
    {
        id: 4,
        icon: 'refresh-circle-outline',
        title: 'Guaranteed Rapid Refunds',
        desc: 'Dispute arbitration guarantees prompt refunds if goods arrive damaged or not as described.',
        color: '#EF4444',
        bgColor: '#FEF2F2'
    },
];

// Fallback Popular Products
const POPULAR_FALLBACKS = [
    {
        id: 'pop-1',
        name: 'iPhone 15 Pro Max 256GB Natural Titanium',
        price: 1250000,
        compare_at_price: 1470000,
        discount: 15,
        rating: 4.9,
        reviews_count: 142,
        category: 'Phones & Tablets',
        seller_state: 'Lagos',
        images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400']
    },
    {
        id: 'pop-2',
        name: 'Apple Watch Series 9 GPS 45mm Starlight',
        price: 390000,
        compare_at_price: 450000,
        discount: 20,
        rating: 4.8,
        reviews_count: 98,
        category: 'Electronics',
        seller_state: 'Abuja',
        images: ['https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=400']
    },
    {
        id: 'pop-3',
        name: 'Nike Air Jordan 1 Retro High Chicago Edition',
        price: 85000,
        compare_at_price: 95000,
        discount: 10,
        rating: 4.7,
        reviews_count: 76,
        category: 'Fashion & Apparel',
        seller_state: 'Kano',
        images: ['https://images.unsplash.com/photo-1552346154-21d32810aba3?w=400']
    },
    {
        id: 'pop-4',
        name: 'Dior Sauvage Eau De Parfum Vaporisateur 100ml',
        price: 78000,
        compare_at_price: 95000,
        discount: 18,
        rating: 4.9,
        reviews_count: 65,
        category: 'Beauty & Health',
        seller_state: 'Lagos',
        images: ['https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=400']
    }
];

// Default categories
const DEFAULT_CATEGORIES = [
    { id: 'all', name: 'All Items', icon: 'sparkles-outline' },
    { id: 'cat-phones', name: 'Phones & Tablets', icon: 'phone-portrait-outline' },
    { id: 'cat-fashion', name: 'Fashion & Apparel', icon: 'shirt-outline' },
    { id: 'cat-electronics', name: 'Electronics & Gadgets', icon: 'desktop-outline' },
    { id: 'cat-shoes', name: 'Shoes & Footwear', icon: 'footsteps-outline' },
    { id: 'cat-beauty', name: 'Beauty & Health', icon: 'sparkles-outline' },
    { id: 'cat-home', name: 'Home & Living', icon: 'home-outline' },
];

// Fallback Testimonials
const TESTIMONIALS_FALLBACK = [
    {
        id: 't-1',
        quote: "Abu Mafhal's Escrow Vault gave me total peace of mind. My funds were never exposed until I held and tested my phone in person.",
        name: "Ibrahim Sani",
        role: "Verified Buyer (Kano)",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        rating: 5,
    },
    {
        id: 't-2',
        quote: "Registering my store on Abu Mafhal expanded my customer reach nationwide. Instant payouts and zero fraud make it unmatched.",
        name: "Amina Yusuf",
        role: "Verified Merchant (Abuja)",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        rating: 5,
    },
    {
        id: 't-3',
        quote: "Fastest dispatch I've ever experienced in Nigeria. Tracking was accurate, and product condition was 100% genuine.",
        name: "David Adeleke",
        role: "Verified Buyer (Lagos)",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
        rating: 5,
    }
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
    onLogin,
    user,
    onNavigate
}) => {
    const { settings } = useAppSettings();
    const scrollViewRef = useRef(null);

    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
    const [selectedCategory, setSelectedCategory] = useState('All Items');
    const [priceRange, setPriceRange] = useState('all'); // 'all', 'under50k', '50k-250k', '250k+'
    const [sortFilter, setSortFilter] = useState('featured'); // 'featured', 'rating', 'deals'
    const [popularProducts, setPopularProducts] = useState(POPULAR_FALLBACKS);
    const [flashSaleProducts, setFlashSaleProducts] = useState([]);
    const [testimonials, setTestimonials] = useState(TESTIMONIALS_FALLBACK);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDeliveryState, setSelectedDeliveryState] = useState('Abuja');
    const [newsletterEmail, setNewsletterEmail] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: '' });

    // Interactive Policy & Info Modal State (Keeps users on Landing Page without entering MainApp)
    const [infoModal, setInfoModal] = useState({
        visible: false,
        type: '',
        title: '',
        subtitle: ''
    });

    const [trackInput, setTrackInput] = useState('');
    const [trackResult, setTrackResult] = useState(null);

    const toastAnim = useRef(new Animated.Value(0)).current;

    const showToast = (message) => {
        setToast({ visible: true, message });
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2400),
            Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true })
        ]).start(() => setToast({ visible: false, message: '' }));
    };

    // 🔒 STRICT SECURITY GATE: User MUST be authenticated to view Product Details!
    const handleProductPress = (product) => {
        if (!user) {
            showToast('🔒 Please sign in or create an account to view full specifications and pricing.');
            setTimeout(() => {
                if (onNavigate) {
                    onNavigate('Auth', {
                        redirectTo: 'ProductDetails',
                        redirectParams: { product, id: product?.id }
                    });
                } else if (onLogin) {
                    onLogin();
                } else if (navigation) {
                    navigation.navigate('Auth', {
                        redirectTo: 'ProductDetails',
                        redirectParams: { product, id: product?.id }
                    });
                }
            }, 600);
            return;
        }

        // Authenticated access granted
        if (onNavigate) {
            onNavigate('ProductDetails', { product, id: product?.id });
        } else if (navigation) {
            navigation.navigate('ProductDetails', { product, id: product?.id });
        }
    };

    // Footer Info Modal Opener
    const openInfoModal = (type) => {
        switch (type) {
            case 'escrow-policy':
                setInfoModal({
                    visible: true,
                    type,
                    title: '100% Escrow Protection Policy',
                    subtitle: 'Bank-Grade Financial Custody & Buyer Shield'
                });
                break;
            case 'buyer-protection':
                setInfoModal({
                    visible: true,
                    type,
                    title: 'Buyer Protection Guarantee',
                    subtitle: 'Genuine Products, Insured Transit & 7-Day Returns'
                });
                break;
            case 'dispute-arbitration':
                setInfoModal({
                    visible: true,
                    type,
                    title: 'Dispute Arbitration Center',
                    subtitle: 'Neutral 24-Hour Resolution & Full Refund Recourse'
                });
                break;
            case 'order-tracking':
                setInfoModal({
                    visible: true,
                    type,
                    title: 'Consignment Tracking Hub',
                    subtitle: 'Enter your Waybill or Tracking ID below'
                });
                setTrackResult(null);
                break;
            case 'help-center':
                setInfoModal({
                    visible: true,
                    type,
                    title: 'Support & Help Center',
                    subtitle: 'Direct 24/7 Concierge & Inquiries'
                });
                break;
            case 'become-seller':
                setInfoModal({
                    visible: true,
                    type,
                    title: 'Become a Verified Merchant',
                    subtitle: 'Sell to 50,000+ Verified Buyers Across Nigeria'
                });
                break;
            case 'terms-of-service':
                setInfoModal({
                    visible: true,
                    type,
                    title: 'Terms of Service',
                    subtitle: 'Platform Agreement & Escrow Protocol'
                });
                break;
            case 'privacy-policy':
                setInfoModal({
                    visible: true,
                    type,
                    title: 'Privacy & Data Protection',
                    subtitle: 'NDPR & 256-Bit Financial Encryption'
                });
                break;
            case 'return-policy':
                setInfoModal({
                    visible: true,
                    type,
                    title: '7-Day Return & Refund Policy',
                    subtitle: 'Buyer Safe Harbor & Reimbursement'
                });
                break;
            default:
                break;
        }
    };

    // Category Footer Handler: Scrolls smoothly to trending section without entering MainApp!
    const handleFooterCategory = (catName) => {
        setSelectedCategory(catName);
        scrollViewRef.current?.scrollTo({ y: 430, animated: true });
        showToast(`Showing ${catName} collection on landing page`);
    };

    const handleSearchSubmit = () => {
        scrollViewRef.current?.scrollTo({ y: 430, animated: true });
    };

    const handleNewsletterSubmit = () => {
        if (!newsletterEmail || !newsletterEmail.includes('@')) {
            Alert.alert('Notice', 'Please provide a valid email address.');
            return;
        }
        Alert.alert('Thank You', `You have been subscribed successfully with: ${newsletterEmail}`);
        setNewsletterEmail('');
    };

    const handleSimulatedTracking = () => {
        if (!trackInput.trim()) {
            Alert.alert('Tracking Error', 'Please enter a valid tracking number.');
            return;
        }
        setTrackResult({
            id: trackInput.trim().toUpperCase(),
            status: 'In Transit via Priority Freight',
            origin: 'Lagos Central Hub',
            destination: `${selectedDeliveryState} Regional Depot`,
            estimatedDelivery: 'Within 24 - 48 Hours',
            escrowStatus: 'Funds Protected in Escrow Vault'
        });
    };

    // Load Live Supabase Data
    const loadData = async () => {
        try {
            const [catsRes, prodsRes, testRes] = await Promise.allSettled([
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
                    .limit(20),
                supabase
                    .from('testimonials')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true })
                    .limit(6)
            ]);

            // Categories
            if (catsRes.status === 'fulfilled' && catsRes.value.data?.length > 0) {
                const dbCats = catsRes.value.data;
                const merged = [{ id: 'all', name: 'All Items', icon: 'sparkles-outline' }];
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

    // Filter and Sort products dynamically
    let displayedProducts = popularProducts.filter(p => {
        const matchesCategory = selectedCategory === 'All Items' ||
            (p.category && p.category.toLowerCase().includes(selectedCategory.toLowerCase()));
        const matchesQuery = !searchQuery.trim() ||
            (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

        // Price Filter
        let matchesPrice = true;
        const numPrice = Number(p.price) || 0;
        if (priceRange === 'under50k') {
            matchesPrice = numPrice < 50000;
        } else if (priceRange === '50k-250k') {
            matchesPrice = numPrice >= 50000 && numPrice <= 250000;
        } else if (priceRange === '250k+') {
            matchesPrice = numPrice > 250000;
        }

        return matchesCategory && matchesQuery && matchesPrice;
    });

    if (sortFilter === 'rating') {
        displayedProducts = [...displayedProducts].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortFilter === 'deals') {
        displayedProducts = [...displayedProducts].sort((a, b) => {
            const discA = a.compare_at_price ? (a.compare_at_price - a.price) : 0;
            const discB = b.compare_at_price ? (b.compare_at_price - b.price) : 0;
            return discB - discA;
        });
    }

    return (
        <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

            {/* ─── LIVE FINANCIAL-GRADE ESCROW STATUS TICKER ─── */}
            <View style={styles.topLiveTicker}>
                <View style={styles.tickerPulseGreen} />
                <Text style={styles.tickerText}>
                    LIVE ESCROW VAULT ACTIVE • ₦2.5B+ SECURED • 24H EXPRESS TRANSIT
                </Text>
            </View>

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
                    <Ionicons name="shield-checkmark" size={18} color="#D9A73A" style={{ marginRight: 8 }} />
                    <Text style={styles.toastText} numberOfLines={2}>{toast.message}</Text>
                </Animated.View>
            )}

            {/* ─── LUXURY CLEAN BRANDING HEADER ─── */}
            <View style={styles.headerCentered}>
                {/* Left: Security Status Indicator */}
                <View style={styles.headerLeftSecurityBadge}>
                    <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                    <Text style={styles.headerLeftSecurityText}>Verified Hub</Text>
                </View>

                {/* Center: Logo & Branding */}
                <TouchableOpacity
                    style={styles.logoAndBrandContainer}
                    activeOpacity={0.9}
                    onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
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

                {/* Right: Sign In / Account Action */}
                <View style={styles.headerRightAction}>
                    <TouchableOpacity
                        onPress={onLogin || (() => navigation.navigate('Auth'))}
                        style={styles.headerLoginButton}
                        activeOpacity={0.85}
                    >
                        <Ionicons
                            name={user ? 'person-circle-outline' : 'log-in-outline'}
                            size={15}
                            color="#D9A73A"
                            style={{ marginRight: 4 }}
                        />
                        <Text style={styles.headerLoginText} numberOfLines={1}>
                            {user ? (user.full_name?.split(' ')[0] || 'Account') : 'Sign In'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ─── SCROLLABLE PAGE CONTAINER ─── */}
            <ScrollView
                ref={scrollViewRef}
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
                                <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                                <Text style={styles.trustPillBadgeText}>100% Escrow & Verified Market</Text>
                            </View>

                            {/* Headline */}
                            <View style={styles.heroHeadlineBlock}>
                                <Text style={styles.heroHeadlineDark}>Shop Smart.</Text>
                                <Text style={styles.heroHeadlineDark}>Sell More.</Text>
                                <Text style={styles.heroHeadlineGold}>Grow Together.</Text>
                            </View>

                            <Text style={styles.heroDescriptionText}>
                                Nigeria's premier multi-vendor marketplace fortified with 100% Escrow Vault protection.
                            </Text>

                            {/* Dual Call To Actions */}
                            <View style={styles.heroButtonsStack}>
                                <TouchableOpacity
                                    onPress={() => scrollViewRef.current?.scrollTo({ y: 430, animated: true })}
                                    style={styles.btnStartShopping}
                                    activeOpacity={0.9}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="bag-handle" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                                        <Text style={styles.btnStartShoppingText} numberOfLines={1}>Browse Market</Text>
                                    </View>
                                    <View style={styles.circleArrowNavy}>
                                        <Ionicons name="arrow-forward" size={12} color="#070F1E" />
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => openInfoModal('become-seller')}
                                    style={styles.btnStartSelling}
                                    activeOpacity={0.9}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="storefront-outline" size={14} color="#D9A73A" style={{ marginRight: 6 }} />
                                        <Text style={styles.btnStartSellingText} numberOfLines={1}>Start Selling</Text>
                                    </View>
                                    <View style={styles.circleArrowGold}>
                                        <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Right Column: Hero Device Mockup with Overlaid Micro-Badges */}
                        <View style={styles.heroRightCol}>
                            <View style={styles.decorCircleLarge} />
                            <View style={styles.decorCircleRing} />
                            <Image
                                source={HERO_MOCKUP}
                                style={styles.heroMockupImage}
                                resizeMode="contain"
                            />

                            {/* Floating Micro-Badge Top Left */}
                            <View style={styles.heroFloatingBadgeTop}>
                                <Ionicons name="shield-checkmark" size={11} color="#10B981" />
                                <Text style={styles.heroFloatingBadgeText}>Escrow Secured</Text>
                            </View>

                            {/* Floating Micro-Badge Bottom Right */}
                            <View style={styles.heroFloatingBadgeBottom}>
                                <Ionicons name="star" size={10} color="#F59E0B" />
                                <Text style={styles.heroFloatingBadgeText}>4.9/5 Rating</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ─── 2. SEARCH & INSTANT DISCOVERY ─── */}
                <View style={styles.searchBarSection}>
                    <View style={styles.searchBox}>
                        <Ionicons name="search-outline" size={19} color="#64748B" style={{ marginRight: 8 }} />
                        <TextInput
                            placeholder="Search verified products, brands, stores..."
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
                                onPress={() => scrollViewRef.current?.scrollTo({ y: 430, animated: true })}
                                style={styles.searchFilterButton}
                            >
                                <Ionicons name="options-outline" size={18} color="#070F1E" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* ─── 3. FEATURE 1: INTERACTIVE CATEGORY CHIP TABS ─── */}
                <View style={styles.categoryChipsSection}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryChipsScroll}
                    >
                        {categories.map((cat, idx) => {
                            const isSelected = selectedCategory === cat.name;
                            return (
                                <TouchableOpacity
                                    key={cat.id || idx}
                                    style={[
                                        styles.categoryChip,
                                        isSelected && styles.categoryChipActive
                                    ]}
                                    onPress={() => setSelectedCategory(cat.name)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={cat.icon || 'grid-outline'}
                                        size={13}
                                        color={isSelected ? '#070F1E' : '#64748B'}
                                        style={{ marginRight: 5 }}
                                    />
                                    <Text
                                        style={[
                                            styles.categoryChipText,
                                            isSelected && styles.categoryChipTextActive
                                        ]}
                                    >
                                        {cat.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* ─── 4. FEATURE 2: DYNAMIC SORT & BUDGET FILTER PILLS ─── */}
                <View style={styles.sortFilterBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortFilterScroll}>
                        <Text style={styles.sortFilterLabel}>Filter:</Text>
                        <TouchableOpacity
                            style={[styles.sortPill, sortFilter === 'featured' && styles.sortPillActive]}
                            onPress={() => setSortFilter('featured')}
                        >
                            <Text style={[styles.sortPillText, sortFilter === 'featured' && styles.sortPillTextActive]}>
                                🔥 Featured
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sortPill, sortFilter === 'rating' && styles.sortPillActive]}
                            onPress={() => setSortFilter('rating')}
                        >
                            <Text style={[styles.sortPillText, sortFilter === 'rating' && styles.sortPillTextActive]}>
                                ⭐ Top Rated
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sortPill, sortFilter === 'deals' && styles.sortPillActive]}
                            onPress={() => setSortFilter('deals')}
                        >
                            <Text style={[styles.sortPillText, sortFilter === 'deals' && styles.sortPillTextActive]}>
                                ⚡ Deals
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.filterDivider} />

                        {/* Budget Pills */}
                        <TouchableOpacity
                            style={[styles.sortPill, priceRange === 'all' && styles.sortPillActive]}
                            onPress={() => setPriceRange('all')}
                        >
                            <Text style={[styles.sortPillText, priceRange === 'all' && styles.sortPillTextActive]}>
                                All Prices
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sortPill, priceRange === 'under50k' && styles.sortPillActive]}
                            onPress={() => setPriceRange('under50k')}
                        >
                            <Text style={[styles.sortPillText, priceRange === 'under50k' && styles.sortPillTextActive]}>
                                Under ₦50K
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sortPill, priceRange === '50k-250k' && styles.sortPillActive]}
                            onPress={() => setPriceRange('50k-250k')}
                        >
                            <Text style={[styles.sortPillText, priceRange === '50k-250k' && styles.sortPillTextActive]}>
                                ₦50K - ₦250K
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sortPill, priceRange === '250k+' && styles.sortPillActive]}
                            onPress={() => setPriceRange('250k+')}
                        >
                            <Text style={[styles.sortPillText, priceRange === '250k+' && styles.sortPillTextActive]}>
                                ₦250K+
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* ─── 5. ELEGANT ESCROW & BANK SECURITY STRIP ─── */}
                <TouchableOpacity
                    style={styles.escrowCompactSection}
                    activeOpacity={0.9}
                    onPress={() => openInfoModal('escrow-policy')}
                >
                    <LinearGradient
                        colors={['#070F1E', '#0A192F', '#0F2746']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.escrowCompactCard}
                    >
                        <View style={styles.escrowCompactHeader}>
                            <View style={styles.escrowShieldIconBadge}>
                                <Ionicons name="shield-checkmark" size={18} color="#10B981" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.escrowCompactTitle}>100% ESCROW BUYER VAULT</Text>
                                    <View style={styles.activeTagBadge}><Text style={styles.activeTagBadgeText}>TAP FOR POLICY</Text></View>
                                </View>
                                <Text style={styles.escrowCompactSub}>Funds are safely preserved in escrow until you receive and verify your package.</Text>
                            </View>
                        </View>

                        {/* 3 Clean Compact Security Pillars */}
                        <View style={styles.escrowPillarsRow}>
                            <View style={styles.escrowPillarItem}>
                                <Ionicons name="wallet-outline" size={15} color="#D9A73A" />
                                <Text style={styles.escrowPillarText}>1. Vault Deposit</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={13} color="#475569" />
                            <View style={styles.escrowPillarItem}>
                                <Ionicons name="cube-outline" size={15} color="#38BDF8" />
                                <Text style={styles.escrowPillarText}>2. Tracked Transit</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={13} color="#475569" />
                            <View style={styles.escrowPillarItem}>
                                <Ionicons name="checkmark-done-circle" size={15} color="#10B981" />
                                <Text style={styles.escrowPillarText}>3. Approve / Refund</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* ─── 6. FLASH DEALS (WITH LIVE COUNTDOWN TIMER & PROGRESS) ─── */}
                {flashSaleProducts.length > 0 && (
                    <View style={styles.flashDealsSection}>
                        <View style={styles.flashHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.flashIconBox}>
                                    <Ionicons name="flash" size={16} color="#EF4444" />
                                </View>
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.flashSectionTitle}>Flash Deals</Text>
                                    <Text style={styles.flashSectionSub}>Limited-time verified clearance sales</Text>
                                </View>
                            </View>
                            <CountdownTimer />
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.flashProductsScroll}
                        >
                            {flashSaleProducts.map((p, idx) => {
                                const discountPct = p.compare_at_price && p.compare_at_price > p.price
                                    ? Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100)
                                    : (p.discount || 15);
                                const progressPct = 65 + ((idx * 11) % 30);

                                return (
                                    <TouchableOpacity
                                        key={p.id}
                                        style={styles.flashDealCard}
                                        activeOpacity={0.92}
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

                                            {/* Minimal Stock Progress Bar */}
                                            <View style={styles.flashStockBar}>
                                                <View style={[styles.flashStockBarFill, { width: `${progressPct}%` }]} />
                                            </View>
                                            <Text style={styles.flashStockText}>⚡ {progressPct}% Claimed</Text>

                                            {/* Security Gate Pill: Login to View */}
                                            <View style={styles.viewLockPill}>
                                                <Ionicons
                                                    name={user ? 'eye-outline' : 'lock-closed'}
                                                    size={11}
                                                    color={user ? '#10B981' : '#D9A73A'}
                                                    style={{ marginRight: 4 }}
                                                />
                                                <Text style={[styles.viewLockPillText, user && { color: '#10B981' }]}>
                                                    {user ? 'View Deal' : 'Sign In to View'}
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* ─── 7. POPULAR PRODUCTS (STRICT AUTH GATE ON CLICK) ─── */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderRow}>
                        <View>
                            <Text style={styles.sectionTitleText}>Trending Marketplace</Text>
                            <Text style={styles.sectionSubtitleText}>
                                {selectedCategory === 'All Items'
                                    ? `Showing ${displayedProducts.length} verified products`
                                    : `${selectedCategory} (${displayedProducts.length} items)`}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => scrollViewRef.current?.scrollTo({ y: 430, animated: true })}
                            style={styles.sectionLinkBtn}
                        >
                            <Text style={styles.sectionLinkText}>Filter</Text>
                            <Ionicons name="arrow-up" size={14} color="#D9A73A" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.popularGridContainer}>
                        {displayedProducts.slice(0, 8).map((product) => (
                            <TouchableOpacity
                                key={product.id}
                                style={styles.productGridCard}
                                activeOpacity={0.92}
                                onPress={() => handleProductPress(product)}
                            >
                                {/* Image Container */}
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

                                    {/* Auth Lock Hint Overlay for guests */}
                                    {!user && (
                                        <View style={styles.productAuthLockBadge}>
                                            <Ionicons name="lock-closed" size={11} color="#FFFFFF" />
                                        </View>
                                    )}
                                </View>

                                {/* Product Details */}
                                <View style={styles.productCardDetails}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={styles.productCardCategory} numberOfLines={1}>
                                            {product.category || 'Marketplace'}
                                        </Text>
                                        <Text style={styles.productOriginTag}>
                                            {product.seller_state || 'Nigeria'}
                                        </Text>
                                    </View>
                                    <Text style={styles.productCardTitle} numberOfLines={2}>
                                        {product.name}
                                    </Text>

                                    {/* Rating & Verified Tag */}
                                    <View style={styles.productRatingRow}>
                                        <Ionicons name="star" size={11} color="#F59E0B" />
                                        <Text style={styles.productRatingText}>
                                            {product.rating ? Number(product.rating).toFixed(1) : '4.8'}
                                        </Text>
                                        <Text style={styles.productReviewsCount}>
                                            ({product.reviews_count || 45})
                                        </Text>
                                        <Text style={styles.verifiedMerchantTag}>• Verified</Text>
                                    </View>

                                    {/* Pricing & Secure Access Action */}
                                    <View style={styles.productPriceRow}>
                                        <View>
                                            <Text style={styles.productCurrentPrice}>{fmtPrice(product.price)}</Text>
                                            {product.compare_at_price ? (
                                                <Text style={styles.productComparePrice}>
                                                    {fmtPrice(product.compare_at_price)}
                                                </Text>
                                            ) : null}
                                        </View>

                                        {/* Security Gated Action Button */}
                                        <View style={[styles.productViewActionBtn, user && styles.productViewActionBtnUser]}>
                                            <Ionicons
                                                name={user ? 'eye-outline' : 'lock-closed'}
                                                size={11}
                                                color={user ? '#10B981' : '#D9A73A'}
                                                style={{ marginRight: 3 }}
                                            />
                                            <Text style={[styles.productViewActionBtnText, user && { color: '#10B981' }]}>
                                                {user ? 'View' : 'Unlock'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ─── 8. DELIVERY ESTIMATOR WIDGET ─── */}
                <View style={styles.deliveryEstimatorSection}>
                    <View style={styles.deliveryEstimatorCard}>
                        <View style={styles.deliveryEstimatorHeader}>
                            <Ionicons name="speedometer-outline" size={20} color="#D9A73A" />
                            <Text style={styles.deliveryEstimatorTitle}>Nationwide Delivery Transit</Text>
                        </View>
                        <Text style={styles.deliveryEstimatorSub}>Select destination hub to view estimated freight timeframe:</Text>

                        <View style={styles.stateSelectorRow}>
                            {['Abuja', 'Lagos', 'Kano', 'Port Harcourt'].map((st) => {
                                const isSel = selectedDeliveryState === st;
                                return (
                                    <TouchableOpacity
                                        key={st}
                                        style={[styles.statePill, isSel && styles.statePillActive]}
                                        onPress={() => setSelectedDeliveryState(st)}
                                    >
                                        <Text style={[styles.statePillText, isSel && styles.statePillTextActive]}>{st}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.deliveryTimeframeResult}>
                            <Ionicons name="flash" size={14} color="#10B981" />
                            <Text style={styles.deliveryTimeframeResultText}>
                                {selectedDeliveryState}: Guaranteed 24 - 48 Hours Insured Cargo Dispatch
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ─── 9. WHY ABU MAFHAL (STREAMLINED LUXURY) ─── */}
                <View style={styles.whySectionContainer}>
                    <View style={styles.centerSectionHeader}>
                        <Text style={styles.centerSectionTitle}>Why Choose Abu Mafhal?</Text>
                        <Text style={styles.centerSectionSub}>Built on bank-grade security, transparency, and verified integrity</Text>
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
                                    <Ionicons name={item.icon} size={22} color={item.color} />
                                </View>
                                <Text style={styles.whyCardTitleText}>{item.title}</Text>
                                <Text style={styles.whyCardDescText}>{item.desc}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* ─── 10. LIVE PLATFORM IMPACT & STATS (ANIMATED) ─── */}
                <View style={styles.statsSectionContainer}>
                    <View style={styles.statsGridCard}>
                        <View style={styles.statsItemCol}>
                            <Ionicons name="people-outline" size={17} color="#D9A73A" style={{ marginBottom: 3 }} />
                            <AnimatedCounter target={50} suffix="K+" />
                            <Text style={styles.statsItemLabel}>Active Buyers</Text>
                        </View>
                        <View style={styles.statsDividerVertical} />

                        <View style={styles.statsItemCol}>
                            <Ionicons name="shield-checkmark-outline" size={17} color="#10B981" style={{ marginBottom: 3 }} />
                            <AnimatedCounter target={2.5} suffix="B+" />
                            <Text style={styles.statsItemLabel}>₦ Escrow Secured</Text>
                        </View>
                        <View style={styles.statsDividerVertical} />

                        <View style={styles.statsItemCol}>
                            <Ionicons name="storefront-outline" size={17} color="#3B82F6" style={{ marginBottom: 3 }} />
                            <AnimatedCounter target={15} suffix="K+" />
                            <Text style={styles.statsItemLabel}>Verified Sellers</Text>
                        </View>
                        <View style={styles.statsDividerVertical} />

                        <View style={styles.statsItemCol}>
                            <Ionicons name="star-outline" size={17} color="#F59E0B" style={{ marginBottom: 3 }} />
                            <AnimatedCounter target={4.9} suffix="/5" />
                            <Text style={styles.statsItemLabel}>Satisfaction</Text>
                        </View>
                    </View>
                </View>

                {/* ─── 11. DIRECT CONCIERGE & WHATSAPP SUPPORT PILL ─── */}
                <View style={styles.conciergeSupportContainer}>
                    <TouchableOpacity
                        style={styles.conciergeSupportCard}
                        activeOpacity={0.9}
                        onPress={() => Linking.openURL('https://wa.me/2348000000000').catch(() => {})}
                    >
                        <View style={styles.conciergeIconBox}>
                            <Ionicons name="logo-whatsapp" size={24} color="#10B981" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.conciergeTitle}>Need Shopping Assistance?</Text>
                            <Text style={styles.conciergeSub}>Chat with our personal shopping concierge on WhatsApp 24/7</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={18} color="#10B981" />
                    </TouchableOpacity>
                </View>

                {/* ─── 12. VERIFIED CUSTOMER TESTIMONIALS ─── */}
                <View style={styles.sectionContainer}>
                    <View style={styles.centerSectionHeader}>
                        <Text style={styles.centerSectionTitle}>Trusted by Thousands</Text>
                        <Text style={styles.centerSectionSub}>Real feedback from verified buyers and sellers nationwide</Text>
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
                                        <Ionicons key={s} name="star" size={13} color="#F59E0B" style={{ marginRight: 2 }} />
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
                                            <Ionicons name="checkmark-circle" size={13} color="#10B981" style={{ marginLeft: 4 }} />
                                        </View>
                                        <Text style={styles.testimonialRoleText}>{t.role || 'Verified User'}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* ─── 13. STREAMLINED LUXURY FOOTER (ALL LINKS OPEN WITHOUT ENTERING APP) ─── */}
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
                        Buy. Sell. Earn. Grow Together. Modern e-commerce ecosystem safeguarded by 100% Escrow Protection.
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
                                <Ionicons name={soc.icon} size={17} color="#D9A73A" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Multi-column Navigation Links (ALL OPEN IN-PAGE MODALS OR IN-PAGE FILTERS) */}
                    <View style={styles.footerLinksGrid}>
                        <View style={styles.footerLinkCol}>
                            <Text style={styles.footerColTitle}>Marketplace</Text>
                            <TouchableOpacity onPress={() => handleFooterCategory('All Items')}>
                                <Text style={styles.footerLinkText}>All Products</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleFooterCategory('Phones & Tablets')}>
                                <Text style={styles.footerLinkText}>Phones & Gadgets</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleFooterCategory('Fashion & Apparel')}>
                                <Text style={styles.footerLinkText}>Fashion & Apparel</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.footerLinkCol}>
                            <Text style={styles.footerColTitle}>Company</Text>
                            <TouchableOpacity onPress={() => openInfoModal('become-seller')}>
                                <Text style={styles.footerLinkText}>Become a Seller</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openInfoModal('escrow-policy')}>
                                <Text style={styles.footerLinkText}>Escrow Policy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openInfoModal('buyer-protection')}>
                                <Text style={styles.footerLinkText}>Buyer Protection</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.footerLinkCol}>
                            <Text style={styles.footerColTitle}>Support</Text>
                            <TouchableOpacity onPress={() => openInfoModal('help-center')}>
                                <Text style={styles.footerLinkText}>Help Center</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openInfoModal('order-tracking')}>
                                <Text style={styles.footerLinkText}>Order Tracking</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openInfoModal('dispute-arbitration')}>
                                <Text style={styles.footerLinkText}>Dispute Arbitration</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Newsletter Box */}
                    <View style={styles.newsletterCard}>
                        <Text style={styles.newsletterCardTitle}>Stay Connected</Text>
                        <Text style={styles.newsletterCardSub}>Get exclusive flash deals and inventory alerts delivered to your inbox.</Text>
                        <View style={styles.newsletterInputRow}>
                            <TextInput
                                placeholder="Enter your email address..."
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
                                <Ionicons name="paper-plane" size={15} color="#070F1E" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bottom Legal & Copyright Bar (All Links Open In-Page Modals) */}
                    <View style={styles.footerBottomLegal}>
                        <View style={styles.footerLegalLinksRow}>
                            <TouchableOpacity onPress={() => openInfoModal('terms-of-service')} activeOpacity={0.7}>
                                <Text style={styles.footerLegalLinkText}>Terms of Service</Text>
                            </TouchableOpacity>
                            <Text style={styles.footerLegalDot}>•</Text>
                            <TouchableOpacity onPress={() => openInfoModal('privacy-policy')} activeOpacity={0.7}>
                                <Text style={styles.footerLegalLinkText}>Privacy Policy</Text>
                            </TouchableOpacity>
                            <Text style={styles.footerLegalDot}>•</Text>
                            <TouchableOpacity onPress={() => openInfoModal('return-policy')} activeOpacity={0.7}>
                                <Text style={styles.footerLegalLinkText}>Return & Refund Policy</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.footerBottomCopy}>
                            © 2026 Abu Mafhal Marketplace. All rights reserved.
                        </Text>
                        <Text style={styles.footerBottomBadge}>
                            🔒 100% Escrow Protection • 256-Bit SSL Encrypted • Regulated Banking Channels
                        </Text>
                    </View>
                </View>

            </ScrollView>

            {/* ─── DEDICATED INFORMATION & POLICY MODAL (OPENS CLEANLY WITHOUT ENTERING MAIN APP) ─── */}
            <Modal
                visible={infoModal.visible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setInfoModal({ visible: false, type: '', title: '', subtitle: '' })}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheetContainer}>
                        {/* Header */}
                        <View style={styles.modalSheetHeader}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={styles.modalSheetTitle}>{infoModal.title}</Text>
                                <Text style={styles.modalSheetSubtitle}>{infoModal.subtitle}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setInfoModal({ visible: false, type: '', title: '', subtitle: '' })}
                                style={styles.modalCloseButton}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="close" size={20} color="#070F1E" />
                            </TouchableOpacity>
                        </View>

                        {/* Modal Body Content */}
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBodyScroll}>
                            {infoModal.type === 'escrow-policy' && (
                                <View style={styles.modalContentBlock}>
                                    <View style={styles.modalHighlightBox}>
                                        <Ionicons name="shield-checkmark" size={22} color="#10B981" />
                                        <Text style={styles.modalHighlightText}>
                                            Your money is 100% safe. Abu Mafhal acts as an impartial escrow vault protecting both buyer and seller on every order.
                                        </Text>
                                    </View>
                                    <Text style={styles.modalSectionHeading}>How the Escrow Process Operates:</Text>
                                    <View style={styles.modalStepItem}>
                                        <View style={styles.modalStepNum}><Text style={styles.modalStepNumText}>1</Text></View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={styles.modalStepTitle}>Secure Vault Custody</Text>
                                            <Text style={styles.modalStepDesc}>When you checkout, your funds are deposited into an independent, CBN-regulated escrow account. The merchant does not receive payout yet.</Text>
                                        </View>
                                    </View>
                                    <View style={styles.modalStepItem}>
                                        <View style={styles.modalStepNum}><Text style={styles.modalStepNumText}>2</Text></View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={styles.modalStepTitle}>Insured Cargo Transit</Text>
                                            <Text style={styles.modalStepDesc}>The merchant dispatches your package using tracked freight logistics. You monitor live location at every checkpoint.</Text>
                                        </View>
                                    </View>
                                    <View style={styles.modalStepItem}>
                                        <View style={styles.modalStepNum}><Text style={styles.modalStepNumText}>3</Text></View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={styles.modalStepTitle}>Inspection & Payout Release</Text>
                                            <Text style={styles.modalStepDesc}>Inspect and verify your item upon receipt. Once you are satisfied, escrow releases payout to the merchant. If defective, receive a 100% refund immediately.</Text>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {infoModal.type === 'buyer-protection' && (
                                <View style={styles.modalContentBlock}>
                                    <View style={styles.modalHighlightBox}>
                                        <Ionicons name="ribbon-outline" size={22} color="#D9A73A" />
                                        <Text style={styles.modalHighlightText}>
                                            Comprehensive Buyer Shield: Genuine products, verified dealers, and instant recourse in case of discrepancy.
                                        </Text>
                                    </View>
                                    <Text style={styles.modalSectionHeading}>Our 3 Pillars of Buyer Safety:</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Authenticity Commitment:</Text> All sellers submit CAC registration or valid NIN credentials prior to listing.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>7-Day Return Window:</Text> Return items in original condition if they fail to match manufacturer specifications.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Freight Loss Coverage:</Text> If consignment is damaged or lost in transit, escrow issues an immediate replacement or full refund.</Text>
                                </View>
                            )}

                            {infoModal.type === 'dispute-arbitration' && (
                                <View style={styles.modalContentBlock}>
                                    <View style={styles.modalHighlightBox}>
                                        <Ionicons name="scale-outline" size={22} color="#3B82F6" />
                                        <Text style={styles.modalHighlightText}>
                                            Fair, impartial dispute settlement mediated by our dedicated 24-hour compliance team.
                                        </Text>
                                    </View>
                                    <Text style={styles.modalSectionHeading}>Arbitration Protocol:</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Instant Dispute Flag:</Text> Tap 'Dispute Order' within 48 hours of delivery to freeze escrow disbursement instantly.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Evidence Review:</Text> Submit unboxing photos or testing videos via our secure portal.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>24-Hour Settlement:</Text> Our compliance department arbitrates and processes refunds directly back to your source account.</Text>
                                </View>
                            )}

                            {infoModal.type === 'order-tracking' && (
                                <View style={styles.modalContentBlock}>
                                    <Text style={styles.modalSectionHeading}>Enter Consignment or Waybill ID:</Text>
                                    <View style={styles.modalTrackingInputRow}>
                                        <TextInput
                                            placeholder="e.g. AM-84920-NG"
                                            placeholderTextColor="#94A3B8"
                                            value={trackInput}
                                            onChangeText={setTrackInput}
                                            style={styles.modalTrackingInput}
                                            autoCapitalize="characters"
                                        />
                                        <TouchableOpacity
                                            style={styles.btnModalTrackSubmit}
                                            onPress={handleSimulatedTracking}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons name="search" size={16} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>

                                    {trackResult && (
                                        <View style={styles.trackingResultCard}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                                <Ionicons name="cube" size={16} color="#10B981" style={{ marginRight: 6 }} />
                                                <Text style={styles.trackingResultId}>Consignment: {trackResult.id}</Text>
                                            </View>
                                            <Text style={styles.trackingResultStatus}>Status: <Text style={{ color: '#10B981', fontWeight: '800' }}>{trackResult.status}</Text></Text>
                                            <Text style={styles.trackingResultRoute}>Route: {trackResult.origin} → {trackResult.destination}</Text>
                                            <Text style={styles.trackingResultDelivery}>ETA: {trackResult.estimatedDelivery}</Text>
                                            <View style={styles.trackingEscrowPill}>
                                                <Ionicons name="shield-checkmark" size={12} color="#D9A73A" />
                                                <Text style={styles.trackingEscrowPillText}>{trackResult.escrowStatus}</Text>
                                            </View>
                                        </View>
                                    )}

                                    <Text style={[styles.modalBulletText, { marginTop: 14 }]}>
                                        💡 Need urgent assistance with your shipment? Contact our 24/7 Logistics Desk directly on WhatsApp.
                                    </Text>
                                </View>
                            )}

                            {infoModal.type === 'help-center' && (
                                <View style={styles.modalContentBlock}>
                                    <Text style={styles.modalSectionHeading}>Connect with Abu Mafhal Support:</Text>
                                    <TouchableOpacity
                                        style={styles.modalSupportOptionCard}
                                        activeOpacity={0.9}
                                        onPress={() => Linking.openURL('https://wa.me/2348000000000').catch(() => {})}
                                    >
                                        <Ionicons name="logo-whatsapp" size={26} color="#10B981" />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.modalSupportOptionTitle}>WhatsApp VIP Concierge</Text>
                                            <Text style={styles.modalSupportOptionSub}>Average reply time: under 3 minutes (24/7)</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color="#64748B" />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.modalSupportOptionCard}
                                        activeOpacity={0.9}
                                        onPress={() => Linking.openURL('mailto:support@abumafhal.com').catch(() => {})}
                                    >
                                        <Ionicons name="mail-outline" size={24} color="#3B82F6" />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.modalSupportOptionTitle}>Email Desk</Text>
                                            <Text style={styles.modalSupportOptionSub}>support@abumafhal.com</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color="#64748B" />
                                    </TouchableOpacity>

                                    <View style={styles.modalSupportOptionCard}>
                                        <Ionicons name="business-outline" size={24} color="#D9A73A" />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.modalSupportOptionTitle}>Headquarters Hub</Text>
                                            <Text style={styles.modalSupportOptionSub}>Abuja Commercial District, FCT, Nigeria</Text>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {infoModal.type === 'become-seller' && (
                                <View style={styles.modalContentBlock}>
                                    <View style={styles.modalHighlightBox}>
                                        <Ionicons name="trending-up" size={22} color="#10B981" />
                                        <Text style={styles.modalHighlightText}>
                                            Reach over 50,000 active buyers across Nigeria with zero listing fees and guaranteed next-day bank disbursements.
                                        </Text>
                                    </View>
                                    <Text style={styles.modalSectionHeading}>Seller Benefits on Abu Mafhal:</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>0% Commission:</Text> Enjoy 0% commission on your first 10 successful deliveries.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Fraud-Free Sales:</Text> Every order is verified with escrow deposits before you dispatch.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Nationwide Logistics:</Text> Access discounted cargo freight and automatic customer waybill printing.</Text>

                                    <TouchableOpacity
                                        style={styles.modalBtnActionPrimary}
                                        onPress={() => {
                                            setInfoModal({ visible: false, type: '', title: '', subtitle: '' });
                                            if (onLogin) onLogin();
                                            else navigation.navigate('Auth', { redirectTo: 'VendorRegister' });
                                        }}
                                        activeOpacity={0.9}
                                    >
                                        <Text style={styles.modalBtnActionPrimaryText}>Sign In / Register as Merchant</Text>
                                        <Ionicons name="arrow-forward" size={16} color="#070F1E" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {infoModal.type === 'terms-of-service' && (
                                <View style={styles.modalContentBlock}>
                                    <View style={styles.modalHighlightBox}>
                                        <Ionicons name="document-text" size={22} color="#10B981" />
                                        <Text style={styles.modalHighlightText}>
                                            All transactions on Abu Mafhal Marketplace are protected by the Escrow Safe Harbor protocol for mutual buyer and seller safety.
                                        </Text>
                                    </View>
                                    <Text style={styles.modalSectionHeading}>Core Platform Rules:</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Escrow Custody:</Text> Payment remains in neutral custody until buyer inspection passes.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Merchant Fulfillment:</Text> Vendors must dispatch genuine items with valid consignment waybills within 48 hours.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Counterfeit Ban:</Text> Zero tolerance for non-genuine goods. Violations lead to immediate termination and full refund to buyer.</Text>
                                </View>
                            )}

                            {infoModal.type === 'privacy-policy' && (
                                <View style={styles.modalContentBlock}>
                                    <View style={styles.modalHighlightBox}>
                                        <Ionicons name="shield-checkmark" size={22} color="#10B981" />
                                        <Text style={styles.modalHighlightText}>
                                            Your personal data and payment credentials are protected with 256-bit SSL encryption under Nigeria Data Protection Regulations (NDPR).
                                        </Text>
                                    </View>
                                    <Text style={styles.modalSectionHeading}>Our Privacy Guarantees:</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Confidentiality:</Text> We do not sell or rent your personal data to third parties.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Secure Channels:</Text> All monetary processing is handled through CBN-licensed payment switches.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Data Sovereignty:</Text> You have the right to request deletion or data portability at any time.</Text>
                                </View>
                            )}

                            {infoModal.type === 'return-policy' && (
                                <View style={styles.modalContentBlock}>
                                    <View style={styles.modalHighlightBox}>
                                        <Ionicons name="repeat" size={22} color="#10B981" />
                                        <Text style={styles.modalHighlightText}>
                                            Every purchase includes our 7-Day Money-Back Guarantee. If goods are damaged, defective, or not as described, return them easily.
                                        </Text>
                                    </View>
                                    <Text style={styles.modalSectionHeading}>Return & Refund Terms:</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Inspection Window:</Text> Buyers have 7 days upon package delivery to inspect items and initiate a return.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Condition:</Text> Items must be in original condition with security tags and serial tags intact.</Text>
                                    <Text style={styles.modalBulletText}>• <Text style={{ fontWeight: '800', color: '#070F1E' }}>Automatic Reimbursement:</Text> Once package return is verified, escrow funds are instantly credited back to your account.</Text>
                                </View>
                            )}
                        </ScrollView>

                        {/* Footer dismiss button */}
                        <TouchableOpacity
                            style={styles.modalDismissBtn}
                            onPress={() => setInfoModal({ visible: false, type: '', title: '', subtitle: '' })}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modalDismissBtnText}>Close Window</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    topLiveTicker: {
        backgroundColor: '#070F1E',
        paddingVertical: 5,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 167, 58, 0.25)',
    },
    tickerPulseGreen: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
        marginRight: 6,
    },
    tickerText: {
        color: '#D9A73A',
        fontSize: 7.8,
        fontWeight: '900',
        letterSpacing: 1.2,
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
        paddingTop: Platform.OS === 'ios' ? 8 : 10,
        paddingBottom: 10,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerLeftSecurityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    headerLeftSecurityText: {
        color: '#10B981',
        fontSize: 9.5,
        fontWeight: '800',
    },
    logoAndBrandContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoCircleContainer: {
        width: 46,
        height: 46,
        borderRadius: 23,
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
        width: 38,
        height: 38,
        borderRadius: 19,
    },
    brandTitleRow: {
        flexDirection: 'row',
        marginTop: 4,
        alignItems: 'center',
    },
    brandTitleAbu: {
        fontSize: 16.5,
        fontWeight: '900',
        color: '#070F1E',
        letterSpacing: 0.5,
    },
    brandTitleMafhal: {
        fontSize: 16.5,
        fontWeight: '900',
        color: '#D9A73A',
        letterSpacing: 0.5,
    },
    brandSubtitle: {
        fontSize: 7.5,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 1.8,
        marginTop: 1,
    },
    headerRightAction: {
        alignItems: 'flex-end',
    },
    headerLoginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        borderWidth: 1,
        borderColor: '#D9A73A',
        paddingHorizontal: 9,
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
        paddingTop: 8,
        paddingBottom: 4,
    },
    heroRow: {
        flexDirection: 'row',
        paddingLeft: 16,
        paddingRight: 0,
        alignItems: 'center',
        minHeight: 380,
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
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: '#E2E8F0',
        bottom: 20,
        right: -10,
        opacity: 0.5,
        zIndex: 0,
    },
    decorCircleRing: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
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
    heroFloatingBadgeTop: {
        position: 'absolute',
        top: 60,
        left: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(7, 15, 30, 0.88)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.4)',
        zIndex: 2,
    },
    heroFloatingBadgeBottom: {
        position: 'absolute',
        bottom: 60,
        right: 35,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
        zIndex: 2,
    },
    heroFloatingBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '800',
    },
    trustPillBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 14,
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
        fontSize: 26,
        fontWeight: '900',
        color: '#070F1E',
        letterSpacing: -0.6,
        lineHeight: 30,
    },
    heroHeadlineGold: {
        fontSize: 26,
        fontWeight: '900',
        color: '#D9A73A',
        letterSpacing: -0.6,
        lineHeight: 30,
        marginTop: 1,
        marginBottom: 7,
    },
    heroDescriptionText: {
        fontSize: 10.5,
        color: '#475569',
        lineHeight: 15,
        fontWeight: '600',
    },
    heroButtonsStack: {
        flexDirection: 'column',
        gap: 8,
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
        fontSize: 11.5,
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
        fontSize: 11.5,
    },
    circleArrowGold: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#D9A73A',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ─── Search Bar ───
    searchBarSection: {
        paddingHorizontal: 16,
        marginTop: 16,
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

    // ─── Category Chip Tabs ───
    categoryChipsSection: {
        marginTop: 12,
    },
    categoryChipsScroll: {
        paddingHorizontal: 16,
        gap: 8,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    categoryChipActive: {
        backgroundColor: '#D9A73A',
        borderColor: '#D9A73A',
    },
    categoryChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    categoryChipTextActive: {
        color: '#070F1E',
        fontWeight: '900',
    },

    // ─── Dynamic Sort Bar ───
    sortFilterBar: {
        paddingTop: 10,
    },
    sortFilterScroll: {
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    sortFilterLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    sortPill: {
        paddingHorizontal: 9,
        paddingVertical: 4.5,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    sortPillActive: {
        backgroundColor: '#070F1E',
        borderColor: '#D9A73A',
    },
    sortPillText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#475569',
    },
    sortPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    filterDivider: {
        width: 1,
        height: 16,
        backgroundColor: '#CBD5E1',
        marginHorizontal: 3,
    },

    // ─── Compact Escrow Security Strip ───
    escrowCompactSection: {
        paddingHorizontal: 16,
        marginTop: 16,
    },
    escrowCompactCard: {
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#D9A73A40',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    escrowCompactHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    escrowShieldIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    escrowCompactTitle: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    activeTagBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
        marginLeft: 6,
    },
    activeTagBadgeText: {
        color: '#FFFFFF',
        fontSize: 7,
        fontWeight: '900',
    },
    escrowCompactSub: {
        color: '#94A3B8',
        fontSize: 9,
        fontWeight: '500',
        marginTop: 2,
    },
    escrowPillarsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    escrowPillarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    escrowPillarText: {
        color: '#E2E8F0',
        fontSize: 9,
        fontWeight: '700',
    },

    // ─── Flash Deals ───
    flashDealsSection: {
        marginTop: 22,
        backgroundColor: '#FFF7ED',
        paddingVertical: 16,
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
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    flashSectionTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#070F1E',
    },
    flashSectionSub: {
        fontSize: 9,
        color: '#64748B',
        fontWeight: '600',
    },
    flashProductsScroll: {
        paddingHorizontal: 16,
        gap: 12,
    },
    flashDealCard: {
        width: 140,
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
        height: 115,
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
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 5,
    },
    flashDiscountBadgeText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
    },
    flashCardBody: {
        padding: 9,
    },
    flashProductName: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 2,
    },
    flashProductPrice: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#070F1E',
    },
    flashStockBar: {
        height: 3.5,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        marginTop: 5,
        overflow: 'hidden',
    },
    flashStockBarFill: {
        height: '100%',
        backgroundColor: '#EF4444',
        borderRadius: 2,
    },
    flashStockText: {
        fontSize: 7.5,
        fontWeight: '700',
        color: '#EF4444',
        marginTop: 2,
    },
    viewLockPill: {
        marginTop: 6,
        backgroundColor: '#F8FAFC',
        borderRadius: 6,
        paddingVertical: 4,
        paddingHorizontal: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    viewLockPillText: {
        color: '#D9A73A',
        fontSize: 8.5,
        fontWeight: '800',
    },

    // ─── Popular Products Grid ───
    sectionContainer: {
        marginTop: 24,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    sectionTitleText: {
        fontSize: 16.5,
        fontWeight: '900',
        color: '#070F1E',
        letterSpacing: -0.3,
    },
    sectionSubtitleText: {
        fontSize: 9.5,
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
        height: 140,
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
    productAuthLockBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(7, 15, 30, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productCardDetails: {
        padding: 10,
    },
    productCardCategory: {
        fontSize: 8.5,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    productOriginTag: {
        fontSize: 8,
        color: '#64748B',
        fontWeight: '700',
    },
    productCardTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#070F1E',
        marginTop: 3,
        lineHeight: 15,
        minHeight: 30,
    },
    productRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
        gap: 3,
    },
    productRatingText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#1E293B',
    },
    productReviewsCount: {
        fontSize: 8.5,
        color: '#94A3B8',
    },
    verifiedMerchantTag: {
        fontSize: 8,
        color: '#10B981',
        fontWeight: '700',
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
        fontSize: 12.5,
        fontWeight: '900',
        color: '#070F1E',
    },
    productComparePrice: {
        fontSize: 9,
        color: '#94A3B8',
        textDecorationLine: 'line-through',
    },
    productViewActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(217, 167, 58, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D9A73A40',
    },
    productViewActionBtnUser: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: '#10B98140',
    },
    productViewActionBtnText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#D9A73A',
    },

    // ─── Delivery Estimator Widget ───
    deliveryEstimatorSection: {
        paddingHorizontal: 16,
        marginTop: 20,
    },
    deliveryEstimatorCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
    },
    deliveryEstimatorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    deliveryEstimatorTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#070F1E',
    },
    deliveryEstimatorSub: {
        fontSize: 9.5,
        color: '#64748B',
        marginTop: 3,
        marginBottom: 8,
    },
    stateSelectorRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    statePill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
    },
    statePillActive: {
        backgroundColor: '#070F1E',
    },
    statePillText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#475569',
    },
    statePillTextActive: {
        color: '#D9A73A',
        fontWeight: '800',
    },
    deliveryTimeframeResult: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
    },
    deliveryTimeframeResultText: {
        color: '#065F46',
        fontSize: 9.5,
        fontWeight: '700',
        flex: 1,
    },

    // ─── Why Abu Mafhal ───
    whySectionContainer: {
        marginTop: 28,
        backgroundColor: '#FFFFFF',
        paddingVertical: 22,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
    },
    centerSectionHeader: {
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 14,
    },
    centerSectionTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#070F1E',
        textAlign: 'center',
    },
    centerSectionSub: {
        fontSize: 10.5,
        color: '#64748B',
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 3,
    },
    goldUnderline: {
        width: 40,
        height: 3,
        backgroundColor: '#D9A73A',
        borderRadius: 2,
        marginTop: 7,
    },
    whyCardsScroll: {
        paddingHorizontal: 16,
        gap: 12,
        paddingBottom: 4,
    },
    whyCardItem: {
        width: 200,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 15,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    whyCardIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    whyCardTitleText: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#070F1E',
        marginBottom: 3,
    },
    whyCardDescText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#64748B',
        lineHeight: 14,
    },

    // ─── Live Stats ───
    statsSectionContainer: {
        paddingHorizontal: 16,
        marginTop: 22,
    },
    statsGridCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    statsItemCol: {
        flex: 1,
        alignItems: 'center',
    },
    statsNumber: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#070F1E',
    },
    statsItemLabel: {
        fontSize: 7.5,
        fontWeight: '700',
        color: '#64748B',
        textAlign: 'center',
        marginTop: 2,
    },
    statsDividerVertical: {
        width: 1,
        height: 26,
        backgroundColor: '#E2E8F0',
    },

    // ─── Concierge WhatsApp Support Pill ───
    conciergeSupportContainer: {
        paddingHorizontal: 16,
        marginTop: 20,
    },
    conciergeSupportCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    conciergeIconBox: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    conciergeTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#070F1E',
    },
    conciergeSub: {
        fontSize: 9.5,
        color: '#64748B',
        marginTop: 1,
    },

    // ─── Testimonials ───
    testimonialsScrollContent: {
        paddingHorizontal: 16,
        gap: 12,
        paddingBottom: 6,
    },
    testimonialCardItem: {
        width: 240,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
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
        marginBottom: 6,
    },
    testimonialQuoteText: {
        fontSize: 10.5,
        fontWeight: '500',
        color: '#334155',
        lineHeight: 15,
        fontStyle: 'italic',
        minHeight: 45,
    },
    testimonialAuthorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    testimonialAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E2E8F0',
    },
    testimonialNameText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#070F1E',
    },
    testimonialRoleText: {
        fontSize: 8.5,
        color: '#64748B',
        fontWeight: '500',
    },

    // ─── Footer ───
    footerSection: {
        backgroundColor: '#070F1E',
        marginTop: 32,
        paddingTop: 24,
        paddingBottom: 22,
        paddingHorizontal: 16,
    },
    footerBrandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    footerLogoFrame: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#D9A73A',
    },
    footerLogoImg: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    footerBrandTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    footerBrandSub: {
        fontSize: 7.5,
        fontWeight: '800',
        color: '#D9A73A',
        letterSpacing: 1.5,
    },
    footerMissionBlurb: {
        fontSize: 10,
        color: '#94A3B8',
        lineHeight: 15,
        marginTop: 10,
        fontWeight: '500',
    },
    footerSocialIconsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
        marginBottom: 16,
    },
    footerSocialCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
    },
    footerLinksGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    footerLinkCol: {
        flex: 1,
    },
    footerColTitle: {
        fontSize: 10.5,
        fontWeight: '900',
        color: '#D9A73A',
        marginBottom: 6,
    },
    footerLinkText: {
        fontSize: 9,
        color: '#CBD5E1',
        fontWeight: '500',
        marginBottom: 5,
    },
    newsletterCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 14,
        padding: 12,
        marginTop: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    newsletterCardTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    newsletterCardSub: {
        fontSize: 8.5,
        color: '#94A3B8',
        marginTop: 2,
        marginBottom: 8,
    },
    newsletterInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    newsletterInput: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: Platform.OS === 'ios' ? 8 : 4,
        color: '#FFFFFF',
        fontSize: 10.5,
    },
    btnNewsletterSubmit: {
        backgroundColor: '#D9A73A',
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    footerBottomLegal: {
        marginTop: 18,
        alignItems: 'center',
    },
    footerLegalLinksRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginBottom: 8,
        gap: 6,
    },
    footerLegalLinkText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#D9A73A',
    },
    footerLegalDot: {
        fontSize: 9,
        color: '#64748B',
    },
    footerBottomCopy: {
        fontSize: 8.5,
        color: '#64748B',
        textAlign: 'center',
    },
    footerBottomBadge: {
        fontSize: 7.5,
        color: '#10B981',
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 3,
    },

    // ─── Interactive In-Page Policy & Info Modal Styles ───
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(7, 15, 30, 0.75)',
        justifyContent: 'flex-end',
    },
    modalSheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 18,
        paddingBottom: Platform.OS === 'ios' ? 36 : 20,
        paddingHorizontal: 20,
        maxHeight: Dimensions.get('window').height * 0.82,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    modalSheetHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalSheetTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#070F1E',
        letterSpacing: -0.3,
    },
    modalSheetSubtitle: {
        fontSize: 10.5,
        color: '#64748B',
        marginTop: 2,
        fontWeight: '500',
    },
    modalCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBodyScroll: {
        paddingVertical: 16,
    },
    modalContentBlock: {
        gap: 12,
    },
    modalHighlightBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 10,
    },
    modalHighlightText: {
        fontSize: 11,
        color: '#1E293B',
        lineHeight: 16,
        fontWeight: '600',
        flex: 1,
    },
    modalSectionHeading: {
        fontSize: 13,
        fontWeight: '900',
        color: '#070F1E',
        marginTop: 6,
    },
    modalStepItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 8,
    },
    modalStepNum: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#070F1E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalStepNumText: {
        color: '#D9A73A',
        fontSize: 10,
        fontWeight: '900',
    },
    modalStepTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#070F1E',
    },
    modalStepDesc: {
        fontSize: 10.5,
        color: '#64748B',
        lineHeight: 15,
        marginTop: 2,
    },
    modalBulletText: {
        fontSize: 11,
        color: '#475569',
        lineHeight: 17,
    },
    modalTrackingInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    modalTrackingInput: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 6,
        fontSize: 12,
        color: '#070F1E',
        fontWeight: '700',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    btnModalTrackSubmit: {
        backgroundColor: '#070F1E',
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackingResultCard: {
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#BBF7D0',
        marginTop: 12,
    },
    trackingResultId: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#166534',
    },
    trackingResultStatus: {
        fontSize: 11,
        color: '#1E293B',
        marginBottom: 3,
    },
    trackingResultRoute: {
        fontSize: 10,
        color: '#64748B',
        marginBottom: 2,
    },
    trackingResultDelivery: {
        fontSize: 10,
        fontWeight: '700',
        color: '#070F1E',
        marginBottom: 8,
    },
    trackingEscrowPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 4,
        borderWidth: 1,
        borderColor: '#D9A73A50',
    },
    trackingEscrowPillText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#070F1E',
    },
    modalSupportOptionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginTop: 8,
    },
    modalSupportOptionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#070F1E',
    },
    modalSupportOptionSub: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 1,
    },
    modalBtnActionPrimary: {
        backgroundColor: '#D9A73A',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        gap: 8,
    },
    modalBtnActionPrimaryText: {
        color: '#070F1E',
        fontSize: 12.5,
        fontWeight: '900',
    },
    modalDismissBtn: {
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    modalDismissBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
    },
});
