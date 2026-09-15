import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, Alert, 
    ActivityIndicator, Image, StatusBar, Platform, RefreshControl, Dimensions, BackHandler 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const AM_LOGO = require('../../assets/am_logo.png');

// ─── IMPORT ALL 26 ADMIN SCREENS & AI COPILOT ─────────────────────────────────
import { AdminProducts } from './admin/AdminProducts';
import { AdminVendors } from './admin/AdminVendors';
import { AdminUsers } from './admin/AdminUsers';
import { AdminBanners } from './admin/AdminBanners';
import { AdminSettings } from './admin/AdminSettings';
import { AdminCategories } from './admin/AdminCategories';
import { AdminOrders } from './admin/AdminOrders';
import { AdminAnalytics } from './admin/AdminAnalytics';
import { AdminFinancials } from './admin/AdminFinancials';
import { AdminCoupons } from './admin/AdminCoupons';
import { AdminFlashSales } from './admin/AdminFlashSales';
import { AdminBrands } from './admin/AdminBrands';
import { AdminPromoBanners } from './admin/AdminPromoBanners';
import { AdminPayouts } from './admin/AdminPayouts';
import { AdminBroadcast } from './admin/AdminBroadcast';
import { AdminReferrals } from './admin/AdminReferrals';
import { AdminAuditLogs } from './admin/AdminAuditLogs';
import { AdminInvoices } from './admin/AdminInvoices';
import { AdminAbandonedCarts } from './admin/AdminAbandonedCarts';
import { AdminSupport } from './admin/AdminSupport';
import { AdminDisputes } from './admin/AdminDisputes';
import { AdminReviews } from './admin/AdminReviews';
import { AdminCMS } from './admin/AdminCMS';
import { AdminHomeSettings } from './admin/AdminHomeSettings';
import { AdminAIAssistantModal } from '../components/AdminAIAssistantModal';
import { VendorStoreProfile } from './VendorStoreProfile';

// ─── NAVY & GOLD LIGHT PALETTE ───────────────────────────────────────────────
const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

// Top Quick Pill Tabs
const QUICK_TABS = [
    { id: 'overview', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
    { id: 'store_profile', label: 'Official Store', icon: 'storefront-outline', activeIcon: 'storefront' },
    { id: 'orders', label: 'Orders', icon: 'cart-outline', activeIcon: 'cart' },
    { id: 'products', label: 'Products', icon: 'cube-outline', activeIcon: 'cube' },
    { id: 'vendors', label: 'Vendors', icon: 'storefront-outline', activeIcon: 'storefront' },
    { id: 'users', label: 'Customers', icon: 'people-outline', activeIcon: 'people' },
    { id: 'financials', label: 'Financials', icon: 'cash-outline', activeIcon: 'cash' },
    { id: 'analytics', label: 'Analytics', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
    { id: 'banners', label: 'Banners', icon: 'images-outline', activeIcon: 'images' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
];

// All Admin Modules Organized into Logical Categories
const MODULE_SECTIONS = [
    {
        title: 'Commerce & Catalog',
        items: [
            { id: 'store_profile', title: 'Official Store Profile', desc: 'Cover banner, store name, logo & bio', icon: 'storefront-outline', color: '#D97706', bg: '#FFFBEB' },
            { id: 'products', title: 'Products', desc: 'Manage inventory & catalog', icon: 'cube-outline', color: '#9333EA', bg: '#F3E8FF' },
            { id: 'orders', title: 'Orders', desc: 'Track sales & fulfillments', icon: 'cart-outline', color: '#2563EB', bg: '#EFF6FF' },
            { id: 'categories', title: 'Categories', desc: 'Store product taxonomy', icon: 'grid-outline', color: '#059669', bg: '#ECFDF5' },
            { id: 'brands', title: 'Official Brands', desc: 'Verified partner stores', icon: 'pricetag-outline', color: '#D97706', bg: '#FFFBEB' },
            { id: 'invoices', title: 'Invoices & Receipts', desc: 'Generate & email receipts', icon: 'receipt-outline', color: '#4F46E5', bg: '#EEF2FF' },
            { id: 'abandoned_carts', title: 'Abandoned Carts', desc: 'Recover lost checkouts', icon: 'basket-outline', color: '#DC2626', bg: '#FEF2F2' },
        ]
    },
    {
        title: 'Stakeholders & Users',
        items: [
            { id: 'users', title: 'Customers', desc: 'Accounts, tiers & wallets', icon: 'people-outline', color: '#059669', bg: '#ECFDF5' },
            { id: 'vendors', title: 'Vendors', desc: 'Merchant stores & approvals', icon: 'storefront-outline', color: '#2563EB', bg: '#EFF6FF' },
            { id: 'payouts', title: 'Payouts', desc: 'Vendor & driver payouts', icon: 'wallet-outline', color: '#D97706', bg: '#FFFBEB' },
            { id: 'referrals', title: 'Referrals & Rewards', desc: 'Ambassadors & loyalty coins', icon: 'gift-outline', color: '#7C3AED', bg: '#F5F3FF' },
        ]
    },
    {
        title: 'Marketing & Promotions',
        items: [
            { id: 'banners', title: 'Home Banners', desc: 'Hero carousel & promo cards', icon: 'images-outline', color: '#D97706', bg: '#FFFBEB' },
            { id: 'promo_banners', title: 'AI Promo Banners', desc: 'Generate copy with Gemini AI', icon: 'sparkles-outline', color: '#9333EA', bg: '#F3E8FF' },
            { id: 'flash_sales', title: 'Flash Sales', desc: 'Timed discount campaigns', icon: 'flash-outline', color: '#DC2626', bg: '#FEF2F2' },
            { id: 'coupons', title: 'Coupons', desc: 'Discount codes & promotions', icon: 'ticket-outline', color: '#059669', bg: '#ECFDF5' },
            { id: 'broadcast', title: 'Broadcast Alerts', desc: 'Send global push alerts', icon: 'megaphone-outline', color: '#2563EB', bg: '#EFF6FF' },
        ]
    },
    {
        title: 'Finance & Intelligence',
        items: [
            { id: 'analytics', title: 'Intelligence HUD', desc: 'Real-time analytics & KPIs', icon: 'stats-chart-outline', color: '#2563EB', bg: '#EFF6FF' },
            { id: 'financials', title: 'Financials', desc: 'Revenue breakdown & profits', icon: 'cash-outline', color: '#16A34A', bg: '#DCFCE7' },
            { id: 'audit_logs', title: 'Audit Logs', desc: 'Security records & CSV export', icon: 'shield-checkmark-outline', color: '#475569', bg: '#F1F5F9' },
        ]
    },
    {
        title: 'Care & Moderation',
        items: [
            { id: 'support', title: 'Helpdesk & Support', desc: 'Customer tickets & WhatsApp', icon: 'chatbubbles-outline', color: '#2563EB', bg: '#EFF6FF' },
            { id: 'disputes', title: 'Disputes', desc: 'Mediate customer disputes', icon: 'warning-outline', color: '#D97706', bg: '#FFFBEB' },
            { id: 'reviews', title: 'Reviews & Ratings', desc: 'Product & driver feedback', icon: 'star-outline', color: '#F59E0B', bg: '#FEF3C7' },
        ]
    },
    {
        title: 'Platform & Settings',
        items: [
            { id: 'home_settings', title: 'Home Customizer', desc: 'Configure mobile home screen', icon: 'home-outline', color: '#4F46E5', bg: '#EEF2FF' },
            { id: 'cms', title: 'Content Pages (CMS)', desc: 'About, Terms, Privacy, FAQ', icon: 'document-text-outline', color: '#475569', bg: '#F1F5F9' },
            { id: 'settings', title: 'Platform Settings', desc: 'Shipping, APIs, gateways', icon: 'settings-outline', color: '#0E1A2E', bg: '#F8FAFC' },
        ]
    }
];

export const AdminDashboard = ({ user, onLogout, navigation }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);

    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalProducts: 0,
        activeProducts: 0,
        totalOrders: 0,
        pendingOrders: 0,
        totalUsers: 0,
        totalVendors: 0,
        totalBanners: 0,
        lowStockCount: 0
    });

    const [recentOrders, setRecentOrders] = useState([]);
    const [recentProducts, setRecentProducts] = useState([]);

    const handleBackToHome = useCallback(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@abumafhal_last_screen', 'Main');
                if (window.location.hash === '#admin' || window.location.hash === 'admin') {
                    window.location.hash = '';
                }
            }
        } catch (_) {}
        if (navigation && navigation.navigate) {
            navigation.navigate('Main', { screen: 'home' });
        }
    }, [navigation]);

    // Hardware Back Button on Android
    useEffect(() => {
        const onBackPress = () => {
            if (activeTab !== 'overview') {
                setActiveTab('overview');
                return true;
            }
            handleBackToHome();
            return true;
        };

        const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => sub.remove();
    }, [activeTab, handleBackToHome]);

    useEffect(() => {
        fetchAdminData();
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@abumafhal_last_screen', 'AdminDashboard');
                if (window.location.hash !== '#admin') {
                    window.location.hash = 'admin';
                }
            }
        } catch (_) {}
    }, []);

    const fetchAdminData = async () => {
        try {
            const [productsRes, ordersRes, profilesRes, bannersRes] = await Promise.allSettled([
                supabase
                    .from('products')
                    .select('id, name, price, stock, stock_quantity, images, image_url, status, is_active, created_at')
                    .neq('status', 'archived')
                    .order('created_at', { ascending: false })
                    .limit(100),
                supabase
                    .from('orders')
                    .select('id, total_amount, status, created_at, user:profiles(full_name, email)')
                    .order('created_at', { ascending: false })
                    .limit(50),
                supabase
                    .from('profiles')
                    .select('id, role, status')
                    .limit(500),
                supabase
                    .from('banners')
                    .select('id, is_active')
                    .limit(50)
            ]);

            const prods = productsRes.status === 'fulfilled' && productsRes.value.data ? productsRes.value.data : [];
            const totalProducts = prods.length;
            const activeProducts = prods.filter(p => p.is_active !== false && p.status !== 'rejected').length;
            const lowStockCount = prods.filter(p => (p.stock_quantity ?? p.stock ?? 0) < 5).length;

            const ordersList = ordersRes.status === 'fulfilled' && ordersRes.value.data ? ordersRes.value.data : [];
            const totalOrders = ordersList.length;
            const pendingOrders = ordersList.filter(o => o.status === 'pending' || o.status === 'processing').length;
            const totalRevenue = ordersList.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

            const profs = profilesRes.status === 'fulfilled' && profilesRes.value.data ? profilesRes.value.data : [];
            const totalUsers = profs.length;
            const totalVendors = profs.filter(u => u.role === 'vendor').length;

            const bannersList = bannersRes.status === 'fulfilled' && bannersRes.value.data ? bannersRes.value.data : [];
            const totalBanners = bannersList.filter(b => b.is_active !== false).length;

            setStats({
                totalRevenue,
                totalProducts,
                activeProducts,
                totalOrders,
                pendingOrders,
                totalUsers,
                totalVendors,
                totalBanners,
                lowStockCount
            });

            setRecentOrders(ordersList.slice(0, 5));
            setRecentProducts(prods.slice(0, 5));

        } catch (e) {
            console.error("Admin Dashboard Fetch error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAdminData();
    };

    const handleLogoutPrompt = () => {
        if (Platform.OS === 'web') {
            const confirmed = typeof window !== 'undefined' ? window.confirm('Are you sure you want to log out of the Admin Console?') : true;
            if (confirmed && typeof onLogout === 'function') {
                onLogout();
            }
        } else {
            Alert.alert(
                'Log Out',
                'Are you sure you want to log out of the Admin Console?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                        text: 'Log Out', 
                        style: 'destructive',
                        onPress: () => {
                            if (typeof onLogout === 'function') onLogout();
                        }
                    }
                ]
            );
        }
    };

    const formatNaira = (amount) => {
        return '₦' + Number(amount || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
    };

    const adminName = user?.user_metadata?.full_name || user?.full_name || user?.email?.split('@')[0] || 'Admin';

    // ─── OVERVIEW COMPONENT ───────────────────────────────────────────────────
    const renderOverview = () => {
        if (loading) {
            return (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={{ marginTop: 12, fontSize: 13, fontWeight: '700', color: '#64748B' }}>
                        Loading live admin data...
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView 
                contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[GOLD, NAVY]} />
                }
            >
                {/* WELCOME HERO BANNER */}
                <LinearGradient
                    colors={[NAVY, '#162235']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        borderRadius: 22,
                        padding: 18,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(217, 167, 58, 0.35)',
                        shadowColor: NAVY,
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.12,
                        shadowRadius: 10,
                        elevation: 3
                    }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <View style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                gap: 6, 
                                backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                                paddingHorizontal: 8, 
                                paddingVertical: 3, 
                                borderRadius: 8, 
                                alignSelf: 'flex-start',
                                marginBottom: 8
                            }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                                <Text style={{ color: '#10B981', fontSize: 9.5, fontWeight: '800' }}>
                                    STORE OPERATIONAL (LIVE)
                                </Text>
                            </View>

                            <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 }}>
                                Welcome back, {adminName}! 👋
                            </Text>

                            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600', marginTop: 4 }}>
                                Abu Mafhal Mobile Command Center.
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity 
                                onPress={() => setShowAiModal(true)}
                                style={{ 
                                    width: 36, 
                                    height: 36, 
                                    borderRadius: 12, 
                                    backgroundColor: 'rgba(217, 167, 58, 0.2)', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: GOLD
                                }}
                            >
                                <Ionicons name="sparkles" size={17} color={GOLD} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={handleRefresh}
                                style={{ 
                                    width: 36, 
                                    height: 36, 
                                    borderRadius: 12, 
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255, 255, 255, 0.15)'
                                }}
                            >
                                <Ionicons name="refresh" size={17} color={GOLD} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Revenue strip inside Hero */}
                    <View style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: 'rgba(255, 255, 255, 0.1)',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <View>
                            <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '700' }}>Total Gross Revenue</Text>
                            <Text style={{ color: GOLD, fontSize: 18, fontWeight: '900', marginTop: 1 }}>{formatNaira(stats.totalRevenue)}</Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => setActiveTab('financials')}
                            style={{
                                backgroundColor: 'rgba(217, 167, 58, 0.15)',
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: 'rgba(217, 167, 58, 0.3)'
                            }}
                        >
                            <Text style={{ color: GOLD, fontSize: 10.5, fontWeight: '800' }}>Financials →</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* 4 CORE KPI METRICS */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    {/* Orders */}
                    <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={() => setActiveTab('orders')}
                        style={{
                            flex: 1,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 18,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            shadowColor: NAVY,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Orders</Text>
                            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="cart" size={15} color="#2563EB" />
                            </View>
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: NAVY }}>{stats.totalOrders}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706', marginTop: 2 }}>
                            {stats.pendingOrders} Pending
                        </Text>
                    </TouchableOpacity>

                    {/* Products */}
                    <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={() => setActiveTab('products')}
                        style={{
                            flex: 1,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 18,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            shadowColor: NAVY,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Products</Text>
                            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="cube" size={15} color="#9333EA" />
                            </View>
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: NAVY }}>{stats.totalProducts}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#16A34A', marginTop: 2 }}>
                            {stats.activeProducts} Active
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                    {/* Vendors */}
                    <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={() => setActiveTab('vendors')}
                        style={{
                            flex: 1,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 18,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            shadowColor: NAVY,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Vendors</Text>
                            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="storefront" size={15} color={GOLD} />
                            </View>
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: NAVY }}>{stats.totalVendors}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: GOLD, marginTop: 2 }}>
                            Active Stores
                        </Text>
                    </TouchableOpacity>

                    {/* Users */}
                    <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={() => setActiveTab('users')}
                        style={{
                            flex: 1,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 18,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            shadowColor: NAVY,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Customers</Text>
                            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="people" size={15} color="#059669" />
                            </View>
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: NAVY }}>{stats.totalUsers}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669', marginTop: 2 }}>
                            Registered Users
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* COMPREHENSIVE MODULAR GRID OF ALL 26 ADMIN CAPABILITIES */}
                {MODULE_SECTIONS.map((section, sIndex) => (
                    <View key={sIndex} style={{ marginBottom: 18 }}>
                        <Text style={{
                            fontSize: 12,
                            fontWeight: '900',
                            color: NAVY,
                            marginBottom: 10,
                            letterSpacing: 0.3,
                            paddingLeft: 4
                        }}>
                            {section.title}
                        </Text>

                        <View style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 20,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            shadowColor: NAVY,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1
                        }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                {section.items.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => setActiveTab(item.id)}
                                        activeOpacity={0.7}
                                        style={{
                                            width: '48%',
                                            backgroundColor: '#F8FAFC',
                                            borderRadius: 14,
                                            padding: 12,
                                            marginBottom: 8,
                                            borderWidth: 1,
                                            borderColor: '#F1F5F9',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 10
                                        }}
                                    >
                                        <View style={{
                                             width: 38,
                                            height: 38,
                                            borderRadius: 11,
                                            backgroundColor: item.bg,
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Ionicons name={item.icon} size={18} color={item.color} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: NAVY }}>
                                                {item.title}
                                            </Text>
                                            <Text numberOfLines={1} style={{ fontSize: 9.5, color: '#64748B', marginTop: 1 }}>
                                                {item.desc}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                ))}

                {/* RECENT ORDERS PREVIEW */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: NAVY }}>
                            Recent Orders
                        </Text>
                        <TouchableOpacity onPress={() => setActiveTab('orders')}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: GOLD }}>View All →</Text>
                        </TouchableOpacity>
                    </View>

                    {recentOrders.length === 0 ? (
                        <Text style={{ color: '#94A3B8', fontSize: 11, textAlign: 'center', paddingVertical: 14 }}>
                            No orders placed yet.
                        </Text>
                    ) : (
                        recentOrders.map((ord) => (
                            <View 
                                key={ord.id} 
                                style={{ 
                                    flexDirection: 'row', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    paddingVertical: 10, 
                                    borderBottomWidth: 1, 
                                    borderBottomColor: '#F1F5F9' 
                                }}
                            >
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: NAVY }}>
                                        #{ord.id.slice(0, 8)}
                                    </Text>
                                    <Text style={{ fontSize: 10.5, color: '#64748B', marginTop: 1 }}>
                                        {ord.user?.full_name || ord.user?.email || 'Customer'}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 12.5, fontWeight: '900', color: NAVY }}>
                                        {formatNaira(ord.total_amount)}
                                    </Text>
                                    <View style={{
                                        backgroundColor: ord.status === 'delivered' ? '#DCFCE7' : 'rgba(217, 167, 58, 0.15)',
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 6,
                                        marginTop: 3
                                    }}>
                                        <Text style={{
                                            fontSize: 9,
                                            fontWeight: '800',
                                            color: ord.status === 'delivered' ? '#166534' : GOLD,
                                            textTransform: 'uppercase'
                                        }}>
                                            {ord.status || 'pending'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* RECENT PRODUCTS */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: NAVY }}>
                            Recently Added Products
                        </Text>
                        <TouchableOpacity onPress={() => setActiveTab('products')}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: GOLD }}>View All →</Text>
                        </TouchableOpacity>
                    </View>

                    {recentProducts.length === 0 ? (
                        <Text style={{ color: '#94A3B8', fontSize: 11, textAlign: 'center', paddingVertical: 14 }}>
                            No products in store yet.
                        </Text>
                    ) : (
                        recentProducts.map((prod) => {
                            const img = prod.images?.[0] || prod.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100';
                            const stock = prod.stock_quantity ?? prod.stock ?? 0;
                            return (
                                <View 
                                    key={prod.id} 
                                    style={{ 
                                        flexDirection: 'row', 
                                        alignItems: 'center', 
                                        paddingVertical: 9, 
                                        borderBottomWidth: 1, 
                                        borderBottomColor: '#F1F5F9' 
                                    }}
                                >
                                    <Image 
                                        source={{ uri: img }} 
                                        style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#F8FAFC', marginRight: 12 }} 
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: NAVY }}>
                                            {prod.name}
                                        </Text>
                                        <Text style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>
                                            Stock: <Text style={{ fontWeight: '700', color: stock < 5 ? '#EF4444' : NAVY }}>{stock}</Text>
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 12, fontWeight: '900', color: NAVY }}>
                                        {formatNaira(prod.price)}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        );
    };

    // ─── TAB CONTENT SWITCHER (ALL 26 SCREENS HANDLED LIVE) ────────────────────
    const renderContent = () => {
        const handleBack = () => setActiveTab('overview');

        switch (activeTab) {
            // Commerce & Catalog
            case 'products':
                return <AdminProducts navigation={navigation} onBack={handleBack} />;
            case 'orders':
                return <AdminOrders navigation={navigation} onBack={handleBack} />;
            case 'categories':
                return <AdminCategories navigation={navigation} onBack={handleBack} />;
            case 'brands':
                return <AdminBrands navigation={navigation} onBack={handleBack} />;
            case 'invoices':
                return <AdminInvoices navigation={navigation} onBack={handleBack} />;
            case 'abandoned_carts':
                return <AdminAbandonedCarts navigation={navigation} onBack={handleBack} />;

            // Stakeholders & Users
            case 'users':
                return <AdminUsers navigation={navigation} onBack={handleBack} />;
            case 'vendors':
                return <AdminVendors navigation={navigation} onBack={handleBack} />;
            case 'payouts':
                return <AdminPayouts navigation={navigation} onBack={handleBack} />;
            case 'referrals':
                return <AdminReferrals navigation={navigation} onBack={handleBack} />;

            // Marketing & Promotions
            case 'banners':
                return <AdminBanners navigation={navigation} onBack={handleBack} />;
            case 'promo_banners':
                return <AdminPromoBanners navigation={navigation} onBack={handleBack} />;
            case 'flash_sales':
                return <AdminFlashSales navigation={navigation} onBack={handleBack} />;
            case 'coupons':
                return <AdminCoupons navigation={navigation} onBack={handleBack} />;
            case 'broadcast':
                return <AdminBroadcast navigation={navigation} onBack={handleBack} />;

            // Finance & Intelligence
            case 'analytics':
                return <AdminAnalytics navigation={navigation} onBack={handleBack} />;
            case 'financials':
                return <AdminFinancials navigation={navigation} onBack={handleBack} />;
            case 'audit_logs':
                return <AdminAuditLogs navigation={navigation} onBack={handleBack} />;

            // Care & Moderation
            case 'support':
                return <AdminSupport navigation={navigation} onBack={handleBack} />;
            case 'disputes':
                return <AdminDisputes navigation={navigation} onBack={handleBack} />;
            case 'reviews':
                return <AdminReviews navigation={navigation} onBack={handleBack} />;

            // Platform & Content
            case 'store_profile':
                return (
                    <VendorStoreProfile
                        user={user}
                        vendor={null}
                        isAdminStore={true}
                        onBack={handleBack}
                        onSaved={() => fetchAdminData()}
                    />
                );
            case 'home_settings':
                return <AdminHomeSettings navigation={navigation} onBack={handleBack} />;
            case 'cms':
                return <AdminCMS navigation={navigation} onBack={handleBack} />;
            case 'settings':
                return <AdminSettings navigation={navigation} onBack={handleBack} />;

            default:
                return renderOverview();
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="light-content" backgroundColor={NAVY} />

            {/* ── COMPACT TOP HEADER (NAVY & GOLD) ── */}
            <LinearGradient
                colors={[NAVY, '#162235']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ 
                    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 4 : (Platform.OS === 'ios' ? 44 : 8), 
                    paddingBottom: 6,
                    borderBottomWidth: 1,
                    borderColor: 'rgba(217, 167, 58, 0.25)'
                }}
            >
                {/* Brand & Actions Single Compact Row */}
                <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    paddingHorizontal: 12,
                    paddingBottom: 8
                }}>
                    {/* Left: Home/Back to buyer shop */}
                    {activeTab === 'overview' ? (
                        <TouchableOpacity
                            onPress={handleBackToHome}
                            activeOpacity={0.7}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: 'rgba(217, 167, 58, 0.18)',
                                paddingHorizontal: 9,
                                paddingVertical: 5,
                                borderRadius: 9,
                                borderWidth: 1,
                                borderColor: GOLD
                            }}
                        >
                            <Ionicons name="storefront-outline" size={13} color={GOLD} />
                            <Text style={{ color: GOLD, fontSize: 11, fontWeight: '800' }}>Store</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => setActiveTab('overview')}
                            activeOpacity={0.7}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                                paddingHorizontal: 9,
                                paddingVertical: 5,
                                borderRadius: 9,
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.2)'
                            }}
                        >
                            <Ionicons name="arrow-back" size={13} color="#FFFFFF" />
                            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Dashboard</Text>
                        </TouchableOpacity>
                    )}

                    {/* Middle: Brand Emblem & Title */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{
                            width: 26, 
                            height: 26, 
                            borderRadius: 7, 
                            backgroundColor: 'rgba(217, 167, 58, 0.15)', 
                            borderWidth: 1, 
                            borderColor: 'rgba(217, 167, 58, 0.35)', 
                            overflow: 'hidden',
                            alignItems: 'center', 
                            justifyContent: 'center',
                        }}>
                            <Image source={AM_LOGO} style={{ width: 18, height: 18 }} resizeMode="contain" />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.2 }}>
                            Abu Mafhal <Text style={{ color: GOLD }}>Admin</Text>
                        </Text>
                    </View>

                    {/* Right: AI Copilot & Logout */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity 
                            onPress={() => setShowAiModal(true)}
                            activeOpacity={0.7}
                            style={{ 
                                width: 30, 
                                height: 30, 
                                borderRadius: 8, 
                                backgroundColor: 'rgba(217, 167, 58, 0.15)', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(217, 167, 58, 0.3)'
                            }}
                            title="AI Copilot"
                        >
                            <Ionicons name="sparkles" size={14} color={GOLD} />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleLogoutPrompt}
                            activeOpacity={0.7}
                            style={{ 
                                width: 30, 
                                height: 30, 
                                borderRadius: 8, 
                                backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(239, 68, 68, 0.25)'
                            }}
                            title="Log Out"
                        >
                            <Ionicons name="log-out-outline" size={14} color="#F87171" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* HORIZONTAL QUICK PILL TABS */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={{ paddingHorizontal: 12, gap: 5, paddingBottom: 2 }}
                >
                    {QUICK_TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setActiveTab(tab.id)}
                                activeOpacity={0.7}
                                style={{ 
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    paddingHorizontal: 9, 
                                    paddingVertical: 4, 
                                    borderRadius: 9, 
                                    backgroundColor: isActive ? GOLD : 'rgba(255, 255, 255, 0.08)',
                                    borderWidth: 1, 
                                    borderColor: isActive ? GOLD : 'rgba(255, 255, 255, 0.12)'
                                }}
                            >
                                <Ionicons 
                                    name={isActive ? tab.activeIcon : tab.icon} 
                                    size={12} 
                                    color={isActive ? NAVY : '#FFFFFF'} 
                                />
                                <Text style={{ 
                                    color: isActive ? NAVY : '#FFFFFF', 
                                    fontSize: 10.5, 
                                    fontWeight: isActive ? '800' : '600' 
                                }}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </LinearGradient>




            {/* ── MAIN CONTENT AREA ── */}
            <View style={{ flex: 1 }}>
                {renderContent()}
            </View>

            {/* ── FLOATING AI ASSISTANT BUTTON ── */}
            <TouchableOpacity
                onPress={() => setShowAiModal(true)}
                activeOpacity={0.85}
                style={{
                    position: 'absolute',
                    bottom: 24,
                    right: 20,
                    backgroundColor: NAVY,
                    borderRadius: 28,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderWidth: 1.5,
                    borderColor: GOLD,
                    shadowColor: NAVY,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                    elevation: 5,
                    zIndex: 99
                }}
            >
                <Ionicons name="sparkles" size={18} color={GOLD} />
                <Text style={{ color: GOLD, fontWeight: '900', fontSize: 12.5, letterSpacing: 0.5 }}>
                    Admin AI Copilot
                </Text>
            </TouchableOpacity>

            {/* AI ASSISTANT MODAL */}
            <AdminAIAssistantModal
                visible={showAiModal}
                onClose={() => setShowAiModal(false)}
            />
        </View>
    );
};
