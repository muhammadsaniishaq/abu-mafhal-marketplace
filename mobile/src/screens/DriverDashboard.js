import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Alert,
    Linking,
    ActivityIndicator,
    Modal,
    Image,
    Switch,
    Platform,
    ScrollView,
    TextInput,
    Animated,
    Easing,
    Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { whatsappService } from '../services/whatsappService';
import { WhatsAppActionModal } from '../components/WhatsAppActionModal';

// Native Safe Icon Map
const ICON_MAP = {
    'cube-outline': '📦',
    'cash-outline': '💵',
    'alert-circle': '⚠️',
    'checkmark-circle': '✅',
    'location-outline': '📍',
    'navigate': '🧭',
    'call': '📞',
    'call-outline': '📞',
    'logo-whatsapp': '💬',
    'flash': '⚡',
    'flash-outline': '⚡',
    'checkmark-done': '✔️',
    'document-text-outline': '📄',
    'reload': '🔄',
    'power': '⏻',
    'wallet-outline': '💳',
    'bicycle': '🚲',
    'bicycle-outline': '🚲',
    'sparkles': '✨',
    'sparkles-outline': '✨',
    'arrow-up-circle-outline': '⬆️',
    'list': '📋',
    'time-outline': '⏱️',
    'flame': '🔥',
    'checkmark': '✓',
    'create-outline': '✏️',
    'car-sport-outline': '🚗',
    'barcode-outline': '🏷️',
    'color-palette-outline': '🎨',
    'card-outline': '💳',
    'chatbubbles-outline': '💬',
    'close': '✕',
    'chevron-down': '▼',
    'search': '🔍',
    'chevron-forward': '›'
};

const Ionicons = ({ name, size = 16, color = '#FFFFFF', style }) => {
    const glyph = ICON_MAP[name] || '•';
    return (
        <Text style={[{ fontSize: Math.round(size * 0.88), color, textAlign: 'center', lineHeight: Math.round(size * 1.1) }, style]}>
            {glyph}
        </Text>
    );
};

const { width } = Dimensions.get('window');

// Abu Mafhal Executive Palette
const NAVY = '#070D1B';
const DARK_SURFACE = '#0E1A2E';
const CARD_BG = '#132038';
const CARD_BG_ELEVATED = '#182844';
const GOLD = '#D9A73A';
const GOLD_LIGHT = '#FDE68A';
const SUCCESS = '#10B981';
const DANGER = '#EF4444';
const AMBER = '#F59E0B';
const BORDER_GOLD = 'rgba(217, 167, 58, 0.25)';
const BORDER_SUBTLE = 'rgba(255, 255, 255, 0.08)';

const VALID_DRIVER_TABS = ['active', 'pool', 'wallet', 'history', 'profile'];

const getInitialDriverTab = (route) => {
    try {
        const paramTab = route?.params?.tab || route?.params?.screen;
        if (paramTab && VALID_DRIVER_TABS.includes(paramTab)) return paramTab;

        if (typeof window !== 'undefined' && window.location) {
            const hash = window.location.hash || '';
            const match = hash.match(/[?&]tab=([a-zA-Z0-9_-]+)/);
            if (match && match[1] && VALID_DRIVER_TABS.includes(match[1])) return match[1];
            const subMatch = hash.match(/#driver\/([a-zA-Z0-9_-]+)/);
            if (subMatch && subMatch[1] && VALID_DRIVER_TABS.includes(subMatch[1])) return subMatch[1];
            const saved = window.localStorage?.getItem('@abumafhal_driver_tab');
            if (saved && VALID_DRIVER_TABS.includes(saved)) return saved;
        }
    } catch (_) {}
    return 'active';
};

export const DriverDashboard = ({ user, onLogout, navigation, route }) => {
    const insets = useSafeAreaInsets();

    // ─── Active User Safe Resolver ───
    const [activeUser, setActiveUser] = useState(user || null);

    // Data State
    const [orders, setOrders] = useState([]);
    const [poolOrders, setPoolOrders] = useState([]);
    const [historyOrders, setHistoryOrders] = useState([]);
    const [driverProfile, setDriverProfile] = useState({
        id: user?.id || null,
        name: user?.full_name || 'Driver Courier',
        status: 'active',
        is_active: true,
        vehicle_type: 'Motorcycle',
        vehicle_number: '',
        rating: 5.0,
        xp: 150
    });
    const [stats, setStats] = useState({
        totalEarnings: 0,
        completedDeliveries: 0,
        weeklyDaily: [],
        dailyList: [],
        completionRate: 100,
        level: 'Gold',
        xp: 150,
        xpProgress: 60
    });
    const [walletBalance, setWalletBalance] = useState(0);
    const [withdrawals, setWithdrawals] = useState([]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, _setActiveTab] = useState(() => getInitialDriverTab(route));
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Gamification Streak (Local safe storage)
    const [streakCount, setStreakCount] = useState(3);
    const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
    const [animatingCoins, setAnimatingCoins] = useState(0);

    // Modals
    const [isVehicleModalVisible, setVehicleModalVisible] = useState(false);
    const [isWithdrawModalVisible, setWithdrawModalVisible] = useState(false);
    const [isHistoryModalVisible, setHistoryModalVisible] = useState(false);

    // Vehicle Form
    const [vType, setVType] = useState('Motorcycle');
    const [pNumber, setPNumber] = useState('');

    // Withdrawal Form
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankCode, setBankCode] = useState('');
    const [accountNo, setAccountNo] = useState('');
    const [accountName, setAccountName] = useState('');
    const [banks, setBanks] = useState([]);
    const [filteredBanks, setFilteredBanks] = useState([]);
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [searchBankQuery, setSearchBankQuery] = useState('');
    const [resolvingAccount, setResolvingAccount] = useState(false);

    // WhatsApp Action Modal
    const [whatsappVisible, setWhatsappVisible] = useState(false);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [whatsappUserId, setWhatsappUserId] = useState(null);
    const [whatsappRecipientName, setWhatsappRecipientName] = useState('Customer');

    const setActiveTab = useCallback((tabName) => {
        _setActiveTab(tabName);
        try {
            if (typeof window !== 'undefined' && window.location) {
                window.localStorage.setItem('@abumafhal_driver_tab', tabName);
                const targetHash = tabName === 'active' ? '#driver' : `#driver?tab=${tabName}`;
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', '/mobile' + targetHash);
                }
            }
            AsyncStorage.setItem('@abumafhal_driver_tab', tabName).catch(() => {});
        } catch (_) {}
    }, []);

    // Sync external navigation route params to tab
    useEffect(() => {
        const paramTab = route?.params?.tab || route?.params?.screen;
        if (paramTab && VALID_DRIVER_TABS.includes(paramTab) && paramTab !== activeTab) {
            setActiveTab(paramTab);
        }
    }, [route?.params?.tab, route?.params?.screen]);

    // Lock screen in storage
    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@abumafhal_last_screen', 'DriverDashboard');
            }
            AsyncStorage.setItem('@abumafhal_last_screen', 'DriverDashboard').catch(() => {});
        } catch (_) {}
    }, []);

    // ─── Multi-tier Safe User Hydration ───
    useEffect(() => {
        const resolveUser = async () => {
            if (user?.id) {
                setActiveUser(user);
                loadAllDriverData(user.id);
                return;
            }

            try {
                // Check local storage cache
                const cached = await AsyncStorage.getItem('@abumafhal_user_v1');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed?.id) {
                        setActiveUser(parsed);
                        loadAllDriverData(parsed.id);
                        return;
                    }
                }

                // Check Supabase session
                const { data } = await supabase.auth.getSession();
                const sessionUser = data?.session?.user;
                if (sessionUser?.id) {
                    const uObj = {
                        id: sessionUser.id,
                        email: sessionUser.email,
                        full_name: sessionUser.user_metadata?.full_name || 'Driver Courier',
                        phone: sessionUser.user_metadata?.phone || ''
                    };
                    setActiveUser(uObj);
                    loadAllDriverData(sessionUser.id);
                }
            } catch (err) {
                console.log('Safe User Resolution Error:', err);
            }
        };

        resolveUser();
    }, [user?.id]);

    // Real-time listener
    useEffect(() => {
        const uid = activeUser?.id;
        if (!uid) return;

        fetchBanks();

        const channel = supabase
            .channel('driver_orders_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders(uid);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeUser?.id]);

    const fetchBanks = async () => {
        try {
            const res = await fetch('https://api.paystack.co/bank');
            const json = await res.json();
            if (json.status && Array.isArray(json.data)) {
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
            }
        } catch (error) {
            console.log('Error resolving account:', error);
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

    // ─── MASTER DATA LOADER ───
    const loadAllDriverData = async (userId) => {
        if (!userId) return;
        setLoading(true);
        try {
            await Promise.allSettled([
                fetchDriverRecord(userId),
                fetchProfileBalance(userId),
                fetchOrders(userId),
                fetchTransactions(userId)
            ]);
        } catch (err) {
            console.log('loadAllDriverData Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // 1. Fetch or Auto-Provision Driver Record from `drivers`
    const fetchDriverRecord = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('drivers')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (data) {
                setDriverProfile(data);
                setVType(data.vehicle_type || 'Motorcycle');
                setPNumber(data.vehicle_number || '');
            } else {
                // Auto create driver row in `drivers` table
                const newDriver = {
                    user_id: userId,
                    name: activeUser?.full_name || 'Driver Courier',
                    phone: activeUser?.phone || activeUser?.phone_number || '',
                    vehicle_type: 'Motorcycle',
                    vehicle_number: '',
                    status: 'active',
                    is_active: true,
                    xp: 150,
                    rating: 5.0
                };
                const { data: created } = await supabase
                    .from('drivers')
                    .insert([newDriver])
                    .select()
                    .maybeSingle();

                if (created) {
                    setDriverProfile(created);
                    setVType(created.vehicle_type || 'Motorcycle');
                    setPNumber(created.vehicle_number || '');
                }
            }
        } catch (e) {
            console.log('Driver Record Fetch Error:', e);
        }
    };

    // 2. Fetch Balance from `profiles.balance`
    const fetchProfileBalance = async (userId) => {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('balance, full_name, phone')
                .eq('id', userId)
                .maybeSingle();

            if (data) {
                setWalletBalance(Number(data.balance || 0));
            }
        } catch (e) {
            console.log('Profile Balance Fetch Error:', e);
        }
    };

    // 3. Fetch Orders from `orders`
    const fetchOrders = async (userId) => {
        try {
            const [myOrdersRes, poolRes] = await Promise.allSettled([
                supabase
                    .from('orders')
                    .select('*, user:profiles(full_name, phone), items:order_items(*)')
                    .eq('driver_id', userId)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('orders')
                    .select('*, user:profiles(full_name, phone), items:order_items(*)')
                    .is('driver_id', null)
                    .in('status', ['processing', 'pending', 'paid', 'order_placed'])
                    .order('created_at', { ascending: false })
            ]);

            const myOrders = myOrdersRes.status === 'fulfilled' && Array.isArray(myOrdersRes.value?.data) ? myOrdersRes.value.data : [];
            const poolData = poolRes.status === 'fulfilled' && Array.isArray(poolRes.value?.data) ? poolRes.value.data : [];

            setOrders(myOrders.filter(o => ['shipped', 'processing', 'out_for_delivery', 'picked_up'].includes(o.status)));
            setHistoryOrders(myOrders.filter(o => ['delivered', 'cancelled', 'refunded'].includes(o.status)));
            setPoolOrders(poolData);

            calculateStats(myOrders);
        } catch (e) {
            console.log('Fetch Orders Error:', e);
        }
    };

    // 4. Fetch Transactions from `transactions`
    const fetchTransactions = async (userId) => {
        try {
            const { data } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (data) {
                setWithdrawals(data);
            }
        } catch (e) {
            console.log('Fetch Transactions Error:', e);
        }
    };

    const calculateStats = (myOrders) => {
        const completed = myOrders.filter(o => o.status === 'delivered');
        const cancelled = myOrders.filter(o => o.status === 'cancelled');
        const earnings = completed.reduce((sum, order) => sum + (Number(order.shipping_fee) || 800), 0);

        const totalFinished = completed.length + cancelled.length;
        const rate = totalFinished > 0 ? Math.round((completed.length / totalFinished) * 100) : 100;

        const daily = [];
        const dailyList = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayOrders = completed.filter(o => o.updated_at?.startsWith(dateStr));
            const amount = dayOrders.reduce((sum, o) => sum + (Number(o.shipping_fee) || 800), 0);

            daily.push({ day: d.toLocaleDateString('en-US', { weekday: 'short' }), amount });
            if (amount > 0) {
                dailyList.push({
                    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    amount,
                    count: dayOrders.length
                });
            }
        }

        const xp = driverProfile?.xp || 150;
        const level = xp < 200 ? 'Bronze' : xp < 600 ? 'Silver' : xp < 1500 ? 'Gold' : 'Elite';
        const nextLevelXP = xp < 200 ? 200 : xp < 600 ? 600 : xp < 1500 ? 1500 : 5000;
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
        if (activeUser?.id) {
            loadAllDriverData(activeUser.id);
        }
    };

    // ─── Online / Offline Toggle ───
    const toggleStatus = async () => {
        const uid = activeUser?.id;
        if (!uid) return;
        const newStatus = driverProfile?.status === 'active' ? 'inactive' : 'active';
        setDriverProfile(prev => ({ ...prev, status: newStatus, is_active: newStatus === 'active' }));

        try {
            await supabase
                .from('drivers')
                .update({ status: newStatus, is_active: newStatus === 'active', updated_at: new Date().toISOString() })
                .eq('user_id', uid);
        } catch (error) {
            console.log('Status update error:', error);
        }
    };

    // ─── Claim Order from Pool ───
    const acceptOrder = async (orderId) => {
        const uid = activeUser?.id;
        if (!uid) return;

        Alert.alert(
            'Claim Delivery Task',
            'Are you ready to accept and deliver this package to the customer?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept & Claim ⚡',
                    onPress: async () => {
                        const { error } = await supabase
                            .from('orders')
                            .update({
                                driver_id: uid,
                                status: 'shipped',
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', orderId);

                        if (error) {
                            Alert.alert('Error', error.message);
                        } else {
                            Alert.alert('Task Assigned! ⚡', 'Package is now in your Active tasks. Deliver promptly.');
                            fetchOrders(uid);
                            setActiveTab('active');
                        }
                    }
                }
            ]
        );
    };

    // ─── Mark Delivered & Credit Escrow ───
    const markDelivered = async (orderId, customerPhone, userId, orderTotal, isPod, shippingFee) => {
        const uid = activeUser?.id;
        if (!uid) return;

        const feeAmount = Number(shippingFee || 800);
        const podNotice = isPod ? `\n\n⚠️ IMPORTANT (POD): Collect ₦${Number(orderTotal || 0).toLocaleString()} cash/transfer before completing.` : '';

        Alert.alert(
            'Confirm Delivery Completion',
            `Has this package been securely handed over to the recipient?${podNotice}`,
            [
                { text: 'Not Yet', style: 'cancel' },
                {
                    text: 'Yes, Delivered ✅',
                    onPress: async () => {
                        try {
                            // 1. Mark order delivered
                            await supabase
                                .from('orders')
                                .update({ status: 'delivered', updated_at: new Date().toISOString() })
                                .eq('id', orderId);

                            // 2. Credit shipping fee to driver's balance in `profiles`
                            const { data: prof } = await supabase
                                .from('profiles')
                                .select('balance')
                                .eq('id', uid)
                                .maybeSingle();

                            const newBal = Number(prof?.balance || 0) + feeAmount;
                            await supabase
                                .from('profiles')
                                .update({ balance: newBal })
                                .eq('id', uid);

                            setWalletBalance(newBal);

                            // 3. Log credit transaction
                            await supabase.from('transactions').insert([{
                                user_id: uid,
                                type: 'credit',
                                amount: feeAmount,
                                status: 'completed',
                                reference: 'DEL-' + Date.now(),
                                description: `Delivery earnings for order #${orderId.slice(0, 8).toUpperCase()}`
                            }]);

                            Alert.alert('Delivery Successful! 🎉', `+₦${feeAmount.toLocaleString()} has been credited to your wallet balance.`);

                            if (customerPhone) {
                                const deliverMsg = `Your Abu Mafhal order #${orderId.slice(0, 8).toUpperCase()} has been successfully delivered. Thank you for shopping with us!`;
                                whatsappService.sendDirect(customerPhone, deliverMsg, userId).catch(() => {});
                            }

                            loadAllDriverData(uid);
                        } catch (err) {
                            Alert.alert('Error', err.message || 'Failed to complete delivery.');
                        }
                    }
                }
            ]
        );
    };

    // ─── Update Vehicle Details ───
    const updateVehicleDetails = async () => {
        const uid = activeUser?.id;
        if (!uid) return;

        try {
            const { error } = await supabase
                .from('drivers')
                .update({
                    vehicle_type: vType,
                    vehicle_number: pNumber,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', uid);

            if (error) throw error;

            setDriverProfile(prev => ({
                ...prev,
                vehicle_type: vType,
                vehicle_number: pNumber
            }));
            setVehicleModalVisible(false);
            Alert.alert('Vehicle Updated ✅', 'Your vehicle specifications have been saved.');
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to update vehicle details.');
        }
    };

    // ─── Request Bank Withdrawal ───
    const requestWithdrawal = async () => {
        const uid = activeUser?.id;
        if (!uid) return;

        const amount = parseFloat(withdrawAmount.replace(/,/g, '')) || 0;
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid withdrawal amount.');
            return;
        }

        if (amount > walletBalance) {
            Alert.alert('Insufficient Balance', 'You cannot withdraw more than your available wallet balance.');
            return;
        }

        if (!bankName || !accountNo || !accountName) {
            Alert.alert('Incomplete Details', 'Please verify your bank details before proceeding.');
            return;
        }

        Alert.alert(
            'Confirm Payout Request',
            `Send ₦${amount.toLocaleString()} to ${accountName} (${bankName} - ${accountNo})?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm Payout',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            // 1. Deduct balance from `profiles`
                            const newBal = walletBalance - amount;
                            await supabase
                                .from('profiles')
                                .update({ balance: newBal })
                                .eq('id', uid);

                            setWalletBalance(newBal);

                            // 2. Insert transaction record
                            await supabase.from('transactions').insert([{
                                user_id: uid,
                                type: 'debit',
                                amount: amount,
                                status: 'pending',
                                reference: 'WDR-' + Date.now(),
                                description: `Withdrawal to ${bankName} (${accountNo} - ${accountName})`
                            }]);

                            Alert.alert('Payout Submitted ✅', 'Your withdrawal request has been received and will be processed to your account.');
                            setWithdrawModalVisible(false);
                            setWithdrawAmount('');
                            setAccountNo('');
                            setAccountName('');
                            fetchTransactions(uid);
                        } catch (err) {
                            Alert.alert('Error', err.message || 'Failed to submit withdrawal.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleCall = (phone) => {
        if (!phone) return Alert.alert('No Phone', 'No customer phone number available.');
        Linking.openURL(`tel:${phone}`);
    };

    const handleMap = (address) => {
        if (!address) return Alert.alert('No Address', 'No delivery address specified.');
        const url = Platform.select({
            ios: `maps:0,0?q=${encodeURIComponent(address)}`,
            android: `geo:0,0?q=${encodeURIComponent(address)}`
        });
        Linking.openURL(url);
    };

    const parseAddress = (addrJson) => {
        if (!addrJson) return 'Address not provided';
        try {
            if (typeof addrJson === 'string' && addrJson.startsWith('{')) {
                const parsed = JSON.parse(addrJson);
                return parsed?.address || parsed?.location || addrJson;
            }
            return addrJson;
        } catch (_) {
            return addrJson;
        }
    };

    // ─── RENDER ORDER ITEM (MODERN LUXURY CARD) ───
    const renderOrderItem = ({ item }) => {
        const address = parseAddress(item.shipping_address);
        const isPool = activeTab === 'pool';
        const isHistory = activeTab === 'history';
        const isPod = (item.payment_method || '').toLowerCase() === 'pod';
        const shippingFee = Number(item.shipping_fee) || 800;
        const totalAmount = Number(item.total_amount) || 0;
        const itemCount = Array.isArray(item.items) ? item.items.length : 1;
        const customerName = item.user?.full_name || 'Marketplace Buyer';
        const customerPhone = item.user?.phone || item.contact_phone || '';

        return (
            <View style={[styles.modernCard, isHistory && { opacity: 0.85 }]}>
                {/* Header Row */}
                <View style={styles.cardHeaderRow}>
                    <View style={styles.orderIdPill}>
                        <Ionicons name="cube-outline" size={13} color={GOLD} />
                        <Text style={styles.orderIdText}>ORD-{(item.id || '').slice(0, 6).toUpperCase()}</Text>
                    </View>

                    <View style={styles.feeBadge}>
                        <Ionicons name="cash-outline" size={12} color={SUCCESS} />
                        <Text style={styles.feeBadgeText}>+₦{shippingFee.toLocaleString()} Fee</Text>
                    </View>

                    <View style={[styles.statusBadge, isPool ? styles.statusBadgePool : isHistory ? styles.statusBadgeHistory : styles.statusBadgeActive]}>
                        <Text style={styles.statusBadgeText}>
                            {isPool ? 'WAITING PICKUP' : isHistory ? (item.status || '').toUpperCase() : 'IN TRANSIT'}
                        </Text>
                    </View>
                </View>

                {/* POD / Payment Alert Banner */}
                {isPod ? (
                    <View style={styles.podAlertBanner}>
                        <Ionicons name="alert-circle" size={16} color="#B45309" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.podAlertTitle}>PAY ON DELIVERY (POD)</Text>
                            <Text style={styles.podAlertDesc}>
                                Collect <Text style={{ fontWeight: '900', color: '#78350F' }}>₦{totalAmount.toLocaleString()}</Text> in Cash or Bank Transfer from customer.
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.prepaidBanner}>
                        <Ionicons name="checkmark-circle" size={15} color={SUCCESS} />
                        <Text style={styles.prepaidText}>PAID ONLINE • Do not collect package money</Text>
                    </View>
                )}

                {/* Package & Customer Details Preview */}
                <View style={styles.packagePreviewRow}>
                    <View style={styles.packageIconBox}>
                        <Ionicons name="cube-outline" size={24} color={GOLD} />
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text style={styles.packageTitle} numberOfLines={1}>
                            Consignment #{item.id?.slice(0, 8).toUpperCase()}
                        </Text>
                        <Text style={styles.packageMeta}>
                            {itemCount} package item(s) • Total: ₦{totalAmount.toLocaleString()}
                        </Text>
                        <Text style={styles.customerName} numberOfLines={1}>
                            👤 {customerName}
                        </Text>
                    </View>
                </View>

                {/* Route Section */}
                <View style={styles.routeCard}>
                    <View style={styles.routeRow}>
                        <Ionicons name="location-outline" size={16} color={GOLD} style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.routeLabel}>DELIVERY ADDRESS</Text>
                            <Text style={styles.routeAddress} numberOfLines={2}>{address}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.navigateMiniBtn}
                            onPress={() => handleMap(address)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="navigate" size={14} color="#070D1B" />
                            <Text style={styles.navigateMiniBtnText}>Map</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Customer Contact Toolbar (When Active) */}
                {!isPool && !isHistory && (
                    <View style={styles.contactToolbar}>
                        <TouchableOpacity
                            style={styles.contactBtnCall}
                            onPress={() => handleCall(customerPhone)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="call" size={14} color="#FFFFFF" />
                            <Text style={styles.contactBtnCallText}>Call Recipient</Text>
                        </TouchableOpacity>

                        {customerPhone ? (
                            <TouchableOpacity
                                style={styles.contactBtnWhatsapp}
                                onPress={() => {
                                    setWhatsappPhone(customerPhone);
                                    setWhatsappUserId(item.user_id);
                                    setWhatsappRecipientName(customerName);
                                    setWhatsappVisible(true);
                                }}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />
                                <Text style={styles.contactBtnWhatsappText}>WhatsApp</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                )}

                {/* Bottom Main Action Button */}
                <View style={styles.cardActionContainer}>
                    {isPool ? (
                        <TouchableOpacity
                            style={styles.actionBtnClaim}
                            onPress={() => acceptOrder(item.id)}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#D9A73A', '#B45309']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.actionBtnGradient}
                            >
                                <Ionicons name="flash" size={16} color="#070D1B" />
                                <Text style={styles.actionBtnClaimText}>Accept & Claim Delivery ⚡</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : !isHistory ? (
                        <TouchableOpacity
                            style={styles.actionBtnDeliver}
                            onPress={() => markDelivered(item.id, customerPhone, item.user_id, totalAmount, isPod, shippingFee)}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#10B981', '#059669']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.actionBtnGradient}
                            >
                                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                                <Text style={styles.actionBtnDeliverText}>Confirm Package Handed Over ✅</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.actionBtnDetails}
                            onPress={() => setSelectedOrder(item)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="document-text-outline" size={15} color="#94A3B8" />
                            <Text style={styles.actionBtnDetailsText}>View Delivery Invoice & Breakdown</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
            {/* ─── 1. EXECUTIVE LUXURY HEADER ─── */}
            <LinearGradient
                colors={['#070D1B', '#0E1A2E', '#16233B']}
                style={styles.headerGradient}
            >
                {/* Top Row: Avatar, Identity, Actions */}
                <View style={styles.headerTopRow}>
                    <View style={styles.driverIdentityBox}>
                        <View style={styles.avatarWrap}>
                            <Image
                                source={{ uri: activeUser?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop' }}
                                style={styles.avatarImg}
                            />
                            <View style={[styles.avatarOnlineDot, { backgroundColor: driverProfile?.status === 'active' ? SUCCESS : '#64748B' }]} />
                        </View>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.driverName} numberOfLines={1}>{activeUser?.full_name || 'Courier Partner'}</Text>
                                <View style={[styles.levelTag, { backgroundColor: stats.level === 'Elite' ? '#FEF3C7' : 'rgba(217, 167, 58, 0.2)' }]}>
                                    <Text style={[styles.levelTagText, { color: stats.level === 'Elite' ? '#B45309' : GOLD }]}>{stats.level.toUpperCase()}</Text>
                                </View>
                            </View>
                            <Text style={styles.driverSubRole}>Abu Mafhal Logistics • Verified Courier</Text>
                        </View>
                    </View>

                    <View style={styles.headerActionGroup}>
                        <TouchableOpacity onPress={handleRefresh} style={styles.headerIconBtn} activeOpacity={0.75}>
                            <Ionicons name="reload" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onLogout} style={[styles.headerIconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]} activeOpacity={0.75}>
                            <Ionicons name="power" size={18} color={DANGER} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Status Toggle Card Bar */}
                <View style={styles.statusToggleBanner}>
                    <View style={styles.statusIndicatorRow}>
                        <View style={[styles.statusPulseDot, { backgroundColor: driverProfile?.status === 'active' ? SUCCESS : '#64748B' }]} />
                        <View>
                            <Text style={[styles.statusTitle, { color: driverProfile?.status === 'active' ? '#FFFFFF' : '#94A3B8' }]}>
                                {driverProfile?.status === 'active' ? 'ONLINE • ACCEPTING DELIVERIES' : 'OFFLINE • STANDBY'}
                            </Text>
                            <Text style={styles.statusVehicleSubtitle}>
                                {driverProfile?.vehicle_type || 'Vehicle'} • {driverProfile?.vehicle_number || 'Registered Courier'}
                            </Text>
                        </View>
                    </View>
                    <Switch
                        value={driverProfile?.status === 'active'}
                        onValueChange={toggleStatus}
                        trackColor={{ false: '#334155', true: '#059669' }}
                        thumbColor={driverProfile?.status === 'active' ? SUCCESS : '#94A3B8'}
                    />
                </View>

                {/* Metrics Stats 4-Card Grid */}
                <View style={styles.metricsGrid}>
                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('wallet')} activeOpacity={0.85}>
                        <View style={styles.metricIconWrap}>
                            <Ionicons name="wallet-outline" size={16} color={GOLD} />
                        </View>
                        <Text style={styles.metricValue}>₦{walletBalance.toLocaleString()}</Text>
                        <Text style={styles.metricLabel}>Wallet Balance</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('active')} activeOpacity={0.85}>
                        <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                            <Ionicons name="bicycle" size={16} color={SUCCESS} />
                        </View>
                        <Text style={[styles.metricValue, { color: SUCCESS }]}>{orders.length}</Text>
                        <Text style={styles.metricLabel}>Active Tasks</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('pool')} activeOpacity={0.85}>
                        <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                            <Ionicons name="flash-outline" size={16} color={AMBER} />
                        </View>
                        <Text style={[styles.metricValue, { color: AMBER }]}>{poolOrders.length}</Text>
                        <Text style={styles.metricLabel}>Available Pool</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('history')} activeOpacity={0.85}>
                        <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                            <Ionicons name="checkmark-done" size={16} color="#38BDF8" />
                        </View>
                        <Text style={[styles.metricValue, { color: '#38BDF8' }]}>{stats.completedDeliveries}</Text>
                        <Text style={styles.metricLabel}>Completed</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* ─── 2. SEGMENTED TAB SELECTOR ─── */}
            <View style={styles.tabBarContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
                    {[
                        { id: 'active', label: `Active (${orders.length})`, icon: 'bicycle-outline' },
                        { id: 'pool', label: `Job Pool (${poolOrders.length})`, icon: 'flash-outline' },
                        { id: 'wallet', label: 'Wallet & Cash Out', icon: 'wallet-outline' },
                        { id: 'history', label: 'History', icon: 'time-outline' },
                        { id: 'profile', label: 'Vehicle & Perks', icon: 'car-sport-outline' }
                    ].map(tab => {
                        const isCurrent = activeTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setActiveTab(tab.id)}
                                style={[styles.modernTabPill, isCurrent && styles.modernTabPillActive]}
                                activeOpacity={0.8}
                            >
                                <Ionicons name={tab.icon} size={15} color={isCurrent ? '#070D1B' : '#94A3B8'} />
                                <Text style={[styles.modernTabPillText, isCurrent && styles.modernTabPillTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ─── 3. MAIN TAB CONTENT AREA ─── */}
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={GOLD} />}
                contentContainerStyle={styles.mainScrollContent}
            >
                {/* TAB 1: ACTIVE DELIVERIES */}
                {activeTab === 'active' && (
                    <View style={styles.tabContentSection}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Current Shipments in Transit</Text>
                            <Text style={styles.sectionCountText}>{orders.length} Deliveries</Text>
                        </View>

                        {orders.length === 0 ? (
                            <View style={styles.emptyCardBox}>
                                <Ionicons name="bicycle-outline" size={48} color="#64748B" />
                                <Text style={styles.emptyTitle}>No Active Deliveries</Text>
                                <Text style={styles.emptySubtitle}>You do not have any pending packages in transit right now.</Text>
                                <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setActiveTab('pool')}>
                                    <Text style={styles.emptyActionBtnText}>Browse Available Pool Jobs ⚡</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            orders.map(item => (
                                <View key={item.id} style={{ marginBottom: 14 }}>
                                    {renderOrderItem({ item })}
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* TAB 2: AVAILABLE JOB POOL */}
                {activeTab === 'pool' && (
                    <View style={styles.tabContentSection}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Ready for Pickup Across Region</Text>
                            <Text style={styles.sectionCountText}>{poolOrders.length} Available</Text>
                        </View>

                        {poolOrders.length === 0 ? (
                            <View style={styles.emptyCardBox}>
                                <Ionicons name="sparkles-outline" size={48} color={GOLD} />
                                <Text style={styles.emptyTitle}>Job Pool is Quiet</Text>
                                <Text style={styles.emptySubtitle}>All orders are currently covered. New orders appear automatically in real-time.</Text>
                            </View>
                        ) : (
                            poolOrders.map(item => (
                                <View key={item.id} style={{ marginBottom: 14 }}>
                                    {renderOrderItem({ item })}
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* TAB 3: WALLET & EARNINGS */}
                {activeTab === 'wallet' && (
                    <View style={styles.tabContentSection}>
                        {/* Luxury Wallet Card */}
                        <LinearGradient
                            colors={['#132038', '#182844', '#0E1A2E']}
                            style={styles.luxuryWalletBanner}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View>
                                    <Text style={styles.walletHeaderLabel}>DRIVER ESCROW WALLET</Text>
                                    <Text style={styles.walletHeaderBalance}>₦{walletBalance.toLocaleString()}</Text>
                                </View>
                                <View style={styles.walletAmcChip}>
                                    <Ionicons name="sparkles" size={13} color={GOLD} />
                                    <Text style={styles.walletAmcChipText}>Verified Driver</Text>
                                </View>
                            </View>

                            <View style={styles.walletActionsBar}>
                                <TouchableOpacity
                                    style={styles.cashOutPrimaryBtn}
                                    onPress={() => setWithdrawModalVisible(true)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="arrow-up-circle-outline" size={18} color="#070D1B" />
                                    <Text style={styles.cashOutPrimaryBtnText}>Request Bank Payout</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.payoutHistorySecBtn}
                                    onPress={() => setHistoryModalVisible(true)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="list" size={16} color="#FFFFFF" />
                                    <Text style={styles.payoutHistorySecBtnText}>Transaction Log ({withdrawals.length})</Text>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>

                        {/* Weekly Earnings Overview */}
                        <View style={styles.analyticsCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <Text style={styles.cardHeaderTitle}>Weekly Earnings Overview</Text>
                                <Text style={styles.cardHeaderSubValue}>Total: ₦{stats.totalEarnings.toLocaleString()}</Text>
                            </View>

                            <View style={styles.weeklyChartRow}>
                                {stats.weeklyDaily?.map((d, i) => {
                                    const maxVal = Math.max(...stats.weeklyDaily.map(x => x.amount)) || 1;
                                    const barHeight = Math.max(10, (d.amount / maxVal) * 85);
                                    return (
                                        <View key={i} style={styles.chartCol}>
                                            <View style={[styles.chartBarBackground, { height: barHeight }]}>
                                                <LinearGradient
                                                    colors={['#D9A73A', '#B45309']}
                                                    style={{ flex: 1, borderRadius: 4 }}
                                                />
                                            </View>
                                            <Text style={styles.chartDayText}>{d.day}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    </View>
                )}

                {/* TAB 4: HISTORY */}
                {activeTab === 'history' && (
                    <View style={styles.tabContentSection}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Completed & Closed Deliveries</Text>
                            <Text style={styles.sectionCountText}>{historyOrders.length} Records</Text>
                        </View>

                        {historyOrders.length === 0 ? (
                            <View style={styles.emptyCardBox}>
                                <Ionicons name="time-outline" size={48} color="#64748B" />
                                <Text style={styles.emptyTitle}>No Delivery History Yet</Text>
                                <Text style={styles.emptySubtitle}>Completed and fulfilled deliveries will appear here with invoices.</Text>
                            </View>
                        ) : (
                            historyOrders.map(item => (
                                <View key={item.id} style={{ marginBottom: 14 }}>
                                    {renderOrderItem({ item })}
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* TAB 5: PROFILE & VEHICLE */}
                {activeTab === 'profile' && (
                    <View style={styles.tabContentSection}>
                        {/* Driver Courier Perks Card */}
                        <View style={styles.perksCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <View>
                                    <Text style={styles.perksCardTitle}>Courier Rank: {stats.level} Tier</Text>
                                    <Text style={styles.perksCardSubtitle}>Complete more deliveries to unlock VIP bonuses</Text>
                                </View>
                                <View style={styles.streakBadge}>
                                    <Ionicons name="flame" size={14} color="#EF4444" />
                                    <Text style={styles.streakBadgeText}>{streakCount} Day Streak</Text>
                                </View>
                            </View>

                            <View style={styles.xpProgressBarBg}>
                                <View style={[styles.xpProgressBarFill, { width: `${stats.xpProgress}%` }]} />
                            </View>
                            <Text style={styles.xpProgressText}>{stats.xp} XP • {stats.completionRate}% Completion Rate</Text>
                        </View>

                        {/* Vehicle Specifications Card */}
                        <View style={styles.vehicleInfoCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={styles.vehicleCardTitle}>Assigned Logistics Vehicle</Text>
                                <TouchableOpacity style={styles.editVehicleBtn} onPress={() => setVehicleModalVisible(true)} activeOpacity={0.8}>
                                    <Ionicons name="create-outline" size={14} color={GOLD} />
                                    <Text style={styles.editVehicleBtnText}>Edit Details</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.vehicleRow}>
                                <Ionicons name="car-sport-outline" size={18} color="#94A3B8" />
                                <Text style={styles.vehiclePropLabel}>Vehicle Type:</Text>
                                <Text style={styles.vehiclePropVal}>{driverProfile?.vehicle_type || 'Motorcycle'}</Text>
                            </View>

                            <View style={styles.vehicleRow}>
                                <Ionicons name="barcode-outline" size={18} color="#94A3B8" />
                                <Text style={styles.vehiclePropLabel}>Plate / Reg Number:</Text>
                                <Text style={styles.vehiclePropVal}>{driverProfile?.vehicle_number || 'Not Set'}</Text>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* ─── MODAL 1: ORDER INVOICE DETAILS ─── */}
            <Modal visible={!!selectedOrder} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheetContent}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Delivery Breakdown</Text>
                            <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        {selectedOrder && (
                            <ScrollView style={{ padding: 18 }}>
                                <View style={styles.invoiceHeroBox}>
                                    <Text style={styles.invoiceHeroLabel}>TOTAL ORDER VALUE</Text>
                                    <Text style={styles.invoiceHeroValue}>₦{Number(selectedOrder.total_amount || 0).toLocaleString()}</Text>
                                    <Text style={styles.invoiceHeroFee}>Driver Fee: +₦{Number(selectedOrder.shipping_fee || 800).toLocaleString()}</Text>
                                </View>

                                <View style={styles.invoiceSection}>
                                    <Text style={styles.invoiceSectionTitle}>CUSTOMER DETAILS</Text>
                                    <Text style={styles.invoiceLineText}>👤 Name: {selectedOrder.user?.full_name || 'Marketplace Buyer'}</Text>
                                    <Text style={styles.invoiceLineText}>📞 Phone: {selectedOrder.user?.phone || selectedOrder.contact_phone || 'N/A'}</Text>
                                    <Text style={styles.invoiceLineText}>📍 Address: {parseAddress(selectedOrder.shipping_address)}</Text>
                                    <Text style={styles.invoiceLineText}>💳 Payment: {selectedOrder.payment_method?.toUpperCase()} ({selectedOrder.payment_status || 'Paid'})</Text>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ─── MODAL 2: VEHICLE INFORMATION ─── */}
            <Modal visible={isVehicleModalVisible} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheetContent}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Update Vehicle Specifications</Text>
                            <TouchableOpacity onPress={() => setVehicleModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ padding: 20 }}>
                            <Text style={styles.inputFieldLabel}>Vehicle Type (e.g. Motorcycle, Tricycle, Van)</Text>
                            <TextInput
                                style={styles.textInputModern}
                                value={vType}
                                onChangeText={setVType}
                                placeholder="Motorcycle"
                                placeholderTextColor="#64748B"
                            />

                            <Text style={styles.inputFieldLabel}>Plate / Registration Number</Text>
                            <TextInput
                                style={styles.textInputModern}
                                value={pNumber}
                                onChangeText={setPNumber}
                                placeholder="ABC-123XY"
                                placeholderTextColor="#64748B"
                            />

                            <TouchableOpacity style={styles.submitBtnGold} onPress={updateVehicleDetails} activeOpacity={0.85}>
                                <Text style={styles.submitBtnGoldText}>Save Vehicle Details ✅</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ─── MODAL 3: BANK PAYOUT WITHDRAWAL ─── */}
            <Modal visible={isWithdrawModalVisible} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheetContent}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Withdraw to Bank Account</Text>
                            <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ padding: 20 }}>
                            <View style={styles.payoutBalanceNotice}>
                                <Text style={styles.payoutBalanceNoticeLabel}>AVAILABLE ESCROW BALANCE</Text>
                                <Text style={styles.payoutBalanceNoticeValue}>₦{walletBalance.toLocaleString()}</Text>
                            </View>

                            <Text style={styles.inputFieldLabel}>Withdrawal Amount (₦)</Text>
                            <TextInput
                                style={styles.textInputModern}
                                value={withdrawAmount}
                                onChangeText={setWithdrawAmount}
                                placeholder="5,000"
                                placeholderTextColor="#64748B"
                                keyboardType="numeric"
                            />

                            <Text style={styles.inputFieldLabel}>Select Bank</Text>
                            <TouchableOpacity
                                style={styles.bankSelectTrigger}
                                onPress={() => setShowBankDropdown(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={{ color: bankName ? '#FFFFFF' : '#64748B', fontWeight: '600' }}>
                                    {bankName || 'Tap to choose your bank'}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={GOLD} />
                            </TouchableOpacity>

                            <Text style={styles.inputFieldLabel}>10-Digit NUBAN Account Number</Text>
                            <TextInput
                                style={styles.textInputModern}
                                value={accountNo}
                                onChangeText={setAccountNo}
                                placeholder="0123456789"
                                placeholderTextColor="#64748B"
                                keyboardType="numeric"
                                maxLength={10}
                            />

                            {resolvingAccount && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                    <ActivityIndicator size="small" color={GOLD} />
                                    <Text style={{ color: GOLD, fontSize: 12 }}>Verifying account name via Paystack...</Text>
                                </View>
                            )}

                            {accountName ? (
                                <View style={styles.verifiedAccountBanner}>
                                    <Text style={styles.verifiedAccountLabel}>VERIFIED ACCOUNT HOLDER</Text>
                                    <Text style={styles.verifiedAccountName}>{accountName}</Text>
                                </View>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.payoutSubmitBtn, (!accountName || loading) && { opacity: 0.6 }]}
                                onPress={requestWithdrawal}
                                disabled={!accountName || loading}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.payoutSubmitBtnText}>
                                    {loading ? 'Processing...' : 'Confirm Payout to Bank 💳'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ─── MODAL 4: BANK SELECTOR SUB-MODAL ─── */}
            <Modal visible={showBankDropdown} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalSheetContent, { maxHeight: '80%' }]}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Select Receiving Bank</Text>
                            <TouchableOpacity onPress={() => setShowBankDropdown(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ padding: 16, flex: 1 }}>
                            <View style={styles.bankSearchWrap}>
                                <Ionicons name="search" size={16} color="#64748B" />
                                <TextInput
                                    style={styles.bankSearchInput}
                                    placeholder="Search bank name..."
                                    placeholderTextColor="#64748B"
                                    value={searchBankQuery}
                                    onChangeText={handleSearchBank}
                                />
                            </View>

                            <ScrollView style={{ flex: 1 }}>
                                {filteredBanks.map(b => (
                                    <TouchableOpacity
                                        key={b.id || b.code}
                                        style={styles.bankSelectRow}
                                        onPress={() => {
                                            setBankName(b.name);
                                            setBankCode(b.code);
                                            setShowBankDropdown(false);
                                        }}
                                    >
                                        <Text style={styles.bankSelectRowText}>{b.name}</Text>
                                        <Ionicons name="chevron-forward" size={16} color="#64748B" />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ─── MODAL 5: TRANSACTION LOGS ─── */}
            <Modal visible={isHistoryModalVisible} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheetContent}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Wallet Transaction Logs</Text>
                            <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ padding: 18 }}>
                            {withdrawals.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                    <Ionicons name="wallet-outline" size={40} color="#64748B" />
                                    <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 13 }}>No transaction records yet</Text>
                                </View>
                            ) : (
                                withdrawals.map(w => (
                                    <View key={w.id} style={styles.payoutLogRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.payoutLogAmount}>
                                                {w.type === 'debit' ? '-' : '+'}₦{Number(w.amount || 0).toLocaleString()}
                                            </Text>
                                            <Text style={styles.payoutLogMeta}>{w.description || 'Transaction'}</Text>
                                            <Text style={[styles.payoutLogMeta, { fontSize: 10 }]}>
                                                {new Date(w.created_at).toLocaleDateString()} • {w.reference || ''}
                                            </Text>
                                        </View>
                                        <View style={[styles.payoutStatusPill, { backgroundColor: w.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)' }]}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: w.status === 'completed' ? SUCCESS : AMBER }}>
                                                {(w.status || 'PENDING').toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ─── WHATSAPP MODAL ─── */}
            <WhatsAppActionModal
                visible={whatsappVisible}
                phone={whatsappPhone}
                userId={whatsappUserId}
                recipientName={whatsappRecipientName}
                onClose={() => setWhatsappVisible(false)}
            />
        </SafeAreaView>
    );
};

// ─── HIGH-END ABU MAFHAL LUXURY STYLES ───
const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: NAVY,
    },
    headerGradient: {
        paddingTop: Platform.OS === 'ios' ? 8 : 14,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        borderBottomWidth: 1,
        borderColor: BORDER_GOLD,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    driverIdentityBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatarWrap: {
        position: 'relative',
    },
    avatarImg: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 2,
        borderColor: GOLD,
    },
    avatarOnlineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: SUCCESS,
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderWidth: 2,
        borderColor: NAVY,
    },
    driverName: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    levelTag: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    levelTagText: {
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    driverSubRole: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 2,
    },
    headerActionGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    statusToggleBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(14, 26, 46, 0.85)',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
        marginBottom: 14,
    },
    statusIndicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    statusPulseDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusTitle: {
        fontSize: 11.5,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    statusVehicleSubtitle: {
        fontSize: 10.5,
        color: '#94A3B8',
        marginTop: 1,
    },
    metricsGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    metricCard: {
        flex: 1,
        backgroundColor: CARD_BG,
        borderRadius: 14,
        padding: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    metricIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    metricValue: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    metricLabel: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '700',
        marginTop: 2,
    },
    tabBarContainer: {
        backgroundColor: DARK_SURFACE,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_SUBTLE,
    },
    tabScrollContent: {
        paddingHorizontal: 14,
        gap: 8,
    },
    modernTabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    modernTabPillActive: {
        backgroundColor: GOLD,
        borderColor: GOLD,
    },
    modernTabPillText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#94A3B8',
    },
    modernTabPillTextActive: {
        color: '#070D1B',
    },
    mainScrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    tabContentSection: {
        width: '100%',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    sectionCountText: {
        fontSize: 12,
        fontWeight: '700',
        color: GOLD,
    },
    modernCard: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    orderIdPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8,
    },
    orderIdText: {
        fontSize: 11,
        fontWeight: '900',
        color: GOLD,
    },
    feeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    feeBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: SUCCESS,
    },
    statusBadge: {
        marginLeft: 'auto',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusBadgeActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    statusBadgePool: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    statusBadgeHistory: {
        backgroundColor: 'rgba(148, 163, 184, 0.2)',
    },
    statusBadgeText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    podAlertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF3C7',
        padding: 10,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    podAlertTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: '#B45309',
        letterSpacing: 0.5,
    },
    podAlertDesc: {
        fontSize: 11.5,
        color: '#78350F',
        marginTop: 1,
    },
    prepaidBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginBottom: 12,
    },
    prepaidText: {
        fontSize: 11,
        fontWeight: '800',
        color: SUCCESS,
    },
    packagePreviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: CARD_BG_ELEVATED,
        padding: 10,
        borderRadius: 12,
        marginBottom: 12,
    },
    packageIconBox: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: BORDER_GOLD,
    },
    packageTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    packageMeta: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    customerName: {
        fontSize: 11.5,
        color: GOLD_LIGHT,
        fontWeight: '700',
        marginTop: 2,
    },
    routeCard: {
        backgroundColor: CARD_BG_ELEVATED,
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    routeLabel: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    routeAddress: {
        fontSize: 12.5,
        color: '#FFFFFF',
        fontWeight: '600',
        marginTop: 1,
    },
    navigateMiniBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: GOLD,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    navigateMiniBtnText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#070D1B',
    },
    contactToolbar: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    contactBtnCall: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    contactBtnCallText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    contactBtnWhatsapp: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#16A34A',
        paddingVertical: 10,
        borderRadius: 10,
    },
    contactBtnWhatsappText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    cardActionContainer: {
        marginTop: 2,
    },
    actionBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 12,
    },
    actionBtnClaimText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#070D1B',
    },
    actionBtnDeliverText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    actionBtnDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 11,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    actionBtnDetailsText: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '700',
    },
    emptyCardBox: {
        backgroundColor: CARD_BG,
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 12,
    },
    emptySubtitle: {
        fontSize: 12,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
    },
    emptyActionBtn: {
        backgroundColor: GOLD,
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: 12,
        marginTop: 16,
    },
    emptyActionBtnText: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#070D1B',
    },
    luxuryWalletBanner: {
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: BORDER_GOLD,
        marginBottom: 16,
    },
    walletHeaderLabel: {
        fontSize: 10.5,
        color: '#94A3B8',
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    walletHeaderBalance: {
        fontSize: 28,
        fontWeight: '900',
        color: SUCCESS,
        marginTop: 4,
    },
    walletAmcChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER_GOLD,
    },
    walletAmcChipText: {
        fontSize: 11.5,
        fontWeight: '900',
        color: GOLD,
    },
    walletActionsBar: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    cashOutPrimaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: GOLD,
        paddingVertical: 12,
        borderRadius: 12,
    },
    cashOutPrimaryBtnText: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#070D1B',
    },
    payoutHistorySecBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    payoutHistorySecBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    analyticsCard: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    cardHeaderTitle: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    cardHeaderSubValue: {
        fontSize: 12,
        fontWeight: '800',
        color: SUCCESS,
    },
    weeklyChartRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 100,
        paddingTop: 10,
    },
    chartCol: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'flex-end',
    },
    chartBarBackground: {
        width: 14,
        borderRadius: 4,
        overflow: 'hidden',
    },
    chartDayText: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
        marginTop: 6,
    },
    perksCard: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
        marginBottom: 14,
    },
    perksCardTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    perksCardSubtitle: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    streakBadgeText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#EF4444',
    },
    xpProgressBarBg: {
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 4,
        marginVertical: 10,
        overflow: 'hidden',
    },
    xpProgressBarFill: {
        height: '100%',
        backgroundColor: GOLD,
        borderRadius: 4,
    },
    xpProgressText: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
    },
    vehicleInfoCard: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    vehicleCardTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    editVehicleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    editVehicleBtnText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: GOLD,
    },
    vehicleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    vehiclePropLabel: {
        fontSize: 12.5,
        color: '#94A3B8',
        fontWeight: '600',
        width: 140,
    },
    vehiclePropVal: {
        fontSize: 13,
        color: '#FFFFFF',
        fontWeight: '800',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    modalSheetContent: {
        backgroundColor: DARK_SURFACE,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '88%',
        borderWidth: 1,
        borderColor: BORDER_GOLD,
    },
    modalSheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_SUBTLE,
    },
    modalSheetTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    modalCloseCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    invoiceHeroBox: {
        backgroundColor: CARD_BG,
        padding: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: BORDER_GOLD,
    },
    invoiceHeroLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    invoiceHeroValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2,
    },
    invoiceHeroFee: {
        fontSize: 12,
        fontWeight: '800',
        color: SUCCESS,
        marginTop: 4,
    },
    invoiceSection: {
        backgroundColor: CARD_BG,
        padding: 14,
        borderRadius: 12,
        marginBottom: 12,
    },
    invoiceSectionTitle: {
        fontSize: 11,
        color: GOLD,
        fontWeight: '800',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    invoiceLineText: {
        fontSize: 12.5,
        color: '#FFFFFF',
        lineHeight: 20,
    },
    inputFieldLabel: {
        fontSize: 11.5,
        color: '#94A3B8',
        fontWeight: '700',
        marginTop: 12,
        marginBottom: 6,
    },
    textInputModern: {
        backgroundColor: CARD_BG,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#FFFFFF',
        fontSize: 13.5,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    submitBtnGold: {
        backgroundColor: GOLD,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
    },
    submitBtnGoldText: {
        color: '#070D1B',
        fontSize: 13.5,
        fontWeight: '900',
    },
    payoutBalanceNotice: {
        backgroundColor: CARD_BG,
        borderRadius: 12,
        padding: 14,
        marginTop: 6,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: BORDER_GOLD,
    },
    payoutBalanceNoticeLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
    },
    payoutBalanceNoticeValue: {
        fontSize: 22,
        fontWeight: '900',
        color: SUCCESS,
        marginTop: 2,
    },
    bankSelectTrigger: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    verifiedAccountBanner: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderRadius: 10,
        padding: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    verifiedAccountLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: SUCCESS,
        letterSpacing: 0.5,
    },
    verifiedAccountName: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2,
    },
    payoutSubmitBtn: {
        backgroundColor: GOLD,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
    },
    payoutSubmitBtnText: {
        color: '#070D1B',
        fontSize: 13.5,
        fontWeight: '900',
    },
    bankSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    bankSearchInput: {
        flex: 1,
        paddingVertical: 11,
        fontSize: 13,
        color: '#FFFFFF',
        marginLeft: 8,
    },
    bankSelectRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    bankSelectRowText: {
        fontSize: 13.5,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    payoutLogRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    payoutLogAmount: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    payoutLogMeta: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    payoutStatusPill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
});
