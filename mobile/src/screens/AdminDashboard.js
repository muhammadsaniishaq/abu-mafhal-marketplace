import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';

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

// Helper Component for Stats
const LinearStatCard = ({ label, value, icon, color1, color2 }) => (
    <View style={{ flex: 1, backgroundColor: color1, borderRadius: 16, padding: 16, overflow: 'hidden', height: 110, justifyContent: 'space-between' }}>
        <View style={{ position: 'absolute', right: -10, top: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)' }} />
        <Ionicons name={icon} size={24} color="white" style={{ opacity: 0.9 }} />
        <View>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4 }}>{label}</Text>
            <Text style={{ color: 'white', fontSize: 24, fontWeight: '800' }}>{value}</Text>
        </View>
    </View>
);

export const AdminDashboard = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({ users: 0, vendors: 0, revenue: 0 });
    const [pendingVendors, setPendingVendors] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    const [recentReviews, setRecentReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log("AdminDashboard: Mounted Full Shell");
        fetchAdminData();
    }, []);

    const fetchAdminData = async () => {
        try {
            setLoading(true);

            // 1. Fetch User Count
            const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

            // 2. Fetch Vendor Count
            const { count: vendorCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vendor');

            // 3. Fetch Revenue
            const { data: revenueData } = await supabase.from('orders').select('total_amount').neq('status', 'Cancelled');
            const revenue = revenueData ? revenueData.reduce((sum, order) => sum + (order.total_amount || 0), 0) : 0;

            // 4. Fetch Pending Vendor Applications
            const { data: applications } = await supabase.from('vendor_applications').select('*, profiles(email, full_name)').eq('status', 'pending');
            setPendingVendors(applications || []);

            // 5. Fetch Recent Orders
            const { data: orders } = await supabase.from('orders').select('*, user:profiles(full_name)').order('created_at', { ascending: false }).limit(5);
            setRecentOrders(orders || []);

            // 6. Fetch Low Stock
            const { data: stockData } = await supabase.from('products').select('*').lt('stock_quantity', 10).eq('status', 'approved');
            setLowStock(stockData || []);

            // 7. Fetch Recent Reviews
            const { data: reviewsData } = await supabase.from('reviews').select('*, user:profiles(full_name)').order('created_at', { ascending: false }).limit(3);
            setRecentReviews(reviewsData || []);

            setStats({ users: userCount || 0, vendors: vendorCount || 0, revenue: revenue });

        } catch (e) {
            console.error("Admin Fetch Error:", e);
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
        <TouchableOpacity onPress={onPress} style={{ alignItems: 'center', width: 70 }}>
            <View style={{ width: 45, height: 45, borderRadius: 16, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <Ionicons name={icon} size={22} color={color} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E293B', textAlign: 'center' }} numberOfLines={1}>{label}</Text>
        </TouchableOpacity>
    );

    const renderOverview = () => (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
            {/* HEADER - DECORATED & MODERN */}
            <View style={{ overflow: 'hidden', paddingBottom: 24, paddingHorizontal: 20, paddingTop: 50, backgroundColor: '#0F172A', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, marginBottom: 24, position: 'relative' }}>
                {/* Decoration Circles */}
                <View style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(59, 130, 246, 0.1)' }} />
                <View style={{ position: 'absolute', top: 50, left: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(59, 130, 246, 0.08)' }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Ionicons name="sparkles" size={14} color="#FBBF24" />
                            <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>ELITE CONSOLE</Text>
                        </View>
                        <Text style={{ color: 'white', fontSize: 28, fontWeight: '900' }}>Abu Mafhal</Text>
                    </View>
                    <TouchableOpacity onPress={onLogout} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                        <Ionicons name="log-out-outline" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Modern Search */}
                <View style={{ marginTop: 24, backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="search" color="#64748B" size={20} />
                    <TextInput
                        placeholder="Search ecosystem..."
                        placeholderTextColor="#94A3B8"
                        style={{ flex: 1, marginLeft: 12, color: '#0F172A', fontWeight: '600', fontSize: 14 }}
                    />
                </View>
            </View>

            {/* QUICK ACTIONS */}
            <View style={{ marginBottom: 24 }}>
                <Text style={[styles.sectionTitle, { marginLeft: 0, marginTop: 0 }]}>Operations Hub</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                    <QuickAction icon="pricetag" label="Coupon" color="#8B5CF6" onPress={() => setActiveTab('coupons')} />
                    <QuickAction icon="ribbon" label="Brands" color="#DB2777" onPress={() => setActiveTab('brands')} />
                    <QuickAction icon="stopwatch" label="Flash" color="#EF4444" onPress={() => setActiveTab('flash')} />
                    <QuickAction icon="document-text" label="Pages" color="#334155" onPress={() => setActiveTab('pages')} />
                    <QuickAction icon="megaphone" label="Notify" color="#F59E0B" onPress={() => setActiveTab('broadcast')} />
                    <QuickAction icon="wallet" label="Payouts" color="#10B981" onPress={() => setActiveTab('payouts')} />
                    <QuickAction icon="cart" label="Carts" color="#F97316" onPress={() => setActiveTab('carts')} />
                    <QuickAction icon="receipt" label="Invoice" color="#0EA5E9" onPress={() => setActiveTab('invoices')} />
                    <QuickAction icon="shield-checkmark" label="Audit" color="#64748B" onPress={() => setActiveTab('audit')} />
                    <QuickAction icon="list" label="Cats" color="#EC4899" onPress={() => setActiveTab('categories')} />
                </ScrollView>
            </View>

            {/* STATS GRID */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <LinearStatCard label="Total Revenue" value={`₦${stats.revenue.toLocaleString()}`} icon="cash" color1="#0F172A" color2="#1E293B" />
                <LinearStatCard label="Total Users" value={stats.users} icon="people" color1="#3B82F6" color2="#2563EB" />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                <LinearStatCard label="Active Vendors" value={stats.vendors} icon="storefront" color1="#10B981" color2="#059669" />
                <LinearStatCard label="Pending Orders" value={recentOrders.filter(o => o.status === 'Pending').length} icon="time" color1="#F59E0B" color2="#D97706" />
            </View>

            {/* NEEDS ATTENTION / LOW STOCK */}
            <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                    <Text style={styles.sectionTitle}>Needs Attention</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                    {lowStock.length > 0 ? lowStock.map(item => (
                        <View key={item.id} style={{ width: 160, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 16, borderWidth: 1, borderColor: '#FECACA' }}>
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                                <Image source={{ uri: item.images?.[0] || 'https://placehold.co/100' }} style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' }} />
                                <View style={{ flex: 1 }}>
                                    <Text numberOfLines={1} style={{ fontWeight: '700', color: '#991B1B', fontSize: 13 }}>{item.name}</Text>
                                    <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '600' }}>Low Stock</Text>
                                </View>
                            </View>
                            <View style={{ backgroundColor: 'white', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#FEE2E2' }}>
                                <Text style={{ fontSize: 10, color: '#B91C1C', fontWeight: '700' }}>{item.stock_quantity || 0} Remaining</Text>
                            </View>
                        </View>
                    )) : (
                        <View style={{ padding: 16, backgroundColor: '#F0FDF4', borderRadius: 16, borderWidth: 1, borderColor: '#BBF7D0', width: '100%' }}>
                            <Text style={{ color: '#166534', fontWeight: '600' }}>Everything looks good! No low stock items.</Text>
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* RECENT ORDERS LIST */}
            <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.sectionTitle}>Recent Orders</Text>
                    <TouchableOpacity onPress={() => setActiveTab('orders')}>
                        <Text style={{ color: '#3B82F6', fontWeight: '600' }}>See All</Text>
                    </TouchableOpacity>
                </View>
                {recentOrders.map(order => (
                    <View key={order.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: 'white', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="cart" size={16} color="#64748B" />
                            </View>
                            <View>
                                <Text style={{ fontWeight: '700', color: '#0F172A' }}>#{order.id.slice(0, 6).toUpperCase()}</Text>
                                <Text style={{ fontSize: 12, color: '#64748B' }}>{order.user?.full_name || 'Guest'}</Text>
                            </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontWeight: '700', color: '#0F172A' }}>₦{order.total_amount?.toLocaleString()}</Text>
                            <Text style={{ fontSize: 10, color: order.status === 'Pending' ? '#D97706' : '#10B981', fontWeight: '700', textTransform: 'uppercase' }}>{order.status}</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* RECENT REVIEWS */}
            <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.sectionTitle}>Customer Insights</Text>
                    <TouchableOpacity onPress={() => setActiveTab('reviews')}>
                        <Ionicons name="arrow-forward" size={20} color="#3B82F6" />
                    </TouchableOpacity>
                </View>
                {recentReviews.length > 0 ? recentReviews.map(r => (
                    <View key={r.id} style={{ padding: 16, backgroundColor: 'white', borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B' }}>{r.user?.full_name?.[0] || '?'}</Text>
                                </View>
                                <Text style={{ fontWeight: '700', fontSize: 13, color: '#0F172A' }}>{r.user?.full_name || 'Anonymous'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                <Ionicons name="star" color="#F59E0B" size={12} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309', marginLeft: 4 }}>{r.rating}.0</Text>
                            </View>
                        </View>
                        <Text numberOfLines={2} style={{ fontSize: 13, color: '#475569', lineHeight: 18 }}>{r.comment}</Text>
                    </View>
                )) : (
                    <View style={{ padding: 20, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' }}>
                        <Text style={{ color: '#94A3B8' }}>No recent reviews</Text>
                    </View>
                )}
            </View>

            {/* VENDOR REQUESTS */}
            <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.sectionTitle}>Vendor Requests</Text>
                    {pendingVendors.length > 0 && <View style={{ backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 6 }}><Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{pendingVendors.length} NEW</Text></View>}
                </View>

                {loading && pendingVendors.length === 0 ? <ActivityIndicator color="#0F172A" /> : (
                    pendingVendors.length === 0 ? (
                        <View style={{ padding: 20, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' }}>
                            <Text style={{ color: '#94A3B8' }}>No pending applications</Text>
                        </View>
                    ) : (
                        pendingVendors.map((vendor) => (
                            <View key={vendor.id} style={styles.vendorCard}>
                                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ fontWeight: '700', color: '#EA580C' }}>{vendor.business_name?.[0].toUpperCase()}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: '700', color: '#0F172A' }}>{vendor.business_name}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748B' }}>{vendor.business_category}</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setActiveTab('vendors')}
                                        style={{ backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
                                    >
                                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>Review</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )
                )}
            </View>
        </ScrollView>
    );

    const renderContent = () => {
        if (activeTab === 'orders') return <AdminOrders />;
        if (activeTab === 'vendors') return <AdminVendors />;
        if (activeTab === 'products') return <AdminProducts />;
        if (activeTab === 'banners') return <AdminBanners />;
        if (activeTab === 'users') return <AdminUsers />;
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
        return renderOverview();
    };

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9', paddingTop: 50, paddingBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 32, height: 32, backgroundColor: '#0F172A', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="grid" size={18} color="white" />
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>Admin<Text style={{ color: '#3B82F6' }}>Panel</Text></Text>
                    </View>
                    <TouchableOpacity onPress={onLogout} style={{ padding: 8 }}>
                        <Ionicons name="log-out-outline" size={24} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                {/* SCROLLABLE TABS */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 20 }}>
                    {['Overview', 'Home', 'Vendors', 'Products', 'Brands', 'Analytics', 'Financials', 'Orders', 'Invoices', 'Carts', 'Disputes', 'Reviews', 'Categories', 'Banners', 'Users', 'Payouts', 'Flash', 'Referrals', 'Pages', 'Audit', 'Broadcast', 'Coupons', 'Support', 'Settings'].map((tab) => {
                        const isActive = activeTab === tab.toLowerCase();
                        return (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab.toLowerCase())}
                                style={{ paddingBottom: 12, borderBottomWidth: 3, borderColor: isActive ? '#3B82F6' : 'transparent' }}
                            >
                                <Text style={{ color: isActive ? '#3B82F6' : '#94A3B8', fontWeight: isActive ? '700' : '600', fontSize: 14 }}>{tab}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                {renderContent()}
            </View>
        </View>
    );
};
