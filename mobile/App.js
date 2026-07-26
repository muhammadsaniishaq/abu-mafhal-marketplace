import 'react-native-gesture-handler';
import { LogBox } from 'react-native';
import React, { useState, useEffect } from 'react';
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
    prefixes: ['abumafhal://', 'https://abumafhal.com', 'http://abumafhal.com'],
    config: {
        screens: {
            Auth: 'join/:code',
            Landing: '',
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

    useEffect(() => {
        // Load session and cart
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await fetchUserProfile(session.user.id);
            }

            try {
                const savedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
                if (savedCart) {
                    setCartLines(JSON.parse(savedCart));
                }
            } catch (e) {
                console.error('Error loading cart:', e);
            }
            setLoading(false);
        };

        init();
        logVisit(); // Initial visit log

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setUser(null);
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
            
            const email = data?.email || sessionUser?.email;
            const lowerEmail = email ? email.toLowerCase().trim() : '';
            const isAdmin = lowerEmail && (KNOWN_ADMIN_EMAILS.includes(lowerEmail) || lowerEmail.includes('admin'));

            let resolvedRole = data?.role;
            if (isAdmin) {
                resolvedRole = 'admin';
                if (data && data.role !== 'admin') {
                    await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId).catch(console.error);
                }
            }

            const userProfile = {
                ...(data || {}),
                id: userId,
                email: email,
                role: resolvedRole || data?.role || 'buyer'
            };

            setUser(userProfile);
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
            await supabase.auth.signOut();
        } catch (e) {
            console.error('Logout error:', e);
        } finally {
            setUser(null);
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

    let initialRoute = 'Landing';
    if (user) {
        if (user.role === 'admin') initialRoute = 'AdminDashboard';
        else if (user.role === 'vendor') initialRoute = 'VendorDashboard';
        else if (user.role === 'driver') initialRoute = 'DriverDashboard';
        else initialRoute = 'Main';
    }

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
                                                onEnterShop={() => props.navigation.navigate('Main')}
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
                                                     const profile = await fetchUserProfile(loggedInUser.id, loggedInUser);
                                                     const userRole = profile?.role || 'buyer';
                                                     const redirectTo = props.route?.params?.redirectTo;
                                                     const redirectParams = props.route?.params?.redirectParams;

                                                     setTimeout(() => {
                                                         if (navigationRef.isReady()) {
                                                             if (redirectTo) {
                                                                 navigationRef.navigate(redirectTo, redirectParams);
                                                             } else if (userRole === 'admin') {
                                                                 navigationRef.navigate('AdminDashboard');
                                                             } else if (userRole === 'vendor') {
                                                                 navigationRef.navigate('VendorDashboard');
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
