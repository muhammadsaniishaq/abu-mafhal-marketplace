import React, { useState } from 'react';
import { View } from 'react-native';
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
import { PAGE_CONTENT } from '../data/pageContent';
import { supabase } from '../lib/supabase';

export const MainApp = ({ navigation, user, onLogout, cartLines, onUpdateQty, onRemoveCart, onAddToCart, onClearCart, onOpenVendorRegister, onOpenAdmin, onOpenVendor, onUpdateUser }) => {
    const [activeTab, setActiveTab] = useState('home');

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
                .single();

            if (data && data.role !== user.role) {
                console.log('MainApp: User role updated from', user.role, 'to', data.role);
                if (typeof onUpdateUser === 'function') {
                    onUpdateUser({ ...user, ...data });
                }
            }
        };
        refreshProfile();
    }, []);

    const handleNavigate = (screen, params) => {
        if (['DriverDashboard', 'VendorDashboard', 'AdminDashboard', 'ProductDetails', 'ConversationsScreen', 'TrackOrder', 'Invoice'].includes(screen)) {
            navigation.navigate(screen, params);
        } else {
            setActiveTab(screen);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
                {activeTab === 'home' && <AppHome user={user} onGoToShop={() => setActiveTab('shop')} onGoToCart={() => setActiveTab('cart')} onGoToNotifications={() => setActiveTab('notifications')} onNavigate={(screen) => setActiveTab(screen)} />}
                {activeTab === 'shop' && <ShopPage
                    onBack={() => setActiveTab('home')}
                    cartCount={cartLines.length}
                    onGoToCart={() => setActiveTab('cart')}
                    addToCart={onAddToCart}
                    onProductClick={(product) => handleNavigate('productDetails', { product })}
                />}
                {activeTab === 'cart' && <CartPage cart={cartLines} onBack={() => setActiveTab('home')} onUpdateQty={onUpdateQty} onRemove={onRemoveCart} onClear={onClearCart} />}
                {activeTab === 'wishlist' && <WishlistPage onBack={() => setActiveTab('home')} onAddToCart={onAddToCart} onProductClick={(product) => handleNavigate('productDetails', { product })} />}
                {activeTab === 'profile' && <ProfilePage
                    user={user}
                    onLogout={onLogout}
                    onBack={() => setActiveTab('home')}
                    onOpenVendorRegister={onOpenVendorRegister}
                    onOpenVendor={onOpenVendor}
                    onOpenAdmin={onOpenAdmin}
                    onNavigate={handleNavigate}
                    onUpdateUser={onUpdateUser}
                />}
                {activeTab === 'orders' && <OrdersPage onBack={() => setActiveTab('profile')} user={user} onNavigate={handleNavigate} />}
                {activeTab === 'settings' && <SettingsPage onBack={() => setActiveTab('profile')} onLogout={onLogout} onNavigate={setActiveTab} />}
                {activeTab === 'editProfile' && <EditProfilePage user={user} onBack={() => setActiveTab('settings')} onUpdateUser={onUpdateUser} />}
                {activeTab === 'changePassword' && <ChangePasswordPage onBack={() => setActiveTab('settings')} />}
                {activeTab === 'address' && <AddressPage onBack={() => setActiveTab('settings')} />}
                {activeTab === 'paymentMethods' && <PaymentMethodsPage onBack={() => setActiveTab('settings')} />}
                {activeTab === 'notifications' && <NotificationsPage onBack={() => setActiveTab('settings')} />}


                {/* Fallback for Footer Pages */}
                {!['home', 'shop', 'cart', 'wishlist', 'profile', 'orders', 'settings', 'editProfile', 'changePassword', 'address', 'paymentMethods', 'notifications', 'productDetails'].includes(activeTab) && (
                    <InfoPage
                        title={activeTab}
                        content={PAGE_CONTENT[activeTab] || `Content for ${activeTab} is coming soon.`}
                        onBack={() => setActiveTab('home')}
                    />
                )}
            </View>
            <BottomNav activeTab={activeTab} onTabChange={setActiveTab} cartCount={cartLines.length} />
        </View>
    );
};
