import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, Alert, 
    ActivityIndicator, Image, StatusBar, Platform, RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const AM_LOGO = require('../../assets/am_logo.png');

import { AdminProducts } from './admin/AdminProducts';
import { AdminVendors } from './admin/AdminVendors';
import { AdminUsers } from './admin/AdminUsers';
import { AdminBanners } from './admin/AdminBanners';
import { AdminSettings } from './admin/AdminSettings';
import { AdminCategories } from './admin/AdminCategories';

const CORE_TABS = [
    { id: 'overview', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
    { id: 'products', label: 'Kayayyaki', icon: 'cube-outline', activeIcon: 'cube' },
    { id: 'vendors', label: 'Yan Kasuwa', icon: 'storefront-outline', activeIcon: 'storefront' },
    { id: 'users', label: 'Masu Sayayya', icon: 'people-outline', activeIcon: 'people' },
    { id: 'banners', label: 'Tallace', icon: 'images-outline', activeIcon: 'images' },
    { id: 'settings', label: 'Saituna', icon: 'settings-outline', activeIcon: 'settings' },
];

export const AdminDashboard = ({ user, onLogout, navigation }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [stats, setStats] = useState({
        totalProducts: 0,
        activeProducts: 0,
        totalUsers: 0,
        totalVendors: 0,
        totalBuyers: 0,
        totalBanners: 0,
        lowStockCount: 0
    });

    const [recentProducts, setRecentProducts] = useState([]);
    const [recentVendors, setRecentVendors] = useState([]);

    useEffect(() => {
        fetchAdminData();
    }, []);

    const fetchAdminData = async () => {
        try {
            // 1. Products Query
            const { data: productsData } = await supabase
                .from('products')
                .select('id, name, price, stock, stock_quantity, images, image_url, status, is_active, created_at')
                .neq('status', 'archived')
                .order('created_at', { ascending: false });

            const prods = productsData || [];
            const totalProducts = prods.length;
            const activeProducts = prods.filter(p => p.is_active !== false && p.status !== 'rejected').length;
            const lowStockCount = prods.filter(p => (p.stock_quantity ?? p.stock ?? 0) < 5).length;

            // 2. Profiles Query
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, full_name, email, phone, role, status, suspended, business_name, created_at')
                .order('created_at', { ascending: false });

            const profs = profilesData || [];
            const totalUsers = profs.length;
            const vendorList = profs.filter(u => u.role === 'vendor');
            const totalVendors = vendorList.length;
            const totalBuyers = profs.filter(u => u.role !== 'vendor' && u.role !== 'admin').length;

            // 3. Banners Query
            const { data: bannersData } = await supabase
                .from('banners')
                .select('id, is_active');

            const totalBanners = (bannersData || []).filter(b => b.is_active !== false).length;

            setStats({
                totalProducts,
                activeProducts,
                totalUsers,
                totalVendors,
                totalBuyers,
                totalBanners,
                lowStockCount
            });

            setRecentProducts(prods.slice(0, 6));
            setRecentVendors(vendorList.slice(0, 5));

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
        Alert.alert(
            'Fita Daga Asusu',
            'Kana da tabbacin kana son fita daga sashen sarrafa kasuwa (Admin)?',
            [
                { text: 'A\'a (Cancel)', style: 'cancel' },
                { 
                    text: 'Fita (Logout)', 
                    style: 'destructive',
                    onPress: () => {
                        if (typeof onLogout === 'function') onLogout();
                    }
                }
            ]
        );
    };

    const formatNaira = (amount) => {
        return '₦' + Number(amount || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
    };

    const adminName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin';

    // ─── OVERVIEW COMPONENT ───────────────────────────────────────────────────
    const renderOverview = () => {
        if (loading) {
            return (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                    <ActivityIndicator size="large" color="#0E1A2E" />
                    <Text style={{ marginTop: 12, fontSize: 13, fontWeight: '700', color: '#64748B' }}>
                        Ana loda bayanan Admin...
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView 
                contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#D9A73A', '#0E1A2E']} />
                }
            >
                {/* WELCOME BANNER */}
                <LinearGradient
                    colors={['#0E1A2E', '#1A2F4C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        borderRadius: 22,
                        padding: 18,
                        marginBottom: 18,
                        borderWidth: 1,
                        borderColor: 'rgba(217, 167, 58, 0.35)',
                        shadowColor: '#0E1A2E',
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
                                    KASUWA TANA TAFIA LAFIYA (LIVE)
                                </Text>
                            </View>
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>
                                Barka da Aiki, {adminName}! 👋
                            </Text>
                            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600', marginTop: 4 }}>
                                Babban sashen sarrafa kasuwar Abu Mafhal a wayar hannu.
                            </Text>
                        </View>

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
                            <Ionicons name="refresh" size={17} color="#D9A73A" />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* 4 CORE KPI METRICS */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
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
                            shadowColor: '#0E1A2E',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Kayan Kasuwa</Text>
                            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="cube" size={15} color="#9333EA" />
                            </View>
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: '#0E1A2E' }}>{stats.totalProducts}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#16A34A', marginTop: 2 }}>
                            {stats.activeProducts} Masu Aiki
                        </Text>
                    </TouchableOpacity>

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
                            shadowColor: '#0E1A2E',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Yan Kasuwa</Text>
                            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="storefront" size={15} color="#2563EB" />
                            </View>
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: '#0E1A2E' }}>{stats.totalVendors}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563EB', marginTop: 2 }}>
                            Shagunan Kasuwa
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
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
                            shadowColor: '#0E1A2E',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Masu Sayayya</Text>
                            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="people" size={15} color="#059669" />
                            </View>
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: '#0E1A2E' }}>{stats.totalUsers}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669', marginTop: 2 }}>
                            {stats.totalBuyers} Abokan Ciniki
                        </Text>
                    </TouchableOpacity>

                    {/* Banners */}
                    <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={() => setActiveTab('banners')}
                        style={{
                            flex: 1,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 18,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            shadowColor: '#0E1A2E',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Tallace</Text>
                            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="images" size={15} color="#D97706" />
                            </View>
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: '#0E1A2E' }}>{stats.totalBanners}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706', marginTop: 2 }}>
                            Banners Masu Aiki
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* QUICK ACTION SHORTCUTS */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E', marginBottom: 14 }}>
                        Ayyukan Gaggawa (Quick Actions)
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <TouchableOpacity 
                            onPress={() => setActiveTab('products')} 
                            style={{ alignItems: 'center', width: '22%' }}
                            activeOpacity={0.7}
                        >
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                                <Ionicons name="cube" size={20} color="#9333EA" />
                            </View>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#0E1A2E', textAlign: 'center' }}>Kayayyaki</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveTab('vendors')} 
                            style={{ alignItems: 'center', width: '22%' }}
                            activeOpacity={0.7}
                        >
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                                <Ionicons name="storefront" size={20} color="#2563EB" />
                            </View>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#0E1A2E', textAlign: 'center' }}>Yan Kasuwa</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveTab('users')} 
                            style={{ alignItems: 'center', width: '22%' }}
                            activeOpacity={0.7}
                        >
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                                <Ionicons name="people" size={20} color="#059669" />
                            </View>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#0E1A2E', textAlign: 'center' }}>Masu Saye</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setActiveTab('settings')} 
                            style={{ alignItems: 'center', width: '22%' }}
                            activeOpacity={0.7}
                        >
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                                <Ionicons name="settings" size={20} color="#475569" />
                            </View>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#0E1A2E', textAlign: 'center' }}>Saituna</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* RECENT PRODUCTS */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>
                            Kayan Da Aka Saka Kwanan Nan
                        </Text>
                        <TouchableOpacity onPress={() => setActiveTab('products')}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#2563EB' }}>Duba Duka →</Text>
                        </TouchableOpacity>
                    </View>

                    {recentProducts.length === 0 ? (
                        <Text style={{ color: '#94A3B8', fontSize: 11, textAlign: 'center', paddingVertical: 16 }}>
                            Babu wani kaya a halin yanzu.
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
                                        paddingVertical: 10, 
                                        borderBottomWidth: 1, 
                                        borderBottomColor: '#F1F5F9' 
                                    }}
                                >
                                    <Image 
                                        source={{ uri: img }} 
                                        style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: '#F8FAFC', marginRight: 12 }} 
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: '#0E1A2E' }}>
                                            {prod.name}
                                        </Text>
                                        <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                                            Stock: <Text style={{ fontWeight: '700', color: stock < 5 ? '#EF4444' : '#0E1A2E' }}>{stock}</Text>
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 12, fontWeight: '900', color: '#0E1A2E' }}>
                                            {formatNaira(prod.price)}
                                        </Text>
                                        <View style={{ 
                                            backgroundColor: prod.is_active !== false ? '#DCFCE7' : '#F1F5F9', 
                                            paddingHorizontal: 6, 
                                            paddingVertical: 2, 
                                            borderRadius: 6, 
                                            marginTop: 3 
                                        }}>
                                            <Text style={{ 
                                                fontSize: 8.5, 
                                                fontWeight: '800', 
                                                color: prod.is_active !== false ? '#15803D' : '#64748B' 
                                            }}>
                                                {prod.is_active !== false ? 'Active' : 'Off'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* REGISTERED VENDORS LIST */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>
                            Dillalan Kasuwa (Vendors)
                        </Text>
                        <TouchableOpacity onPress={() => setActiveTab('vendors')}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#2563EB' }}>Duba Duka →</Text>
                        </TouchableOpacity>
                    </View>

                    {recentVendors.length === 0 ? (
                        <Text style={{ color: '#94A3B8', fontSize: 11, textAlign: 'center', paddingVertical: 16 }}>
                            Babu yan kasuwa da suka yi rajista tukuna.
                        </Text>
                    ) : (
                        recentVendors.map((v) => {
                            const name = v.business_name || v.full_name || 'Vendor Store';
                            const initial = name[0].toUpperCase();
                            return (
                                <View 
                                    key={v.id} 
                                    style={{ 
                                        flexDirection: 'row', 
                                        alignItems: 'center', 
                                        paddingVertical: 10, 
                                        borderBottomWidth: 1, 
                                        borderBottomColor: '#F1F5F9' 
                                    }}
                                >
                                    <View style={{ 
                                        width: 38, 
                                        height: 38, 
                                        borderRadius: 12, 
                                        backgroundColor: '#EFF6FF', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        marginRight: 12 
                                    }}>
                                        <Text style={{ fontSize: 14, fontWeight: '900', color: '#2563EB' }}>{initial}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: '#0E1A2E' }}>
                                            {name}
                                        </Text>
                                        <Text style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>
                                            {v.phone || v.email || 'Babu lamba'}
                                        </Text>
                                    </View>
                                    <View style={{ 
                                        backgroundColor: v.suspended ? '#FEE2E2' : '#DCFCE7', 
                                        paddingHorizontal: 8, 
                                        paddingVertical: 3, 
                                        borderRadius: 8 
                                    }}>
                                        <Text style={{ 
                                            fontSize: 9.5, 
                                            fontWeight: '800', 
                                            color: v.suspended ? '#B91C1C' : '#15803D' 
                                        }}>
                                            {v.suspended ? 'Suspended' : 'Active'}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        );
    };

    // ─── TAB CONTENT SWITCHER ────────────────────────────────────────────────
    const renderContent = () => {
        switch (activeTab) {
            case 'products':
                return <AdminProducts />;
            case 'vendors':
                return <AdminVendors />;
            case 'users':
                return <AdminUsers />;
            case 'banners':
                return <AdminBanners />;
            case 'settings':
                return <AdminSettings navigation={navigation} />;
            case 'categories':
                return <AdminCategories />;
            default:
                return renderOverview();
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="light-content" backgroundColor="#0E1A2E" />

            {/* ── TOP HEADER ── */}
            <LinearGradient
                colors={['#0E1A2E', '#162235']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ 
                    paddingTop: Platform.OS === 'ios' ? 48 : 38, 
                    paddingBottom: 10,
                    borderBottomWidth: 1,
                    borderColor: 'rgba(217, 167, 58, 0.25)'
                }}
            >
                {/* Brand & Actions */}
                <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    paddingHorizontal: 16,
                    marginBottom: 12
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{
                            width: 36, 
                            height: 36, 
                            borderRadius: 10,
                            backgroundColor: 'rgba(217, 167, 58, 0.12)',
                            borderWidth: 1, 
                            borderColor: 'rgba(217, 167, 58, 0.3)',
                            overflow: 'hidden',
                            alignItems: 'center', 
                            justifyContent: 'center',
                        }}>
                            <Image source={AM_LOGO} style={{ width: 30, height: 30 }} resizeMode="contain" />
                        </View>
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: 'white', letterSpacing: -0.3 }}>
                                Abu Mafhal <Text style={{ color: '#D9A73A' }}>Admin</Text>
                            </Text>
                            <Text style={{ fontSize: 8.5, color: '#94A3B8', fontWeight: '700', letterSpacing: 1 }}>
                                MOBILE CONSOLE
                            </Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {activeTab !== 'overview' && (
                            <TouchableOpacity
                                onPress={() => setActiveTab('overview')}
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    borderRadius: 10,
                                    backgroundColor: 'rgba(217, 167, 58, 0.15)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(217, 167, 58, 0.3)'
                                }}
                            >
                                <Text style={{ color: '#D9A73A', fontSize: 10, fontWeight: '800' }}>← Home</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity 
                            onPress={handleLogoutPrompt}
                            style={{ 
                                width: 34, 
                                height: 34, 
                                borderRadius: 10, 
                                backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(239, 68, 68, 0.25)'
                            }}
                            title="Fita"
                        >
                            <Ionicons name="log-out-outline" size={17} color="#F87171" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* HORIZONTAL PILL TABS */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                >
                    {CORE_TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setActiveTab(tab.id)}
                                activeOpacity={0.7}
                                style={{ 
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                    paddingHorizontal: 14, 
                                    paddingVertical: 6, 
                                    borderRadius: 12, 
                                    backgroundColor: isActive ? '#D9A73A' : 'rgba(255, 255, 255, 0.08)',
                                    borderWidth: 1,
                                    borderColor: isActive ? 'transparent' : 'rgba(255, 255, 255, 0.12)'
                                }}
                            >
                                <Ionicons 
                                    name={isActive ? tab.activeIcon : tab.icon} 
                                    size={13} 
                                    color={isActive ? '#0E1A2E' : '#FFFFFF'} 
                                />
                                <Text style={{ 
                                    color: isActive ? '#0E1A2E' : '#FFFFFF', 
                                    fontWeight: isActive ? '900' : '700', 
                                    fontSize: 11,
                                    letterSpacing: 0.2
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
        </View>
    );
};
