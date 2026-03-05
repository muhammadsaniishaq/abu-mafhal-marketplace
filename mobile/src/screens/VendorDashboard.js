import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Image, ActivityIndicator, FlatList, StyleSheet, BackHandler, Modal, TextInput, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { VendorRegister } from './VendorRegister';
import { VendorCertificate } from './VendorCertificate';
import { VendorAddProduct } from './VendorAddProduct'; // Dedicated Vendor Editor

// New Sub-Components
import { VendorOverview } from './VendorOverview';
import { VendorProducts } from './VendorProducts';
import { VendorOrders } from './VendorOrders';
import { VendorWallet } from './VendorWallet';
import { UserAvatar } from '../components/UserAvatar';

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
    const [orderFilter, setOrderFilter] = useState('All');

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

            let deliveryType = vendorData?.delivery_type || 'marketplace';
            if (!vendorData?.delivery_type) {
                const { data: appData } = await supabase.from('vendor_applications').select('delivery_type').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (appData?.delivery_type) deliveryType = appData.delivery_type;
            }
            if (vendorData) setVendor({ ...vendorData, delivery_type: deliveryType });

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

            // 4. Fetch Orders Securely
            if (productsData?.length > 0) {
                const { data: fetchedOrders, error: orderErr } = await supabase.rpc('get_vendor_dashboard_orders', {
                    p_vendor_id: user.id
                });

                let pendingBal = 0;
                let totalEarnings = 0;

                const formattedOrders = (fetchedOrders || []).map(item => {
                    const status = item.status || 'pending';
                    const amount = item.amount || 0;

                    if (status.toLowerCase() === 'delivered') {
                        totalEarnings += amount;
                    } else if (!['cancelled', 'refunded'].includes(status.toLowerCase())) {
                        // Count non-delivered, non-cancelled orders as pending
                        pendingBal += amount;
                    }

                    return {
                        id: item.id,
                        customerName: item.customerName,
                        item: item.item,
                        quantity: item.quantity,
                        amount: amount,
                        status: status,
                        date: new Date(item.raw_date).toLocaleDateString(),
                        raw_date: item.raw_date
                    };
                });

                setOrders(formattedOrders);

                // Merge: use pending from order calc, use balance from DB (which includes delivered earnings via trigger)
                setWallet(prev => ({
                    ...prev,
                    pending_balance: pendingBal
                }));

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

    const handleUpdateOrderStatus = async (orderId, newStatus) => {
        Alert.alert('Update Order', `Mark this order as ${newStatus}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Yes', onPress: async () => {
                    setLoading(true);
                    const { error } = await supabase.rpc('update_vendor_order_status', {
                        p_order_id: orderId,
                        p_vendor_id: user.id,
                        p_new_status: newStatus
                    });
                    if (!error) {
                        fetchDashboardData();
                    } else {
                        Alert.alert('Error', error.message);
                        setLoading(false);
                    }
                }
            }
        ]);
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
                        <UserAvatar
                            user={user}
                            sourceUrl={vendor?.logo_url}
                            size={60}
                            border="white"
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
                        {activeTab === 'overview' && <VendorOverview stats={stats} />}

                        {activeTab === 'products' && (
                            <VendorProducts
                                products={products}
                                search={search}
                                setSearch={setSearch}
                                stockFilter={stockFilter}
                                setStockFilter={setStockFilter}
                                handleEditProduct={handleEditProduct}
                                handleDeleteProduct={handleDeleteProduct}
                                setViewMode={setViewMode}
                                refreshing={refreshing}
                                setRefreshing={setRefreshing}
                                fetchDashboardData={fetchDashboardData}
                            />
                        )}

                        {activeTab === 'orders' && (
                            <VendorOrders
                                orders={orders}
                                vendor={vendor}
                                orderFilter={orderFilter}
                                setOrderFilter={setOrderFilter}
                                handleUpdateOrderStatus={handleUpdateOrderStatus}
                                refreshing={refreshing}
                                setRefreshing={setRefreshing}
                                fetchDashboardData={fetchDashboardData}
                            />
                        )}

                        {activeTab === 'wallet' && (
                            <VendorWallet
                                user={user}
                                wallet={wallet}
                                fetchDashboardData={fetchDashboardData}
                            />
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
