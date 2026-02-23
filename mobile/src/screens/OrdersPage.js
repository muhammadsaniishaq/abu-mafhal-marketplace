import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export const OrdersPage = ({ onBack, user, onNavigate }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('All');

    useEffect(() => {
        if (user) {
            fetchOrders();
        }
    }, [user]);

    const fetchOrders = async () => {
        if (!user) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id || user.sub)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error.message);
        } else {
            setOrders(data || []);
        }
        setLoading(false);
        setRefreshing(false);
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    const filteredOrders = orders.filter(o => filter === 'All' || o.status?.toLowerCase() === filter.toLowerCase());

    const renderOrderItem = ({ item }) => {
        const isDelivered = item.status === 'delivered';
        const isCancelled = item.status === 'cancelled';

        let statusColor = '#3B82F6'; // Default blue (Processing/Shipped)
        let statusBg = '#EFF6FF';
        if (item.status === 'pending') { statusColor = '#D97706'; statusBg = '#FEF3C7'; } // Yellow
        if (isDelivered) { statusColor = '#10B981'; statusBg = '#DCFCE7'; } // Green
        if (isCancelled) { statusColor = '#EF4444'; statusBg = '#FEE2E2'; } // Red

        return (
            <TouchableOpacity
                style={styles.orderCard}
                onPress={() => onNavigate('TrackOrder', { order: item })}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={styles.iconBox}>
                            <Ionicons name="cube-outline" size={20} color="#0F172A" />
                        </View>
                        <View>
                            <Text style={styles.orderId}>Order #{item.id.slice(0, 8).toUpperCase()}</Text>
                            <Text style={styles.orderDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {item.status?.toUpperCase() || 'UNKNOWN'}
                        </Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardFooter}>
                    <View>
                        <Text style={styles.footerLabel}>Items</Text>
                        <Text style={styles.footerValue}>{item.order_items?.length || item.items_count || 1} Items</Text>
                    </View>
                    <View>
                        <Text style={styles.footerLabel}>Amount</Text>
                        <Text style={styles.footerValuePrimary}>₦{item.total_amount?.toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.trackBtn}
                        onPress={() => onNavigate('TrackOrder', { order: item })}
                    >
                        <Text style={styles.trackBtnText}>Track</Text>
                        <Ionicons name="chevron-forward" size={14} color="white" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Orders</Text>
                <View style={{ width: 44 }} />
            </View>

            {/* Filter Chips */}
            <View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterContainer}
                >
                    {['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(f => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterChip, filter === f && styles.activeFilterChip]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#0F172A" />
                </View>
            ) : (
                <FlatList
                    data={filteredOrders}
                    keyExtractor={item => item.id}
                    renderItem={renderOrderItem}
                    contentContainerStyle={styles.listContainer}
                    onRefresh={handleRefresh}
                    refreshing={refreshing}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="receipt-outline" size={64} color="#CBD5E1" />
                            <Text style={styles.emptyTitle}>No Orders Found</Text>
                            <Text style={styles.emptySub}>You haven't placed any orders in this category yet.</Text>
                            <TouchableOpacity style={styles.shopBtn} onPress={() => onNavigate('shop')}>
                                <Text style={styles.shopBtnText}>Start Shopping</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'white' },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    filterContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9' },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8 },
    activeFilterChip: { backgroundColor: '#0F172A' },
    filterText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    activeFilterText: { color: 'white' },

    listContainer: { padding: 20, paddingBottom: 100 },

    orderCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.05)', elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
    orderId: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    orderDate: { fontSize: 12, color: '#64748B', marginTop: 2 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 4 },
    footerValue: { fontSize: 14, fontWeight: '700', color: '#334155' },
    footerValuePrimary: { fontSize: 15, fontWeight: '800', color: '#0F172A' },

    trackBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 4 },
    trackBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 16 },
    emptySub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 20 },
    shopBtn: { marginTop: 24, backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
    shopBtnText: { color: 'white', fontWeight: '700', fontSize: 15 }
});
