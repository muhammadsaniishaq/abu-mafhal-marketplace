import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Image, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const AM_LOGO = require('../../assets/am_logo.png');

import { AdminBanners } from './admin/AdminBanners';
import { AdminProducts } from './admin/AdminProducts';
import { AdminOrders } from './admin/AdminOrders';
import { AdminUsers } from './admin/AdminUsers';
import { AdminBroadcast } from './admin/AdminBroadcast';
import { AdminSupport } from './admin/AdminSupport';
import { AdminCoupons } from './admin/AdminCoupons';
import { AdminSettings } from './admin/AdminSettings';
import { AdminPayouts } from './admin/AdminPayouts';
import { AdminCategories } from './admin/AdminCategories';
import { AdminFlashSales } from './admin/AdminFlashSales';
import { AdminCMS } from './admin/AdminCMS';
import { AdminReviews } from './admin/AdminReviews';
import { AdminVendors } from './admin/AdminVendors';
import { AdminAnalytics } from './admin/AdminAnalytics';
import { AdminDisputes } from './admin/AdminDisputes';
import { AdminReferrals } from './admin/AdminReferrals';
import { AdminFinancials } from './admin/AdminFinancials';
import { AdminAuditLogs } from './admin/AdminAuditLogs';
import { AdminAbandonedCarts } from './admin/AdminAbandonedCarts';
import { AdminInvoices } from './admin/AdminInvoices';
import { AdminBrands } from './admin/AdminBrands';
import { AdminHomeSettings } from './admin/AdminHomeSettings';
import { AdminPromoBanners } from './admin/AdminPromoBanners';
import { AdminAIAssistantModal } from '../components/AdminAIAssistantModal';

// Helper Component for Stats (Modernized Theme Mapped with growth charts & indicators)
const PremiumStatCard = ({ label, value, icon, type, trend }) => {
    const isDark = type === 'dark';
    const isGold = type === 'gold';
    
    const bgColor = isDark ? '#0E1A2E' : isGold ? '#D9A73A' : '#FFFFFF';
    const textColor = isDark ? '#FFFFFF' : '#0E1A2E';
    const subColor = isDark ? '#94A3B8' : isGold ? 'rgba(14, 26, 46, 0.8)' : '#64748B';
    const iconColor = isDark ? '#D9A73A' : isGold ? '#0E1A2E' : '#D9A73A';
    const decorColor = isDark ? 'rgba(217, 167, 58, 0.06)' : isGold ? 'rgba(255, 255, 255, 0.15)' : 'rgba(14, 26, 46, 0.02)';
    const borderColor = isDark ? '#D9A73A40' : isGold ? 'transparent' : '#D9A73A15';

    return (
        <View style={{
            flex: 1,
            backgroundColor: bgColor,
            borderRadius: 22,
            padding: 16,
            overflow: 'hidden',
            height: 120,
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: borderColor,
            shadowColor: '#0E1A2E',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.04,
            shadowRadius: 10,
            elevation: 2,
        }}>
            {/* Concentric backdrop circles */}
            <View style={{ position: 'absolute', right: -20, top: -20, width: 90, height: 90, borderRadius: 45, backgroundColor: decorColor, borderWidth: 1, borderColor: isDark ? 'rgba(217,167,58,0.1)' : 'rgba(0,0,0,0.01)' }} />
            <View style={{ position: 'absolute', right: -10, top: -10, width: 70, height: 70, borderRadius: 35, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: isDark ? 'rgba(217,167,58,0.05)' : 'rgba(0,0,0,0.02)', borderStyle: 'dashed' }} />
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Ionicons name={icon} size={20} color={iconColor} />
                {trend && (
                    <View style={{ backgroundColor: isDark ? 'rgba(217,167,58,0.15)' : isGold ? 'rgba(14,26,46,0.1)' : 'rgba(16,185,129,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#D9A73A' : isGold ? '#0E1A2E' : '#10B981' }}>{trend}</Text>
                    </View>
                )}
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: subColor, fontSize: 9, fontWeight: '850', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 1 }}>{label}</Text>
                    <Text style={{ color: textColor, fontSize: 17, fontWeight: '900', letterSpacing: -0.5 }} numberOfLines={1}>{value}</Text>
                </View>
                
                {/* Micro Sparkline Visualizer */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 18, paddingBottom: 1, paddingLeft: 4 }}>
                    {[30, 45, 35, 60, 40, 75, 95].map((h, i) => (
                        <View 
                            key={i} 
                            style={{ 
                                width: 2.5, 
                                height: `${h}%`, 
                                backgroundColor: isDark ? '#D9A73A' : isGold ? '#0E1A2E' : '#10B981', 
                                borderRadius: 1.25,
                                opacity: 0.35 + (i * 0.1)
                            }} 
                        />
                    ))}
                </View>
            </View>
        </View>
    );
};

const TAB_CATEGORIES = [
    { id: 'dashboard', label: '📊 Dashboard', tabs: ['Overview', 'Analytics', 'Financials', 'Audit'] },
    { id: 'commerce', label: '💼 Commerce', tabs: ['Orders', 'Products', 'Categories', 'Brands', 'Flash', 'Carts', 'Invoices', 'Coupons'] },
    { id: 'partners', label: '👥 Partners', tabs: ['Vendors', 'Users', 'Payouts', 'Referrals'] },
    { id: 'system', label: '⚙️ Ecosystem', tabs: ['Home', 'Promos', 'Banners', 'Pages', 'Broadcast', 'Support', 'Settings', 'Disputes', 'Reviews'] }
];

const RevenueVelocityChart = () => {
    const weeklyData = [
        { day: 'Mon', val: 145000, height: '40%' },
        { day: 'Tue', val: 210000, height: '58%' },
        { day: 'Wed', val: 185000, height: '51%' },
        { day: 'Thu', val: 320000, height: '88%' },
        { day: 'Fri', val: 290000, height: '80%' },
        { day: 'Sat', val: 420000, height: '100%' },
        { day: 'Sun', val: 380000, height: '92%' }
    ];

    return (
        <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 16,
            borderWidth: 1.5,
            borderColor: '#D9A73A20',
            marginBottom: 24,
            shadowColor: '#0E1A2E',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.02,
            shadowRadius: 8,
            elevation: 1
        }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Revenue Velocity Tracker</Text>
                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600', marginTop: 2 }}>Weekly platform volume analytics</Text>
                </View>
                <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ fontSize: 9, color: '#065F46', fontWeight: '900' }}>+18.4% VS LAST WEEK</Text>
                </View>
            </View>

            {/* Bars container */}
            <View style={{ height: 140, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F5F3EB' }}>
                {weeklyData.map((d, idx) => (
                    <View key={idx} style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 8, fontWeight: '800', color: '#64748B', marginBottom: 4 }}>₦{(d.val / 1000).toFixed(0)}k</Text>
                        <View style={{ width: 14, height: 90, backgroundColor: '#F5F3EB', borderRadius: 7, overflow: 'hidden', justifyContent: 'flex-end' }}>
                            <LinearGradient
                                colors={['#D9A73A', '#0E1A2E']}
                                style={{ height: d.height, width: '100%', borderRadius: 7 }}
                            />
                        </View>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: '#0E1A2E', marginTop: 6 }}>{d.day}</Text>
                    </View>
                ))}
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <Ionicons name="trending-up" size={14} color="#10B981" />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B' }}>Peak volume recorded on <Text style={{ fontWeight: '900', color: '#0E1A2E' }}>Saturday (₦420,000)</Text> via Escrow gateway.</Text>
            </View>
        </View>
    );
};

export const AdminDashboard = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [showAI, setShowAI] = useState(false);
    const [stats, setStats] = useState({ users: 0, vendors: 0, revenue: 0 });
    const [pendingVendors, setPendingVendors] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    const [recentReviews, setRecentReviews] = useState([]);
    const [recentAudit, setRecentAudit] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log("AdminDashboard: Mounted Full Shell");
        fetchAdminData();
    }, []);

    const fetchAdminData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Consolidated Stats via RPC (Efficient/Server-side)
            const { data: dashboardStats, error: rpcError } = await supabase.rpc('get_admin_dashboard_stats');

            if (rpcError) {
                console.error("RPC Stats Error:", rpcError);
                // Fallback or alert
                Alert.alert('Stats Error', 'Failed to calculate platform metrics. Try again later.');
            }

            // 2. Fetch Recent Data (Limited)
            const [
                { data: applications },
                { data: orders },
                { data: stockData },
                { data: reviewsData },
                { data: auditData }
            ] = await Promise.all([
                supabase.from('vendor_applications').select('*, profiles(email, full_name)').eq('status', 'pending').limit(10),
                supabase.from('orders').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(5),
                supabase.from('products').select('*').lt('stock_quantity', 10).eq('status', 'approved').limit(10),
                supabase.from('reviews').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(3),
                supabase.from('audit_logs').select('*, profiles:user_id(full_name)').order('created_at', { ascending: false }).limit(3)
            ]);

            setPendingVendors(applications || []);
            setRecentOrders(orders || []);
            setLowStock(stockData || []);
            setRecentReviews(reviewsData || []);
            setRecentAudit(auditData || []);

            setStats({
                users: dashboardStats?.user_count || 0,
                vendors: dashboardStats?.vendor_count || 0,
                revenue: dashboardStats?.total_revenue || 0,
                pendingOrders: dashboardStats?.pending_orders_count || 0
            });

        } catch (e) {
            console.error("Admin Dashboard Fetch Crash:", e);
            Alert.alert('Network Error', 'The admin console is experiencing a connection issue. Check your dashboard for service status.');
        } finally {
            setLoading(false);
        }
    };

    const handleApproveAction = (id, name, userId) => {
        Alert.alert('Approve Vendor', `Are you sure you want to approve ${name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Approve',
                onPress: async () => {
                    setLoading(true);
                    const { error: userError } = await supabase.from('profiles').update({ role: 'vendor' }).eq('id', userId);
                    if (userError) {
                        Alert.alert('Error', userError.message);
                        setLoading(false);
                        return;
                    }
                    const { error } = await supabase.from('vendor_applications').update({ status: 'approved' }).eq('id', id);
                    if (!error) {
                        setPendingVendors(prev => prev.filter(v => v.id !== id));
                        fetchAdminData();
                        Alert.alert('Success', 'Vendor approved.');
                    }
                    setLoading(false);
                }
            }
        ]);
    };

    const handleRejectAction = (id) => {
        Alert.alert('Reject Vendor', 'Confirm rejection?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reject',
                style: 'destructive',
                onPress: async () => {
                    await supabase.from('vendor_applications').update({ status: 'rejected' }).eq('id', id);
                    setPendingVendors(prev => prev.filter(v => v.id !== id));
                }
            }
        ]);
    };

    const QuickAction = ({ icon, label, onPress, color }) => (
        <TouchableOpacity onPress={onPress} style={{ alignItems: 'center', width: 70 }} activeOpacity={0.8}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9A73A20', alignItems: 'center', justifyContent: 'center', marginBottom: 6, shadowColor: '#0E1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#0E1A2E', textAlign: 'center' }} numberOfLines={1}>{label}</Text>
        </TouchableOpacity>
    );

    const getGreeting = () => {
        const hour = new Date().getHours();
        const adminName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin';
        
        let greetingWord = 'Barka da Safiya'; // 5am - 12pm
        let emoji = '☀️';
        
        if (hour >= 12 && hour < 16) {
            greetingWord = 'Barka da Rana'; // 12pm - 4pm
            emoji = '🌤️';
        } else if (hour >= 16 && hour < 20) {
            greetingWord = 'Barka da Yamma'; // 4pm - 8pm
            emoji = '🌇';
        } else if (hour >= 20 || hour < 5) {
            greetingWord = 'Barka da Dare'; // 8pm - 5am
            emoji = '🌙';
        }
        
        return `${greetingWord}, ${adminName}! ${emoji}`;
    };

    const renderOverview = () => {
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        return (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                {/* HEADER - DECORATED & MODERN GRADIENT CONTAINER */}
                <LinearGradient
                    colors={['#0E1A2E', '#1E293B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ overflow: 'hidden', paddingBottom: 24, paddingHorizontal: 20, paddingTop: 30, borderRadius: 24, borderWidth: 1.5, borderColor: '#D9A73A40', marginBottom: 24, position: 'relative', shadowColor: '#0E1A2E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4 }}
                >
                    {/* Concentric Gold Ring Backdrops */}
                    <View style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, borderWidth: 1.5, borderColor: 'rgba(217, 167, 58, 0.08)' }} />
                    <View style={{ position: 'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: 70, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.04)', borderStyle: 'dashed' }} />
                    <View style={{ position: 'absolute', bottom: -50, left: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(217, 167, 58, 0.03)' }} />

                    <View style={{ position: 'relative', zIndex: 10 }}>
                        {/* Live System Signal Badge */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)', alignSelf: 'flex-start', marginBottom: 12, gap: 6 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                            <Text style={{ color: '#10B981', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>ACTIVE TERMINAL • SECURE ESCROW</Text>
                        </View>

                        {/* Super Admin Profile Clearance Card */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 4 }}>
                            {/* Logo + Admin Avatar */}
                            <View style={{ position: 'relative' }}>
                                <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#D9A73A', backgroundColor: 'rgba(217,167,58,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#D9A73A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 }}>
                                    <Image source={AM_LOGO} style={{ width: 46, height: 46 }} resizeMode="contain" />
                                </View>
                                {/* Admin initial badge overlay */}
                                <View style={{ position: 'absolute', bottom: -3, right: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#D9A73A', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#0E1A2E' }}>
                                    <Text style={{ color: '#0E1A2E', fontSize: 9, fontWeight: '900' }}>
                                        {(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'A').toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={{ color: '#D9A73A', fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>SUPER ADMINISTRATOR</Text>
                                    <View style={{ backgroundColor: 'rgba(217, 167, 58, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5, borderColor: '#D9A73A40' }}>
                                        <Text style={{ color: '#D9A73A', fontSize: 7, fontWeight: '900' }}>LVL 4 CLEAR</Text>
                                    </View>
                                </View>
                                <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginTop: 2 }}>{getGreeting()}</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', marginTop: 2 }}>{currentDate} • IP: 192.168.1.104</Text>
                            </View>
                        </View>

                        {/* Modern Search */}
                        <View style={{ marginTop: 20, backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#D9A73A25', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
                            <Ionicons name="search" color="#D9A73A" size={18} />
                            <TextInput
                                placeholder="Search ecosystem..."
                                placeholderTextColor="#94A3B8"
                                style={{ flex: 1, marginLeft: 12, color: '#0E1A2E', fontWeight: '600', fontSize: 13 }}
                            />
                        </View>
                    </View>
                </LinearGradient>

                {/* ECOSYSTEM CONTROL MONITOR */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#0E1A2E', marginBottom: 12 }}>Ecosystem Control Monitor</Text>
                    <View style={{ 
                        backgroundColor: '#FFFFFF', 
                        borderRadius: 24, 
                        padding: 16, 
                        borderWidth: 1.5, 
                        borderColor: '#D9A73A20', 
                        shadowColor: '#0E1A2E', 
                        shadowOffset: { width: 0, height: 4 }, 
                        shadowOpacity: 0.02, 
                        shadowRadius: 8, 
                        elevation: 1 
                    }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F5F3EB', paddingBottom: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 }} />
                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0E1A2E' }}>Operational Telemetry</Text>
                            </View>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B' }}>SECURE LINK</Text>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {[
                                { label: 'Supabase DB', val: 'Online (99.9%)', icon: 'server-outline', color: '#10B981' },
                                { label: 'Latency', val: '124ms (Fast)', icon: 'speedometer-outline', color: '#10B981' },
                                { label: 'Escrow Ledger', val: 'Active', icon: 'lock-closed-outline', color: '#D9A73A' },
                                { label: 'Email Queue', val: '0 Pending', icon: 'mail-outline', color: '#10B981' }
                            ].map((m, idx) => (
                                <View key={idx} style={{ flex: 1, minWidth: '45%', backgroundColor: '#F5F3EB', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#D9A73A10', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name={m.icon} size={14} color={m.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 8, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>{m.label}</Text>
                                        <Text style={{ fontSize: 10, fontWeight: '900', color: '#0E1A2E', marginTop: 1 }}>{m.val}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* OPERATIONS HUB BY SEGMENT */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#0E1A2E', marginBottom: 12 }}>Operations Hub</Text>
                    <View style={{ backgroundColor: '#FFFFFF', padding: 16, borderRadius: 24, borderWidth: 1.5, borderColor: '#D9A73A15', gap: 16, shadowColor: '#0E1A2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 }}>
                        
                        {/* Sales & Products Segment */}
                        <View>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#64748B', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Sales & Catalog</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                                <QuickAction icon="cart" label="Orders" color="#0EA5E9" onPress={() => setActiveTab('orders')} />
                                <QuickAction icon="cube" label="Products" color="#8B5CF6" onPress={() => setActiveTab('products')} />
                                <QuickAction icon="list" label="Categories" color="#EC4899" onPress={() => setActiveTab('categories')} />
                                <QuickAction icon="ribbon" label="Brands" color="#D9A73A" onPress={() => setActiveTab('brands')} />
                            </View>
                        </View>

                        {/* Marketing & Promos Segment */}
                        <View style={{ borderTopWidth: 1, borderTopColor: '#F5F3EB', paddingTop: 12 }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#64748B', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Marketing & Campaigns</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                                <QuickAction icon="stopwatch" label="Flash Sale" color="#EF4444" onPress={() => setActiveTab('flash')} />
                                <QuickAction icon="pricetag" label="Coupons" color="#F59E0B" onPress={() => setActiveTab('coupons')} />
                                <QuickAction icon="megaphone-outline" label="Promos" color="#14B8A6" onPress={() => setActiveTab('promos')} />
                                <QuickAction icon="images" label="Banners" color="#6366F1" onPress={() => setActiveTab('banners')} />
                            </View>
                        </View>

                        {/* Finance & Partners Segment */}
                        <View style={{ borderTopWidth: 1, borderTopColor: '#F5F3EB', paddingTop: 12 }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#64748B', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Partners & Finance</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                                <QuickAction icon="storefront" label="Vendors" color="#10B981" onPress={() => setActiveTab('vendors')} />
                                <QuickAction icon="people" label="Users" color="#64748B" onPress={() => setActiveTab('users')} />
                                <QuickAction icon="wallet" label="Payouts" color="#F97316" onPress={() => setActiveTab('payouts')} />
                                <QuickAction icon="receipt" label="Invoices" color="#0E1A2E" onPress={() => setActiveTab('invoices')} />
                            </View>
                        </View>

                        {/* Support & System Segment */}
                        <View style={{ borderTopWidth: 1, borderTopColor: '#F5F3EB', paddingTop: 12 }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#64748B', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Ecosystem & Control</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                                <QuickAction icon="chatbubbles" label="Support" color="#3B82F6" onPress={() => setActiveTab('support')} />
                                <QuickAction icon="shield-checkmark" label="Audit Logs" color="#475569" onPress={() => setActiveTab('audit')} />
                                <QuickAction icon="document-text" label="CMS Pages" color="#0E1A2E" onPress={() => setActiveTab('pages')} />
                                <QuickAction icon="settings" label="Settings" color="#D9A73A" onPress={() => setActiveTab('settings')} />
                            </View>
                        </View>
                    </View>
                </View>

                {/* REVENUE VELOCITY CHART */}
                <RevenueVelocityChart />

                {/* STATS GRID */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                    <PremiumStatCard label="Total Revenue" value={`₦${stats.revenue.toLocaleString()}`} icon="cash" type="dark" trend="+14.2%" />
                    <PremiumStatCard label="Total Users" value={stats.users} icon="people" type="light" trend="+8.5%" />
                </View>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                    <PremiumStatCard label="Active Vendors" value={stats.vendors} icon="storefront" type="light" trend="Stable" />
                    <PremiumStatCard label="Pending Orders" value={recentOrders.filter(o => o.status === 'Pending').length} icon="time" type="gold" trend="Active" />
                </View>

                {/* NEEDS ATTENTION / LOW STOCK */}
                <View style={{ marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <Ionicons name="alert-circle" size={18} color="#EF4444" />
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#0E1A2E' }}>Needs Attention</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
                        {lowStock.length > 0 ? lowStock.map(item => (
                            <View key={item.id} style={{ width: 180, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: '#EF444425', borderLeftWidth: 5, borderLeftColor: '#EF4444', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 }}>
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/100' }} style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: '#F5F3EB' }} />
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={{ fontWeight: '800', color: '#0E1A2E', fontSize: 12 }}>{item.name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#EF4444' }} />
                                            <Text style={{ fontSize: 9, color: '#EF4444', fontWeight: '900', textTransform: 'uppercase' }}>RESTOCK REQ</Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' }}>
                                    <Text style={{ fontSize: 9, color: '#B91C1C', fontWeight: '900' }}>{item.stock_quantity || 0} items left</Text>
                                </View>
                            </View>
                        )) : (
                            <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: '#10B98125', borderLeftWidth: 5, borderLeftColor: '#10B981', flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 }}>
                                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                </View>
                                <View>
                                    <Text style={{ color: '#166534', fontWeight: '900', fontSize: 12 }}>All Systems Nominal</Text>
                                    <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '600', marginTop: 1 }}>Ecosystem inventory fully stocked.</Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* RECENT ORDERS LIST */}
                <View style={{ marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#0E1A2E' }}>Recent Orders</Text>
                        <TouchableOpacity onPress={() => setActiveTab('orders')}>
                            <Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 12 }}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    {recentOrders.map(order => (
                        <View key={order.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: 'white', borderRadius: 20, marginBottom: 8, borderWidth: 1.5, borderColor: '#D9A73A15', borderLeftWidth: 5, borderLeftColor: order.status === 'Pending' ? '#D9A73A' : '#10B981', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1.5 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#F5F3EB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D9A73A10' }}>
                                    <Ionicons name="cart-outline" size={18} color="#D9A73A" />
                                </View>
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={{ fontWeight: '900', color: '#0E1A2E', fontSize: 13 }}>#{order.id.slice(0, 6).toUpperCase()}</Text>
                                        <View style={{ backgroundColor: order.status === 'Pending' ? '#FEF3C7' : '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                            <Text style={{ fontSize: 8, color: order.status === 'Pending' ? '#B45309' : '#047857', fontWeight: '900', textTransform: 'uppercase' }}>{order.status}</Text>
                                        </View>
                                    </View>
                                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 3 }}>{order.profiles?.full_name || 'Guest User'}</Text>
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end', backgroundColor: '#F5F3EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#D9A73A15' }}>
                                <Text style={{ fontWeight: '900', color: '#0E1A2E', fontSize: 12 }}>₦{order.total_amount?.toLocaleString()}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* RECENT REVIEWS */}
                <View style={{ marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#0E1A2E' }}>Customer Insights</Text>
                        <TouchableOpacity onPress={() => setActiveTab('reviews')}>
                            <Ionicons name="arrow-forward" size={18} color="#D9A73A" />
                        </TouchableOpacity>
                    </View>
                    {recentReviews.length > 0 ? recentReviews.map(r => (
                        <View key={r.id} style={{ padding: 16, backgroundColor: 'white', borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: '#D9A73A15', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#F5F3EB', alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ fontSize: 11, fontWeight: '900', color: '#D9A73A' }}>{r.profiles?.full_name?.[0]?.toUpperCase() || '?'}</Text>
                                    </View>
                                    <Text style={{ fontWeight: '900', fontSize: 13, color: '#0E1A2E' }}>{r.profiles?.full_name || 'Anonymous'}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: 'center' }}>
                                    <Ionicons name="star" color="#F59E0B" size={10} />
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#B45309', marginLeft: 4 }}>{r.rating}.0</Text>
                                </View>
                            </View>
                            {r.title ? <Text style={{ fontWeight: '800', fontSize: 13, color: '#0E1A2E', marginBottom: 3 }}>{r.title}</Text> : null}
                            <Text numberOfLines={2} style={{ fontSize: 12, color: '#64748B', lineHeight: 18, fontWeight: '550' }}>{r.comment}</Text>
                        </View>
                    )) : (
                        <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#D9A73A30' }}>
                            <Text style={{ color: '#94A3B8', fontWeight: '600', fontSize: 12 }}>No recent reviews</Text>
                        </View>
                    )}
                </View>

                {/* LIVE PULSE / AUDIT LOGS */}
                <View style={{ marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                            <Text style={{ fontSize: 16, fontWeight: '900', color: '#0E1A2E' }}>Ecosystem Pulse</Text>
                        </View>
                        <TouchableOpacity onPress={() => setActiveTab('audit')}>
                            <Text style={{ color: '#D9A73A', fontWeight: '800', fontSize: 12 }}>Live Feed</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{ backgroundColor: '#0E1A2E', borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: '#D9A73A40', shadowColor: '#0E1A2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4, position: 'relative' }}>
                        {/* Concentric telemetry rings */}
                        <View style={{ position: 'absolute', bottom: -30, right: -30, width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.05)', borderStyle: 'dashed' }} />
                        
                        {recentAudit.length > 0 ? recentAudit.map((log, i) => (
                            <View key={log.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: i === recentAudit.length - 1 ? 0 : 18 }}>
                                <View style={{ alignItems: 'center' }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', zIndex: 2 }}>
                                        <Ionicons name={log.action.includes('order') ? 'cart' : log.action.includes('vendor') ? 'storefront' : 'shield-checkmark'} size={14} color="#D9A73A" />
                                    </View>
                                    {i < recentAudit.length - 1 && (
                                        <View style={{ width: 1.5, height: 24, backgroundColor: 'rgba(217, 167, 58, 0.15)', borderStyle: 'dashed', marginTop: 4 }} />
                                    )}
                                </View>
                                <View style={{ flex: 1, paddingTop: 2 }}>
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 }}>{log.action.replace(/_/g, ' ').toUpperCase()}</Text>
                                    <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '600', marginTop: 2 }}>{log.profiles?.full_name || 'System'} • {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={12} color="#D9A73A" style={{ opacity: 0.6, marginTop: 8 }} />
                            </View>
                        )) : (
                            <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: 12 }}>No recent activity pulses detected.</Text>
                        )}
                    </View>
                </View>

                {/* VENDOR REQUESTS */}
                <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#0E1A2E' }}>Vendor Requests</Text>
                        {pendingVendors.length > 0 && <View style={{ backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>{pendingVendors.length} NEW</Text></View>}
                    </View>

                    {loading && pendingVendors.length === 0 ? <ActivityIndicator color="#0E1A2E" /> : (
                        pendingVendors.length === 0 ? (
                            <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#D9A73A30' }}>
                                <Text style={{ color: '#94A3B8', fontWeight: '600', fontSize: 12 }}>No pending applications</Text>
                            </View>
                        ) : (
                            pendingVendors.map((vendor) => (
                                <View key={vendor.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: '#D9A73A15', padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 }}>
                                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F3EB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D9A73A25' }}>
                                            <Text style={{ fontWeight: '900', color: '#D9A73A', fontSize: 15 }}>{vendor.business_name?.[0]?.toUpperCase() || 'V'}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: '800', color: '#0E1A2E', fontSize: 13 }}>{vendor.business_name}</Text>
                                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 1 }}>{vendor.business_category}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setActiveTab('vendors')}
                                            style={{ backgroundColor: '#0E1A2E', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#D9A73A30' }}
                                        >
                                            <Text style={{ color: '#D9A73A', fontSize: 11, fontWeight: '900' }}>Review</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )
                    )}
                </View>
            </ScrollView>
        );
    };

    const renderContent = () => {
        if (activeTab === 'orders') return <AdminOrders />;
        if (activeTab === 'vendors') return <AdminVendors />;
        if (activeTab === 'products') return <AdminProducts />;
        if (activeTab === 'banners') return <AdminBanners />;
        if (activeTab === 'users') return <AdminUsers />;
        if (activeTab === 'categories') return <AdminCategories />;
        if (activeTab === 'payouts') return <AdminPayouts />;
        if (activeTab === 'reviews') return <AdminReviews />;
        if (activeTab === 'brands') return <AdminBrands />;
        if (activeTab === 'analytics') return <AdminAnalytics />;
        if (activeTab === 'financials') return <AdminFinancials />;
        if (activeTab === 'disputes') return <AdminDisputes />;
        if (activeTab === 'carts') return <AdminAbandonedCarts />;
        if (activeTab === 'invoices') return <AdminInvoices />;
        if (activeTab === 'referrals') return <AdminReferrals />;
        if (activeTab === 'flash') return <AdminFlashSales />;
        if (activeTab === 'pages') return <AdminCMS />;
        if (activeTab === 'audit') return <AdminAuditLogs />;
        if (activeTab === 'broadcast') return <AdminBroadcast />;
        if (activeTab === 'coupons') return <AdminCoupons />;
        if (activeTab === 'support') return <AdminSupport />;
        if (activeTab === 'settings') return <AdminSettings />;
        if (activeTab === 'home') return <AdminHomeSettings />;
        if (activeTab === 'promos') return <AdminPromoBanners />;
        return renderOverview();
    };

    const activeCategory = TAB_CATEGORIES.find(cat => 
        cat.tabs.some(t => t.toLowerCase() === activeTab)
    )?.id || 'dashboard';

    return (
        <View style={[styles.container, { backgroundColor: '#F5F3EB' }]}>
            {/* HEADER */}
            <LinearGradient
                colors={['#0E1A2E', '#1A2F4C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ borderBottomWidth: 2, borderColor: '#D9A73A', paddingTop: 50, paddingBottom: 12 }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
                    {/* Logo + Brand Name */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {/* Real Logo */}
                        <View style={{
                            width: 38, height: 38, borderRadius: 11,
                            backgroundColor: 'rgba(217,167,58,0.1)',
                            borderWidth: 1.5, borderColor: 'rgba(217,167,58,0.35)',
                            overflow: 'hidden',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Image source={AM_LOGO} style={{ width: 34, height: 34 }} resizeMode="contain" />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: 'white', letterSpacing: -0.3 }}>Admin<Text style={{ color: '#D9A73A' }}>Panel</Text></Text>
                                <Text style={{ fontSize: 8.5, color: 'rgba(217,167,58,0.7)', fontWeight: '800', letterSpacing: 1.5, marginTop: -1 }}>ELITE ECOSYSTEM</Text>
                            </View>
                            <View style={{ backgroundColor: 'rgba(217, 167, 58, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#D9A73A40', marginTop: -8 }}>
                                <Text style={{ color: '#D9A73A', fontSize: 8, fontWeight: '900' }}>v2.0</Text>
                            </View>
                        </View>
                    </View>
                    {/* Logout */}
                    <TouchableOpacity onPress={onLogout} style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(217, 167, 58, 0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,167,58,0.2)' }}>
                        <Ionicons name="log-out-outline" size={18} color="#D9A73A" />
                    </TouchableOpacity>
                </View>

                {/* CATEGORIES selector */}
                <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 10 }}>
                    {TAB_CATEGORIES.map((cat) => {
                        const isSelectedCat = activeCategory === cat.id;
                        return (
                            <TouchableOpacity
                                key={cat.id}
                                onPress={() => {
                                    // Set to the first tab in the category when category is clicked
                                    setActiveTab(cat.tabs[0].toLowerCase());
                                }}
                                style={{ 
                                    paddingHorizontal: 10, 
                                    paddingVertical: 6, 
                                    borderRadius: 10, 
                                    backgroundColor: isSelectedCat ? '#D9A73A' : 'rgba(255,255,255,0.06)',
                                    borderWidth: 1,
                                    borderColor: isSelectedCat ? 'transparent' : 'rgba(255,255,255,0.1)'
                                }}
                            >
                                <Text style={{ 
                                    color: isSelectedCat ? '#0E1A2E' : 'white', 
                                    fontWeight: '900', 
                                    fontSize: 10.5,
                                    letterSpacing: 0.2
                                }}>{cat.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* SUB-TABS PILLS (Horizontal Scroll) */}
                <View style={{ marginTop: 4 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                        {TAB_CATEGORIES.find(c => c.id === activeCategory)?.tabs.map((tab) => {
                            const isActive = activeTab === tab.toLowerCase();
                            return (
                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setActiveTab(tab.toLowerCase())}
                                    style={{ 
                                        paddingHorizontal: 12, 
                                        paddingVertical: 5, 
                                        borderRadius: 20, 
                                        backgroundColor: isActive ? 'rgba(217, 167, 58, 0.15)' : 'transparent',
                                        borderWidth: 1.2,
                                        borderColor: isActive ? '#D9A73A' : 'rgba(255,255,255,0.15)'
                                    }}
                                >
                                    <Text style={{ 
                                        color: isActive ? '#D9A73A' : 'rgba(255,255,255,0.7)', 
                                        fontWeight: isActive ? '900' : '700', 
                                        fontSize: 11, 
                                        textTransform: 'uppercase', 
                                        letterSpacing: 0.5 
                                    }}>{tab}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </LinearGradient>

            <View style={{ flex: 1, backgroundColor: '#F5F3EB' }}>
                {renderContent()}
            </View>

            {/* AI Assistant FAB */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowAI(true)}
                style={{ position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#0E1A2E', justifyContent: 'center', alignItems: 'center', shadowColor: '#0E1A2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, borderWidth: 2, borderColor: '#D9A73A' }}
            >
                <Text style={{ fontSize: 28 }}>🤖</Text>
                <View style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#0E1A2E' }} />
            </TouchableOpacity>

            <AdminAIAssistantModal
                visible={showAI}
                onClose={() => setShowAI(false)}
                user={user}
            />
        </View>
    );
};
