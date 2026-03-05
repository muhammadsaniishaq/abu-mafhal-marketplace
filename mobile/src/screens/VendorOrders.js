import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const VendorOrders = ({
    orders,
    vendor,
    orderFilter,
    setOrderFilter,
    refreshing,
    setRefreshing,
    fetchDashboardData,
    handleUpdateOrderStatus
}) => {

    const filteredOrders = orders.filter(o => orderFilter === 'All' || o.status?.toLowerCase() === orderFilter.toLowerCase());

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Filter Chips */}
            <View style={{ backgroundColor: 'white' }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' }}
                >
                    {['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(f => (
                        <TouchableOpacity
                            key={f}
                            style={{
                                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: orderFilter === f ? '#0F172A' : '#F1F5F9', marginRight: 8
                            }}
                            onPress={() => setOrderFilter(f)}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: orderFilter === f ? 'white' : '#64748B' }}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Orders List */}
            <FlatList
                data={filteredOrders}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboardData(); }} />}
                renderItem={({ item }) => {
                    let statusColor = '#3B82F6';
                    let statusBg = '#EFF6FF';
                    const statusLower = item.status?.toLowerCase();
                    if (statusLower === 'pending') { statusColor = '#D97706'; statusBg = '#FEF3C7'; }
                    if (statusLower === 'delivered') { statusColor = '#10B981'; statusBg = '#DCFCE7'; }
                    if (statusLower === 'cancelled') { statusColor = '#EF4444'; statusBg = '#FEE2E2'; }

                    return (
                        <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.05)', elevation: 2 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="receipt-outline" size={20} color="#0F172A" />
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Order #{item.id?.toString().slice(0, 8).toUpperCase()}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{item.date}</Text>
                                    </View>
                                </View>
                                <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: statusBg }}>
                                    <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: statusColor }}>
                                        {item.status?.toUpperCase() || 'UNKNOWN'}
                                    </Text>
                                </View>
                            </View>

                            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{item.item}</Text>
                                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Qty: {item.quantity || 1} • Customer: {item.customerName}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 2 }}>Earnings</Text>
                                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#10B981' }}>₦{item.amount?.toLocaleString()}</Text>
                                </View>
                            </View>

                            {/* ACTION BUTTONS */}
                            {vendor?.delivery_type === 'self' ? (
                                <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
                                    {statusLower === 'pending' && (
                                        <TouchableOpacity
                                            style={{ flex: 1, backgroundColor: '#3B82F6', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                                            onPress={() => handleUpdateOrderStatus(item.id, 'Shipped')}
                                        >
                                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Mark as Shipped</Text>
                                        </TouchableOpacity>
                                    )}
                                    {['pending', 'processing', 'shipped'].includes(statusLower) && (
                                        <TouchableOpacity
                                            style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                                            onPress={() => handleUpdateOrderStatus(item.id, 'Delivered')}
                                        >
                                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Mark Delivered</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ) : (
                                <View style={{ marginTop: 16, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="car-outline" size={16} color="#3B82F6" />
                                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Admin will handle delivery for this order.</Text>
                                </View>
                            )}
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', padding: 40 }}>
                        <Ionicons name="bag-remove-outline" size={48} color="#CBD5E1" />
                        <Text style={{ color: '#94A3B8', marginTop: 16 }}>No orders found in this category.</Text>
                    </View>
                }
            />
        </View>
    );
};
