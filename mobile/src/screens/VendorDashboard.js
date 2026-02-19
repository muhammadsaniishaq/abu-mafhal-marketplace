import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Image, ActivityIndicator, FlatList, StyleSheet, BackHandler, Modal, TextInput, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { VendorRegister } from './VendorRegister';
import { VendorCertificate } from './VendorCertificate';
import { VendorAddProduct } from './VendorAddProduct'; // Dedicated Vendor Editor

export const VendorDashboard = ({ user, onLogout }) => {
    // Tab State
    const [activeTab, setActiveTab] = useState('overview'); // overview, products, orders, wallet
    const [viewMode, setViewMode] = useState('list'); // list, add-product

    // Data State
    const [vendor, setVendor] = useState(null);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [wallet, setWallet] = useState({ balance: 0, total_sales: 0 });
    const [stats, setStats] = useState({ earnings: 0, orders: 0, products: 0, views: 0 });

    // UI State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showRenewal, setShowRenewal] = useState(false);
    const [showCertificate, setShowCertificate] = useState(false);

    // Products Filter State (Admin Style)
    const [search, setSearch] = useState('');
    const [stockFilter, setStockFilter] = useState('all'); // 'all', 'low', 'out'
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Handle Hardware Back Button
    useEffect(() => {
        const backAction = () => {
            if (viewMode === 'add-product') {
                setViewMode('list');
                setSelectedProduct(null);
                return true;
            }
            onLogout();
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [viewMode]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Vendor Profile
            const { data: vendorData } = await supabase.from('vendors').select('*').eq('user_id', user.id).single();
            if (vendorData) setVendor(vendorData);

            // 2. Fetch Wallet
            const { data: walletData } = await supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle();
            if (walletData) setWallet(walletData);

            // 3. Fetch Products
            const { data: productsData } = await supabase
                .from('products')
                .select('*')
                .eq('vendor_id', user.id)
                .neq('status', 'archived')
                .order('created_at', { ascending: false });

            setProducts(productsData || []);

            // 4. Fetch Orders (simplified)
            if (productsData?.length > 0) {
                const productIds = productsData.map(p => p.id);
                const { data: orderItems } = await supabase
                    .from('order_items')
                    .select('*, order:orders(*)')
                    .in('product_id', productIds)
                    .order('created_at', { ascending: false });

                const formattedOrders = orderItems?.map(item => ({
                    id: item.order?.id,
                    customer: item.order?.user_id || 'Customer',
                    item: productsData.find(p => p.id === item.product_id)?.name || 'Product',
                    amount: item.price * item.quantity,
                    status: item.order?.status || 'Pending',
                    date: new Date(item.created_at).toLocaleDateString(),
                    raw_date: item.created_at
                })) || [];

                setOrders(formattedOrders);

                const totalEarnings = formattedOrders.reduce((sum, o) => sum + (o.status === 'Delivered' ? o.amount : 0), 0);
                setStats({
                    earnings: totalEarnings,
                    orders: formattedOrders.length,
                    products: productsData.length,
                    views: 0
                });
            }

        } catch (err) {
            console.log('Error fetching dashboard:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleDeleteProduct = async (id) => {
        Alert.alert('Delete Product', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('products').update({ status: 'archived' }).eq('id', id);
                    if (!error) {
                        setProducts(products.filter(p => p.id !== id));
                        Alert.alert('Success', 'Product archived');
                    } else {
                        Alert.alert('Error', error.message);
                    }
                }
            }
        ]);
    };

    const handleEditProduct = (product) => {
        setSelectedProduct(product);
        setViewMode('add-product');
    };

    // --- RENDERERS ---

    if (viewMode === 'add-product') {
        return (
            <VendorAddProduct
                initialData={selectedProduct}
                onCancel={() => {
                    setViewMode('list');
                    setSelectedProduct(null);
                }}
                onSuccess={() => {
                    setViewMode('list');
                    setSelectedProduct(null);
                    fetchDashboardData();
                }}
            />
        );
    }

    if (showCertificate) {
        return <VendorCertificate user={user} vendorData={vendor} onBack={() => setShowCertificate(false)} />;
    }

    if (showRenewal) {
        return <VendorRegister user={user} mode="renew" onBack={() => setShowRenewal(false)} onSubmit={() => { setShowRenewal(false); fetchDashboardData(); }} />;
    }

    const renderHeader = () => (
        <View style={styles.profileHeader}>
            <SafeAreaView style={{ backgroundColor: 'transparent' }}>
                <View style={[styles.profileNav, { paddingBottom: 0 }]}>
                    <Text style={styles.profileNavTitle}>Vendor Dashboard</Text>
                    <TouchableOpacity onPress={onLogout} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                        <Text style={{ color: 'white', fontWeight: '600', marginRight: 6, fontSize: 12 }}>Exit</Text>
                        <Ionicons name="close-circle-outline" size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Image
                            source={{ uri: vendor?.logo_url || user?.user_metadata?.avatar_url || 'https://ui-avatars.com/api/?name=Vendor' }}
                            style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: 'white' }}
                        />
                        <View style={{ marginLeft: 16 }}>
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>{vendor?.business_name || 'My Business'}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: vendor?.is_locked ? '#EF4444' : '#4ADE80', marginRight: 6 }} />
                                <Text style={{ color: '#E2E8F0', fontSize: 12 }}>
                                    {vendor?.is_locked ? 'Locked (Renew Now)' : 'Active • Business Account'}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowCertificate(true)}
                        style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 }}
                    >
                        <Ionicons name="ribbon" size={24} color="#F59E0B" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* TABS */}
            <View style={{ flexDirection: 'row', marginTop: 24, paddingHorizontal: 20, gap: 12 }}>
                {['Overview', 'Products', 'Orders', 'Wallet'].map(tab => {
                    const isActive = activeTab === tab.toLowerCase();
                    return (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab.toLowerCase())}
                            style={{
                                paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
                                backgroundColor: isActive ? 'white' : 'rgba(255,255,255,0.1)'
                            }}
                        >
                            <Text style={{ color: isActive ? '#0F172A' : 'white', fontWeight: '600', fontSize: 12 }}>{tab}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    const renderProducts = () => {
        // Simple Filter Logic matching Admin
        const filteredProducts = products.filter(p => {
            const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase());
            const stock = p.stock_quantity || 0;
            let matchesStock = true;
            if (stockFilter === 'low') matchesStock = stock > 0 && stock < 10;
            if (stockFilter === 'out') matchesStock = stock === 0;
            return matchesSearch && matchesStock;
        });

        return (
            <View style={{ flex: 1, padding: 20 }}>
                {/* Search & Filters */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Ionicons name="search" size={18} color="#94A3B8" />
                        <TextInput
                            placeholder="Search products..."
                            placeholderTextColor="#94A3B8"
                            value={search}
                            onChangeText={setSearch}
                            style={{ flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '500', color: '#0F172A', height: '100%' }}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={() => {
                            if (stockFilter === 'all') setStockFilter('low');
                            else if (stockFilter === 'low') setStockFilter('out');
                            else setStockFilter('all');
                        }}
                        style={{
                            width: 46, height: 46,
                            backgroundColor: stockFilter === 'all' ? 'white' : '#EFF6FF',
                            borderWidth: 1,
                            borderColor: stockFilter === 'all' ? '#E2E8F0' : '#3B82F6',
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Ionicons name="filter" size={20} color={stockFilter === 'all' ? '#64748B' : '#3B82F6'} />
                    </TouchableOpacity>
                </View>

                {stockFilter !== 'all' && (
                    <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#DBEAFE' }}>
                            <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }}>
                                Filter: {stockFilter === 'low' ? 'Low Stock' : 'Out of Stock'}
                            </Text>
                            <TouchableOpacity onPress={() => setStockFilter('all')} style={{ marginLeft: 8 }}>
                                <Ionicons name="close-circle" size={16} color="#3B82F6" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <TouchableOpacity
                    style={localStyles.actionBtn}
                    onPress={() => { setSelectedProduct(null); setViewMode('add-product'); }}
                >
                    <Ionicons name="add-circle" size={24} color="white" />
                    <Text style={{ color: 'white', fontWeight: '700', marginLeft: 8 }}>Add New Product</Text>
                </TouchableOpacity>

                <FlatList
                    data={filteredProducts}
                    keyExtractor={item => item.id}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboardData(); }} />}
                    renderItem={({ item }) => (
                        <View style={localStyles.productCard}>
                            <Image
                                source={{ uri: item.image_url || (item.images && item.images[0]) || 'https://via.placeholder.com/150' }}
                                style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#F1F5F9' }}
                            />
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ fontWeight: '700', fontSize: 14, color: '#0F172A', flex: 1 }} numberOfLines={1}>{item.name}</Text>
                                    {item.status === 'draft' && <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700', backgroundColor: '#F1F5F9', paddingHorizontal: 6, borderRadius: 4 }}>DRAFT</Text>}
                                </View>
                                <Text style={{ color: '#0F172A', fontWeight: '800', marginTop: 4 }}>₦{item.price?.toLocaleString()}</Text>
                                <View style={{ flexDirection: 'row', marginTop: 8, gap: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Ionicons name="cube-outline" size={12} color="#64748B" />
                                        <Text style={{ fontSize: 12, color: item.stock_quantity < 5 ? '#EF4444' : '#64748B', fontWeight: '600' }}>
                                            {item.stock_quantity || 0} Stock
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 12, color: '#64748B' }}>Sales: <Text style={{ fontWeight: '600', color: '#0F172A' }}>{item.sales || 0}</Text></Text>
                                </View>
                            </View>
                            <View style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <TouchableOpacity onPress={() => handleEditProduct(item)} style={{ padding: 8 }}>
                                    <Ionicons name="create-outline" size={20} color="#3B82F6" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteProduct(item.id)} style={{ padding: 8 }}>
                                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', padding: 40 }}>
                            <Text style={{ color: '#94A3B8' }}>No products found matching filters.</Text>
                        </View>
                    }
                />
            </View>
        );
    };

    const renderOverview = () => (
        <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboardData(); }} />}
        >
            {/* STATS GRID */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                <StatCard label="Total Earnings" value={`₦${stats.earnings.toLocaleString()}`} icon="cash" color="#10B981" />
                <StatCard label="Total Orders" value={stats.orders} icon="cart" color="#3B82F6" />
                <StatCard label="Live Products" value={stats.products} icon="cube" color="#F59E0B" />
                <StatCard label="Avg Rating" value="4.8" icon="star" color="#8B5CF6" />
            </View>

            {/* RECENT ORDERS PREVIEW */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>Recent Orders</Text>
                <TouchableOpacity onPress={() => setActiveTab('orders')}>
                    <Text style={{ color: '#3B82F6', fontWeight: '600', fontSize: 13 }}>View All</Text>
                </TouchableOpacity>
            </View>

            {orders.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center', backgroundColor: 'white', borderRadius: 12 }}>
                    <Text style={{ color: '#94A3B8' }}>No orders yet.</Text>
                </View>
            ) : (
                orders.slice(0, 5).map((order, i) => (
                    <View key={i} style={localStyles.orderRow}>
                        <View style={[localStyles.iconBox, { backgroundColor: order.status === 'Pending' ? '#FEF3C7' : '#DCFCE7' }]}>
                            <Ionicons name={order.status === 'Pending' ? 'time' : 'checkmark'} size={18} color={order.status === 'Pending' ? '#D97706' : '#16A34A'} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', fontSize: 14, color: '#0F172A' }} numberOfLines={1}>{order.item}</Text>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>Order #{order.id?.toString().slice(0, 5)} • {order.date}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontWeight: '700', fontSize: 14 }}>₦{order.amount.toLocaleString()}</Text>
                            <Text style={{ fontSize: 10, color: order.status === 'Pending' ? '#D97706' : '#16A34A', fontWeight: '600' }}>{order.status}</Text>
                        </View>
                    </View>
                ))
            )}
        </ScrollView>
    );

    return (
        <View style={styles.container}>
            {renderHeader()}
            <View style={{ flex: 1, marginTop: -20, backgroundColor: '#F8FAFC', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
                {loading ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color="#0F172A" />
                    </View>
                ) : (
                    <>
                        {activeTab === 'overview' && renderOverview()}
                        {activeTab === 'products' && renderProducts()}
                        {activeTab === 'orders' && (
                            <ScrollView contentContainerStyle={{ padding: 20 }}>
                                <Text style={styles.sectionTitle}>All Orders</Text>
                                {orders.map((order, i) => (
                                    <View key={i} style={localStyles.orderRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: '700' }}>{order.item}</Text>
                                            <Text style={{ fontSize: 12, color: '#64748B' }}>{order.status} • {order.date}</Text>
                                        </View>
                                        <Text style={{ fontWeight: '800' }}>₦{order.amount.toLocaleString()}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                        {activeTab === 'wallet' && (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <View style={styles.walletCard}>
                                    <View>
                                        <Text style={styles.walletLabel}>Available Balance</Text>
                                        <Text style={styles.walletBalance}>₦{wallet.balance.toLocaleString()}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.walletBtn}>
                                        <Text style={{ color: 'white' }}>Withdraw</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </>
                )}

                {/* LOCKED OMITTED FOR BREVITY, KEEPING IF NEEDED */}
                {vendor?.is_locked && (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
                        <Ionicons name="lock-closed" size={48} color="#EF4444" />
                        <Text style={{ fontSize: 20, fontWeight: '800', marginTop: 16 }}>Dashboard Locked</Text>
                        <TouchableOpacity style={[styles.modernBtn, { marginTop: 24, width: '100%' }]} onPress={() => setShowRenewal(true)}>
                            <Text style={styles.modernBtnText}>Renew Subscription</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
};

const StatCard = ({ label, value, icon, color }) => (
    <View style={localStyles.statCard}>
        <View style={{ alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon} size={16} color={color} />
            </View>
        </View>
        <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '800', marginTop: 4 }}>{value}</Text>
    </View>
);

const localStyles = {
    statCard: { width: '48%', backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, elevation: 2 },
    orderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
    iconBox: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', padding: 16, borderRadius: 12, marginBottom: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, elevation: 4 },
    productCard: { flexDirection: 'row', backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },

    // Modal (No longer used, using AdminAddProduct)
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
};
