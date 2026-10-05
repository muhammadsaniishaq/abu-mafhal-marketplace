import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHome } from './AppHome';
import { ShopPage } from './ShopPage';
import { CartPage } from './CartPage';
import { WishlistPage } from './WishlistPage';
import { ProfilePage } from './ProfilePage';
import { OrdersPage } from './OrdersPage';
import { SettingsPage } from './SettingsPage';
import { EditProfilePage } from './EditProfilePage';
import { AddressPage } from './AddressPage';
import { ChangePasswordPage } from './ChangePasswordPage';
import { BottomNav } from '../components/BottomNav';
import { PaymentMethodsPage } from './PaymentMethodsPage';
import { NotificationsPage } from './NotificationsPage';
import { InfoPage } from './InfoPage';
import { ProductDetails } from './ProductDetails';
import { ReferAndEarn } from './ReferAndEarn';
import { AIAssistantModal } from '../components/AIAssistantModal';
import { SupportPage } from './SupportPage';
import { AboutPage } from './AboutPage';
import { PAGE_CONTENT } from '../data/pageContent';
import { supabase } from '../lib/supabase';
import { WalletPage } from './WalletPage';
import { CategoriesPage } from './CategoriesPage';
import { StoresPage } from './StoresPage';

const VALID_MAIN_TABS = [
    'home', 'shop', 'cart', 'wishlist', 'profile', 'orders', 
    'settings', 'editProfile', 'changePassword', 'address', 
    'paymentMethods', 'notifications', 'referral', 'ReferAndEarn', 
    'wallet', 'support', 'about', 'categories', 'stores'
];

const getInitialMainTab = (route) => {
    try {
        if (route?.params?.screen && VALID_MAIN_TABS.includes(route.params.screen)) {
            return route.params.screen;
        }

        if (typeof window !== 'undefined' && window.location) {
            const rawHash = (window.location.hash || '').replace('#', '').toLowerCase();
            const [baseHash, queryHash] = rawHash.split('?');

            if (queryHash) {
                const match = queryHash.match(/tab=([a-zA-Z0-9_-]+)/);
                if (match && match[1] && VALID_MAIN_TABS.includes(match[1])) return match[1];
            }
            if (baseHash && VALID_MAIN_TABS.includes(baseHash)) {
                return baseHash;
            }

            const saved = window.localStorage?.getItem('@abumafhal_main_tab');
            if (saved && VALID_MAIN_TABS.includes(saved)) {
                return saved;
            }
        }
    } catch (_) {}
    return 'home';
};

export const MainApp = ({ route, navigation, user, onLogout, cartLines, onUpdateQty, onRemoveCart, onAddToCart, onClearCart, onOpenVendorRegister, onOpenAdmin, onOpenVendor, onUpdateUser }) => {
    const [activeTab, _setActiveTab] = useState(() => getInitialMainTab(route));
    const [showAI, setShowAI] = useState(false);

    const setActiveTab = useCallback((tabName) => {
        _setActiveTab(tabName);
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@abumafhal_main_tab', tabName);
                window.localStorage.setItem('@abumafhal_last_screen', 'Main');
                const targetHash = tabName === 'home' ? '' : `#${tabName}`;
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', '/mobile' + (targetHash ? targetHash : ''));
                }
            }
            AsyncStorage.setItem('@abumafhal_main_tab', tabName).catch(() => {});
            AsyncStorage.setItem('@abumafhal_last_screen', 'Main').catch(() => {});
        } catch (_) {}
    }, []);

    // Dynamic Tab Navigation from Route Params
    React.useEffect(() => {
        if (route?.params?.screen && VALID_MAIN_TABS.includes(route.params.screen) && route.params.screen !== activeTab) {
            setActiveTab(route.params.screen);
        }
    }, [route?.params?.screen]);

    // Ensure @abumafhal_last_screen and hash are registered on mount
    React.useEffect(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@abumafhal_last_screen', 'Main');
                const curHash = window.location.hash || '';
                if (!curHash || curHash === '#main') {
                    if (activeTab !== 'home') {
                        if (window.history && window.history.replaceState) {
                            window.history.replaceState(null, '', '/mobile#' + activeTab);
                        }
                    }
                }
            }
            AsyncStorage.setItem('@abumafhal_last_screen', 'Main').catch(() => {});
        } catch (_) {}
    }, []);

    // [NEW] Refresh user profile on mount to catch role updates (e.g. after approval)
    // This fixes the issue where a user logs in as 'buyer' even after being approved as 'vendor'
    React.useEffect(() => {
        const refreshProfile = async () => {
            if (!user) return;
            // console.log('MainApp: Checking for role updates...');
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (data && (data.role !== user.role || data.full_name !== user.fullName)) {
                if (typeof onUpdateUser === 'function') {
                    onUpdateUser({ ...user, ...data });
                }
            }
        };
        refreshProfile();
    }, []);

    const handleNavigate = (screen, params) => {
        console.log('[DEBUG-NAV] Navigating to:', screen);
        if (['DriverDashboard', 'VendorDashboard', 'AdminDashboard', 'ProductDetails', 'ConversationsScreen', 'TrackOrder', 'Invoice', 'CheckoutPage', 'ProductComparison', 'PaySmallSmall'].includes(screen)) {
            navigation.navigate(screen, params);
        } else {
            setActiveTab(screen);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
                {activeTab === 'home' && (
                    <AppHome
                        user={user}
                        onGoToShop={() => setActiveTab('shop')}
                        onGoToCart={() => setActiveTab('cart')}
                        onGoToNotifications={() => setActiveTab('notifications')}
                        onNavigate={(screen) => setActiveTab(screen)}
                        onProductClick={(product) => handleNavigate('ProductDetails', { product, id: product?.id })}
                        cartCount={cartLines?.length || 0}
                        onAddToCart={onAddToCart}
                    />
                )}
                {activeTab === 'shop' && <ShopPage
                    onBack={() => setActiveTab('home')}
                    cartCount={cartLines.length}
                    onGoToCart={() => setActiveTab('cart')}
                    addToCart={onAddToCart}
                    onProductClick={(product) => handleNavigate('ProductDetails', { product, id: product?.id })}
                    onCompareClick={() => handleNavigate('ProductComparison')}
                    initialQuery={route?.params?.query}
                    initialCategory={route?.params?.category}
                />}
                {activeTab === 'cart' && <CartPage cart={cartLines} user={user} onBack={() => setActiveTab('home')} onUpdateQty={onUpdateQty} onRemove={onRemoveCart} onClear={onClearCart} />}
                {activeTab === 'wishlist' && <WishlistPage onBack={() => setActiveTab('home')} onAddToCart={onAddToCart} onProductClick={(product) => handleNavigate('ProductDetails', { product, id: product?.id })} />}
                {activeTab === 'profile' && <ProfilePage
                    user={user}
                    onLogout={onLogout}
                    onBack={() => setActiveTab('home')}
                    onOpenVendorRegister={onOpenVendorRegister}
                    onOpenVendor={onOpenVendor || (() => handleNavigate('VendorDashboard'))}
                    onOpenAdmin={onOpenAdmin || (() => handleNavigate('AdminDashboard'))}
                    onNavigate={handleNavigate}
                    onUpdateUser={onUpdateUser}
                />}
                {activeTab === 'orders' && <OrdersPage onBack={() => setActiveTab('profile')} user={user} onNavigate={handleNavigate} />}
                {activeTab === 'settings' && <SettingsPage onBack={() => setActiveTab('profile')} onLogout={onLogout} onNavigate={setActiveTab} />}
                {activeTab === 'editProfile' && <EditProfilePage user={user} onBack={() => setActiveTab('settings')} onUpdateUser={onUpdateUser} />}
                {activeTab === 'changePassword' && <ChangePasswordPage onBack={() => setActiveTab('settings')} />}
                {activeTab === 'address' && <AddressPage onBack={() => setActiveTab('settings')} />}
                {activeTab === 'paymentMethods' && <PaymentMethodsPage onBack={() => setActiveTab('settings')} />}
                {/* ... notifications ... */}
                {activeTab === 'notifications' && <NotificationsPage onBack={() => setActiveTab('settings')} />}
                {(activeTab === 'referral' || activeTab === 'ReferAndEarn') && <ReferAndEarn user={user} onBack={() => setActiveTab('profile')} />}
                {activeTab === 'wallet' && <WalletPage user={user} onBack={() => setActiveTab('profile')} />}
                {activeTab === 'support' && <SupportPage user={user} onBack={() => setActiveTab('profile')} />}
                {activeTab === 'about' && <AboutPage onBack={() => setActiveTab('profile')} />}


                {activeTab === 'categories' && (
                    <CategoriesPage
                        onSelectCategory={(slug) => {
                            handleNavigate('shop', { category: slug });
                        }}
                        onGoToCart={() => setActiveTab('cart')}
                        cartCount={cartLines.length}
                        onProductClick={(product) => handleNavigate('ProductDetails', { product, id: product?.id })}
                        onAddToCart={onAddToCart}
                        onGoToShop={(category) => handleNavigate('shop', { category })}
                        onNavigate={handleNavigate}
                    />
                )}
                {activeTab === 'stores' && (
                    <StoresPage
                        user={user}
                        onGoToCart={() => setActiveTab('cart')}
                        onGoToNotifications={() => setActiveTab('notifications')}
                        cartCount={cartLines.length}
                        onProductClick={(product) => handleNavigate('ProductDetails', { product, id: product?.id })}
                        onAddToCart={onAddToCart}
                        onGoToShop={(category) => handleNavigate('shop', { category })}
                        onNavigate={handleNavigate}
                    />
                )}
                {/* Fallback for Footer Pages */}
                {!['home', 'shop', 'cart', 'wishlist', 'categories', 'stores', 'profile', 'orders', 'settings', 'editProfile', 'changePassword', 'address', 'paymentMethods', 'notifications', 'productDetails', 'wallet', 'referral', 'ReferAndEarn', 'support', 'about'].includes(activeTab) && (
                    <InfoPage
                        title={activeTab}
                        content={PAGE_CONTENT[activeTab] || `Content for ${activeTab} is coming soon.`}
                        onBack={() => setActiveTab('home')}
                    />
                )}
            </View>

            {/* ── MINIMAL SLEEK MODERN AI ASSISTANT (NO RAWANI / NO STATIC NAVY) ── */}
            {activeTab === 'home' && (
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setShowAI(true)}
                    style={{
                        position: 'absolute',
                        bottom: 78,
                        right: 16,
                        zIndex: 999,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.18,
                        shadowRadius: 10,
                        elevation: 7,
                    }}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 7,
                            paddingVertical: 9,
                            paddingHorizontal: 15,
                            borderRadius: 22,
                            backgroundColor: '#0F172A',
                        }}
                    >
                        <Ionicons name="sparkles" size={15} color="#38BDF8" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 }}>
                            Ask AI
                        </Text>
                    </View>
                </TouchableOpacity>
            )}

            <AIAssistantModal
                visible={showAI}
                onClose={() => setShowAI(false)}
                role="user"
                user={user}
                onNavigate={handleNavigate}
            />

            <BottomNav activeTab={activeTab} onTabChange={setActiveTab} cartCount={cartLines.length} />
        </View>
    );
};
