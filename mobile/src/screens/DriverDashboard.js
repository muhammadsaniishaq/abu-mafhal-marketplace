import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
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
let ExpoIonicons = null;
try {
    const vectorIcons = require('@expo/vector-icons');
    if (vectorIcons && vectorIcons.Ionicons) {
        ExpoIonicons = vectorIcons.Ionicons;
    }
} catch (_) {}

const ICON_FALLBACKS = {
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
    if (ExpoIonicons) {
        try {
            return <ExpoIonicons name={name} size={size} color={color} style={style} />;
        } catch (_) {}
    }
    const glyph = ICON_FALLBACKS[name] || '•';
    return (
        <Text style={[{ fontSize: Math.round(size * 0.88), color, textAlign: 'center', lineHeight: Math.round(size * 1.1) }, style]}>
            {glyph}
        </Text>
    );
};
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { whatsappService } from '../services/whatsappService';
import { WhatsAppActionModal } from '../components/WhatsAppActionModal';

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

// Streak reward sequence
const CHECKIN_REWARDS = [0, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10];
const VALID_DRIVER_TABS = ['active', 'pool', 'wallet', 'history', 'profile'];

const getInitialDriverTab = (route) => {
    try {
        const paramTab = route?.params?.tab || route?.params?.screen;
        if (paramTab && VALID_DRIVER_TABS.includes(paramTab)) return paramTab;

        if (typeof window !== 'undefined' && window.location) {
            const hash = window.location.hash || '';
            const match = hash.match(/[?&]tab=([a-zA-Z0-9_-]+)/);
            if (match && match[1] && VALID_DRIVER_TABS.includes(match[1])) {
                return match[1];
            }
            const subMatch = hash.match(/#driver\/([a-zA-Z0-9_-]+)/);
            if (subMatch && subMatch[1] && VALID_DRIVER_TABS.includes(subMatch[1])) {
                return subMatch[1];
            }
            const saved = window.localStorage?.getItem('@abumafhal_driver_tab');
            if (saved && VALID_DRIVER_TABS.includes(saved)) {
                return saved;
            }
        }
    } catch (_) {}
    return 'active';
};

export const DriverDashboard = ({ user, onLogout, navigation, route }) => {
    const insets = useSafeAreaInsets();

    // Data State
    const [orders, setOrders] = useState([]);
    const [poolOrders, setPoolOrders] = useState([]);
    const [historyOrders, setHistoryOrders] = useState([]);
    const [driverProfile, setDriverProfile] = useState(() => ({
        id: user?.id,
        status: 'active',
        mafhal_coins: 0,
        vehicle_type: 'Motorcycle',
        plate_number: '',
        vehicle_color: '',
        driver_license: ''
    }));
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
    const [wallet, setWallet] = useState({ balance: 0, pending_balance: 0 });
    const [withdrawals, setWithdrawals] = useState([]);

    // UI State (Zero-delay entrance)
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, _setActiveTab] = useState(() => getInitialDriverTab(route));
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Gamification & Check-in
    const [checkInData, setCheckInData] = useState({ streak: 0, checkedInToday: false, checkingIn: false });
    const [animatingCoins, setAnimatingCoins] = useState(0);

    // Modals
    const [isVehicleModalVisible, setVehicleModalVisible] = useState(false);
    const [isWithdrawModalVisible, setWithdrawModalVisible] = useState(false);
    const [isHistoryModalVisible, setHistoryModalVisible] = useState(false);
    const [historyFilter, setHistoryFilter] = useState('All');

    // Vehicle Form
    const [vType, setVType] = useState('');
    const [pNumber, setPNumber] = useState('');
    const [vColor, setVColor] = useState('');
    const [dLicense, setDLicense] = useState('');

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
            if (typeof window !== 'undefined' && window.localStorage) {
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

    // Lock hash and screen name
    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@abumafhal_last_screen', 'DriverDashboard');
                const curHash = window.location.hash || '';
                if (!curHash.startsWith('#driver')) {
                    const targetHash = activeTab === 'active' ? '#driver' : `#driver?tab=${activeTab}`;
                    if (window.history && window.history.replaceState) {
                        window.history.replaceState(null, '', '/mobile' + targetHash);
                    }
                }
            }
            AsyncStorage.setItem('@abumafhal_last_screen', 'DriverDashboard').catch(() => {});
        } catch (_) {}
    }, []);

    // Initial load and real-time subscription
    useEffect(() => {
        fetchDriverProfile();
        fetchBanks();

        const subscription = supabase
            .channel('driver_orders_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                const newDriverId = payload.new?.driver_id;
                const oldDriverId = payload.old?.driver_id;
                const currentId = driverProfile?.id || user?.id;

                if (newDriverId === currentId || oldDriverId === currentId || !newDriverId) {
                    fetchAllOrders(currentId);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [user?.id]);

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
                Alert.alert('Verification Notice', json.message || 'Could not verify account name.');
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

    const fetchDriverProfile = async () => {
        try {
            const [profileRes, walletRes] = await Promise.allSettled([
                supabase.rpc('ensure_driver_profile'),
                supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle()
            ]);

            const pData = profileRes.status === 'fulfilled' ? profileRes.value?.data : null;
            if (pData) {
                setDriverProfile(pData);
                setVType(pData.vehicle_type || '');
                setPNumber(pData.plate_number || '');
                setVColor(pData.vehicle_color || '');
                setDLicense(pData.driver_license || '');
                fetchAllOrders(pData.id, pData);
                fetchWithdrawalHistory(pData.id);
            } else {
                fetchAllOrders(user.id);
            }

            const wData = walletRes.status === 'fulfilled' ? walletRes.value?.data : null;
            if (wData) {
                setWallet(wData);
            } else {
                // Auto create wallet if missing
                const { data: newW } = await supabase
                    .from('wallets')
                    .insert([{ user_id: user.id, balance: 0, pending_balance: 0 }])
                    .select()
                    .maybeSingle();
                if (newW) setWallet(newW);
            }

            verifyCheckInStatus();
        } catch (e) {
            console.log('Fetch Driver Profile Error:', e);
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
            console.log('Error fetching withdrawals:', err);
        }
    };

    const verifyCheckInStatus = async () => {
        try {
            const { data } = await supabase.from('daily_checkins').select('*').eq('user_id', user.id).maybeSingle();
            if (data) {
                const lastCheckIn = new Date(data.last_checkin);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                lastCheckIn.setHours(0, 0, 0, 0);

                const diffDays = Math.round((today - lastCheckIn) / (1000 * 60 * 60 * 24));
                const isCheckedInToday = diffDays === 0;
                const newStreak = diffDays <= 1 ? data.current_streak : 0;

                setCheckInData({ streak: newStreak, checkedInToday: isCheckedInToday, checkingIn: false });

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

            await supabase.from('daily_checkins').upsert({
                user_id: user.id,
                last_checkin: new Date().toISOString(),
                current_streak: newStreak
            }, { onConflict: 'user_id' });

            const newCoins = (driverProfile?.mafhal_coins || 0) + rewardCoins;
            await supabase.rpc('update_user_amc', { p_user_id: user.id, p_coins: newCoins });

            setDriverProfile(prev => ({ ...prev, mafhal_coins: newCoins }));
            setCheckInData({ streak: newStreak, checkedInToday: true, checkingIn: false });

            setAnimatingCoins(rewardCoins);
            setTimeout(() => setAnimatingCoins(0), 2200);

            fetchDriverProfile();
        } catch (err) {
            console.error(err);
            setCheckInData(prev => ({ ...prev, checkingIn: false }));
        }
    };

    const fetchAllOrders = async (driverId, profileData = null) => {
        try {
            const [myOrdersRes, poolRes] = await Promise.allSettled([
                supabase
                    .from('orders')
                    .select('*, user:profiles(full_name, phone), items:order_items(*, product:products(name, images))')
                    .eq('driver_id', driverId)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('orders')
                    .select('*, user:profiles(full_name, phone), items:order_items(*, product:products(name, images))')
                    .is('driver_id', null)
                    .in('status', ['processing', 'pending', 'paid'])
                    .order('created_at', { ascending: false })
            ]);

            const myOrders = myOrdersRes.status === 'fulfilled' && Array.isArray(myOrdersRes.value?.data) ? myOrdersRes.value.data : [];
            const poolData = poolRes.status === 'fulfilled' && Array.isArray(poolRes.value?.data) ? poolRes.value.data : [];

            setOrders(myOrders.filter(o => ['shipped', 'processing', 'out_for_delivery', 'picked_up'].includes(o.status)));
            setHistoryOrders(myOrders.filter(o => ['delivered', 'cancelled', 'refunded'].includes(o.status)));
            setPoolOrders(poolData);

            calculateStats(myOrders, profileData || driverProfile);
        } catch (e) {
            console.log('fetchAllOrders Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const calculateStats = (allOrders, profile = driverProfile) => {
        const completed = allOrders.filter(o => o.status === 'delivered');
        const cancelled = allOrders.filter(o => o.status === 'cancelled');
        const earnings = completed.reduce((sum, order) => sum + (Number(order.delivery_fee) || 800), 0);

        const totalFinished = completed.length + cancelled.length;
        const rate = totalFinished > 0 ? Math.round((completed.length / totalFinished) * 100) : 100;

        const daily = [];
        const dailyList = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayOrders = completed.filter(o => o.updated_at?.startsWith(dateStr));
            const amount = dayOrders.reduce((sum, o) => sum + (Number(o.delivery_fee) || 800), 0);

            daily.push({ day: d.toLocaleDateString('en-US', { weekday: 'short' }), amount });
            if (amount > 0) {
                dailyList.push({
                    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    amount,
                    count: dayOrders.length
                });
            }
        }

        const xp = profile?.xp || 150;
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
        fetchDriverProfile();
    };

    const toggleStatus = async () => {
        if (!driverProfile) return;
        const newStatus = driverProfile.status === 'active' ? 'inactive' : 'active';
        setDriverProfile(prev => ({ ...prev, status: newStatus }));

        try {
            await supabase
                .from('drivers')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', driverProfile.id);
        } catch (error) {
            console.log('Status update error:', error);
            setDriverProfile(prev => ({ ...prev, status: driverProfile.status }));
        }
    };

    const acceptOrder = async (orderId) => {
        Alert.alert(
            'Claim Delivery Task',
            'Are you ready to pick up and deliver this package to the customer?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept & Claim ⚡',
                    onPress: async () => {
                        const { error } = await supabase
                            .from('orders')
                            .update({
                                driver_id: driverProfile.id,
                                status: 'shipped',
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', orderId);

                        if (error) {
                            Alert.alert('Error', error.message);
                        } else {
                            Alert.alert('Task Assigned!', 'Package is now in your Active tasks. Deliver promptly.');
                            fetchAllOrders(driverProfile.id);
                            setActiveTab('active');
                        }
                    }
                }
            ]
        );
    };

    const markDelivered = async (orderId, customerPhone, userId, orderTotal, isPod) => {
        const podNotice = isPod ? `\n\n⚠️ IMPORTANT (POD): Confirm you have received ₦${Number(orderTotal || 0).toLocaleString()} cash/transfer before confirming.` : '';

        Alert.alert(
            'Confirm Delivery Completion',
            `Has this package been securely handed over to the recipient?${podNotice}`,
            [
                { text: 'Not Yet', style: 'cancel' },
                {
                    text: 'Yes, Delivered ✅',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.rpc('complete_delivery', {
                                p_order_id: orderId,
                                p_driver_id: driverProfile.id
                            });

                            if (error) {
                                // Fallback update if RPC doesn't exist
                                await supabase
                                    .from('orders')
                                    .update({ status: 'delivered', updated_at: new Date().toISOString() })
                                    .eq('id', orderId);
                            }

                            Alert.alert('Delivery Successful!', 'Delivery fee has been credited to your driver wallet.');

                            if (customerPhone) {
                                const deliverMsg = `Your Abu Mafhal order #${orderId.slice(0, 8).toUpperCase()} has been successfully delivered. Thank you for shopping with us!`;
                                whatsappService.sendDirect(customerPhone, deliverMsg, userId).catch(() => {});
                            }

                            fetchDriverProfile();
                        } catch (err) {
                            Alert.alert('Error', err.message || 'Failed to complete delivery.');
                        }
                    }
                }
            ]
        );
    };

    const updateVehicleDetails = async () => {
        try {
            const { error } = await supabase
                .from('drivers')
                .update({
                    vehicle_type: vType,
                    plate_number: pNumber,
                    vehicle_color: vColor,
                    driver_license: dLicense,
                    updated_at: new Date().toISOString()
                })
                .eq('id', driverProfile.id);

            if (error) throw error;

            setDriverProfile(prev => ({
                ...prev,
                vehicle_type: vType,
                plate_number: pNumber,
                vehicle_color: vColor,
                driver_license: dLicense
            }));
            setVehicleModalVisible(false);
            Alert.alert('Vehicle Updated', 'Your vehicle and license details have been updated.');
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to update vehicle details.');
        }
    };

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
            return Alert.alert('Incomplete Details', 'Please verify your bank details before proceeding.');
        }

        Alert.alert(
            'Confirm Payout Request',
            `Send ₦${amount.toLocaleString()} to ${accountName} (${bankName})?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm Payout',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { error: insErr } = await supabase.from('driver_payouts').insert([{
                                driver_id: driverProfile.id,
                                amount: amount,
                                bank_name: bankName,
                                account_number: accountNo,
                                account_name: accountName,
                                status: 'pending'
                            }]);

                            if (insErr) {
                                console.log('driver_payouts error:', insErr.message);
                            }

                            // Deduct wallet balance
                            await supabase.rpc('deduct_wallet_balance', {
                                p_user_id: user.id,
                                p_amount: amount
                            });

                            Alert.alert('Payout Submitted', 'Your withdrawal request has been received and will be processed to your account.');
                            setWithdrawModalVisible(false);
                            setWithdrawAmount('');
                            setAccountNo('');
                            setAccountName('');
                            fetchDriverProfile();
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

    // ─────────────────────────────────────────────────────────────
    // RENDER ORDER ITEM (MODERN HIGH-END CARD)
    // ─────────────────────────────────────────────────────────────
    const renderOrderItem = ({ item }) => {
        const address = parseAddress(item.shipping_address);
        const isPool = activeTab === 'pool';
        const isHistory = activeTab === 'history';
        const isPod = (item.payment_method || '').toLowerCase() === 'pod';
        const deliveryFee = Number(item.delivery_fee) || 800;
        const totalAmount = Number(item.total_amount) || 0;
        const itemCount = Array.isArray(item.items) ? item.items.length : 1;
        const firstItem = Array.isArray(item.items) && item.items[0] ? item.items[0] : null;
        const prodName = firstItem?.product?.name || firstItem?.name || 'Package Consignment';
        const prodImg = firstItem?.product?.images?.[0] || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=300&auto=format&fit=crop';

        return (
            <View style={[styles.modernCard, isHistory && { opacity: 0.82 }]}>
                {/* Header Row */}
                <View style={styles.cardHeaderRow}>
                    <View style={styles.orderIdPill}>
                        <Ionicons name="cube-outline" size={13} color={GOLD} />
                        <Text style={styles.orderIdText}>ORD-{(item.id || '').slice(0, 6).toUpperCase()}</Text>
                    </View>

                    <View style={styles.feeBadge}>
                        <Ionicons name="cash-outline" size={12} color={SUCCESS} />
                        <Text style={styles.feeBadgeText}>+₦{deliveryFee.toLocaleString()} Fee</Text>
                    </View>

                    <View style={[styles.statusBadge, isPool ? styles.statusBadgePool : isHistory ? styles.statusBadgeHistory : styles.statusBadgeActive]}>
                        <Text style={styles.statusBadgeText}>
                            {isPool ? 'WAITING PICKUP' : isHistory ? item.status.toUpperCase() : 'IN TRANSIT'}
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
                    <Image source={{ uri: prodImg }} style={styles.packageThumbnail} />
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text style={styles.packageTitle} numberOfLines={1}>{prodName}</Text>
                        <Text style={styles.packageMeta}>
                            {itemCount > 1 ? `${itemCount} items in shipment` : '1 package consignment'} • Value: ₦{totalAmount.toLocaleString()}
                        </Text>
                        <Text style={styles.customerName} numberOfLines={1}>
                            👤 {item.user?.full_name || 'Marketplace Buyer'}
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
                            onPress={() => handleCall(item.user?.phone)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="call" size={14} color="#FFFFFF" />
                            <Text style={styles.contactBtnCallText}>Call Recipient</Text>
                        </TouchableOpacity>

                        {item.user?.phone ? (
                            <TouchableOpacity
                                style={styles.contactBtnWhatsapp}
                                onPress={() => {
                                    setWhatsappPhone(item.user.phone);
                                    setWhatsappUserId(item.user_id);
                                    setWhatsappRecipientName(item.user?.full_name || 'Customer');
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
                            onPress={() => markDelivered(item.id, item.user?.phone, item.user_id, totalAmount, isPod)}
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
            {/* ─── 1. EXECUTIVE LUXURY HEADER ──────────────────────── */}
            <LinearGradient
                colors={['#070D1B', '#0E1A2E', '#16233B']}
                style={styles.headerGradient}
            >
                {/* Top Row: Avatar, Identity, Coin Chip, Actions */}
                <View style={styles.headerTopRow}>
                    <View style={styles.driverIdentityBox}>
                        <View style={styles.avatarWrap}>
                            <Image
                                source={{ uri: user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop' }}
                                style={styles.avatarImg}
                            />
                            <View style={styles.avatarOnlineDot} />
                        </View>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.driverName} numberOfLines={1}>{user?.full_name || 'Courier Partner'}</Text>
                                <View style={[styles.levelTag, { backgroundColor: stats.level === 'Elite' ? '#FEF3C7' : 'rgba(217, 167, 58, 0.2)' }]}>
                                    <Text style={[styles.levelTagText, { color: stats.level === 'Elite' ? '#B45309' : GOLD }]}>{stats.level.toUpperCase()}</Text>
                                </View>
                            </View>
                            <Text style={styles.driverSubRole}>Abu Mafhal Pro Logistics • Verified Courier</Text>
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
                                {driverProfile?.vehicle_type || 'Vehicle'} • {driverProfile?.plate_number || 'Registered Courier'}
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

                {/* Metrics Stats 4-Card Carousel */}
                <View style={styles.metricsGrid}>
                    {/* Wallet Earnings */}
                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('wallet')} activeOpacity={0.85}>
                        <View style={styles.metricIconWrap}>
                            <Ionicons name="wallet-outline" size={16} color={GOLD} />
                        </View>
                        <Text style={styles.metricValue}>₦{(wallet?.balance || 0).toLocaleString()}</Text>
                        <Text style={styles.metricLabel}>Wallet Balance</Text>
                    </TouchableOpacity>

                    {/* Active Jobs */}
                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('active')} activeOpacity={0.85}>
                        <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                            <Ionicons name="bicycle" size={16} color={SUCCESS} />
                        </View>
                        <Text style={[styles.metricValue, { color: SUCCESS }]}>{orders.length}</Text>
                        <Text style={styles.metricLabel}>Active Tasks</Text>
                    </TouchableOpacity>

                    {/* Pool Jobs */}
                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('pool')} activeOpacity={0.85}>
                        <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                            <Ionicons name="flash-outline" size={16} color={AMBER} />
                        </View>
                        <Text style={[styles.metricValue, { color: AMBER }]}>{poolOrders.length}</Text>
                        <Text style={styles.metricLabel}>Available Pool</Text>
                    </TouchableOpacity>

                    {/* Completed */}
                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('history')} activeOpacity={0.85}>
                        <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                            <Ionicons name="checkmark-done" size={16} color="#38BDF8" />
                        </View>
                        <Text style={[styles.metricValue, { color: '#38BDF8' }]}>{stats.completedDeliveries}</Text>
                        <Text style={styles.metricLabel}>Completed</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* ─── 2. MODERN SEGMENTED TAB SELECTOR ───────────────── */}
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

            {/* ─── 3. MAIN TAB CONTENT AREA ───────────────────────── */}
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
                            <Text style={styles.sectionTitle}>Ready for Pickup Across Gashua & Region</Text>
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
                                    <Text style={styles.walletHeaderBalance}>₦{(wallet?.balance || 0).toLocaleString()}</Text>
                                </View>
                                <View style={styles.walletAmcChip}>
                                    <Ionicons name="sparkles" size={13} color={GOLD} />
                                    <Text style={styles.walletAmcChipText}>{driverProfile?.mafhal_coins || 0} AMC</Text>
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
                                    <Text style={styles.payoutHistorySecBtnText}>Payout Log ({withdrawals.length})</Text>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>

                        {/* Weekly Earnings Chart */}
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
                                                    colors={d.amount > 0 ? ['#D9A73A', '#B45309'] : ['#334155', '#1E293B']}
                                                    style={{ flex: 1, borderRadius: 6 }}
                                                />
                                            </View>
                                            <Text style={styles.chartColDay}>{d.day.charAt(0)}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Recent Completed Deliveries Table */}
                        {stats.dailyList?.length > 0 && (
                            <View style={styles.dailyEarningsBox}>
                                <Text style={styles.cardHeaderTitle}>Daily Delivery Ledger</Text>
                                {stats.dailyList.map((item, idx) => (
                                    <View key={idx} style={styles.dailyLedgerRow}>
                                        <Text style={styles.dailyLedgerDate}>{item.date}</Text>
                                        <Text style={styles.dailyLedgerCount}>{item.count} deliveries completed</Text>
                                        <Text style={styles.dailyLedgerAmount}>+₦{item.amount.toLocaleString()}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* TAB 4: COMPLETED HISTORY */}
                {activeTab === 'history' && (
                    <View style={styles.tabContentSection}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Completed Deliveries Record</Text>
                            <Text style={styles.sectionCountText}>{historyOrders.length} Done</Text>
                        </View>

                        {historyOrders.length === 0 ? (
                            <View style={styles.emptyCardBox}>
                                <Ionicons name="time-outline" size={48} color="#64748B" />
                                <Text style={styles.emptyTitle}>No Past Deliveries</Text>
                                <Text style={styles.emptySubtitle}>Completed and delivered items will show up here with receipts.</Text>
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

                {/* TAB 5: PROFILE & VEHICLE & PERKS */}
                {activeTab === 'profile' && (
                    <View style={styles.tabContentSection}>
                        {/* Daily Check-in Streak Card */}
                        <View style={styles.checkinLuxuryCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.checkinTitle}>Daily Courier Streak</Text>
                                    <Text style={styles.checkinSub}>
                                        {checkInData.checkedInToday ? 'Streak active! Return tomorrow for extra AMC.' : 'Check in daily to earn Abu Mafhal Coins (AMC).'}
                                    </Text>
                                </View>
                                <View style={styles.flameStreakBadge}>
                                    <Ionicons name="flame" size={14} color="#EF4444" />
                                    <Text style={styles.flameStreakText}>{checkInData.streak} Days</Text>
                                </View>
                            </View>

                            <View style={styles.streakDotsRow}>
                                {[1, 2, 3, 4, 5, 6, 7].map(day => (
                                    <View
                                        key={day}
                                        style={[styles.streakDotBox, checkInData.streak >= day ? styles.streakDotBoxActive : {}]}
                                    >
                                        {checkInData.streak >= day ? (
                                            <Ionicons name="checkmark" size={13} color="#070D1B" />
                                        ) : (
                                            <Text style={styles.streakDotNum}>{day}</Text>
                                        )}
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.checkinActionBtn, (checkInData.checkedInToday || checkInData.checkingIn) && styles.checkinActionBtnDisabled]}
                                onPress={handleCheckIn}
                                disabled={checkInData.checkedInToday || checkInData.checkingIn}
                                activeOpacity={0.85}
                            >
                                {checkInData.checkingIn ? (
                                    <ActivityIndicator color="#070D1B" size="small" />
                                ) : checkInData.checkedInToday ? (
                                    <Text style={styles.checkinActionBtnText}>Checked In For Today ✅</Text>
                                ) : (
                                    <Text style={styles.checkinActionBtnText}>
                                        Claim Daily Streak (+{CHECKIN_REWARDS[Math.min(checkInData.streak + 1, 10)]} AMC Coins)
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Vehicle Information Details Card */}
                        <View style={styles.vehicleDetailsCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={styles.cardHeaderTitle}>Vehicle & Registration</Text>
                                <TouchableOpacity onPress={() => setVehicleModalVisible(true)} style={styles.editPillBtn}>
                                    <Ionicons name="create-outline" size={14} color={GOLD} />
                                    <Text style={styles.editPillBtnText}>Edit</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.vehicleInfoItem}>
                                <Ionicons name="car-sport-outline" size={18} color="#94A3B8" />
                                <View style={{ marginLeft: 12 }}>
                                    <Text style={styles.vehicleInfoLabel}>Vehicle Type</Text>
                                    <Text style={styles.vehicleInfoValue}>{driverProfile?.vehicle_type || 'Motorcycle'}</Text>
                                </View>
                            </View>

                            <View style={styles.vehicleInfoItem}>
                                <Ionicons name="barcode-outline" size={18} color="#94A3B8" />
                                <View style={{ marginLeft: 12 }}>
                                    <Text style={styles.vehicleInfoLabel}>Plate Number / Tag</Text>
                                    <Text style={styles.vehicleInfoValue}>{driverProfile?.plate_number || 'YBE-123-AA (Set in profile)'}</Text>
                                </View>
                            </View>

                            <View style={styles.vehicleInfoItem}>
                                <Ionicons name="color-palette-outline" size={18} color="#94A3B8" />
                                <View style={{ marginLeft: 12 }}>
                                    <Text style={styles.vehicleInfoLabel}>Vehicle Color</Text>
                                    <Text style={styles.vehicleInfoValue}>{driverProfile?.vehicle_color || 'Black / Blue'}</Text>
                                </View>
                            </View>

                            <View style={styles.vehicleInfoItem}>
                                <Ionicons name="card-outline" size={18} color="#94A3B8" />
                                <View style={{ marginLeft: 12 }}>
                                    <Text style={styles.vehicleInfoLabel}>Driver License Number</Text>
                                    <Text style={styles.vehicleInfoValue}>{driverProfile?.driver_license || 'DRL-890-XXX'}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Emergency Logistics Support */}
                        <View style={styles.supportCard}>
                            <Text style={styles.cardHeaderTitle}>Dispatcher Support & Hotline</Text>
                            <TouchableOpacity
                                style={styles.supportRowBtn}
                                onPress={() => Linking.openURL('tel:08145853539')}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="call-outline" size={18} color={SUCCESS} />
                                <Text style={styles.supportRowBtnText}>Emergency Dispatch Hotline (08145853539)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.supportRowBtn}
                                onPress={() => {
                                    setWhatsappPhone('2348145853539');
                                    setWhatsappRecipientName('Abu Mafhal Dispatch Team');
                                    setWhatsappVisible(true);
                                }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="chatbubbles-outline" size={18} color={GOLD} />
                                <Text style={styles.supportRowBtnText}>Chat with Head Dispatcher on WhatsApp</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* ─── 4. MODALS & OVERLAYS ────────────────────────────── */}

            {/* ORDER DETAILS MODAL */}
            <Modal visible={!!selectedOrder} animationType="slide" transparent>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalContainerDark}>
                        <View style={styles.modalHeaderRow}>
                            <View>
                                <Text style={styles.modalHeaderTitle}>Delivery Invoice</Text>
                                <Text style={styles.modalHeaderSub}>ORD-{(selectedOrder?.id || '').slice(0, 8).toUpperCase()}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                            {/* Financial Summary */}
                            <View style={styles.detailBox}>
                                <Text style={styles.detailBoxLabel}>DELIVERY FEE EARNED</Text>
                                <Text style={styles.detailBoxFee}>₦{(selectedOrder?.delivery_fee || 800).toLocaleString()}</Text>
                                <Text style={styles.detailBoxStatus}>Status: {(selectedOrder?.status || 'delivered').toUpperCase()}</Text>
                            </View>

                            {/* Destination */}
                            <View style={styles.detailBox}>
                                <Text style={styles.detailBoxLabel}>DELIVERY DESTINATION</Text>
                                <Text style={styles.detailBoxText}>{parseAddress(selectedOrder?.shipping_address)}</Text>
                                <TouchableOpacity
                                    style={styles.modalMapBtn}
                                    onPress={() => handleMap(parseAddress(selectedOrder?.shipping_address))}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="navigate" size={15} color="#070D1B" />
                                    <Text style={styles.modalMapBtnText}>Open GPS Navigation</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Items list */}
                            <Text style={styles.modalSectionHeading}>Consignment Items</Text>
                            {selectedOrder?.items?.map((it, idx) => (
                                <View key={idx} style={styles.consignmentItemRow}>
                                    <Text style={styles.consignmentQty}>{it.quantity || 1}x</Text>
                                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                                        <Text style={styles.consignmentName}>{it.product?.name || it.name || 'Consignment Item'}</Text>
                                        <Text style={styles.consignmentPrice}>₦{Number(it.price || 0).toLocaleString()}</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* VEHICLE MODAL */}
            <Modal visible={isVehicleModalVisible} transparent animationType="fade">
                <View style={styles.centerOverlayDark}>
                    <View style={styles.dialogBoxDark}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalHeaderTitle}>Update Vehicle</Text>
                            <TouchableOpacity onPress={() => setVehicleModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabelDark}>Vehicle Type</Text>
                        <TextInput
                            style={styles.darkInput}
                            placeholder="e.g. Motorcycle, Tricycle (Keke), Sedan"
                            placeholderTextColor="#64748B"
                            value={vType}
                            onChangeText={setVType}
                        />

                        <Text style={styles.inputLabelDark}>Plate Number</Text>
                        <TextInput
                            style={styles.darkInput}
                            placeholder="e.g. YBE-452-AA"
                            placeholderTextColor="#64748B"
                            value={pNumber}
                            onChangeText={setPNumber}
                            autoCapitalize="characters"
                        />

                        <Text style={styles.inputLabelDark}>Vehicle Color</Text>
                        <TextInput
                            style={styles.darkInput}
                            placeholder="e.g. Red, Black, Blue"
                            placeholderTextColor="#64748B"
                            value={vColor}
                            onChangeText={setVColor}
                        />

                        <Text style={styles.inputLabelDark}>Driver License ID</Text>
                        <TextInput
                            style={styles.darkInput}
                            placeholder="e.g. DRL-980-001"
                            placeholderTextColor="#64748B"
                            value={dLicense}
                            onChangeText={setDLicense}
                            autoCapitalize="characters"
                        />

                        <TouchableOpacity style={styles.dialogSaveBtn} onPress={updateVehicleDetails} activeOpacity={0.85}>
                            <Text style={styles.dialogSaveBtnText}>Save Vehicle Information</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* WITHDRAW PAYOUT MODAL */}
            <Modal visible={isWithdrawModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentDark}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalHeaderTitle}>Request Driver Payout</Text>
                            <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                            <View style={styles.payoutBalanceNotice}>
                                <Text style={styles.payoutBalanceNoticeLabel}>Available for withdrawal</Text>
                                <Text style={styles.payoutBalanceNoticeValue}>₦{(wallet?.balance || 0).toLocaleString()}</Text>
                            </View>

                            <Text style={styles.inputLabelDark}>Amount to Withdraw (₦)</Text>
                            <TextInput
                                style={styles.darkInput}
                                placeholder="Enter amount in NGN"
                                placeholderTextColor="#64748B"
                                keyboardType="numeric"
                                value={withdrawAmount}
                                onChangeText={setWithdrawAmount}
                            />

                            <Text style={styles.inputLabelDark}>Bank Name</Text>
                            <TouchableOpacity
                                style={styles.bankSelectTrigger}
                                onPress={() => setShowBankDropdown(true)}
                                activeOpacity={0.7}
                            >
                                <Text style={{ color: bankName ? '#FFFFFF' : '#64748B', fontWeight: '600' }}>
                                    {bankName || 'Select bank'}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={GOLD} />
                            </TouchableOpacity>

                            <Text style={styles.inputLabelDark}>Account Number (10 Digits)</Text>
                            <TextInput
                                style={styles.darkInput}
                                placeholder="10-digit NUBAN account number"
                                placeholderTextColor="#64748B"
                                keyboardType="numeric"
                                maxLength={10}
                                value={accountNo}
                                onChangeText={setAccountNo}
                            />

                            <Text style={styles.inputLabelDark}>Account Name (Paystack Verified)</Text>
                            <View style={[styles.darkInput, { flexDirection: 'row', alignItems: 'center' }]}>
                                {resolvingAccount ? (
                                    <ActivityIndicator size="small" color={GOLD} style={{ marginRight: 10 }} />
                                ) : null}
                                <TextInput
                                    style={{ flex: 1, color: '#FFFFFF', fontWeight: '700' }}
                                    placeholder={accountNo.length === 10 && !resolvingAccount ? 'Account name not resolved' : 'Auto verified from account number'}
                                    placeholderTextColor="#64748B"
                                    value={accountName}
                                    editable={false}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.payoutSubmitBtn, (!accountName || !withdrawAmount) && { opacity: 0.5 }]}
                                onPress={requestWithdrawal}
                                disabled={!accountName || !withdrawAmount || loading}
                                activeOpacity={0.85}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#070D1B" />
                                ) : (
                                    <Text style={styles.payoutSubmitBtnText}>Transfer to Bank Account 🚀</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* BANK SELECTION MODAL */}
            <Modal visible={showBankDropdown} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContentDark, { height: '80%' }]}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalHeaderTitle}>Select Bank</Text>
                            <TouchableOpacity onPress={() => setShowBankDropdown(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.bankSearchWrap}>
                            <Ionicons name="search" size={16} color="#64748B" />
                            <TextInput
                                style={styles.bankSearchInput}
                                placeholder="Search bank..."
                                placeholderTextColor="#64748B"
                                value={searchBankQuery}
                                onChangeText={handleSearchBank}
                            />
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {filteredBanks.map((bank, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.bankSelectRow}
                                    onPress={() => {
                                        setBankName(bank.name);
                                        setBankCode(bank.code);
                                        setShowBankDropdown(false);
                                        setSearchBankQuery('');
                                    }}
                                >
                                    <Text style={styles.bankSelectRowText}>{bank.name}</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#64748B" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* WITHDRAWAL HISTORY FULL MODAL */}
            <Modal visible={isHistoryModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContentDark, { height: '85%' }]}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalHeaderTitle}>Payout Log</Text>
                            <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {withdrawals.length === 0 ? (
                                <View style={{ alignItems: 'center', marginTop: 40 }}>
                                    <Ionicons name="wallet-outline" size={40} color="#64748B" />
                                    <Text style={{ color: '#94A3B8', marginTop: 10, fontWeight: '700' }}>No payout requests recorded</Text>
                                </View>
                            ) : (
                                withdrawals.map((w, idx) => (
                                    <View key={idx} style={styles.payoutLogRow}>
                                        <View>
                                            <Text style={styles.payoutLogAmount}>₦{Number(w.amount || 0).toLocaleString()}</Text>
                                            <Text style={styles.payoutLogMeta}>{w.bank_name} • {w.account_number}</Text>
                                        </View>
                                        <View style={[styles.payoutStatusPill, w.status === 'completed' || w.status === 'paid' ? { backgroundColor: 'rgba(16, 185, 129, 0.2)' } : { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: w.status === 'completed' || w.status === 'paid' ? SUCCESS : AMBER }}>
                                                {(w.status || 'pending').toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ANIMATED COINS OVERLAY */}
            {animatingCoins > 0 && (
                <View style={styles.floatingCoinOverlay}>
                    <View style={styles.floatingCoinBox}>
                        <Ionicons name="sparkles" size={32} color={GOLD} />
                        <Text style={styles.floatingCoinText}>+{animatingCoins} AMC Coins!</Text>
                        <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>Streak Reward Credited</Text>
                    </View>
                </View>
            )}

            {/* WHATSAPP ACTION MODAL */}
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

// ─────────────────────────────────────────────────────────────
// MODERN STYLESHEET (MATCHING VENDORDASHBOARD QUALITY)
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: NAVY,
    },
    headerGradient: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_SUBTLE,
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
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: GOLD,
    },
    avatarOnlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: SUCCESS,
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
        fontSize: 10,
        fontWeight: '900',
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
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusToggleBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
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
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    statusVehicleSubtitle: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 1,
    },
    metricsGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    metricCard: {
        flex: 1,
        backgroundColor: 'rgba(19, 32, 56, 0.85)',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
        alignItems: 'center',
    },
    metricIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    metricValue: {
        fontSize: 13,
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
        borderBottomWidth: 1,
        borderBottomColor: BORDER_SUBTLE,
        paddingVertical: 8,
    },
    tabScrollContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    modernTabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    modernTabPillActive: {
        backgroundColor: GOLD,
        borderColor: GOLD,
    },
    modernTabPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
    },
    modernTabPillTextActive: {
        color: '#070D1B',
        fontWeight: '900',
    },
    mainScrollContent: {
        padding: 16,
        paddingBottom: 60,
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
        fontWeight: '800',
        color: '#FFFFFF',
    },
    sectionCountText: {
        fontSize: 12,
        color: GOLD,
        fontWeight: '800',
    },
    modernCard: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    orderIdPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    orderIdText: {
        fontSize: 12,
        fontWeight: '900',
        color: GOLD,
    },
    feeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    feeBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: SUCCESS,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
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
        fontSize: 10,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    podAlertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FEF3C7',
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
    },
    podAlertTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#B45309',
    },
    podAlertDesc: {
        fontSize: 11,
        color: '#92400E',
        marginTop: 1,
    },
    prepaidBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
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
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        padding: 10,
        borderRadius: 12,
        marginBottom: 12,
    },
    packageThumbnail: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#070D1B',
    },
    packageTitle: {
        fontSize: 14,
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
        color: GOLD,
        fontWeight: '700',
        marginTop: 3,
    },
    routeCard: {
        backgroundColor: 'rgba(7, 13, 27, 0.6)',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 12,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    routeLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.5,
    },
    routeAddress: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        marginTop: 2,
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
        backgroundColor: '#059669',
        paddingVertical: 10,
        borderRadius: 10,
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
    actionBtnClaim: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    actionBtnDeliver: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    actionBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
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
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        paddingVertical: 11,
        borderRadius: 10,
    },
    actionBtnDetailsText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
    },
    emptyCardBox: {
        alignItems: 'center',
        paddingVertical: 50,
        backgroundColor: CARD_BG,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
        paddingHorizontal: 20,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
        marginTop: 14,
    },
    emptySubtitle: {
        fontSize: 12,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
    },
    emptyActionBtn: {
        marginTop: 16,
        backgroundColor: GOLD,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
    },
    emptyActionBtnText: {
        color: '#070D1B',
        fontWeight: '900',
        fontSize: 12,
    },
    luxuryWalletBanner: {
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: BORDER_GOLD,
        marginBottom: 16,
    },
    walletHeaderLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5,
    },
    walletHeaderBalance: {
        fontSize: 30,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 4,
    },
    walletAmcChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: BORDER_GOLD,
    },
    walletAmcChipText: {
        color: GOLD,
        fontWeight: '800',
        fontSize: 12,
    },
    walletActionsBar: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    cashOutPrimaryBtn: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: GOLD,
        paddingVertical: 13,
        borderRadius: 12,
    },
    cashOutPrimaryBtnText: {
        color: '#070D1B',
        fontWeight: '900',
        fontSize: 13,
    },
    payoutHistorySecBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingVertical: 13,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    payoutHistorySecBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 12,
    },
    analyticsCard: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
        marginBottom: 16,
    },
    cardHeaderTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    cardHeaderSubValue: {
        fontSize: 12,
        fontWeight: '700',
        color: GOLD,
    },
    weeklyChartRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 110,
        paddingTop: 10,
    },
    chartCol: {
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    chartBarBackground: {
        width: 22,
        borderRadius: 6,
        overflow: 'hidden',
    },
    chartColDay: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
    },
    dailyEarningsBox: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    dailyLedgerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    },
    dailyLedgerDate: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
        flex: 1,
    },
    dailyLedgerCount: {
        fontSize: 11,
        color: '#94A3B8',
        marginHorizontal: 8,
    },
    dailyLedgerAmount: {
        fontSize: 13,
        fontWeight: '900',
        color: SUCCESS,
    },
    checkinLuxuryCard: {
        backgroundColor: CARD_BG,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: BORDER_GOLD,
        marginBottom: 16,
    },
    checkinTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    checkinSub: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 4,
        lineHeight: 16,
    },
    flameStreakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    flameStreakText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#EF4444',
    },
    streakDotsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 16,
        backgroundColor: 'rgba(7, 13, 27, 0.6)',
        padding: 12,
        borderRadius: 12,
    },
    streakDotBox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    streakDotBoxActive: {
        backgroundColor: GOLD,
    },
    streakDotNum: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '800',
    },
    checkinActionBtn: {
        backgroundColor: GOLD,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
    },
    checkinActionBtnDisabled: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    checkinActionBtnText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#070D1B',
    },
    vehicleDetailsCard: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
        marginBottom: 16,
    },
    editPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    editPillBtnText: {
        color: GOLD,
        fontWeight: '800',
        fontSize: 12,
    },
    vehicleInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    vehicleInfoLabel: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
    },
    vehicleInfoValue: {
        fontSize: 13.5,
        color: '#FFFFFF',
        fontWeight: '700',
        marginTop: 2,
    },
    supportCard: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    supportRowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    supportRowBtnText: {
        fontSize: 13,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    modalContainerDark: {
        backgroundColor: DARK_SURFACE,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '85%',
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_SUBTLE,
    },
    modalHeaderTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    modalHeaderSub: {
        fontSize: 12,
        color: GOLD,
        fontWeight: '700',
        marginTop: 2,
    },
    modalCloseCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailBox: {
        backgroundColor: CARD_BG,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
        marginBottom: 12,
    },
    detailBoxLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.5,
    },
    detailBoxFee: {
        fontSize: 22,
        fontWeight: '900',
        color: SUCCESS,
        marginTop: 3,
    },
    detailBoxStatus: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
        fontWeight: '600',
    },
    detailBoxText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
        marginTop: 4,
        lineHeight: 18,
    },
    modalMapBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: GOLD,
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 10,
    },
    modalMapBtnText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#070D1B',
    },
    modalSectionHeading: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
        marginTop: 8,
        marginBottom: 10,
    },
    consignmentItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    consignmentQty: {
        fontSize: 13,
        fontWeight: '900',
        color: GOLD,
    },
    consignmentName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    consignmentPrice: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    centerOverlayDark: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        padding: 20,
    },
    dialogBoxDark: {
        backgroundColor: DARK_SURFACE,
        borderRadius: 22,
        padding: 20,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    inputLabelDark: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94A3B8',
        marginTop: 12,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    darkInput: {
        backgroundColor: CARD_BG,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 13.5,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    dialogSaveBtn: {
        backgroundColor: GOLD,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    dialogSaveBtnText: {
        color: '#070D1B',
        fontWeight: '900',
        fontSize: 13.5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    modalContentDark: {
        backgroundColor: DARK_SURFACE,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    payoutBalanceNotice: {
        backgroundColor: CARD_BG,
        borderRadius: 12,
        padding: 14,
        marginTop: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: BORDER_GOLD,
    },
    payoutBalanceNoticeLabel: {
        fontSize: 11,
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
    payoutSubmitBtn: {
        backgroundColor: GOLD,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 22,
    },
    payoutSubmitBtnText: {
        color: '#070D1B',
        fontSize: 14,
        fontWeight: '900',
    },
    bankSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 12,
        paddingHorizontal: 12,
        marginVertical: 12,
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
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    payoutLogMeta: {
        fontSize: 11.5,
        color: '#94A3B8',
        marginTop: 2,
    },
    payoutStatusPill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    floatingCoinOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
    },
    floatingCoinBox: {
        backgroundColor: DARK_SURFACE,
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: GOLD,
    },
    floatingCoinText: {
        fontSize: 22,
        fontWeight: '900',
        color: GOLD,
        marginTop: 10,
    },
});
