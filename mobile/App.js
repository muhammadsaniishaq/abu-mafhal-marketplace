import 'react-native-gesture-handler';
import { LogBox } from 'react-native';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppSettingsProvider } from './src/context/AppSettingsContext';
import { supabase } from './src/lib/supabase';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Screens
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

const Stack = createNativeStackNavigator();

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cartLines, setCartLines] = useState([]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchUserProfile = async (userId) => {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) {
            setUser({ ...data, id: userId });
        }
        setLoading(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
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

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider style={{ flex: 1 }}>
                <AppSettingsProvider>
                    <NavigationContainer>
                        <Stack.Navigator screenOptions={{ headerShown: false, detachInactiveScreens: false }}>
                            {!user ? (
                                <>
                                    <Stack.Screen name="Landing">
                                        {props => (
                                            <LandingPage
                                                {...props}
                                                onEnterShop={() => props.navigation.navigate('Auth')}
                                                onLogin={() => props.navigation.navigate('Auth')}
                                                onNavigate={(screen) => props.navigation.navigate(screen)}
                                            />
                                        )}
                                    </Stack.Screen>
                                    <Stack.Screen name="Auth">
                                        {props => <AuthPage {...props} onBack={() => props.navigation.goBack()} />}
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
                                    <Stack.Screen name="VendorRegister" component={VendorRegister} />
                                    <Stack.Screen name="ChatScreen" component={ChatScreen} />
                                    <Stack.Screen name="ConversationsScreen" component={ConversationsScreen} />
                                    <Stack.Screen name="TrackOrder" component={TrackOrderPage} />
                                    <Stack.Screen name="Invoice" component={InvoicePage} />
                                </>
                            )}
                        </Stack.Navigator>
                    </NavigationContainer>
                </AppSettingsProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
