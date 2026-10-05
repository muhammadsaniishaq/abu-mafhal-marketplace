import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, Alert, 
    ActivityIndicator, Image, StatusBar, Platform, RefreshControl, Dimensions, BackHandler,
    Modal, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { AdminShippingManagement } from './admin/AdminShippingManagement';
import { AdminAIAssistantModal } from '../components/AdminAIAssistantModal';
import { VendorStoreProfile } from './VendorStoreProfile';

// ─── NAVY & GOLD LIGHT PALETTE ───────────────────────────────────────────────
const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';
// All Admin Modules Organized into Logical Categories
const MODULE_SECTIONS = [
    {
        title: 'Commerce & Catalog',
        items: [
            { id: 'store_profile', title: 'Main Store Profile', desc: 'Cover banner, store name & branding', icon: 'storefront-outline', color: '#D97706', bg: '#FFFBEB' },
            { id: 'products', title: 'Products', desc: 'Manage catalog inventory and status', icon: 'cube-outline', color: '#9333EA', bg: '#F3E8FF' },
            { id: 'orders', title: 'Orders', desc: 'Track sales, fulfillment & deliveries', icon: 'cart-outline', color: '#2563EB', bg: '#EFF6FF' },
            { id: 'categories', title: 'Categories', desc: 'Product taxonomy & classifications', icon: 'grid-outline', color: '#059669', bg: '#ECFDF5' },
            { id: 'brands', title: 'Featured Brands', desc: 'Verified manufacturer brands', icon: 'pricetag-outline', color: '#D97706', bg: '#FFFBEB' },
            { id: 'invoices', title: 'Invoices & Receipts', desc: 'Generate and send invoices to customers', icon: 'receipt-outline', color: '#4F46E5', bg: '#EEF2FF' },
            { id: 'abandoned_carts', title: 'Abandoned Carts', desc: 'Unfinished orders and dropped carts', icon: 'basket-outline', color: '#DC2626', bg: '#FEF2F2' },
        ]
    },
    {
        title: 'Users & Relationships',
        items: [
            { id: 'users', title: 'Customers', desc: 'User accounts, wallets & activity', icon: 'people-outline', color: '#059669', bg: '#ECFDF5' },
            { id: 'vendors', title: 'Vendors', desc: 'Merchant stores & verifications', icon: 'storefront-outline', color: '#2563EB', bg: '#EFF6FF' },
            { id: 'payouts', title: 'Vendor Payouts', desc: 'Settlements for vendors & riders', icon: 'wallet-outline', color: '#D97706', bg: '#FFFBEB' },
            { id: 'referrals', title: 'Referrals & Rewards', desc: 'Affiliates and reward point programs', icon: 'gift-outline', color: '#7C3AED', bg: '#F5F3FF' },
        ]
    },
    {
        title: 'Marketing & Promotions',
        items: [
            { id: 'banners', title: 'Homepage Banners', desc: 'Main hero slides & announcements', icon: 'images-outline', color: '#D97706', bg: '#FFFBEB' },
            { id: 'promo_banners', title: 'AI Promo Banners', desc: 'Generate marketing copy with Gemini AI', icon: 'sparkles-outline', color: '#9333EA', bg: '#F3E8FF' },
            { id: 'flash_sales', title: 'Flash Sales', desc: 'Time-limited discounted deals', icon: 'flash-outline', color: '#DC2626', bg: '#FEF2F2' },
            { id: 'coupons', title: 'Discount Coupons', desc: 'Promo codes & percentage vouchers', icon: 'ticket-outline', color: '#059669', bg: '#ECFDF5' },
            { id: 'broadcast', title: 'Push Notifications', desc: 'Broadcast notifications to all devices', icon: 'megaphone-outline', color: '#2563EB', bg: '#EFF6FF' },
        ]
    },
    {
        title: 'Financials & Intelligence',
        items: [
            { id: 'analytics', title: 'Analytics Center', desc: 'Real-time performance metrics & charts', icon: 'stats-chart-outline', color: '#2563EB', bg: '#EFF6FF' },
            { id: 'financials', title: 'Revenue & Profit', desc: 'Platform gross revenue & net commission', icon: 'cash-outline', color: '#16A34A', bg: '#DCFCE7' },
            { id: 'audit_logs', title: 'Audit & Security Logs', desc: 'Security audit trail & CSV exports', icon: 'shield-checkmark-outline', color: '#475569', bg: '#F1F5F9' },
        ]
    },
    {
        title: 'Support & Resolution',
        items: [
            { id: 'support', title: 'Customer Support', desc: 'Tickets, inquiries & WhatsApp desk', icon: 'chatbubbles-outline', color: '#2563EB', bg: '#EFF6FF' },
            { id: 'disputes', title: 'Dispute Resolution', desc: 'Buyer and vendor dispute settlements', icon: 'warning-outline', color: '#D97706', bg: '#FFFBEB' },
            { id: 'reviews', title: 'Reviews & Feedback', desc: 'Product and driver ratings & reviews', icon: 'star-outline', color: '#F59E0B', bg: '#FEF3C7' },
        ]
    },
    {
        title: 'Platform Settings & Governance',
        items: [
            { id: 'shipping', title: 'Shipping & Distance Rates', desc: 'GPS routing, base fee, per-km rates & zones', icon: 'car-outline', color: '#0284C7', bg: '#F0F9FF' },
            { id: 'home_settings', title: 'Homepage Layout', desc: 'Configure homepage sections and widgets', icon: 'home-outline', color: '#4F46E5', bg: '#EEF2FF' },
            { id: 'cms', title: 'CMS Pages', desc: 'About Us, Terms & Conditions, Privacy Policy', icon: 'document-text-outline', color: '#475569', bg: '#F1F5F9' },
            { id: 'settings', title: 'Global Platform Settings', desc: 'Shipping fees, app configs & payment gateways', icon: 'settings-outline', color: '#0E1A2E', bg: '#F8FAFC' },
        ]
    }
];

const getInitialAdminTab = (route) => {
    try {
        const paramTab = route?.params?.tab || route?.params?.screen;
        if (paramTab) return paramTab;

        if (typeof window !== 'undefined' && window.location) {
            const hash = window.location.hash || '';
            const match = hash.match(/[?&]tab=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) return match[1];

            const subMatch = hash.match(/#admin\/([a-zA-Z0-9_-]+)/);
            if (subMatch && subMatch[1]) return subMatch[1];

            const saved = window.localStorage?.getItem('@abumafhal_admin_tab');
            if (saved) return saved;
        }
    } catch (_) {}
    return 'overview';
};

export const AdminDashboard = ({ user, onLogout, navigation, route }) => {
    const [activeTab, _setActiveTab] = useState(() => getInitialAdminTab(route));

    const setActiveTab = useCallback((tabName) => {
        _setActiveTab(tabName);
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@abumafhal_admin_tab', tabName);
                const targetHash = tabName === 'overview' ? '#admin' : `#admin?tab=${tabName}`;
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', '/mobile' + targetHash);
                }
            }
            AsyncStorage.setItem('@abumafhal_admin_tab', tabName).catch(() => {});
        } catch (_) {}
    }, []);

    // Sync external navigation route params to tab
    useEffect(() => {
        const paramTab = route?.params?.tab || route?.params?.screen;
        if (paramTab && paramTab !== activeTab) {
            setActiveTab(paramTab);
        }
    }, [route?.params?.tab, route?.params?.screen]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarSearch, setSidebarSearch] = useState('');
    const [dashboardSearch, setDashboardSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalProducts: 0,
        activeProducts: 0,
        totalOrders: 0,
        pendingOrders: 0,
        totalUsers: 0,
        totalVendors: 0,
        totalBanners: 0,
        lowStockCount: 0,
        pssOrdersCount: 0,
        podOrdersCount: 0,
        podPendingAmount: 0,
        pssRemainingDebt: 0
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

        if (navigation) {
            if (typeof navigation.reset === 'function') {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main', params: { screen: 'home' } }]
                });
                return;
            }
            if (typeof navigation.navigate === 'function') {
                navigation.navigate('Main', { screen: 'home' });
                return;
            }
        }
        if (typeof window !== 'undefined') {
            window.location.hash = '';
            if (window.location.pathname.includes('admin')) {
                window.location.pathname = '/mobile';
            }
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
                const curHash = window.location.hash || '';
                if (!curHash.startsWith('#admin')) {
                    const targetHash = activeTab === 'overview' ? '#admin' : `#admin?tab=${activeTab}`;
                    if (window.history && window.history.replaceState) {
                        window.history.replaceState(null, '', '/mobile' + targetHash);
                    }
                }
            }
            AsyncStorage.setItem('@abumafhal_last_screen', 'AdminDashboard').catch(() => {});
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
                    .select('id, total_amount, status, payment_method, payment_status, installment_plan, created_at, user:profiles(full_name, email)')
                    .order('created_at', { ascending: false })
                    .limit(100),
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

            let pssOrdersCount = 0;
            let podOrdersCount = 0;
            let podPendingAmount = 0;
            let pssRemainingDebt = 0;

            ordersList.forEach(o => {
                const method = (o.payment_method || '').toLowerCase();
                const isPod = method.includes('delivery') || method.includes('pod') || method.includes('cod');
                const isPss = !!(o.installment_plan || method.includes('small') || method.includes('pss'));
                if (isPod) {
                    podOrdersCount++;
                    if (o.payment_status !== 'paid' && o.status !== 'delivered') {
                        podPendingAmount += Number(o.total_amount || 0);
                    }
                }
                if (isPss) {
                    pssOrdersCount++;
                    const plan = typeof o.installment_plan === 'string' ? (() => { try { return JSON.parse(o.installment_plan); } catch (_) { return null; } })() : o.installment_plan;
                    const rem = Number(plan?.remaining_balance || plan?.remainingAmount || 0);
                    pssRemainingDebt += rem > 0 ? rem : Math.round(Number(o.total_amount || 0) * 0.75);
                }
            });

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
                lowStockCount,
                pssOrdersCount,
                podOrdersCount,
                podPendingAmount,
                pssRemainingDebt
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
            const confirmed = typeof window !== 'undefined' ? window.confirm('Are you sure you want to log out of Admin Console?') : true;
            if (confirmed && typeof onLogout === 'function') {
                onLogout();
            }
        } else {
            Alert.alert(
                'Log Out Admin',
                'Are you sure you want to log out of Admin Console?',
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
                        Loading admin overview...
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
                                    MARKETPLACE ACTIVE (LIVE)
                                </Text>
                            </View>

                            <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 }}>
                                Welcome back, {adminName}! 👋
                            </Text>

                            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600', marginTop: 4 }}>
                                Abu Mafhal Marketplace Operations Center.
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

                {/* ── INVENTORY RESTOCK RADAR (LOW STOCK WARNING) ── */}
                {stats.lowStockCount > 0 && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveTab('products')}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#FFFBEB',
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            marginBottom: 12,
                            borderWidth: 1,
                            borderColor: '#FDE68A'
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <Ionicons name="warning" size={18} color="#D97706" />
                            <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#92400E' }} numberOfLines={1}>
                                {stats.lowStockCount} Products Running Low On Stock (&lt; 5 items)
                            </Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#B45309' }}>Restock →</Text>
                    </TouchableOpacity>
                )}

                {/* ── PSS (BNPL) & POD LIQUIDITY CARDS ── */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    {/* PSS Card */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveTab('orders')}
                        style={{
                            flex: 1,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 18,
                            padding: 13,
                            borderWidth: 1,
                            borderColor: '#FDE68A',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.03,
                            shadowRadius: 5,
                            elevation: 1
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#B45309' }}>0% BNPL / PSS</Text>
                            </View>
                            <Ionicons name="card" size={14} color="#D97706" />
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Active Contracts</Text>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#0E1A2E', marginTop: 1 }}>
                            {stats.pssOrdersCount} Orders
                        </Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706', marginTop: 2 }}>
                            Due: ₦{stats.pssRemainingDebt.toLocaleString()}
                        </Text>
                    </TouchableOpacity>

                    {/* POD Card */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveTab('orders')}
                        style={{
                            flex: 1,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 18,
                            padding: 13,
                            borderWidth: 1,
                            borderColor: '#BFDBFE',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.03,
                            shadowRadius: 5,
                            elevation: 1
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#1D4ED8' }}>PAY ON DELIVERY</Text>
                            </View>
                            <Ionicons name="cash" size={14} color="#2563EB" />
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Doorstep Cash</Text>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#0E1A2E', marginTop: 1 }}>
                            {stats.podOrdersCount} Orders
                        </Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563EB', marginTop: 2 }}>
                            Pending: ₦{stats.podPendingAmount.toLocaleString()}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ── FAST ACTIONS & SHORTCUTS ── */}
                <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: NAVY, marginBottom: 8, letterSpacing: 0.3, paddingLeft: 2 }}>
                        ⚡ EXECUTIVE FAST ACTIONS
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
                        {[
                            { id: 'products', label: '+ Add Product', icon: 'add-circle', bg: '#0E1A2E', text: '#D9A73A', border: '#D9A73A' },
                            { id: 'orders', label: 'PSS / POD Hub', icon: 'cart', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
                            { id: 'coupons', label: 'New Voucher', icon: 'ticket', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
                            { id: 'broadcast', label: 'Push Broadcast', icon: 'megaphone', bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
                            { id: 'promo_banners', label: 'AI Studio', icon: 'sparkles', bg: '#F3E8FF', text: '#9333EA', border: '#E9D5FF' },
                            { id: 'shipping', label: 'Fleet & Dispatch', icon: 'car', bg: '#F0F9FF', text: '#0284C7', border: '#BAE6FD' }
                        ].map((act) => (
                            <TouchableOpacity
                                key={act.id}
                                onPress={() => setActiveTab(act.id)}
                                activeOpacity={0.75}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    backgroundColor: act.bg,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: act.border
                                }}
                            >
                                <Ionicons name={act.icon} size={15} color={act.text} />
                                <Text style={{ fontSize: 11.5, fontWeight: '800', color: act.text }}>{act.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ── 4 CORE KPI METRICS ── */}
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
                            {stats.activeProducts} Live In Store
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
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
                            Active Accounts
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ── PLATFORM LIVE ENGINE DIAGNOSTICS BAR ── */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: '#E2E8F0'
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10B981' }} />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#0E1A2E' }}>Supabase: Live</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#3B82F6' }} />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#0E1A2E' }}>Fleet: Connected</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#D97706' }} />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#0E1A2E' }}>Paystack/POD: Ready</Text>
                    </View>
                </View>

                {/* ── VIP DISCOUNT COUPONS SHORTCUT BANNER ── */}
                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => setActiveTab('coupons')}
                    style={{
                        backgroundColor: '#065F46',
                        borderRadius: 18,
                        padding: 14,
                        marginBottom: 18,
                        borderWidth: 1,
                        borderColor: 'rgba(16, 185, 129, 0.4)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        shadowColor: '#059669',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 3
                    }}
                >
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(16, 185, 129, 0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                        <Ionicons name="ticket" size={22} color="#34D399" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' }} />
                            <Text style={{ color: '#34D399', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 }}>MARKETING TOOLS</Text>
                        </View>
                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>🎟️ Discount Coupons & Vouchers</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10.5, marginTop: 2 }}>Create promo codes, set % / fixed discounts & manage vouchers</Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(52, 211, 153, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.35)' }}>
                        <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '900' }}>Create →</Text>
                    </View>
                </TouchableOpacity>

                {/* ── INTERACTIVE MODULE DIRECTORY & FILTER BAR ── */}
                <View style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: NAVY, letterSpacing: 0.3, paddingLeft: 2 }}>
                            ADMIN DIRECTORY (26 MODULES)
                        </Text>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B' }}>
                            Tap to launch
                        </Text>
                    </View>

                    {/* Dashboard Search */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: '#E2E8F0'
                    }}>
                        <Ionicons name="search" size={15} color="#94A3B8" />
                        <TextInput
                            placeholder="Search 26 modules (Orders, Coupons, SEO...)..."
                            placeholderTextColor="#94A3B8"
                            value={dashboardSearch}
                            onChangeText={setDashboardSearch}
                            style={{ flex: 1, color: '#0E1A2E', fontSize: 12, padding: 0 }}
                        />
                        {dashboardSearch.length > 0 && (
                            <TouchableOpacity onPress={() => setDashboardSearch('')}>
                                <Ionicons name="close-circle" size={15} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Category Filter Pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
                        {[
                            { id: 'all', label: 'All (26)' },
                            { id: 'Commerce & Catalog', label: 'Commerce' },
                            { id: 'Users & Relationships', label: 'Users' },
                            { id: 'Marketing & Promotions', label: 'Marketing' },
                            { id: 'Financials & Intelligence', label: 'Financials' },
                            { id: 'Support & Resolution', label: 'Support' },
                            { id: 'Platform Settings & Governance', label: 'Settings' }
                        ].map((cat) => {
                            const isSel = selectedCategory === cat.id;
                            return (
                                <TouchableOpacity
                                    key={cat.id}
                                    onPress={() => setSelectedCategory(cat.id)}
                                    style={{
                                        paddingHorizontal: 11,
                                        paddingVertical: 5,
                                        borderRadius: 9,
                                        backgroundColor: isSel ? NAVY : '#FFFFFF',
                                        borderWidth: 1,
                                        borderColor: isSel ? GOLD : '#E2E8F0'
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 10.5,
                                        fontWeight: isSel ? '900' : '600',
                                        color: isSel ? GOLD : '#64748B'
                                    }}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* ── MODULAR GRID OF FILTERED MODULES ── */}
                {MODULE_SECTIONS
                    .filter(sec => selectedCategory === 'all' || sec.title === selectedCategory)
                    .map((section, sIndex) => {
                        const items = section.items.filter(item => 
                            !dashboardSearch ||
                            item.title.toLowerCase().includes(dashboardSearch.toLowerCase()) ||
                            item.desc.toLowerCase().includes(dashboardSearch.toLowerCase())
                        );

                        if (items.length === 0) return null;

                        return (
                            <View key={sIndex} style={{ marginBottom: 16 }}>
                                <Text style={{
                                    fontSize: 11.5,
                                    fontWeight: '900',
                                    color: NAVY,
                                    marginBottom: 8,
                                    letterSpacing: 0.3,
                                    paddingLeft: 4
                                }}>
                                    {section.title}
                                </Text>

                                <View style={{
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: 18,
                                    padding: 10,
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
                                    shadowColor: NAVY,
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.03,
                                    shadowRadius: 5,
                                    elevation: 1
                                }}>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                        {items.map((item) => {
                                            const isOrders = item.id === 'orders';
                                            return (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    onPress={() => setActiveTab(item.id)}
                                                    activeOpacity={0.7}
                                                    style={{
                                                        width: '48.5%',
                                                        backgroundColor: '#F8FAFC',
                                                        borderRadius: 13,
                                                        padding: 10,
                                                        marginBottom: 8,
                                                        borderWidth: 1,
                                                        borderColor: '#F1F5F9',
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        gap: 8
                                                    }}
                                                >
                                                    <View style={{
                                                        width: 34,
                                                        height: 34,
                                                        borderRadius: 10,
                                                        backgroundColor: item.bg,
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <Ionicons name={item.icon} size={16} color={item.color} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '800', color: NAVY, flex: 1 }}>
                                                                {item.title}
                                                            </Text>
                                                            {isOrders && (
                                                                <View style={{ backgroundColor: '#3B82F6', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 5 }}>
                                                                    <Text style={{ fontSize: 8, fontWeight: '900', color: 'white' }}>PSS</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <Text numberOfLines={1} style={{ fontSize: 9, color: '#64748B', marginTop: 1 }}>
                                                            {item.desc}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            </View>
                        );
                    })}

                {/* RECENT ORDERS PREVIEW */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: NAVY }}>
                            Recent Customer Orders
                        </Text>
                        <TouchableOpacity onPress={() => setActiveTab('orders')}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: GOLD }}>View All →</Text>
                        </TouchableOpacity>
                    </View>

                    {recentOrders.length === 0 ? (
                        <Text style={{ color: '#94A3B8', fontSize: 11, textAlign: 'center', paddingVertical: 14 }}>
                            No recent orders at the moment.
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
                            No products in catalog yet.
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
                                            Stock Remaining: <Text style={{ fontWeight: '700', color: stock < 5 ? '#EF4444' : NAVY }}>{stock}</Text>
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
            case 'shipping':
                return <AdminShippingManagement navigation={navigation} onBack={handleBack} />;

            default:
                return renderOverview();
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="light-content" backgroundColor={NAVY} />

            {/* ── SLEEK EXECUTIVE HEADER (TOP BAR PILLS REMOVED, MAXIMUM SCREEN REAL ESTATE) ── */}
            <LinearGradient
                colors={[NAVY, '#111D30']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ 
                    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : (Platform.OS === 'ios' ? 48 : 12), 
                    paddingBottom: 10,
                    paddingHorizontal: 14,
                    borderBottomWidth: 1,
                    borderColor: 'rgba(217, 167, 58, 0.25)'
                }}
            >
                <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    alignItems: 'center'
                }}>
                    {/* Left: Sidebar Menu Drawer Trigger + Back Navigation */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => setIsSidebarOpen(true)}
                            activeOpacity={0.75}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                backgroundColor: 'rgba(217, 167, 58, 0.18)',
                                paddingHorizontal: 11,
                                paddingVertical: 6.5,
                                borderRadius: 12,
                                borderWidth: 1.2,
                                borderColor: GOLD
                            }}
                        >
                            <Ionicons name="menu" size={17} color={GOLD} />
                            <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '900', letterSpacing: 0.3 }}>Menu</Text>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                        </TouchableOpacity>

                        {activeTab !== 'overview' && (
                            <TouchableOpacity
                                onPress={() => setActiveTab('overview')}
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    paddingHorizontal: 9,
                                    paddingVertical: 6.5,
                                    borderRadius: 11,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255, 255, 255, 0.15)'
                                }}
                            >
                                <Ionicons name="arrow-back" size={13} color="#FFFFFF" />
                                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Overview</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Middle: Active Title Indicator */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{
                            width: 26, 
                            height: 26, 
                            borderRadius: 8, 
                            backgroundColor: 'rgba(217, 167, 58, 0.15)', 
                            borderWidth: 1, 
                            borderColor: 'rgba(217, 167, 58, 0.35)', 
                            overflow: 'hidden',
                            alignItems: 'center', 
                            justifyContent: 'center',
                        }}>
                            <Image source={AM_LOGO} style={{ width: 18, height: 18 }} resizeMode="contain" />
                        </View>
                        <Text style={{ fontSize: 13.5, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.2 }} numberOfLines={1}>
                            {activeTab === 'overview' ? 'Command Center' : (activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('_', ' '))}
                        </Text>
                    </View>

                    {/* Right: AI Copilot, Shop Link, Logout */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity 
                            onPress={() => setShowAiModal(true)}
                            activeOpacity={0.7}
                            style={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: 9, 
                                backgroundColor: 'rgba(217, 167, 58, 0.15)', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(217, 167, 58, 0.35)'
                            }}
                            title="AI Copilot"
                        >
                            <Ionicons name="sparkles" size={15} color={GOLD} />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleBackToHome}
                            activeOpacity={0.7}
                            style={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: 9, 
                                backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.15)'
                            }}
                            title="Storefront"
                        >
                            <Ionicons name="storefront" size={14} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleLogoutPrompt}
                            activeOpacity={0.7}
                            style={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: 9, 
                                backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(239, 68, 68, 0.25)'
                            }}
                            title="Log Out"
                        >
                            <Ionicons name="log-out-outline" size={15} color="#F87171" />
                        </TouchableOpacity>
                    </View>
                </View>
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

            {/* ── MOBILE ADMIN EXECUTIVE SIDEBAR DRAWER ── */}
            <Modal
                visible={isSidebarOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsSidebarOpen(false)}
            >
                <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(5, 10, 20, 0.75)' }}>
                    {/* Drawer Content Panel */}
                    <View style={{
                        width: '84%',
                        maxWidth: 340,
                        backgroundColor: '#0A1220',
                        borderRightWidth: 1.5,
                        borderRightColor: 'rgba(217, 167, 58, 0.35)',
                        paddingTop: Platform.OS === 'ios' ? 48 : (StatusBar.currentHeight || 24) + 12,
                        paddingBottom: 20,
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Drawer Header */}
                        <View style={{ paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        backgroundColor: 'rgba(217, 167, 58, 0.15)',
                                        borderWidth: 1.5,
                                        borderColor: GOLD,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden'
                                    }}>
                                        <Image source={AM_LOGO} style={{ width: 24, height: 24 }} resizeMode="contain" />
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 }}>
                                            Abu Mafhal <Text style={{ color: GOLD }}>Admin</Text>
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                                            <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#10B981', letterSpacing: 0.5 }}>
                                                SUPER ADMIN ACTIVE
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setIsSidebarOpen(false)}
                                    activeOpacity={0.7}
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 9,
                                        backgroundColor: 'rgba(255,255,255,0.08)',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Ionicons name="close" size={18} color="#CBD5E1" />
                                </TouchableOpacity>
                            </View>

                            {/* Sidebar Quick Module Filter Input */}
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                backgroundColor: 'rgba(255,255,255,0.06)',
                                borderRadius: 10,
                                paddingHorizontal: 10,
                                paddingVertical: 7,
                                marginTop: 12,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.1)'
                            }}>
                                <Ionicons name="search" size={14} color="#94A3B8" />
                                <TextInput
                                    placeholder="Search 26+ admin modules..."
                                    placeholderTextColor="#64748B"
                                    value={sidebarSearch}
                                    onChangeText={setSidebarSearch}
                                    style={{ flex: 1, color: '#FFFFFF', fontSize: 12, padding: 0 }}
                                />
                                {sidebarSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setSidebarSearch('')}>
                                        <Ionicons name="close-circle" size={14} color="#94A3B8" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Navigation Module List */}
                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 14 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Overview / Home Dashboard Item */}
                            {(!sidebarSearch || 'overview dashboard summary'.includes(sidebarSearch.toLowerCase())) && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setActiveTab('overview');
                                        setIsSidebarOpen(false);
                                    }}
                                    activeOpacity={0.75}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                        borderRadius: 12,
                                        backgroundColor: activeTab === 'overview' ? 'rgba(217, 167, 58, 0.18)' : 'transparent',
                                        borderWidth: 1,
                                        borderColor: activeTab === 'overview' ? GOLD : 'transparent'
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <View style={{
                                            width: 30,
                                            height: 30,
                                            borderRadius: 8,
                                            backgroundColor: activeTab === 'overview' ? GOLD : 'rgba(255,255,255,0.08)',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Ionicons name="grid" size={16} color={activeTab === 'overview' ? NAVY : '#FFFFFF'} />
                                        </View>
                                        <View>
                                            <Text style={{
                                                fontSize: 13,
                                                fontWeight: '800',
                                                color: activeTab === 'overview' ? GOLD : '#FFFFFF'
                                            }}>
                                                Dashboard Overview
                                            </Text>
                                            <Text style={{ fontSize: 10.5, color: '#64748B' }}>
                                                KPIs, charts & live orders
                                            </Text>
                                        </View>
                                    </View>
                                    {activeTab === 'overview' && (
                                        <Ionicons name="chevron-forward" size={16} color={GOLD} />
                                    )}
                                </TouchableOpacity>
                            )}

                            {/* Categorized Module Sections */}
                            {MODULE_SECTIONS.map((sec) => {
                                const filteredItems = sec.items.filter(item => 
                                    !sidebarSearch ||
                                    item.title.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
                                    item.desc.toLowerCase().includes(sidebarSearch.toLowerCase())
                                );

                                if (filteredItems.length === 0) return null;

                                return (
                                    <View key={sec.title} style={{ gap: 4 }}>
                                        <Text style={{
                                            fontSize: 10,
                                            fontWeight: '800',
                                            color: '#94A3B8',
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.8,
                                            paddingHorizontal: 6,
                                            marginBottom: 2
                                        }}>
                                            {sec.title}
                                        </Text>

                                        {filteredItems.map((item) => {
                                            const isActive = activeTab === item.id;
                                            const isOrders = item.id === 'orders';
                                            return (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    onPress={() => {
                                                        setActiveTab(item.id);
                                                        setIsSidebarOpen(false);
                                                    }}
                                                    activeOpacity={0.75}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        paddingHorizontal: 10,
                                                        paddingVertical: 9,
                                                        borderRadius: 11,
                                                        backgroundColor: isActive ? 'rgba(217, 167, 58, 0.18)' : 'rgba(255,255,255,0.02)',
                                                        borderWidth: 1,
                                                        borderColor: isActive ? GOLD : 'rgba(255,255,255,0.05)'
                                                    }}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                                        <View style={{
                                                            width: 28,
                                                            height: 28,
                                                            borderRadius: 8,
                                                            backgroundColor: isActive ? GOLD : (item.bg || 'rgba(255,255,255,0.08)'),
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            <Ionicons 
                                                                name={item.icon || 'folder-outline'} 
                                                                size={14} 
                                                                color={isActive ? NAVY : (item.color || '#FFFFFF')} 
                                                            />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                                <Text style={{
                                                                    fontSize: 12.5,
                                                                    fontWeight: isActive ? '800' : '600',
                                                                    color: isActive ? GOLD : '#F1F5F9'
                                                                }} numberOfLines={1}>
                                                                    {item.title}
                                                                </Text>
                                                                {isOrders && (
                                                                    <View style={{
                                                                        backgroundColor: '#3B82F6',
                                                                        paddingHorizontal: 5,
                                                                        paddingVertical: 1,
                                                                        borderRadius: 6
                                                                    }}>
                                                                        <Text style={{ fontSize: 8.5, fontWeight: '900', color: 'white' }}>
                                                                            PSS / POD
                                                                        </Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <Text style={{ fontSize: 10, color: '#64748B' }} numberOfLines={1}>
                                                                {item.desc}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    {isActive && (
                                                        <Ionicons name="chevron-forward" size={14} color={GOLD} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                );
                            })}
                        </ScrollView>

                        {/* Drawer Bottom Actions */}
                        <View style={{
                            paddingHorizontal: 14,
                            paddingTop: 12,
                            borderTopWidth: 1,
                            borderTopColor: 'rgba(255,255,255,0.08)',
                            gap: 8
                        }}>
                            <TouchableOpacity
                                onPress={() => {
                                    setIsSidebarOpen(false);
                                    handleBackToHome();
                                }}
                                activeOpacity={0.75}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    backgroundColor: 'rgba(217, 167, 58, 0.15)',
                                    paddingVertical: 10,
                                    borderRadius: 11,
                                    borderWidth: 1,
                                    borderColor: 'rgba(217, 167, 58, 0.4)'
                                }}
                            >
                                <Ionicons name="storefront" size={15} color={GOLD} />
                                <Text style={{ color: GOLD, fontWeight: '800', fontSize: 12 }}>
                                    Back to Marketplace
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setIsSidebarOpen(false);
                                    handleLogoutPrompt();
                                }}
                                activeOpacity={0.75}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                    paddingVertical: 9,
                                    borderRadius: 11,
                                    borderWidth: 1,
                                    borderColor: 'rgba(239, 68, 68, 0.25)'
                                }}
                            >
                                <Ionicons name="log-out-outline" size={15} color="#F87171" />
                                <Text style={{ color: '#F87171', fontWeight: '700', fontSize: 11.5 }}>
                                    Sign Out Admin
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Touch Outside to Close Backdrop */}
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() => setIsSidebarOpen(false)}
                    />
                </View>
            </Modal>
        </View>
    );
};
