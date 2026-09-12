import 'react-native-gesture-handler';
import { LogBox, Text, TextInput, ScrollView, FlatList, SectionList } from 'react-native';
import React, { useState, useEffect } from 'react';

// Kwata-kwata kange zoom da canza girman rubutu a dukkan manhajar mobile
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.allowFontScaling = false;
Text.defaultProps.maxFontSizeMultiplier = 1;

if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.allowFontScaling = false;
TextInput.defaultProps.maxFontSizeMultiplier = 1;

if (ScrollView.defaultProps == null) ScrollView.defaultProps = {};
ScrollView.defaultProps.maximumZoomScale = 1;
ScrollView.defaultProps.minimumZoomScale = 1;
ScrollView.defaultProps.bouncesZoom = false;

if (FlatList.defaultProps == null) FlatList.defaultProps = {};
FlatList.defaultProps.maximumZoomScale = 1;
FlatList.defaultProps.minimumZoomScale = 1;
FlatList.defaultProps.bouncesZoom = false;

if (SectionList.defaultProps == null) SectionList.defaultProps = {};
SectionList.defaultProps.maximumZoomScale = 1;
SectionList.defaultProps.minimumZoomScale = 1;
SectionList.defaultProps.bouncesZoom = false;
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppSettingsProvider } from './src/context/AppSettingsContext';
import { supabase } from './src/lib/supabase';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ComparisonProvider } from './src/context/ComparisonContext';

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

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

const linking = {
    prefixes: [
        'abumafhal://',
        'https://abumafhal.com',
        'http://abumafhal.com',
        'https://www.abumafhal.com',
        'http://www.abumafhal.com',
    ],
    config: {
        screens: {
            Landing: '',
            Auth: 'auth',
            Main: 'main',
        },
    },
};

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cartLines, setCartLines] = useState([]);
    const [lastHeartbeat, setLastHeartbeat] = useState(0);

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
                    try { setUser(JSON.parse(savedUser)); } catch (_) {}
                }
            } catch (e) {
                console.error('Error loading local cache:', e);
            } finally {
                // Instantly unblock UI so user never stares at a frozen screen
                setLoading(false);
            }

            // 2. Background check: verify Supabase session without wiping cached user prematurely
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    await fetchUserProfile(session.user.id, session.user);
                }
            } catch (authErr) {
                console.log('Background session check note:', authErr?.message);
            }

            logVisit(); // Async visit log
        };

        init();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                fetchUserProfile(session.user.id, session.user);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                AsyncStorage.removeItem(USER_STORAGE_KEY).catch(() => {});
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
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        } catch (e) {
            console.error('Logout error:', e);
        } finally {
            setUser(null);
            await AsyncStorage.removeItem(USER_STORAGE_KEY).catch(() => {});
            setTimeout(() => {
                if (navigationRef.isReady()) {
                    navigationRef.reset({
                        index: 0,
                        routes: [{ name: 'Landing' }],
                    });
                }
            }, 50);
        }
    };

    const handleUpdateQty = (id, change) => {
        setCartLines(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + change) } : item));
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

    if (loading) return null; // Or a custom splash screen

    let initialRoute = user ? 'Main' : 'Landing';

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider style={{ flex: 1 }}>
                <AppSettingsProvider>
                    <ComparisonProvider>
                        <NavigationContainer ref={navigationRef} linking={linking}>
                        <Stack.Navigator
                            key={user ? `user-${user.id}-${user.role}` : 'guest'}
                            initialRouteName={initialRoute}
                            screenOptions={{ headerShown: false, detachInactiveScreens: false }}
                        >
                            {!user ? (
                                <>
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
                                                                 navigationRef.navigate('Main');
                                                             }
                                                         }
                                                     }, 150);
                                                 }}
                                            />
                                        )}
                                    </Stack.Screen>
                                    <Stack.Screen name="Main">
                                        {props => (
                                            <MainApp
                                                {...props}
                                                user={null}
                                                onUpdateUser={setUser}
                                                onLogout={handleLogout}
                                                cartLines={cartLines}
                                                onUpdateQty={handleUpdateQty}
                                                onRemoveCart={handleRemoveCart}
                                                onAddToCart={handleAddToCart}
                                                onClearCart={handleClearCart}
                                                onOpenVendorRegister={() => props.navigation.navigate('Auth')}
                                                onOpenAdmin={() => props.navigation.navigate('Auth')}
                                                onOpenVendor={() => props.navigation.navigate('Auth')}
                                            />
                                        )}
                                    </Stack.Screen>
                                    <Stack.Screen name="ProductDetails">
                                        {props => <ProductDetails {...props} addToCart={handleAddToCart} />}
                                    </Stack.Screen>
                                    <Stack.Screen name="ProductComparison">
                                        {props => <ProductComparison {...props} addToCart={handleAddToCart} />}
                                    </Stack.Screen>
                                </>
                            ) : (
                                <>
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
                                                onOpenVendorRegister={() => props.navigation.navigate('VendorRegister')}
                                                onOpenAdmin={() => props.navigation.navigate('AdminDashboard')}
                                                onOpenVendor={() => props.navigation.navigate('VendorDashboard')}
                                            />
                                        )}
                                    </Stack.Screen>
                                    <Stack.Screen name="AdminDashboard">
                                        {props => <AdminDashboard {...props} user={user} onLogout={handleLogout} />}
                                    </Stack.Screen>
                                    <Stack.Screen name="VendorDashboard">
                                        {props => <VendorDashboard {...props} user={user} onLogout={handleLogout} />}
                                    </Stack.Screen>
                                    <Stack.Screen name="DriverDashboard">
                                        {props => <DriverDashboard {...props} user={user} onLogout={handleLogout} />}
                                    </Stack.Screen>
                                    <Stack.Screen name="ProductDetails">
                                        {props => <ProductDetails {...props} addToCart={handleAddToCart} />}
                                    </Stack.Screen>
                                    <Stack.Screen name="VendorRegister">
                                        {props => <VendorRegister {...props} user={user} onBack={() => props.navigation.goBack()} />}
                                    </Stack.Screen>
                                    <Stack.Screen name="ChatScreen" component={ChatScreen} />
                                    <Stack.Screen name="ConversationsScreen" component={ConversationsScreen} />
                                    <Stack.Screen name="TrackOrder" component={TrackOrderPage} />
                                    <Stack.Screen name="Invoice" component={InvoicePage} />
                                    <Stack.Screen name="CheckoutPage">
                                        {props => <CheckoutPage {...props} onClearCart={handleClearCart} />}
                                    </Stack.Screen>
                                    <Stack.Screen name="AddressPage" component={AddressPage} />
                                    <Stack.Screen name="ProductComparison">
                                        {props => <ProductComparison {...props} addToCart={handleAddToCart} />}
                                    </Stack.Screen>
                                </>
                            )}
                        </Stack.Navigator>
                    </NavigationContainer>
                    </ComparisonProvider>
                </AppSettingsProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
