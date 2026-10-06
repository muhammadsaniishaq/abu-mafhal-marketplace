import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, ImageBackground, Image, TextInput, RefreshControl, Dimensions, Animated, FlatList, Platform, StatusBar, Vibration, Linking, StyleSheet } from 'react-native';

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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '../context/AppSettingsContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { fetchAllCategories, subscribeToCategoryChanges } from '../services/categoryService';
import { fetchAllBrands, subscribeToBrandChanges, GLOBAL_BRAND_PRESETS } from '../services/brandService';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

export const getProductImage = (item) => {
    if (!item) return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=300&auto=format&fit=crop';
    if (item.image_url) return item.image_url;
    if (Array.isArray(item.images) && item.images.length > 0 && typeof item.images[0] === 'string' && item.images[0]) return item.images[0];
    if (typeof item.images === 'string' && item.images) return item.images;
    if (item.image) return item.image;
    return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=300&auto=format&fit=crop';
};

export const getCategoryCover = (cat, index = 0) => {
    if (cat?.image_url) return cat.image_url;
    const catName = (cat?.name || '').toLowerCase();
    if (catName.includes('phone') || catName.includes('tablet')) {
        return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=600&auto=format&fit=crop';
    }
    if (catName.includes('fashion') || catName.includes('cloth') || catName.includes('apparel')) {
        return 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=600&auto=format&fit=crop';
    }
    if (catName.includes('electr') || catName.includes('gadget')) {
        return 'https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=600&auto=format&fit=crop';
    }
    if (catName.includes('shoe') || catName.includes('footwear')) {
        return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop';
    }
    if (catName.includes('beauty') || catName.includes('health') || catName.includes('care')) {
        return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=600&auto=format&fit=crop';
    }
    if (catName.includes('home') || catName.includes('living')) {
        return 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop';
    }
    const fallbacks = [
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop',
    ];
    return fallbacks[index % fallbacks.length];
};

export const AppHome = ({ onGoToShop, onGoToCart, onGoToNotifications, onNavigate, onProductClick, user, cartCount: initialCartCount = 0, onAddToCart }) => {
    const insets = useSafeAreaInsets();
    const { settings } = useAppSettings();
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('All');
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
    const [brands, setBrands] = useState(() => {
        return (GLOBAL_BRAND_PRESETS || []).filter(p => p.is_featured).map((p, idx) => ({
            id: `brand_preset_${idx + 1}`,
            name: p.name,
            logo_url: p.logo_url,
            is_featured: true,
            domain: p.domain,
            category: p.category
        }));
    });
    const [trendingProducts, setTrending] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);
    const [mostRated, setMostRated] = useState([]);
    const [dealOfDay, setDealOfDay] = useState(null);
    const [cartCount, setCartCount] = useState(initialCartCount);

    const brandScrollRef = useRef(null);
    const brandScrollOffsetRef = useRef(0);

    // ── AUTO-SCROLL FEATURED BRANDS CAROUSEL ──
    useEffect(() => {
        if (!brands || brands.length <= 3) return;

        const ITEM_STEP = 78; // width 66 + gap 12
        const timer = setInterval(() => {
            if (!brandScrollRef.current) return;
            let nextOffset = brandScrollOffsetRef.current + ITEM_STEP;
            const maxScroll = Math.max(0, (brands.length * ITEM_STEP) - width + 48);

            if (nextOffset > maxScroll) {
                nextOffset = 0;
            }

            brandScrollOffsetRef.current = nextOffset;
            brandScrollRef.current.scrollTo({ x: nextOffset, animated: true });
        }, 2500);

        return () => clearInterval(timer);
    }, [brands, width]);

    useEffect(() => {
        if (initialCartCount !== undefined) setCartCount(initialCartCount);
    }, [initialCartCount]);
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
    const HOME_CACHE_KEY = '@abumafhal_home_cache_v2';
    const lastFetchRef = useRef(0);

    const PROD_FIELDS = 'id, name, price, compare_at_price, images, image_url, category, rating, average_rating, reviews, total_sales, is_new, stock_quantity, status, created_at, updated_at';

    // 1. Instant cache restoration on mount
    useEffect(() => {
        AsyncStorage.getItem(HOME_CACHE_KEY).then(cached => {
            if (cached) {
                try {
                    const c = JSON.parse(cached);
                    if (c.banners?.length) setBanners(c.banners);
                    if (c.promoBanners?.length) setPromoBanners(c.promoBanners);
                    if (c.flashSale?.length) setFlashSale(c.flashSale);
                    if (c.newArrivals?.length) setNewArrivals(c.newArrivals);
                    if (c.recommended?.length) setRecommended(c.recommended);
                    if (c.categories?.length) setCategories(c.categories);
                    if (c.topVendors?.length) setTopVendors(c.topVendors);
                    if (c.homeServices?.length) setHomeServices(c.homeServices);
                    if (c.topCustomers?.length) setTopCustomers(c.topCustomers);
                    if (c.reviews?.length) setReviews(c.reviews);
                    if (c.brands?.length) setBrands(c.brands);
                    if (c.trendingProducts?.length) setTrending(c.trendingProducts);
                    if (c.mostRated?.length) setMostRated(c.mostRated);
                    if (c.dealOfDay) setDealOfDay(c.dealOfDay);
                    if (c.limitedStock?.length) setLimitedStock(c.limitedStock);
                    if (c.priceDrops?.length) setPriceDrops(c.priceDrops);
                    if (c.spotlightVendor) setSpotlightVendor(c.spotlightVendor);
                    setLoading(false); // Instant rendering without skeleton delay
                } catch (_) {}
            }
        }).catch(() => {});

        fetchData();
    }, []);

    // 2. Realtime listener for instant admin updates from Supabase
    useEffect(() => {
        const channel = supabase.channel('apphome_admin_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
                fetchAllBrands({ forceRefresh: true }).then(allB => {
                    if (Array.isArray(allB)) {
                        setBrands(allB.filter(b => b.is_featured === true));
                    }
                }).catch(() => {});
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => {
                fetchData();
            })
            .subscribe();

        const unsubscribeCats = subscribeToCategoryChanges((newCats) => {
            if (Array.isArray(newCats)) {
                setCategories(newCats.filter(c => c.is_active !== false));
            }
        });

        const unsubscribeBrands = subscribeToBrandChanges((newBrands) => {
            if (Array.isArray(newBrands)) {
                setBrands(newBrands.filter(b => b.is_featured === true));
            }
        });

        return () => {
            unsubscribeCats();
            unsubscribeBrands();
            supabase.removeChannel(channel);
        };
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            if (Date.now() - lastFetchRef.current > 2500) {
                fetchData();
            }
        }, [])
    );

    const fetchData = async () => {
        lastFetchRef.current = Date.now();
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();

            // Lightweight, parallelized query execution
            const results = await Promise.allSettled([
                // 0: All Banners from Admin
                supabase.from('banners').select('*').neq('is_active', false).order('display_order', { ascending: true, nullsFirst: false }),
                // 1: Flash Sale (light projection)
                supabase.from('products').select(PROD_FIELDS).neq('status', 'archived').neq('status', 'draft').not('compare_at_price', 'is', null).limit(6),
                // 2: New Arrivals
                supabase.from('products').select(PROD_FIELDS).neq('status', 'archived').neq('status', 'draft').order('created_at', { ascending: false }).limit(8),
                // 3: Recommended
                supabase.from('products').select(PROD_FIELDS).neq('status', 'archived').neq('status', 'draft').limit(12),
                // 4: Categories from Admin (Unified DB + Custom Taxonomy)
                fetchAllCategories({ activeOnly: true, forceRefresh: false }).then(cats => ({ data: cats })).catch(() => ({ data: [] })),
                // 5: Top Vendors
                supabase.from('vendors').select('id, user_id, business_name, logo_url, rating, review_count, total_sales, is_verified, vendor_status').eq('vendor_status', 'active').eq('is_verified', true).order('total_sales', { ascending: false }).limit(8),
                // 6: Home Services
                supabase.from('home_services').select('id, title, description, icon, is_active, display_order').eq('is_active', true).order('display_order'),
                // 7: Top Customers
                supabase.from('profiles').select('id, full_name, avatar_url, total_spend, is_featured').eq('is_featured', true).order('total_spend', { ascending: false }).limit(10),
                // 8: Reviews
                supabase.from('reviews').select('id, comment, rating, created_at, is_displayed, user:user_id(full_name, avatar_url)').eq('is_displayed', true).limit(10),
                // 9: Brands from Admin (Unified DB + app_settings)
                fetchAllBrands({ forceRefresh: false }).then(allB => ({ data: (allB || []).filter(b => b.is_featured === true) })).catch(() => ({ data: [] })),
                // 10: Trending
                supabase.from('products').select(PROD_FIELDS).neq('status', 'archived').neq('status', 'draft').order('total_sales', { ascending: false, nullsFirst: false }).limit(8),
                // 11: Most Rated
                supabase.from('products').select(PROD_FIELDS).neq('status', 'archived').neq('status', 'draft').not('average_rating', 'is', null).order('average_rating', { ascending: false }).limit(8),
                // 12: Deal of Day
                supabase.from('products').select(PROD_FIELDS).neq('status', 'archived').neq('status', 'draft').not('compare_at_price', 'is', null).order('compare_at_price', { ascending: false }).limit(1),
                // 13: Limited Stock
                supabase.from('products').select(PROD_FIELDS).neq('status', 'archived').neq('status', 'draft').not('stock_quantity', 'is', null).lt('stock_quantity', 10).gt('stock_quantity', 0).order('stock_quantity', { ascending: true }).limit(8),
                // 14: Price Drops
                supabase.from('products').select(PROD_FIELDS).neq('status', 'archived').neq('status', 'draft').not('compare_at_price', 'is', null).order('updated_at', { ascending: false }).limit(8),
                // 15: Spotlight Vendor
                supabase.from('vendors').select('id, user_id, business_name, logo_url, rating, review_count, total_sales, is_verified, vendor_status').eq('vendor_status', 'active').eq('is_verified', true).order('created_at', { ascending: false }).limit(1),
                // 16-19: User specific data (conditional)
                currentUser ? supabase.from('loyalty').select('id, points, tier').eq('user_id', currentUser.id).maybeSingle() : Promise.resolve({ data: null }),
                currentUser ? supabase.from('orders').select('id, status, total_amount, created_at, order_items(id)').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(2) : Promise.resolve({ data: null }),
                currentUser ? supabase.from('cart_items').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id) : Promise.resolve({ count: 0 }),
                currentUser ? supabase.from('daily_checkins').select('*').eq('user_id', currentUser.id).order('checkin_date', { ascending: false }).order('created_at', { ascending: false }).limit(1) : Promise.resolve({ data: null }),
            ]);

            const getVal = (idx) => (results[idx].status === 'fulfilled' ? results[idx].value : { data: null });

            // 0: Banners & Promo Banners (extracted in memory from single banner query)
            const bAll = getVal(0).data || [];
            const homeBanners = bAll.filter(b => b.section === 'home' || !b.section || b.section === 'all' || b.section === '');
            setBanners(homeBanners.length > 0 ? homeBanners : bAll);

            const promoData = bAll.filter(b => b.section === 'promo');
            const validPromos = promoData.map(promo => {
                let linkData = { text: promo.action_link || '', locations: ['home'] };
                try { const parsed = JSON.parse(promo.action_link); if (parsed && typeof parsed === 'object') linkData = { ...linkData, ...parsed }; } catch (e) { }
                return { ...promo, linkData };
            }).filter(promo => {
                const hasLocation = !promo.linkData.locations || promo.linkData.locations.length === 0 || promo.linkData.locations.includes('home');
                let isNotExpired = true;
                if (promo.linkData?.timerEnd) {
                    const expiryDate = new Date(promo.linkData.timerEnd);
                    isNotExpired = isNaN(expiryDate.getTime()) || new Date() <= expiryDate;
                }
                return hasLocation && isNotExpired;
            });
            setPromoBanners(validPromos);

            // 1-4: Basic product grids
            const flashData = getVal(1).data || [];
            const newArrData = getVal(2).data || [];
            const recData = getVal(3).data || [];
            const catData = getVal(4).data || [];

            setFlashSale(flashData);
            setNewArrivals(newArrData);
            setRecommended(recData);
            setCategories(catData);

            // 5: Top Vendors
            const vendorData = getVal(5).data || [];
            setTopVendors(vendorData);

            // 6-11: Horizontal lists
            const servicesData = getVal(6).data || [];
            const customersData = getVal(7).data || [];
            const brandsData = getVal(9).data || [];
            const trendingData = getVal(10).data || [];
            const mostRatedData = getVal(11).data || [];

            setHomeServices(servicesData);
            setTopCustomers(customersData);
            setReviews(reviewsData);
            setBrands(brandsData);
            setTrending(trendingData);
            setMostRated(mostRatedData);

            // 12-15: Spotlight features
            const dealData = getVal(12).data;
            const dealObj = dealData?.[0] || null;
            if (dealObj) setDealOfDay(dealObj);

            const limStockData = getVal(13).data || [];
            setLimitedStock(limStockData);

            const pdData = getVal(14).data || [];
            const filteredPd = pdData.filter(p => p.price < (p.compare_at_price || Infinity));
            setPriceDrops(filteredPd);

            const spotVendorObj = getVal(15).data?.[0] || null;
            setSpotlightVendor(spotVendorObj);

            // 16-19: User specific
            if (currentUser) {
                setLoyalty(getVal(16).data);
                setRecentOrders(getVal(17).data || []);
                setCartCount(getVal(18).count || 0);

                const ci = getVal(19).data;
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

            // Save snapshot to local cache for instant future loads
            AsyncStorage.setItem(HOME_CACHE_KEY, JSON.stringify({
                banners: homeBanners,
                promoBanners: validPromos,
                flashSale: flashData,
                newArrivals: newArrData,
                recommended: recData,
                categories: catData,
                topVendors: vendorData,
                homeServices: servicesData,
                topCustomers: customersData,
                reviews: reviewsData,
                brands: brandsData,
                trendingProducts: trendingData,
                mostRated: mostRatedData,
                dealOfDay: dealObj,
                limitedStock: limStockData,
                priceDrops: filteredPd,
                spotlightVendor: spotVendorObj,
                savedAt: Date.now()
            })).catch(() => {});

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
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(2000),
            Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true })
        ]).start(() => setToast({ ...toast, visible: false }));
    };

    // Cleanup recording if active
    useEffect(() => {
        return () => {
            if (recording) {
                recording.stopAndUnloadAsync().catch(() => {});
            }
        };
    }, []);

    // AI Search Handlers — Request permissions on-demand only when tapped
    const handleVoiceSearch = async () => {
        try {
            if (recording) {
                await stopRecording();
            } else {
                const { status } = await Audio.requestPermissionsAsync();
                if (status !== 'granted') {
                    showToast('Microphone permission required', 'alert-circle');
                    return;
                }
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

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(newRecording);
            setIsListening(true);
            setShowVoiceModal(true);

            setTimeout(() => {
                stopRecording(newRecording);
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
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showToast('Photo library permission required', 'alert-circle');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.5,
                base64: true
            });

            if (!result.canceled && result.assets[0].base64) {
                setAnalyzingImage(true);
                showToast('Analyzing image with AI...', 'scan');

                const detailed = await geminiService.searchByImageDetailed(
                    result.assets[0].base64,
                    result.assets[0].mimeType || 'image/jpeg',
                    result.assets[0].fileName || ''
                );

                setAnalyzingImage(false);
                if (detailed) {
                    const searchTarget = detailed.searchKeywords?.[0] || detailed.productName || 'Products';
                    setSearchQuery(searchTarget);
                    showToast(`Identified: ${detailed.productName}`, 'checkmark-circle');
                    if (onGoToShop) {
                        onGoToShop(searchTarget);
                    }
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
                    heroScrollRef.current?.scrollTo({ x: nextIndex * (width - 32), animated: true });
                    return nextIndex;
                });
            }, 4500); // 4.5 seconds for hero
            return () => clearInterval(timer);
        }
    }, [banners.length]);

    const handleBannerPress = (banner) => {
        if (!banner) return onGoToShop();
        const link = banner.action_link;
        if (link && typeof link === 'string') {
            const lowerLink = link.toLowerCase().trim();

            // Intercept internal Abu Mafhal URLs to keep users 100% inside the mobile app
            if (lowerLink.includes('abumafhal.com') || lowerLink.startsWith('/')) {
                if (lowerLink.includes('cart')) {
                    return onGoToCart();
                }
                if (lowerLink.includes('notification')) {
                    return onGoToNotifications();
                }
                if ((lowerLink.includes('vendor-register') || lowerLink.includes('vendor-application') || lowerLink.includes('vendorregister')) && onNavigate) {
                    return onNavigate('VendorRegister');
                }
                if (lowerLink.includes('vendor') && onNavigate) {
                    return onNavigate('VendorDashboard');
                }
                if (lowerLink.includes('admin') && onNavigate) {
                    return onNavigate('AdminDashboard');
                }
                if ((lowerLink.includes('order') || lowerLink.includes('track')) && onNavigate) {
                    return onNavigate('TrackOrder');
                }
                if (lowerLink.includes('category:')) {
                    const cat = link.split('category:')[1]?.trim();
                    if (cat) setActiveCategoryFilter(cat);
                    return;
                }
                if (lowerLink.includes('category/')) {
                    const cat = link.split('category/')[1]?.split('?')[0]?.trim();
                    if (cat) setActiveCategoryFilter(decodeURIComponent(cat));
                    return;
                }
                if (lowerLink.includes('product/')) {
                    const prodId = link.split('product/')[1]?.split('?')[0]?.trim();
                    if (prodId && onProductClick) {
                        return onProductClick({ id: prodId });
                    }
                }
                return onGoToShop();
            }

            if (link.startsWith('category:')) {
                const cat = link.replace('category:', '').trim();
                setActiveCategoryFilter(cat);
                return;
            }
            if (link === 'cart') return onGoToCart();
            if (link === 'notifications') return onGoToNotifications();

            // Only external third-party URLs open browser
            if (link.startsWith('http://') || link.startsWith('https://')) {
                Linking.openURL(link).catch(() => onGoToShop());
                return;
            }
        }
        onGoToShop();
    };

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

    // Pool all fetched products from admin/supabase so any category filter finds its items
    const allProductsPool = [
        ...(flashSale || []),
        ...(newArrivals || []),
        ...(recommended || []),
        ...(trendingProducts || []),
    ].filter(p => p && p.id);
    const uniqueProducts = Array.from(new Map(allProductsPool.map(p => [p.id, p])).values());

    const finalFlashProducts = activeCategoryFilter === 'All'
        ? ((flashSale && flashSale.length > 0) ? flashSale : uniqueProducts.slice(0, 6))
        : uniqueProducts.filter(p => {
            const cat = String(p?.category || p?.subtitle || '').toLowerCase();
            const filter = String(activeCategoryFilter || '').toLowerCase();
            return cat.includes(filter) || filter.includes(cat);
        });


    return (
        <ErrorBoundary>
            <View style={styles.container}>
            {/* ── TOP HEADER (First-Mobile Luxury Header) ── */}
            <View style={{
                backgroundColor: '#FFFFFF',
                paddingTop: Platform.OS === 'web' ? 10 : ((insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 0))) + 4),
                paddingBottom: 9,
                paddingHorizontal: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#F1F5F9',
                zIndex: 10
            }}>
                <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" translucent={true} />

                {/* Sitewide Announcement Banner (Controlled from Admin Settings) */}
                {Boolean(
                    (typeof settings?.announcement_active === 'boolean' ? settings.announcement_active : Boolean(settings?.announcement_active?.value)) &&
                    (typeof settings?.announcement_text === 'string' ? settings.announcement_text.trim().length > 0 : Boolean(settings?.announcement_text?.value))
                ) && (
                    <View style={{
                        backgroundColor: (typeof settings?.announcement_color === 'string' ? settings.announcement_color : settings?.announcement_color?.value) || '#3B82F6',
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        marginBottom: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                    }}>
                        <Ionicons name="megaphone" size={13} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700', textAlign: 'center', flex: 1 }} numberOfLines={1}>
                            {typeof settings?.announcement_text === 'string' ? settings.announcement_text : String(settings?.announcement_text?.value || '')}
                        </Text>
                    </View>
                )}

                {/* Top row: logo + actions (Strict First-Mobile Layout, 0% overflow) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, minWidth: 0, width: '100%' }}>
                    {/* Brand Identity */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0, marginRight: 6 }}>
                        <Image
                            source={settings?.logo_url ? { uri: settings.logo_url } : AM_LOGO}
                            style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, borderWidth: 1, borderColor: '#E2E8F0' }}
                            resizeMode="contain"
                        />
                        <View style={{ minWidth: 0 }}>
                            <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 13, fontWeight: '900', color: '#0A192F', letterSpacing: 0.3 }}>
                                ABU MAFHAL
                            </Text>
                            <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 7.5, fontWeight: '800', color: '#64748B', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                                MARKETPLACE
                            </Text>
                        </View>
                    </View>

                    {/* Right Actions: Category Pill + Cart Circle + Notifications Circle */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <TouchableOpacity
                            onPress={() => onNavigate ? onNavigate('categories') : onGoToShop()}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 3.5,
                                backgroundColor: '#F0F9FF',
                                paddingHorizontal: 8,
                                height: 32,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: '#BAE6FD',
                                flexShrink: 0,
                                justifyContent: 'center'
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="grid-outline" size={12} color="#0284C7" />
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0284C7' }}>Category</Text>
                        </TouchableOpacity>

                        {/* Cart Circle */}
                        <TouchableOpacity
                            onPress={onGoToCart}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: '#F8FAFC',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                flexShrink: 0
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="cart-outline" size={17} color="#0F172A" />
                            {cartCount > 0 ? (
                                <View style={{
                                    position: 'absolute',
                                    top: -3,
                                    right: -3,
                                    minWidth: 15,
                                    height: 15,
                                    borderRadius: 7.5,
                                    backgroundColor: '#EF4444',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingHorizontal: 2
                                }}>
                                    <Text style={{ color: 'white', fontSize: 8, fontWeight: '900' }}>{cartCount > 99 ? '99+' : cartCount}</Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>

                        {/* Notifications Circle */}
                        <TouchableOpacity
                            onPress={onGoToNotifications}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: '#F8FAFC',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                flexShrink: 0
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="notifications-outline" size={17} color="#0F172A" />
                            <View style={{ position: 'absolute', top: 5, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Row */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    paddingHorizontal: 11,
                    height: 38,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    gap: 7
                }}>
                    <Ionicons name="search-outline" size={16} color="#94A3B8" />
                    <TextInput
                        placeholder="Search products, brands, stores..."
                        placeholderTextColor="#94A3B8"
                        style={{ flex: 1, fontSize: 12.5, color: '#0F172A', fontWeight: '500', paddingVertical: 0, minWidth: 0 }}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearchSubmit}
                    />
                    {searchQuery.length > 0 ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <Ionicons name="close-circle" size={15} color="#94A3B8" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={() => onNavigate ? onNavigate('categories') : onGoToShop()}>
                            <Ionicons name="grid-outline" size={17} color="#64748B" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 0 }}
            >
                {/* ── HERO BANNER: 100% DYNAMIC FROM ADMIN / SUPABASE ── */}
                <View style={{ marginBottom: 16, paddingTop: 12 }}>
                    {banners && banners.length > 0 ? (
                        <View>
                            <ScrollView
                                ref={heroScrollRef}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onMomentumScrollEnd={(e) => {
                                    const newIndex = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
                                    setCurrentHeroIndex(newIndex);
                                }}
                                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                            >
                                {banners.map((banner, idx) => (
                                    <TouchableOpacity
                                        key={banner.id || idx}
                                        activeOpacity={0.9}
                                        onPress={() => handleBannerPress(banner)}
                                        style={{
                                            width: width - 32,
                                            height: 160,
                                            borderRadius: 20,
                                            overflow: 'hidden',
                                            backgroundColor: '#0A192F',
                                            position: 'relative',
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.15,
                                            shadowRadius: 10,
                                            elevation: 4
                                        }}
                                    >
                                        {banner.image_url ? (
                                            <ImageBackground
                                                source={{ uri: banner.image_url }}
                                                style={{ width: '100%', height: '100%', justifyContent: 'flex-end' }}
                                                resizeMode="cover"
                                            >
                                                <LinearGradient
                                                    colors={['rgba(10, 25, 47, 0.15)', 'rgba(10, 25, 47, 0.75)', '#0A192F']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                                />
                                                <View style={{ padding: 16, zIndex: 2 }}>
                                                    {banner.title ? (
                                                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF', lineHeight: 24 }}>
                                                            {banner.title}
                                                        </Text>
                                                    ) : null}
                                                    {banner.subtitle ? (
                                                        <Text style={{ fontSize: 11, color: '#CBD5E1', fontWeight: '600', marginTop: 4, marginBottom: 10 }} numberOfLines={2}>
                                                            {banner.subtitle}
                                                        </Text>
                                                    ) : null}
                                                    <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                        <Text style={{ color: '#0A192F', fontSize: 11, fontWeight: '800' }}>
                                                            Shop Now →
                                                        </Text>
                                                    </View>
                                                </View>
                                            </ImageBackground>
                                        ) : (
                                            <LinearGradient
                                                colors={['#0A192F', '#0E2A4D', '#133E68']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={{ flex: 1, padding: 18, justifyContent: 'center' }}
                                            >
                                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#F59E0B', lineHeight: 24 }}>
                                                    {banner.title || 'Special Deals'}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: '#E2E8F0', fontWeight: '500', marginTop: 6, marginBottom: 12 }}>
                                                    {banner.subtitle || 'Discover quality products at Abu Mafhal'}
                                                </Text>
                                                <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, alignSelf: 'flex-start' }}>
                                                    <Text style={{ color: '#0A192F', fontSize: 11, fontWeight: '800' }}>Shop Now →</Text>
                                                </View>
                                            </LinearGradient>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Carousel Dots */}
                            {banners.length > 1 && (
                                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                    {banners.map((_, dotIdx) => (
                                        <View
                                            key={dotIdx}
                                            style={{
                                                width: currentHeroIndex === dotIdx ? 18 : 6,
                                                height: 5,
                                                borderRadius: 3,
                                                backgroundColor: currentHeroIndex === dotIdx ? '#F59E0B' : '#CBD5E1',
                                            }}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    ) : (
                        /* Fallback branded card if no banner in DB */
                        <View style={{ paddingHorizontal: 16 }}>
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={onGoToShop}
                                style={{
                                    height: 155,
                                    borderRadius: 20,
                                    overflow: 'hidden',
                                    backgroundColor: '#0A192F',
                                    padding: 18,
                                    justifyContent: 'center',
                                    position: 'relative'
                                }}
                            >
                                <LinearGradient
                                    colors={['#0A192F', '#0E2A4D', '#133E68']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                />
                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#F59E0B', lineHeight: 24 }}>
                                    {typeof settings?.app_name === 'string' ? settings.app_name : (settings?.app_name?.value || 'Abu Mafhal Marketplace')}
                                </Text>
                                <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 6, marginBottom: 12 }}>
                                    {typeof settings?.tagline === 'string' ? settings.tagline : (settings?.tagline?.value || 'Quality Products | Trusted Sellers | Fast Delivery')}
                                </Text>
                                <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, alignSelf: 'flex-start' }}>
                                    <Text style={{ color: '#0A192F', fontSize: 11, fontWeight: '800' }}>Shop Now →</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ── 🌟 OFFICIAL FEATURED BRANDS (PRIME SHOWCASE) ── */}
                <View style={{ marginBottom: 18, marginTop: 4 }}>
                    <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 3.5, height: 14, backgroundColor: '#D9A73A', borderRadius: 2 }} />
                            <Ionicons name="sparkles" size={14} color="#D9A73A" />
                            <Text style={{ fontSize: 13.5, fontWeight: '900', color: '#0A192F', letterSpacing: 0.2 }}>
                                Featured Brands
                            </Text>
                            <View style={{ backgroundColor: 'rgba(217, 167, 58, 0.15)', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.3)' }}>
                                <Text style={{ fontSize: 9, fontWeight: '900', color: '#A07820' }}>OFFICIAL</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => onGoToShop && onGoToShop('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={{ color: '#D9A73A', fontSize: 11, fontWeight: '800' }}>See All Stores →</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        ref={brandScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
                        onScroll={(e) => {
                            brandScrollOffsetRef.current = e.nativeEvent.contentOffset.x;
                        }}
                        scrollEventThrottle={16}
                    >
                        {brands.map((brand, i) => (
                            <TouchableOpacity
                                key={brand.id || i}
                                style={{ alignItems: 'center', width: 66 }}
                                onPress={() => onGoToShop && onGoToShop(brand?.name)}
                                activeOpacity={0.75}
                            >
                                <View style={{
                                    width: 58,
                                    height: 58,
                                    borderRadius: 29,
                                    backgroundColor: '#FFFFFF',
                                    padding: 6,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderWidth: 2,
                                    borderColor: '#D9A73A',
                                    shadowColor: '#0A192F',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.08,
                                    shadowRadius: 4,
                                    elevation: 2,
                                    position: 'relative'
                                }}>
                                    <Image
                                        source={{ uri: brand?.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(brand?.name || 'Brand')}&background=0A192F&color=D9A73A&bold=true&size=128` }}
                                        style={{ width: 38, height: 38, borderRadius: 19 }}
                                        resizeMode="contain"
                                    />
                                    {/* Mini Verified Badge */}
                                    <View style={{
                                        position: 'absolute',
                                        bottom: -2,
                                        right: -2,
                                        backgroundColor: '#0A192F',
                                        width: 17,
                                        height: 17,
                                        borderRadius: 8.5,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 1.5,
                                        borderColor: '#FFFFFF'
                                    }}>
                                        <Ionicons name="checkmark" size={10} color="#D9A73A" />
                                    </View>
                                </View>
                                <Text
                                    numberOfLines={1}
                                    style={{ marginTop: 6, fontSize: 11, fontWeight: '700', color: '#0F172A', textAlign: 'center', maxWidth: 66 }}
                                >
                                    {brand?.name || 'Brand'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ── FLASH SALE SECTION WITH 4 COUNTDOWN BOXES ── */}
                <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="flash" size={22} color="#F59E0B" />
                            <View>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: '#0A192F' }}>Flash Sale</Text>
                                <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>Limited Time Offers</Text>
                            </View>
                        </View>
                        {/* 4 Red Countdown Boxes */}
                        <CountdownTimer />
                    </View>

                    {/* Category Filter Pills: 100% Dynamic from Admin */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                        {['All', ...(categories && categories.length > 0 ? categories.map(c => c.name) : ['Phones & Tablets', 'Fashion & Apparel', 'Electronics & Gadgets', 'Shoes & Footwear', 'Beauty & Health', 'Home & Living'])].map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                onPress={() => setActiveCategoryFilter(cat)}
                                style={{
                                    backgroundColor: activeCategoryFilter === cat ? '#0A192F' : '#F1F5F9',
                                    paddingHorizontal: 16,
                                    paddingVertical: 7,
                                    borderRadius: 18,
                                }}
                            >
                                <Text style={{
                                    color: activeCategoryFilter === cat ? '#FFFFFF' : '#0F172A',
                                    fontSize: 12,
                                    fontWeight: '700'
                                }}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity onPress={onGoToShop} style={{ paddingVertical: 7, paddingHorizontal: 4 }}>
                            <Text style={{ color: '#0284C7', fontSize: 12, fontWeight: '700' }}>See All &gt;</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* ── 3-COLUMN PRODUCT GRID (Screenshot 2) ── */}
                <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                    {finalFlashProducts.length > 0 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                            {finalFlashProducts.map((prod, idx) => (
                                <View key={prod.id || idx} style={{ width: '33.33%', paddingHorizontal: 4, marginBottom: 10 }}>
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        onPress={() => onProductClick(prod)}
                                        style={{
                                            backgroundColor: '#FFFFFF',
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: '#F1F5F9',
                                            padding: 8,
                                            position: 'relative',
                                            elevation: 1,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.04,
                                            shadowRadius: 3,
                                        }}
                                    >
                                        {/* Discount Tag */}
                                        <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: '#EF4444', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, zIndex: 2 }}>
                                            <Text style={{ color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' }}>
                                                {prod.discount ? `-${prod.discount}%` : '-25%'}
                                            </Text>
                                        </View>

                                        {/* Product Image */}
                                        <View style={{ width: '100%', height: 85, alignItems: 'center', justifyContent: 'center', marginBottom: 6, backgroundColor: '#F8FAFC', borderRadius: 8, overflow: 'hidden' }}>
                                            <Image
                                                source={{ uri: prod.image_url || prod.image || (Array.isArray(prod.images) ? prod.images[0] : prod.images) || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=300&auto=format&fit=crop' }}
                                                style={{ width: '90%', height: '90%' }}
                                                resizeMode="contain"
                                            />
                                        </View>

                                        {/* Name & Category */}
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#0F172A' }} numberOfLines={1}>
                                            {prod.name}
                                        </Text>
                                        <Text style={{ fontSize: 9, color: '#64748B', fontWeight: '500', marginBottom: 3 }} numberOfLines={1}>
                                            {prod.subtitle || prod.category || 'Product'}
                                        </Text>

                                        {/* Rating */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                                            <Ionicons name="star" size={10} color="#F59E0B" />
                                            <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#0F172A' }}>
                                                {prod.rating != null ? Number(prod.rating).toFixed(1) : (prod.average_rating != null ? Number(prod.average_rating).toFixed(1) : '5.0')}
                                            </Text>
                                            <Text style={{ fontSize: 8.5, color: '#94A3B8' }}>
                                                ({prod.reviews != null ? prod.reviews : (prod.reviews_count != null ? prod.reviews_count : 0)})
                                            </Text>
                                        </View>

                                        {/* Price & Cart button row */}
                                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 2 }}>
                                            <View>
                                                <Text style={{ fontSize: 12, fontWeight: '900', color: '#0F172A' }}>
                                                    ₦{Number(prod?.price || 25000).toLocaleString()}
                                                </Text>
                                                {prod?.compare_at_price ? (
                                                    <Text style={{ fontSize: 8.5, color: '#94A3B8', textDecorationLine: 'line-through' }}>
                                                        ₦{Number(prod.compare_at_price).toLocaleString()}
                                                    </Text>
                                                ) : null}
                                            </View>

                                            <TouchableOpacity
                                                onPress={(e) => {
                                                    if (typeof onAddToCart === 'function') {
                                                        onAddToCart(prod);
                                                        showToast(`${prod.name} added to cart!`);
                                                    } else {
                                                        onProductClick(prod);
                                                    }
                                                }}
                                                style={{
                                                    width: 26,
                                                    height: 26,
                                                    borderRadius: 13,
                                                    backgroundColor: '#0A192F',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <Ionicons name="cart" size={13} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={{ paddingVertical: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                            <Ionicons name="cube-outline" size={36} color="#94A3B8" />
                            <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#334155', marginTop: 8 }}>
                                No products in "{activeCategoryFilter}" yet
                            </Text>
                            <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                                Check back soon or explore other categories
                            </Text>
                            <TouchableOpacity
                                onPress={() => setActiveCategoryFilter('All')}
                                style={{ marginTop: 12, backgroundColor: '#0A192F', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 }}
                            >
                                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Show All Products</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ── PLATFORM STATS STRIP ── */}
                <PlatformStats />

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
                                        <Text style={{ fontWeight: '800', color: '#0E1A2E', fontSize: 12 }}>#{String(ord?.id || '').slice(0, 8).toUpperCase()}</Text>
                                        <Text style={{ color: '#8A9BB0', fontSize: 10, marginTop: 2 }}>{ord?.order_items?.length || 0} items • {ord?.created_at ? new Date(ord.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Recently'}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                        <View style={{ backgroundColor: sc.bg, paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 6 }}>
                                            <Text style={{ color: sc.text, fontSize: 8.5, fontWeight: '900' }}>{String(ord?.status || 'pending').toUpperCase()}</Text>
                                        </View>
                                        <Text style={{ fontWeight: '900', color: '#D9A73A', fontSize: 12 }}>₦{Number(ord?.total_amount || 0).toLocaleString()}</Text>
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
                                             source={{ uri: vendor?.profiles?.avatar_url || vendor?.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(vendor?.business_name || vendor?.store_name || 'Vendor')}&background=0E1A2E&color=D9A73A` }}
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
                                source={{ uri: getProductImage(dealOfDay) }}
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
                                    <Image source={{ uri: getProductImage(item) }}
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
                                    source={{ uri: getCategoryCover(categories[0], 0) }}
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
                                            source={{ uri: getCategoryCover(cat, i + 1) }}
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
                                        source={{ uri: getCategoryCover(cat, i + 3) }}
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
                                    <Image source={{ uri: getProductImage(item) }} style={{ width: 108, height: 95, borderRadius: 12, backgroundColor: '#F5F3EB' }} resizeMode="cover" />
                                    <View style={{ marginTop: 1.5, paddingHorizontal: 1 }}>
                                        <Text style={{ marginTop: 5, fontSize: 11, fontWeight: '700', color: '#0E1A2E' }} numberOfLines={1}>{item?.name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                                            <Ionicons name="star" size={9} color="#D9A73A" />
                                            <Text style={{ fontSize: 9, fontWeight: '700', color: '#0E1A2E' }}>
                                                {(Number(item?.rating || item?.average_rating || 5)).toFixed(1)}
                                            </Text>
                                            <Text style={{ fontSize: 8.5, color: '#8A9BB0' }}>
                                                ({item?.reviews != null ? item.reviews : (item?.reviews_count != null ? item.reviews_count : 0)})
                                            </Text>
                                        </View>
                                        <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#D9A73A', marginTop: 2 }}>₦{item?.price?.toLocaleString() || '0'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

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
                                    <Image source={{ uri: getProductImage(item) }}
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

                {/* ── LUXURY TRUST & ESCROW STRIP ── */}
                <View style={{ marginHorizontal: 16, marginTop: 18, marginBottom: 8, padding: 14, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        {[
                            { icon: 'shield-checkmark', title: '100% Escrow', sub: 'Funds protected' },
                            { icon: 'airplane', title: 'Nationwide Delivery', sub: 'Across 36 states' },
                            { icon: 'checkmark-circle', title: 'Verified KYC Sellers', sub: 'Vetted stores' },
                        ].map((item, idx) => (
                            <View key={idx} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
                                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(217, 167, 58, 0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                                    <Ionicons name={item.icon} size={16} color="#D9A73A" />
                                </View>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#0A192F', textAlign: 'center' }}>{item.title}</Text>
                                <Text style={{ fontSize: 9, color: '#64748B', fontWeight: '500', textAlign: 'center', marginTop: 1 }}>{item.sub}</Text>
                            </View>
                        ))}
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
        </ErrorBoundary>
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
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 9.5, marginTop: 2 }}>{Number(loyalty?.points || 0).toLocaleString()} Elite Points</Text>
                </View>
                <TouchableOpacity style={{ backgroundColor: '#D9A73A', paddingHorizontal: 10, paddingVertical: 5.5, borderRadius: 8 }}>
                    <Text style={{ color: '#0E1A2E', fontWeight: '900', fontSize: 9.5 }}>REDEEM</Text>
                </TouchableOpacity>
            </View>
        </ImageBackground>
    </View>
));
