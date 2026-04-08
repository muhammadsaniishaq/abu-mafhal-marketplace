import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Animated, ImageBackground, Dimensions, Platform, StatusBar, FlatList, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/theme';
import { useAppSettings } from '../context/AppSettingsContext';
import { ServiceIcon } from '../components/ServiceIcon';
import { SectionHeader } from '../components/SectionHeader';
import { Footer } from '../components/Footer';
import { supabase } from '../lib/supabase';
import { CountdownTimer } from '../components/CountdownTimer';

const { width } = Dimensions.get('window');

const TRUST_ITEMS = [
    { icon: 'shield-checkmark', label: 'Secure Payment', color: '#10B981' },
    { icon: 'rocket', label: 'Fast Delivery', color: '#3B82F6' },
    { icon: 'headset', label: '24/7 Support', color: '#8B5CF6' },
];

export const LandingPage = ({ navigation, onEnterShop, cartCount, onGoToCart, onLogin, user, onGoToProfile, onNavigate, addToCart }) => {
    const { settings } = useAppSettings();
    const scrollX = useRef(new Animated.Value(0)).current;
    const scrollY = useRef(new Animated.Value(0)).current; // Added for sticky header
    const slideRef = useRef(null);

    const [newArrivals, setNewArrivals] = useState([]);
    const [recommended, setRecommended] = useState([]);
    const [banners, setBanners] = useState([]);
    const [promoBanners, setPromoBanners] = useState([]);
    const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
    const [bannerIndex, setBannerIndex] = useState(0); // Added for hero auto-slide
    const promoFlatListRef = useRef(null);
    const [flashSale, setFlashSale] = useState([]);
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    const handleEnterShop = () => {
        if (!user && settings?.allow_guest_browse === false) {
            onLogin();
        } else {
            onEnterShop();
        }
    };

    // Hero Banner Auto-Slide Logic
    useEffect(() => {
        if (banners.length > 1) {
            const timer = setInterval(() => {
                setBannerIndex(prev => {
                    const nextIndex = (prev + 1) % banners.length;
                    slideRef.current?.scrollTo({ x: nextIndex * width, animated: true });
                    return nextIndex;
                });
            }, 5000);
            return () => clearInterval(timer);
        }
    }, [banners.length]);

    // Promo Banner Auto-Slide Logic
    useEffect(() => {
        if (promoBanners.length > 1) {
            const timer = setInterval(() => {
                setCurrentPromoIndex(prev => {
                    const nextIndex = (prev + 1) % promoBanners.length;
                    promoFlatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                    return nextIndex;
                });
            }, 4000);
            return () => clearInterval(timer);
        }
    }, [promoBanners.length]);

    useEffect(() => {
        const fetchLandingProducts = async () => {
            try {
                // 1. Fetch Banners (Hero & General)
                const { data: bAll, error: bError } = await supabase
                    .from('banners')
                    .select('*')
                    .eq('is_active', true)
                    .order('display_order');

                if (bError) throw bError;

                if (bAll) {
                    const landingBanners = bAll.filter(b =>
                        b.section === 'landing' || !b.section || b.section === 'all' || b.section === ''
                    );
                    setBanners(landingBanners);
                }

                // 2. Fetch Promo Banners
                const { data: promoData, error: promoError } = await supabase
                    .from('banners')
                    .select('*')
                    .eq('section', 'promo')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });

                if (promoError) throw promoError;

                if (promoData) {
                    const validPromos = promoData.map(promo => {
                        let linkData = { text: promo.action_link || '', locations: ['home'] };
                        try {
                            const parsed = JSON.parse(promo.action_link);
                            if (parsed && typeof parsed === 'object') {
                                linkData = { ...linkData, ...parsed };
                            }
                        } catch (e) { }
                        return { ...promo, linkData };
                    }).filter(promo => {
                        // Filter out expired promos if a timerEnd date is specified
                        if (promo.linkData?.timerEnd) {
                            const expiryDate = new Date(promo.linkData.timerEnd);
                            // If the date is invalid, we treat it as not having an expiry.
                            // Otherwise, check if current time is past the expiry.
                            return isNaN(expiryDate.getTime()) || new Date() <= expiryDate;
                        }
                        return true;
                    });
                    setPromoBanners(validPromos);
                }

                // 3. Fetch Categories
                const { data: catData, error: catError } = await supabase
                    .from('product_categories')
                    .select('*')
                    .eq('is_active', true)
                    .order('name');
                if (catError) throw catError;
                if (catData) setCategories(catData);

                // 4. Fetch Flash Sale Products
                const { data: flashData, error: flashError } = await supabase
                    .from('products')
                    .select('*, product_categories(name)')
                    .eq('is_active', true)
                    .eq('is_flash_sale', true)
                    .limit(10);
                if (flashError) throw flashError;
                if (flashData) setFlashSale(flashData);

                // 5. Fetch New Arrivals
                const { data: newData, error: newError } = await supabase
                    .from('products')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(10);
                if (newError) throw newError;
                if (newData) setNewArrivals(newData);

                // 6. Fetch Recommended
                const { data: recData, error: recError } = await supabase
                    .from('products')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(10);
                if (recError) throw recError;
                if (recData) setRecommended(recData);

            } catch (err) {
                console.warn('LandingPage: Failed to fetch data', err.message);
            }
        };

        fetchLandingProducts();
    }, []);

    const onScrollMomentumEnd = () => {
        // Placeholder for slide logic if needed
    };

    return (
        <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
            {/* STICKY GLASS HEADER - PHASE 5 */}
            <Animated.View style={[styles.stickyHeader, {
                height: Platform.OS === 'android' ? StatusBar.currentHeight + 60 : 100,
                opacity: scrollY.interpolate({
                    inputRange: [100, 200],
                    outputRange: [0, 1],
                    extrapolate: 'clamp'
                }),
                transform: [{
                    translateY: scrollY.interpolate({
                        inputRange: [100, 200],
                        outputRange: [-100, 0],
                        extrapolate: 'clamp'
                    })
                }]
            }]}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 40 }}>
                    <Text style={{ fontWeight: '900', color: '#0F172A', fontSize: 16 }}>{settings?.app_name || 'ABU MAFHAL'}</Text>
                    <TouchableOpacity onPress={handleEnterShop} style={{ backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}>
                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>SHOP NOW</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* LOGO AREA */}
                <View style={[styles.headerBrand, { gap: 10 }]}>
                    <View style={styles.logoBox}>
                        <Image
                            source={settings?.logo_url ? { uri: settings.logo_url } : require('../../assets/logo.jpg')}
                            style={{ width: 32, height: 32, borderRadius: 8 }}
                            resizeMode="contain"
                        />
                    </View>
                    <View>
                        <Text style={styles.brandTitle}>{settings?.app_name || 'ABU MAFHAL'}</Text>
                        <Text style={styles.brandSub}>ELITE ECOSYSTEM</Text>
                    </View>
                </View>

                {/* ICONS AREA */}
                <View style={styles.headerIcons}>
                    {user ? (
                        <TouchableOpacity style={styles.profileHeadBtn} onPress={onGoToProfile}>
                            <View style={[styles.avatarHead, { backgroundColor: '#0F172A' }]}>
                                <Text style={styles.avatarHeadText}>{user.email ? user.email[0].toUpperCase() : 'U'}</Text>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={{ backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}
                            onPress={onLogin}
                        >
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>SIGN IN</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 0 }}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
            >
                {/* MARKET PULSE TICKER - PHASE 5 */}
                <View style={styles.pulseTicker}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <Text style={styles.tickerText}>• New Elite Vendor in Dubai</Text>
                        <Text style={styles.tickerText}>• 1,200+ Active Shipments</Text>
                        <Text style={styles.tickerText}>• New Arrival: Premium Electronics</Text>
                        <Text style={styles.tickerText}>• 24/7 Verified Support Live</Text>
                        <Text style={styles.tickerText}>• Secure Payment Gateway Active</Text>
                    </ScrollView>
                </View>

                {/* WELCOME SECTION - INTRODUCING THE APP */}
                <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#3B82F6', letterSpacing: 2, marginBottom: 8 }}>WELCOME TO THE FUTURE</Text>
                    <Text style={{ fontSize: 32, fontWeight: '900', color: '#0F172A', lineHeight: 38, marginBottom: 12 }}>
                        Discover the Elite Modern Ecosystem
                    </Text>
                    <Text style={{ fontSize: 16, color: '#64748B', lineHeight: 24, marginBottom: 24 }}>
                        Abu Mafhal is more than just a marketplace. We bridge the gap between quality products, seamless logistics, and premium vendor services.
                    </Text>

                    <TouchableOpacity onPress={handleEnterShop} style={styles.heroCTA}>
                        <Text style={styles.heroCTAText}>START EXPLORING</Text>
                        <Ionicons name="arrow-forward" size={18} color="white" />
                    </TouchableOpacity>

                    {/* ELITE SEARCH BAR - PHASE 7 */}
                    <View style={styles.eliteSearchBar}>
                        <Ionicons name="search" size={20} color="#64748B" style={{ marginRight: 12 }} />
                        <TextInput
                            placeholder="Search for elite products..."
                            placeholderTextColor="#94A3B8"
                            style={{ flex: 1, color: '#0F172A', fontWeight: '600', fontSize: 14 }}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <TouchableOpacity style={{ backgroundColor: '#0F172A', width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="options-outline" size={18} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.trendingContainer}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', marginRight: 8, marginTop: 6 }}>TRENDING:</Text>
                        {['iPhone 15', 'MacBook M3', 'Elite Watch', 'Premium Audio'].map((item, i) => (
                            <TouchableOpacity key={i} style={styles.trendingChip} onPress={() => setSearchQuery(item)}>
                                <Text style={styles.trendingText}>{item}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* PLATFORM STATS - PHASE 4 */}
                <View style={styles.statsGrid}>
                    <View style={styles.statsBox}>
                        <Text style={styles.statsNumber}>10k+</Text>
                        <Text style={styles.statsLabel}>Orders</Text>
                    </View>
                    <View style={styles.statsBox}>
                        <Text style={styles.statsNumber}>500+</Text>
                        <Text style={styles.statsLabel}>Vendors</Text>
                    </View>
                    <View style={styles.statsBox}>
                        <Text style={styles.statsNumber}>24/7</Text>
                        <Text style={styles.statsLabel}>Support</Text>
                    </View>
                    <View style={styles.statsBox}>
                        <Text style={styles.statsNumber}>100%</Text>
                        <Text style={styles.statsLabel}>Secure</Text>
                    </View>
                </View>

                {/* HERO CAROUSEL (DYNAMIC) */}
                {banners.length > 0 && (
                    <View style={{ height: 240, marginTop: 24 }}>
                        <Animated.ScrollView
                            ref={slideRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                                useNativeDriver: false
                            })}
                            onMomentumScrollEnd={(e) => {
                                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                                if (index !== bannerIndex) {
                                    setBannerIndex(index);
                                }
                            }}
                            scrollEventThrottle={16}
                        >
                            {banners.map((item, index) => (
                                <TouchableOpacity key={index} activeOpacity={0.9} onPress={handleEnterShop} style={{ width: width, paddingHorizontal: 16, height: 240 }}>
                                    <ImageBackground
                                        source={{ uri: item?.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2670&auto=format&fit=crop' }}
                                        style={{ width: '100%', height: '100%', justifyContent: 'flex-end' }}
                                        imageStyle={{ borderRadius: 32 }}
                                        resizeMode="cover"
                                    >
                                        <View style={{ position: 'absolute', bottom: 20, left: 20, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#3B82F6' }}>
                                            <Text style={{ fontWeight: '900', color: '#0F172A', fontSize: 12 }}>PREMIUM QUALITY</Text>
                                        </View>
                                    </ImageBackground>
                                </TouchableOpacity>
                            ))}
                        </Animated.ScrollView>
                        {/* Dots Indicator */}
                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
                            {banners.map((_, i) => {
                                const opacity = scrollX.interpolate({
                                    inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                                    outputRange: [0.3, 1, 0.3],
                                    extrapolate: 'clamp'
                                });
                                const dotWidth = scrollX.interpolate({
                                    inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                                    outputRange: [6, 24, 6],
                                    extrapolate: 'clamp'
                                });
                                return <Animated.View key={i} style={{ height: 6, width: dotWidth, borderRadius: 3, backgroundColor: '#0F172A', marginHorizontal: 3, opacity }} />;
                            })}
                        </View>
                    </View>
                )}

                {/* THE ECOSYSTEM - EXPLAINING THE APP */}
                <View style={{ marginTop: 40 }}>
                    <View style={{ paddingHorizontal: 20 }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: '#3B82F6', letterSpacing: 2, marginBottom: 8 }}>CORE ARCHITECTURE</Text>
                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A', marginBottom: 8 }}>The Abu Mafhal Ecosystem</Text>
                        <Text style={{ fontSize: 14, color: '#64748B', lineHeight: 22 }}>Everything you need in one powerful platform.</Text>
                    </View>

                    <View style={styles.ecosystemGrid}>
                        <TouchableOpacity onPress={handleEnterShop} style={[styles.ecosystemCard, { backgroundColor: '#0F172A' }]}>
                            <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2670&auto=format&fit=crop' }} style={StyleSheet.absoluteFill} imageStyle={{ opacity: 0.4 }} />
                            <View style={styles.ecosystemTag}><Text style={styles.ecosystemTagText}>MARKETPLACE</Text></View>
                            <Text style={styles.ecosystemTitle}>Shop Premium Products</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleEnterShop} style={[styles.ecosystemCard, { backgroundColor: '#3B82F6' }]}>
                            <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2670&auto=format&fit=crop' }} style={StyleSheet.absoluteFill} imageStyle={{ opacity: 0.4 }} />
                            <View style={styles.ecosystemTag}><Text style={styles.ecosystemTagText}>LOGISTICS</Text></View>
                            <Text style={styles.ecosystemTitle}>Global Elite Delivery</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleEnterShop} style={[styles.ecosystemCard, { backgroundColor: '#10B981', width: width - 32 }]}>
                            <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?q=80&w=2670&auto=format&fit=crop' }} style={StyleSheet.absoluteFill} imageStyle={{ opacity: 0.4 }} />
                            <View style={styles.ecosystemTag}><Text style={styles.ecosystemTagText}>VENDORS</Text></View>
                            <Text style={styles.ecosystemTitle}>Empowering Local Businesses to Grow Rapidly</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* GLOBAL REACH MAP - PHASE 4 */}
                <View style={styles.mapCard}>
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ color: '#3B82F6', fontWeight: '900', fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>PLATFORM COVERAGE</Text>
                        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>Global Elite Network</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8, lineHeight: 20 }}>
                            We connect premium vendors from Africa to the rest of the world with seamless logistics.
                        </Text>
                    </View>

                    {/* Stylized Map Visual (Simplified) */}
                    <View style={{ height: 160, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="globe-outline" size={80} color="rgba(59, 130, 246, 0.2)" />
                        <View style={{ position: 'absolute', top: 40, left: '30%', width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }} />
                        <View style={{ position: 'absolute', top: 80, left: '50%', width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }} />
                        <View style={{ position: 'absolute', top: 60, left: '70%', width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }} />
                    </View>
                </View>

                {/* PLATFORM MILESTONE TIMELINE - PHASE 10 PREMIUM REDESIGN */}
                <View style={styles.milestoneContainer}>
                    <View style={styles.milestoneHeader}>
                        <View style={{ width: 4, height: 24, backgroundColor: '#3B82F6', borderRadius: 2 }} />
                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A' }}>Our Journey</Text>
                    </View>

                    <View style={styles.milestoneTrack} />

                    <View style={styles.milestoneItem}>
                        <View style={styles.milestonePoint}>
                            <Ionicons name="flag" size={14} color="#3B82F6" />
                        </View>
                        <View style={styles.milestoneCard}>
                            <Text style={styles.milestoneYearLabel}>2024</Text>
                            <Text style={styles.milestoneTitle}>The Genesis</Text>
                            <Text style={styles.milestoneText}>Launched with a vision to connect local vendors to global shoppers.</Text>
                        </View>
                    </View>

                    <View style={styles.milestoneItem}>
                        <View style={styles.milestonePoint}>
                            <Ionicons name="rocket" size={14} color="#3B82F6" />
                        </View>
                        <View style={styles.milestoneCard}>
                            <Text style={styles.milestoneYearLabel}>PRESENT</Text>
                            <Text style={styles.milestoneTitle}>Elite Ecosystem</Text>
                            <Text style={styles.milestoneText}>Now serving 10,000+ customers with AI-ready logistics and secure payments.</Text>
                        </View>
                    </View>

                    <View style={styles.milestoneItem}>
                        <View style={[styles.milestonePoint, { borderColor: '#10B981' }]}>
                            <Ionicons name="star" size={14} color="#10B981" />
                        </View>
                        <View style={[styles.milestoneCard, { borderLeftWidth: 3, borderLeftColor: '#10B981' }]}>
                            <Text style={[styles.milestoneYearLabel, { color: '#10B981' }]}>FUTURE 2025</Text>
                            <Text style={styles.milestoneTitle}>Global Leadership</Text>
                            <Text style={styles.milestoneText}>Deploying full AI concierge and autonomous logistics networks globally.</Text>
                        </View>
                    </View>
                </View>

                {/* MEMBERSHIP TIER COMPARISON - PHASE 6 */}
                <View style={{ paddingHorizontal: 20, marginTop: 40 }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 20 }}>Membership Comparison</Text>
                    <View style={styles.membershipTable}>
                        <View style={[styles.membershipRow, { borderBottomWidth: 2 }]}>
                            <View style={{ flex: 2 }}><Text style={{ fontWeight: '900', color: '#64748B' }}>FEATURE</Text></View>
                            <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontWeight: '900', color: '#64748B' }}>BASIC</Text></View>
                            <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontWeight: '900', color: '#3B82F6' }}>ELITE</Text></View>
                        </View>
                        <View style={styles.membershipRow}>
                            <View style={{ flex: 2 }}><Text style={{ fontWeight: '700', color: '#0F172A' }}>Global Shipping</Text></View>
                            <View style={{ flex: 1, alignItems: 'center' }}><Ionicons name="checkmark" size={18} color="#10B981" /></View>
                            <View style={{ flex: 1, alignItems: 'center' }}><Ionicons name="checkmark" size={18} color="#10B981" /></View>
                        </View>
                        <View style={styles.membershipRow}>
                            <View style={{ flex: 2 }}><Text style={{ fontWeight: '700', color: '#0F172A' }}>Priority Support</Text></View>
                            <View style={{ flex: 1, alignItems: 'center' }}><Ionicons name="close" size={18} color="#EF4444" /></View>
                            <View style={{ flex: 1, alignItems: 'center' }}><Ionicons name="checkmark" size={18} color="#10B981" /></View>
                        </View>
                        <View style={styles.membershipRow}>
                            <View style={{ flex: 2 }}><Text style={{ fontWeight: '700', color: '#0F172A' }}>Elite Vendor Access</Text></View>
                            <View style={{ flex: 1, alignItems: 'center' }}><Ionicons name="close" size={18} color="#EF4444" /></View>
                            <View style={{ flex: 1, alignItems: 'center' }}><Ionicons name="checkmark" size={18} color="#10B981" /></View>
                        </View>
                        <View style={styles.membershipRow}>
                            <View style={{ flex: 2 }}><Text style={{ fontWeight: '700', color: '#0F172A' }}>Cashback & Rewards</Text></View>
                            <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 10, color: '#64748B' }}>1%</Text></View>
                            <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 12, color: '#3B82F6', fontWeight: '900' }}>5%</Text></View>
                        </View>
                    </View>
                </View>

                {/* 24/7 ELITE CONCIERGE HIGHLIGHT - PHASE 7 */}
                <View style={styles.conciergeCard}>
                    <View style={styles.conciergeIconBox}>
                        <Ionicons name="headset" size={28} color="white" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 4 }}>Elite Concierge 24/7</Text>
                        <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 20 }}>Personalized support and expert guidance for your every need. Exclusively for our Elite members.</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                </View>

                {/* TESTIMONIALS - PHASE 2 */}
                <View style={{ marginTop: 48, paddingBottom: 20 }}>
                    <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: '#3B82F6', letterSpacing: 2, marginBottom: 8 }}>COMMUNITY FEEDBACK</Text>
                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A' }}>What Our Users Say</Text>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                        <View style={styles.testimonialItem}>
                            <Text style={styles.testimonialQuote}>"The logistics service is unmatched. I received my order from Lagos to London in record time!"</Text>
                            <View style={styles.testimonialUser}>
                                <View style={styles.testimonialAvatar} />
                                <View>
                                    <Text style={styles.testimonialName}>Sani Ibrahim</Text>
                                    <Text style={styles.testimonialRole}>Elite Shopper</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.testimonialItem}>
                            <Text style={styles.testimonialQuote}>"As a vendor, Abu Mafhal has given me access to thousands of new customers. My sales have tripled!"</Text>
                            <View style={styles.testimonialUser}>
                                <View style={styles.testimonialAvatar} />
                                <View>
                                    <Text style={styles.testimonialName}>Fatima Musa</Text>
                                    <Text style={styles.testimonialRole}>Verified Vendor</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.testimonialItem}>
                            <Text style={styles.testimonialQuote}>"I love the clean interface and the secure payment options. It's the only app I trust for global shopping."</Text>
                            <View style={styles.testimonialUser}>
                                <View style={styles.testimonialAvatar} />
                                <View>
                                    <Text style={styles.testimonialName}>John Doe</Text>
                                    <Text style={styles.testimonialRole}>Daily User</Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </View>

                {/* QUICK FAQ - PHASE 2 */}
                <View style={{ paddingHorizontal: 20, marginTop: 40 }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 20 }}>Quick Questions</Text>

                    <TouchableOpacity style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>How do I become a vendor?</Text>
                            <Ionicons name="add" size={20} color="#64748B" />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>Is global shipping available?</Text>
                            <Ionicons name="add" size={20} color="#64748B" />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ paddingVertical: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>How secure are my payments?</Text>
                            <Ionicons name="add" size={20} color="#64748B" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* ELITE MEMBERSHIP - PHASE 4 */}
                <View style={styles.membershipCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <Ionicons name="star" size={24} color="#F59E0B" />
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>Elite Membership</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 20 }}>
                        Join the Elite inner circle for priority shipping, 24/7 dedicated concierge, and early access to global product drops.
                    </Text>
                    <TouchableOpacity style={{ backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>UPGRADE NOW</Text>
                    </TouchableOpacity>
                </View>

                {/* PREMIUM VENDOR SHOWCASE - PHASE 5 */}
                <View style={{ marginTop: 40, backgroundColor: 'white', paddingVertical: 24 }}>
                    <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: '#3B82F6', letterSpacing: 2, marginBottom: 8 }}>VERIFIED ECOSYSTEM</Text>
                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A' }}>Elite Vendor Network</Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.vendorScroll}
                    >
                        {brands.map((brand, i) => (
                            <View key={i} style={styles.vendorLogo}>
                                <Image
                                    source={{ uri: brand?.logo_url || 'https://placehold.co/100' }}
                                    style={{ width: 40, height: 40, resizeMode: 'contain' }}
                                />
                            </View>
                        ))}
                        {/* Static placeholders if brands are few */}
                        <View style={styles.vendorLogo}><Ionicons name="logo-playstation" size={30} color="#0F172A" /></View>
                        <View style={styles.vendorLogo}><Ionicons name="logo-steam" size={30} color="#0F172A" /></View>
                        <View style={styles.vendorLogo}><Ionicons name="logo-xbox" size={30} color="#0F172A" /></View>
                    </ScrollView>
                </View>

                {/* PARTNERSHIP STRIP - PHASE 4 */}
                <View style={styles.partnershipStrip}>
                    <Ionicons name="logo-amazon" size={24} color="#64748B" />
                    <Ionicons name="logo-dropbox" size={24} color="#64748B" />
                    <Ionicons name="logo-whatsapp" size={24} color="#64748B" />
                    <Ionicons name="logo-github" size={24} color="#64748B" />
                </View>

                {/* MOBILE APP SECTION - PHASE 8 PREMIUM REDESIGN */}
                <View style={styles.mobileGradientBg}>
                    <View style={{ alignItems: 'center', marginBottom: 32, paddingHorizontal: 20 }}>
                        <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginBottom: 16 }}>
                            <Text style={{ color: '#3B82F6', fontWeight: '900', fontSize: 10, letterSpacing: 1 }}>BETTER ON MOBILE</Text>
                        </View>
                        <Text style={{ fontSize: 32, fontWeight: '900', color: '#0F172A', textAlign: 'center', lineHeight: 38 }}>
                            The Entire Ecosystem{"\n"}In Your Pocket.
                        </Text>
                        <Text style={{ fontSize: 15, color: '#64748B', textAlign: 'center', marginTop: 12, lineHeight: 24 }}>
                            Experience seamless transactions, real-time logistics tracking, and exclusive Elite-only digital collectibles.
                        </Text>
                    </View>

                    <View style={{ height: 480, justifyContent: 'center' }}>
                        {/* Floating Benefit 1 */}
                        <View style={[styles.mobileBenefitCard, { top: 20, left: 10 }]}>
                            <View style={styles.benefitIcon}>
                                <Ionicons name="notifications" size={18} color="#3B82F6" />
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A' }}>Instant Alerts</Text>
                            <Text style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>Price drops & restocks</Text>
                        </View>

                        {/* Floating Benefit 2 */}
                        <View style={[styles.mobileBenefitCard, { bottom: 60, right: 10 }]}>
                            <View style={styles.benefitIcon}>
                                <Ionicons name="map" size={18} color="#10B981" />
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A' }}>Live Tracking</Text>
                            <Text style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>Real-time GPS delivery</Text>
                        </View>

                        {/* Elite Phone Mockup */}
                        <View style={styles.phoneFrameElite}>
                            <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
                                {/* App Status Bar */}
                                <View style={{ height: 24, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="cellular" size={10} color="white" />
                                    <Ionicons name="wifi" size={10} color="white" />
                                    <Ionicons name="battery-full" size={10} color="white" />
                                </View>

                                {/* App Header */}
                                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                                    <View style={{ width: 80, height: 12, backgroundColor: '#3B82F6', borderRadius: 6 }} />
                                </View>

                                {/* App Body Preview */}
                                <View style={{ padding: 12 }}>
                                    <View style={{ height: 120, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
                                        <View style={{ position: 'absolute', bottom: 12, left: 12, right: 12, height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4 }} />
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={{ flex: 1, height: 140, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12 }} />
                                        <View style={{ flex: 1, height: 140, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12 }} />
                                    </View>
                                </View>

                                {/* App Bottom Nav */}
                                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, backgroundColor: '#1E293B', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                                    <Ionicons name="home" size={16} color="#3B82F6" />
                                    <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
                                    <Ionicons name="cart" size={16} color="rgba(255,255,255,0.4)" />
                                    <Ionicons name="person" size={16} color="rgba(255,255,255,0.4)" />
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 40, paddingHorizontal: 20 }}>
                        <TouchableOpacity style={styles.glassStoreButton}>
                            <Ionicons name="logo-google-playstore" size={24} color="white" />
                            <View>
                                <Text style={styles.storeSubText}>GET IT ON</Text>
                                <Text style={styles.storeMainText}>Google Play</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.glassStoreButton}>
                            <Ionicons name="logo-apple" size={24} color="white" />
                            <View>
                                <Text style={styles.storeSubText}>DOWNLOAD ON THE</Text>
                                <Text style={styles.storeMainText}>App Store</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* NEWSLETTER SECTION - PHASE 2 */}
                <View style={styles.newsletterCard}>
                    <Ionicons name="mail" size={40} color="#3B82F6" style={{ marginBottom: 16 }} />
                    <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', marginBottom: 8 }}>Elite Newsletter</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 22 }}>
                        Stay ahead of the curve. Get exclusive offers, ecosystem updates, and new arrivals directly in your inbox.
                    </Text>

                    <TextInput
                        placeholder="Enter your email address"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        style={styles.newsletterInput}
                    />

                    <TouchableOpacity style={styles.newsletterBtn}>
                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>SUBSCRIBE NOW</Text>
                    </TouchableOpacity>
                </View>

                {/* DYNAMIC PROMO BANNERS CAROUSEL */}
                {
                    promoBanners.length > 0 && (
                        <View style={{ marginTop: 20 }}>
                            <FlatList
                                ref={promoFlatListRef}
                                data={promoBanners}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                snapToInterval={width}
                                decelerationRate="fast"
                                scrollEventThrottle={16}
                                onMomentumScrollEnd={(e) => {
                                    const index = Math.round(e.nativeEvent.contentOffset.x / width);
                                    if (index !== currentPromoIndex) {
                                        setCurrentPromoIndex(index);
                                    }
                                }}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item: promo }) => (
                                    <TouchableOpacity
                                        activeOpacity={0.9}
                                        onPress={() => {
                                            if (promo.linkData?.productId) {
                                                supabase.from('products').select('*').eq('id', promo.linkData.productId).single()
                                                    .then(({ data }) => {
                                                        if (data) {
                                                            const promoDiscount = promo.linkData.discountValue ? {
                                                                type: promo.linkData.discountType || 'percent',
                                                                value: promo.linkData.discountValue
                                                            } : null;
                                                            navigation.navigate('ProductDetails', { product: { ...data, promoDiscount } });
                                                        } else {
                                                            handleEnterShop();
                                                        }
                                                    }).catch(() => handleEnterShop());
                                            } else {
                                                handleEnterShop();
                                            }
                                        }}
                                        style={{ width: width - 32, marginHorizontal: 16, borderRadius: 24, overflow: 'hidden', height: 140, backgroundColor: '#0F172A', boxShadow: '0px 8px 20px rgba(0,0,0,0.15)', shadowRadius: 15 }}
                                    >
                                        <Image
                                            source={{ uri: promo.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2670&auto=format&fit=crop' }}
                                            style={{ width: '100%', height: '100%', position: 'absolute', opacity: 0.5 }}
                                            resizeMode="cover"
                                        />
                                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)' }} />

                                        <View style={{ padding: 20, justifyContent: 'center', height: '100%' }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ backgroundColor: '#EF4444', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 }}>
                                                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 10, letterSpacing: 1 }}>
                                                            {promo.subtitle?.toUpperCase() || 'LIMITED OFFER'}
                                                        </Text>
                                                    </View>
                                                    <Text style={{ fontSize: 20, fontWeight: '900', color: 'white', marginBottom: 4, lineHeight: 24, paddingRight: 10 }}>
                                                        {promo.title || 'Special Promotion'}
                                                    </Text>
                                                </View>

                                                {promo.linkData?.timerEnd && (
                                                    <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' }}>
                                                        <Text style={{ color: 'white', fontSize: 9, fontWeight: '800', marginBottom: 4, letterSpacing: 1 }}>ENDS IN</Text>
                                                        <CountdownTimer targetDate={promo.linkData.timerEnd} lightMode={true} />
                                                    </View>
                                                )}
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                                <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 13 }}>
                                                    {promo.linkData?.text || 'Explore Offer'}
                                                </Text>
                                                <Ionicons name="arrow-forward" size={14} color="#F8FAFC" />
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />
                            {/* Pagination Dots */}
                            {promoBanners.length > 1 && (
                                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                                    {promoBanners.map((_, i) => (
                                        <View
                                            key={i}
                                            style={{
                                                width: currentPromoIndex === i ? 20 : 6,
                                                height: 6,
                                                borderRadius: 3,
                                                backgroundColor: currentPromoIndex === i ? '#3B82F6' : '#E2E8F0',
                                            }}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                {/* AI SEARCH SPOTLIGHT - PHASE 6 */}
                <View style={styles.aiSpotlightCard}>
                    <View style={styles.aiIconPulse}>
                        <Ionicons name="sparkles" size={32} color="#3B82F6" />
                    </View>
                    <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', marginBottom: 12 }}>Next-Gen AI discovery</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 22, marginBottom: 20 }}>
                        We're building an AI-powered concierge to help you find the perfect elite products across our global network. Coming soon to Abu Mafhal.
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(59, 130, 246, 0.2)', borderRadius: 20 }}>
                            <Text style={{ color: '#3B82F6', fontSize: 10, fontWeight: '900' }}>COMMING SOON</Text>
                        </View>
                        <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 20 }}>
                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900' }}>BETA ACCESS</Text>
                        </View>
                    </View>
                </View>

                {/* CURATED ELITE COLLECTIONS - PHASE 5 REDESIGN */}
                {
                    categories.length > 0 && (
                        <View style={{ marginTop: 32 }}>
                            <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                                <Text style={{ fontSize: 10, fontWeight: '900', color: '#3B82F6', letterSpacing: 2, marginBottom: 8 }}>PREMIUM SELECTION</Text>
                                <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A' }}>Curated Collections</Text>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                                {categories.map((cat, i) => (
                                    <TouchableOpacity key={cat?.id} style={styles.collectionCard} onPress={onEnterShop}>
                                        <ImageBackground
                                            source={{ uri: cat.image_url || `https://images.unsplash.com/photo-${1500000000000 + i}?q=80&w=2670&auto=format&fit=crop` }}
                                            style={StyleSheet.absoluteFill}
                                            imageStyle={{ borderRadius: 24 }}
                                        >
                                            <LinearGradient
                                                colors={['transparent', 'rgba(15, 23, 42, 0.9)']}
                                                style={styles.collectionGradient}
                                            >
                                                <Text style={styles.collectionTitle}>{cat?.name || 'Elite'}</Text>
                                            </LinearGradient>
                                        </ImageBackground>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )
                }

                {/* FLASH SALE */}
                {
                    flashSale.length > 0 && (
                        <View style={{ marginTop: 10, paddingHorizontal: 16 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ width: 8, height: 24, backgroundColor: '#EF4444', borderRadius: 4 }} />
                                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>Flash Sale</Text>
                                </View>
                                <TouchableOpacity onPress={onEnterShop}><Text style={{ color: '#EF4444', fontWeight: '800' }}>View All</Text></TouchableOpacity>
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                                {flashSale.map((item, i) => (
                                    <TouchableOpacity key={i} style={[styles.recCard, { width: 160, borderRadius: 20, padding: 0, overflow: 'hidden' }]} onPress={() => navigation.navigate('ProductDetails', { product: item })}>
                                        <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }} style={{ width: '100%', height: 160 }} />
                                        <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                            <Text style={{ color: 'white', fontSize: 11, fontWeight: '900' }}>-{item?.discount || 0}%</Text>
                                        </View>
                                        <View style={{ padding: 12 }}>
                                            <Text style={{ fontWeight: '700', fontSize: 14, color: '#0F172A' }} numberOfLines={1}>{item?.name}</Text>
                                            <Text style={{ fontWeight: '900', fontSize: 16, color: '#3B82F6', marginTop: 4 }}>₦{item?.price ? item.price.toLocaleString() : '0'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )
                }



                {/* NEW ARRIVALS (REAL DATA) */}
                {
                    newArrivals.length > 0 && (
                        <View style={styles.sectionContainer}>
                            <SectionHeader title="New Arrivals" action="View All" />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                                {newArrivals.map((item, i) => (
                                    <TouchableOpacity key={i} style={styles.newArrivalCard} onPress={() => navigation.navigate('ProductDetails', { product: item })}>
                                        <Image
                                            source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                            style={styles.newArrivalImg}
                                        />
                                        <View style={styles.newArrivalOverlay}>
                                            <Text style={styles.newArrivalPrice}>₦{item?.price ? item.price.toLocaleString() : '0'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )
                }

                {/* RECOMMENDED FOR YOU (REAL DATA) */}
                {
                    recommended.length > 0 && (
                        <View style={styles.graySection}>
                            <SectionHeader title="Recommended For You" />
                            <View style={styles.grid2Col}>
                                {recommended.map((item, i) => (
                                    <TouchableOpacity key={i} style={styles.recCard} onPress={() => navigation.navigate('ProductDetails', { product: item })}>
                                        <Image
                                            source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                            style={styles.recImg}
                                        />
                                        <View style={styles.recContent}>
                                            <Text style={styles.recName} numberOfLines={2}>{item?.name}</Text>
                                            <Text style={styles.recPrice}>₦{item?.price ? item.price.toLocaleString() : '0'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )
                }

                {/* ELITE CERTIFICATIONS & AWARDS - PHASE 6 */}
                <View style={styles.certificationStrip}>
                    <View style={styles.badgeItem}>
                        <Ionicons name="ribbon" size={18} color="#F59E0B" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 11, fontWeight: '900', color: '#1E293B' }}>TOP RATED 2024</Text>
                    </View>
                    <View style={styles.badgeItem}>
                        <Ionicons name="shield-checkmark" size={18} color="#10B981" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 11, fontWeight: '900', color: '#1E293B' }}>SECURE PLATFORM</Text>
                    </View>
                    <View style={styles.badgeItem}>
                        <Ionicons name="globe" size={18} color="#3B82F6" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 11, fontWeight: '900', color: '#1E293B' }}>GLOBAL LOGISTICS</Text>
                    </View>
                </View>

                {/* THE ABU MAFHAL GUARANTEE - PHASE 7 */}
                <View style={styles.guaranteeGrid}>
                    <View style={{ marginBottom: 32 }}>
                        <Text style={{ color: '#3B82F6', fontWeight: '900', fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>ELEVATED SECURITY</Text>
                        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>The Abu Mafhal Guarantee</Text>
                    </View>

                    <View style={styles.guaranteeItem}>
                        <View style={styles.guaranteeIcon}>
                            <Ionicons name="shield-checkmark" size={24} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, marginBottom: 4 }}>Triple-Verified Vendors</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20 }}>Every vendor undergoes rigorous background checks and quality audits before joining.</Text>
                        </View>
                    </View>

                    <View style={styles.guaranteeItem}>
                        <View style={styles.guaranteeIcon}>
                            <Ionicons name="wallet" size={24} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, marginBottom: 4 }}>Escrow Payment Protection</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20 }}>Your funds are held securely and only released to the vendor once you confirm delivery.</Text>
                        </View>
                    </View>

                    <View style={styles.guaranteeItem}>
                        <View style={styles.guaranteeIcon}>
                            <Ionicons name="airplane" size={24} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, marginBottom: 4 }}>White-Glove Logistics</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20 }}>Priority handling for all elite shipments with real-time tracking across 100+ countries.</Text>
                        </View>
                    </View>
                </View>

                {/* TRUST STRIP (NEW ROUND 2) */}
                <View style={styles.trustStrip}>
                    {TRUST_ITEMS.map((item, i) => (
                        <View key={i} style={styles.trustItem}>
                            <Ionicons name={item.icon} size={24} color={item.color} style={{ marginBottom: 8 }} />
                            <Text style={styles.trustText}>{item.label}</Text>
                        </View>
                    ))}
                </View>

                {/* MODERN FOOTER */}
                <Footer onEnterShop={onEnterShop} onNavigate={onNavigate} />

            </Animated.ScrollView >
        </SafeAreaView >
    );
};
