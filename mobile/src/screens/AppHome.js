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
import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');

export const AppHome = ({ onGoToShop, onGoToCart, onGoToNotifications, onNavigate, onProductClick, user }) => {
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
                    const isNotExpired = !promo.linkData.timerEnd || new Date(promo.linkData.timerEnd) > new Date();
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
            {/* ── MODERNIZED DARK HEADER ── */}
            <View style={{ backgroundColor: '#0F172A', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 6 : 52, paddingBottom: 16, zIndex: 10 }}>
                <StatusBar backgroundColor="#0F172A" barStyle="light-content" />

                {/* Top row: avatar + name + icons */}
                <View style={{ paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                        <View style={{ borderWidth: 2, borderColor: '#3B82F6', borderRadius: 24, padding: 2 }}>
                            <UserAvatar user={user} size={40} />
                        </View>
                        <View>
                            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '800', letterSpacing: 1 }}>{getGreeting().toUpperCase()}</Text>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: 'white' }}>
                                {user?.fullName || user?.user_metadata?.full_name || user?.full_name || user?.email?.split('@')[0] || 'Member'} 👋
                            </Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity onPress={onGoToNotifications}
                            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="notifications-outline" size={20} color="white" />
                            <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: 4 }} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onGoToCart}
                            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="cart-outline" size={20} color="white" />
                            {cartCount > 0 && (
                                <View style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, backgroundColor: '#EF4444', borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>{cartCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search bar */}
                <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
                    <TouchableOpacity onPress={handleSearchSubmit}
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', gap: 10 }}>
                        <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" />
                        <TextInput
                            placeholder="Search products, brands, sellers..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            style={{ flex: 1, fontSize: 14, color: 'white', fontWeight: '600' }}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearchSubmit}
                        />
                        {/* AI Search Icons */}
                        {searchQuery.length === 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 4 }}>
                                <TouchableOpacity onPress={handleVoiceSearch}>
                                    <Ionicons name="mic" size={20} color="#3B82F6" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleImageSearch}>
                                    <Ionicons name="camera" size={20} color="#3B82F6" />
                                </TouchableOpacity>
                            </View>
                        )}
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 6 }}>
                                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={handleSearchSubmit} style={{ backgroundColor: '#3B82F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                            <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>GO</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </View>

                {/* Live shopper count */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700' }}>{liveCount} people shopping right now</Text>
                </View>
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
                    <View style={{ height: 220, marginTop: 12 }}>
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
                                <TouchableOpacity key={index} activeOpacity={0.9} onPress={onGoToShop} style={{ width: width, paddingHorizontal: 16, height: 220 }}>
                                    <ImageBackground
                                        source={{ uri: item?.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2670&auto=format&fit=crop' }}
                                        style={{ width: '100%', height: '100%' }}
                                        imageStyle={{ borderRadius: 24 }}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            ))}
                        </Animated.ScrollView>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
                            {banners.map((_, i) => {
                                const opacity = scrollX.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
                                const dotWidth = scrollX.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [6, 20, 6], extrapolate: 'clamp' });
                                return <Animated.View key={i} style={{ height: 6, width: dotWidth, borderRadius: 3, backgroundColor: '#0F172A', marginHorizontal: 3, opacity }} />;
                            })}
                        </View>
                    </View>
                )}

                {/* ELITE MEMBERSHIP CARD */}
                <EliteMembershipCard user={user} checkInData={checkInData} loyalty={loyalty} />

                {/* ── DAILY CHECK-IN ── PREMIUM ── */}
                {checkInData !== null && (
                    <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
                        <View style={{
                            backgroundColor: '#0F172A', borderRadius: 28, overflow: 'hidden',
                            borderWidth: 1, borderColor: checkInData.checkedInToday ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.06)',
                        }}>
                            {/* Top glow accent */}
                            <View style={{ position: 'absolute', top: -40, left: '30%', width: 160, height: 100, borderRadius: 80, backgroundColor: checkInData.checkedInToday ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.12)' }} />

                            <View style={{ padding: 20 }}>
                                {/* Header row */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                                    <View>
                                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>GAMIFICATION</Text>
                                        <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', marginTop: 2 }}>
                                            {checkInData.checkedInToday ? '✅ Checked In!' : '🎁 Daily Check-In'}
                                        </Text>
                                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
                                            {checkInData.checkedInToday
                                                ? 'Come back tomorrow for more coins!'
                                                : 'Tap to earn coins & build your streak'}
                                        </Text>
                                    </View>
                                    {/* Streak badge */}
                                    <View style={{ alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' }}>
                                        <Text style={{ fontSize: 22 }}>🔥</Text>
                                        <Text style={{ color: '#FBBF24', fontWeight: '900', fontSize: 18, marginTop: 2 }}>{checkInData.streak}</Text>
                                        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '700' }}>DAY STREAK</Text>
                                    </View>
                                </View>

                                {/* 7-day calendar dots */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                                        const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                                        const isFilled = i < todayIdx || (i === todayIdx && checkInData.checkedInToday);
                                        const isToday = i === todayIdx;
                                        return (
                                            <View key={day} style={{ alignItems: 'center', gap: 6 }}>
                                                <View style={{
                                                    width: 32, height: 32, borderRadius: 16,
                                                    backgroundColor: isFilled
                                                        ? (isToday && checkInData.checkedInToday ? '#22C55E' : '#FBBF24')
                                                        : isToday ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    borderWidth: isToday ? 2 : 0,
                                                    borderColor: isToday ? (checkInData.checkedInToday ? '#22C55E' : '#FBBF24') : 'transparent',
                                                    // Glow effect on today
                                                    shadowColor: isToday ? '#FBBF24' : 'transparent',
                                                    shadowOffset: { width: 0, height: 0 },
                                                    shadowOpacity: 0.8,
                                                    shadowRadius: 6,
                                                    elevation: isToday ? 4 : 0,
                                                }}>
                                                    {isFilled
                                                        ? <Ionicons name="checkmark" size={14} color="white" />
                                                        : isToday
                                                            ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FBBF24' }} />
                                                            : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                                                    }
                                                </View>
                                                <Text style={{ color: isToday ? '#FBBF24' : 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: isToday ? '800' : '600' }}>{day}</Text>
                                            </View>
                                        );
                                    })}
                                </View>

                                {/* Coin reward + CTA */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    {/* Coin pill */}
                                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 }}>
                                        <Text style={{ fontSize: 20 }}>🪙</Text>
                                        <View>
                                            <Text style={{ color: '#FBBF24', fontWeight: '900', fontSize: 18 }}>+{checkInData.coins}</Text>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700' }}>COINS TODAY</Text>
                                        </View>
                                        <View style={{ flex: 1 }} />
                                        <View style={{ backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                            <Text style={{ color: '#FBBF24', fontSize: 9, fontWeight: '800' }}>Streak Bonus</Text>
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

                                                    // Fix: Use local date instead of UTC
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
                                                        // Fallback: if it's a conflict, we might have already checked in
                                                        if (insError.code === '23505') {
                                                            console.log('User already checked in for today (Conflict)');
                                                        } else {
                                                            alert('Check-in failed. Please try again later.');
                                                            return;
                                                        }
                                                    }

                                                    // FIX: Atomic coin increment via RPC
                                                    const { error: rpcError } = await supabase.rpc('increment_mafhal_coins', {
                                                        user_id_arg: u.id,
                                                        amount: coins
                                                    });

                                                    if (rpcError) console.log('--- COIN INCREMENT ERROR ---', rpcError);

                                                    setCheckInData({ checkedInToday: true, streak: newStreak, coins });

                                                    // Show success animation
                                                    setShowCheckInSuccess(true);
                                                    Animated.spring(successAnim, {
                                                        toValue: 1,
                                                        friction: 4,
                                                        useNativeDriver: true
                                                    }).start();

                                                    // Hide after 3 seconds
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
                                                backgroundColor: '#FBBF24', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 18,
                                                shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
                                            }}>
                                            <Text style={{ fontWeight: '900', color: '#0F172A', fontSize: 13 }}>CHECK IN</Text>
                                            <Text style={{ fontWeight: '700', color: 'rgba(15,23,42,0.6)', fontSize: 9, textAlign: 'center', marginTop: 1 }}>TAP NOW</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={{ backgroundColor: '#22C55E', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 18 }}>
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
                    <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: '#0F172A' }}>🛍️ Recent Orders</Text>
                            <TouchableOpacity onPress={() => onNavigate('orders')}>
                                <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 13 }}>See All</Text>
                            </TouchableOpacity>
                        </View>
                        {recentOrders.map((ord, i) => {
                            const STATUS_COLORS = {
                                pending: { bg: '#FEF3C7', text: '#D97706' },
                                processing: { bg: '#DBEAFE', text: '#2563EB' },
                                shipped: { bg: '#EDE9FE', text: '#7C3AED' },
                                delivered: { bg: '#DCFCE7', text: '#16A34A' },
                                cancelled: { bg: '#FEE2E2', text: '#DC2626' },
                            };
                            const sc = STATUS_COLORS[ord.status?.toLowerCase()] || { bg: '#F1F5F9', text: '#64748B' };
                            return (
                                <TouchableOpacity key={ord.id} onPress={() => onNavigate('orders')}
                                    style={{ backgroundColor: 'white', borderRadius: 16, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', gap: 12 }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: sc.bg, alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="receipt-outline" size={18} color={sc.text} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13 }}>#{ord.id.slice(0, 8).toUpperCase()}</Text>
                                        <Text style={{ color: '#94A3B8', fontSize: 11 }}>{ord.order_items?.length || 0} item(s) • {new Date(ord.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                        <View style={{ backgroundColor: sc.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                            <Text style={{ color: sc.text, fontSize: 10, fontWeight: '900' }}>{ord.status?.toUpperCase()}</Text>
                                        </View>
                                        <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13 }}>₦{(ord.total_amount || 0).toLocaleString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* ── CART REMINDER ── */}
                {cartCount > 0 && (
                    <TouchableOpacity onPress={onGoToCart}
                        style={{ marginHorizontal: 16, marginTop: 14, backgroundColor: '#EFF6FF', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#BFDBFE' }}>
                        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="cart" size={20} color="white" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '900', color: '#1E40AF', fontSize: 13 }}>You have {cartCount} item{cartCount > 1 ? 's' : ''} in your cart!</Text>
                            <Text style={{ color: '#3B82F6', fontSize: 12, marginTop: 1 }}>Tap to complete your order</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#3B82F6" />
                    </TouchableOpacity>
                )}


                {/* 1. VERIFIED SELLERS (Auto Scroll) */}
                {topVendors.length > 0 && (
                    <View style={{ marginTop: 24 }}>
                        <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>Top Verified Sellers</Text>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#3B82F6', fontWeight: '800' }}>See All</Text></TouchableOpacity>
                        </View>
                        <AutoScrollList
                            data={topVendors}
                            itemWidth={126} // 110 width + 16 gap
                            interval={3000}
                            contentContainerStyle={{ paddingHorizontal: 16 }}
                            renderItem={({ item: vendor }) => (
                                <TouchableOpacity style={{ alignItems: 'center', width: 110, marginRight: 16 }} onPress={onGoToShop}>
                                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F8FAFC', padding: 4, borderWidth: 2, borderColor: '#3B82F6' }}>
                                        <Image
                                            source={{ uri: vendor?.profiles?.avatar_url || vendor?.logo_url || 'https://placehold.co/200' }}
                                            style={{ width: '100%', height: '100%', borderRadius: 36 }}
                                            resizeMode="cover"
                                        />
                                        <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: 'white', borderRadius: 10, padding: 2 }}>
                                            <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />
                                        </View>
                                    </View>
                                    <Text style={{ marginTop: 10, fontSize: 13, fontWeight: '700', color: '#0F172A', textAlign: 'center' }} numberOfLines={1}>
                                        {vendor?.business_name || vendor?.store_name || 'Vendor'}
                                    </Text>
                                    <View style={{ marginTop: 4, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>{vendor?.total_sales || 0} Sales</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                            <Ionicons name="star" size={10} color="#FBBF24" />
                                            <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>4.9 ({vendor?.review_count || 0})</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}

                {/* 2. TOP CUSTOMERS (Auto Scroll) */}
                {topCustomers.length > 0 && (
                    <View style={{ marginTop: 32 }}>
                        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>Elite Members</Text>
                        </View>
                        <AutoScrollList
                            data={topCustomers}
                            itemWidth={106} // 90 width + 16 gap
                            interval={3500} // Slightly different speed
                            contentContainerStyle={{ paddingHorizontal: 16 }}
                            renderItem={({ item: customer }) => (
                                <View style={{ alignItems: 'center', width: 90, marginRight: 16 }}>
                                    <View style={{ width: 64, height: 64, position: 'relative' }}>
                                        <UserAvatar user={customer} size={64} border="#FBBF24" />
                                        <View style={{ position: 'absolute', bottom: -4, alignSelf: 'center', backgroundColor: '#FBBF24', paddingHorizontal: 6, borderRadius: 8 }}>
                                            <Text style={{ fontSize: 8, fontWeight: '900', color: '#0F172A' }}>VIP</Text>
                                        </View>
                                    </View>
                                    <Text style={{ marginTop: 8, fontSize: 11, fontWeight: '700', color: '#0F172A', textAlign: 'center' }} numberOfLines={1}>
                                        {customer?.full_name?.split(' ')[0] || 'Member'}
                                    </Text>
                                    <Text style={{ fontSize: 9, color: '#64748B', fontWeight: '600', marginTop: 2 }}>
                                        ₦{(customer?.total_spend || 0).toLocaleString()}
                                    </Text>
                                </View>
                            )}
                        />
                    </View>
                )}

                {/* 3. CUSTOMER REVIEWS (Auto Scroll) */}
                {reviews.length > 0 && (
                    <View style={{ marginTop: 32, paddingBottom: 10 }}>
                        <Text style={{ paddingHorizontal: 16, fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 16 }}>Member Voices</Text>
                        <AutoScrollList
                            data={reviews}
                            itemWidth={296} // 280 width + 16 gap
                            interval={4000} // Slowest for reading
                            contentContainerStyle={{ paddingHorizontal: 16 }}
                            renderItem={({ item: review }) => (
                                <View style={{ width: 280, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', marginRight: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                        <UserAvatar user={review?.user} size={32} />
                                        <View style={{ marginLeft: 8 }}>
                                            <Text style={{ fontWeight: '700', fontSize: 13, color: '#0F172A' }}>{review?.user?.full_name || 'User'}</Text>
                                            <View style={{ flexDirection: 'row', gap: 2 }}>
                                                {[...Array(5)].map((_, i) => (
                                                    <Ionicons key={i} name="star" size={10} color={i < (review?.rating || 0) ? "#FBBF24" : "#E2E8F0"} />
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                    <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20 }} numberOfLines={3}>"{review?.comment || ''}"</Text>
                                </View>
                            )}
                        />
                    </View>
                )}

                {/* 4. FEATURED BRANDS */}
                {brands.length > 0 && (
                    <View style={{ marginTop: 32, paddingBottom: 8 }}>
                        <Text style={{ paddingHorizontal: 16, fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16 }}>Featured Brands</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 20 }}>
                            {brands.map((brand, i) => (
                                <TouchableOpacity key={i} style={{ alignItems: 'center' }} onPress={onGoToShop}>
                                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'white', padding: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>
                                        <Image source={{ uri: brand?.logo_url || 'https://placehold.co/100' }} style={{ width: 40, height: 40, resizeMode: 'contain' }} />
                                    </View>
                                    <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '600', color: '#475569' }}>{brand?.name || 'Brand'}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* FLASH SALE WITH TIMER */}
                {flashSale.length > 0 && (
                    <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 8, height: 24, backgroundColor: '#EF4444', borderRadius: 4 }} />
                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>Flash Sale</Text>
                                <CountdownTimer targetDate={new Date().setHours(24, 0, 0, 0)} />
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#EF4444', fontWeight: '800' }}>See All</Text></TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                            {flashSale.map((item, i) => (
                                <TouchableOpacity key={i} style={[styles.recCard, { width: '47.5%', borderRadius: 20, padding: 0, overflow: 'hidden' }]} onPress={() => onProductClick(item)}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }} style={{ width: '100%', height: 160 }} />
                                    <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '900' }}>-{item?.discount}%</Text>
                                    </View>
                                    <View style={{ padding: 12 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 14, color: '#0F172A' }} numberOfLines={1}>{item?.name}</Text>
                                        <Text style={{ fontWeight: '900', fontSize: 16, color: '#3B82F6', marginTop: 4 }}>₦{item?.price?.toLocaleString() || '0'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── DEAL OF THE DAY ── */}
                {dealOfDay && (
                    <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <View style={{ width: 8, height: 24, backgroundColor: '#F59E0B', borderRadius: 4 }} />
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>🎯 Deal of the Day</Text>
                            <CountdownTimer targetDate={new Date().setHours(24, 0, 0, 0)} />
                        </View>
                        <TouchableOpacity onPress={() => onProductClick(dealOfDay)} activeOpacity={0.9}
                            style={{ borderRadius: 24, overflow: 'hidden', height: 200 }}>
                            <Image
                                source={{ uri: dealOfDay?.images?.[0] || 'https://placehold.co/600x400' }}
                                style={{ width: '100%', height: '100%', position: 'absolute' }}
                                resizeMode="cover"
                            />
                            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)' }} />
                            <View style={{ position: 'absolute', top: 16, left: 16 }}>
                                <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignSelf: 'flex-start' }}>
                                    <Text style={{ color: '#0F172A', fontWeight: '900', fontSize: 11 }}>⚡ TODAY ONLY</Text>
                                </View>
                            </View>
                            <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 17, marginBottom: 4 }} numberOfLines={1}>{dealOfDay?.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={{ color: '#F59E0B', fontWeight: '900', fontSize: 20 }}>₦{(dealOfDay?.price || 0).toLocaleString()}</Text>
                                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textDecorationLine: 'line-through' }}>₦{(dealOfDay?.compare_at_price || 0).toLocaleString()}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => onProductClick(dealOfDay)}
                                    style={{ backgroundColor: '#F59E0B', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 }}>
                                    <Text style={{ color: '#0F172A', fontWeight: '900', fontSize: 13 }}>Grab Deal</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── TRENDING NOW ── */}
                {trendingProducts.length > 0 && (
                    <View style={{ marginTop: 32 }}>
                        <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 8, height: 24, backgroundColor: '#7C3AED', borderRadius: 4 }} />
                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>🔥 Trending Now</Text>
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#7C3AED', fontWeight: '800' }}>See All</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                            {trendingProducts.map((item, i) => (
                                <TouchableOpacity key={i} onPress={() => onProductClick(item)}
                                    style={{ width: 140, backgroundColor: 'white', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 }}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                        style={{ width: 140, height: 130, backgroundColor: '#F8FAFC' }} resizeMode="cover" />
                                    <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: '#7C3AED', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                                        <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>#{i + 1} TRENDING</Text>
                                    </View>
                                    <View style={{ padding: 10 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 13, color: '#0F172A' }} numberOfLines={1}>{item?.name}</Text>
                                        <Text style={{ fontWeight: '900', fontSize: 14, color: '#7C3AED', marginTop: 2 }}>₦{(item?.price || 0).toLocaleString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* ── ELITE COLLECTIONS ── PREMIUM REDESIGN ── */}
                <View style={{ marginTop: 40 }}>

                    {/* Dark Section Header */}
                    <View style={{ backgroundColor: '#0F172A', marginHorizontal: 16, borderRadius: 24, padding: 20, marginBottom: 16 }}>
                        {/* Top row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <View>
                                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>BROWSE</Text>
                                <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', marginTop: 2 }}>Elite Collections</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>Find what you love, faster</Text>
                            </View>
                            <TouchableOpacity onPress={onGoToShop}
                                style={{ backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
                                <Text style={{ color: 'white', fontWeight: '800', fontSize: 11 }}>Explore All →</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Stats row */}
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            {[
                                { icon: 'cube-outline', label: `${categories.length} Categories` },
                                { icon: 'bag-handle-outline', label: '10,000+ Items' },
                                { icon: 'storefront-outline', label: '200+ Sellers' },
                            ].map((s, i) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                                    <Ionicons name={s.icon} size={11} color="rgba(255,255,255,0.6)" />
                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' }}>{s.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Quick-filter category pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
                        <TouchableOpacity onPress={onGoToShop}
                            style={{ backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>🏠 All</Text>
                        </TouchableOpacity>
                        {categories.map((cat, i) => (
                            <TouchableOpacity key={i} onPress={onGoToShop}
                                style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 12 }}>{cat?.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* ── Asymmetric 3-up layout (tall-left + 2-stacked-right) ── */}
                    {categories.length > 0 && (
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                            {/* Left: tall hero card */}
                            <TouchableOpacity onPress={onGoToShop} activeOpacity={0.9}
                                style={{ flex: 1, height: 296, borderRadius: 22, overflow: 'hidden' }}>
                                <ImageBackground
                                    source={{ uri: categories[0]?.image_url || 'https://placehold.co/400x600' }}
                                    style={{ flex: 1, justifyContent: 'flex-end' }} resizeMode="cover">
                                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(15,23,42,0.75)' }} />
                                    <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: '#3B82F6', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 }}>
                                        <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>✦ FEATURED</Text>
                                    </View>
                                    <View style={{ padding: 14 }}>
                                        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700' }}>TOP PICK</Text>
                                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 18, marginTop: 2 }}>{categories[0]?.name}</Text>
                                        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                                            <Text style={{ color: 'white', fontSize: 10, fontWeight: '800' }}>Shop →</Text>
                                        </View>
                                    </View>
                                </ImageBackground>
                            </TouchableOpacity>

                            {/* Right: two stacked cards */}
                            <View style={{ flex: 1, gap: 10 }}>
                                {[categories[1], categories[2]].map((cat, i) => cat && (
                                    <TouchableOpacity key={i} onPress={onGoToShop} activeOpacity={0.9}
                                        style={{ height: 143, borderRadius: 22, overflow: 'hidden' }}>
                                        <ImageBackground
                                            source={{ uri: cat?.image_url || 'https://placehold.co/400x300' }}
                                            style={{ flex: 1, justifyContent: 'flex-end' }} resizeMode="cover">
                                            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(15,23,42,0.7)' }} />
                                            {/* NEW badge for recent categories */}
                                            {cat?.created_at && (new Date() - new Date(cat.created_at)) < 30 * 86400000 && (
                                                <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: '#10B981', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                                                    <Text style={{ color: 'white', fontSize: 8, fontWeight: '900' }}>NEW</Text>
                                                </View>
                                            )}
                                            <View style={{ padding: 10 }}>
                                                <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }} numberOfLines={1}>{cat?.name}</Text>
                                            </View>
                                        </ImageBackground>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* ── Remaining categories: 2-column grid ── */}
                    {categories.length > 3 && (
                        <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {categories.slice(3).map((cat, i) => (
                                <TouchableOpacity key={i} onPress={onGoToShop} activeOpacity={0.9}
                                    style={{ width: '47%', height: 130, borderRadius: 20, overflow: 'hidden' }}>
                                    <ImageBackground
                                        source={{ uri: cat?.image_url || 'https://placehold.co/400x300' }}
                                        style={{ flex: 1, justifyContent: 'flex-end' }} resizeMode="cover">
                                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(15,23,42,0.65)' }} />
                                        {cat?.product_count > 0 && (
                                            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                                                <Text style={{ color: 'white', fontSize: 8, fontWeight: '800' }}>{cat.product_count}+ items</Text>
                                            </View>
                                        )}
                                        <View style={{ padding: 10 }}>
                                            <Text style={{ color: 'white', fontWeight: '900', fontSize: 13 }} numberOfLines={1}>{cat?.name}</Text>
                                        </View>
                                    </ImageBackground>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* ── View All footer button ── */}
                    <TouchableOpacity onPress={onGoToShop}
                        style={{ alignSelf: 'center', marginTop: 18, marginBottom: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="grid-outline" size={14} color="#334155" />
                        <Text style={{ color: '#334155', fontWeight: '800', fontSize: 13 }}>View All Collections</Text>
                    </TouchableOpacity>
                </View>

                {/* ── LIMITED STOCK ALERT ── */}
                {limitedStock.length > 0 && (
                    <View style={{ marginTop: 28 }}>
                        <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 8, height: 24, backgroundColor: '#EF4444', borderRadius: 4 }} />
                                <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>⚠️ Almost Gone!</Text>
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 13 }}>See All</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                            {limitedStock.map((item, i) => (
                                <TouchableOpacity key={i} onPress={() => handleProductClick(item)}
                                    style={{ width: 150, backgroundColor: 'white', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#FEE2E2', elevation: 1 }}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                        style={{ width: 150, height: 130 }} resizeMode="cover" />
                                    <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#EF4444', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                                        <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>Only {item.stock_quantity} left!</Text>
                                    </View>
                                    <View style={{ padding: 10 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 13, color: '#0F172A' }} numberOfLines={1}>{item?.name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                            <Text style={{ fontWeight: '900', fontSize: 13, color: '#EF4444' }}>₦{(item?.price || 0).toLocaleString()}</Text>
                                            <View style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                <Text style={{ fontSize: 9, color: '#DC2626', fontWeight: '800' }}>LOW STOCK</Text>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* ── SHOP BY BUDGET ── */}
                <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 12 }}>💰 Shop by Budget</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        {[
                            { label: 'Under ₦5k', icon: 'pricetag-outline', color: '#2563EB', bg: '#EFF6FF' },
                            { label: '₦5k – ₦20k', icon: 'flame-outline', color: '#D97706', bg: '#FFFBEB' },
                            { label: 'Above ₦20k', icon: 'diamond-outline', color: '#7C3AED', bg: '#F5F3FF' },
                        ].map(b => (
                            <TouchableOpacity key={b.label} onPress={onGoToShop}
                                style={{ flex: 1, backgroundColor: b.bg, borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: b.color + '30' }}>
                                <Ionicons name={b.icon} size={20} color={b.color} />
                                <Text style={{ fontSize: 11, fontWeight: '800', color: b.color, textAlign: 'center' }}>{b.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── SHOP BY OCCASION ── */}
                <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 12 }}>🎯 Shop by Occasion</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                        {[
                            { label: 'Birthday 🎂', color: '#EC4899', bg: '#FDF2F8' },
                            { label: 'Wedding 💍', color: '#8B5CF6', bg: '#F5F3FF' },
                            { label: 'Back to School 🎒', color: '#2563EB', bg: '#EFF6FF' },
                            { label: 'Sports 🏋️', color: '#16A34A', bg: '#F0FDF4' },
                            { label: 'Home 🏠', color: '#D97706', bg: '#FFFBEB' },
                            { label: 'Eid 🌙', color: '#0F172A', bg: '#F8FAFC' },
                        ].map(o => (
                            <TouchableOpacity key={o.label} onPress={onGoToShop}
                                style={{ backgroundColor: o.bg, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: o.color + '30' }}>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: o.color }}>{o.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ── WHY CHOOSE US ── */}
                <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 14 }}>🛡️ Why Abu Mafhal?</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {[
                            { icon: 'rocket-outline', label: 'Fast Delivery', sub: 'Same-day options', color: '#3B82F6', bg: '#EFF6FF' },
                            { icon: 'shield-checkmark-outline', label: 'Secure Pay', sub: '100% protected', color: '#16A34A', bg: '#F0FDF4' },
                            { icon: 'refresh-outline', label: 'Easy Returns', sub: '7-day policy', color: '#D97706', bg: '#FFFBEB' },
                            { icon: 'headset-outline', label: '24/7 Support', sub: 'Always here', color: '#7C3AED', bg: '#F5F3FF' },
                        ].map(w => (
                            <View key={w.label} style={{ width: '47%', backgroundColor: w.bg, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: w.color + '25', gap: 6 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: w.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name={w.icon} size={18} color={w.color} />
                                </View>
                                <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13 }}>{w.label}</Text>
                                <Text style={{ color: '#64748B', fontSize: 11 }}>{w.sub}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* SERVICE HIGHLIGHTS (Moved Down) */}
                {homeServices.length > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 40, marginBottom: 10 }}>
                        {homeServices.map((svc, i) => (
                            <ServiceIcon key={i} icon={svc?.icon} label={svc?.title} color={svc?.bg_color || '#3B82F6'} lib={svc?.lib} onPress={onGoToShop} />
                        ))}
                    </View>
                )}


                {/* DYNAMIC PROMO BANNERS CAROUSEL */}
                {promoBanners.length > 0 && (
                    <View style={{ marginTop: 20 }}>
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

                {/* ── MOST RATED ── */}
                {mostRated.length > 0 && (
                    <View style={{ marginTop: 28 }}>
                        <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>⭐ Most Loved</Text>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#F59E0B', fontWeight: '800' }}>See All</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                            {mostRated.map((item, i) => (
                                <TouchableOpacity key={i} onPress={() => onProductClick(item)}
                                    style={{ width: 140, backgroundColor: 'white', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#FDE68A', elevation: 1 }}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                        style={{ width: 140, height: 130, backgroundColor: '#FFFBEB' }} resizeMode="cover" />
                                    <View style={{ padding: 10 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 13, color: '#0F172A' }} numberOfLines={1}>{item?.name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <Ionicons name="star" size={12} color="#F59E0B" />
                                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#D97706' }}>{(item?.average_rating || 5).toFixed(1)}</Text>
                                            <Text style={{ fontSize: 11, color: '#94A3B8' }}>• ₦{(item?.price || 0).toLocaleString()}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* NEW ARRIVALS */}
                {newArrivals.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                        <View style={{ paddingHorizontal: 16 }}>
                            <SectionHeader title="New Arrivals" action="See All" />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                            {newArrivals.map((item, i) => (
                                <TouchableOpacity key={i} style={{ width: 140, marginRight: 12 }} onPress={() => onProductClick(item)}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }} style={{ width: 140, height: 140, borderRadius: 12, backgroundColor: '#F1F5F9' }} />
                                    <Text style={{ marginTop: 8, fontSize: 14, fontWeight: '600', color: '#0F172A' }} numberOfLines={1}>{item?.name}</Text>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#3B82F6' }}>₦{item?.price?.toLocaleString() || '0'}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}


                {/* RECOMMENDED FOR YOU */}
                <View style={styles.sectionContainer}>
                    <SectionHeader title="Recommended For You" action="See All" />
                    <View style={styles.grid2Col}>
                        {recommended.map((item, i) => (
                            <TouchableOpacity key={i} style={styles.recCard} onPress={() => onProductClick(item)}>
                                {item?.images?.[0] ? (
                                    <Image source={{ uri: item.images[0] }} style={styles.recImg} />
                                ) : (
                                    <View style={[styles.recImg, { backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }]}>
                                        <Ionicons name="image-outline" size={32} color="#94A3B8" />
                                    </View>
                                )}
                                <View style={styles.recContent}>
                                    <Text style={styles.recName} numberOfLines={2}>{item?.name}</Text>
                                    <Text style={styles.recPrice}>₦{item?.price?.toLocaleString() || '0'}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── RECENTLY VIEWED ── */}
                {recentlyViewed.length > 0 && (
                    <View style={{ marginTop: 28 }}>
                        <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>👀 Continue Browsing</Text>
                            <TouchableOpacity onPress={() => setRecentlyViewed([])}><Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: 12 }}>Clear</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                            {recentlyViewed.map((item, i) => (
                                <TouchableOpacity key={i} onPress={() => handleProductClick(item)}
                                    style={{ width: 120, backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 }}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                        style={{ width: 120, height: 110 }} resizeMode="cover" />
                                    <View style={{ padding: 8 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 11, color: '#0F172A' }} numberOfLines={1}>{item?.name}</Text>
                                        <Text style={{ fontWeight: '800', fontSize: 12, color: '#3B82F6', marginTop: 2 }}>₦{(item?.price || 0).toLocaleString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* ── BECOME A SELLER ── */}
                <View style={{ marginHorizontal: 16, marginTop: 28 }}>
                    <TouchableOpacity onPress={() => onNavigate('vendorRegister')} activeOpacity={0.92}
                        style={{ borderRadius: 24, overflow: 'hidden', padding: 22, backgroundColor: '#0F172A' }}>
                        <View style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(59,130,246,0.15)' }} />
                        <View style={{ position: 'absolute', bottom: -30, left: 40, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(124,58,237,0.12)' }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="storefront-outline" size={26} color="#60A5FA" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#60A5FA', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>SELL ON ABU MAFHAL</Text>
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: '900', marginTop: 2 }}>Start Earning Today! 💰</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 3 }}>Join 200+ verified sellers making money daily</Text>
                            </View>
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="chevron-forward" size={18} color="white" />
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                            {['Free to Join', 'Low Commission', 'Fast Payouts'].map(tag => (
                                <View key={tag} style={{ backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' }}>✓ {tag}</Text>
                                </View>
                            ))}
                        </View>
                    </TouchableOpacity>
                </View>

                {/* ── PRICE DROP ALERTS ── */}
                {priceDrops.length > 0 && (
                    <View style={{ marginTop: 28 }}>
                        <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 8, height: 24, backgroundColor: '#10B981', borderRadius: 4 }} />
                                <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>📉 Price Drops</Text>
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#10B981', fontWeight: '800', fontSize: 13 }}>See All</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                            {priceDrops.map((item, i) => {
                                const saved = Math.round(((item.compare_at_price - item.price) / item.compare_at_price) * 100);
                                return (
                                    <TouchableOpacity key={i} onPress={() => handleProductClick(item)}
                                        style={{ width: 150, backgroundColor: 'white', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#D1FAE5', elevation: 1 }}>
                                        <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                            style={{ width: 150, height: 130 }} resizeMode="cover" />
                                        <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: '#10B981', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                                            <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>SAVE {saved}%</Text>
                                        </View>
                                        <View style={{ padding: 10 }}>
                                            <Text style={{ fontWeight: '700', fontSize: 12, color: '#0F172A' }} numberOfLines={1}>{item?.name}</Text>
                                            <Text style={{ fontWeight: '900', fontSize: 13, color: '#10B981' }}>₦{(item?.price || 0).toLocaleString()}</Text>
                                            <Text style={{ fontSize: 10, color: '#94A3B8', textDecorationLine: 'line-through' }}>₦{(item?.compare_at_price || 0).toLocaleString()}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* ── VENDOR SPOTLIGHT ── */}
                {spotlightVendor && (
                    <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 12 }}>🌟 Vendor Spotlight</Text>
                        <TouchableOpacity onPress={onGoToShop} activeOpacity={0.9}
                            style={{ backgroundColor: '#FFF7ED', borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#FED7AA' }}>
                            <Image
                                source={{ uri: spotlightVendor.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(spotlightVendor.business_name || 'Vendor')}&background=F97316&color=fff&size=200` }}
                                style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#FED7AA' }}
                                resizeMode="cover"
                            />
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <Ionicons name="checkmark-circle" size={14} color="#F97316" />
                                    <Text style={{ fontSize: 10, color: '#F97316', fontWeight: '900', letterSpacing: 0.5 }}>FEATURED SELLER</Text>
                                </View>
                                <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>{spotlightVendor.business_name || spotlightVendor.store_name}</Text>
                                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{spotlightVendor.total_sales || 0} sales • {spotlightVendor.review_count || 0} reviews</Text>
                            </View>
                            <View style={{ backgroundColor: '#F97316', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="chevron-forward" size={16} color="white" />
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── NEWSLETTER ── */}
                <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
                    <NewsletterCard />
                </View>

                {/* ── WHATSAPP SUPPORT ── */}
                <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
                    <TouchableOpacity
                        onPress={() => Linking.openURL(`whatsapp://send?phone=2348145853539&text=${encodeURIComponent('Hi Abu Mafhal! I need help with my order.')}`).catch(() => Linking.openURL('https://wa.me/2348145853539'))}
                        style={{ backgroundColor: '#F0FDF4', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#86EFAC' }}>
                        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="logo-whatsapp" size={24} color="white" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '900', color: '#15803D', fontSize: 14 }}>Need Help? Chat Us 💬</Text>
                            <Text style={{ color: '#16A34A', fontSize: 12, marginTop: 1 }}>We're online now — instant reply on WhatsApp</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#16A34A" />
                    </TouchableOpacity>
                </View>

                {/* ── REFERRAL BANNER ── */}
                <View style={{ marginHorizontal: 16, marginTop: 28, marginBottom: 8 }}>
                    <View style={{ backgroundColor: '#0F172A', borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' }}>
                        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="gift-outline" size={26} color="#FBBF24" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>INVITE & EARN</Text>
                            <Text style={{ color: 'white', fontSize: 15, fontWeight: '900', marginTop: 2 }}>Invite Friends, Get Rewards!</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>Earn ₦500 for every friend you refer</Text>
                        </View>
                        <TouchableOpacity onPress={() => onNavigate('referral')} style={{ backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}>
                            <Text style={{ fontWeight: '900', color: '#0F172A', fontSize: 12 }}>INVITE</Text>
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
                        width: width * 0.8,
                        backgroundColor: '#0F172A',
                        borderRadius: 32,
                        padding: 30,
                        alignItems: 'center',
                        borderWidth: 2,
                        borderColor: '#FBBF24',
                        transform: [{ scale: successAnim }],
                        shadowColor: '#FBBF24',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.5,
                        shadowRadius: 20,
                        elevation: 20,
                    }}>
                        <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(251,191,36,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 60 }}>🪙</Text>
                        </View>
                        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', textAlign: 'center' }}>Awesome!</Text>
                        <Text style={{ color: '#FBBF24', fontSize: 32, fontWeight: '900', marginTop: 10 }}>+{checkInData?.coins} Coins</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginTop: 15, lineHeight: 20 }}>
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
                            style={{ backgroundColor: 'white', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 20, marginTop: 30 }}
                        >
                            <Text style={{ color: '#0F172A', fontWeight: '900', fontSize: 16 }}>CONTINUE</Text>
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
                        <Text style={{ color: '#64748B' }}>Say "Phones" or "Fashion"</Text>
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
                    <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 14 }}>{toast.message}</Text>
                </Animated.View>
            )}
        </View>
    );
};

const PlatformStats = React.memo(() => (
    <View style={{ backgroundColor: '#0F172A', paddingBottom: 16, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingVertical: 12 }}>
            {[
                { label: 'Products', value: '10,000+', icon: 'cube-outline' },
                { label: 'Sellers', value: '200+', icon: 'storefront-outline' },
                { label: 'Happy Customers', value: '50k+', icon: 'heart-outline' },
            ].map((s, i) => (
                <View key={i} style={{ alignItems: 'center', flex: 1, borderRightWidth: i < 2 ? 1 : 0, borderRightColor: 'rgba(255,255,255,0.1)' }}>
                    <Ionicons name={s.icon} size={16} color="#60A5FA" />
                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 14, marginTop: 3 }}>{s.value}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700' }}>{s.label}</Text>
                </View>
            ))}
        </View>
    </View>
));

const EliteMembershipCard = React.memo(({ user, checkInData, loyalty }) => (
    <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&w=800&q=80' }}
            style={{ width: '100%', height: 110, borderRadius: 20, overflow: 'hidden', padding: 18, justifyContent: 'center' }}
        >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Ionicons name="shield-checkmark" size={14} color="#FBBF24" />
                        <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>{loyalty?.tier?.toUpperCase() || 'NEW MEMBER'}</Text>
                    </View>
                    <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>{loyalty?.is_elite ? 'Elite Status' : (loyalty?.tier || 'Membership')}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>{loyalty?.points?.toLocaleString() || 0} Elite Points</Text>
                </View>
                <TouchableOpacity style={{ backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>REDEEM</Text>
                </TouchableOpacity>
            </View>
        </ImageBackground>
    </View>
));
