import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Dimensions, Platform, StatusBar, StyleSheet, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppSettings } from '../context/AppSettingsContext';
import { supabase } from '../lib/supabase';
import { CountdownTimer } from '../components/CountdownTimer';

const { width } = Dimensions.get('window');

// Existing Trust Strip Items
const TRUST_ITEMS = [
    { icon: 'shield-checkmark-outline', label: 'Secure Payments', color: '#10B981' },
    { icon: 'airplane-outline', label: 'Priority Cargo', color: '#3B82F6' },
    { icon: 'headset-outline', label: '24/7 Verified Help', color: '#8B5CF6' },
];

// Why Choose Us Items
const WHY_CHOOSE_US = [
    { id: 1, icon: 'shield-checkmark-outline', title: 'Secure Payments', desc: 'Your payments are 100% secure and encrypted.', color: '#10B981', bgColor: '#E6F4EA' },
    { id: 2, icon: 'sparkles-outline', title: 'AI Smart Assistant', desc: 'Smart recommendations and better search results.', color: '#8B5CF6', bgColor: '#F3E8FF' },
    { id: 3, icon: 'airplane-outline', title: 'Fast Delivery', desc: 'Get your orders delivered fast and safe.', color: '#D9A73A', bgColor: '#FEF3C7' },
    { id: 4, icon: 'pricetag-outline', title: 'Best Prices', desc: 'Enjoy the best prices and exclusive deals everyday.', color: '#EF4444', bgColor: '#FEE2E2' },
    { id: 5, icon: 'people-outline', title: 'Trusted Community', desc: 'Join thousands of verified buyers and sellers.', color: '#3B82F6', bgColor: '#E0F2FE' },
];

// Popular Products Mockup Fallbacks (in case DB is temporarily offline/empty)
const POPULAR_FALLBACKS = [
    {
        id: 'pop-1',
        name: 'iPhone 15 Pro Max',
        price: 1250000,
        oldPrice: 1470000,
        discount: 15,
        rating: 4.8,
        reviews_count: 128,
        category: 'Phones',
        image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300'
    },
    {
        id: 'pop-2',
        name: 'Apple Watch Series 9',
        price: 390000,
        oldPrice: 450000,
        discount: 20,
        rating: 4.7,
        reviews_count: 98,
        category: 'Accessories',
        image: 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=300'
    },
    {
        id: 'pop-3',
        name: 'Nike Air Jordan 1',
        price: 85000,
        oldPrice: 95000,
        discount: 10,
        rating: 4.6,
        reviews_count: 76,
        category: 'Fashion',
        image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=300'
    },
    {
        id: 'pop-4',
        name: 'Dior Sauvage EDT',
        price: 78000,
        oldPrice: 95000,
        discount: 18,
        rating: 4.9,
        reviews_count: 65,
        category: 'Beauty',
        image: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=300'
    }
];

// Testimonials Mockup Fallbacks
const TESTIMONIALS_FALLBACK = [
    {
        id: 't-1',
        quote: "Abu Mafhal has made it so easy to reach more customers and grow my business.",
        name: "Ahmed S.",
        role: "Verified Seller",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        rating: 5,
        is_verified: true
    },
    {
        id: 't-2',
        quote: "I found exactly what I was looking for at the best price with fast delivery.",
        name: "Fatima A.",
        role: "Verified Buyer",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        rating: 5,
        is_verified: true
    }
];

// Animated Counter helper component for React Native
const AnimatedCounter = ({ target, suffix = '', duration = 1000 }) => {
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
        <Text style={localStyles.statsNumber}>
            {count.toLocaleString()}
            {suffix}
        </Text>
    );
};

export const LandingPage = ({ navigation, onEnterShop, cartCount, onGoToCart, onLogin, user, onGoToProfile, onNavigate, addToCart }) => {
    const { settings } = useAppSettings();
    const [recommended, setRecommended] = useState([]);
    const [flashSale, setFlashSale] = useState([]);
    const [categories, setCategories] = useState([]);
    const [popularProducts, setPopularProducts] = useState([]);
    const [testimonials, setTestimonials] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [wishlist, setWishlist] = useState({});
    const [newsletterEmail, setNewsletterEmail] = useState('');
    const [homeBanner, setHomeBanner] = useState(null);

    const [targetDate, setTargetDate] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() + 2); // 2 hours from now
        return d.toISOString();
    });

    const handleEnterShop = (tab = 'home', category = undefined) => {
        if (!user) {
            onNavigate('Auth', {
                redirectTo: 'Main',
                redirectParams: { screen: tab, category }
            });
        } else {
            navigation.navigate('Main', { screen: tab, category });
        }
    };

    const handleSearchSubmit = () => {
        if (!user) {
            onNavigate('Auth', {
                redirectTo: 'Main',
                redirectParams: { screen: 'shop', query: searchQuery }
            });
        } else {
            navigation.navigate('Main', { screen: 'shop', query: searchQuery });
        }
    };

    const handleBecomeSeller = () => {
        if (!user) {
            onNavigate('Auth', {
                redirectTo: 'Main',
                redirectParams: { screen: 'profile' }
            });
        } else {
            navigation.navigate('Main', { screen: 'profile' });
        }
    };

    const toggleWishlist = (id) => {
        setWishlist(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleNewsletterSubmit = () => {
        if (!newsletterEmail) return;
        Alert.alert('Success', `Subscription request received for: ${newsletterEmail}`);
        setNewsletterEmail('');
    };

    useEffect(() => {
        const fetchLandingProducts = async () => {
            try {
                // 1. Fetch Categories: Select unique categories from products, merge with default categories
                const { data: distinctCats } = await supabase
                    .from('products')
                    .select('category')
                    .eq('is_active', true);
                
                const dbCategories = distinctCats ? [...new Set(distinctCats.map(p => p.category).filter(Boolean))] : [];
                
                const defaultCats = [
                    { id: 'cat-elect', name: 'Electronics', icon: 'desktop-outline' },
                    { id: 'cat-fashion', name: 'Fashion', icon: 'shirt-outline' },
                    { id: 'cat-phones', name: 'Phones', icon: 'phone-portrait-outline' },
                    { id: 'cat-home', name: 'Home & Living', icon: 'home-outline' },
                    { id: 'cat-beauty', name: 'Beauty', icon: 'sparkles-outline' },
                    { id: 'cat-services', name: 'Services', icon: 'build-outline' },
                    { id: 'cat-digital', name: 'Digital Products', icon: 'document-text-outline' }
                ];

                const finalCats = [...defaultCats];
                dbCategories.forEach(dbCat => {
                    if (!finalCats.some(c => c.name.toLowerCase() === dbCat.toLowerCase())) {
                        finalCats.push({
                            id: `cat-${dbCat.toLowerCase()}`,
                            name: dbCat,
                            icon: 'grid-outline'
                        });
                    }
                });
                setCategories(finalCats);

                // 2. Fetch Flash Sale Products from flash_sales table (NO FALLBACK/MOCK DATA)
                const now = new Date().toISOString();
                try {
                    const { data: saleData, error: saleErr } = await supabase
                        .from('flash_sales')
                        .select('*')
                        .eq('is_active', true)
                        .gt('end_time', now)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (!saleErr && saleData && saleData.product_ids && saleData.product_ids.length > 0) {
                        if (saleData.end_time) {
                            setTargetDate(saleData.end_time);
                        }

                        const { data: prods, error: prodsErr } = await supabase
                            .from('products')
                            .select('*')
                            .in('id', saleData.product_ids)
                            .eq('is_active', true);

                        if (!prodsErr && prods && prods.length > 0) {
                            const discountPercentage = saleData.discount_percent || 20;
                            const flashProducts = prods.map(p => ({
                                ...p,
                                discount: p.compare_at_price && p.compare_at_price > p.price
                                    ? Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100)
                                    : discountPercentage
                            }));
                            setFlashSale(flashProducts);
                        } else {
                            setFlashSale([]);
                        }
                    } else {
                        setFlashSale([]);
                    }
                } catch (e) {
                    console.log('Error loading flash sales:', e.message);
                    setFlashSale([]);
                }

                // 3. Fetch Popular Products from products table (sort by rating or active)
                const { data: prodsData, error: prodsError } = await supabase
                    .from('products')
                    .select('*')
                    .eq('is_active', true)
                    .order('rating', { ascending: false })
                    .limit(10);

                if (!prodsError && prodsData && prodsData.length > 0) {
                    const mappedProds = prodsData.map(p => ({
                        id: p.id,
                        name: p.name,
                        price: p.price,
                        oldPrice: p.compare_at_price || p.original_price,
                        discount: p.compare_at_price && p.compare_at_price > p.price
                            ? Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100)
                            : null,
                        rating: p.rating || 5.0,
                        reviews_count: p.reviews_count || 0,
                        category: p.category || 'Product',
                        image: Array.isArray(p.images) ? p.images[0] : p.images || 'https://placehold.co/300'
                    }));
                    setPopularProducts(mappedProds);
                    setRecommended(prodsData);
                } else {
                    setPopularProducts(POPULAR_FALLBACKS);
                    setRecommended([]);
                }

                // 4. Fetch Testimonials from testimonials table
                const { data: testData, error: testErr } = await supabase
                    .from('testimonials')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order');
                if (!testErr && testData && testData.length > 0) {
                    setTestimonials(testData);
                } else {
                    setTestimonials([]);
                }

                // Fetch active banner for 'home' or 'all'
                const { data: bAll, error: bannerErr } = await supabase
                    .from('banners')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order', { ascending: true });

                if (!bannerErr && bAll) {
                    const homeB = bAll.find(b => !b.section || b.section === 'home' || b.section === 'all');
                    setHomeBanner(homeB || null);
                } else {
                    setHomeBanner(null);
                }

            } catch (err) {
                console.warn('LandingPage: Failed to load Supabase assets', err.message);
                setPopularProducts(POPULAR_FALLBACKS);
            }
        };
        fetchLandingProducts();
    }, []);

    return (
        <SafeAreaView style={localStyles.safeContainer}>
            <StatusBar barStyle="dark-content" backgroundColor="#F5F3EB" />

            {/* Real Centered branding header */}
            <View style={localStyles.headerCentered}>
                <View style={localStyles.logoContainer}>
                    <Image
                        source={settings?.logo_url ? { uri: settings.logo_url } : require('../../assets/am_logo.png')}
                        style={localStyles.logoImageMark}
                        resizeMode="contain"
                    />
                </View>
                <View style={localStyles.brandTextRow}>
                    <Text style={localStyles.brandTextAbu}>ABU </Text>
                    <Text style={localStyles.brandTextMafhal}>MAFHAL</Text>
                </View>
                <Text style={localStyles.brandSubCentered}>ONLINE MARKETPLACE</Text>

                <TouchableOpacity onPress={onLogin} style={localStyles.headerLoginAbsolute} activeOpacity={0.8}>
                    <Ionicons name="log-in-outline" size={14} color="#D9A73A" style={{ marginRight: 4 }} />
                    <Text style={localStyles.headerLoginText}>Sign In</Text>
                </TouchableOpacity>
            </View>

            {/* Scrollable Container */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60 }}
                scrollEventThrottle={16}
            >
                {/* ─── Hero Section ─── */}
                <View style={localStyles.heroRow}>
                    {/* Left Column: text and buttons */}
                    <View style={localStyles.heroLeftCol}>
                        {/* Trust Badge */}
                        <View style={localStyles.pillBadgeContainer}>
                            <View style={localStyles.pillBadge}>
                                <Ionicons name="people" size={12} color="#0E1A2E" />
                                <Text style={localStyles.pillBadgeText}>Trusted by thousands across the community</Text>
                            </View>
                        </View>

                        {/* Headline */}
                        <View style={localStyles.heroTextContainer}>
                            <Text style={localStyles.heroLine1}>Shop Smart.</Text>
                            <Text style={localStyles.heroLine2}>Sell More.</Text>
                            <Text style={localStyles.heroLineGold}>Grow Together.</Text>
                            <Text style={localStyles.heroDescription}>
                                The all-in-one marketplace for everyone. Buy, sell, earn and grow with secure payments and fast delivery you can trust.
                            </Text>
                        </View>

                        {/* Hero Buttons stacked vertically */}
                        <View style={localStyles.heroButtonsContainer}>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')} style={localStyles.btnStartShopping} activeOpacity={0.9}>
                                <Text style={localStyles.btnStartShoppingText} numberOfLines={1}>Start Shopping</Text>
                                <View style={localStyles.circleArrowWhite}>
                                    <Ionicons name="arrow-forward" size={12} color="#0E1A2E" />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleBecomeSeller} style={localStyles.btnStartSelling} activeOpacity={0.9}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="storefront-outline" size={14} color="#D9A73A" style={{ marginRight: 5 }} />
                                    <Text style={localStyles.btnStartSellingText} numberOfLines={1}>Start Selling</Text>
                                </View>
                                <View style={localStyles.circleArrowGold}>
                                    <Ionicons name="arrow-forward" size={12} color="white" />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Right Column: custom illustration + backdrop circles */}
                    <View style={localStyles.heroRightCol}>
                        <View style={localStyles.decorCircle1} />
                        <View style={localStyles.decorCircle2} />
                        <Image
                            source={require('../../assets/hero_mockup.png')}
                            style={localStyles.heroMockupImage}
                            resizeMode="contain"
                        />
                    </View>
                </View>

                {/* ─── Interactive Visual Area ─── */}
                {/* Search Bar */}
                <View style={localStyles.searchBarContainer}>
                    <View style={localStyles.searchBox}>
                        <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                        <TextInput
                            placeholder="Search premium products..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearchSubmit}
                            style={localStyles.searchBoxInput}
                        />
                        <TouchableOpacity onPress={() => handleEnterShop('shop')} style={localStyles.searchFilterIcon}>
                            <Ionicons name="options-outline" size={18} color="#0E1A2E" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Slim Promo Banner from Admin */}
                {homeBanner && (
                    <View style={localStyles.promoContainer}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => {
                                if (homeBanner.action_link) {
                                    try {
                                        const parsed = JSON.parse(homeBanner.action_link);
                                        if (parsed && parsed.screen) {
                                            navigation.navigate(parsed.screen, parsed.params);
                                            return;
                                        }
                                    } catch (_) {}
                                    handleEnterShop('shop');
                                } else {
                                    handleEnterShop('shop');
                                }
                            }}
                            style={localStyles.slimBannerTouch}
                        >
                            <Image
                                source={{ uri: homeBanner.image_url }}
                                style={localStyles.slimBannerImage}
                                resizeMode="cover"
                            />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Curated Categories */}
                <View style={localStyles.sectionContainer}>
                    <View style={localStyles.sectionHeaderRow}>
                        <Text style={localStyles.sectionTitleText}>Categories</Text>
                        <TouchableOpacity onPress={() => handleEnterShop('shop')}>
                            <Text style={localStyles.sectionLinkText}>See all</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.categoriesScrollContainer}>
                        {categories.map((cat, index) => (
                            <TouchableOpacity key={cat.id || index} style={localStyles.categoryCard} onPress={() => handleEnterShop('shop', cat.name)}>
                                <View style={localStyles.categoryIconBox}>
                                    <Ionicons name={cat.icon || 'grid-outline'} size={20} color="#D9A73A" />
                                </View>
                                <Text style={localStyles.categoryText}>{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Flash Deals with Timer */}
                {flashSale && flashSale.length > 0 && (
                    <View style={localStyles.sectionContainer}>
                        <View style={localStyles.sectionHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text style={localStyles.sectionTitleText}>Flash Deals</Text>
                                <CountdownTimer targetDate={targetDate} />
                            </View>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}>
                                <Text style={localStyles.sectionLinkText}>See all</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
                            {flashSale.map((item, i) => (
                                <TouchableOpacity
                                    key={item.id || i}
                                    style={localStyles.flashDealCard}
                                    onPress={() => {
                                        if (!user) {
                                            onNavigate('Auth', {
                                                redirectTo: 'ProductDetails',
                                                redirectParams: { product: item }
                                            });
                                        } else {
                                            navigation.navigate('ProductDetails', { product: item });
                                        }
                                    }}
                                >
                                    <Image source={{ uri: Array.isArray(item.images) ? item.images[0] : item.image || 'https://placehold.co/200' }} style={localStyles.flashDealImg} />
                                    <View style={localStyles.flashDiscountBadge}>
                                        <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>-{item.discount || 15}%</Text>
                                    </View>
                                    <View style={{ padding: 12 }}>
                                        <Text style={localStyles.flashDealName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={localStyles.flashDealPrice}>₦{item.price ? item.price.toLocaleString() : '0'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* ─── Feature Highlights Section ─── */}
                <View style={localStyles.featureHighlightsContainer}>
                    <View style={localStyles.centerHeader}>
                        <Text style={localStyles.centerHeaderText}>Key Highlights</Text>
                        <View style={localStyles.goldAccentLine} />
                    </View>
                    <View style={localStyles.featureGrid}>
                        <View style={localStyles.featureCard}>
                            <View style={[localStyles.featureIconCircle, { backgroundColor: '#E6F4EA' }]}>
                                <Ionicons name="shield-checkmark-outline" size={22} color="#10B981" />
                            </View>
                            <Text style={localStyles.featureTitle}>Secure Payments</Text>
                            <Text style={localStyles.featureDesc}>100% safe & escrow encrypted</Text>
                        </View>
                        <View style={localStyles.featureCard}>
                            <View style={[localStyles.featureIconCircle, { backgroundColor: '#F3E8FF' }]}>
                                <Ionicons name="sparkles-outline" size={22} color="#8B5CF6" />
                            </View>
                            <Text style={localStyles.featureTitle}>AI Smart Assistant</Text>
                            <Text style={localStyles.featureDesc}>Shop smarter everyday</Text>
                        </View>
                        <View style={localStyles.featureCard}>
                            <View style={[localStyles.featureIconCircle, { backgroundColor: '#FEF3C7' }]}>
                                <Ionicons name="airplane-outline" size={22} color="#D9A73A" />
                            </View>
                            <Text style={localStyles.featureTitle}>Fast Delivery</Text>
                            <Text style={localStyles.featureDesc}>Across Nigeria in air time</Text>
                        </View>
                        <View style={localStyles.featureCard}>
                            <View style={[localStyles.featureIconCircle, { backgroundColor: '#FEE2E2' }]}>
                                <Ionicons name="pricetag-outline" size={22} color="#EF4444" />
                            </View>
                            <Text style={localStyles.featureTitle}>Best Prices</Text>
                            <Text style={localStyles.featureDesc}>Great deals everyday</Text>
                        </View>
                    </View>
                </View>

                {/* ─── Statistics Section ─── */}
                <View style={localStyles.statsCardContainer}>
                    <View style={localStyles.statsRow}>
                        <View style={localStyles.statsItem}>
                            <Ionicons name="people-outline" size={18} color="#0E1A2E" style={{ marginBottom: 4 }} />
                            <AnimatedCounter target={100} suffix="K+" />
                            <Text style={localStyles.statsLabelText}>Happy Customers</Text>
                        </View>
                        <View style={localStyles.statsDivider} />
                        <View style={localStyles.statsItem}>
                            <Ionicons name="storefront-outline" size={18} color="#0E1A2E" style={{ marginBottom: 4 }} />
                            <AnimatedCounter target={15} suffix="K+" />
                            <Text style={localStyles.statsLabelText}>Active Sellers</Text>
                        </View>
                        <View style={localStyles.statsDivider} />
                        <View style={localStyles.statsItem}>
                            <Ionicons name="gift-outline" size={18} color="#0E1A2E" style={{ marginBottom: 4 }} />
                            <AnimatedCounter target={250} suffix="K+" />
                            <Text style={localStyles.statsLabelText}>Products Listed</Text>
                        </View>
                        <View style={localStyles.statsDivider} />
                        <View style={localStyles.statsItem}>
                            <Ionicons name="star-outline" size={18} color="#D9A73A" style={{ marginBottom: 4 }} />
                            <AnimatedCounter target={4.8} suffix="/5" />
                            <Text style={localStyles.statsLabelText}>Customer Rating</Text>
                        </View>
                    </View>
                </View>

                {/* ─── Mission Section ─── */}
                <View style={localStyles.missionSection}>
                    <View style={localStyles.missionBadge}>
                        <Text style={localStyles.missionBadgeText}>OUR MISSION</Text>
                    </View>
                    <Text style={localStyles.missionTitle}>Empowering People. Building Opportunities. Stronger Community.</Text>
                    <Text style={localStyles.missionDesc}>
                        Abu Mafhal is more than a marketplace. It empowers sellers, supports businesses, and connects communities.
                    </Text>
                    <View style={localStyles.missionImageContainer}>
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=800' }}
                            style={localStyles.missionImg}
                        />
                        <View style={localStyles.missionFloatingBadge}>
                            <Ionicons name="people" size={14} color="white" />
                            <Text style={localStyles.missionFloatingBadgeText}>Join thousands of smart buyers & sellers today!</Text>
                        </View>
                    </View>
                </View>

                {/* ─── Why Abu Mafhal Section ─── */}
                <View style={localStyles.whyChooseUsContainer}>
                    <View style={localStyles.centerHeader}>
                        <Text style={localStyles.centerHeaderText}>Why Abu Mafhal</Text>
                        <View style={localStyles.goldAccentLine} />
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={localStyles.whyScrollContent}
                    >
                        {WHY_CHOOSE_US.map((item) => (
                            <View key={item.id} style={localStyles.whyCard}>
                                <View style={[localStyles.whyIconContainer, { backgroundColor: item.bgColor }]}>
                                    <Ionicons name={item.icon} size={24} color={item.color} />
                                </View>
                                <Text style={localStyles.whyCardTitle}>{item.title}</Text>
                                <Text style={localStyles.whyCardDesc}>{item.desc}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* ─── Categories Section (Grid list) ─── */}
                <View style={localStyles.sectionContainer}>
                    <View style={localStyles.sectionHeaderRow}>
                        <Text style={localStyles.sectionTitleText}>Market Categories</Text>
                    </View>
                    <View style={localStyles.categoriesGrid}>
                        {categories.slice(0, 7).map((cat, index) => (
                            <TouchableOpacity
                                key={cat.id || index}
                                style={localStyles.gridCategoryCard}
                                onPress={() => handleEnterShop('shop', cat.name)}
                            >
                                <View style={localStyles.gridCategoryIconBox}>
                                    <Ionicons name={cat.icon || 'grid-outline'} size={20} color="#D9A73A" />
                                </View>
                                <Text style={localStyles.gridCategoryText} numberOfLines={1}>{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ─── Seller Promotion Section ─── */}
                <View style={localStyles.sellAnythingContainer}>
                    <View style={localStyles.sellBannerCard}>
                        <View style={localStyles.sellBannerLeft}>
                            <Text style={localStyles.sellBannerHeadline}>Sell Anything. {"\n"}<Text style={{ color: '#10B981' }}>Earn More.</Text></Text>
                            <Text style={localStyles.sellBannerDesc}>
                                Turn your products, skills, and services into income with Abu Mafhal.
                            </Text>

                            <TouchableOpacity
                                onPress={handleBecomeSeller}
                                style={localStyles.btnSellNow}
                                activeOpacity={0.9}
                            >
                                <Text style={localStyles.btnSellNowText}>Become a Seller</Text>
                                <View style={localStyles.circleArrowWhite}>
                                    <Ionicons name="arrow-forward" size={13} color="#10B981" />
                                </View>
                            </TouchableOpacity>
                        </View>
                        
                        {/* Interactive dashboard UI preview */}
                        <View style={localStyles.sellBannerRight}>
                            <View style={localStyles.dashboardBadge}>
                                <Text style={{ fontSize: 7, fontWeight: '700', color: '#64748B' }}>Seller Earnings</Text>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#0E1A2E', marginTop: 2 }}>₦1,250,000</Text>
                                <Text style={{ fontSize: 7, fontWeight: '800', color: '#10B981', marginTop: 1 }}>+12.5% this month</Text>
                            </View>
                            <Ionicons name="bag-handle" size={56} color="#10B981" style={{ position: 'absolute', bottom: -5, right: 10, opacity: 0.15 }} />
                        </View>
                    </View>
                </View>

                {/* ─── Product Section (Popular products list from database) ─── */}
                <View style={localStyles.sectionContainer}>
                    <View style={localStyles.sectionHeaderRow}>
                        <Text style={localStyles.sectionTitleText}>Popular Right Now</Text>
                        <TouchableOpacity onPress={() => handleEnterShop('shop')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={localStyles.sectionLinkText}>View all products</Text>
                            <Ionicons name="arrow-forward-outline" size={14} color="#D9A73A" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={localStyles.popularScrollContent}
                    >
                        {popularProducts.map((item) => {
                            const isLiked = !!wishlist[item.id];
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={localStyles.popularProductCard}
                                    onPress={() => {
                                        if (!user) {
                                            onNavigate('Auth', {
                                                redirectTo: 'ProductDetails',
                                                redirectParams: { product: item }
                                            });
                                        } else {
                                            navigation.navigate('ProductDetails', { product: item });
                                        }
                                    }}
                                >
                                    {/* Discount tag */}
                                    {item.discount && (
                                        <View style={localStyles.popDiscountBadge}>
                                            <Text style={localStyles.popDiscountText}>-{item.discount}%</Text>
                                        </View>
                                    )}

                                    {/* Wishlist Button */}
                                    <TouchableOpacity
                                        style={localStyles.popLikeButton}
                                        onPress={() => {
                                            if (!user) {
                                                onNavigate('Auth', {
                                                    redirectTo: 'ProductDetails',
                                                    redirectParams: { product: item }
                                                });
                                            } else {
                                                toggleWishlist(item.id);
                                            }
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons
                                            name={isLiked ? 'heart' : 'heart-outline'}
                                            size={16}
                                            color={isLiked ? '#EF4444' : '#64748B'}
                                        />
                                    </TouchableOpacity>

                                    {/* Image */}
                                    <Image
                                        source={{ uri: item.image }}
                                        style={localStyles.popularProductImg}
                                    />

                                    {/* Body details */}
                                    <View style={localStyles.popProductDetails}>
                                        <Text style={localStyles.popCategoryText}>
                                            {item.category}
                                        </Text>
                                        <Text style={localStyles.popNameText} numberOfLines={1}>
                                            {item.name}
                                        </Text>

                                        {/* Price display with optional old price */}
                                        <View style={localStyles.popPriceRow}>
                                            <Text style={localStyles.popCurrentPrice}>
                                                ₦{item.price ? item.price.toLocaleString() : '0'}
                                            </Text>
                                            {item.oldPrice && (
                                                <Text style={localStyles.popOldPrice}>
                                                    ₦{item.oldPrice.toLocaleString()}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Rating info */}
                                        <View style={localStyles.popRatingRow}>
                                            <Ionicons name="star" size={12} color="#F59E0B" />
                                            <Text style={localStyles.popRatingText}>
                                                {item.rating || 5.0} ({item.reviews_count || 0})
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Testimonial Feedbacks (from database testimonials table) */}
                <View style={localStyles.sectionContainer}>
                    <View style={localStyles.sectionHeaderRow}>
                        <Text style={localStyles.sectionTitleText}>What Our Community Says</Text>
                        <TouchableOpacity onPress={() => handleEnterShop('about')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={localStyles.sectionLinkText}>See more reviews</Text>
                            <Ionicons name="arrow-forward-outline" size={14} color="#D9A73A" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={localStyles.testimonialScrollContent}
                    >
                        {(testimonials.length > 0 ? testimonials : TESTIMONIALS_FALLBACK).map((t) => (
                            <View key={t.id} style={localStyles.testimonialCard}>
                                <Text style={localStyles.testimonialQuote}>“{t.testimonial || t.quote}”</Text>
                                <View style={localStyles.testimonialUserRow}>
                                    <Image source={{ uri: t.customer_image || t.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' }} style={localStyles.testimonialAvatar} />
                                    <View style={localStyles.testimonialUserInfo}>
                                        <Text style={localStyles.testimonialName}>{t.customer_name || t.name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={localStyles.testimonialRole}>{t.customer_title || t.role}</Text>
                                            {(t.is_verified || t.verified) && (
                                                <Ionicons name="checkmark-circle" size={12} color="#10B981" style={{ marginLeft: 4 }} />
                                            )}
                                        </View>
                                    </View>
                                </View>
                                <View style={localStyles.testimonialStars}>
                                    {[...Array(t.rating || 5)].map((_, idx) => (
                                        <Ionicons key={idx} name="star" size={12} color="#F59E0B" style={{ marginRight: 2 }} />
                                    ))}
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* Trust Badge strip */}
                <View style={localStyles.trustStrip}>
                    {TRUST_ITEMS.map((t, idx) => (
                        <View key={idx} style={localStyles.trustItem}>
                            <Ionicons name={t.icon} size={20} color={t.color} />
                            <Text style={localStyles.trustText}>{t.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Footer */}
                <View style={localStyles.landingFooter}>
                    <View style={localStyles.footerBrandBlock}>
                        <View style={localStyles.footerLogoCircle}>
                            <Image
                                source={settings?.logo_url ? { uri: settings.logo_url } : require('../../assets/am_logo.png')}
                                style={localStyles.footerLogoImage}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={localStyles.footerBrandTitle}>ABU MAFHAL</Text>
                        <Text style={localStyles.footerBrandSub}>ONLINE MARKETPLACE</Text>
                        <Text style={localStyles.footerBrandDesc}>
                            Buy. Sell. Earn. Grow. Together. Abu Mafhal is more than a marketplace. It's a movement to empower people and build a better community.
                        </Text>
                    </View>

                    {/* Social links */}
                    <View style={localStyles.footerSocialRow}>
                        {[
                            { icon: 'logo-facebook', url: 'https://facebook.com/abumafhal' },
                            { icon: 'logo-instagram', url: 'https://instagram.com/abumafhal' },
                            { icon: 'logo-twitter', url: 'https://x.com/abumafhal' },
                            { icon: 'logo-youtube', url: 'https://youtube.com/abumafhal' }
                        ].map((soc, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={localStyles.footerSocialBtn}
                                onPress={() => Linking.openURL(soc.url)}
                            >
                                <Ionicons name={soc.icon} size={18} color="#D9A73A" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Links columns */}
                    <View style={localStyles.footerLinksGrid}>
                        <View style={localStyles.footerLinkCol}>
                            <Text style={localStyles.footerColHeading}>Marketplace</Text>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}><Text style={localStyles.footerLinkText}>All Categories</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}><Text style={localStyles.footerLinkText}>Popular Products</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}><Text style={localStyles.footerLinkText}>Deals</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop', 'Digital Products')}><Text style={localStyles.footerLinkText}>Digital Products</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('shop')}><Text style={localStyles.footerLinkText}>Stores</Text></TouchableOpacity>
                        </View>

                        <View style={localStyles.footerLinkCol}>
                            <Text style={localStyles.footerColHeading}>Company</Text>
                            <TouchableOpacity onPress={() => handleEnterShop('about')}><Text style={localStyles.footerLinkText}>About Us</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('How It Works')}><Text style={localStyles.footerLinkText}>How It Works</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleBecomeSeller}><Text style={localStyles.footerLinkText}>Become a Seller</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('Blog')}><Text style={localStyles.footerLinkText}>Blog</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('Careers')}><Text style={localStyles.footerLinkText}>Careers</Text></TouchableOpacity>
                        </View>

                        <View style={localStyles.footerLinkCol}>
                            <Text style={localStyles.footerColHeading}>Support</Text>
                            <TouchableOpacity onPress={() => handleEnterShop('support')}><Text style={localStyles.footerLinkText}>Help Center</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('Contact')}><Text style={localStyles.footerLinkText}>Contact Us</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('Shipping & Returns')}><Text style={localStyles.footerLinkText}>Shipping & Delivery</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('Shipping & Returns')}><Text style={localStyles.footerLinkText}>Returns & Refunds</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleEnterShop('Terms of Service')}><Text style={localStyles.footerLinkText}>Terms & Conditions</Text></TouchableOpacity>
                        </View>
                    </View>

                    {/* Newsletter input */}
                    <View style={localStyles.footerNewsletter}>
                        <Text style={localStyles.footerColHeading}>Stay Connected</Text>
                        <Text style={localStyles.newsletterSubText}>Get the best deals and updates delivered to your inbox.</Text>
                        <View style={localStyles.newsletterInputRow}>
                            <TextInput
                                placeholder="Enter your email"
                                placeholderTextColor="#475569"
                                value={newsletterEmail}
                                onChangeText={setNewsletterEmail}
                                style={localStyles.newsletterInput}
                            />
                            <TouchableOpacity
                                onPress={handleNewsletterSubmit}
                                style={localStyles.btnNewsletterSubmit}
                            >
                                <Ionicons name="arrow-forward" size={14} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bottom Copyright */}
                    <View style={localStyles.footerBottom}>
                        <Text style={localStyles.footerBottomText}>© 2026 Abu Mafhal. All rights reserved.</Text>
                        <Text style={localStyles.footerBottomText}>Made with ❤️ in Nigeria 🇳🇬 • Secured Escrow Platform</Text>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

const localStyles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#F5F3EB',
    },
    headerCentered: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: Platform.OS === 'ios' ? 25 : 35,
        paddingBottom: 20,
        backgroundColor: '#F5F3EB',
        position: 'relative',
    },
    logoContainer: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        shadowColor: '#0E1A2E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1.5,
        borderColor: '#D9A73A30',
    },
    logoImageMark: {
        width: 58,
        height: 58,
        borderRadius: 29,
    },
    brandTextRow: {
        flexDirection: 'row',
        marginTop: 10,
        alignItems: 'center',
    },
    brandTextAbu: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0E1A2E',
        letterSpacing: 0.5,
    },
    brandTextMafhal: {
        fontSize: 20,
        fontWeight: '900',
        color: '#D9A73A',
        letterSpacing: 0.5,
    },
    brandSubCentered: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0E1A2E',
        letterSpacing: 2.2,
        marginTop: 3,
    },
    headerLoginAbsolute: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 30 : 40,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(14, 26, 46, 0.04)',
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
    heroRow: {
        flexDirection: 'row',
        paddingLeft: 16,
        paddingRight: 0,
        paddingVertical: 12,
        alignItems: 'center',
        minHeight: 380,
        position: 'relative',
    },
    heroLeftCol: {
        width: '48%',
        paddingRight: 4,
        zIndex: 2,
    },
    heroRightCol: {
        position: 'absolute',
        right: -25,
        top: 0,
        bottom: 0,
        width: '62%',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    decorCircle1: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: '#EAE6DB',
        bottom: 10,
        right: -10,
        opacity: 0.4,
        zIndex: 0,
    },
    decorCircle2: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 2,
        borderColor: '#D9A73A20',
        top: 10,
        right: -20,
        opacity: 0.3,
        zIndex: 0,
    },
    heroMockupImage: {
        width: '100%',
        height: '100%',
        zIndex: 1,
    },
    pillBadgeContainer: {
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    pillBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    pillBadgeText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#64748B',
    },
    heroTextContainer: {
        marginTop: 4,
    },
    heroLine1: {
        fontSize: 28,
        fontWeight: '900',
        color: '#0E1A2E',
        letterSpacing: -0.5,
        lineHeight: 32,
    },
    heroLine2: {
        fontSize: 28,
        fontWeight: '900',
        color: '#0E1A2E',
        letterSpacing: -0.5,
        lineHeight: 32,
        marginTop: 2,
    },
    heroLineGold: {
        fontSize: 28,
        fontWeight: '900',
        color: '#D9A73A',
        letterSpacing: -0.5,
        lineHeight: 32,
        marginTop: 2,
        marginBottom: 8,
    },
    heroDescription: {
        fontSize: 11,
        color: '#64748B',
        lineHeight: 17,
        fontWeight: '600',
    },
    heroButtonsContainer: {
        flexDirection: 'column',
        gap: 10,
        marginTop: 16,
        width: '100%',
    },
    btnStartShopping: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0E1A2E',
        paddingLeft: 12,
        paddingRight: 6,
        paddingVertical: 10,
        borderRadius: 10,
        shadowColor: '#0E1A2E',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 2,
    },
    btnStartShoppingText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12,
    },
    circleArrowWhite: {
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
        borderWidth: 1,
        borderColor: '#D9A73A',
        paddingLeft: 10,
        paddingRight: 6,
        paddingVertical: 10,
        borderRadius: 10,
    },
    btnStartSellingText: {
        color: '#0E1A2E',
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
    searchBarContainer: {
        paddingHorizontal: 20,
        marginTop: 24,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: Platform.OS === 'ios' ? 12 : 6,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    searchBoxInput: {
        flex: 1,
        color: '#0E1A2E',
        fontWeight: '600',
        fontSize: 13,
        paddingVertical: 4,
    },
    searchFilterIcon: {
        paddingLeft: 8,
    },
    promoContainer: {
        paddingHorizontal: 20,
        marginTop: 20,
    },
    slimBannerTouch: {
        width: '100%',
        height: 75,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    slimBannerImage: {
        width: '100%',
        height: '100%',
    },
    sectionContainer: {
        marginTop: 28,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    sectionTitleText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0E1A2E',
    },
    sectionLinkText: {
        color: '#D9A73A',
        fontWeight: '800',
        fontSize: 12,
    },
    categoriesScrollContainer: {
        paddingHorizontal: 20,
        gap: 16,
    },
    categoryCard: {
        alignItems: 'center',
        width: 70,
    },
    categoryIconBox: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1,
        marginBottom: 8,
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
        textAlign: 'center',
    },
    flashDealCard: {
        width: 140,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
    },
    flashDealImg: {
        width: '100%',
        height: 110,
        backgroundColor: '#F8FAFC',
    },
    flashDiscountBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#EF4444',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    flashDealName: {
        color: '#334155',
        fontWeight: '700',
        fontSize: 12,
    },
    flashDealPrice: {
        color: '#D9A73A',
        fontWeight: '900',
        fontSize: 14,
        marginTop: 2,
    },
    featureHighlightsContainer: {
        marginTop: 32,
    },
    featureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        gap: 12,
        marginTop: 16,
    },
    featureCard: {
        width: (width - 52) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 1,
    },
    featureIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    featureTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0E1A2E',
        marginBottom: 4,
    },
    featureDesc: {
        fontSize: 10,
        fontWeight: '550',
        color: '#64748B',
    },
    statsCardContainer: {
        paddingHorizontal: 20,
        marginTop: 28,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        paddingVertical: 16,
        paddingHorizontal: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 10,
        elevation: 1,
    },
    statsItem: {
        flex: 1,
        alignItems: 'center',
    },
    statsNumber: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0E1A2E',
    },
    statsLabelText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#64748B',
        textAlign: 'center',
        marginTop: 2,
    },
    statsDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#E2E8F0',
    },
    missionSection: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
        paddingVertical: 32,
        paddingHorizontal: 20,
        marginTop: 32,
    },
    missionBadge: {
        backgroundColor: '#0E1A2E',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    missionBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 1,
    },
    missionTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0E1A2E',
        lineHeight: 28,
        letterSpacing: -0.5,
        marginBottom: 12,
    },
    missionDesc: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 20,
        fontWeight: '550',
        marginBottom: 20,
    },
    missionImageContainer: {
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
    },
    missionImg: {
        width: '100%',
        height: 200,
    },
    missionFloatingBadge: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(14,26,46,0.9)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    missionFloatingBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
        flex: 1,
    },
    whyChooseUsContainer: {
        marginTop: 32,
        paddingVertical: 12,
    },
    centerHeader: {
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    centerHeaderText: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0E1A2E',
        textAlign: 'center',
    },
    goldAccentLine: {
        width: 40,
        height: 3,
        backgroundColor: '#D9A73A',
        borderRadius: 2,
        marginTop: 8,
    },
    whyScrollContent: {
        paddingHorizontal: 20,
        gap: 16,
        paddingBottom: 8,
    },
    whyCard: {
        width: 200,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 1,
    },
    whyIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    whyCardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0E1A2E',
        marginBottom: 6,
    },
    whyCardDesc: {
        fontSize: 11,
        fontWeight: '550',
        color: '#64748B',
        lineHeight: 16,
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        gap: 10,
    },
    gridCategoryCard: {
        width: (width - 60) / 3,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    gridCategoryIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F5F3EB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    gridCategoryText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0E1A2E',
        textAlign: 'center',
    },
    sellAnythingContainer: {
        paddingHorizontal: 20,
        marginTop: 32,
    },
    sellBannerCard: {
        flexDirection: 'row',
        backgroundColor: '#E6F4EA',
        borderRadius: 24,
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
    },
    sellBannerLeft: {
        flex: 1.3,
        justifyContent: 'center',
        zIndex: 2,
    },
    sellBannerRight: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    dashboardBadge: {
        backgroundColor: '#FFFFFF',
        padding: 10,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
        alignItems: 'center',
    },
    sellBannerHeadline: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0E1A2E',
        lineHeight: 26,
        marginBottom: 8,
    },
    sellBannerDesc: {
        fontSize: 12,
        fontWeight: '550',
        color: '#64748B',
        lineHeight: 18,
        marginBottom: 16,
    },
    btnSellNow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#10B981',
        paddingLeft: 14,
        paddingRight: 6,
        paddingVertical: 10,
        borderRadius: 12,
        alignSelf: 'flex-start',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    btnSellNowText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12,
        marginRight: 8,
    },
    circleArrowWhite: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    popularScrollContent: {
        paddingHorizontal: 20,
        gap: 16,
        paddingBottom: 8,
    },
    popularProductCard: {
        width: 160,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        padding: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 1.5,
        position: 'relative',
    },
    popDiscountBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        zIndex: 2,
    },
    popDiscountText: {
        color: '#EF4444',
        fontSize: 9,
        fontWeight: '900',
    },
    popLikeButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#FFFFFF',
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        zIndex: 2,
    },
    popularProductImg: {
        width: '100%',
        height: 120,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        marginBottom: 8,
    },
    popProductDetails: {
        paddingHorizontal: 2,
    },
    popCategoryText: {
        fontSize: 9,
        fontWeight: '850',
        color: '#0E1A2E',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 3,
    },
    popNameText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0E1A2E',
        marginBottom: 6,
    },
    popPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    popCurrentPrice: {
        fontSize: 14,
        fontWeight: '900',
        color: '#10B981',
    },
    popOldPrice: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
        textDecorationLine: 'line-through',
    },
    popRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    popRatingText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    testimonialScrollContent: {
        paddingHorizontal: 20,
        gap: 16,
        paddingBottom: 8,
    },
    testimonialCard: {
        width: 240,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 1,
    },
    testimonialQuote: {
        fontSize: 12,
        fontStyle: 'italic',
        fontWeight: '600',
        color: '#334155',
        lineHeight: 18,
        marginBottom: 12,
    },
    testimonialUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    testimonialAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
    },
    testimonialUserInfo: {
        flex: 1,
    },
    testimonialName: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0E1A2E',
    },
    testimonialRole: {
        fontSize: 9,
        fontWeight: '700',
        color: '#64748B',
    },
    testimonialStars: {
        flexDirection: 'row',
    },
    trustStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    trustItem: {
        alignItems: 'center',
        width: '30%',
    },
    trustText: {
        color: '#64748B',
        fontSize: 9,
        fontWeight: '700',
        marginTop: 6,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    landingFooter: {
        backgroundColor: '#0E1A2E',
        borderTopWidth: 2,
        borderColor: '#D9A73A',
        paddingTop: 32,
        paddingBottom: 40,
        paddingHorizontal: 20,
        marginTop: 32,
    },
    footerBrandBlock: {
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    footerLogoCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#D9A73A30',
    },
    footerLogoImage: {
        width: 38,
        height: 38,
        borderRadius: 19,
    },
    footerBrandTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    footerBrandSub: {
        fontSize: 8,
        fontWeight: '800',
        color: '#D9A73A',
        letterSpacing: 1.5,
        marginTop: 1,
    },
    footerBrandDesc: {
        fontSize: 12,
        color: '#94A3B8',
        lineHeight: 18,
        fontWeight: '550',
        marginTop: 12,
    },
    footerSocialRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 28,
    },
    footerSocialBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerLinksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 20,
        marginBottom: 28,
    },
    footerLinkCol: {
        width: (width - 60) / 2,
    },
    footerColHeading: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    footerLinkText: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '650',
        marginVertical: 6,
    },
    footerNewsletter: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 28,
    },
    newsletterSubText: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '550',
        marginBottom: 12,
        lineHeight: 16,
    },
    newsletterInputRow: {
        flexDirection: 'row',
        height: 44,
        gap: 8,
    },
    newsletterInput: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 10,
        paddingHorizontal: 12,
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    btnNewsletterSubmit: {
        backgroundColor: '#D9A73A',
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerBottom: {
        borderTopWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        paddingTop: 20,
        alignItems: 'center',
        gap: 4,
    },
    footerBottomText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    }
});
