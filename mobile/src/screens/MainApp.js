import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
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

export const MainApp = ({ route, navigation, user, onLogout, cartLines, onUpdateQty, onRemoveCart, onAddToCart, onClearCart, onOpenVendorRegister, onOpenAdmin, onOpenVendor, onUpdateUser }) => {
    const [activeTab, setActiveTab] = useState('home');
    const [showAI, setShowAI] = useState(false);

    // Dynamic Tab Navigation from Route Params
    React.useEffect(() => {
        if (route?.params?.screen) {
            setActiveTab(route.params.screen);
        }
    }, [route?.params?.screen]);

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
                        onProductClick={(product) => handleNavigate('ProductDetails', { product })}
                        cartCount={cartLines?.length || 0}
                        onAddToCart={onAddToCart}
                    />
                )}
                {activeTab === 'shop' && <ShopPage
                    onBack={() => setActiveTab('home')}
                    cartCount={cartLines.length}
                    onGoToCart={() => setActiveTab('cart')}
                    addToCart={onAddToCart}
                    onProductClick={(product) => handleNavigate('ProductDetails', { product })}
                    onCompareClick={() => handleNavigate('ProductComparison')}
                    initialQuery={route?.params?.query}
                    initialCategory={route?.params?.category}
                />}
                {activeTab === 'cart' && <CartPage cart={cartLines} user={user} onBack={() => setActiveTab('home')} onUpdateQty={onUpdateQty} onRemove={onRemoveCart} onClear={onClearCart} />}
                {activeTab === 'wishlist' && <WishlistPage onBack={() => setActiveTab('home')} onAddToCart={onAddToCart} onProductClick={(product) => handleNavigate('ProductDetails', { product })} />}
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
                        onProductClick={(product) => handleNavigate('ProductDetails', { product })}
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
                        onProductClick={(product) => handleNavigate('ProductDetails', { product })}
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

            {/* ── LUXURY MODERNIZED AI ASSISTANT (VISIBLE ONLY ON HOME SCREEN) ── */}
            {activeTab === 'home' && (
                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => setShowAI(true)}
                    style={{
                        position: 'absolute',
                        bottom: 80,
                        right: 16,
                        zIndex: 999,
                        shadowColor: '#0E1A2E',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.35,
                        shadowRadius: 10,
                        elevation: 8,
                    }}
                >
                    <LinearGradient
                        colors={['#0E1A2E', '#1A2942']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 7,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 24,
                            borderWidth: 1.5,
                            borderColor: '#D9A73A',
                        }}
                    >
                        <View style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: 'rgba(217, 167, 58, 0.18)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#D9A73A',
                        }}>
                            <Ionicons name="sparkles" size={15} color="#D9A73A" />
                        </View>
                        <View style={{ marginRight: 2 }}>
                            <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 }}>
                                Ask AI
                            </Text>
                            <Text style={{ fontSize: 8.5, fontWeight: '800', color: '#D9A73A', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                Assistant
                            </Text>
                        </View>
                        <View style={{
                            width: 7,
                            height: 7,
                            borderRadius: 3.5,
                            backgroundColor: '#10B981',
                            shadowColor: '#10B981',
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.9,
                            shadowRadius: 3,
                            elevation: 2,
                        }} />
                    </LinearGradient>
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
