import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Linking, ActivityIndicator, Modal, Image, Switch, Platform, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const PRIMARY_COLOR = '#6366F1'; // Indigo
const ACCENT_COLOR = '#8B5CF6';  // Violet
const SUCCESS_COLOR = '#10B981'; // Emerald
const DANGER_COLOR = '#EF4444';  // Rose

export const DriverDashboard = ({ user, onLogout }) => {
    // Data State
    const [orders, setOrders] = useState([]);
    const [poolOrders, setPoolOrders] = useState([]);
    const [historyOrders, setHistoryOrders] = useState([]);
    const [driverProfile, setDriverProfile] = useState(null);
    const [stats, setStats] = useState({ totalEarnings: 0, completedDeliveries: 0, weeklyDaily: [] });

    // UI State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('active'); // 'pool', 'active', 'history', 'profile'
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Form States
    const [isVehicleModalVisible, setVehicleModalVisible] = useState(false);
    const [isWithdrawModalVisible, setWithdrawModalVisible] = useState(false);
    const [vType, setVType] = useState('');
    const [pNumber, setPNumber] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');

    useEffect(() => {
        fetchDriverProfile();

        // Real-time listener for new order assignments
        const subscription = supabase
            .channel('driver_orders')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders'
            }, (payload) => {
                console.log('Realtime Update Received:', payload.eventType, payload.new?.id);

                // Check if the order is assigned to this driver or was unassigned from them
                const newDriverId = payload.new?.driver_id;
                const oldDriverId = payload.old?.driver_id;

                if (driverProfile && (newDriverId === driverProfile.id || oldDriverId === driverProfile.id)) {
                    console.log('Order matches driver!', payload.new?.id);
                    fetchAllOrders(driverProfile.id);
                } else if (!newDriverId && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
                    // Also refresh pool if an unassigned order is created or updated
                    console.log('Refreshing pool orders...');
                    fetchAllOrders(driverProfile ? driverProfile.id : null);
                }
            })
            .subscribe((status) => {
                console.log('Realtime Subscription Status:', status);
            });

        return () => supabase.removeChannel(subscription);
    }, [user.id, driverProfile?.id]);

    const fetchDriverProfile = async () => {
        try {
            const { data, error } = await supabase.rpc('ensure_driver_profile');
            if (data) {
                setDriverProfile(data);
                setVType(data.vehicle_type || '');
                setPNumber(data.plate_number || '');
                fetchAllOrders(data.id);
            } else {
                setLoading(false);
                Alert.alert('Error', 'Could not load driver profile.');
            }
        } catch (e) {
            setLoading(false);
        }
    };

    const fetchAllOrders = async (driverId) => {
        try {
            const { data: myOrders } = await supabase
                .from('orders')
                .select('*, user:profiles(full_name, phone), items:order_items(*)')
                .eq('driver_id', driverId)
                .order('created_at', { ascending: false });

            if (myOrders) {
                setOrders(myOrders.filter(o => ['shipped', 'processing'].includes(o.status)));
                setHistoryOrders(myOrders.filter(o => ['delivered', 'cancelled'].includes(o.status)));
                calculateStats(myOrders);
            }

            const { data: poolData } = await supabase
                .from('orders')
                .select('*, user:profiles(full_name, phone), items:order_items(*)')
                .is('driver_id', null)
                .in('status', ['processing', 'pending'])
                .order('created_at', { ascending: false });

            if (poolData) setPoolOrders(poolData);

        } catch (e) {
            console.log("Fetch Error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const calculateStats = (allOrders) => {
        const completed = allOrders.filter(o => o.status === 'delivered');
        const cancelled = allOrders.filter(o => o.status === 'cancelled');
        const earnings = completed.reduce((sum, order) => sum + (order.delivery_fee || 500), 0);

        const totalFinished = completed.length + cancelled.length;
        const rate = totalFinished > 0 ? Math.round((completed.length / totalFinished) * 100) : 100;

        // Calculate daily series for chart & list
        const daily = [];
        const dailyList = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayOrders = completed.filter(o => o.updated_at?.startsWith(dateStr));
            const amount = dayOrders.reduce((sum, o) => sum + (o.delivery_fee || 500), 0);

            daily.push({ day: d.toLocaleDateString('en-US', { weekday: 'short' }), amount });
            if (amount > 0) {
                dailyList.push({
                    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    amount,
                    count: dayOrders.length
                });
            }
        }

        // Gamification Logic
        const xp = driverProfile?.xp || 0;
        const level = xp < 100 ? 'Bronze' : xp < 500 ? 'Silver' : xp < 2000 ? 'Gold' : 'Elite';
        const nextLevelXP = xp < 100 ? 100 : xp < 500 ? 500 : xp < 2000 ? 2000 : 5000;
        const xpProgress = Math.min((xp / nextLevelXP) * 100, 100);

        setStats({
            totalEarnings: earnings,
            completedDeliveries: completed.length,
            weeklyDaily: daily,
            dailyList,
            completionRate: rate,
            level,
            xp,
            xpProgress
        });
    };

    const handleRefresh = () => {
        if (driverProfile) {
            setRefreshing(true);
            fetchAllOrders(driverProfile.id);
        }
    };

    const toggleStatus = async () => {
        if (!driverProfile) return;
        const newStatus = driverProfile.status === 'active' ? 'inactive' : 'active';
        setDriverProfile({ ...driverProfile, status: newStatus });

        const { error } = await supabase
            .from('drivers')
            .update({ status: newStatus })
            .eq('id', driverProfile.id);

        if (error) {
            Alert.alert('Error', "Failed to update status");
            setDriverProfile({ ...driverProfile, status: driverProfile.status === 'active' ? 'inactive' : 'active' });
        }
    };

    const acceptOrder = async (orderId) => {
        Alert.alert('Pickup Order', 'Are you ready to start this delivery?', [
            { text: 'Later', style: 'cancel' },
            {
                text: 'Accept',
                onPress: async () => {
                    const { error } = await supabase
                        .from('orders')
                        .update({ driver_id: driverProfile.id, status: 'shipped' })
                        .eq('id', orderId);

                    if (error) Alert.alert('Error', error.message);
                    else {
                        Alert.alert('Success', 'Order accepted! Go to active tab.');
                        handleRefresh();
                        setActiveTab('active');
                    }
                }
            }
        ]);
    };

    const markDelivered = async (orderId) => {
        Alert.alert('Complete Delivery', 'Confirm item has been handed to customer?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm',
                onPress: async () => {
                    const { error } = await supabase.rpc('complete_delivery', {
                        p_order_id: orderId,
                        p_driver_id: driverProfile.id
                    });

                    if (error) Alert.alert('Error', error.message);
                    else {
                        Alert.alert('Great Job!', 'Order delivered. Earnings added to wallet.');
                        handleRefresh();
                    }
                }
            }
        ]);
    };

    const updateVehicleDetails = async () => {
        const { error } = await supabase.rpc('update_driver_vehicle', {
            p_vehicle_type: vType,
            p_plate_number: pNumber
        });

        if (error) Alert.alert('Error', error.message);
        else {
            setDriverProfile({ ...driverProfile, vehicle_type: vType, plate_number: pNumber });
            setVehicleModalVisible(false);
            Alert.alert('Success', 'Vehicle profile updated.');
        }
    };

    const requestWithdrawal = async () => {
        const amount = parseFloat(withdrawAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
        }

        const { data, error } = await supabase.rpc('request_withdrawal', { p_amount: amount });

        if (error) Alert.alert('Error', error.message);
        else {
            Alert.alert('Request Sent', data);
            setWithdrawModalVisible(false);
            setWithdrawAmount('');
        }
    };

    const handleCall = (phone) => phone ? Linking.openURL(`tel:${phone}`) : Alert.alert('Error', 'No phone available');
    const handleMap = (address) => {
        const url = Platform.select({ ios: `maps:0,0?q=${encodeURIComponent(address)}`, android: `geo:0,0?q=${encodeURIComponent(address)}` });
        Linking.openURL(url);
    };

    const parseAddress = (addrJson) => {
        try { return JSON.parse(addrJson)?.address || addrJson; } catch (e) { return addrJson; }
    };

    const renderOrderItem = ({ item }) => {
        const address = parseAddress(item.shipping_address);
        const isPool = activeTab === 'pool';
        const isHistory = activeTab === 'history';

        return (
            <View style={[styles.modernCard, isHistory && { opacity: 0.8 }]}>
                <View style={styles.cardBadgeRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.cardId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                        {item.notes && (
                            <View style={styles.noteIndicator}>
                                <Ionicons name="chatbubble-ellipses" size={12} color={PRIMARY_COLOR} />
                                <Text style={styles.noteIndicatorText}>Has Note</Text>
                            </View>
                        )}
                    </View>
                    <View style={[styles.badge,
                    item.status === 'delivered' ? styles.badgeSuccess :
                        item.status === 'shipped' ? styles.badgeInfo : styles.badgeWarn]}>
                        <Text style={[styles.badgeText,
                        item.status === 'delivered' ? { color: SUCCESS_COLOR } :
                            item.status === 'shipped' ? { color: PRIMARY_COLOR } : { color: '#B45309' }]}>
                            {item.status.toUpperCase()}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity onPress={() => setSelectedOrder(item)}>
                    <View style={styles.locationGroup}>
                        <View style={styles.locIconCol}>
                            <View style={styles.dotIndigo} />
                            <View style={styles.dashLine} />
                            <Ionicons name="location" size={18} color={PRIMARY_COLOR} />
                        </View>
                        <View style={styles.locTextCol}>
                            <Text style={styles.locStepLabel}>Pickup</Text>
                            <Text style={styles.locName} numberOfLines={1}>Vendor Location</Text>
                            <View style={{ height: 12 }} />
                            <Text style={styles.locStepLabel}>Delivery</Text>
                            <Text style={styles.locName} numberOfLines={1}>{address}</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {item.notes && (
                    <View style={styles.cardNoteBox}>
                        <Text style={styles.cardNoteText} numberOfLines={2}>“{item.notes}”</Text>
                    </View>
                )}

                <View style={styles.divider} />

                <View style={styles.cardFooter}>
                    <View>
                        <Text style={styles.footerLabel}>Earnings</Text>
                        <Text style={styles.footerValue}>₦{(item.delivery_fee || 500).toLocaleString()}</Text>
                    </View>
                    <View style={styles.actionGroup}>
                        {!isHistory && (
                            <TouchableOpacity onPress={() => handleMap(address)} style={styles.iconCircle}>
                                <Ionicons name="map-outline" size={20} color={PRIMARY_COLOR} />
                            </TouchableOpacity>
                        )}
                        {!isPool && !isHistory && (
                            <TouchableOpacity onPress={() => handleCall(item.user?.phone)} style={[styles.iconCircle, { backgroundColor: '#D1FAE5' }]}>
                                <Ionicons name="call" size={20} color={SUCCESS_COLOR} />
                            </TouchableOpacity>
                        )}
                        {isPool ? (
                            <TouchableOpacity style={styles.mainActionBtn} onPress={() => acceptOrder(item.id)}>
                                <Text style={styles.mainActionText}>Accept</Text>
                            </TouchableOpacity>
                        ) : !isHistory ? (
                            <TouchableOpacity style={[styles.mainActionBtn, { backgroundColor: SUCCESS_COLOR }]} onPress={() => markDelivered(item.id)}>
                                <Text style={styles.mainActionText}>Finish</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={[styles.mainActionBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => setSelectedOrder(item)}>
                                <Text style={[styles.mainActionText, { color: '#64748B' }]}>Details</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* GLASS HEADER */}
            <View style={styles.header}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.welcomeText}>PRO DRIVER</Text>
                        <View style={[styles.levelBadge, { backgroundColor: stats.level === 'Elite' ? '#FDE68A' : '#E0E7FF' }]}>
                            <Text style={[styles.levelBadgeText, { color: stats.level === 'Elite' ? '#B45309' : PRIMARY_COLOR }]}>{stats.level}</Text>
                        </View>
                    </View>
                    <Text style={styles.driverIdText}>{user.full_name}</Text>
                </View>
                <View style={styles.headerRight}>
                    <View style={styles.statusBox}>
                        <Text style={[styles.statusToggleText, { color: driverProfile?.status === 'active' ? SUCCESS_COLOR : '#94A3B8' }]}>
                            {driverProfile?.status === 'active' ? 'ONLINE' : 'OFFLINE'}
                        </Text>
                        <Switch
                            value={driverProfile?.status === 'active'}
                            onValueChange={toggleStatus}
                            trackColor={{ false: '#E2E8F0', true: '#D1FAE5' }}
                            thumbColor={driverProfile?.status === 'active' ? SUCCESS_COLOR : '#94A3B8'}
                        />
                    </View>
                    <TouchableOpacity onPress={onLogout} style={styles.logoutIcon}>
                        <Ionicons name="power" size={22} color={DANGER_COLOR} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* XP PROGRESS BAR */}
            <View style={styles.xpBarContainer}>
                <View style={[styles.xpBarFill, { width: `${stats.xpProgress}%` }]} />
                <Text style={styles.xpText}>{stats.xp} / {stats.xpProgress >= 100 ? 'MAX' : 'NEXT LEVEL'} XP</Text>
            </View>

            {/* TAB SELECTOR */}
            <View style={styles.tabBar}>
                {['active', 'pool', 'history', 'profile'].map(tab => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                    >
                        <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                        {activeTab === tab && <View style={styles.tabIndicator} />}
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                contentContainerStyle={styles.scrollContent}
            >
                {/* WALLET & CHART (Only if profile/history isn't active list) */}
                {(activeTab === 'active' || activeTab === 'profile') && (
                    <View style={styles.modernWalletCard}>
                        <Image blurRadius={80} source={{ uri: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop' }} style={styles.walletBg} />
                        <View style={styles.walletContent}>
                            <View>
                                <Text style={styles.walletLabel}>Current Balance</Text>
                                <Text style={styles.walletValue}>₦{stats.totalEarnings.toLocaleString()}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setWithdrawModalVisible(true)} style={styles.withdrawBtn}>
                                <Text style={styles.withdrawBtnText}>Withdraw</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.chartContainer}>
                            {stats.weeklyDaily?.map((d, i) => (
                                <View key={i} style={styles.chartCol}>
                                    <View style={[styles.chartBar, { height: Math.max(5, (d.amount / 5000) * 80) }]} />
                                    <Text style={styles.chartDay}>{d.day}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* EARNINGS LIST (Detail View) */}
                {activeTab === 'profile' && stats.dailyList?.length > 0 && (
                    <View style={styles.earningsListSection}>
                        <Text style={styles.sectionTitle}>Daily Earnings</Text>
                        {stats.dailyList.map((item, idx) => (
                            <View key={idx} style={styles.dailyRow}>
                                <Text style={styles.dailyDate}>{item.date}</Text>
                                <Text style={styles.dailyCount}>{item.count} orders</Text>
                                <Text style={styles.dailyAmount}>₦{item.amount.toLocaleString()}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* CONTENT LIST */}
                {loading ? (
                    <ActivityIndicator color={PRIMARY_COLOR} size="large" style={{ marginTop: 40 }} />
                ) : activeTab === 'profile' ? (
                    <View style={styles.profileSection}>
                        <View style={styles.settingsCard}>
                            <Text style={styles.sectionTitle}>Vehicle Profile</Text>
                            <View style={styles.settingsItem}>
                                <Ionicons name="car-sport-outline" size={20} color="#64748B" />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.settingLabel}>Vehicle Type</Text>
                                    <Text style={styles.settingValue}>{driverProfile?.vehicle_type || 'Add vehicle'}</Text>
                                </View>
                            </View>
                            <View style={styles.settingsItem}>
                                <Ionicons name="barcode-outline" size={20} color="#64748B" />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.settingLabel}>Plate Number</Text>
                                    <Text style={styles.settingValue}>{driverProfile?.plate_number || 'Add plate'}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.editProfileBtn} onPress={() => setVehicleModalVisible(true)}>
                                <Text style={styles.editProfileText}>Edit Vehicle</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.settingsCard}>
                            <Text style={styles.sectionTitle}>Support & Help</Text>
                            <TouchableOpacity style={styles.supportItem}>
                                <Ionicons name="help-buoy-outline" size={20} color={PRIMARY_COLOR} />
                                <Text style={styles.supportText}>Help Center</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.supportItem}>
                                <Ionicons name="chatbubbles-outline" size={20} color={SUCCESS_COLOR} />
                                <Text style={styles.supportText}>Chat with Support</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <FlatList
                        scrollEnabled={false}
                        data={activeTab === 'pool' ? poolOrders : activeTab === 'history' ? historyOrders : orders}
                        keyExtractor={item => item.id}
                        renderItem={renderOrderItem}
                        ListEmptyComponent={
                            <View style={styles.emptyWrap}>
                                <Ionicons name="cube-outline" size={48} color="#CBD5E1" />
                                <Text style={styles.emptyMsg}>No orders to show here.</Text>
                            </View>
                        }
                    />
                )}
            </ScrollView>

            {/* MODALS */}

            {/* ORDER DETAILS */}
            <Modal visible={!!selectedOrder} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedOrder(null)}>
                <View style={styles.modalBody}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Delivery Details</Text>
                        <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                            <Ionicons name="close-circle" size={28} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={{ padding: 20 }}>
                        <Text style={styles.modalSectionLabel}>Items Ready for Pickup</Text>
                        {selectedOrder?.items?.map((item, idx) => (
                            <View key={idx} style={styles.modalItemRow}>
                                <Text style={styles.modalItemQty}>{item.quantity}x</Text>
                                <View style={{ flex: 1, marginHorizontal: 12 }}>
                                    <Text style={styles.modalItemName}>{item.name || 'Order Item'}</Text>
                                    <Text style={styles.modalItemMeta}>Variant: {item.variant || 'Standard'}</Text>
                                </View>
                                <Text style={styles.modalItemPrice}>₦{(item.price * item.quantity).toLocaleString()}</Text>
                            </View>
                        ))}

                        <View style={styles.modalInfoCard}>
                            <Text style={styles.modalInfoLabel}>Shipping Address</Text>
                            <Text style={styles.modalInfoValue}>{parseAddress(selectedOrder?.shipping_address)}</Text>
                        </View>

                        <TouchableOpacity style={styles.modalMapBtn} onPress={() => handleMap(parseAddress(selectedOrder?.shipping_address))}>
                            <Ionicons name="navigate" size={20} color="white" />
                            <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 8 }}>Start Navigation</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>

            {/* VEHICLE MODAL */}
            <Modal visible={isVehicleModalVisible} transparent animationType="fade">
                <View style={styles.centerOverlay}>
                    <View style={styles.dialogBox}>
                        <Text style={styles.dialogTitle}>Update Vehicle</Text>
                        <TextInput style={styles.input} placeholder="Vehicle Type (e.g. Honda Civic)" value={vType} onChangeText={setVType} />
                        <TextInput style={styles.input} placeholder="Plate Number" value={pNumber} onChangeText={setPNumber} />
                        <View style={styles.dialogActions}>
                            <TouchableOpacity onPress={() => setVehicleModalVisible(false)}><Text style={{ color: '#64748B' }}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.dialogPrimary} onPress={updateVehicleDetails}><Text style={{ color: 'white', fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* WITHDRAW MODAL */}
            <Modal visible={isWithdrawModalVisible} transparent animationType="fade">
                <View style={styles.centerOverlay}>
                    <View style={styles.dialogBox}>
                        <Text style={styles.dialogTitle}>Request Payout</Text>
                        <Text style={{ color: '#64748B', marginBottom: 16 }}>Available: ₦{stats.totalEarnings?.toLocaleString()}</Text>
                        <TextInput style={styles.input} placeholder="Amount (₦)" keyboardType="numeric" value={withdrawAmount} onChangeText={setWithdrawAmount} />
                        <View style={styles.dialogActions}>
                            <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}><Text style={{ color: '#64748B' }}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.dialogPrimary, { backgroundColor: SUCCESS_COLOR }]} onPress={requestWithdrawal}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Request</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'white' },
    welcomeText: { fontSize: 12, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' },
    driverIdText: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    statusBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    statusToggleText: { fontSize: 10, fontWeight: '800' },
    logoutIcon: { width: 36, height: 36, backgroundColor: '#FEE2E2', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

    // Tabs
    tabBar: { flexDirection: 'row', paddingHorizontal: 10, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9' },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: 15 },
    tabItemActive: {},
    tabLabel: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
    tabLabelActive: { color: PRIMARY_COLOR },
    tabIndicator: { position: 'absolute', bottom: 0, width: '40%', height: 3, backgroundColor: PRIMARY_COLOR, borderTopLeftRadius: 3, borderTopRightRadius: 3 },

    // Scroll Area
    scrollContent: { padding: 20 },

    // Wallet
    modernWalletCard: { backgroundColor: PRIMARY_COLOR, borderRadius: 24, overflow: 'hidden', padding: 20, marginBottom: 25, elevation: 8, boxShadow: '0px 4px 15px rgba(15,23,42,0.3)' },
    walletBg: { ...StyleSheet.absoluteFillObject, opacity: 0.2 },
    walletContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    walletLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
    walletValue: { color: 'white', fontSize: 32, fontWeight: '800' },
    withdrawBtn: { backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    withdrawBtnText: { color: PRIMARY_COLOR, fontWeight: '700', fontSize: 12 },

    // Chart
    chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, paddingBottom: 5 },
    chartCol: { alignItems: 'center', width: '12%' },
    chartBar: { width: 6, backgroundColor: 'white', borderRadius: 3, opacity: 0.5 },
    chartDay: { color: 'white', fontSize: 9, marginTop: 8, opacity: 0.7, fontWeight: 'bold' },

    // Order Card
    modernCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: PRIMARY_COLOR, boxShadow: '0px 4px 10px rgba(0,0,0,0.05)', elevation: 3 },
    cardBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    cardId: { fontSize: 13, fontWeight: '700', color: '#64748B' },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeInfo: { backgroundColor: '#E0E7FF' },
    badgeSuccess: { backgroundColor: '#D1FAE5' },
    badgeWarn: { backgroundColor: '#FEF3C7' },
    badgeText: { fontSize: 10, fontWeight: '800' },

    locationGroup: { flexDirection: 'row', gap: 15 },
    locIconCol: { alignItems: 'center', width: 20 },
    dotIndigo: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY_COLOR },
    dashLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
    locTextCol: { flex: 1 },
    locStepLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
    locName: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginTop: 2 },

    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
    footerValue: { fontSize: 16, fontWeight: '800', color: SUCCESS_COLOR },
    actionGroup: { flexDirection: 'row', gap: 8 },
    iconCircle: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    mainActionBtn: { backgroundColor: PRIMARY_COLOR, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    mainActionText: { color: 'white', fontSize: 12, fontWeight: '800' },

    emptyWrap: { alignItems: 'center', marginTop: 50 },
    emptyMsg: { color: '#94A3B8', marginTop: 10, fontWeight: '500' },

    // Level & XP
    levelBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 4 },
    levelBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    xpBarContainer: { height: 20, backgroundColor: '#E2E8F0', justifyContent: 'center' },
    xpBarFill: { ...StyleSheet.absoluteFillObject, backgroundColor: PRIMARY_COLOR, opacity: 0.15 },
    xpText: { fontSize: 9, fontWeight: '800', color: PRIMARY_COLOR, textAlign: 'center', letterSpacing: 1 },

    // Order Card - Elite Notes
    noteIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    noteIndicatorText: { fontSize: 9, fontWeight: '700', color: PRIMARY_COLOR },
    cardNoteBox: { marginTop: 12, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#CBD5E1' },
    cardNoteText: { fontSize: 12, color: '#64748B', fontStyle: 'italic', lineHeight: 18 },

    // Daily Earnings List
    earningsListSection: { backgroundColor: 'white', borderRadius: 20, padding: 20, marginBottom: 20, boxShadow: '0px 4px 10px rgba(0,0,0,0.05)' },
    dailyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    dailyDate: { fontSize: 13, fontWeight: '700', color: '#1E293B', flex: 1 },
    dailyCount: { fontSize: 12, color: '#94A3B8', marginHorizontal: 10 },
    dailyAmount: { fontSize: 14, fontWeight: '800', color: SUCCESS_COLOR },

    // Support Section
    supportItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    supportText: { fontSize: 14, fontWeight: '600', color: '#475569' },

    // Profile Section
    profileSection: { gap: 20 },
    settingsCard: { backgroundColor: 'white', borderRadius: 20, padding: 20, boxShadow: '0px 4px 10px rgba(0,0,0,0.05)' },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
    settingsItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    settingLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
    settingValue: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
    editProfileBtn: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    editProfileText: { color: PRIMARY_COLOR, fontWeight: '700', fontSize: 13 },

    // Modals
    modalBody: { flex: 1, backgroundColor: '#F8FAFC' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#E2E8F0' },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    modalSectionLabel: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginBottom: 15, textTransform: 'uppercase' },
    modalNoteCard: { flexDirection: 'row', backgroundColor: '#FFFBEB', padding: 15, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FEF3C7' },
    modalNoteLabel: { fontSize: 10, fontWeight: '800', color: '#B45309', textTransform: 'uppercase' },
    modalNoteValue: { fontSize: 13, color: '#92400E', marginTop: 2, lineHeight: 18 },
    modalItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 15, borderRadius: 16, marginBottom: 10 },
    modalItemQty: { fontSize: 14, fontWeight: '800', color: PRIMARY_COLOR },
    modalItemName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
    modalItemMeta: { fontSize: 12, color: '#94A3B8' },
    modalItemPrice: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
    modalInfoCard: { backgroundColor: 'white', padding: 20, borderRadius: 20, marginTop: 10 },
    modalInfoLabel: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginBottom: 5 },
    modalInfoValue: { fontSize: 15, color: '#1E293B', lineHeight: 22 },
    modalMapBtn: { backgroundColor: PRIMARY_COLOR, padding: 18, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 25 },

    // Center Dialogs
    centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    dialogBox: { backgroundColor: 'white', borderRadius: 24, padding: 25 },
    dialogTitle: { fontSize: 18, fontWeight: '800', marginBottom: 20 },
    input: { backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, marginBottom: 12, fontSize: 14 },
    dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 20, marginTop: 10 },
    dialogPrimary: { backgroundColor: PRIMARY_COLOR, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }
});
