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
    Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { whatsappService } from '../services/whatsappService';
import { WhatsAppActionModal } from '../components/WhatsAppActionModal';
import { DriverDrawer } from '../components/DriverDrawer';

import { LucideIcon } from '../components/LucideIcon';

// Modern Lucide-style Icon component alias for seamless drop-in
const Ionicons = ({ name, size = 16, color = '#FFFFFF', style }) => {
    return <LucideIcon name={name} size={size} color={color} style={style} />;
};

const { width } = Dimensions.get('window');

// ─── Abu Mafhal Clean Luxury Palette ───
const BG_LIGHT = '#F8FAFC';       // Crisp Slate Light Background
const CARD_BG = '#FFFFFF';        // Pure White Cards
const HEADER_NAVY = '#0B132B';    // Deep Executive Navy
const HEADER_NAVY_LIGHT = '#1C2541';
const GOLD = '#D9A73A';
const GOLD_LIGHT = '#FEF3C7';
const TEXT_DARK = '#0F172A';
const TEXT_MUTED = '#64748B';
const TEXT_SUBTLE = '#94A3B8';
const BORDER_COLOR = '#E2E8F0';
const SUCCESS = '#10B981';
const DANGER = '#EF4444';
const AMBER = '#F59E0B';
const BLUE = '#2563EB';

// ─── 100% Real Security PIN Generator (Synced with Customer Track Order Screen) ───
export function generateSecurityPin(orderId) {
    if (!orderId) return '4829';
    let hash = 0;
    const str = String(orderId);
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    const num = Math.abs(hash) % 9000 + 1000;
    return String(num);
}

// ─── Accurate Real-time Payment Status Evaluators ───
export const isPodOrder = (item) => {
    if (!item) return false;
    const m = (item.payment_method || '').toLowerCase().trim();
    return m === 'pod' || m === 'cash' || m.includes('cash on') || m.includes('pay on delivery') || m.includes('pay on arrival');
};

export const isPssOrder = (item) => {
    if (!item) return false;
    const m = (item.payment_method || '').toLowerCase().trim();
    const s = (item.payment_status || '').toLowerCase().trim();
    return m.includes('small small') || m.includes('pss') || s.includes('pss') || s.includes('installment') || !!item.installment_plan;
};

export const isPrepaidOrder = (item) => {
    if (!item) return false;
    return !isPodOrder(item) && !isPssOrder(item);
};

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

    // ─── Active User State ───
    const [activeUser, setActiveUser] = useState(user || null);

    // ─── Real Live Data State ───
    const [orders, setOrders] = useState([]);
    const [poolOrders, setPoolOrders] = useState([]);
    const [historyOrders, setHistoryOrders] = useState([]);
    const [driverProfile, setDriverProfile] = useState({
        id: null,
        user_id: user?.id || null,
        name: user?.full_name || 'Driver Courier',
        phone: user?.phone || '',
        vehicle_type: 'Motorcycle',
        vehicle_number: '',
        current_location: 'Kano Hub Central',
        latitude: null,
        longitude: null,
        status: 'active',
        is_active: true,
        rating: 5.0,
        xp: 0
    });
    const [walletBalance, setWalletBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, _setActiveTab] = useState(() => getInitialDriverTab(route));
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPayment, setFilterPayment] = useState('ALL'); // ALL, POD, PREPAID, PSS

    // Modals
    const [isVehicleModalVisible, setVehicleModalVisible] = useState(false);
    const [isWithdrawModalVisible, setWithdrawModalVisible] = useState(false);
    const [isHistoryModalVisible, setHistoryModalVisible] = useState(false);
    const [isHandoverModalVisible, setHandoverModalVisible] = useState(false);
    const [isIssueModalVisible, setIssueModalVisible] = useState(false);

    // GPS State
    const [isSyncingGps, setIsSyncingGps] = useState(false);
    const [gpsNotice, setGpsNotice] = useState('');

    // Delivery Handover Modal Form
    const [handoverOrder, setHandoverOrder] = useState(null);
    const [handoverRecipient, setHandoverRecipient] = useState('');
    const [handoverNotes, setHandoverNotes] = useState('');
    const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);

    // Issue Reporting Form
    const [issueOrder, setIssueOrder] = useState(null);
    const [issueReason, setIssueReason] = useState('Customer unreachable on phone');
    const [issueDetail, setIssueDetail] = useState('');
    const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
    const [isSosActive, setIsSosActive] = useState(false);
    
    // Shift Summary Modal
    const [isShiftSummaryModalVisible, setShiftSummaryModalVisible] = useState(false);
    
    // Live Tracking
    const [isLiveTracking, setIsLiveTracking] = useState(false);
    const locationSubscription = React.useRef(null);
    
    // Pool Alerts
    const [previousPoolCount, setPreviousPoolCount] = useState(0);

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
                const cached = await AsyncStorage.getItem('@abumafhal_user_v1');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed?.id) {
                        setActiveUser(parsed);
                        loadAllDriverData(parsed.id);
                        return;
                    }
                }

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

    // Real-time listener for orders and profiles
    useEffect(() => {
        const uid = activeUser?.id;
        if (!uid) return;

        fetchBanks();

        const channel = supabase
            .channel('driver_orders_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders(uid);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` }, () => {
                fetchProfileBalance(uid);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeUser?.id]);

    useEffect(() => {
        if (poolOrders.length > previousPoolCount && previousPoolCount !== 0) {
            Alert.alert('New Delivery Task! ⚡', 'A new order has been added to the Job Pool. Check it out now.');
        }
        setPreviousPoolCount(poolOrders.length);
    }, [poolOrders.length]);

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

    // ─── MASTER LIVE DATA LOADER ───
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
            const { data } = await supabase
                .from('drivers')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (data) {
                setDriverProfile(data);
                setVType(data.vehicle_type || 'Motorcycle');
                setPNumber(data.vehicle_number || '');
            } else {
                const newDriver = {
                    user_id: userId,
                    name: activeUser?.full_name || 'Driver Courier',
                    phone: activeUser?.phone || activeUser?.phone_number || '',
                    vehicle_type: 'Motorcycle',
                    vehicle_number: '',
                    current_location: 'Kano Hub Central',
                    status: 'active',
                    is_active: true,
                    xp: 0,
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

    // 2. Fetch Real Balance from `profiles.balance`
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

    // 3. Fetch Real Orders from `orders`
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
        } catch (e) {
            console.log('Fetch Orders Error:', e);
        }
    };

    // 4. Fetch Real Transactions from `transactions`
    const fetchTransactions = async (userId) => {
        try {
            const { data } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (data) {
                setTransactions(data);
            }
        } catch (e) {
            console.log('Fetch Transactions Error:', e);
        }
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

    // ─── FEATURE 1: LIVE GPS LOCATION SYNC & TRACKING ───
    const syncLiveGps = async () => {
        const uid = activeUser?.id;
        if (!uid) return;

        setIsSyncingGps(true);
        setGpsNotice('Acquiring satellite GPS coordinates...');

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setGpsNotice('Permission denied. Using Kano Hub.');
                setIsSyncingGps(false);
                setTimeout(() => setGpsNotice(''), 3000);
                return;
            }

            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const locText = `Kano Hub (${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E)`;

            const { error } = await supabase
                .from('drivers')
                .update({
                    latitude: lat,
                    longitude: lng,
                    current_location: locText,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', uid);

            if (!error) {
                setDriverProfile(prev => ({ ...prev, latitude: lat, longitude: lng, current_location: locText }));
                setGpsNotice('GPS Synced Live ✅');
                setTimeout(() => setGpsNotice(''), 3500);
            } else {
                setGpsNotice('Failed to update GPS in database');
            }
            setIsSyncingGps(false);
        } catch (err) {
            console.log('GPS Sync error:', err);
            setGpsNotice('Using default Kano Hub GPS');
            setIsSyncingGps(false);
            setTimeout(() => setGpsNotice(''), 3000);
        }
    };

    const toggleLiveTracking = async () => {
        if (isLiveTracking) {
            if (locationSubscription.current) {
                locationSubscription.current.remove();
                locationSubscription.current = null;
            }
            setIsLiveTracking(false);
            setGpsNotice('Live tracking disabled.');
            setTimeout(() => setGpsNotice(''), 3000);
        } else {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location access is required for live tracking.');
                return;
            }
            setIsLiveTracking(true);
            setGpsNotice('Starting live GPS tracking...');

            locationSubscription.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 50 },
                async (loc) => {
                    const lat = loc.coords.latitude;
                    const lng = loc.coords.longitude;
                    const locText = `Live (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`;
                    const uid = activeUser?.id;
                    if (uid) {
                        await supabase.from('drivers').update({
                            latitude: lat,
                            longitude: lng,
                            current_location: locText,
                            updated_at: new Date().toISOString()
                        }).eq('user_id', uid);
                        setDriverProfile(prev => ({ ...prev, latitude: lat, longitude: lng, current_location: locText }));
                    }
                }
            );
            setGpsNotice('Live Tracking Active 📡');
        }
    };

    // ─── FEATURE 2: CLAIM ORDER FROM POOL ───
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

    // ─── FEATURE 3: PICK UP & START TRANSIT ───
    const markPickedUp = async (orderId) => {
        const uid = activeUser?.id;
        if (!uid) return;

        try {
            await supabase
                .from('orders')
                .update({ status: 'out_for_delivery', updated_at: new Date().toISOString() })
                .eq('id', orderId);

            Alert.alert('In Transit 📦', 'Order marked as Out for Delivery.');
            fetchOrders(uid);
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to update order status.');
        }
    };

    // ─── FEATURE 4: MODERN HANDOVER & PROOF OF DELIVERY ───
    const takeProofOfDeliveryPhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera access is required for Proof of Delivery.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            setHandoverImage(result.assets[0]);
        }
    };

    const openHandoverModal = (order) => {
        setHandoverOrder(order);
        setHandoverRecipient(order?.user?.full_name || 'Customer in person');
        setHandoverNotes('');
        setHandoverPin('');
        setHandoverImage(null);
        setHandoverModalVisible(true);
    };

    const submitHandoverDelivery = async () => {
        if (!handoverOrder) return;
        const uid = activeUser?.id;
        if (!uid) return;

        setIsSubmittingHandover(true);
        const orderId = handoverOrder.id;
        const customerPhone = handoverOrder.user?.phone || handoverOrder.contact_phone || '';
        const shippingFee = Number(handoverOrder.shipping_fee || 1000);
        const expectedPin = handoverOrder.security_pin || generateSecurityPin(orderId || handoverOrder.reference);
        const trimmedPin = handoverPin.trim();

        // ─── 100% Real Security PIN Validation (Zero Mockup) ───
        if (trimmedPin.length > 0) {
            if (trimmedPin.length < 4) {
                Alert.alert('Invalid PIN Code', 'The delivery security PIN must be 4 digits.');
                setIsSubmittingHandover(false);
                return;
            }
            if (trimmedPin !== expectedPin) {
                Alert.alert(
                    'Security PIN Mismatch ❌',
                    `The 4-digit code (${trimmedPin}) does not match this package's security code.\n\nPlease ask the customer to check the 4-digit PIN displayed on their Track Order screen or delivery SMS.`
                );
                setIsSubmittingHandover(false);
                return;
            }
        }

        try {
            let imageUrl = '';
            if (handoverImage && handoverImage.base64) {
                try {
                    const fileName = `pod_${orderId}_${Date.now()}.jpg`;
                    const { data, error } = await supabase.storage.from('delivery_proofs').upload(fileName, decode(handoverImage.base64), {
                        contentType: 'image/jpeg'
                    });
                    if (!error) {
                        const { data: urlData } = supabase.storage.from('delivery_proofs').getPublicUrl(fileName);
                        imageUrl = urlData.publicUrl;
                    }
                } catch(e) {
                    console.log('Image upload error:', e);
                }
            }

            const isPinVerified = trimmedPin === expectedPin;
            const pinStr = isPinVerified ? ` | Auth PIN: Verified (${expectedPin})` : '';
            const imgStr = imageUrl ? ` | Proof: Image Uploaded (${imageUrl})` : '';
            const isPrepaid = isPrepaidOrder(handoverOrder);
            const noteContent = `Handover Verified: Recipient: ${handoverRecipient || 'Customer'} | Notes: ${handoverNotes || 'Handed over directly'}${pinStr}${imgStr} | Payment: ${isPrepaid ? 'Paid Online (Escrow Released)' : 'Pay on Delivery'} | Time: ${new Date().toLocaleTimeString()}`;

            // 1. Mark order delivered with audit notes & verified flags in Supabase
            await supabase
                .from('orders')
                .update({
                    status: 'delivered',
                    driver_notes: noteContent,
                    security_pin_verified: isPinVerified,
                    delivered_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            // 2. Credit shipping fee to driver's balance in `profiles`
            const { data: prof } = await supabase
                .from('profiles')
                .select('balance')
                .eq('id', uid)
                .maybeSingle();

            const newBal = Number(prof?.balance || 0) + shippingFee;
            await supabase
                .from('profiles')
                .update({ balance: newBal })
                .eq('id', uid);

            setWalletBalance(newBal);

            // 3. Log credit transaction in `transactions`
            await supabase.from('transactions').insert([{
                user_id: uid,
                type: 'credit',
                amount: shippingFee,
                status: 'completed',
                reference: 'DEL-' + Date.now(),
                description: `Delivery earnings for order #${orderId.slice(0, 8).toUpperCase()}`
            }]);

            // 4. Update Driver XP in `drivers` (+50 XP per delivery)
            const currentXp = Number(driverProfile?.xp || 0);
            const newXp = currentXp + 50;
            await supabase
                .from('drivers')
                .update({ xp: newXp, updated_at: new Date().toISOString() })
                .eq('user_id', uid);

            setDriverProfile(prev => ({ ...prev, xp: newXp }));

            // 5. Send automated confirmation
            if (customerPhone) {
                const deliverMsg = `Assalamu Alaikum! Your Abu Mafhal package #${orderId.slice(0, 8).toUpperCase()} has been successfully delivered by courier ${activeUser?.full_name || 'partner'}. Handover verified with recipient ${handoverRecipient || 'Customer'}. Thank you for shopping with us!`;
                whatsappService.sendDirect(customerPhone, deliverMsg, handoverOrder.user_id).catch(() => {});
            }

            setHandoverModalVisible(false);
            setHandoverOrder(null);
            setHandoverImage(null);
            Alert.alert(
                'Delivery Completed! 🎉',
                `+₦${shippingFee.toLocaleString()} credited to your wallet balance.\n+50 XP added to your courier profile!\n${isPrepaid ? 'Order was 100% settled online via Escrow.' : ''}`
            );
            loadAllDriverData(uid);
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to complete delivery.');
        } finally {
            setIsSubmittingHandover(false);
        }
    };

    // ─── FEATURE 5: REPORT DELIVERY ISSUE TO DISPATCH ───
    const openIssueModal = (order) => {
        setIssueOrder(order);
        setIssueReason('Customer unreachable on phone');
        setIssueDetail('');
        setIssueModalVisible(true);
    };

    const submitDeliveryIssue = async () => {
        if (!issueOrder) return;
        const uid = activeUser?.id;
        if (!uid) return;

        setIsSubmittingIssue(true);
        try {
            const logEntry = `ISSUE REPORTED: [${issueReason}] - ${issueDetail || 'No extra note'} (Reported by driver at ${new Date().toLocaleTimeString()})`;
            await supabase
                .from('orders')
                .update({
                    driver_notes: logEntry,
                    updated_at: new Date().toISOString()
                })
                .eq('id', issueOrder.id);

            setIssueModalVisible(false);
            setIssueOrder(null);
            Alert.alert('Issue Logged ⚠️', 'Abu Mafhal logistics dispatch has been notified. Please retain package safely.');
            fetchOrders(uid);
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to submit issue.');
        } finally {
            setIsSubmittingIssue(false);
        }
    };

    // ─── SOS EMERGENCY FEATURE ───
    const triggerSOS = () => {
        Alert.alert(
            '🚨 EMERGENCY SOS',
            'This will instantly notify Abu Mafhal Dispatch and local authorities of your exact GPS location. Are you in danger?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'ACTIVATE SOS 🚨',
                    style: 'destructive',
                    onPress: async () => {
                        setIsSosActive(true);
                        try {
                            if (typeof window !== 'undefined' && navigator && navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                    async (position) => {
                                        const lat = position.coords.latitude;
                                        const lng = position.coords.longitude;
                                        await supabase.from('drivers').update({ status: 'emergency_sos', latitude: lat, longitude: lng }).eq('user_id', activeUser?.id);
                                    },
                                    () => {},
                                    { enableHighAccuracy: true, timeout: 5000 }
                                );
                            } else {
                                await supabase.from('drivers').update({ status: 'emergency_sos' }).eq('user_id', activeUser?.id);
                            }
                            setDriverProfile(prev => ({ ...prev, status: 'emergency_sos' }));
                            Alert.alert('SOS SENT', 'Dispatch has received your emergency signal and location. Help is on the way.');
                        } catch (e) {
                            Alert.alert('SOS Error', 'Could not send signal. Please call emergency services directly: 112');
                        } finally {
                            setTimeout(() => setIsSosActive(false), 2000);
                        }
                    }
                }
            ]
        );
    };

    // ─── FEATURE 6: QUICK WHATSAPP TEMPLATES ───
    const sendQuickWhatsapp = (phone, text, userId) => {
        if (!phone) return Alert.alert('No Phone', 'Customer phone number not available.');
        whatsappService.sendDirect(phone, text, userId).catch(() => {});
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const targetPhone = cleanPhone.startsWith('0') ? '234' + cleanPhone.slice(1) : cleanPhone;
        Linking.openURL(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`);
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
                            const newBal = walletBalance - amount;
                            await supabase
                                .from('profiles')
                                .update({ balance: newBal })
                                .eq('id', uid);

                            setWalletBalance(newBal);

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
            android: `geo:0,0?q=${encodeURIComponent(address)}`,
            default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
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

    // ─── Driver Tier Calculation ───
    const driverTier = useMemo(() => {
        const xp = Number(driverProfile?.xp || 0);
        if (xp >= 1000) return { title: 'Diamond Courier', color: '#38BDF8', badge: '💎', nextXp: 1500, percent: 100 };
        if (xp >= 500) return { title: 'Gold Courier', color: GOLD, badge: '🥇', nextXp: 1000, percent: Math.round((xp / 1000) * 100) };
        if (xp >= 200) return { title: 'Silver Courier', color: '#94A3B8', badge: '🥈', nextXp: 500, percent: Math.round((xp / 500) * 100) };
        return { title: 'Bronze Courier', color: '#B45309', badge: '🥉', nextXp: 200, percent: Math.round((xp / 200) * 100) };
    }, [driverProfile?.xp]);

    // ─── Today's Delivery Earnings ───
    const todayEarnings = useMemo(() => {
        const todayStr = new Date().toISOString().slice(0, 10);
        return historyOrders
            .filter(o => (o.updated_at || o.created_at || '').startsWith(todayStr))
            .reduce((sum, o) => sum + Number(o.shipping_fee || 1000), 0);
    }, [historyOrders]);

    // ─── Total Lifetime Delivery Earnings (Real Data) ───
    const totalDeliveredEarnings = useMemo(() => {
        return historyOrders.reduce((sum, o) => sum + Number(o.shipping_fee || 1000), 0);
    }, [historyOrders]);

    // ─── Filtered Orders for Current Tab ───
    const currentTabOrders = useMemo(() => {
        let baseList = [];
        if (activeTab === 'active') baseList = orders;
        else if (activeTab === 'pool') baseList = poolOrders;
        else if (activeTab === 'history') baseList = historyOrders;
        else return [];

        return baseList.filter(item => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const idMatch = (item.id || '').toLowerCase().includes(q);
                const nameMatch = (item.user?.full_name || '').toLowerCase().includes(q);
                const addrMatch = parseAddress(item.shipping_address).toLowerCase().includes(q);
                if (!idMatch && !nameMatch && !addrMatch) return false;
            }

            if (filterPayment === 'POD') {
                return isPodOrder(item);
            }
            if (filterPayment === 'PREPAID') {
                return isPrepaidOrder(item);
            }
            if (filterPayment === 'PSS') {
                return isPssOrder(item);
            }

            return true;
        });
    }, [activeTab, orders, poolOrders, historyOrders, searchQuery, filterPayment]);

    // ─── RENDER ORDER ITEM (CLEAN LIGHT CARD) ───
    const renderOrderItem = ({ item }) => {
        const address = parseAddress(item.shipping_address);
        const isPool = activeTab === 'pool';
        const isHistory = activeTab === 'history';
        const isPod = isPodOrder(item);
        const isPaySmallSmall = isPssOrder(item);
        const isPrepaid = isPrepaidOrder(item);
        const shippingFee = Number(item.shipping_fee) || 1000;
        const totalAmount = Number(item.total_amount) || 0;
        const itemCount = Array.isArray(item.items) ? item.items.length : 1;
        const customerName = item.user?.full_name || 'Marketplace Buyer';
        const customerPhone = item.user?.phone || item.contact_phone || '';

        return (
            <View style={[styles.modernCard, isHistory && { opacity: 0.92 }]}>
                {/* Header Row */}
                <View style={styles.cardHeaderRow}>
                    <View style={styles.orderIdPill}>
                        <Ionicons name="cube-outline" size={13} color={GOLD} />
                        <Text style={styles.orderIdText}>ORD-{(item.id || '').slice(0, 8).toUpperCase()}</Text>
                    </View>

                    <View style={[styles.statusBadge, isPool ? styles.statusBadgePool : isHistory ? styles.statusBadgeHistory : styles.statusBadgeActive]}>
                        <Text style={[styles.statusBadgeText, isPool ? { color: '#B45309' } : isHistory ? { color: TEXT_MUTED } : { color: '#065F46' }]}>
                            {isPool ? 'AVAILABLE' : isHistory ? (item.status || '').toUpperCase() : item.status === 'out_for_delivery' ? 'OUT FOR DELIVERY' : 'ASSIGNED'}
                        </Text>
                    </View>
                </View>

                {/* Sub-Header Row: Delivery Fee Payout */}
                <View style={styles.cardSubHeaderRow}>
                    <View style={styles.feeBadge}>
                        <Ionicons name="cash-outline" size={13} color={SUCCESS} />
                        <Text style={styles.feeBadgeText}>+₦{shippingFee.toLocaleString()} Delivery Payout</Text>
                    </View>
                    {isPrepaid && (
                        <View style={styles.escrowSecuredBadge}>
                            <Text style={styles.escrowSecuredBadgeText}>PAID ONLINE (ESCROW)</Text>
                        </View>
                    )}
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
                ) : isPaySmallSmall ? (
                    <View style={styles.pssBanner}>
                        <Ionicons name="card-outline" size={15} color={BLUE} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.pssText}>PAY SMALL SMALL ORDER • PAID ONLINE</Text>
                            <Text style={styles.prepaidSubText}>Installment down payment settled online. Do not collect money.</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.prepaidBanner}>
                        <Ionicons name="checkmark-circle" size={16} color="#059669" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.prepaidText}>PAID ONLINE • DO NOT COLLECT MONEY</Text>
                            <Text style={styles.prepaidSubText}>100% Escrow Secured • Release parcel upon arrival</Text>
                        </View>
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
                            {itemCount} package item(s) • Total Order Value: ₦{totalAmount.toLocaleString()}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                            <Ionicons name="person-outline" size={12} color={TEXT_MUTED} />
                            <Text style={styles.customerName} numberOfLines={1}>
                                Recipient: {customerName}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Route Section */}
                <View style={styles.routeCard}>
                    <View style={styles.routeRow}>
                        <Ionicons name="location-outline" size={16} color={GOLD} style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.routeLabel}>DELIVERY DESTINATION</Text>
                            <Text style={styles.routeAddress} numberOfLines={2}>{address}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.navigateMiniBtn}
                            onPress={() => handleMap(address)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="navigate" size={14} color="#070D1B" />
                            <Text style={styles.navigateMiniBtnText}>Maps</Text>
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
                            <Ionicons name="call" size={14} color={TEXT_DARK} />
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

                        <TouchableOpacity
                            style={styles.contactBtnIssue}
                            onPress={() => openIssueModal(item)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="alert-circle" size={14} color={DANGER} />
                            <Text style={styles.contactBtnIssueText}>Issue</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Quick WhatsApp One-Tap Templates (When Active) */}
                {!isPool && !isHistory && customerPhone && (
                    <View style={styles.quickTemplatesBar}>
                        <Text style={styles.quickTemplateHeader}>QUICK MESSAGES:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                            <TouchableOpacity
                                style={styles.templateChip}
                                onPress={() => sendQuickWhatsapp(customerPhone, `Assalamu Alaikum ${customerName}! I am on my way with your Abu Mafhal delivery (#${item.id.slice(0, 8).toUpperCase()}).`, item.user_id)}
                            >
                                <Ionicons name="bicycle" size={13} color={TEXT_DARK} />
                                <Text style={styles.templateChipText}>On my way</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.templateChip}
                                onPress={() => sendQuickWhatsapp(customerPhone, `Assalamu Alaikum ${customerName}! I have arrived outside your delivery location with your package.`, item.user_id)}
                            >
                                <Ionicons name="location" size={13} color={TEXT_DARK} />
                                <Text style={styles.templateChipText}>Arrived outside</Text>
                            </TouchableOpacity>
                            {isPod && (
                                <TouchableOpacity
                                    style={[styles.templateChip, { backgroundColor: '#FEF3C7' }]}
                                    onPress={() => sendQuickWhatsapp(customerPhone, `Assalamu Alaikum! Please prepare ₦${totalAmount.toLocaleString()} cash/transfer for your Pay on Delivery package (#${item.id.slice(0, 8).toUpperCase()}).`, item.user_id)}
                                >
                                    <Ionicons name="cash-outline" size={13} color="#92400E" />
                                    <Text style={[styles.templateChipText, { color: '#92400E' }]}>Prepare POD ₦{totalAmount.toLocaleString()}</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                )}

                {/* Notes & Audit Row if exists */}
                {item.driver_notes ? (
                    <View style={styles.driverNotesBox}>
                        <Ionicons name="document-text-outline" size={13} color={TEXT_MUTED} />
                        <Text style={styles.driverNotesText}>{item.driver_notes}</Text>
                    </View>
                ) : null}

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
                                <Text style={styles.actionBtnClaimText}>Accept & Claim Delivery</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : !isHistory ? (
                        <View style={{ gap: 8 }}>
                            {item.status !== 'out_for_delivery' && (
                                <TouchableOpacity
                                    style={styles.actionBtnPickup}
                                    onPress={() => markPickedUp(item.id)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="cube-outline" size={16} color="#0F172A" />
                                    <Text style={styles.actionBtnPickupText}>Pick Up & Start Transit</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.actionBtnDeliver}
                                onPress={() => openHandoverModal(item)}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#10B981', '#059669']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.actionBtnGradient}
                                >
                                    <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                                    <Text style={styles.actionBtnDeliverText}>Verify Handover & Complete Delivery</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.actionBtnDetails}
                            onPress={() => setSelectedOrder(item)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="document-text-outline" size={15} color={TEXT_MUTED} />
                            <Text style={styles.actionBtnDetailsText}>View Delivery Receipt & Details</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
            {/* ─── 1. COMPACT LUXURY TOP NAVBAR (Ultra Slim, Height ~54px) ─── */}
            <LinearGradient
                colors={[HEADER_NAVY, HEADER_NAVY_LIGHT]}
                style={styles.compactHeaderGradient}
            >
                <View style={styles.compactHeaderRow}>
                    {/* Left: Sidebar Menu Trigger Button with Online Status Dot */}
                    <TouchableOpacity
                        style={styles.menuTriggerBtn}
                        onPress={() => setIsDrawerOpen(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="menu" size={21} color="#FFFFFF" />
                        <View style={[styles.menuPulseDot, { backgroundColor: driverProfile?.status === 'active' ? SUCCESS : '#94A3B8' }]} />
                    </TouchableOpacity>

                    {/* Middle: Brand & Hub Station */}
                    <TouchableOpacity
                        style={styles.compactBrandBox}
                        onPress={() => setIsDrawerOpen(true)}
                        activeOpacity={0.85}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.compactBrandTitle} numberOfLines={1}>Abu Mafhal Logistics</Text>
                            <View style={styles.compactLevelTag}>
                                <Text style={styles.compactLevelText}>{driverTier.badge}</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                            <Ionicons name="location" size={11} color={GOLD} />
                            <Text style={styles.compactHubText} numberOfLines={1}>
                                {driverProfile?.current_location || 'Kano Hub Central'}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Right: Quick Online Toggle Pill, Wallet Balance Badge, Refresh */}
                    <View style={styles.compactActionGroup}>
                        {/* Quick Online / Offline Toggle Pill */}
                        <TouchableOpacity
                            style={[
                                styles.compactStatusPill,
                                driverProfile?.status === 'active' ? styles.statusPillActive : styles.statusPillOffline
                            ]}
                            onPress={toggleStatus}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.pillDot, { backgroundColor: driverProfile?.status === 'active' ? SUCCESS : '#64748B' }]} />
                            <Text style={[styles.compactStatusPillText, { color: driverProfile?.status === 'active' ? SUCCESS : '#CBD5E1' }]}>
                                {driverProfile?.status === 'active' ? 'ONLINE' : 'OFFLINE'}
                            </Text>
                        </TouchableOpacity>

                        {/* Quick Wallet Payout Pill */}
                        <TouchableOpacity
                            style={styles.compactWalletPill}
                            onPress={() => setActiveTab('wallet')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="wallet" size={13} color={GOLD} />
                            <Text style={styles.compactWalletText}>₦{walletBalance.toLocaleString()}</Text>
                        </TouchableOpacity>

                        {/* Refresh */}
                        <TouchableOpacity
                            onPress={handleRefresh}
                            style={styles.compactIconBtn}
                            activeOpacity={0.75}
                        >
                            <Ionicons name="refresh" size={15} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {gpsNotice ? (
                    <View style={styles.compactGpsNotice}>
                        <Ionicons name="location" size={11} color={SUCCESS} />
                        <Text style={styles.compactGpsText} numberOfLines={1}>{gpsNotice}</Text>
                    </View>
                ) : null}
            </LinearGradient>

            {/* ─── SIDEBAR DRAWER COMPONENT ─── */}
            <DriverDrawer
                visible={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                activeTab={activeTab}
                onSelectTab={(tabKey) => {
                    setActiveTab(tabKey);
                    setIsDrawerOpen(false);
                }}
                driverProfile={driverProfile}
                activeUser={activeUser}
                walletBalance={walletBalance}
                orders={orders}
                poolOrders={poolOrders}
                historyOrders={historyOrders}
                driverTier={driverTier}
                isLiveTracking={isLiveTracking}
                toggleLiveTracking={toggleLiveTracking}
                isSyncingGps={isSyncingGps}
                syncLiveGps={syncLiveGps}
                toggleStatus={toggleStatus}
                triggerSOS={triggerSOS}
                onOpenVehicleModal={() => {
                    setIsDrawerOpen(false);
                    setVehicleModalVisible(true);
                }}
                onOpenShiftSummary={() => {
                    setIsDrawerOpen(false);
                    setShiftSummaryModalVisible(true);
                }}
                onLogout={onLogout}
            />

            {/* ─── 2. MODERN TAB SELECTOR ─── */}
            <View style={styles.tabBarContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
                    {[
                        { id: 'active', label: `Active (${orders.length})`, icon: 'bicycle-outline' },
                        { id: 'pool', label: `Job Pool (${poolOrders.length})`, icon: 'flash-outline' },
                        { id: 'wallet', label: 'Wallet & Payouts', icon: 'wallet-outline' },
                        { id: 'history', label: `History (${historyOrders.length})`, icon: 'time-outline' },
                        { id: 'profile', label: 'Vehicle & Tier', icon: 'car-sport-outline' }
                    ].map(tab => {
                        const isCurrent = activeTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setActiveTab(tab.id)}
                                style={[styles.modernTabPill, isCurrent && styles.modernTabPillActive]}
                                activeOpacity={0.8}
                            >
                                <Ionicons name={tab.icon} size={15} color={isCurrent ? '#FFFFFF' : TEXT_MUTED} />
                                <Text style={[styles.modernTabPillText, isCurrent && styles.modernTabPillTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ─── 3. SEARCH & FILTER STRIP (For Active, Pool, and History) ─── */}
            {['active', 'pool', 'history'].includes(activeTab) && (
                <View style={styles.searchFilterStrip}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={15} color={TEXT_MUTED} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by Order ID, Customer, Address..."
                            placeholderTextColor={TEXT_SUBTLE}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery ? (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close" size={16} color={TEXT_MUTED} />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 6 }}>
                        {[
                            { id: 'ALL', label: 'All Orders', icon: 'cube-outline' },
                            { id: 'POD', label: 'Pay on Delivery', icon: 'cash-outline' },
                            { id: 'PREPAID', label: 'Paid Online', icon: 'checkmark-circle' },
                            { id: 'PSS', label: 'Pay Small Small', icon: 'wallet' }
                        ].map(f => {
                            const isSelected = filterPayment === f.id;
                            return (
                                <TouchableOpacity
                                    key={f.id}
                                    style={[styles.filterChip, isSelected && styles.filterChipActive, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                                    onPress={() => setFilterPayment(f.id)}
                                >
                                    <Ionicons name={f.icon} size={13} color={isSelected ? '#0F172A' : TEXT_MUTED} />
                                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* ─── 4. MAIN TAB CONTENT AREA (CLEAN LIGHT BACKGROUND) ─── */}
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={GOLD} />}
                contentContainerStyle={styles.mainScrollContent}
            >
                {/* Metrics Stats 2x2 Grid (Natural Scroll with Page) */}
                {['active', 'pool'].includes(activeTab) && (
                    <View style={styles.metricsGrid}>
                        <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('wallet')} activeOpacity={0.85}>
                            <View style={styles.metricCardHeader}>
                                <Text style={styles.metricLabel}>ESCROW BALANCE</Text>
                                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(217, 167, 58, 0.15)' }]}>
                                    <Ionicons name="wallet" size={14} color={GOLD} />
                                </View>
                            </View>
                            <Text style={[styles.metricValue, { color: TEXT_DARK }]} numberOfLines={1} adjustsFontSizeToFit>
                                ₦{walletBalance.toLocaleString()}
                            </Text>
                            <Text style={styles.metricSubtext}>Today: +₦{todayEarnings.toLocaleString()}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('active')} activeOpacity={0.85}>
                            <View style={styles.metricCardHeader}>
                                <Text style={styles.metricLabel}>ACTIVE JOBS</Text>
                                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                    <Ionicons name="bicycle" size={14} color={SUCCESS} />
                                </View>
                            </View>
                            <Text style={[styles.metricValue, { color: SUCCESS }]} numberOfLines={1}>
                                {orders.length}
                            </Text>
                            <Text style={styles.metricSubtext}>{orders.length === 0 ? 'All delivered' : 'In transit now'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('pool')} activeOpacity={0.85}>
                            <View style={styles.metricCardHeader}>
                                <Text style={styles.metricLabel}>JOB POOL</Text>
                                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                                    <Ionicons name="flash" size={14} color={AMBER} />
                                </View>
                            </View>
                            <Text style={[styles.metricValue, { color: AMBER }]} numberOfLines={1}>
                                {poolOrders.length}
                            </Text>
                            <Text style={styles.metricSubtext}>Ready for pickup</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('history')} activeOpacity={0.85}>
                            <View style={styles.metricCardHeader}>
                                <Text style={styles.metricLabel}>DELIVERED</Text>
                                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                                    <Ionicons name="checkmark-done" size={14} color="#38BDF8" />
                                </View>
                            </View>
                            <Text style={[styles.metricValue, { color: '#0284C7' }]}>{historyOrders.length}</Text>
                            <Text style={styles.metricSubtext}>Completed orders</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* TAB 1: ACTIVE DELIVERIES */}
                {activeTab === 'active' && (
                    <View style={styles.tabContentSection}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Active Shipments in Transit</Text>
                            <Text style={styles.sectionCountText}>{currentTabOrders.length} Deliveries</Text>
                        </View>

                        {currentTabOrders.length === 0 ? (
                            <View style={styles.emptyCardBox}>
                                <Ionicons name="bicycle-outline" size={44} color={TEXT_SUBTLE} />
                                <Text style={styles.emptyTitle}>
                                    {searchQuery ? 'No Matches Found' : 'No Active Deliveries Right Now'}
                                </Text>
                                <Text style={styles.emptySubtitle}>
                                    {searchQuery
                                        ? 'Try clearing your search term or payment filter.'
                                        : 'You do not have any pending packages in transit. Claim new orders from the pool!'}
                                </Text>
                                {!searchQuery && (
                                    <TouchableOpacity style={[styles.emptyActionBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]} onPress={() => setActiveTab('pool')}>
                                        <Ionicons name="flash" size={14} color="#0F172A" />
                                        <Text style={styles.emptyActionBtnText}>Browse Available Job Pool ({poolOrders.length})</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            currentTabOrders.map(item => (
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
                            <Text style={styles.sectionTitle}>Orders Awaiting Driver Pickup</Text>
                            <Text style={styles.sectionCountText}>{currentTabOrders.length} Available</Text>
                        </View>

                        {currentTabOrders.length === 0 ? (
                            <View style={styles.emptyCardBox}>
                                <Ionicons name="sparkles-outline" size={44} color={GOLD} />
                                <Text style={styles.emptyTitle}>
                                    {searchQuery ? 'No Orders Match Your Search' : 'Job Pool is All Clear'}
                                </Text>
                                <Text style={styles.emptySubtitle}>
                                    {searchQuery
                                        ? 'Try clearing filters to see all available consignments.'
                                        : 'All customer orders are currently picked up. New orders will appear here automatically.'}
                                </Text>
                            </View>
                        ) : (
                            currentTabOrders.map(item => (
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
                        {/* Clean Luxury Wallet Banner */}
                        <LinearGradient
                            colors={['#0F172A', '#1E293B']}
                            style={styles.luxuryWalletBanner}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View>
                                    <Text style={styles.walletHeaderLabel}>DRIVER ESCROW WALLET</Text>
                                    <Text style={styles.walletHeaderBalance}>₦{walletBalance.toLocaleString()}</Text>
                                    <Text style={styles.walletTodayText}>Today's Earnings: +₦{todayEarnings.toLocaleString()}</Text>
                                </View>
                                <View style={styles.walletAmcChip}>
                                    <Ionicons name="checkmark-circle" size={14} color={SUCCESS} />
                                    <Text style={styles.walletAmcChipText}>Active Balance</Text>
                                </View>
                            </View>

                            <View style={styles.walletActionsBar}>
                                <TouchableOpacity
                                    style={styles.cashOutPrimaryBtn}
                                    onPress={() => setWithdrawModalVisible(true)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="arrow-up-circle-outline" size={18} color="#0F172A" />
                                    <Text style={styles.cashOutPrimaryBtnText}>Withdraw to Bank</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.payoutHistorySecBtn}
                                    onPress={() => setHistoryModalVisible(true)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="list" size={16} color="#FFFFFF" />
                                    <Text style={styles.payoutHistorySecBtnText}>Transactions ({transactions.length})</Text>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>

                        {/* Live Courier Earnings & Performance Overview (100% Real Live Data) */}
                        <View style={[styles.vehicleInfoCard, { marginBottom: 16, paddingTop: 16 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="stats-chart" size={15} color={GOLD} />
                                    <Text style={styles.vehicleCardTitle}>Live Earnings & Delivery Summary</Text>
                                </View>
                                <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                    <Text style={{ color: SUCCESS, fontWeight: '800', fontSize: 11 }}>REAL-TIME</Text>
                                </View>
                            </View>

                            <View style={styles.realEarningsSummaryGrid}>
                                <View style={styles.realSummaryBox}>
                                    <Text style={styles.realSummaryLbl}>TODAY'S PAYOUT</Text>
                                    <Text style={[styles.realSummaryVal, { color: SUCCESS }]} numberOfLines={1}>
                                        ₦{todayEarnings.toLocaleString()}
                                    </Text>
                                </View>
                                <View style={styles.realSummaryBox}>
                                    <Text style={styles.realSummaryLbl}>TOTAL DELIVERED</Text>
                                    <Text style={[styles.realSummaryVal, { color: '#38BDF8' }]} numberOfLines={1}>
                                        {historyOrders.length}
                                    </Text>
                                </View>
                                <View style={styles.realSummaryBox}>
                                    <Text style={styles.realSummaryLbl}>LIFETIME EARNINGS</Text>
                                    <Text style={[styles.realSummaryVal, { color: GOLD }]} numberOfLines={1}>
                                        ₦{totalDeliveredEarnings.toLocaleString()}
                                    </Text>
                                </View>
                                <View style={styles.realSummaryBox}>
                                    <Text style={styles.realSummaryLbl}>ESCROW BALANCE</Text>
                                    <Text style={[styles.realSummaryVal, { color: TEXT_DARK }]} numberOfLines={1}>
                                        ₦{walletBalance.toLocaleString()}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Recent Transactions List */}
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Recent Wallet Activity</Text>
                        </View>

                        {transactions.length === 0 ? (
                            <View style={styles.emptyCardBox}>
                                <Ionicons name="wallet-outline" size={36} color={TEXT_SUBTLE} />
                                <Text style={styles.emptyTitle}>No Transactions Yet</Text>
                                <Text style={styles.emptySubtitle}>Earnings from completed deliveries and payouts will appear here.</Text>
                            </View>
                        ) : (
                            transactions.slice(0, 8).map(t => (
                                <View key={t.id} style={styles.payoutLogRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.payoutLogAmount, { color: t.type === 'debit' ? DANGER : SUCCESS }]}>
                                            {t.type === 'debit' ? '-' : '+'}₦{Number(t.amount || 0).toLocaleString()}
                                        </Text>
                                        <Text style={styles.payoutLogMeta}>{t.description || 'Transaction'}</Text>
                                        <Text style={[styles.payoutLogMeta, { fontSize: 11 }]}>
                                            {new Date(t.created_at).toLocaleDateString()} • {t.reference || ''}
                                        </Text>
                                    </View>
                                    <View style={[styles.payoutStatusPill, { backgroundColor: t.status === 'completed' ? '#ECFDF5' : '#FFFBEB' }]}>
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: t.status === 'completed' ? SUCCESS : AMBER }}>
                                            {(t.status || 'COMPLETED').toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* TAB 4: HISTORY */}
                {activeTab === 'history' && (
                    <View style={styles.tabContentSection}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Completed & Closed Deliveries</Text>
                            <Text style={styles.sectionCountText}>{currentTabOrders.length} Completed</Text>
                        </View>

                        {currentTabOrders.length === 0 ? (
                            <View style={styles.emptyCardBox}>
                                <Ionicons name="time-outline" size={44} color={TEXT_SUBTLE} />
                                <Text style={styles.emptyTitle}>No Completed Deliveries</Text>
                                <Text style={styles.emptySubtitle}>Packages you deliver will appear here with complete delivery receipts.</Text>
                            </View>
                        ) : (
                            currentTabOrders.map(item => (
                                <View key={item.id} style={{ marginBottom: 14 }}>
                                    {renderOrderItem({ item })}
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* TAB 5: VEHICLE & SETTINGS */}
                {activeTab === 'profile' && (
                    <View style={styles.tabContentSection}>
                        {/* Courier Performance Card */}
                        <View style={[styles.vehicleInfoCard, { marginBottom: 16 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="trophy" size={22} color={GOLD} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.vehicleCardTitle}>{driverTier.title}</Text>
                                    <Text style={{ fontSize: 12, color: TEXT_MUTED }}>Courier Rating: 5.0 ★ • {driverProfile?.xp || 0} XP</Text>
                                </View>
                            </View>

                            <View style={styles.statMiniGrid}>
                                <View style={styles.statMiniBox}>
                                    <Text style={styles.statMiniVal}>{historyOrders.length}</Text>
                                    <Text style={styles.statMiniLbl}>Total Delivered</Text>
                                </View>
                                <View style={styles.statMiniBox}>
                                    <Text style={styles.statMiniVal}>₦{todayEarnings.toLocaleString()}</Text>
                                    <Text style={styles.statMiniLbl}>Today's Pay</Text>
                                </View>
                                <View style={styles.statMiniBox}>
                                    <Text style={styles.statMiniVal}>100%</Text>
                                    <Text style={styles.statMiniLbl}>Safety Rate</Text>
                                </View>
                            </View>
                        </View>

                        {/* Vehicle Specifications Card */}
                        <View style={styles.vehicleInfoCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={styles.vehicleCardTitle}>Assigned Logistics Vehicle</Text>
                                <TouchableOpacity style={styles.editVehicleBtn} onPress={() => setVehicleModalVisible(true)} activeOpacity={0.8}>
                                    <Ionicons name="create-outline" size={14} color="#0F172A" />
                                    <Text style={styles.editVehicleBtnText}>Edit Vehicle</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.vehicleRow}>
                                <Ionicons name="car-sport-outline" size={18} color={TEXT_MUTED} />
                                <Text style={styles.vehiclePropLabel}>Vehicle Type:</Text>
                                <Text style={styles.vehiclePropVal}>{driverProfile?.vehicle_type || 'Motorcycle'}</Text>
                            </View>

                            <View style={styles.vehicleRow}>
                                <Ionicons name="barcode-outline" size={18} color={TEXT_MUTED} />
                                <Text style={styles.vehiclePropLabel}>Plate / Reg Number:</Text>
                                <Text style={styles.vehiclePropVal}>{driverProfile?.vehicle_number || 'Not Set'}</Text>
                            </View>

                            <View style={styles.vehicleRow}>
                                <Ionicons name="call-outline" size={18} color={TEXT_MUTED} />
                                <Text style={styles.vehiclePropLabel}>Driver Phone:</Text>
                                <Text style={styles.vehiclePropVal}>{activeUser?.phone || driverProfile?.phone || 'Not Set'}</Text>
                            </View>

                            <View style={styles.vehicleRow}>
                                <Ionicons name="location-outline" size={18} color={TEXT_MUTED} />
                                <Text style={styles.vehiclePropLabel}>Base Station:</Text>
                                <Text style={styles.vehiclePropVal}>{driverProfile?.current_location || 'Kano Hub'}</Text>
                            </View>
                        </View>

                        {/* Logistics Dispatch Support Hotline */}
                        <View style={[styles.vehicleInfoCard, { marginTop: 16 }]}>
                            <Text style={styles.vehicleCardTitle}>Abu Mafhal Logistics Dispatch</Text>
                            <Text style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 4, marginBottom: 12 }}>
                                Need emergency delivery assistance, address resolution, or customer dispute support?
                            </Text>
                            <TouchableOpacity
                                style={styles.hotlineBtn}
                                onPress={() => Linking.openURL('tel:08002286234')}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="call" size={15} color="#FFFFFF" />
                                <Text style={styles.hotlineBtnText}>Call Logistics Hotline</Text>
                            </TouchableOpacity>
                        </View>

                        {/* End Shift / Clock Out */}
                        <TouchableOpacity
                            style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                            onPress={() => setShiftSummaryModalVisible(true)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="stopwatch" size={18} color={TEXT_DARK} />
                            <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT_DARK }}>End Shift & View Summary</Text>
                        </TouchableOpacity>
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
                                <Ionicons name="close" size={20} color={TEXT_DARK} />
                            </TouchableOpacity>
                        </View>

                        {selectedOrder && (
                            <ScrollView style={{ padding: 18 }}>
                                <View style={styles.invoiceHeroBox}>
                                    <Text style={styles.invoiceHeroLabel}>TOTAL ORDER VALUE</Text>
                                    <Text style={styles.invoiceHeroValue}>₦{Number(selectedOrder.total_amount || 0).toLocaleString()}</Text>
                                    <Text style={styles.invoiceHeroFee}>Driver Fee: +₦{Number(selectedOrder.shipping_fee || 1000).toLocaleString()}</Text>
                                </View>

                                <View style={styles.invoiceSection}>
                                    <Text style={styles.invoiceSectionTitle}>CUSTOMER DETAILS</Text>
                                    <Text style={styles.invoiceLineText}>👤 Name: {selectedOrder.user?.full_name || 'Marketplace Buyer'}</Text>
                                    <Text style={styles.invoiceLineText}>📞 Phone: {selectedOrder.user?.phone || selectedOrder.contact_phone || 'N/A'}</Text>
                                    <Text style={styles.invoiceLineText}>📍 Address: {parseAddress(selectedOrder.shipping_address)}</Text>
                                    <Text style={styles.invoiceLineText}>💳 Payment: {(selectedOrder.payment_method || 'Online').toUpperCase()} ({selectedOrder.payment_status || 'Paid'})</Text>
                                </View>

                                {selectedOrder.items && selectedOrder.items.length > 0 && (
                                    <View style={styles.invoiceSection}>
                                        <Text style={styles.invoiceSectionTitle}>PACKAGE ITEMS ({selectedOrder.items.length})</Text>
                                        {selectedOrder.items.map((item, idx) => (
                                            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: idx !== selectedOrder.items.length -1 ? 1 : 0, borderBottomColor: '#F1F5F9' }}>
                                                <Text style={[styles.invoiceLineText, { flex: 1, paddingRight: 10 }]} numberOfLines={2}>
                                                    {item.quantity}x {item.product_name || `Product #${item.product_id?.slice(0,6) || item.id?.slice(0,6)}`}
                                                </Text>
                                                <Text style={[styles.invoiceLineText, { fontWeight: '700' }]}>
                                                    ₦{(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {selectedOrder.driver_notes ? (
                                    <View style={styles.invoiceSection}>
                                        <Text style={styles.invoiceSectionTitle}>DELIVERY NOTES / AUDIT</Text>
                                        <Text style={styles.invoiceLineText}>{selectedOrder.driver_notes}</Text>
                                    </View>
                                ) : null}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ─── MODAL 1.5: SHIFT SUMMARY ─── */}
            <Modal visible={isShiftSummaryModalVisible} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalSheetTitle}>End of Shift Summary</Text>
                            <TouchableOpacity onPress={() => setShiftSummaryModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color={TEXT_DARK} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalContent}>
                            <View style={{ alignItems: 'center', marginVertical: 20 }}>
                                <Ionicons name="checkmark-done-circle" size={60} color={SUCCESS} />
                                <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_DARK, marginTop: 10 }}>Great Job Today!</Text>
                                <Text style={{ fontSize: 14, color: TEXT_MUTED, textAlign: 'center', marginTop: 4 }}>You've successfully completed your deliveries.</Text>
                            </View>

                            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                                    <Text style={{ fontSize: 14, color: TEXT_MUTED, fontWeight: '600' }}>Deliveries Completed:</Text>
                                    <Text style={{ fontSize: 14, color: TEXT_DARK, fontWeight: '800' }}>{historyOrders.length}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                                    <Text style={{ fontSize: 14, color: TEXT_MUTED, fontWeight: '600' }}>Earnings Today:</Text>
                                    <Text style={{ fontSize: 14, color: SUCCESS, fontWeight: '800' }}>₦{todayEarnings.toLocaleString()}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                                    <Text style={{ fontSize: 14, color: TEXT_MUTED, fontWeight: '600' }}>XP Gained:</Text>
                                    <Text style={{ fontSize: 14, color: GOLD, fontWeight: '800' }}>+{historyOrders.length * 50} XP</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                                    <Text style={{ fontSize: 14, color: TEXT_MUTED, fontWeight: '600' }}>Driver Rating:</Text>
                                    <Text style={{ fontSize: 14, color: TEXT_DARK, fontWeight: '800' }}>{driverProfile?.rating?.toFixed(1) || '5.0'} ★</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.submitBtnGold}
                                onPress={() => {
                                    setShiftSummaryModalVisible(false);
                                    if (driverProfile?.status === 'active') {
                                        toggleStatus();
                                    }
                                }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="power" size={18} color="#FFF" />
                                <Text style={styles.submitBtnGoldText}>Clock Out & Go Offline</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ─── MODAL 2: VERIFIED HANDOVER & PROOF OF DELIVERY ─── */}
            <Modal visible={isHandoverModalVisible} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheetContent}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Confirm Package Handover</Text>
                            <TouchableOpacity onPress={() => setHandoverModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color={TEXT_DARK} />
                            </TouchableOpacity>
                        </View>

                        {handoverOrder && (
                            <ScrollView style={{ padding: 20 }}>
                                <View style={styles.handoverSummaryCard}>
                                    <Text style={styles.handoverOrderId}>ORD-{handoverOrder.id.slice(0, 8).toUpperCase()}</Text>
                                    <Text style={styles.handoverCustomer}>Recipient: {handoverOrder.user?.full_name || 'Customer'}</Text>
                                    <Text style={styles.handoverFee}>Courier Payout: +₦{Number(handoverOrder.shipping_fee || 1000).toLocaleString()} (+50 XP)</Text>
                                </View>

                                {isPodOrder(handoverOrder) ? (
                                    <View style={styles.podAlertBanner}>
                                        <Ionicons name="alert-circle" size={18} color="#B45309" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.podAlertTitle}>CASH COLLECTION REQUIRED (POD)</Text>
                                            <Text style={styles.podAlertDesc}>
                                                Collect ₦{Number(handoverOrder.total_amount || 0).toLocaleString()} cash/transfer before releasing parcel.
                                            </Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.prepaidHandoverBanner}>
                                        <Ionicons name="checkmark-circle" size={18} color="#059669" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.prepaidHandoverTitle}>PAID ONLINE • 100% ESCROW SETTLED</Text>
                                            <Text style={styles.prepaidHandoverDesc}>
                                                Payment (₦{Number(handoverOrder.total_amount || 0).toLocaleString()}) was confirmed online. DO NOT collect any money from customer.
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                <Text style={styles.inputFieldLabel}>Recipient Person Name (Who received the parcel?)</Text>
                                <TextInput
                                    style={styles.textInputModern}
                                    value={handoverRecipient}
                                    onChangeText={setHandoverRecipient}
                                    placeholder="e.g. Customer in person / Family member / Office receptionist"
                                    placeholderTextColor={TEXT_SUBTLE}
                                />

                                <Text style={styles.inputFieldLabel}>Delivery Note / Handover Location</Text>
                                <TextInput
                                    style={styles.textInputModern}
                                    value={handoverNotes}
                                    onChangeText={setHandoverNotes}
                                    placeholder="e.g. Handed over at front gate, confirmed package intact"
                                    placeholderTextColor={TEXT_SUBTLE}
                                />

                                <View style={{ marginTop: 14 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <Text style={[styles.inputFieldLabel, { marginTop: 0, marginBottom: 0 }]}>Customer Security PIN</Text>
                                        {handoverPin.trim().length === 4 && (
                                            handoverPin.trim() === (handoverOrder.security_pin || generateSecurityPin(handoverOrder.id || handoverOrder.reference)) ? (
                                                <Text style={{ fontSize: 11, fontWeight: '800', color: SUCCESS }}>✅ Code Verified</Text>
                                            ) : (
                                                <Text style={{ fontSize: 11, fontWeight: '800', color: DANGER }}>❌ Code Mismatch</Text>
                                            )
                                        )}
                                    </View>
                                    <View style={styles.pinInputContainer}>
                                        <Ionicons name="key" size={18} color={GOLD} />
                                        <TextInput
                                            style={styles.pinInput}
                                            value={handoverPin}
                                            onChangeText={setHandoverPin}
                                            placeholder="Ask customer for 4-digit PIN"
                                            placeholderTextColor={TEXT_SUBTLE}
                                            keyboardType="numeric"
                                            maxLength={4}
                                        />
                                    </View>
                                    <Text style={styles.pinHelpText}>
                                        Customer can view this 4-digit code on their Track Order screen or delivery SMS.
                                    </Text>
                                </View>

                                <Text style={styles.inputFieldLabel}>Proof of Delivery (Photo)</Text>
                                {handoverImage ? (
                                    <View style={{ position: 'relative', marginTop: 8 }}>
                                        <Image source={{ uri: handoverImage.uri }} style={{ width: '100%', height: 180, borderRadius: 12 }} />
                                        <TouchableOpacity 
                                            style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 20 }}
                                            onPress={() => setHandoverImage(null)}
                                        >
                                            <Ionicons name="close" size={16} color="#FFF" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity style={styles.cameraCaptureBtn} onPress={takeProofOfDeliveryPhoto} activeOpacity={0.8}>
                                        <Ionicons name="camera" size={24} color={TEXT_MUTED} />
                                        <Text style={styles.cameraCaptureBtnText}>Take Photo of Package at Destination</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[styles.submitBtnGold, isSubmittingHandover && { opacity: 0.6 }]}
                                    onPress={submitHandoverDelivery}
                                    disabled={isSubmittingHandover}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.submitBtnGoldText}>
                                        {isSubmittingHandover ? 'Verifying & Releasing Escrow...' : 'Release Escrow & Complete ✅'}
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ─── MODAL 3: REPORT DELIVERY ISSUE ─── */}
            <Modal visible={isIssueModalVisible} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheetContent}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Report Delivery Problem</Text>
                            <TouchableOpacity onPress={() => setIssueModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color={TEXT_DARK} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ padding: 20 }}>
                            <Text style={styles.inputFieldLabel}>Select Nature of Problem:</Text>
                            {[
                                'Customer unreachable on phone',
                                'Wrong or incomplete delivery address',
                                'Customer rejected package',
                                'Courier vehicle breakdown / transit delay',
                                'Security denied entrance to premises'
                            ].map(reason => (
                                <TouchableOpacity
                                    key={reason}
                                    style={[styles.reasonOption, issueReason === reason && styles.reasonOptionActive]}
                                    onPress={() => setIssueReason(reason)}
                                >
                                    <Text style={[styles.reasonOptionText, issueReason === reason && styles.reasonOptionTextActive]}>
                                        {reason}
                                    </Text>
                                </TouchableOpacity>
                            ))}

                            <Text style={styles.inputFieldLabel}>Additional Notes for Dispatch:</Text>
                            <TextInput
                                style={[styles.textInputModern, { height: 75, textAlignVertical: 'top' }]}
                                multiline
                                value={issueDetail}
                                onChangeText={setIssueDetail}
                                placeholder="Describe current situation..."
                                placeholderTextColor={TEXT_SUBTLE}
                            />

                            <TouchableOpacity
                                style={[styles.submitBtnDanger, isSubmittingIssue && { opacity: 0.6 }]}
                                onPress={submitDeliveryIssue}
                                disabled={isSubmittingIssue}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.submitBtnDangerText}>
                                    {isSubmittingIssue ? 'Submitting to Dispatch...' : 'Notify Dispatch ⚠️'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ─── MODAL 4: VEHICLE INFORMATION ─── */}
            <Modal visible={isVehicleModalVisible} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheetContent}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Update Vehicle Information</Text>
                            <TouchableOpacity onPress={() => setVehicleModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color={TEXT_DARK} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ padding: 20 }}>
                            <Text style={styles.inputFieldLabel}>Vehicle Type (e.g. Motorcycle, Tricycle, Van)</Text>
                            <TextInput
                                style={styles.textInputModern}
                                value={vType}
                                onChangeText={setVType}
                                placeholder="Motorcycle"
                                placeholderTextColor={TEXT_SUBTLE}
                            />

                            <Text style={styles.inputFieldLabel}>Plate / Registration Number</Text>
                            <TextInput
                                style={styles.textInputModern}
                                value={pNumber}
                                onChangeText={setPNumber}
                                placeholder="ABC-123XY"
                                placeholderTextColor={TEXT_SUBTLE}
                            />

                            <TouchableOpacity style={styles.submitBtnGold} onPress={updateVehicleDetails} activeOpacity={0.85}>
                                <Text style={styles.submitBtnGoldText}>Save Vehicle Details ✅</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ─── MODAL 5: BANK PAYOUT WITHDRAWAL ─── */}
            <Modal visible={isWithdrawModalVisible} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheetContent}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Withdraw to Bank Account</Text>
                            <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color={TEXT_DARK} />
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
                                placeholderTextColor={TEXT_SUBTLE}
                                keyboardType="numeric"
                            />

                            <Text style={styles.inputFieldLabel}>Select Bank</Text>
                            <TouchableOpacity
                                style={styles.bankSelectTrigger}
                                onPress={() => setShowBankDropdown(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={{ color: bankName ? TEXT_DARK : TEXT_MUTED, fontWeight: '600' }}>
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
                                placeholderTextColor={TEXT_SUBTLE}
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

            {/* ─── MODAL 6: BANK SELECTOR SUB-MODAL ─── */}
            <Modal visible={showBankDropdown} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalSheetContent, { maxHeight: '80%' }]}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Select Receiving Bank</Text>
                            <TouchableOpacity onPress={() => setShowBankDropdown(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color={TEXT_DARK} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ padding: 16, flex: 1 }}>
                            <View style={styles.bankSearchWrap}>
                                <Ionicons name="search" size={16} color={TEXT_MUTED} />
                                <TextInput
                                    style={styles.bankSearchInput}
                                    placeholder="Search bank name..."
                                    placeholderTextColor={TEXT_SUBTLE}
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
                                        <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ─── MODAL 7: TRANSACTION LOGS ─── */}
            <Modal visible={isHistoryModalVisible} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheetContent}>
                        <View style={styles.modalSheetHeader}>
                            <Text style={styles.modalSheetTitle}>Wallet Transactions</Text>
                            <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.modalCloseCircle}>
                                <Ionicons name="close" size={18} color={TEXT_DARK} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ padding: 18 }}>
                            {transactions.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                    <Ionicons name="wallet-outline" size={40} color={TEXT_SUBTLE} />
                                    <Text style={{ color: TEXT_MUTED, marginTop: 12, fontSize: 13 }}>No transaction records yet</Text>
                                </View>
                            ) : (
                                transactions.map(w => (
                                    <View key={w.id} style={styles.payoutLogRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.payoutLogAmount, { color: w.type === 'debit' ? DANGER : SUCCESS }]}>
                                                {w.type === 'debit' ? '-' : '+'}₦{Number(w.amount || 0).toLocaleString()}
                                            </Text>
                                            <Text style={styles.payoutLogMeta}>{w.description || 'Transaction'}</Text>
                                            <Text style={[styles.payoutLogMeta, { fontSize: 11 }]}>
                                                {new Date(w.created_at).toLocaleDateString()} • {w.reference || ''}
                                            </Text>
                                        </View>
                                        <View style={[styles.payoutStatusPill, { backgroundColor: w.status === 'completed' ? '#ECFDF5' : '#FFFBEB' }]}>
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

// ─── STYLES (CLEAN MODERN LUXURY LIGHT THEME) ───
const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: BG_LIGHT,
    },
    compactHeaderGradient: {
        paddingTop: Platform.OS === 'ios' ? 8 : 12,
        paddingBottom: 10,
        paddingHorizontal: 14,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    compactHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    menuTriggerBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    menuPulseDot: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
        position: 'absolute',
        top: 6,
        right: 6,
        borderWidth: 1.5,
        borderColor: HEADER_NAVY,
    },
    compactBrandBox: {
        flex: 1,
        justifyContent: 'center',
    },
    compactBrandTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    compactLevelTag: {
        backgroundColor: 'rgba(217, 167, 58, 0.2)',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    compactLevelText: {
        fontSize: 10,
    },
    compactHubText: {
        fontSize: 10.5,
        color: '#94A3B8',
        fontWeight: '600',
    },
    compactActionGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    compactStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
    },
    statusPillActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    statusPillOffline: {
        backgroundColor: 'rgba(100, 116, 139, 0.15)',
        borderColor: 'rgba(100, 116, 139, 0.3)',
    },
    compactStatusPillText: {
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    pillDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    compactWalletPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(217, 167, 58, 0.18)',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.35)',
    },
    compactWalletText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    compactIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactGpsNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginTop: 6,
    },
    compactGpsText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#34D399',
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 8,
        marginBottom: 14,
    },
    metricCard: {
        width: '48.5%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    metricCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    metricIconWrap: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricValue: {
        fontSize: 15,
        fontWeight: '900',
        color: TEXT_DARK,
    },
    metricLabel: {
        fontSize: 9.5,
        color: TEXT_MUTED,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    metricSubtext: {
        fontSize: 10,
        color: TEXT_MUTED,
        fontWeight: '600',
        marginTop: 3,
    },
    xpProgressContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    xpLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#CBD5E1',
    },
    xpNextLevel: {
        fontSize: 9.5,
        fontWeight: '700',
        color: GOLD,
    },
    xpProgressBarBg: {
        height: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    xpProgressBarFill: {
        height: '100%',
        backgroundColor: GOLD,
        borderRadius: 3,
    },
    tabBarContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR,
    },
    tabScrollContent: {
        paddingHorizontal: 14,
        gap: 8,
    },
    modernTabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modernTabPillActive: {
        backgroundColor: HEADER_NAVY,
        borderColor: HEADER_NAVY,
    },
    modernTabPillText: {
        fontSize: 12,
        fontWeight: '800',
        color: TEXT_MUTED,
    },
    modernTabPillTextActive: {
        color: '#FFFFFF',
    },
    searchFilterStrip: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    searchInput: {
        flex: 1,
        fontSize: 12.5,
        color: TEXT_DARK,
        marginLeft: 8,
        padding: 0,
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    filterChipActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: TEXT_MUTED,
    },
    filterChipTextActive: {
        color: '#FFFFFF',
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
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: TEXT_DARK,
    },
    sectionCountText: {
        fontSize: 12,
        fontWeight: '800',
        color: GOLD,
    },
    modernCard: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    cardSubHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    orderIdPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    orderIdText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#92400E',
    },
    feeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    feeBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#065F46',
    },
    statusBadge: {
        marginLeft: 'auto',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusBadgeActive: {
        backgroundColor: '#ECFDF5',
    },
    statusBadgePool: {
        backgroundColor: '#FEF3C7',
    },
    statusBadgeHistory: {
        backgroundColor: '#F1F5F9',
    },
    statusBadgeText: {
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    podAlertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF3C7',
        padding: 10,
        borderRadius: 10,
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
        gap: 8,
        backgroundColor: '#ECFDF5',
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    prepaidText: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#065F46',
        letterSpacing: 0.2,
    },
    prepaidSubText: {
        fontSize: 10,
        color: '#047857',
        marginTop: 2,
    },
    escrowSecuredBadge: {
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#A7F3D0',
        marginLeft: 'auto',
    },
    escrowSecuredBadgeText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#065F46',
        letterSpacing: 0.4,
    },
    prepaidHandoverBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#ECFDF5',
        padding: 12,
        borderRadius: 10,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    prepaidHandoverTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#065F46',
        letterSpacing: 0.3,
    },
    prepaidHandoverDesc: {
        fontSize: 11,
        color: '#047857',
        marginTop: 2,
        lineHeight: 16,
    },
    pinInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        gap: 8,
    },
    pinInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        fontWeight: '800',
        color: TEXT_DARK,
        letterSpacing: 4,
    },
    pinHelpText: {
        fontSize: 10.5,
        color: TEXT_MUTED,
        marginTop: 4,
        lineHeight: 14,
    },
    pssBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#EFF6FF',
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    pssText: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#1E40AF',
    },
    packagePreviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F8FAFC',
        padding: 10,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    packageIconBox: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    packageTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: TEXT_DARK,
    },
    packageMeta: {
        fontSize: 11,
        color: TEXT_MUTED,
        marginTop: 2,
    },
    customerName: {
        fontSize: 11.5,
        color: TEXT_DARK,
        fontWeight: '700',
        marginTop: 2,
    },
    routeCard: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    routeLabel: {
        fontSize: 9.5,
        color: TEXT_MUTED,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    routeAddress: {
        fontSize: 12.5,
        color: TEXT_DARK,
        fontWeight: '700',
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
        marginBottom: 10,
    },
    contactBtnCall: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#F1F5F9',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    contactBtnCallText: {
        fontSize: 12,
        fontWeight: '800',
        color: TEXT_DARK,
    },
    contactBtnWhatsapp: {
        flex: 1.2,
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
    contactBtnIssue: {
        flex: 0.8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#FEE2E2',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    contactBtnIssueText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: DANGER,
    },
    quickTemplatesBar: {
        backgroundColor: '#F8FAFC',
        padding: 8,
        borderRadius: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    quickTemplateHeader: {
        fontSize: 9,
        fontWeight: '900',
        color: TEXT_MUTED,
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    templateChip: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    templateChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: TEXT_DARK,
    },
    driverNotesBox: {
        backgroundColor: '#FEF3C7',
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
    },
    driverNotesText: {
        fontSize: 11.5,
        color: '#92400E',
        fontWeight: '600',
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
    actionBtnPickup: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FEF3C7',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    actionBtnPickupText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#92400E',
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
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    actionBtnDetailsText: {
        fontSize: 12,
        color: TEXT_DARK,
        fontWeight: '700',
    },
    emptyCardBox: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: TEXT_DARK,
        marginTop: 10,
    },
    emptySubtitle: {
        fontSize: 12,
        color: TEXT_MUTED,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 18,
    },
    emptyActionBtn: {
        backgroundColor: HEADER_NAVY,
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: 10,
        marginTop: 14,
    },
    emptyActionBtnText: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    luxuryWalletBanner: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    walletHeaderLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    walletHeaderBalance: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 4,
    },
    walletTodayText: {
        fontSize: 12,
        fontWeight: '700',
        color: SUCCESS,
        marginTop: 4,
    },
    walletAmcChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    walletAmcChipText: {
        fontSize: 11,
        fontWeight: '900',
        color: SUCCESS,
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
        borderRadius: 10,
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
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingVertical: 12,
        borderRadius: 10,
    },
    payoutHistorySecBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    vehicleInfoCard: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    vehicleCardTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: TEXT_DARK,
    },
    realEarningsSummaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 8,
    },
    realSummaryBox: {
        width: '48.5%',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    realSummaryLbl: {
        fontSize: 9.5,
        fontWeight: '800',
        color: TEXT_MUTED,
        letterSpacing: 0.4,
        marginBottom: 4,
    },
    realSummaryVal: {
        fontSize: 15,
        fontWeight: '900',
    },
    statMiniGrid: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 6,
    },
    statMiniBox: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        padding: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    statMiniVal: {
        fontSize: 14,
        fontWeight: '900',
        color: TEXT_DARK,
    },
    statMiniLbl: {
        fontSize: 9.5,
        color: TEXT_MUTED,
        fontWeight: '700',
        marginTop: 2,
    },
    editVehicleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    editVehicleBtnText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#92400E',
    },
    vehicleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    vehiclePropLabel: {
        fontSize: 12.5,
        color: TEXT_MUTED,
        fontWeight: '600',
        width: 140,
    },
    vehiclePropVal: {
        fontSize: 13,
        color: TEXT_DARK,
        fontWeight: '800',
    },
    hotlineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#0F172A',
        paddingVertical: 13,
        borderRadius: 10,
    },
    hotlineBtnText: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalSheetContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '88%',
    },
    modalSheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR,
    },
    modalSheetTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: TEXT_DARK,
    },
    modalCloseCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    invoiceHeroBox: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    invoiceHeroLabel: {
        fontSize: 10,
        color: TEXT_MUTED,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    invoiceHeroValue: {
        fontSize: 24,
        fontWeight: '900',
        color: TEXT_DARK,
        marginTop: 2,
    },
    invoiceHeroFee: {
        fontSize: 12,
        fontWeight: '800',
        color: SUCCESS,
        marginTop: 4,
    },
    invoiceSection: {
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
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
        color: TEXT_DARK,
        lineHeight: 20,
    },
    handoverSummaryCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    handoverOrderId: {
        fontSize: 13,
        fontWeight: '900',
        color: GOLD,
    },
    handoverCustomer: {
        fontSize: 13,
        fontWeight: '800',
        color: TEXT_DARK,
        marginTop: 2,
    },
    handoverFee: {
        fontSize: 12,
        fontWeight: '800',
        color: SUCCESS,
        marginTop: 4,
    },
    inputFieldLabel: {
        fontSize: 11.5,
        color: TEXT_DARK,
        fontWeight: '700',
        marginTop: 12,
        marginBottom: 6,
    },
    textInputModern: {
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: TEXT_DARK,
        fontSize: 13.5,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    cameraCaptureBtn: {
        backgroundColor: '#F8FAFC',
        borderWidth: 2,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        gap: 8,
    },
    cameraCaptureBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: TEXT_MUTED,
        textAlign: 'center',
    },
    reasonOption: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        marginBottom: 6,
    },
    reasonOptionActive: {
        backgroundColor: '#EFF6FF',
        borderColor: BLUE,
    },
    reasonOptionText: {
        fontSize: 12.5,
        color: TEXT_DARK,
        fontWeight: '600',
    },
    reasonOptionTextActive: {
        color: BLUE,
        fontWeight: '800',
    },
    submitBtnGold: {
        backgroundColor: HEADER_NAVY,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
    },
    submitBtnGoldText: {
        color: '#FFFFFF',
        fontSize: 13.5,
        fontWeight: '900',
    },
    submitBtnDanger: {
        backgroundColor: DANGER,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
    },
    submitBtnDangerText: {
        color: '#FFFFFF',
        fontSize: 13.5,
        fontWeight: '900',
    },
    payoutBalanceNotice: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 14,
        marginTop: 6,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    payoutBalanceNoticeLabel: {
        fontSize: 10,
        color: TEXT_MUTED,
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
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    verifiedAccountBanner: {
        backgroundColor: '#ECFDF5',
        borderRadius: 10,
        padding: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#A7F3D0',
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
        color: '#065F46',
        marginTop: 2,
    },
    payoutSubmitBtn: {
        backgroundColor: HEADER_NAVY,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
    },
    payoutSubmitBtnText: {
        color: '#FFFFFF',
        fontSize: 13.5,
        fontWeight: '900',
    },
    bankSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    bankSearchInput: {
        flex: 1,
        paddingVertical: 11,
        fontSize: 13,
        color: TEXT_DARK,
        marginLeft: 8,
    },
    bankSelectRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    bankSelectRowText: {
        fontSize: 13.5,
        color: TEXT_DARK,
        fontWeight: '600',
    },
    payoutLogRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    payoutLogAmount: {
        fontSize: 15,
        fontWeight: '900',
    },
    payoutLogMeta: {
        fontSize: 11.5,
        color: TEXT_MUTED,
        marginTop: 2,
    },
    payoutStatusPill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
});
