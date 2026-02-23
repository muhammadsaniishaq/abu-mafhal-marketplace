import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, ScrollView, Image, TextInput, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';
import { sendOrderStatusUpdateEmail, sendDriverAssignmentEmail } from '../../services/simpleEmailService';

export const AdminOrders = () => {
    const [orders, setOrders] = useState([]);
    const [drivers, setDrivers] = useState([]); // Drivers state
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchOrders();
        fetchDrivers(); // Fetch drivers setup
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        // Include drivers join
        // Removed phone_number from profiles join as it doesn't exist
        const { data, error } = await supabase
            .from('orders')
            .select('*, user:profiles(full_name, email), driver:drivers(name, vehicle_type, phone, xp)')
            .order('created_at', { ascending: false });

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    const fetchDrivers = async () => {
        const { data, error } = await supabase
            .from('drivers')
            .select('*, user:profiles(email)');
        if (!error) setDrivers(data || []);
    };

    const updateStatus = async (id, newStatus, currentOrder = null) => {
        setUpdating(true);
        const statusLower = newStatus.toLowerCase();

        const { error } = await supabase
            .from('orders')
            .update({ status: statusLower })
            .eq('id', id);

        if (error) {
            Alert.alert('Error', 'Failed to update status');
        } else {
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status: statusLower } : o));
            if (selectedOrder) setSelectedOrder(prev => ({ ...prev, status: statusLower }));

            // Send Email Notification
            const orderToNotify = currentOrder || orders.find(o => o.id === id);
            if (orderToNotify?.user?.email) {
                try {
                    await sendOrderStatusUpdateEmail({
                        name: orderToNotify.user.full_name || 'Customer',
                        email: orderToNotify.user.email,
                        orderId: id,
                        status: newStatus
                    });
                    // Toast or silent success
                } catch (emailErr) {
                    console.log("Email failed", emailErr);
                }
            }

            Alert.alert('Success', 'Order marked as ' + newStatus);
        }
        setUpdating(false);
    };

    const assignDriver = async (orderId, driverId) => {
        setUpdating(true);
        const { error } = await supabase
            .from('orders')
            .update({ driver_id: driverId, status: 'shipped' }) // Auto update status to shipped when assigned
            .eq('id', orderId);

        if (error) {
            Alert.alert('Error', 'Failed to assign driver');
        } else {
            const assignedDriver = drivers.find(d => d.id === driverId);
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, driver_id: driverId, driver: assignedDriver, status: 'shipped' } : o));
            if (selectedOrder) setSelectedOrder(prev => ({ ...prev, driver_id: driverId, driver: assignedDriver, status: 'shipped' }));

            Alert.alert('Success', 'Driver assigned: ' + (assignedDriver?.name || ''));

            // Also notify user that order is shipped/assigned
            const orderToNotify = orders.find(o => o.id === orderId) || { ...selectedOrder, id: orderId };
            if (orderToNotify?.user?.email) {
                sendOrderStatusUpdateEmail({
                    name: orderToNotify.user.full_name || 'Customer',
                    email: orderToNotify.user.email,
                    orderId: orderId,
                    status: 'Shipped (Driver Assigned)'
                }).catch(err => console.log("Customer Email err", err));
            } else {
                console.log("Customer email missing for notification", orderToNotify?.id);
            }

            // Notify Driver
            if (assignedDriver?.user?.email) {
                const addressData = typeof orderToNotify.shipping_address === 'string'
                    ? JSON.parse(orderToNotify.shipping_address)
                    : orderToNotify.shipping_address;

                sendDriverAssignmentEmail({
                    driverName: assignedDriver.name,
                    driverEmail: assignedDriver.user.email,
                    orderId: orderId,
                    pickupAddress: 'Abu Mafhal Central Hub',
                    deliveryAddress: addressData?.address || 'Customer Location',
                    customerPhone: addressData?.phone || addressData?.phoneNumber || orderToNotify.user?.phone || 'N/A',
                    earnings: '500.00'
                }).catch(err => console.log("Driver Email Error", err));
            } else {
                console.log("Driver email missing for notification", assignedDriver?.name);
            }
        }
        setUpdating(false);
    };

    const handleCall = (phoneNumber) => {
        if (!phoneNumber) return Alert.alert("No Phone", "Phone number not available.");
        Linking.openURL('tel:' + phoneNumber);
    };

    const handleShare = (order) => {
        const message = `Order #${order.id.slice(0, 8).toUpperCase()}\nCustomer: ${order.user?.full_name}\nAmount: ₦${order.total_amount?.toLocaleString()}\nStatus: ${order.status?.toUpperCase()}`;
        Share.share({ message });
    };

    const getCustomerPhone = (order) => {
        // Try to get phone from shipping address first (most reliable for order)
        let phone = null;
        if (order.shipping_address) {
            const address = typeof order.shipping_address === 'string'
                ? JSON.parse(order.shipping_address)
                : order.shipping_address;
            phone = address?.phone || address?.phoneNumber;
        }
        // Fallback to user profile if we had it (but we don't now)
        return phone;
    };

    // Stats Calculation
    const stats = useMemo(() => {
        const totalRevenue = orders.reduce((sum, o) => sum + (o.payment_status === 'paid' ? o.total_amount : 0), 0);
        const pendingCount = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
        const deliveredCount = orders.filter(o => o.status === 'delivered').length;
        return { totalRevenue, pendingCount, deliveredCount };
    }, [orders]);

    const filteredOrders = useMemo(() => {
        let result = orders;
        if (filter !== 'All') {
            result = result.filter(o => o.status?.toLowerCase() === filter.toLowerCase());
        }
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(o =>
                o.id.toLowerCase().includes(lowerQuery) ||
                o.user?.full_name?.toLowerCase().includes(lowerQuery) ||
                o.user?.email?.toLowerCase().includes(lowerQuery)
            );
        }
        return result;
    }, [orders, filter, searchQuery]);

    const getLevel = (xp) => {
        if (!xp) return 'Bronze';
        if (xp < 100) return 'Bronze';
        if (xp < 500) return 'Silver';
        if (xp < 2000) return 'Gold';
        return 'Elite';
    };

    const renderOrderItem = ({ item }) => {
        const status = item.status?.toLowerCase();
        const isPending = status === 'pending' || status === 'processing';
        const isDelivered = status === 'delivered';
        const driverLevel = item.driver ? getLevel(item.driver.xp) : null;

        return (
            <TouchableOpacity
                style={localStyles.orderCard}
                onPress={() => setSelectedOrder(item)}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={{ fontSize: 14, color: '#334155' }}>
                            {item.user?.full_name || item.user?.email || 'Unknown User'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#94A3B8' }}>{item.items_count || 1} items • ₦{item.total_amount?.toLocaleString()}</Text>

                        {/* Driver Preview */}
                        {item.driver && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="bicycle" size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 11, color: '#3B82F6', fontWeight: '600' }}>{item.driver.name}</Text>
                                </View>
                                <View style={[localStyles.miniLevelBadge, { backgroundColor: driverLevel === 'Elite' ? '#FDE68A' : '#E0E7FF' }]}>
                                    <Text style={{ fontSize: 8, fontWeight: '800', color: driverLevel === 'Elite' ? '#B45309' : '#3B82F6' }}>{driverLevel.toUpperCase()}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                    <View style={[localStyles.badge, { backgroundColor: isDelivered ? '#DCFCE7' : isPending ? '#FEF3C7' : '#F1F5F9' }]}>
                        <Text style={{ color: isDelivered ? '#10B981' : isPending ? '#D97706' : '#64748B', fontSize: 10, fontWeight: '700' }}>
                            {item.status?.toUpperCase() || 'UNKNOWN'}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* STATS HEADER */}
            <View style={{ backgroundColor: 'white', padding: 16, paddingBottom: 10 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                    <View style={localStyles.statCard}>
                        <Text style={localStyles.statLabel}>Total Revenue</Text>
                        <Text style={localStyles.statValue}>₦{stats.totalRevenue.toLocaleString()}</Text>
                    </View>
                    <View style={localStyles.statCard}>
                        <Text style={localStyles.statLabel}>Pending Orders</Text>
                        <Text style={localStyles.statValue}>{stats.pendingCount}</Text>
                    </View>
                    <View style={localStyles.statCard}>
                        <Text style={localStyles.statLabel}>Delivered</Text>
                        <Text style={localStyles.statValue}>{stats.deliveredCount}</Text>
                    </View>
                </ScrollView>

                {/* SEARCH BAR */}
                <View style={localStyles.searchContainer}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        placeholder="Search ID, Name, Email..."
                        style={localStyles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* FILTERS */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    {['All', 'Pending', 'Delivered', 'Cancelled'].map(f => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setFilter(f)}
                            style={[localStyles.filterChip, filter === f && localStyles.activeFilter]}
                        >
                            <Text style={{ color: filter === f ? 'white' : '#64748B', fontSize: 12, fontWeight: '600' }}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? <ActivityIndicator color="#0F172A" style={{ marginTop: 50 }} /> : (
                <FlatList
                    data={filteredOrders}
                    keyExtractor={item => item.id}
                    renderItem={renderOrderItem}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 50 }}>No orders found.</Text>}
                />
            )}

            {/* ORDER DETAILS MODAL */}
            <Modal visible={!!selectedOrder} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '90%', padding: 20 }}>
                        {selectedOrder && (
                            <>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <View>
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Order Details</Text>
                                        <Text style={{ fontSize: 12, color: '#64748B' }}>#{selectedOrder.id.toUpperCase()}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <TouchableOpacity onPress={() => handleShare(selectedOrder)}>
                                            <Ionicons name="share-outline" size={24} color="#0F172A" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                                            <Ionicons name="close-circle" size={28} color="#94A3B8" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false}>
                                    <View style={localStyles.detailSection}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'start' }}>
                                            <View>
                                                <Text style={localStyles.detailLabel}>Customer</Text>
                                                <Text style={localStyles.detailValue}>{selectedOrder.user?.full_name || 'N/A'}</Text>
                                                <Text style={{ fontSize: 14, color: '#64748B' }}>{selectedOrder.user?.email}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => handleCall(getCustomerPhone(selectedOrder))} style={localStyles.callBtnSmall}>
                                                <Ionicons name="call" size={16} color="white" />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                                            <Ionicons name="location" size={16} color="#64748B" style={{ marginRight: 8 }} />
                                            <Text style={{ fontSize: 13, color: '#475569', flex: 1 }}>
                                                {typeof selectedOrder.shipping_address === 'string'
                                                    ? JSON.parse(selectedOrder.shipping_address).address
                                                    : selectedOrder.shipping_address?.address || 'No Address'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* DRIVER ASSIGNMENT */}
                                    <View style={localStyles.detailSection}>
                                        <Text style={localStyles.detailLabel}>Logistics & Delivery</Text>
                                        <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>Assign Driver:</Text>

                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                                            {drivers.map(driver => {
                                                const dLevel = getLevel(driver.xp);
                                                return (
                                                    <TouchableOpacity
                                                        key={driver.id}
                                                        onPress={() => assignDriver(selectedOrder.id, driver.id)}
                                                        style={[
                                                            localStyles.driverChip,
                                                            selectedOrder.driver_id === driver.id && localStyles.activeDriverChip
                                                        ]}
                                                        disabled={updating}
                                                    >
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <Ionicons name="bicycle" size={14} color={selectedOrder.driver_id === driver.id ? 'white' : '#3B82F6'} />
                                                            <Text style={[
                                                                localStyles.driverChipText,
                                                                selectedOrder.driver_id === driver.id && { color: 'white' }
                                                            ]}>{driver.name}</Text>
                                                            <View style={[localStyles.miniLevelBadge, { backgroundColor: dLevel === 'Elite' ? '#FDE68A' : '#E0E7FF' }]}>
                                                                <Text style={{ fontSize: 7, fontWeight: '800', color: dLevel === 'Elite' ? '#B45309' : '#3B82F6' }}>{dLevel[0]}</Text>
                                                            </View>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                            {drivers.length === 0 && <Text style={{ fontSize: 12, color: '#EB5757' }}>No drivers available in database.</Text>}
                                        </View>

                                        {selectedOrder.driver && (
                                            <View style={{ marginTop: 16, padding: 12, backgroundColor: '#F0F9FF', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Ionicons name="checkmark-circle" size={20} color="#3B82F6" style={{ marginRight: 8 }} />
                                                    <View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <Text style={{ color: '#0369A1', fontSize: 12, fontWeight: '600' }}>Active Driver: {selectedOrder.driver.name}</Text>
                                                            <View style={[localStyles.miniLevelBadge, { backgroundColor: getLevel(selectedOrder.driver.xp) === 'Elite' ? '#FDE68A' : '#E2E8F0' }]}>
                                                                <Text style={{ fontSize: 8, fontWeight: '800', color: getLevel(selectedOrder.driver.xp) === 'Elite' ? '#B45309' : '#3B82F6' }}>{getLevel(selectedOrder.driver.xp)}</Text>
                                                            </View>
                                                        </View>
                                                        <Text style={{ color: '#60A5FA', fontSize: 11 }}>{selectedOrder.driver.vehicle_type} • {selectedOrder.driver.xp || 0} XP</Text>
                                                    </View>
                                                </View>
                                                <TouchableOpacity onPress={() => handleCall(selectedOrder.driver.phone)} style={localStyles.callBtnSmall}>
                                                    <Ionicons name="call" size={14} color="white" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>

                                    <View style={localStyles.detailSection}>
                                        <Text style={localStyles.detailLabel}>Update Status</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                            {['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(status => (
                                                <TouchableOpacity
                                                    key={status}
                                                    onPress={() => updateStatus(selectedOrder.id, status, selectedOrder)}
                                                    disabled={updating}
                                                    style={[
                                                        localStyles.statusBtn,
                                                        selectedOrder.status?.toLowerCase() === status.toLowerCase() && { backgroundColor: '#0F172A', borderColor: '#0F172A' }
                                                    ]}
                                                >
                                                    {updating && selectedOrder.status?.toLowerCase() === status.toLowerCase() ?
                                                        <ActivityIndicator color="white" size="small" /> :
                                                        <Text style={{ color: selectedOrder.status?.toLowerCase() === status.toLowerCase() ? 'white' : '#0F172A', fontSize: 12, fontWeight: '600' }}>{status}</Text>
                                                    }
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const localStyles = {
    orderCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',shadowRadius: 5 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
    activeFilter: { backgroundColor: '#0F172A' },
    detailSection: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 16 },
    detailLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    detailValue: { fontSize: 16, color: '#0F172A', fontWeight: '600' },
    statusBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'white', minWidth: 80, alignItems: 'center' },
    driverChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0' },
    activeDriverChip: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
    driverChipText: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
    miniLevelBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    // driverCard removed in favor of chips
    statCard: { backgroundColor: 'white', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 100 },
    statLabel: { fontSize: 11, color: '#64748B', marginBottom: 4, fontWeight: '600' },
    statValue: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#0F172A' },
    callBtnSmall: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }
};
