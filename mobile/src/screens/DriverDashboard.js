import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Linking, ActivityIndicator, Modal, Image, Switch, Platform, ScrollView, TextInput, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';

const PRIMARY_COLOR = '#6366F1'; // Indigo
const ACCENT_COLOR = '#8B5CF6';  // Violet
const SUCCESS_COLOR = '#10B981'; // Emerald
const DANGER_COLOR = '#EF4444';  // Rose
const AMBER_COLOR = '#F59E0B';   // Gold/Coins

// Max 10 streak base sequence
const CHECKIN_REWARDS = [0, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10];

export const DriverDashboard = ({ user, onLogout }) => {
    // Data State
    const [orders, setOrders] = useState([]);
    const [poolOrders, setPoolOrders] = useState([]);
    const [historyOrders, setHistoryOrders] = useState([]);
    const [driverProfile, setDriverProfile] = useState(null);
    const [stats, setStats] = useState({ totalEarnings: 0, completedDeliveries: 0, weeklyDaily: [], dailyList: [], completionRate: 100, level: 'Bronze', xp: 0, xpProgress: 0 });
    const [wallet, setWallet] = useState(null);
    const [withdrawals, setWithdrawals] = useState([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('active'); // 'pool', 'active', 'history', 'profile'
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Gamification & Check-in
    const [checkInData, setCheckInData] = useState({ streak: 0, checkedInToday: false, checkingIn: false });
    const [animatingCoins, setAnimatingCoins] = useState(0);

    // Form States
    const [isVehicleModalVisible, setVehicleModalVisible] = useState(false);
    const [isWithdrawModalVisible, setWithdrawModalVisible] = useState(false);
    const [vType, setVType] = useState('');
    const [pNumber, setPNumber] = useState('');
    const [vColor, setVColor] = useState('');
    const [dLicense, setDLicense] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');

    // Withdrawal specific state (Synced from VendorWallet)
    const [bankName, setBankName] = useState('');
    const [bankCode, setBankCode] = useState('');
    const [accountNo, setAccountNo] = useState('');
    const [accountName, setAccountName] = useState('');
    const [banks, setBanks] = useState([]);
    const [filteredBanks, setFilteredBanks] = useState([]);
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [searchBankQuery, setSearchBankQuery] = useState('');
    const [resolvingAccount, setResolvingAccount] = useState(false);

    // History Modal State
    const [isHistoryModalVisible, setHistoryModalVisible] = useState(false);
    const [historyFilter, setHistoryFilter] = useState('All');

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

        fetchBanks(); // Fetch banks for withdrawal

        return () => supabase.removeChannel(subscription);
    }, [user.id, driverProfile?.id]);

    const fetchBanks = async () => {
        try {
            const res = await fetch('https://api.paystack.co/bank');
            const json = await res.json();
            if (json.status) {
                setBanks(json.data);
                setFilteredBanks(json.data);
            }
        } catch (error) {
            console.log('Error fetching banks:', error);
        }
    };

    useEffect(() => {
        if (accountNo.length === 10 && bankCode) {
            resolveAccount();
        } else {
            setAccountName('');
        }
    }, [accountNo, bankCode]);

    const resolveAccount = async () => {
        setResolvingAccount(true);
        try {
            const FUNCTION_URL = `${supabaseUrl}/functions/v1/resolve-bank`;
            const res = await fetch(`${FUNCTION_URL}?account_number=${accountNo}&bank_code=${bankCode}`, {
                headers: { Authorization: `Bearer ${supabaseAnonKey}` }
            });
            const json = await res.json();
            if (json.status) {
                setAccountName(json.data.account_name);
            } else {
                setAccountName('');
                Alert.alert('Verification Failed', json.message || 'Could not verify account.');
            }
        } catch (error) {
            console.log('Error resolving account:', error);
            Alert.alert('Error', 'Failed to verify account details.');
        } finally {
            setResolvingAccount(false);
        }
    };

    const handleSearchBank = (text) => {
        setSearchBankQuery(text);
        if (text) {
            setFilteredBanks(banks.filter(b => b.name.toLowerCase().includes(text.toLowerCase())));
        } else {
            setFilteredBanks(banks);
        }
    };

    const fetchDriverProfile = async () => {
        try {
            const { data, error } = await supabase.rpc('ensure_driver_profile');
            if (data) {
                setDriverProfile(data);
                setVType(data.vehicle_type || '');
                setPNumber(data.plate_number || '');
                setVColor(data.vehicle_color || '');
                setDLicense(data.driver_license || '');
                fetchAllOrders(data.id, data); // 🔥 Pass the fresh data here
                fetchWithdrawalHistory(data.id);
            } else {
                setLoading(false);
                Alert.alert('Error', 'Could not load driver profile.');
            }

            // Fetch actual wallet
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (walletData) {
                setWallet(walletData);
            } else {
                // Auto-create wallet if missing
                const { data: newWallet } = await supabase
                    .from('wallets')
                    .insert([{ user_id: user.id, balance: 0, pending_balance: 0 }])
                    .select()
                    .single();
                if (newWallet) setWallet(newWallet);
            }

            verifyCheckInStatus();
        } catch (e) {
            console.log("Fetch Driver Error", e);
            setLoading(false);
        }
    };

    const fetchWithdrawalHistory = async (dId) => {
        try {
            const { data } = await supabase
                .from('driver_payouts')
                .select('*')
                .eq('driver_id', dId)
                .order('created_at', { ascending: false });
            if (data) setWithdrawals(data);
        } catch (err) {
            console.log('Error fetching driver withdrawals:', err);
        }
    };

    const verifyCheckInStatus = async () => {
        try {
            const { data, error } = await supabase.from('daily_checkins').select('*').eq('user_id', user.id).single();
            if (data) {
                const lastCheckIn = new Date(data.last_checkin);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                lastCheckIn.setHours(0, 0, 0, 0);

                const diffDays = Math.round((today - lastCheckIn) / (1000 * 60 * 60 * 24));
                const isCheckedInToday = diffDays === 0;
                const newStreak = diffDays <= 1 ? data.current_streak : 0;

                setCheckInData({ streak: newStreak, checkedInToday: isCheckedInToday, checkingIn: false });

                // Auto reset remote streak if missed
                if (diffDays > 1) {
                    await supabase.from('daily_checkins').update({ current_streak: 0 }).eq('user_id', user.id);
                }
            } else {
                setCheckInData({ streak: 0, checkedInToday: false, checkingIn: false });
            }
        } catch (err) {
            console.log('Error verifying check-in:', err);
            setCheckInData(prev => ({ ...prev, checkingIn: false }));
        }
    };

    const handleCheckIn = async () => {
        if (checkInData.checkedInToday || checkInData.checkingIn) return;

        setCheckInData(prev => ({ ...prev, checkingIn: true }));
        try {
            const newStreak = checkInData.streak + 1;
            const rewardIndex = Math.min(newStreak, 10);
            const rewardCoins = CHECKIN_REWARDS[rewardIndex];

            const { data, error } = await supabase.from('daily_checkins').upsert({
                user_id: user.id,
                last_checkin: new Date().toISOString(),
                current_streak: newStreak
            }, { onConflict: 'user_id' }).select();

            if (error) {
                // Silently fallback if column doesn't exist
                console.log('Error Upserting Checkin:', error);
            }

            // Sync with profile coins (using mafhal_coins column)
            const newCoins = (driverProfile?.mafhal_coins || 0) + rewardCoins;
            await supabase.rpc('update_user_amc', { p_user_id: user.id, p_coins: newCoins });

            setDriverProfile(prev => ({ ...prev, mafhal_coins: newCoins }));
            setCheckInData({ streak: newStreak, checkedInToday: true, checkingIn: false });

            setAnimatingCoins(rewardCoins);
            setTimeout(() => setAnimatingCoins(0), 2000);

            // Force Profile Refetch to update UI reliably
            fetchDriverProfile();
        } catch (err) {
            console.error(err);
            setCheckInData(prev => ({ ...prev, checkingIn: false }));
        }
    };

    const fetchAllOrders = async (driverId, profileData = null) => {
        try {
            const { data: myOrders } = await supabase
                .from('orders')
                .select('*, user:profiles(full_name, phone), items:order_items(*)')
                .eq('driver_id', driverId)
                .order('created_at', { ascending: false });

            if (myOrders) {
                setOrders(myOrders.filter(o => ['shipped', 'processing'].includes(o.status)));
                setHistoryOrders(myOrders.filter(o => ['delivered', 'cancelled'].includes(o.status)));
                calculateStats(myOrders, profileData || driverProfile);
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

    const calculateStats = (allOrders, profile = driverProfile) => {
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
        const xp = profile?.xp || 0;
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
        setRefreshing(true);
        fetchDriverProfile();
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
                        handleRefresh(); // This will now refetch profile/wallet too
                    }
                }
            }
        ]);
    };

    const updateVehicleDetails = async () => {
        if (!vType || !pNumber || !vColor || !dLicense) {
            return Alert.alert('Error', 'Please fill in all vehicle and driver details.');
        }

        const { error } = await supabase.rpc('update_driver_vehicle', {
            p_vehicle_type: vType,
            p_plate_number: pNumber,
            p_vehicle_color: vColor,
            p_driver_license: dLicense
        });

        if (error) Alert.alert('Error', error.message);
        else {
            setDriverProfile({ ...driverProfile, vehicle_type: vType, plate_number: pNumber, vehicle_color: vColor, driver_license: dLicense });
            setVehicleModalVisible(false);
            Alert.alert('Success', 'Vehicle profile updated.');
        }
    };

    const displayedWithdrawals = withdrawals.filter(w => historyFilter === 'All' ? true : w.status === historyFilter);

    const requestWithdrawal = async () => {
        const amount = parseFloat(withdrawAmount.replace(/,/g, '')) || 0;
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
        }

        if (amount > (wallet?.balance || 0)) {
            return Alert.alert('Insufficient Balance', 'You cannot withdraw more than your available wallet balance.');
        }

        if (!bankName || !accountNo || !accountName) {
            return Alert.alert('Incomplete Details', 'Please enter your full bank details.');
        }

        Alert.alert('Confirm Withdrawal', `Are you sure you want to withdraw ₦${amount.toLocaleString()}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm',
                onPress: async () => {
                    setLoading(true);
                    try {
                        const { error } = await supabase.from('driver_payouts').insert([{
                            driver_id: driverProfile.id,
                            amount: amount,
                            bank_name: bankName,
                            account_number: accountNo,
                            account_name: accountName,
                            status: 'pending'
                        }]);

                        if (error) {
                            console.log('driver_payouts table error:', error);
                            throw new Error(error.message || 'Error inserting into driver_payouts');
                        } else {
                            // If direct insertion works, we must deduct wallet securely via RPC to bypass RLS.
                            const { error: walletErr } = await supabase.rpc('deduct_wallet_balance', {
                                p_user_id: user.id,
                                p_amount: amount
                            });

                            if (walletErr) throw walletErr;
                        }

                        // Optimistically clear forms and show success
                        Alert.alert('Request Sent', 'Your withdrawal request has been submitted successfully.');
                        setWithdrawModalVisible(false);
                        setWithdrawAmount('');
                        setAccountNo('');
                        setAccountName('');

                        // Refetch wallet
                        fetchDriverProfile();

                    } catch (err) {
                        console.error('Withdrawal error:', err);
                        Alert.alert('Error', err.message || 'Failed to process withdrawal.');
                    } finally {
                        setLoading(false);
                    }
                }
            }
        ]);
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
            <View style={[styles.modernCard, isHistory && { opacity: 0.7 }]}>
                {/* Header Row */}
                <View style={styles.cardBadgeRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.iconCircleSmall}>
                            <Ionicons name="cube" size={14} color={PRIMARY_COLOR} />
                        </View>
                        <Text style={styles.cardId}>ORDER #{item.id.slice(0, 6).toUpperCase()}</Text>
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

                {/* Locations */}
                <TouchableOpacity onPress={() => setSelectedOrder(item)} activeOpacity={0.7} style={styles.locationWrap}>
                    <View style={styles.locationGroup}>
                        <View style={styles.locIconCol}>
                            <View style={styles.dotIndigo} />
                            <View style={styles.dashLine} />
                            <Ionicons name="location" size={16} color={PRIMARY_COLOR} />
                        </View>
                        <View style={styles.locTextCol}>
                            <View style={styles.locTextBox}>
                                <Text style={styles.locStepLabel}>Pickup</Text>
                                <Text style={styles.locName} numberOfLines={1}>Vendor Location</Text>
                            </View>
                            <View style={styles.locTextBox}>
                                <Text style={styles.locStepLabel}>Delivery</Text>
                                <Text style={styles.locName} numberOfLines={1}>{address}</Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>

                {item.notes && (
                    <View style={styles.cardNoteBox}>
                        <Ionicons name="information-circle" size={14} color="#64748B" />
                        <Text style={styles.cardNoteText} numberOfLines={1}>{item.notes}</Text>
                    </View>
                )}

                <View style={styles.divider} />

                {/* Footer / Actions */}
                <View style={styles.cardFooter}>
                    <View>
                        <Text style={styles.footerLabel}>Earnings</Text>
                        <Text style={styles.footerValue}>₦{(item.delivery_fee || 500).toLocaleString()}</Text>
                    </View>
                    <View style={styles.actionGroup}>
                        {!isHistory && (
                            <TouchableOpacity onPress={() => handleMap(address)} style={styles.iconCircle}>
                                <Ionicons name="navigate" size={18} color={PRIMARY_COLOR} />
                            </TouchableOpacity>
                        )}
                        {!isPool && !isHistory && (
                            <TouchableOpacity onPress={() => handleCall(item.user?.phone)} style={[styles.iconCircle, { backgroundColor: '#D1FAE5' }]}>
                                <Ionicons name="call" size={18} color={SUCCESS_COLOR} />
                            </TouchableOpacity>
                        )}
                        {isPool ? (
                            <TouchableOpacity style={styles.mainActionBtn} onPress={() => acceptOrder(item.id)}>
                                <Text style={styles.mainActionText}>Accept</Text>
                            </TouchableOpacity>
                        ) : !isHistory ? (
                            <TouchableOpacity style={[styles.mainActionBtn, { backgroundColor: SUCCESS_COLOR, elevation: 4, shadowColor: SUCCESS_COLOR }]} onPress={() => markDelivered(item.id)}>
                                <Text style={styles.mainActionText}>Finish</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={[styles.mainActionBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => setSelectedOrder(item)}>
                                <Text style={[styles.mainActionText, { color: '#475569' }]}>Details</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* GLASS HEADER (Modernized) */}
            <View style={styles.header}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.welcomeText}>PRO DRIVER</Text>
                        <View style={[styles.levelBadge, { backgroundColor: stats.level === 'Elite' ? '#FEF3C7' : '#E0E7FF' }]}>
                            <Text style={[styles.levelBadgeText, { color: stats.level === 'Elite' ? '#B45309' : PRIMARY_COLOR }]}>{stats.level}</Text>
                        </View>
                    </View>
                    <Text style={styles.driverIdText}>{user.full_name}</Text>
                    <View style={styles.amcBadge}>
                        <Ionicons name="sparkles" size={12} color={AMBER_COLOR} />
                        <Text style={styles.amcText}>{driverProfile?.mafhal_coins || 0} AMC</Text>
                    </View>
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
                {/* DAILY CHECK-IN CARD */}
                {activeTab === 'profile' && (
                    <View style={styles.checkinCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.checkinCardTitle}>Daily Check-in</Text>
                                <Text style={styles.checkinCardSub}>
                                    {checkInData.checkedInToday ? "You've checked in today! Come back tomorrow." : "Check in to earn free AMC Coins."}
                                </Text>
                            </View>
                            <View style={styles.streakBadge}>
                                <Ionicons name="flame" size={12} color="#DC2626" />
                                <Text style={styles.streakText}>{checkInData.streak} Days</Text>
                            </View>
                        </View>

                        <View style={styles.streakDots}>
                            {[1, 2, 3, 4, 5, 6, 7].map(day => (
                                <View key={day} style={[styles.streakDot, checkInData.streak >= day ? styles.streakDotActive : {}]}>
                                    {checkInData.streak >= day ? (
                                        <Ionicons name="checkmark" size={12} color="white" />
                                    ) : (
                                        <Text style={{ fontSize: 9, color: '#94A3B8', fontWeight: 'bold' }}>{day}</Text>
                                    )}
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.checkinBtn, (checkInData.checkedInToday || checkInData.checkingIn) && styles.checkinBtnDisabled]}
                            onPress={handleCheckIn}
                            disabled={checkInData.checkedInToday || checkInData.checkingIn}
                        >
                            {checkInData.checkingIn ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : checkInData.checkedInToday ? (
                                <Text style={styles.checkinBtnText}>Checked In</Text>
                            ) : (
                                <Text style={styles.checkinBtnText}>Check In Now (+{CHECKIN_REWARDS[Math.min(checkInData.streak + 1, 10)]} AMC)</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* WALLET & CHART */}
                {(activeTab === 'active' || activeTab === 'profile') && (
                    <View style={styles.modernWalletCard}>
                        <Image blurRadius={80} source={{ uri: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop' }} style={styles.walletBg} />
                        <View style={styles.walletContent}>
                            <View>
                                <Text style={styles.walletLabel}>Available Balance</Text>
                                <Text style={styles.walletValue}>₦{wallet ? wallet.balance.toLocaleString() : '0'}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setWithdrawModalVisible(true)} style={[styles.withdrawBtn, { elevation: 5, shadowColor: 'rgba(255,255,255,0.5)' }]}>
                                <Text style={styles.withdrawBtnText}>Cash Out</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.chartTitleContainer}>
                            <Text style={styles.chartTitleText}>Earnings This Week</Text>
                            <Text style={styles.chartTitleValue}>₦{stats.totalEarnings.toLocaleString()}</Text>
                        </View>

                        <View style={styles.chartContainer}>
                            {stats.weeklyDaily?.map((d, i) => (
                                <View key={i} style={styles.chartCol}>
                                    <View style={[styles.chartBar, { height: Math.max(8, (d.amount / (Math.max(...stats.weeklyDaily.map(x => x.amount)) || 1)) * 80) }]} />
                                    <Text style={styles.chartDay}>{d.day.charAt(0)}</Text>
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

                {/* WITHDRAWAL HISTORY BUTTON */}
                {activeTab === 'profile' && (
                    <View style={styles.profileSection}>
                        <View style={styles.settingsCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                <Text style={styles.sectionTitle}>Payouts</Text>
                                <TouchableOpacity onPress={() => setHistoryModalVisible(true)}>
                                    <Text style={{ color: PRIMARY_COLOR, fontSize: 13, fontWeight: '700' }}>View All</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                                onPress={() => setHistoryModalVisible(true)}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="wallet-outline" size={20} color={PRIMARY_COLOR} />
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }}>Withdrawal History</Text>
                                        <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{withdrawals.length} Previous requests</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
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
                            <View style={styles.settingsItem}>
                                <Ionicons name="color-palette-outline" size={20} color="#64748B" />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.settingLabel}>Vehicle Color</Text>
                                    <Text style={styles.settingValue}>{driverProfile?.vehicle_color || 'Add color'}</Text>
                                </View>
                            </View>
                            <View style={styles.settingsItem}>
                                <Ionicons name="card-outline" size={20} color="#64748B" />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.settingLabel}>Driver License</Text>
                                    <Text style={styles.settingValue}>{driverProfile?.driver_license || 'Add license'}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.editProfileBtn} onPress={() => setVehicleModalVisible(true)}>
                                <Text style={styles.editProfileText}>Edit Information</Text>
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
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={styles.dialogTitle}>Vehicle Profile</Text>
                            <TouchableOpacity onPress={() => setVehicleModalVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' }}>
                            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 }}>Setup Required</Text>
                            <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20 }}>Ensure your vehicle details are accurate so customers can easily identify you upon arrival.</Text>
                        </View>

                        <Text style={styles.modalSectionLabel}>Vehicle Type</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Motorcycle, Sedan, Van"
                            placeholderTextColor="#94A3B8"
                            value={vType}
                            onChangeText={setVType}
                        />

                        <Text style={styles.modalSectionLabel}>Plate Number / ID</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. ABC-123-XY"
                            placeholderTextColor="#94A3B8"
                            value={pNumber}
                            onChangeText={setPNumber}
                            autoCapitalize="characters"
                        />

                        <Text style={styles.modalSectionLabel}>Vehicle Color</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Red, Black, Yellow"
                            placeholderTextColor="#94A3B8"
                            value={vColor}
                            onChangeText={setVColor}
                        />

                        <Text style={styles.modalSectionLabel}>Driver License No.</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. DRL-898-000"
                            placeholderTextColor="#94A3B8"
                            value={dLicense}
                            onChangeText={setDLicense}
                            autoCapitalize="characters"
                        />

                        <TouchableOpacity
                            style={[styles.mainActionBtn, { marginTop: 10, alignSelf: 'stretch', opacity: (!vType || !pNumber || !vColor || !dLicense) ? 0.5 : 1 }]}
                            onPress={updateVehicleDetails}
                            disabled={!vType || !pNumber || !vColor || !dLicense}
                        >
                            <Text style={[styles.mainActionText, { textAlign: 'center' }]}>Save Settings</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* WITHDRAW MODAL */}
            <Modal visible={isWithdrawModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '90%' }]}>
                        <View style={styles.modalHeaderAuth}>
                            <Text style={styles.modalTitleAuth}>Request Payout</Text>
                            <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            <View style={styles.balanceStrip}>
                                <Text style={{ fontSize: 13, color: '#64748B' }}>Available Balance</Text>
                                <Text style={{ fontWeight: '800', color: '#10B981', fontSize: 16 }}>₦{(wallet?.balance || 0).toLocaleString()}</Text>
                            </View>

                            {/* CUSTOM AMOUNT INPUT (PIN-STYLE) */}
                            <View style={{ alignItems: 'center', marginVertical: 16 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Amount to withdraw</Text>
                                <Text style={[styles.numpadDisplay, (parseFloat(withdrawAmount.replace(/,/g, '')) > (wallet?.balance || 0)) && { color: '#EF4444' }]}>
                                    ₦{withdrawAmount ? parseFloat(withdrawAmount.replace(/,/g, '')).toLocaleString() : '0'}
                                </Text>
                                {(parseFloat(withdrawAmount.replace(/,/g, '')) > (wallet?.balance || 0)) && (
                                    <Text style={styles.errorText}>
                                        <Ionicons name="alert-circle" size={12} color="#EF4444" /> Amount exceeds available balance
                                    </Text>
                                )}
                            </View>

                            {/* CUSTOM NUMPAD */}
                            <View style={styles.numpadContainer}>
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'].map((key) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={styles.numKey}
                                        onPress={() => {
                                            if (key === '⌫') {
                                                setWithdrawAmount(prev => prev.slice(0, -1));
                                            } else {
                                                if (withdrawAmount.replace(/,/g, '').length > 7) return;
                                                const currentStr = withdrawAmount.replace(/,/g, '');
                                                if (currentStr === '0' && key !== '0' && key !== '00') setWithdrawAmount(key);
                                                else if (currentStr === '0' && (key === '0' || key === '00')) return;
                                                else setWithdrawAmount(prev => prev + key);
                                            }
                                        }}
                                        activeOpacity={0.6}
                                    >
                                        {key === '⌫' ? (
                                            <Ionicons name="backspace-outline" size={24} color="#0F172A" />
                                        ) : (
                                            <Text style={styles.numKeyText}>{key}</Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Bank Name</Text>
                            <TouchableOpacity
                                style={[styles.inputField, { justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }]}
                                onPress={() => setShowBankDropdown(true)}
                                activeOpacity={0.7}
                            >
                                <Text style={{ color: bankName ? '#0F172A' : '#94A3B8', fontWeight: '600' }}>{bankName || 'Select your bank'}</Text>
                                <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                            </TouchableOpacity>

                            <Text style={styles.label}>Account Number</Text>
                            <TextInput
                                style={styles.inputField}
                                placeholder="10 digit account number"
                                placeholderTextColor="#94A3B8"
                                keyboardType="numeric"
                                maxLength={10}
                                value={accountNo}
                                onChangeText={setAccountNo}
                            />

                            <Text style={styles.label}>Account Name (Auto-fetched)</Text>
                            <View style={[styles.inputField, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderColor: 'transparent' }]}>
                                {resolvingAccount ? (
                                    <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 10 }} />
                                ) : null}
                                <TextInput
                                    style={{ flex: 1, color: '#0F172A', fontWeight: '700' }}
                                    placeholder={accountNo.length === 10 && !resolvingAccount ? "Account name not found" : "Enter account number first"}
                                    placeholderTextColor="#94A3B8"
                                    value={accountName}
                                    editable={false}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.submitBtn, { opacity: (loading || (parseFloat(withdrawAmount.replace(/,/g, '')) > (wallet?.balance || 0)) || !accountName) ? 0.5 : 1 }]}
                                onPress={requestWithdrawal}
                                disabled={loading || (parseFloat(withdrawAmount.replace(/,/g, '')) > (wallet?.balance || 0)) || !accountName}
                                activeOpacity={0.8}
                            >
                                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* WITHDRAWAL HISTORY FULL MODAL */}
            <Modal visible={isHistoryModalVisible} animationType="slide" transparent={true}>
                <View style={[styles.modalOverlay, { justifyContent: 'flex-start', paddingTop: 60, backgroundColor: '#F8FAFC' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#F8FAFC' }}>
                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>History</Text>
                        <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#F8FAFC' }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {['All', 'pending', 'paid', 'rejected'].map(f => (
                                <TouchableOpacity
                                    key={f}
                                    onPress={() => setHistoryFilter(f)}
                                    style={{
                                        paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
                                        backgroundColor: historyFilter === f ? '#0F172A' : '#E2E8F0',
                                        marginRight: 8
                                    }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: historyFilter === f ? 'white' : '#64748B', textTransform: 'capitalize' }}>
                                        {f}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <FlatList
                        data={displayedWithdrawals}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ padding: 20 }}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 40, padding: 32, backgroundColor: 'white', borderRadius: 24, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                <Ionicons name="receipt-outline" size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>No History Found</Text>
                                <Text style={{ textAlign: 'center', color: '#64748B', fontSize: 14 }}>
                                    You don't have any {historyFilter !== 'All' ? historyFilter : ''} withdrawal requests yet.
                                </Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: "#64748B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                                    <View>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 2 }}>{item.bank_name}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748B' }}>{item.account_number}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontWeight: '900', color: '#0F172A', fontSize: 18, letterSpacing: -0.5 }}>₦{item.amount.toLocaleString()}</Text>
                                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: item.status === 'paid' ? '#DCFCE7' : item.status === 'pending' ? '#FEF3C7' : item.status === 'rejected' ? '#FEE2E2' : '#F1F5F9', marginTop: 6 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: item.status === 'paid' ? '#166534' : item.status === 'pending' ? '#D97706' : item.status === 'rejected' ? '#991B1B' : '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.status}</Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12 }}>
                                    <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>Req: {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                                    <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '500' }}>{new Date(item.created_at).toLocaleTimeString()}</Text>
                                </View>
                            </View>
                        )}
                    />
                </View>
            </Modal>

            {/* BANK SELECTION MODAL */}
            <Modal visible={showBankDropdown} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '85%' }]}>
                        <View style={styles.modalHeaderAuth}>
                            <Text style={styles.modalTitleAuth}>Select Bank</Text>
                            <TouchableOpacity onPress={() => setShowBankDropdown(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search banks..."
                                placeholderTextColor="#94A3B8"
                                value={searchBankQuery}
                                onChangeText={handleSearchBank}
                                autoCapitalize="none"
                            />
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            {filteredBanks.map((bank, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.bankItem}
                                    onPress={() => {
                                        setBankName(bank.name);
                                        setBankCode(bank.code);
                                        setShowBankDropdown(false);
                                        setSearchBankQuery('');
                                        setFilteredBanks(banks);
                                    }}
                                >
                                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                        <Ionicons name="business" size={14} color="#64748B" />
                                    </View>
                                    <Text style={styles.bankItemText}>{bank.name}</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            {animatingCoins > 0 && (
                <View style={styles.floatingCoinContainer}>
                    <View style={styles.floatingCoin}>
                        <Ionicons name="sparkles" size={24} color={AMBER_COLOR} />
                        <Text style={styles.floatingCoinText}>+{animatingCoins} AMC!</Text>
                    </View>
                </View>
            )}

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
    chartTitleContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15, marginTop: 10, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 15 },
    chartTitleText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
    chartTitleValue: { color: 'white', fontSize: 16, fontWeight: '800' },
    chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, paddingBottom: 5 },
    chartCol: { alignItems: 'center', width: '13%' },
    chartBar: { width: 10, backgroundColor: 'white', borderRadius: 5, opacity: 0.85, shadowColor: 'white', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    chartDay: { color: 'white', fontSize: 11, marginTop: 8, opacity: 0.9, fontWeight: '800' },

    // Order Card
    modernCard: { backgroundColor: 'white', borderRadius: 24, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: PRIMARY_COLOR, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
    cardBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    iconCircleSmall: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    cardId: { fontSize: 13, fontWeight: '800', color: '#1E293B', letterSpacing: 0.5 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeInfo: { backgroundColor: '#EEF2FF' },
    badgeSuccess: { backgroundColor: '#D1FAE5' },
    badgeWarn: { backgroundColor: '#FFFBEB' },
    badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

    locationWrap: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 16 },
    locationGroup: { flexDirection: 'row', gap: 12 },
    locIconCol: { alignItems: 'center', width: 20 },
    dotIndigo: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY_COLOR, borderWidth: 2, borderColor: '#EEF2FF' },
    dashLine: { width: 2, flex: 1, backgroundColor: '#CBD5E1', marginVertical: 2, borderStyle: 'dotted', borderRadius: 1 },
    locTextCol: { flex: 1, justifyContent: 'space-between' },
    locTextBox: { paddingVertical: 2 },
    locStepLabel: { fontSize: 10, color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    locName: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 2 },

    divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' },
    footerValue: { fontSize: 18, fontWeight: '900', color: SUCCESS_COLOR },
    actionGroup: { flexDirection: 'row', gap: 10 },
    iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    mainActionBtn: { backgroundColor: PRIMARY_COLOR, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, shadowColor: PRIMARY_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
    mainActionText: { color: 'white', fontSize: 13, fontWeight: '800' },

    emptyWrap: { alignItems: 'center', marginTop: 60 },
    emptyMsg: { color: '#94A3B8', marginTop: 12, fontWeight: '600', fontSize: 15 },

    // Level & XP
    levelBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 2 },
    levelBadgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    xpBarContainer: { height: 20, backgroundColor: '#E2E8F0', justifyContent: 'center' },
    xpBarFill: { ...StyleSheet.absoluteFillObject, backgroundColor: PRIMARY_COLOR, opacity: 0.15 },
    xpText: { fontSize: 9, fontWeight: '800', color: PRIMARY_COLOR, textAlign: 'center', letterSpacing: 1 },

    // Order Card - Elite Notes
    cardNoteBox: { marginTop: 12, padding: 10, backgroundColor: '#F1F5F9', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardNoteText: { fontSize: 12, color: '#475569', fontStyle: 'italic', flex: 1 },

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

    // Check-in styles
    amcBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 4 },
    amcText: { fontSize: 11, fontWeight: '800', color: '#B45309' },
    checkinCard: { backgroundColor: 'white', borderRadius: 20, padding: 20, marginBottom: 20, boxShadow: '0px 4px 10px rgba(0,0,0,0.05)', elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
    checkinCardTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    checkinCardSub: { fontSize: 12, color: '#64748B', marginTop: 4 },
    streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    streakText: { fontSize: 12, fontWeight: '800', color: '#DC2626' },
    streakDots: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 16, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12 },
    streakDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    streakDotActive: { backgroundColor: AMBER_COLOR, shadowColor: AMBER_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
    checkinBtn: { backgroundColor: AMBER_COLOR, padding: 14, borderRadius: 12, alignItems: 'center', shadowColor: AMBER_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
    checkinBtnDisabled: { backgroundColor: '#E2E8F0', shadowOpacity: 0 },
    checkinBtnText: { color: 'white', fontWeight: '800', fontSize: 14 },

    // Gamified Coin Overlay
    floatingCoinContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100 },
    floatingCoin: { backgroundColor: '#FFFBEB', padding: 24, borderRadius: 24, alignItems: 'center', shadowColor: AMBER_COLOR, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10, borderWidth: 2, borderColor: '#FCD34D' },
    floatingCoinText: { fontSize: 28, fontWeight: '900', color: '#B45309', marginTop: 12, letterSpacing: 1 },

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
    dialogPrimary: { backgroundColor: PRIMARY_COLOR, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },

    // Withdraw Sync Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    modalHeaderAuth: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitleAuth: { fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    balanceStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9' },

    label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 16 },
    inputField: { backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', fontSize: 15, fontWeight: '600', color: '#0F172A' },
    errorText: { color: '#EF4444', fontSize: 12, marginTop: 8, fontWeight: '600' },

    numpadDisplay: { fontSize: 40, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    numpadContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 24, paddingHorizontal: 10 },
    numKey: { width: '30%', height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    numKeyText: { fontSize: 24, fontWeight: '700', color: '#0F172A' },

    submitBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 32, shadowColor: "#10B981", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    submitBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },

    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    searchInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#0F172A', fontWeight: '500' },
    bankItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F8FAFC' },
    bankItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#334155' }
});
