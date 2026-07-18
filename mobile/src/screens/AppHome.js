import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, ImageBackground, Image, TextInput, RefreshControl, Dimensions, Animated, FlatList, Platform, StatusBar, Vibration, Linking } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/theme';
import { SectionHeader } from '../components/SectionHeader';
import { Footer } from '../components/Footer';
import { ServiceIcon } from '../components/ServiceIcon';
import { supabase } from '../lib/supabase';
import { CountdownTimer } from '../components/CountdownTimer';
import { NewsletterCard } from '../components/NewsletterCard';
import { HomeSkeleton } from '../components/SkeletonLoader';
import { AutoScrollList } from '../components/AutoScrollList';
import { UserAvatar } from '../components/UserAvatar';
import * as ImagePicker from 'expo-image-picker';
import { geminiService } from '../services/geminiService';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

export const AppHome = ({ onGoToShop, onGoToCart, onGoToNotifications, onNavigate, onProductClick, user }) => {
    const insets = useSafeAreaInsets();
    const [banners, setBanners] = useState([]);
    const [categories, setCategories] = useState([]);
    const [flashSale, setFlashSale] = useState([]);
    const [newArrivals, setNewArrivals] = useState([]);
    const [recommended, setRecommended] = useState([]);
    const [promoBanners, setPromoBanners] = useState([]);
    const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
    const [currentHeroIndex, setCurrentHeroIndex] = useState(0); // Added for hero auto-slide
    const promoFlatListRef = useRef(null);
    const heroScrollRef = useRef(null); // Added for hero auto-slide

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [topVendors, setTopVendors] = useState([]);
    const [homeServices, setHomeServices] = useState([]);
    const [loyalty, setLoyalty] = useState(null);
    const [topCustomers, setTopCustomers] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [brands, setBrands] = useState([]);
    const [trendingProducts, setTrending] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);
    const [mostRated, setMostRated] = useState([]);
    const [dealOfDay, setDealOfDay] = useState(null);
    const [cartCount, setCartCount] = useState(0);
    const [liveCount] = useState(Math.floor(Math.random() * 80) + 40);
    const [recentlyViewed, setRecentlyViewed] = useState([]);
    const [limitedStock, setLimitedStock] = useState([]);
    const [priceDrops, setPriceDrops] = useState([]);
    const [checkInData, setCheckInData] = useState(null); // { streak, last_checkin, coins }
    const [spotlightVendor, setSpotlightVendor] = useState(null);
    const [showCheckInSuccess, setShowCheckInSuccess] = useState(false);
    const successAnim = useRef(new Animated.Value(0)).current;

    // AI Search States
    const [isListening, setIsListening] = useState(false);
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [analyzingImage, setAnalyzingImage] = useState(false);
    const [recording, setRecording] = useState(null);
    const [toast, setToast] = useState({ visible: false, message: '', icon: 'checkmark-circle' });
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const scrollX = useRef(new Animated.Value(0)).current;

    const fetchData = async () => {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();

            // Promise.allSettled allows all queries to run in parallel
            // If one fails, others still complete.
            const results = await Promise.allSettled([
                // 0: All Banners
                supabase.from('banners').select('*').eq('is_active', true).order('display_order'),
                // 1: Promo Banners
                supabase.from('banners').select('*').eq('section', 'promo').eq('is_active', true).order('created_at', { ascending: false }),
                // 2: Flash Sale
                supabase.from('products').select('*').eq('status', 'approved').not('compare_at_price', 'is', null).limit(4),
                // 3: New Arrivals
                supabase.from('products').select('*').eq('status', 'approved').eq('is_new', true).limit(6),
                // 4: Recommended
                supabase.from('products').select('*').eq('status', 'approved').limit(10),
                // 5: Categories
                supabase.from('categories').select('*').eq('is_active', true).order('display_order').limit(6),
                // 6: Top Vendors
                supabase.from('vendors').select('*').eq('vendor_status', 'active').eq('is_verified', true).order('total_sales', { ascending: false }).order('review_count', { ascending: false }).limit(8),
                // 7: Home Services
                supabase.from('home_services').select('*').eq('is_active', true).order('display_order'),
                // 8: Top Customers
                supabase.from('profiles').select('*').eq('is_featured', true).order('total_spend', { ascending: false }).limit(10),
                // 9: Reviews
                supabase.from('reviews').select('*, user:user_id(full_name, avatar_url)').eq('is_displayed', true).limit(10),
                // 10: Brands
                supabase.from('brands').select('*').eq('is_featured', true).limit(10),
                // 11: Trending
                supabase.from('products').select('*').eq('status', 'approved').order('total_sales', { ascending: false }).limit(8),
                // 12: Most Rated
                supabase.from('products').select('*').eq('status', 'approved').not('average_rating', 'is', null).order('average_rating', { ascending: false }).limit(8),
                // 13: Deal of Day
                supabase.from('products').select('*').eq('status', 'approved').not('compare_at_price', 'is', null).order('compare_at_price', { ascending: false }).limit(1),
                // 14: Limited Stock
                supabase.from('products').select('*').eq('status', 'approved').not('stock_quantity', 'is', null).lt('stock_quantity', 10).gt('stock_quantity', 0).order('stock_quantity', { ascending: true }).limit(8),
                // 15: Price Drops
                supabase.from('products').select('*').eq('status', 'approved').not('compare_at_price', 'is', null).order('updated_at', { ascending: false }).limit(8),
                // 16: Spotlight Vendor
                supabase.from('vendors').select('*').eq('vendor_status', 'active').eq('is_verified', true).order('created_at', { ascending: false }).limit(1),
                // 17-19: User specific data (conditional)
                currentUser ? supabase.from('loyalty').select('*').eq('user_id', currentUser.id).maybeSingle() : Promise.resolve({ data: null }),
                currentUser ? supabase.from('orders').select('id, status, total_amount, created_at, order_items(id)').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(2) : Promise.resolve({ data: null }),
                currentUser ? supabase.from('cart_items').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id) : Promise.resolve({ count: 0 }),
                currentUser ? supabase.from('daily_checkins').select('*').eq('user_id', currentUser.id).order('checkin_date', { ascending: false }).order('created_at', { ascending: false }).limit(1) : Promise.resolve({ data: null }),
            ]);

            // Helper to get data safely
            const getVal = (idx) => (results[idx].status === 'fulfilled' ? results[idx].value : { data: null });

            // 0: Banners
            const bAll = getVal(0).data;
            if (bAll) {
                const homeBanners = bAll.filter(b => b.section === 'home' || !b.section || b.section === 'all' || b.section === '');
                setBanners(homeBanners);
            }

            // 1: Promo
            const promoData = getVal(1).data;
            if (promoData) {
                const validPromos = promoData.map(promo => {
                    let linkData = { text: promo.action_link || '', locations: ['home'] };
                    try { const parsed = JSON.parse(promo.action_link); if (parsed && typeof parsed === 'object') linkData = { ...linkData, ...parsed }; } catch (e) { }
                    return { ...promo, linkData };
                }).filter(promo => {
                    const hasLocation = !promo.linkData.locations || promo.linkData.locations.length === 0 || promo.linkData.locations.includes('home');

                    // Filter out expired promos if a timerEnd date is specified
                    let isNotExpired = true;
                    if (promo.linkData?.timerEnd) {
                        const expiryDate = new Date(promo.linkData.timerEnd);
                        // If it's just a date string, it marks the START of that day.
                        // We check if current time is past that.
                        isNotExpired = isNaN(expiryDate.getTime()) || new Date() <= expiryDate;
                    }

                    return hasLocation && isNotExpired;
                });
                setPromoBanners(validPromos);
            }

            // 2-5: Basic grids
            setFlashSale(getVal(2).data || []);
            setNewArrivals(getVal(3).data || []);
            setRecommended(getVal(4).data || []);
            setCategories(getVal(5).data || []);

            // 6: Top Vendors + Profiles (Post-process)
            const vendorData = getVal(6).data || [];
            if (vendorData.length > 0) {
                const userIds = vendorData.map(v => v.user_id).filter(Boolean);
                const { data: profileData } = await supabase.from('profiles').select('id, avatar_url, full_name').in('id', userIds);
                setTopVendors(vendorData.map(v => ({ ...v, profiles: profileData?.find(p => p.id === v.user_id) || null })));
            } else { setTopVendors([]); }

            // 7-12: Misc horizontal lists
            setHomeServices(getVal(7).data || []);
            setTopCustomers(getVal(8).data || []);
            setReviews(getVal(9).data || []);
            setBrands(getVal(10).data || []);
            setTrending(getVal(11).data || []);
            setMostRated(getVal(12).data || []);

            // 13-16: Spotlight features
            const dealData = getVal(13).data;
            if (dealData?.[0]) setDealOfDay(dealData[0]);
            setLimitedStock(getVal(14).data || []);
            const pdData = getVal(15).data || [];
            setPriceDrops(pdData.filter(p => p.price < (p.compare_at_price || Infinity)));
            setSpotlightVendor(getVal(16).data?.[0] || null);

            // 17-20: User specific
            if (currentUser) {
                setLoyalty(getVal(17).data);
                setRecentOrders(getVal(18).data || []);
                setCartCount(getVal(19).count || 0);

                // 20: Check-in logic
                const ci = getVal(20).data;
                const todayStr = new Date().toLocaleDateString('en-CA');
                const CHECKIN_REWARDS = [3, 4, 5, 6, 7, 8, 9, 10, 10, 10];

                if (ci && ci.length > 0) {
                    const lastDate = String(ci[0].checkin_date).split('T')[0].split(' ')[0];
                    const isToday = lastDate === todayStr;
                    const diffDays = Math.floor((new Date(todayStr).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
                    const currentStreak = diffDays > 1 ? 0 : (ci[0].streak || 0);
                    setCheckInData({ checkedInToday: isToday, streak: currentStreak, coins: CHECKIN_REWARDS[Math.min(currentStreak, 9)] || 3 });
                } else {
                    setCheckInData({ checkedInToday: false, streak: 0, coins: CHECKIN_REWARDS[0] });
                }
            }

        } catch (e) {
            console.log('Error fetching home data:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const showToast = (message, icon = 'checkmark-circle') => {
        setToast({ visible: true, message, icon });
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
            Animated.delay(2000),
            Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: false })
        ]).start(() => setToast({ ...toast, visible: false }));
    };

    // Helper to request permissions
    useEffect(() => {
        (async () => {
            const { status: audioStatus } = await Audio.requestPermissionsAsync();
            const { status: cameraStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (audioStatus !== 'granted' || cameraStatus !== 'granted') {
                console.log('Permissions denied');
            }
        })();
        return () => {
            if (recording) {
                recording.stopAndUnloadAsync();
            }
        };
    }, []);

    // AI Search Handlers
    const handleVoiceSearch = async () => {
        try {
            if (recording) {
                await stopRecording();
            } else {
                await startRecording();
            }
        } catch (error) {
            console.log('Voice Error:', error);
            setIsListening(false);
            setShowVoiceModal(false);
            showToast(error.message, 'alert-circle');
        }
    };

    const startRecording = async () => {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            setIsListening(true);
            setShowVoiceModal(true);

            setTimeout(() => {
                stopRecording(recording);
            }, 4000);

        } catch (err) {
            console.error('Failed to start recording', err);
            showToast('Could not start microphone', 'alert-circle');
        }
    };

    const stopRecording = async (currentRec) => {
        const rec = currentRec || recording;
        if (!rec) return;

        setRecording(null);
        setIsListening(false);
        setShowVoiceModal(false);

        try {
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();
            const base64Info = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64'
            });

            showToast('Processing voice...', 'sync');
            const text = await geminiService.searchByVoice(base64Info);

            if (text) {
                setSearchQuery(text);
                showToast(`Heard: "${text}"`, 'mic');
            } else {
                showToast('Could not understand audio', 'help-circle');
            }

        } catch (error) {
            console.log('Stop Recording Error:', error);
            showToast('Processing Error', 'alert-circle');
        }
    };

    const handleImageSearch = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.5,
                base64: true
            });

            if (!result.canceled && result.assets[0].base64) {
                setAnalyzingImage(true);
                showToast('Analyzing image...', 'scan');

                const keywords = await geminiService.searchByImage(result.assets[0].base64);

                setAnalyzingImage(false);
                if (keywords) {
                    setSearchQuery(keywords);
                    showToast(`Found: ${keywords}`, 'checkmark-circle');
                } else {
                    showToast('Could not identify product', 'help-circle');
                }
            }
        } catch (e) {
            setAnalyzingImage(false);
            console.log(e);
            showToast('Gallery Error', 'alert-circle');
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [])
    );

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    // Hero Banner Auto-Slide Logic
    useEffect(() => {
        if (banners.length > 1) {
            const timer = setInterval(() => {
                setCurrentHeroIndex(prev => {
                    const nextIndex = (prev + 1) % banners.length;
                    heroScrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
                    return nextIndex;
                });
            }, 5000); // 5 seconds for hero
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
            }, 4000); // 4 seconds interval
            return () => clearInterval(timer);
        }
    }, [promoBanners.length]);

    const handleSearchSubmit = () => {
        if (searchQuery.trim()) {
            onGoToShop();
        }
    };

    const handleProductClick = (item) => {
        // Track recently viewed (keep last 10 unique)
        setRecentlyViewed(prev => {
            const filtered = prev.filter(p => p.id !== item.id);
            return [item, ...filtered].slice(0, 10);
        });
        onProductClick(item);
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
                <HomeSkeleton />
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            {/* ── BRAND HEADER — Deep Tech Blue + Gold ── */}
            <View style={{ backgroundColor: '#0E1A2E', paddingTop: (insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24))) + 6, paddingBottom: 10, zIndex: 10 }}>
                <StatusBar backgroundColor="#0E1A2E" barStyle="light-content" translucent={true} />

                {/* Top row: logo + avatar + name + icons */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }}>
                    {/* Left: Logo + user greeting */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                        {/* Brand Logo */}
                        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(217,167,58,0.08)', borderWidth: 1.5, borderColor: 'rgba(217,167,58,0.3)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                            <Image source={AM_LOGO} style={{ width: 34, height: 34 }} resizeMode="contain" />
                        </View>
                        {/* Avatar with Gold ring */}
                        <View style={{ borderWidth: 2, borderColor: '#D9A73A', borderRadius: 22, padding: 2, shadowColor: '#D9A73A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 4 }}>
                            <UserAvatar user={user} size={34} />
                        </View>
                        <View>
                            <Text style={{ fontSize: 9, color: '#D9A73A', fontWeight: '900', letterSpacing: 1.2 }}>{getGreeting().toUpperCase()}</Text>
                            <Text style={{ fontSize: 13.5, fontWeight: '900', color: 'white', marginTop: 1 }}>
                                {user?.fullName || user?.user_metadata?.full_name || user?.full_name || user?.email?.split('@')[0] || 'Member'} 👋
                            </Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={onGoToNotifications}
                            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(217,167,58,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,167,58,0.2)' }}>
                            <Ionicons name="notifications-outline" size={17} color="#D9A73A" />
                            <View style={{ position: 'absolute', top: 5, right: 5, width: 5, height: 5, backgroundColor: '#EF4444', borderRadius: 2.5 }} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onGoToCart}
                            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(217,167,58,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,167,58,0.2)' }}>
                            <Ionicons name="cart-outline" size={17} color="#D9A73A" />
                            {cartCount > 0 && (
                                <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 13, height: 13, backgroundColor: '#D9A73A', borderRadius: 6.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}>
                                    <Text style={{ color: '#0E1A2E', fontSize: 7.5, fontWeight: '900' }}>{cartCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search bar — Gold accent */}
                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: 'rgba(217,167,58,0.25)', gap: 8 }}>
                        <Ionicons name="search" size={16} color="rgba(217,167,58,0.7)" />
                        <TextInput
                            placeholder="Search products, brands, sellers..."
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            style={{ flex: 1, fontSize: 12.5, color: 'white', fontWeight: '600' }}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearchSubmit}
                        />
                        {/* AI Search Icons */}
                        {searchQuery.length === 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 2 }}>
                                <TouchableOpacity onPress={handleVoiceSearch}>
                                    <Ionicons name="mic" size={16} color="#D9A73A" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleImageSearch}>
                                    <Ionicons name="camera" size={16} color="#D9A73A" />
                                </TouchableOpacity>
                            </View>
                        )}
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 3 }}>
                                <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.4)" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={handleSearchSubmit} style={{ backgroundColor: '#D9A73A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                            <Text style={{ color: '#0E1A2E', fontSize: 10, fontWeight: '900' }}>GO</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Live shopper count + ticker */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 5, paddingBottom: 3 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#22C55E', marginRight: 5 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '700', flex: 1 }}>{liveCount} people shopping right now</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#D9A73A' }} />
                        <Text style={{ color: 'rgba(217,167,58,0.7)', fontSize: 8, fontWeight: '700' }}>ABU MAFHAL</Text>
                    </View>
                </View>
                {/* Gold gradient accent line */}
                <LinearGradient
                    colors={['transparent', '#D9A73A', '#F5C842', '#D9A73A', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ height: 2, width: '100%', marginTop: 2 }}
                />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* ── PLATFORM STATS STRIP ── */}
                <PlatformStats />

                {/* ── HERO CAROUSEL ── */}
                {banners.length > 0 && (
                    <View style={{ height: 95, marginTop: 6 }}>
                        <Animated.ScrollView
                            ref={heroScrollRef}
                            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                            onMomentumScrollEnd={(e) => {
                                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                                if (index !== currentHeroIndex) setCurrentHeroIndex(index);
                            }}
                            scrollEventThrottle={16}
                        >
                            {banners.map((item, index) => (
                                <TouchableOpacity key={index} activeOpacity={0.9} onPress={onGoToShop} style={{ width: width, paddingHorizontal: 16, height: 95 }}>
                                    <ImageBackground
                                        source={{ uri: item?.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2670&auto=format&fit=crop' }}
                                        style={{ width: '100%', height: '100%' }}
                                        imageStyle={{ borderRadius: 10 }}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            ))}
                        </Animated.ScrollView>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4 }}>
                            {banners.map((_, i) => {
                                const opacity = scrollX.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
                                const dotWidth = scrollX.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [3, 8, 3], extrapolate: 'clamp' });
                                return <Animated.View key={i} style={{ height: 3, width: dotWidth, borderRadius: 1.5, backgroundColor: '#0E1A2E', marginHorizontal: 1.5, opacity }} />;
                            })}
                        </View>
                    </View>
                )}

                {/* ELITE MEMBERSHIP CARD */}
                <EliteMembershipCard user={user} checkInData={checkInData} loyalty={loyalty} />

                {/* ── DAILY CHECK-IN ── PREMIUM ── */}
                {/* ── DAILY CHECK-IN ── PREMIUM ── */}
                {checkInData !== null && (
                    <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
                        <View style={{
                            backgroundColor: '#0E1A2E', borderRadius: 12, overflow: 'hidden',
                            borderWidth: 1, borderColor: checkInData.checkedInToday ? 'rgba(34,197,94,0.4)' : 'rgba(217, 167, 58, 0.15)',
                        }}>
                            {/* Top glow accent */}
                            <View style={{ position: 'absolute', top: -35, left: '35%', width: 100, height: 60, borderRadius: 50, backgroundColor: checkInData.checkedInToday ? 'rgba(34,197,94,0.1)' : 'rgba(217, 167, 58, 0.08)' }} />

                            <View style={{ padding: 12 }}>
                                {/* Header row */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                    <View style={{ flex: 1, paddingRight: 4 }}>
                                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 }}>GAMIFICATION</Text>
                                        <Text style={{ color: 'white', fontSize: 14.5, fontWeight: '900', marginTop: 1.5 }}>
                                            {checkInData.checkedInToday ? '✅ Checked In!' : '🎁 Daily Check-In'}
                                        </Text>
                                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1.5 }}>
                                            {checkInData.checkedInToday
                                                ? 'Come back tomorrow for more!'
                                                : 'Tap to earn coins & build streak'}
                                        </Text>
                                    </View>
                                    {/* Streak badge */}
                                    <View style={{ alignItems: 'center', backgroundColor: 'rgba(217, 167, 58, 0.12)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.2)' }}>
                                        <Text style={{ fontSize: 13.5 }}>🔥</Text>
                                        <Text style={{ color: '#D9A73A', fontWeight: '900', fontSize: 13, marginTop: 1 }}>{checkInData.streak}</Text>
                                        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '700' }}>STREAK</Text>
                                    </View>
                                </View>

                                {/* 7-day calendar dots */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                                        const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                                        const isFilled = i < todayIdx || (i === todayIdx && checkInData.checkedInToday);
                                        const isToday = i === todayIdx;
                                        return (
                                            <View key={day} style={{ alignItems: 'center', gap: 4 }}>
                                                <View style={{
                                                    width: 28, height: 28, borderRadius: 14,
                                                    backgroundColor: isFilled
                                                        ? (isToday && checkInData.checkedInToday ? '#22C55E' : '#D9A73A')
                                                        : isToday ? 'rgba(217, 167, 58, 0.18)' : 'rgba(255,255,255,0.06)',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    borderWidth: isToday ? 1 : 0,
                                                    borderColor: isToday ? (checkInData.checkedInToday ? '#22C55E' : '#D9A73A') : 'transparent',
                                                    shadowColor: isToday ? '#D9A73A' : 'transparent',
                                                    shadowOffset: { width: 0, height: 0 },
                                                    shadowOpacity: 0.5,
                                                    shadowRadius: 3,
                                                    elevation: isToday ? 1 : 0,
                                                }}>
                                                    {isFilled
                                                        ? <Ionicons name="checkmark" size={14} color="white" />
                                                        : isToday
                                                            ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D9A73A' }} />
                                                            : <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                                                    }
                                                </View>
                                                <Text style={{ color: isToday ? '#D9A73A' : 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: isToday ? '800' : '600' }}>{day}</Text>
                                            </View>
                                        );
                                    })}
                                </View>

                                {/* Coin reward + CTA */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    {/* Coin pill */}
                                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3.5, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4.5 }}>
                                        <Text style={{ fontSize: 13 }}>🪙</Text>
                                        <View>
                                            <Text style={{ color: '#D9A73A', fontWeight: '900', fontSize: 12.5 }}>+{checkInData.coins}</Text>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700' }}>COINS</Text>
                                        </View>
                                        <View style={{ flex: 1 }} />
                                        <View style={{ backgroundColor: 'rgba(217, 167, 58, 0.12)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                                            <Text style={{ color: '#D9A73A', fontSize: 9, fontWeight: '800' }}>Bonus</Text>
                                        </View>
                                    </View>

                                    {/* CHECK IN / Done button */}
                                    {!checkInData.checkedInToday ? (
                                        <TouchableOpacity
                                            onPress={async () => {
                                                try {
                                                    Vibration.vibrate(100);
                                                    const { data: { user: u } } = await supabase.auth.getUser();
                                                    if (!u) return;

                                                    const todayStr = new Date().toLocaleDateString('en-CA');
                                                    const newStreak = (checkInData.streak || 0) + 1;
                                                    const CHECKIN_REWARDS = [3, 4, 5, 6, 7, 8, 9, 10, 10, 10];
                                                    const coins = CHECKIN_REWARDS[Math.min(newStreak - 1, 9)];

                                                    const { error: insError } = await supabase.from('daily_checkins').insert({
                                                        user_id: u.id,
                                                        checkin_date: todayStr,
                                                        streak: newStreak,
                                                        coins_awarded: coins
                                                    });

                                                    if (insError) {
                                                        console.log('--- CHECK-IN INSERT ERROR ---', insError);
                                                        if (insError.code === '23505') {
                                                            console.log('User already checked in for today (Conflict)');
                                                        } else {
                                                            alert('Check-in failed. Please try again later.');
                                                            return;
                                                        }
                                                    }

                                                    const { error: rpcError } = await supabase.rpc('increment_mafhal_coins', {
                                                        user_id_arg: u.id,
                                                        amount: coins
                                                    });

                                                    if (rpcError) console.log('--- COIN INCREMENT ERROR ---', rpcError);

                                                    setCheckInData({ checkedInToday: true, streak: newStreak, coins });

                                                    setShowCheckInSuccess(true);
                                                    Animated.spring(successAnim, {
                                                        toValue: 1,
                                                        friction: 4,
                                                        useNativeDriver: true
                                                    }).start();

                                                    setTimeout(() => {
                                                        Animated.timing(successAnim, {
                                                            toValue: 0,
                                                            duration: 300,
                                                            useNativeDriver: true
                                                        }).start(() => setShowCheckInSuccess(false));
                                                    }, 3000);
                                                } catch (e) { console.log('Check-in error:', e); }
                                            }}
                                            style={{
                                                backgroundColor: '#D9A73A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
                                                shadowColor: '#D9A73A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 4,
                                            }}>
                                            <Text style={{ fontWeight: '900', color: '#0E1A2E', fontSize: 12.5 }}>CHECK IN</Text>
                                            <Text style={{ fontWeight: '700', color: 'rgba(14,26,46,0.6)', fontSize: 9, textAlign: 'center', marginTop: 1 }}>TAP NOW</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={{ backgroundColor: '#22C55E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="checkmark-circle" size={22} color="white" />
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                )}


                {/* ── RECENT ORDERS QUICK STRIP ── */}
                {recentOrders.length > 0 && (
                    <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 3.5, height: 15, backgroundColor: '#D9A73A', borderRadius: 2 }} />
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Recent Orders</Text>
                            </View>
                            <TouchableOpacity onPress={() => onNavigate('orders')}>
                                <Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 10 }}>See All →</Text>
                            </TouchableOpacity>
                        </View>
                        {recentOrders.map((ord, i) => {
                            const STATUS_COLORS = {
                                pending: { bg: 'rgba(217,167,58,0.12)', text: '#D9A73A' },
                                processing: { bg: 'rgba(14,26,46,0.08)', text: '#0E1A2E' },
                                shipped: { bg: 'rgba(217,167,58,0.08)', text: '#C49130' },
                                delivered: { bg: 'rgba(34,197,94,0.1)', text: '#16A34A' },
                                cancelled: { bg: 'rgba(239,68,68,0.1)', text: '#DC2626' },
                            };
                            const sc = STATUS_COLORS[ord.status?.toLowerCase()] || { bg: 'rgba(217,167,58,0.08)', text: '#8A9BB0' };
                            return (
                                <TouchableOpacity key={ord.id} onPress={() => onNavigate('orders')}
                                    style={{ backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(217,167,58,0.15)', gap: 12, elevation: 1 }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(217,167,58,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,167,58,0.2)' }}>
                                        <Ionicons name="receipt-outline" size={16} color="#D9A73A" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: '800', color: '#0E1A2E', fontSize: 12 }}>#{ord.id.slice(0, 8).toUpperCase()}</Text>
                                        <Text style={{ color: '#8A9BB0', fontSize: 10, marginTop: 2 }}>{ord.order_items?.length || 0} items • {new Date(ord.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                        <View style={{ backgroundColor: sc.bg, paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 6 }}>
                                            <Text style={{ color: sc.text, fontSize: 8.5, fontWeight: '900' }}>{ord.status?.toUpperCase()}</Text>
                                        </View>
                                        <Text style={{ fontWeight: '900', color: '#D9A73A', fontSize: 12 }}>₦{(ord.total_amount || 0).toLocaleString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* ── CART REMINDER ── */}
                {cartCount > 0 && (
                    <TouchableOpacity onPress={onGoToCart}
                        style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#0E1A2E', borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(217,167,58,0.3)', elevation: 2 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(217,167,58,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,167,58,0.3)' }}>
                            <Ionicons name="cart" size={18} color="#D9A73A" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '900', color: 'white', fontSize: 12.5 }}>You have {cartCount} item{cartCount > 1 ? 's' : ''} in cart!</Text>
                            <Text style={{ color: '#D9A73A', fontSize: 10.5, marginTop: 2, fontWeight: '700' }}>Tap to complete your order →</Text>
                        </View>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#D9A73A', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="chevron-forward" size={14} color="#0E1A2E" />
                        </View>
                    </TouchableOpacity>
                )}

                {/* 1. VERIFIED SELLERS (Auto Scroll) */}
                {topVendors.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 3.5, height: 15, backgroundColor: '#D9A73A', borderRadius: 2 }} />
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Top Verified Sellers</Text>
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 10 }}>See All →</Text></TouchableOpacity>
                        </View>
                        <AutoScrollList
                            data={topVendors}
                            itemWidth={80}
                            interval={3000}
                            contentContainerStyle={{ paddingHorizontal: 16 }}
                            renderItem={({ item: vendor }) => (
                                <TouchableOpacity style={{ alignItems: 'center', width: 72, marginRight: 8 }} onPress={onGoToShop}>
                                    <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#F5F3EB', padding: 2.5, borderWidth: 2, borderColor: '#D9A73A', shadowColor: '#D9A73A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 }}>
                                         <Image
                                             source={{ uri: vendor?.profiles?.avatar_url || vendor?.logo_url || 'https://placehold.co/200' }}
                                             style={{ width: '100%', height: '100%', borderRadius: 27 }}
                                             resizeMode="cover"
                                         />
                                         <View style={{ position: 'absolute', bottom: -1, right: -1, backgroundColor: '#D9A73A', borderRadius: 7, padding: 1 }}>
                                             <Ionicons name="checkmark-circle" size={13} color="white" />
                                         </View>
                                    </View>
                                    <Text style={{ marginTop: 6, fontSize: 11, fontWeight: '700', color: '#0E1A2E', textAlign: 'center' }} numberOfLines={1}>
                                        {vendor?.business_name || vendor?.store_name || 'Vendor'}
                                    </Text>
                                    <View style={{ marginTop: 2, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 9.5, color: '#8A9BB0', fontWeight: '600' }}>{vendor?.total_sales || 0} Sales</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                                            <Ionicons name="star" size={9.5} color="#D9A73A" />
                                            <Text style={{ fontSize: 9.5, color: '#8A9BB0', fontWeight: '600' }}>4.9</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}

                {/* 2. TOP CUSTOMERS (Auto Scroll) */}
                {topCustomers.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <View style={{ width: 3.5, height: 15, backgroundColor: '#0E1A2E', borderRadius: 2 }} />
                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Elite Members</Text>
                        </View>
                        <AutoScrollList
                            data={topCustomers}
                            itemWidth={64} // 56 width + 8 gap
                            interval={3500}
                            contentContainerStyle={{ paddingHorizontal: 16 }}
                            renderItem={({ item: customer }) => (
                                <View style={{ alignItems: 'center', width: 56, marginRight: 8 }}>
                                    <View style={{ width: 44, height: 44, position: 'relative' }}>
                                        <UserAvatar user={customer} size={44} border="#D9A73A" />
                                        <View style={{ position: 'absolute', bottom: -3, alignSelf: 'center', backgroundColor: '#D9A73A', paddingHorizontal: 5, borderRadius: 4 }}>
                                            <Text style={{ fontSize: 8, fontWeight: '900', color: '#0E1A2E' }}>VIP</Text>
                                        </View>
                                    </View>
                                    <Text style={{ marginTop: 5, fontSize: 10.5, fontWeight: '700', color: '#0E1A2E', textAlign: 'center' }} numberOfLines={1}>
                                        {customer?.full_name?.split(' ')[0] || 'Member'}
                                    </Text>
                                    <Text style={{ fontSize: 9.5, color: '#8A9BB0', fontWeight: '600', marginTop: 1 }}>
                                        ₦{(customer?.total_spend || 0).toLocaleString()}
                                    </Text>
                                </View>
                            )}
                        />
                    </View>
                )}

                {/* 3. CUSTOMER REVIEWS (Auto Scroll) */}
                {reviews.length > 0 && (
                    <View style={{ marginTop: 14, paddingBottom: 4 }}>
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                            <View style={{ width: 3, height: 11, backgroundColor: '#D9A73A', borderRadius: 1.5 }} />
                            <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#0E1A2E' }}>Member Voices</Text>
                        </View>
                        <AutoScrollList
                            data={reviews}
                            itemWidth={200} // 192 width + 8 gap
                            interval={4000}
                            contentContainerStyle={{ paddingHorizontal: 16 }}
                            renderItem={({ item: review }) => (
                                <View style={{ width: 192, backgroundColor: 'white', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.12)', marginRight: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                        <UserAvatar user={review?.user} size={26} />
                                        <View style={{ marginLeft: 8 }}>
                                            <Text style={{ fontWeight: '700', fontSize: 11.5, color: '#0E1A2E' }}>{review?.user?.full_name || 'User'}</Text>
                                            <View style={{ flexDirection: 'row', gap: 0.5, marginTop: 1.5 }}>
                                                {[...Array(5)].map((_, i) => (
                                                    <Ionicons key={i} name="star" size={10} color={i < (review?.rating || 0) ? "#D9A73A" : "#E2E8F0"} />
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                    <Text style={{ fontSize: 11, color: '#475569', lineHeight: 16 }} numberOfLines={3}>"{review?.comment || ''}"</Text>
                                </View>
                            )}
                        />
                    </View>
                )}

                {/* 4. FEATURED BRANDS */}
                {brands.length > 0 && (
                    <View style={{ marginTop: 14, paddingBottom: 4 }}>
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                            <View style={{ width: 3, height: 11, backgroundColor: '#D9A73A', borderRadius: 1.5 }} />
                            <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#0E1A2E' }}>Featured Brands</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                            {brands.map((brand, i) => (
                                <TouchableOpacity key={i} style={{ alignItems: 'center' }} onPress={onGoToShop}>
                                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'white', padding: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.15)', boxShadow: '0px 2px 5px rgba(0,0,0,0.06)' }}>
                                        <Image source={{ uri: brand?.logo_url || 'https://placehold.co/100' }} style={{ width: 32, height: 32, resizeMode: 'contain' }} />
                                    </View>
                                    <Text style={{ marginTop: 5, fontSize: 10.5, fontWeight: '600', color: '#475569' }}>{brand?.name || 'Brand'}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* FLASH SALE WITH TIMER */}
                {flashSale.length > 0 && (
                    <View style={{ marginTop: 14, paddingHorizontal: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 3, height: 13, backgroundColor: '#D9A73A', borderRadius: 1.5 }} />
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Flash Sale</Text>
                                <CountdownTimer targetDate={new Date().setHours(24, 0, 0, 0)} />
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 10.5 }}>See All</Text></TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {flashSale.map((item, i) => (
                                <TouchableOpacity key={i} style={[styles.recCard, { width: '49%', borderRadius: 10, padding: 0, overflow: 'hidden', marginBottom: 6, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.12)' }]} onPress={() => onProductClick(item)}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }} style={{ width: '100%', height: 115 }} />
                                    <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: '#D9A73A', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ color: '#0E1A2E', fontSize: 8, fontWeight: '900' }}>-{item?.discount}%</Text>
                                    </View>
                                    <View style={{ padding: 8 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 13, color: '#0E1A2E' }} numberOfLines={1}>{item?.name}</Text>
                                        <Text style={{ fontWeight: '900', fontSize: 14.5, color: '#D9A73A', marginTop: 1 }}>₦{item?.price?.toLocaleString() || '0'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── DEAL OF THE DAY ── */}
                {dealOfDay && (
                    <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                            <View style={{ width: 3, height: 13, backgroundColor: '#D9A73A', borderRadius: 1.5 }} />
                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Deal of the Day</Text>
                            <CountdownTimer targetDate={new Date().setHours(24, 0, 0, 0)} />
                        </View>
                        <TouchableOpacity onPress={() => onProductClick(dealOfDay)} activeOpacity={0.9}
                            style={{ borderRadius: 10, overflow: 'hidden', height: 130, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.15)' }}>
                            <Image
                                source={{ uri: dealOfDay?.images?.[0] || 'https://placehold.co/600x400' }}
                                style={{ width: '100%', height: '100%', position: 'absolute' }}
                                resizeMode="cover"
                            />
                            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(14,26,46,0.6)' }} />
                            <View style={{ position: 'absolute', top: 10, left: 10 }}>
                                <View style={{ backgroundColor: '#D9A73A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' }}>
                                    <Text style={{ color: '#0E1A2E', fontWeight: '900', fontSize: 9.5 }}>⚡ TODAY ONLY</Text>
                                </View>
                            </View>
                            <View style={{ position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 14.5, marginBottom: 1 }} numberOfLines={1}>{dealOfDay?.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Text style={{ color: '#D9A73A', fontWeight: '900', fontSize: 16.5 }}>₦{(dealOfDay?.price || 0).toLocaleString()}</Text>
                                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5, textDecorationLine: 'line-through' }}>₦{(dealOfDay?.compare_at_price || 0).toLocaleString()}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => onProductClick(dealOfDay)}
                                    style={{ backgroundColor: '#D9A73A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                                    <Text style={{ color: '#0E1A2E', fontWeight: '900', fontSize: 10.5 }}>Grab Deal</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── TRENDING NOW ── */}
                {trendingProducts.length > 0 && (
                    <View style={{ marginTop: 14 }}>
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 3, height: 13, backgroundColor: '#D9A73A', borderRadius: 1.5 }} />
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Trending Now</Text>
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 10.5 }}>See All</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
                            {trendingProducts.map((item, i) => (
                                <TouchableOpacity key={i} onPress={() => onProductClick(item)}
                                    style={{ width: 115, backgroundColor: 'white', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.12)', elevation: 1 }}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                        style={{ width: 115, height: 100, backgroundColor: '#F8FAFC' }} resizeMode="cover" />
                                    <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: '#0E1A2E', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5, borderColor: '#D9A73A' }}>
                                        <Text style={{ color: '#D9A73A', fontSize: 8.5, fontWeight: '900' }}>#{i + 1} TREND</Text>
                                    </View>
                                    <View style={{ padding: 8 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 12, color: '#0E1A2E' }} numberOfLines={1}>{item?.name}</Text>
                                        <Text style={{ fontWeight: '900', fontSize: 13.5, color: '#D9A73A', marginTop: 1 }}>₦{(item?.price || 0).toLocaleString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* ── ELITE COLLECTIONS ── PREMIUM REDESIGN ── */}
                <View style={{ marginTop: 14 }}>

                    {/* Dark Section Header */}
                    <View style={{ backgroundColor: '#0E1A2E', marginHorizontal: 16, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.15)' }}>
                        {/* Top row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <View style={{ flex: 1, paddingRight: 4 }}>
                                <Text style={{ color: '#D9A73A', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 }}>BROWSE</Text>
                                <Text style={{ color: 'white', fontSize: 14.5, fontWeight: '900', marginTop: 1.5 }}>Elite Collections</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1.5 }}>Find what you love, faster</Text>
                            </View>
                            <TouchableOpacity onPress={onGoToShop}
                                style={{ backgroundColor: '#D9A73A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                                <Text style={{ color: '#0E1A2E', fontWeight: '900', fontSize: 10.5 }}>Explore All →</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Stats row */}
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                            {[
                                { icon: 'cube-outline', label: `${categories.length} Categories` },
                                { icon: 'bag-handle-outline', label: '10,000+ Items' },
                                { icon: 'storefront-outline', label: '200+ Sellers' },
                            ].map((s, i) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 2.5, backgroundColor: 'rgba(217, 167, 58, 0.08)', paddingHorizontal: 6, paddingVertical: 3.5, borderRadius: 4 }}>
                                    <Ionicons name={s.icon} size={11} color="#D9A73A" />
                                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700' }}>{s.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Quick-filter category pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 5, marginBottom: 6 }}>
                        <TouchableOpacity onPress={onGoToShop}
                            style={{ backgroundColor: '#0E1A2E', paddingHorizontal: 12, paddingVertical: 6.5, borderRadius: 8, borderWidth: 1, borderColor: '#D9A73A' }}>
                            <Text style={{ color: '#D9A73A', fontWeight: '900', fontSize: 10.5 }}>🏠 All</Text>
                        </TouchableOpacity>
                        {categories.map((cat, i) => (
                            <TouchableOpacity key={i} onPress={onGoToShop}
                                style={{ backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 6.5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.12)' }}>
                                <Text style={{ color: '#0E1A2E', fontWeight: '700', fontSize: 10.5 }}>{cat?.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* ── Asymmetric 3-up layout (tall-left + 2-stacked-right) ── */}
                    {categories.length > 0 && (
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                            {/* Left: tall hero card */}
                            <TouchableOpacity onPress={onGoToShop} activeOpacity={0.9}
                                style={{ flex: 1, height: 148, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.12)' }}>
                                <ImageBackground
                                    source={{ uri: categories[0]?.image_url || 'https://placehold.co/400x600' }}
                                    style={{ flex: 1, justifyContent: 'flex-end' }} resizeMode="cover">
                                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', backgroundColor: 'rgba(14,26,46,0.7)' }} />
                                    <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: '#D9A73A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                                        <Text style={{ color: '#0E1A2E', fontSize: 9, fontWeight: '900' }}>✦ FEATURED</Text>
                                    </View>
                                    <View style={{ padding: 10 }}>
                                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9.5, fontWeight: '700' }}>TOP PICK</Text>
                                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 12.5, marginTop: 1.5 }}>{categories[0]?.name}</Text>
                                        <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                                            <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>Shop →</Text>
                                        </View>
                                    </View>
                                </ImageBackground>
                            </TouchableOpacity>

                            {/* Right: two stacked cards */}
                            <View style={{ flex: 1, gap: 8 }}>
                                {[categories[1], categories[2]].map((cat, i) => cat && (
                                    <TouchableOpacity key={i} onPress={onGoToShop} activeOpacity={0.9}
                                        style={{ height: 70, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.12)' }}>
                                        <ImageBackground
                                            source={{ uri: cat?.image_url || 'https://placehold.co/400x300' }}
                                            style={{ flex: 1, justifyContent: 'flex-end' }} resizeMode="cover">
                                            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', backgroundColor: 'rgba(14,26,46,0.6)' }} />
                                            {/* NEW badge for recent categories */}
                                            {cat?.created_at && (new Date() - new Date(cat.created_at)) < 30 * 86400000 && (
                                                <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: '#D9A73A', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                                                    <Text style={{ color: '#0E1A2E', fontSize: 8, fontWeight: '900' }}>NEW</Text>
                                                </View>
                                            )}
                                            <View style={{ padding: 8 }}>
                                                <Text style={{ color: 'white', fontWeight: '900', fontSize: 11.5 }} numberOfLines={1}>{cat?.name}</Text>
                                            </View>
                                        </ImageBackground>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* ── Remaining categories: 2-column grid ── */}
                    {categories.length > 3 && (
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {categories.slice(3).map((cat, i) => (
                                <TouchableOpacity key={i} onPress={onGoToShop} activeOpacity={0.9}
                                    style={{ width: '49%', height: 76, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.12)' }}>
                                    <ImageBackground
                                        source={{ uri: cat?.image_url || 'https://placehold.co/400x300' }}
                                        style={{ flex: 1, justifyContent: 'flex-end' }} resizeMode="cover">
                                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', backgroundColor: 'rgba(14,26,46,0.6)' }} />
                                        {cat?.product_count > 0 && (
                                            <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(14,26,46,0.8)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5, borderColor: '#D9A73A' }}>
                                                <Text style={{ color: '#D9A73A', fontSize: 8, fontWeight: '800' }}>{cat.product_count}+ items</Text>
                                            </View>
                                        )}
                                        <View style={{ padding: 8 }}>
                                            <Text style={{ color: 'white', fontWeight: '900', fontSize: 11.5 }} numberOfLines={1}>{cat?.name}</Text>
                                        </View>
                                    </ImageBackground>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* ── View All footer button ── */}
                    <TouchableOpacity onPress={onGoToShop}
                        style={{ alignSelf: 'center', marginTop: 10, marginBottom: 6, backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.25)' }}>
                        <Ionicons name="grid-outline" size={12} color="#0E1A2E" />
                        <Text style={{ color: '#0E1A2E', fontWeight: '800', fontSize: 11 }}>View All Collections</Text>
                    </TouchableOpacity>
                </View>

                {/* ── LIMITED STOCK ALERT ── */}
                {limitedStock.length > 0 && (
                    <View style={{ marginTop: 14 }}>
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 3, height: 13, backgroundColor: '#D9A73A', borderRadius: 1.5 }} />
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Almost Gone!</Text>
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 10.5 }}>See All</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                            {limitedStock.map((item, i) => (
                                <TouchableOpacity key={i} onPress={() => handleProductClick(item)}
                                    style={{ width: 115, backgroundColor: 'white', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.12)', elevation: 1 }}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                        style={{ width: 115, height: 100 }} resizeMode="cover" />
                                    <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: '#D9A73A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ color: '#0E1A2E', fontSize: 8.5, fontWeight: '900' }}>Only {item.stock_quantity} left!</Text>
                                    </View>
                                    <View style={{ padding: 8 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 12, color: '#0E1A2E' }} numberOfLines={1}>{item?.name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                                            <Text style={{ fontWeight: '800', fontSize: 13, color: '#D9A73A' }}>₦{(item?.price || 0).toLocaleString()}</Text>
                                            <View style={{ backgroundColor: '#0E1A2E', paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 3, borderWidth: 0.5, borderColor: '#D9A73A' }}>
                                                <Text style={{ fontSize: 8.5, color: '#D9A73A', fontWeight: '800' }}>LOW</Text>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* ── SHOP BY BUDGET ── */}
                <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E', marginBottom: 6 }}>💰 Shop by Budget</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        {[
                            { label: 'Under ₦5k', icon: 'pricetag-outline' },
                            { label: '₦5k – ₦20k', icon: 'flame-outline' },
                            { label: 'Above ₦20k', icon: 'diamond-outline' },
                        ].map(b => (
                            <TouchableOpacity key={b.label} onPress={onGoToShop}
                                style={{ flex: 1, backgroundColor: 'white', borderRadius: 10, paddingVertical: 13, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.15)' }}>
                                <Ionicons name={b.icon} size={18} color="#D9A73A" />
                                <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0E1A2E', textAlign: 'center' }}>{b.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── SHOP BY OCCASION ── */}
                <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E', marginBottom: 6 }}>🎯 Shop by Occasion</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {[
                            { label: 'Birthday 🎂' },
                            { label: 'Wedding 💍' },
                            { label: 'Back to School 🎒' },
                            { label: 'Sports 🏋️' },
                            { label: 'Home 🏠' },
                            { label: 'Eid 🌙' },
                        ].map(o => (
                            <TouchableOpacity key={o.label} onPress={onGoToShop}
                                style={{ backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.15)' }}>
                                <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#0E1A2E' }}>{o.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ── WHY CHOOSE US ── */}
                <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E', marginBottom: 6 }}>🛡️ Why Abu Mafhal?</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {[
                            { icon: 'rocket-outline', label: 'Fast Delivery', sub: 'Same-day options' },
                            { icon: 'shield-checkmark-outline', label: 'Secure Pay', sub: '100% protected' },
                            { icon: 'refresh-outline', label: 'Easy Returns', sub: '7-day policy' },
                            { icon: 'headset-outline', label: '24/7 Support', sub: 'Always here' },
                        ].map(w => (
                            <View key={w.label} style={{ width: '49%', backgroundColor: 'white', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.12)', gap: 6 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(217, 167, 58, 0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name={w.icon} size={16} color="#D9A73A" />
                                </View>
                                <Text style={{ fontWeight: '800', color: '#0E1A2E', fontSize: 12.5 }}>{w.label}</Text>
                                <Text style={{ color: '#8A9BB0', fontSize: 10.5 }}>{w.sub}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* SERVICE HIGHLIGHTS (Moved Down) */}
                {homeServices.length > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 12, marginBottom: 6 }}>
                        {homeServices.map((svc, i) => (
                            <ServiceIcon
                                key={i}
                                icon={svc.icon}
                                label={svc.label}
                                color={svc.color}
                                lib={svc.lib}
                                onPress={() => onNavigate(svc.action_link)}
                            />
                        ))}
                    </View>
                )}

                {/* DYNAMIC PROMO BANNERS CAROUSEL */}
                {promoBanners.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                        <FlatList
                            ref={promoFlatListRef}
                            data={promoBanners}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={width}
                            decelerationRate="fast"
                            onMomentumScrollEnd={(e) => {
                                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                                  setCurrentPromoIndex(index);
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
                                                        onProductClick({ ...data, promoDiscount });
                                                    } else {
                                                        onGoToShop();
                                                    }
                                                }).catch(() => onGoToShop());
                                        } else {
                                            onGoToShop();
                                        }
                                    }}
                                    style={{ width: width - 32, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', height: 110, backgroundColor: '#0E1A2E', shadowColor: '#D9A73A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 }}
                                >
                                    <Image
                                        source={{ uri: promo.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2670&auto=format&fit=crop' }}
                                        style={{ width: '100%', height: '100%', position: 'absolute', opacity: 0.35 }}
                                        resizeMode="cover"
                                    />
                                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14, 26, 46, 0.55)' }} />

                                    <View style={{ padding: 12, justifyContent: 'center', height: '100%' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ backgroundColor: '#D9A73A', alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, marginBottom: 5 }}>
                                                    <Text style={{ color: '#0E1A2E', fontWeight: '900', fontSize: 9, letterSpacing: 0.5 }}>
                                                        {promo.subtitle?.toUpperCase() || 'LIMITED OFFER'}
                                                    </Text>
                                                </View>
                                                <Text style={{ fontSize: 14, fontWeight: '900', color: 'white', marginBottom: 2, lineHeight: 19, paddingRight: 10 }} numberOfLines={2}>
                                                    {promo.title || 'Special Promotion'}
                                                </Text>
                                            </View>

                                            {promo.linkData?.timerEnd && (
                                                <View style={{ backgroundColor: 'rgba(217,167,58,0.15)', padding: 7, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(217,167,58,0.4)', alignItems: 'center' }}>
                                                    <Text style={{ color: '#D9A73A', fontSize: 7.5, fontWeight: '900', marginBottom: 3, letterSpacing: 0.5 }}>ENDS IN</Text>
                                                    <CountdownTimer targetDate={promo.linkData.timerEnd} lightMode={true} />
                                                </View>
                                            )}
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
                                            <Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 11 }}>
                                                {promo.linkData?.text || 'Explore Offer'}
                                            </Text>
                                            <Ionicons name="arrow-forward" size={11} color="#D9A73A" />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                        {/* Pagination Dots */}
                        {promoBanners.length > 1 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 6 }}>
                                {promoBanners.map((_, i) => (
                                    <View
                                        key={i}
                                        style={{
                                            width: currentPromoIndex === i ? 14 : 4,
                                            height: 4,
                                            borderRadius: 2,
                                            backgroundColor: currentPromoIndex === i ? '#D9A73A' : 'rgba(217,167,58,0.25)',
                                        }}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* ── MOST RATED ── */}
                {mostRated.length > 0 && (
                    <View style={{ marginTop: 14 }}>
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 3.5, height: 15, backgroundColor: '#D9A73A', borderRadius: 2 }} />
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Most Loved</Text>
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 10 }}>See All →</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                            {mostRated.map((item, i) => (
                                <TouchableOpacity key={i} onPress={() => onProductClick(item)}
                                    style={{ width: 108, backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217,167,58,0.18)', elevation: 2 }}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                        style={{ width: 108, height: 95, backgroundColor: '#F5F3EB' }} resizeMode="cover" />
                                    <View style={{ padding: 7 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 11, color: '#0E1A2E' }} numberOfLines={1}>{item?.name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                                            <Ionicons name="star" size={11} color="#D9A73A" />
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#D9A73A' }}>{(item?.average_rating || 5).toFixed(1)}</Text>
                                            <Text style={{ fontSize: 10, color: '#8A9BB0' }}>• ₦{(item?.price || 0).toLocaleString()}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* NEW ARRIVALS */}
                {newArrivals.length > 0 && (
                    <View style={{ marginTop: 14 }}>
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 3.5, height: 15, backgroundColor: '#0E1A2E', borderRadius: 2 }} />
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>New Arrivals</Text>
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 10 }}>See All →</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                            {newArrivals.map((item, i) => (
                                <TouchableOpacity key={i} style={{ width: 108 }} onPress={() => onProductClick(item)}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }} style={{ width: 108, height: 95, borderRadius: 12, backgroundColor: '#F5F3EB' }} />
                                    <View style={{ marginTop: 1.5, paddingHorizontal: 1 }}>
                                        <Text style={{ marginTop: 5, fontSize: 11, fontWeight: '700', color: '#0E1A2E' }} numberOfLines={1}>{item?.name}</Text>
                                        <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#D9A73A', marginTop: 2 }}>₦{item?.price?.toLocaleString() || '0'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* RECOMMENDED FOR YOU */}
                <View style={{ backgroundColor: '#F5F3EB', marginTop: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(217,167,58,0.1)' }}>
                    <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 3.5, height: 15, backgroundColor: '#D9A73A', borderRadius: 2 }} />
                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Recommended For You</Text>
                        </View>
                        <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 10 }}>See All →</Text></TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' }}>
                        {recommended.map((item, i) => (
                            <TouchableOpacity key={i} style={{ width: '49%', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(217,167,58,0.15)', borderRadius: 12, padding: 7, backgroundColor: 'white' }} onPress={() => onProductClick(item)}>
                                {item?.images?.[0] ? (
                                    <Image source={{ uri: item.images[0] }} style={{ width: '100%', height: 95, borderRadius: 8, backgroundColor: '#F5F3EB', marginBottom: 7 }} />
                                ) : (
                                    <View style={{ width: '100%', height: 95, borderRadius: 8, backgroundColor: '#EEE9D9', alignItems: 'center', justifyContent: 'center', marginBottom: 7 }}>
                                        <Ionicons name="image-outline" size={22} color="#D9A73A" />
                                    </View>
                                )}
                                <View style={{ paddingHorizontal: 2 }}>
                                    <Text style={{ fontSize: 11, color: '#0E1A2E', marginBottom: 3 }} numberOfLines={1}>{item?.name}</Text>
                                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#D9A73A' }}>₦{item?.price?.toLocaleString() || '0'}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── RECENTLY VIEWED ── */}
                {recentlyViewed.length > 0 && (
                    <View style={{ marginTop: 14 }}>
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 3.5, height: 15, backgroundColor: '#0E1A2E', borderRadius: 2 }} />
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Continue Browsing</Text>
                            </View>
                            <TouchableOpacity onPress={() => setRecentlyViewed([])}><Text style={{ color: '#8A9BB0', fontWeight: '700', fontSize: 10 }}>Clear</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                            {recentlyViewed.map((item, i) => (
                                <TouchableOpacity key={i} onPress={() => handleProductClick(item)}
                                    style={{ width: 100, backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217,167,58,0.15)', elevation: 2 }}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                        style={{ width: 100, height: 85 }} resizeMode="cover" />
                                    <View style={{ padding: 6 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 11, color: '#0E1A2E' }} numberOfLines={1}>{item?.name}</Text>
                                        <Text style={{ fontWeight: '900', fontSize: 11, color: '#D9A73A', marginTop: 2 }}>₦{(item?.price || 0).toLocaleString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* ── BECOME A SELLER ── */}
                <View style={{ marginHorizontal: 16, marginTop: 14 }}>
                    <TouchableOpacity onPress={() => onNavigate('vendorRegister')} activeOpacity={0.92}
                        style={{ borderRadius: 14, overflow: 'hidden', padding: 14, backgroundColor: '#0E1A2E', borderWidth: 1, borderColor: 'rgba(217,167,58,0.25)' }}>
                        <View style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(217,167,58,0.08)' }} />
                        <View style={{ position: 'absolute', bottom: -30, left: 30, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(217,167,58,0.06)' }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(217,167,58,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,167,58,0.3)' }}>
                                <Ionicons name="storefront-outline" size={18} color="#D9A73A" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#D9A73A', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 }}>SELL ON ABU MAFHAL</Text>
                                <Text style={{ color: 'white', fontSize: 13, fontWeight: '900', marginTop: 2 }}>Start Earning Today! 💰</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 }}>Join 200+ verified sellers making money daily</Text>
                            </View>
                            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#D9A73A', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="chevron-forward" size={13} color="#0E1A2E" />
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 7, marginTop: 12 }}>
                            {['Free to Join', 'Low Commission', 'Fast Payouts'].map(tag => (
                                <View key={tag} style={{ backgroundColor: 'rgba(217,167,58,0.1)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, borderWidth: 0.5, borderColor: 'rgba(217,167,58,0.25)' }}>
                                    <Text style={{ color: '#D9A73A', fontSize: 10, fontWeight: '700' }}>✓ {tag}</Text>
                                </View>
                            ))}
                        </View>
                    </TouchableOpacity>
                </View>

                {/* ── PRICE DROP ALERTS ── */}
                {priceDrops.length > 0 && (
                    <View style={{ marginTop: 14 }}>
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 3.5, height: 15, backgroundColor: '#D9A73A', borderRadius: 2 }} />
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Price Drops 🔥</Text>
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 10 }}>See All →</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                            {priceDrops.map((item, i) => {
                                const saved = Math.round(((item.compare_at_price - item.price) / item.compare_at_price) * 100);
                                return (
                                    <TouchableOpacity key={i} onPress={() => handleProductClick(item)}
                                        style={{ width: 108, backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217,167,58,0.15)', elevation: 2 }}>
                                        <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                            style={{ width: 108, height: 95 }} resizeMode="cover" />
                                        <View style={{ position: 'absolute', top: 7, left: 7, backgroundColor: '#D9A73A', paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 5 }}>
                                            <Text style={{ color: '#0E1A2E', fontSize: 8.5, fontWeight: '900' }}>SAVE {saved}%</Text>
                                        </View>
                                        <View style={{ padding: 7 }}>
                                            <Text style={{ fontWeight: '700', fontSize: 11, color: '#0E1A2E' }} numberOfLines={1}>{item?.name}</Text>
                                            <Text style={{ fontWeight: '900', fontSize: 11.5, color: '#D9A73A' }}>₦{(item?.price || 0).toLocaleString()}</Text>
                                            <Text style={{ fontSize: 10, color: '#8A9BB0', textDecorationLine: 'line-through' }}>₦{(item?.compare_at_price || 0).toLocaleString()}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* ── VENDOR SPOTLIGHT ── */}
                {spotlightVendor && (
                    <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <View style={{ width: 3.5, height: 15, backgroundColor: '#D9A73A', borderRadius: 2 }} />
                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>🌟 Vendor Spotlight</Text>
                        </View>
                        <TouchableOpacity onPress={onGoToShop} activeOpacity={0.9}
                            style={{ backgroundColor: 'white', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(217,167,58,0.2)', elevation: 2 }}>
                            <Image
                                source={{ uri: spotlightVendor.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(spotlightVendor.business_name || 'Vendor')}&background=0E1A2E&color=D9A73A&size=200` }}
                                style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: '#EEE9D9' }}
                                resizeMode="cover"
                            />
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                                    <Ionicons name="checkmark-circle" size={11} color="#D9A73A" />
                                    <Text style={{ fontSize: 8.5, color: '#D9A73A', fontWeight: '900', letterSpacing: 0.5 }}>FEATURED SELLER</Text>
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>{spotlightVendor.business_name || spotlightVendor.store_name}</Text>
                                <Text style={{ fontSize: 10, color: '#8A9BB0', marginTop: 2.5 }}>{spotlightVendor.total_sales || 0} sales • {spotlightVendor.review_count || 0} reviews</Text>
                            </View>
                            <View style={{ backgroundColor: '#0E1A2E', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="chevron-forward" size={12} color="#D9A73A" />
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── NEWSLETTER ── */}
                <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
                    <NewsletterCard />
                </View>

                {/* ── WHATSAPP SUPPORT ── */}
                <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                    <TouchableOpacity
                        onPress={() => Linking.openURL(`whatsapp://send?phone=2348145853539&text=${encodeURIComponent('Hi Abu Mafhal! I need help with my order.')}`).catch(() => Linking.openURL('https://wa.me/2348145853539'))}
                        style={{ backgroundColor: 'white', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(217,167,58,0.18)', elevation: 1 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="logo-whatsapp" size={18} color="white" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '900', color: '#0E1A2E', fontSize: 12 }}>Need Help? Chat Us 💬</Text>
                            <Text style={{ color: '#8A9BB0', fontSize: 10, marginTop: 2 }}>We're online now — instant reply on WhatsApp</Text>
                        </View>
                        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="chevron-forward" size={13} color="white" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* ── REFERRAL BANNER ── */}
                <View style={{ marginHorizontal: 16, marginTop: 14, marginBottom: 8 }}>
                    <View style={{ backgroundColor: '#0E1A2E', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217,167,58,0.25)' }}>
                        <View style={{ position: 'absolute', top: -15, right: -15, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(217,167,58,0.07)' }} />
                        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(217,167,58,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,167,58,0.3)' }}>
                            <Ionicons name="gift-outline" size={18} color="#D9A73A" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#D9A73A', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }}>INVITE & EARN</Text>
                            <Text style={{ color: 'white', fontSize: 13, fontWeight: '900', marginTop: 2 }}>Invite Friends, Get Rewards!</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 }}>Earn ₦500 for every friend you refer</Text>
                        </View>
                        <TouchableOpacity onPress={() => onNavigate('referral')} style={{ backgroundColor: '#D9A73A', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9, elevation: 2 }}>
                            <Text style={{ fontWeight: '900', color: '#0E1A2E', fontSize: 11 }}>INVITE</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* FOOTER */}
                <Footer onEnterShop={onGoToShop} onNavigate={onNavigate} />
            </ScrollView>

            {/* ── CHECK-IN SUCCESS CELEBRATION OVERLAY ── */}
            {showCheckInSuccess && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <Animated.View style={{
                        width: width * 0.75,
                        backgroundColor: '#0E1A2E',
                        borderRadius: 20,
                        padding: 18,
                        alignItems: 'center',
                        borderWidth: 2,
                        borderColor: '#FBBF24',
                        transform: [{ scale: successAnim }],
                        shadowColor: '#FBBF24',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.5,
                        shadowRadius: 15,
                        elevation: 15,
                    }}>
                        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(251,191,36,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                            <Text style={{ fontSize: 36 }}>🪙</Text>
                        </View>
                        <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', textAlign: 'center' }}>Awesome!</Text>
                        <Text style={{ color: '#FBBF24', fontSize: 22, fontWeight: '900', marginTop: 10 }}>+{checkInData?.coins} Coins</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, textAlign: 'center', marginTop: 15, lineHeight: 17 }}>
                            Streak continued! You're on a <Text style={{ color: 'white', fontWeight: '800' }}>{checkInData?.streak} day</Text> roll. 🔥
                        </Text>

                        <TouchableOpacity
                            onPress={() => {
                                Animated.timing(successAnim, {
                                    toValue: 0,
                                    duration: 200,
                                    useNativeDriver: true
                                }).start(() => setShowCheckInSuccess(false));
                            }}
                            style={{ backgroundColor: 'white', paddingHorizontal: 24, paddingVertical: 8, borderRadius: 12, marginTop: 16 }}
                        >
                            <Text style={{ color: '#0E1A2E', fontWeight: '900', fontSize: 13.5 }}>CONTINUE</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            )}

            {/* VOICE SEARCH OVERLAY */}
            {showVoiceModal && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <View style={{ backgroundColor: 'white', padding: 32, borderRadius: 24, alignItems: 'center' }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                            <Ionicons name="mic" size={40} color="white" />
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Listening...</Text>
                        <Text style={{ color: '#8A9BB0' }}>Say "Phones" or "Fashion"</Text>
                    </View>
                </View>
            )}

            {/* TOAST NOTIFICATION */}
            {toast.visible && (
                <Animated.View style={{
                    position: 'absolute', bottom: 100, left: 20, right: 20,
                    backgroundColor: 'white', padding: 16, borderRadius: 16,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    boxShadow: '0px 8px 30px rgba(0,0,0,0.15)', elevation: 10,
                    opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                    zIndex: 2000
                }}>
                    <Ionicons name={toast.icon} size={24} color="#10B981" />
                    <Text style={{ fontWeight: '700', color: '#0E1A2E', fontSize: 14 }}>{toast.message}</Text>
                </Animated.View>
            )}
        </View>
    );
};

const PlatformStats = React.memo(() => (
    <View style={{ backgroundColor: '#0E1A2E', paddingBottom: 10, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(217,167,58,0.07)', borderRadius: 10, paddingVertical: 8, borderWidth: 0.5, borderColor: 'rgba(217,167,58,0.2)' }}>
            {[
                { label: 'Products', value: '10,000+', icon: 'cube-outline' },
                { label: 'Sellers', value: '200+', icon: 'storefront-outline' },
                { label: 'Happy Customers', value: '50k+', icon: 'heart-outline' },
            ].map((s, i) => (
                <View key={i} style={{ alignItems: 'center', flex: 1, borderRightWidth: i < 2 ? 1 : 0, borderRightColor: 'rgba(217,167,58,0.15)' }}>
                    <Ionicons name={s.icon} size={13} color="#D9A73A" />
                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 12, marginTop: 3 }}>{s.value}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 8.5, fontWeight: '700', marginTop: 1.5 }}>{s.label}</Text>
                </View>
            ))}
        </View>
    </View>
));

const EliteMembershipCard = React.memo(({ user, checkInData, loyalty }) => (
    <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
        <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&w=800&q=80' }}
            style={{ width: '100%', height: 72, borderRadius: 12, overflow: 'hidden', padding: 10, justifyContent: 'center' }}
        >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14, 26, 46, 0.78)' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <Ionicons name="shield-checkmark" size={11} color="#D9A73A" />
                        <Text style={{ color: '#D9A73A', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }}>{loyalty?.tier?.toUpperCase() || 'NEW MEMBER'}</Text>
                    </View>
                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '900' }}>{loyalty?.is_elite ? 'Elite Status' : (loyalty?.tier || 'Membership')}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 9.5, marginTop: 2 }}>{loyalty?.points?.toLocaleString() || 0} Elite Points</Text>
                </View>
                <TouchableOpacity style={{ backgroundColor: '#D9A73A', paddingHorizontal: 10, paddingVertical: 5.5, borderRadius: 8 }}>
                    <Text style={{ color: '#0E1A2E', fontWeight: '900', fontSize: 9.5 }}>REDEEM</Text>
                </TouchableOpacity>
            </View>
        </ImageBackground>
    </View>
));
