import 'react-native-gesture-handler';
import { LogBox, Text, TextInput, ScrollView, FlatList, SectionList } from 'react-native';
import React, { useState, useEffect } from 'react';


// LogBox ignore safe warnings in production
LogBox.ignoreLogs(['Warning: ...', 'defaultProps will be removed']);

import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppSettingsProvider } from './src/context/AppSettingsContext';
import { supabase } from './src/lib/supabase';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ComparisonProvider } from './src/context/ComparisonContext';
import { clearFollowedStoresCache } from './src/services/vendorFollowerService';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ModernSplashScreen } from './src/components/ModernSplashScreen';
import { ForceUpdateModal } from './src/components/ForceUpdateModal';
import * as Font from 'expo-font';
import {
    Ionicons,
    MaterialIcons,
    FontAwesome5,
    FontAwesome,
    Feather,
    MaterialCommunityIcons,
    AntDesign,
    Entypo,
    SimpleLineIcons,
    Octicons,
} from '@expo/vector-icons';

// Screens
import { ProductComparison } from './src/screens/ProductComparison';
import { LandingPage } from './src/screens/LandingPage';
import { AuthPage } from './src/screens/AuthPage';
import { MainApp } from './src/screens/MainApp';
import { AdminDashboard } from './src/screens/AdminDashboard';
import { VendorDashboard } from './src/screens/VendorDashboard';
import { DriverDashboard } from './src/screens/DriverDashboard';
import { ProductDetails } from './src/screens/ProductDetails';
import { VendorRegister } from './src/screens/VendorRegister';
import { ChatScreen } from './src/screens/ChatScreen';
import { ConversationsScreen } from './src/screens/ConversationsScreen';
import { TrackOrderPage } from './src/screens/TrackOrderPage';
import { InvoicePage } from './src/screens/InvoicePage';
import { CheckoutPage } from './src/screens/CheckoutPage';
import { AddressPage } from './src/screens/AddressPage';
import { PaySmallSmallPage } from './src/screens/PaySmallSmallPage';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

const linking = {
    prefixes: [
        'abumafhal://',
        'https://abumafhal.com/mobile',
        'https://www.abumafhal.com/mobile',
        '/mobile',
    ],
    config: {
        screens: {
            AdminDashboard: 'admin',
            VendorDashboard: 'vendor',
            DriverDashboard: 'driver',
            Main: 'main',
            Landing: 'landing',
            Auth: 'auth',
            ProductDetails: 'product/:id',
            ConversationsScreen: 'conversations',
            TrackOrder: 'track',
            Invoice: 'invoice',
            CheckoutPage: 'checkout',
            AddressPage: 'address',
            ProductComparison: 'compare',
            PaySmallSmall: 'pay-small-small',
            VendorRegister: 'vendor-register',
        },
    },
    getStateFromPath(path, options) {
        if (typeof window !== 'undefined' && window.location) {
            let hash = window.location.hash || '';
            if (hash.startsWith('#')) hash = hash.substring(1);
            let pathPart = path || '';
            if (pathPart.startsWith('/mobile/')) pathPart = pathPart.replace('/mobile/', '');
            else if (pathPart.startsWith('/mobile')) pathPart = pathPart.replace('/mobile', '');
            if (pathPart.startsWith('/')) pathPart = pathPart.substring(1);

            const target = hash || pathPart;
            if (target) {
                const [routePart, queryPart] = target.split('?');
                const params = {};
                if (queryPart) {
                    const searchParams = new URLSearchParams(queryPart);
                    for (const [k, v] of searchParams.entries()) {
                        params[k] = v;
                    }
                }
                const clean = (routePart || '').toLowerCase();
                if (clean === 'vendor-register' || clean === 'vendorregister' || clean === 'vendor-application' || clean.includes('vendor-register') || clean.includes('vendor-application')) {
                    return { routes: [{ name: 'VendorRegister', params }] };
                }
                if (clean === 'admin') return { routes: [{ name: 'AdminDashboard', params }] };
                if (clean === 'vendor') return { routes: [{ name: 'VendorDashboard', params }] };
                if (clean === 'driver') return { routes: [{ name: 'DriverDashboard', params }] };
                if (clean === 'landing') return { routes: [{ name: 'Landing', params }] };
                if (clean === 'auth' || clean === 'login' || clean === 'register') return { routes: [{ name: 'Auth', params }] };
                if (clean === 'checkout') return { routes: [{ name: 'CheckoutPage', params }] };
                if (clean === 'track' || clean === 'orders') return { routes: [{ name: 'TrackOrder', params }] };
                if (clean === 'invoice') return { routes: [{ name: 'Invoice', params }] };
                if (clean === 'compare') return { routes: [{ name: 'ProductComparison', params }] };
                if (clean === 'pay-small-small') return { routes: [{ name: 'PaySmallSmall', params }] };
                if (clean.startsWith('product/') || clean === 'product' || clean.startsWith('product?')) {
                    let id = routePart.includes('/') ? routePart.split('/')[1] : (params.id || params.productId);
                    if (!id && typeof window !== 'undefined' && window.localStorage) {
                        id = window.localStorage.getItem('@abumafhal_last_product_id');
                    }
                    return { routes: [{ name: 'ProductDetails', params: { id, ...params } }] };
                }
                if (['shop', 'cart', 'wishlist', 'profile', 'categories', 'stores', 'wallet', 'home', 'settings'].includes(clean)) {
                    return { routes: [{ name: 'Main', params: { screen: clean, ...params } }] };
                }
                if (clean === 'main') return { routes: [{ name: 'Main', params }] };
            }
        }
        return undefined;
    }
};

const getStoredUserSync = () => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            // 1. Primary mobile app cache
            const raw = window.localStorage.getItem('@abumafhal_user_v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.id || parsed.email)) return parsed;
            }
            // 2. Web auth user cache
            const fallback = window.localStorage.getItem('auth_user');
            if (fallback) {
                const parsed = JSON.parse(fallback);
                if (parsed && (parsed.id || parsed.email)) return parsed;
            }
            // 3. Supabase session token in localStorage
            for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.includes('supabase'))) {
                    try {
                        const tokenRaw = window.localStorage.getItem(key);
                        if (tokenRaw) {
                            const tokenObj = JSON.parse(tokenRaw);
                            const u = tokenObj?.user || tokenObj?.currentSession?.user;
                            if (u && (u.id || u.email)) {
                                return {
                                    id: u.id,
                                    email: u.email,
                                    role: u.user_metadata?.role || 'buyer',
                                    full_name: u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split('@')[0] : 'User'),
                                    phone: u.user_metadata?.phone || u.user_metadata?.phone_number || '',
                                    avatar_url: u.user_metadata?.avatar_url || null,
                                    ...u.user_metadata
                                };
                            }
                        }
                    } catch (_) {}
                }
            }
        }
    } catch (_) {}
    return null;
};

const getStoredCartSync = () => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const raw = window.localStorage.getItem('@abumafhal_cart_v1');
            if (raw) return JSON.parse(raw);
        }
    } catch (_) {}
    return [];
};

export default function App() {
    const [user, setUser] = useState(getStoredUserSync);
    const [loading, setLoading] = useState(() => !getStoredUserSync());
    const [authInitialized, setAuthInitialized] = useState(false);
    const [cartLines, setCartLines] = useState(getStoredCartSync);
    const [lastHeartbeat, setLastHeartbeat] = useState(0);
    const [showSplash, setShowSplash] = useState(true);
    const [fontsLoaded, setFontsLoaded] = useState(false);

    // Rigakafin matsalolin gumaka (icons): loda dukkan vector icon fonts tun a splash screen tare da sunaye masu manyan da kananan haruffa
    useEffect(() => {
        let isMounted = true;
        async function preloadFonts() {
            try {
                await Font.loadAsync({
                    // Ionicons
                    'ionicons': require('./assets/fonts/Ionicons.ttf'),
                    'Ionicons': require('./assets/fonts/Ionicons.ttf'),

                    // MaterialIcons
                    'material': require('./assets/fonts/MaterialIcons.ttf'),
                    'MaterialIcons': require('./assets/fonts/MaterialIcons.ttf'),
                    'Material Icons': require('./assets/fonts/MaterialIcons.ttf'),

                    // MaterialCommunityIcons
                    'material-community': require('./assets/fonts/MaterialCommunityIcons.ttf'),
                    'MaterialCommunityIcons': require('./assets/fonts/MaterialCommunityIcons.ttf'),
                    'Material Community Icons': require('./assets/fonts/MaterialCommunityIcons.ttf'),

                    // Feather
                    'feather': require('./assets/fonts/Feather.ttf'),
                    'Feather': require('./assets/fonts/Feather.ttf'),

                    // FontAwesome
                    'FontAwesome': require('./assets/fonts/FontAwesome.ttf'),
                    'fontawesome': require('./assets/fonts/FontAwesome.ttf'),

                    // FontAwesome 5
                    'FontAwesome5Free-Solid': require('./assets/fonts/FontAwesome5_Solid.ttf'),
                    'FontAwesome5_Solid': require('./assets/fonts/FontAwesome5_Solid.ttf'),
                    'FontAwesome5Solid': require('./assets/fonts/FontAwesome5_Solid.ttf'),
                    'FontAwesome5Free-Regular': require('./assets/fonts/FontAwesome5_Regular.ttf'),
                    'FontAwesome5_Regular': require('./assets/fonts/FontAwesome5_Regular.ttf'),
                    'FontAwesome5Regular': require('./assets/fonts/FontAwesome5_Regular.ttf'),
                    'FontAwesome5Brands-Regular': require('./assets/fonts/FontAwesome5_Brands.ttf'),
                    'FontAwesome5_Brands': require('./assets/fonts/FontAwesome5_Brands.ttf'),
                    'FontAwesome5Free-Brand': require('./assets/fonts/FontAwesome5_Brands.ttf'),

                    // AntDesign
                    'anticon': require('./assets/fonts/AntDesign.ttf'),
                    'AntDesign': require('./assets/fonts/AntDesign.ttf'),

                    // Entypo
                    'entypo': require('./assets/fonts/Entypo.ttf'),
                    'Entypo': require('./assets/fonts/Entypo.ttf'),

                    // Octicons
                    'octicons': require('./assets/fonts/Octicons.ttf'),
                    'Octicons': require('./assets/fonts/Octicons.ttf'),

                    // SimpleLineIcons
                    'simple-line-icons': require('./assets/fonts/SimpleLineIcons.ttf'),
                    'SimpleLineIcons': require('./assets/fonts/SimpleLineIcons.ttf'),
                });
            } catch (err) {
                console.warn('Font.loadAsync primary load note:', err?.message);
                // Secondary fallback using built-in font definitions
                try {
                    const fallbackSets = [
                        Ionicons?.font,
                        MaterialIcons?.font,
                        FontAwesome?.font,
                        Feather?.font,
                        MaterialCommunityIcons?.font,
                        AntDesign?.font,
                        Entypo?.font,
                        SimpleLineIcons?.font,
                        Octicons?.font,
                    ];
                    for (const fSet of fallbackSets) {
                        if (fSet) await Font.loadAsync(fSet).catch(() => {});
                    }
                } catch (_) {}
            } finally {
                if (isMounted) {
                    setFontsLoaded(true);
                }
            }
        }
        preloadFonts();
        return () => { isMounted = false; };
    }, []);

    const CART_STORAGE_KEY = '@abumafhal_cart_v1';
    const USER_STORAGE_KEY = '@abumafhal_user_v1';

    // Kange kowane irin pinch-zoom, multi-touch drag zoom, da double-tap zoom a React Native Web
    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        try {
            // Viewport enforcement
            let meta = document.querySelector('meta[name="viewport"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = 'viewport';
                document.head.appendChild(meta);
            }
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover';

            // Anti-zoom stylesheet
            const styleId = 'abu-mafhal-anti-zoom';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.innerHTML = `
                    @font-face {
                        font-family: 'ionicons';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/Ionicons.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'Ionicons';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/Ionicons.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'material';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/MaterialIcons.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'MaterialIcons';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/MaterialIcons.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'material-community';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/MaterialCommunityIcons.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'MaterialCommunityIcons';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/MaterialCommunityIcons.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'feather';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/Feather.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'Feather';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/Feather.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'anticon';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/AntDesign.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'AntDesign';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/AntDesign.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'FontAwesome';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/FontAwesome.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'fontawesome';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/FontAwesome.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'FontAwesome5_Solid';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/FontAwesome5_Solid.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'FontAwesome5Free-Solid';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/FontAwesome5_Solid.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'FontAwesome5_Regular';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/FontAwesome5_Regular.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'FontAwesome5Free-Regular';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/FontAwesome5_Regular.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'FontAwesome5_Brands';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/FontAwesome5_Brands.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'FontAwesome5Brands-Regular';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/FontAwesome5_Brands.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'entypo';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/Entypo.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'Entypo';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/Entypo.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'octicons';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/Octicons.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'Octicons';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/Octicons.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'simple-line-icons';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/SimpleLineIcons.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'SimpleLineIcons';
                        src: url('https://cdn.jsdelivr.net/npm/react-native-vector-icons@10.2.0/Fonts/SimpleLineIcons.ttf') format('truetype');
                    }
                    html, body, #root, #root * {
                        touch-action: pan-x pan-y !important;
                        -webkit-text-size-adjust: 100% !important;
                        -moz-text-size-adjust: 100% !important;
                        text-size-adjust: 100% !important;
                    }
                    *, *::before, *::after {
                        touch-action: pan-x pan-y !important;
                        -webkit-touch-callout: none !important;
                    }
                    input, select, textarea, [role="textbox"] {
                        font-size: 16px !important;
                    }
                `;
                document.head.appendChild(style);
            }

            // Multi-touch pinch-zoom killer
            const killPinch = (e) => {
                if (e.touches && e.touches.length > 1) {
                    e.preventDefault();
                }
            };

            ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((type) => {
                window.addEventListener(type, killPinch, { passive: false, capture: true });
                document.addEventListener(type, killPinch, { passive: false, capture: true });
            });

            const handleTouchMove = (e) => {
                if ((e.scale !== undefined && e.scale !== 1) || (e.touches && e.touches.length > 1)) {
                    e.preventDefault();
                }
            };
            document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });

            const prevent = (e) => e.preventDefault();
            ['gesturestart', 'gesturechange', 'gestureend'].forEach((name) => {
                window.addEventListener(name, prevent, { passive: false, capture: true });
                document.addEventListener(name, prevent, { passive: false, capture: true });
            });

            let lastTouchEnd = 0;
            const handleTouchEnd = (e) => {
                const now = Date.now();
                if (now - lastTouchEnd <= 300) {
                    e.preventDefault();
                }
                lastTouchEnd = now;
            };
            document.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });

            const handleWheel = (e) => {
                if (e.ctrlKey) e.preventDefault();
            };
            window.addEventListener('wheel', handleWheel, { passive: false });

            if (window.visualViewport) {
                const resetScale = () => {
                    if (window.visualViewport.scale !== 1 && meta) {
                        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover';
                    }
                };
                window.visualViewport.addEventListener('resize', resetScale);
                window.visualViewport.addEventListener('scroll', resetScale);
            }
        } catch (err) {
            console.log('Zero zoom init note:', err);
        }
    }, []);

    // Ensure browser path is strictly locked to /mobile so reloads or history events never revert to desktop web
    useEffect(() => {
        if (typeof window === 'undefined' || !window.location) return;

        try {
            if (!window.location.pathname.startsWith('/mobile')) {
                const hash = window.location.hash || '';
                const search = window.location.search || '';
                window.history.replaceState(null, '', '/mobile' + search + hash);
            }
        } catch (_) {}
    }, []);

    useEffect(() => {
        // Fast instant boot from local cache, then background session verification
        const init = async () => {
            try {
                // 1. Instantly read cached cart and user in parallel
                const [savedCart, savedUser] = await Promise.all([
                    AsyncStorage.getItem(CART_STORAGE_KEY).catch(() => null),
                    AsyncStorage.getItem(USER_STORAGE_KEY).catch(() => null)
                ]);

                if (savedCart) {
                    try { setCartLines(JSON.parse(savedCart)); } catch (_) {}
                }
                if (savedUser) {
                    try {
                        const parsed = JSON.parse(savedUser);
                        if (parsed && (parsed.id || parsed.email)) {
                            setUser(prev => prev || parsed);
                        }
                    } catch (_) {}
                }
            } catch (e) {
                console.error('Error loading local cache:', e);
            }

            // 2. Background check: verify Supabase session without wiping cached user prematurely
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    await fetchUserProfile(session.user.id, session.user);
                }
            } catch (authErr) {
                console.log('Background session check note:', authErr?.message);
            } finally {
                setLoading(false);
                setAuthInitialized(true);
            }

            logVisit(); // Async visit log
        };

        init();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                fetchUserProfile(session.user.id, session.user);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                clearFollowedStoresCache();
                AsyncStorage.removeItem(USER_STORAGE_KEY).catch(() => {});
                AsyncStorage.setItem('@abumafhal_last_screen', 'Landing').catch(() => {});
                if (typeof window !== 'undefined') {
                    try {
                        window.localStorage.removeItem(USER_STORAGE_KEY);
                        window.localStorage.setItem('@abumafhal_last_screen', 'Landing');
                        window.localStorage.removeItem('@abumafhal_vendor_tab');
                        window.localStorage.removeItem('@abumafhal_admin_tab');
                        window.localStorage.removeItem('@abumafhal_driver_tab');
                        if (window.history && window.history.replaceState) {
                            window.history.replaceState(null, '', '/mobile#landing');
                        } else {
                            window.location.hash = 'landing';
                        }
                    } catch (_) {}
                }
                if (navigationRef.isReady()) {
                    navigationRef.reset({
                        index: 0,
                        routes: [{ name: 'Landing' }],
                    });
                }
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Heartbeat logic to update last_seen and trigger "user_visit" audit
    useEffect(() => {
        if (!user) return;

        const heartbeat = async () => {
            const now = Date.now();
            // Update last_seen if it's been more than 15 minutes since last heartbeat in this session
            if (now - lastHeartbeat > 900000) {
                try {
                    await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id);
                    setLastHeartbeat(now);
                } catch (e) {
                    console.error('Heartbeat failed:', e);
                }
            }
        };

        const interval = setInterval(heartbeat, 300000); // Check every 5 mins
        heartbeat(); // Run immediately on login/mount

        return () => clearInterval(interval);
    }, [user, lastHeartbeat]);

    const logVisit = async () => {
        try {
            await supabase.rpc('log_visit', { p_platform: 'mobile_app' });
        } catch (e) {
            console.error('Visit log failed:', e);
        }
    };

    // Save cart whenever it changes
    useEffect(() => {
        const saveCart = async () => {
            try {
                await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartLines));
            } catch (e) {
                console.error('Error saving cart:', e);
            }
        };
        if (!loading) saveCart();
    }, [cartLines, loading]);

    const KNOWN_ADMIN_EMAILS = ['sale.abumafhal@gmail.com', 'admin@abumafhal.com', 'abumafhal@gmail.com'];

    const fetchUserProfile = async (userId, sessionUser = null) => {
        try {
            const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
            
            const email = data?.email || sessionUser?.email || '';
            const lowerEmail = email ? email.toLowerCase().trim() : '';
            const isAdmin = lowerEmail && (KNOWN_ADMIN_EMAILS.includes(lowerEmail) || lowerEmail.includes('admin'));

            let resolvedRole = data?.role;
            if (isAdmin) {
                resolvedRole = 'admin';
                if (data && data.role !== 'admin') {
                    supabase.from('profiles').update({ role: 'admin' }).eq('id', userId).catch(() => {});
                }
            }

            const fullName = data?.full_name || data?.name || sessionUser?.user_metadata?.full_name || (email ? email.split('@')[0] : 'User');
            const phone = data?.phone_number || data?.phone || sessionUser?.user_metadata?.phone_number || sessionUser?.user_metadata?.phone || '';
            const avatarUrl = data?.avatar_url || sessionUser?.user_metadata?.avatar_url || null;
            const username = data?.username || sessionUser?.user_metadata?.username || (email ? email.split('@')[0] : 'user');

            const userProfile = {
                id: userId,
                email: email,
                role: resolvedRole || data?.role || sessionUser?.user_metadata?.role || 'buyer',
                full_name: fullName,
                fullName: fullName,
                phone: phone,
                phoneNumber: phone,
                phone_number: phone,
                avatar_url: avatarUrl,
                username: username,
                ...(data || {})
            };

            setUser(userProfile);
            AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userProfile)).catch(() => {});
            return userProfile;
        } catch (e) {
            console.error('Error fetching user profile:', e);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut().catch(() => {});
        } catch (e) {
            console.error('Logout error:', e);
        } finally {
            setUser(null);
            clearFollowedStoresCache();
            AsyncStorage.setItem('@abumafhal_last_screen', 'Landing').catch(() => {});

            if (typeof window !== 'undefined') {
                try {
                    window.localStorage.removeItem(USER_STORAGE_KEY);
                    window.localStorage.setItem('@abumafhal_last_screen', 'Landing');
                    // Purge all Supabase auth storage keys from localStorage
                    Object.keys(window.localStorage).forEach(key => {
                        if (key.startsWith('sb-') || key.includes('auth-token') || key.includes('supabase')) {
                            window.localStorage.removeItem(key);
                        }
                    });
                    if (window.sessionStorage) {
                        window.sessionStorage.clear();
                    }
                    if (window.history && window.history.replaceState) {
                        window.history.replaceState(null, '', '/mobile');
                    }
                    window.location.hash = '';
                } catch (_) {}
            }
            if (navigationRef.isReady()) {
                navigationRef.reset({
                    index: 0,
                    routes: [{ name: 'Landing' }],
                });
            }
        }
    };

    // Protected routes guard: only redirect if session initialization is complete and no stored credentials exist
    useEffect(() => {
        if (!authInitialized || loading) return;

        if (!user) {
            const timer = setTimeout(() => {
                if (navigationRef.isReady()) {
                    const currentRoute = navigationRef.getCurrentRoute();
                    const protectedRoutes = ['AdminDashboard', 'VendorDashboard', 'DriverDashboard'];
                    if (currentRoute?.name && protectedRoutes.includes(currentRoute.name)) {
                        const stored = getStoredUserSync();
                        if (!stored) {
                            navigationRef.navigate('Auth', { redirectTo: currentRoute.name });
                        }
                    }
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [user, loading, authInitialized]);

    const handleUpdateQty = (id, change) => {
        setCartLines(prev => prev.map(item => {
            if (item.id !== id) return item;
            const current = parseInt(item.quantity || item.qty || 1, 10) || 1;
            const updated = Math.max(1, current + change);
            return { ...item, quantity: updated, qty: updated };
        }));
    };
    const handleRemoveCart = (id) => setCartLines(prev => prev.filter(item => item.id !== id));
    const handleAddToCart = (product) => {
        setCartLines(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };
    const handleClearCart = () => setCartLines([]);

    const getInitialRoute = () => {
        try {
            const hash = typeof window !== 'undefined' ? (window.location.hash || '').toLowerCase() : '';
            const path = typeof window !== 'undefined' ? (window.location.pathname || '').toLowerCase() : '';
            const search = typeof window !== 'undefined' ? (window.location.search || '').toLowerCase() : '';
            const last = typeof window !== 'undefined' ? window.localStorage?.getItem('@abumafhal_last_screen') : null;
            const storedUser = user || getStoredUserSync();

            // 1. SPECIFIC VENDOR REGISTRATION CHECK (Always takes 100% precedence on reload)
            const isVendorRegister = 
                hash.includes('vendor-register') || hash.includes('vendorregister') || hash.includes('vendor-application') ||
                path.includes('vendor-register') || path.includes('vendor-application') ||
                search.includes('vendor-register') || search.includes('vendor-application') ||
                (last === 'VendorRegister' && !hash.startsWith('#admin') && !hash.startsWith('#driver') && !hash.startsWith('#shop'));

            if (isVendorRegister) {
                return 'VendorRegister';
            }
            if (hash.includes('checkout')) return 'CheckoutPage';
            if (hash.includes('track') || hash.includes('order')) return 'TrackOrder';
            if (hash.includes('invoice')) return 'Invoice';
            if (hash.includes('product/') || hash.startsWith('#product') || (last === 'ProductDetails' && !hash.startsWith('#admin') && !hash.startsWith('#driver') && !hash.startsWith('#shop') && !hash.startsWith('#vendor'))) {
                return 'ProductDetails';
            }
            if (hash.includes('compare')) return 'ProductComparison';
            if (hash.includes('pay-small-small')) return 'PaySmallSmall';

            // 2. STRICT AUTH CHECKS (Does not collide with vendor-register)
            const isAuthHash = ['#auth', '#login', '#register', '#signin', '#signup'].some(k => hash === k || hash.startsWith(k + '?') || hash.startsWith(k + '/'));
            if (isAuthHash) {
                return 'Auth';
            }

            // 3. STRICT DASHBOARD CHECKS (Must NEVER match substrings like vendor-register)
            const isStrictAdmin = hash === '#admin' || hash.startsWith('#admin?') || hash.startsWith('#admin/') || (path === '/admin' || path === '/admin/');
            if (isStrictAdmin) {
                return 'AdminDashboard';
            }

            const isStrictVendor = (hash === '#vendor' || hash.startsWith('#vendor?') || hash.startsWith('#vendor/') || path === '/vendor' || path === '/vendor/') && !hash.includes('vendor-register') && !hash.includes('vendor-application');
            if (isStrictVendor) {
                const isApprovedVendor = storedUser?.role === 'vendor' || storedUser?.role === 'admin' || storedUser?.user_metadata?.role === 'vendor';
                return isApprovedVendor ? 'VendorDashboard' : 'VendorRegister';
            }

            const isStrictDriver = hash === '#driver' || hash.startsWith('#driver?') || hash.startsWith('#driver/') || path === '/driver' || path === '/driver/';
            if (isStrictDriver) {
                return 'DriverDashboard';
            }

            if (['shop', 'cart', 'wishlist', 'profile', 'categories', 'stores', 'wallet', 'home', 'settings'].some(k => hash.includes(k))) {
                return 'Main';
            }

            if (last && ['AdminDashboard', 'VendorDashboard', 'DriverDashboard', 'Main', 'CheckoutPage', 'TrackOrder', 'ProductDetails', 'VendorRegister', 'PaySmallSmall'].includes(last)) {
                if (last === 'VendorDashboard') {
                    const isApprovedVendor = storedUser?.role === 'vendor' || storedUser?.role === 'admin' || storedUser?.user_metadata?.role === 'vendor';
                    if (!isApprovedVendor) return 'VendorRegister';
                }
                return last;
            }

            if (storedUser) {
                if (storedUser.role === 'admin') return 'AdminDashboard';
                if (storedUser.role === 'vendor') return 'VendorDashboard';
                if (storedUser.role === 'driver') return 'DriverDashboard';
                return 'Main';
            }

            if (last === 'Landing' || hash.includes('landing')) {
                return 'Landing';
            }
            return 'Landing';
        } catch (_) {}
        return 'Landing';
    };

    let initialRoute = getInitialRoute();

    return (
        <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider style={{ flex: 1 }}>
                    <AppSettingsProvider>
                        <ComparisonProvider>
                            <NavigationContainer 
                                ref={navigationRef} 
                                linking={linking}
                                onStateChange={() => {
                                    try {
                                        const currentRoute = navigationRef.getCurrentRoute();
                                        if (currentRoute?.name) {
                                            AsyncStorage.setItem('@abumafhal_last_screen', currentRoute.name).catch(() => {});
                                            if (typeof window !== 'undefined' && window.localStorage) {
                                                window.localStorage.setItem('@abumafhal_last_screen', currentRoute.name);

                                                // STRICT LOCK: Ensure browser address bar never reverts to desktop web
                                                if (!window.location.pathname.startsWith('/mobile')) {
                                                    const currentHash = window.location.hash || '';
                                                    window.history.replaceState(null, '', '/mobile' + currentHash);
                                                }

                                                const curHash = window.location.hash || '';
                                                if (currentRoute.name === 'AdminDashboard') {
                                                    if (!curHash.startsWith('#admin')) {
                                                        const savedTab = window.localStorage.getItem('@abumafhal_admin_tab');
                                                        const targetHash = (savedTab && savedTab !== 'overview') ? `#admin?tab=${savedTab}` : '#admin';
                                                        if (window.history && window.history.replaceState) {
                                                            window.history.replaceState(null, '', '/mobile' + targetHash);
                                                        } else {
                                                            window.location.hash = targetHash;
                                                        }
                                                    }
                                                } else if (currentRoute.name === 'VendorDashboard') {
                                                    // CRITICAL: NEVER overwrite or hijack if the user is on vendor-register
                                                    if (curHash.includes('vendor-register') || curHash.includes('vendorregister') || curHash.includes('vendor-application')) {
                                                        return;
                                                    }
                                                    const cleanHash = curHash.split('?')[0].replace('#', '');
                                                    if (cleanHash !== 'vendor') {
                                                        const savedTab = window.localStorage.getItem('@abumafhal_vendor_tab');
                                                        const targetHash = (savedTab && savedTab !== 'overview') ? `#vendor?tab=${savedTab}` : '#vendor';
                                                        if (window.history && window.history.replaceState) {
                                                            window.history.replaceState(null, '', '/mobile' + targetHash);
                                                        } else {
                                                            window.location.hash = targetHash;
                                                        }
                                                    }
                                                } else if (currentRoute.name === 'VendorRegister') {
                                                    window.localStorage.setItem('@abumafhal_last_screen', 'VendorRegister');
                                                    AsyncStorage.setItem('@abumafhal_last_screen', 'VendorRegister').catch(() => {});
                                                    if (!curHash.startsWith('#vendor-register')) {
                                                        const targetHash = '#vendor-register';
                                                        if (window.history && window.history.replaceState) {
                                                            window.history.replaceState(null, '', '/mobile' + targetHash);
                                                        } else {
                                                            window.location.hash = targetHash;
                                                        }
                                                    }
                                                } else if (currentRoute.name === 'ProductDetails') {
                                                    window.localStorage.setItem('@abumafhal_last_screen', 'ProductDetails');
                                                    AsyncStorage.setItem('@abumafhal_last_screen', 'ProductDetails').catch(() => {});
                                                    const pId = currentRoute.params?.id || currentRoute.params?.productId || currentRoute.params?.product?.id;
                                                    if (pId) {
                                                        window.localStorage.setItem('@abumafhal_last_product_id', String(pId));
                                                        if (currentRoute.params?.product) {
                                                            try {
                                                                window.localStorage.setItem('@abumafhal_last_product_data', JSON.stringify(currentRoute.params.product));
                                                            } catch (_) {}
                                                        }
                                                        if (!curHash.includes(pId)) {
                                                            const targetHash = `#product/${pId}`;
                                                            if (window.history && window.history.replaceState) {
                                                                window.history.replaceState(null, '', '/mobile' + targetHash);
                                                            } else {
                                                                window.location.hash = targetHash;
                                                            }
                                                        }
                                                    }
                                                } else if (currentRoute.name === 'DriverDashboard') {
                                                    if (!curHash.startsWith('#driver')) {
                                                        const savedTab = window.localStorage.getItem('@abumafhal_driver_tab');
                                                        const targetHash = (savedTab && savedTab !== 'active') ? `#driver?tab=${savedTab}` : '#driver';
                                                        if (window.history && window.history.replaceState) {
                                                            window.history.replaceState(null, '', '/mobile' + targetHash);
                                                        } else {
                                                            window.location.hash = targetHash;
                                                        }
                                                    }
                                                } else if (currentRoute.name === 'Main') {
                                                    if (['#admin', '#vendor', '#driver', '#landing'].some(p => curHash.startsWith(p))) {
                                                        const savedMainTab = window.localStorage.getItem('@abumafhal_main_tab') || 'home';
                                                        const targetHash = savedMainTab === 'home' ? '' : `#${savedMainTab}`;
                                                        if (window.history && window.history.replaceState) {
                                                            window.history.replaceState(null, '', '/mobile' + (targetHash ? targetHash : ''));
                                                        } else {
                                                            window.location.hash = targetHash;
                                                        }
                                                    }
                                                } else if (currentRoute.name === 'Landing') {
                                                    if (['#admin', '#vendor', '#driver'].some(p => curHash.startsWith(p))) {
                                                        if (window.history && window.history.replaceState) {
                                                            window.history.replaceState(null, '', '/mobile#landing');
                                                        } else {
                                                            window.location.hash = 'landing';
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    } catch (_) {}
                                }}
                            >
                            <Stack.Navigator
                                initialRouteName={initialRoute}
                                screenOptions={{ headerShown: false, detachInactiveScreens: false }}
                            >
                                <Stack.Screen name="Landing">
                                    {props => (
                                        <LandingPage
                                            {...props}
                                            user={user}
                                            cartCount={cartLines?.length || 0}
                                            cartLines={cartLines}
                                            onAddToCart={handleAddToCart}
                                            onEnterShop={(tab = 'shop', params = {}) => {
                                                props.navigation.navigate('Main', { screen: tab, ...params });
                                            }}
                                            onLogin={() => props.navigation.navigate('Auth')}
                                            onNavigate={(screen, params) => props.navigation.navigate(screen, params)}
                                        />
                                    )}
                                </Stack.Screen>
                                <Stack.Screen name="Auth">
                                    {props => (
                                        <AuthPage
                                            {...props}
                                            onBack={() => props.navigation.goBack()}
                                            onLoginSuccess={async (loggedInUser) => {
                                                await fetchUserProfile(loggedInUser.id, loggedInUser);
                                                const redirectTo = props.route?.params?.redirectTo;
                                                const redirectParams = props.route?.params?.redirectParams;

                                                setTimeout(() => {
                                                    if (navigationRef.isReady()) {
                                                        if (redirectTo) {
                                                            navigationRef.navigate(redirectTo, redirectParams);
                                                        } else {
                                                            navigationRef.reset({
                                                                index: 0,
                                                                routes: [{ name: 'Main', params: { screen: 'home' } }]
                                                            });
                                                        }
                                                    }
                                                }, 100);
                                            }}
                                        />
                                    )}
                                </Stack.Screen>
                            <Stack.Screen name="Main">
                                {props => (
                                    <MainApp
                                        {...props}
                                        user={user}
                                        onUpdateUser={setUser}
                                        onLogout={handleLogout}
                                        cartLines={cartLines}
                                        onUpdateQty={handleUpdateQty}
                                        onRemoveCart={handleRemoveCart}
                                        onAddToCart={handleAddToCart}
                                        onClearCart={handleClearCart}
                                        onOpenVendorRegister={() => props.navigation.navigate(user ? 'VendorRegister' : 'Auth')}
                                        onOpenAdmin={() => props.navigation.navigate(user ? 'AdminDashboard' : 'Auth')}
                                        onOpenVendor={() => props.navigation.navigate(user ? 'VendorDashboard' : 'Auth')}
                                    />
                                )}
                            </Stack.Screen>
                            <Stack.Screen name="AdminDashboard">
                                {props => <AdminDashboard {...props} user={user} onLogout={handleLogout} />}
                            </Stack.Screen>
                            <Stack.Screen name="VendorDashboard">
                                {props => {
                                    const isVendor = user?.role === 'vendor' || user?.user_metadata?.role === 'vendor' || user?.role === 'admin' || user?.user_metadata?.role === 'admin';
                                    if (!isVendor) {
                                        return (
                                            <VendorRegister
                                                {...props}
                                                user={user}
                                                onBack={() => props.navigation.navigate('Main', { screen: 'home' })}
                                                onSubmit={() => props.navigation.navigate('VendorDashboard')}
                                            />
                                        );
                                    }
                                    return <VendorDashboard {...props} user={user} onLogout={handleLogout} />;
                                }}
                            </Stack.Screen>
                            <Stack.Screen name="DriverDashboard">
                                {props => <DriverDashboard {...props} user={user} onLogout={handleLogout} />}
                            </Stack.Screen>
                            <Stack.Screen name="ProductDetails">
                                {props => {
                                    let enrichedRoute = props.route;
                                    if (!enrichedRoute?.params?.id && !enrichedRoute?.params?.product) {
                                        try {
                                            if (typeof window !== 'undefined' && window.localStorage) {
                                                const cachedId = window.localStorage.getItem('@abumafhal_last_product_id');
                                                const cachedData = window.localStorage.getItem('@abumafhal_last_product_data');
                                                let parsed = null;
                                                if (cachedData) {
                                                    try { parsed = JSON.parse(cachedData); } catch (_) {}
                                                }
                                                if (cachedId || parsed) {
                                                    enrichedRoute = {
                                                        ...props.route,
                                                        params: {
                                                            ...props.route?.params,
                                                            id: cachedId || parsed?.id,
                                                            product: parsed
                                                        }
                                                    };
                                                }
                                            }
                                        } catch (_) {}
                                    }
                                    return <ProductDetails {...props} route={enrichedRoute} user={user} addToCart={handleAddToCart} />;
                                }}
                            </Stack.Screen>
                            <Stack.Screen name="VendorRegister">
                                {props => <VendorRegister {...props} user={user} onBack={() => props.navigation.goBack()} onSubmit={() => props.navigation.navigate('VendorDashboard')} />}
                            </Stack.Screen>
                            <Stack.Screen name="ChatScreen" component={ChatScreen} />
                            <Stack.Screen name="ConversationsScreen" component={ConversationsScreen} />
                            <Stack.Screen name="TrackOrder" component={TrackOrderPage} />
                            <Stack.Screen name="Invoice" component={InvoicePage} />
                            <Stack.Screen name="CheckoutPage">
                                {props => <CheckoutPage {...props} onClearCart={handleClearCart} cartLines={cartLines} />}
                            </Stack.Screen>
                            <Stack.Screen name="AddressPage" component={AddressPage} />
                            <Stack.Screen name="ProductComparison">
                                {props => <ProductComparison {...props} addToCart={handleAddToCart} />}
                            </Stack.Screen>
                            <Stack.Screen name="PaySmallSmall">
                                {props => <PaySmallSmallPage {...props} user={user} />}
                            </Stack.Screen>
                        </Stack.Navigator>
                    </NavigationContainer>

                    {showSplash && (
                        <ModernSplashScreen 
                            fontsLoaded={fontsLoaded}
                            onFinish={() => setShowSplash(false)} 
                        />
                    )}

                    <ForceUpdateModal />

                    </ComparisonProvider>
                </AppSettingsProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    </ErrorBoundary>
    );
}
