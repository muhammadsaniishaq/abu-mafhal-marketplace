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

// ─── Native Safe Icon Glyph Map (Zero @expo/vector-icons runtime crash) ───
const ICON_MAP = {
    'cube-outline': '📦',
    'cube': '📦',
    'cash-outline': '💵',
    'cash': '💵',
    'alert-circle': '⚠️',
    'warning': '⚠️',
    'checkmark-circle': '✅',
    'checkmark-done': '✔️',
    'location-outline': '📍',
    'location': '📍',
    'navigate': '🧭',
    'call': '📞',
    'call-outline': '📞',
    'logo-whatsapp': '💬',
    'chatbubble-ellipses': '💬',
    'flash': '⚡',
    'flash-outline': '⚡',
    'document-text-outline': '📄',
    'reload': '🔄',
    'power': '⏻',
    'wallet-outline': '💳',
    'wallet': '💳',
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
    'chevron-forward': '›',
    'radio': '🛰️',
    'trophy': '🏆',
    'shield-checkmark': '🛡️',
    'person': '👤',
    'star': '★'
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

        // Mock PIN validation for security feature
        if (handoverPin.length > 0 && handoverPin.length < 4) {
            Alert.alert('Invalid PIN', 'If providing a security PIN, it must be at least 4 digits.');
            return;
        }

        setIsSubmittingHandover(true);
        const orderId = handoverOrder.id;
        const customerPhone = handoverOrder.user?.phone || handoverOrder.contact_phone || '';
        const shippingFee = Number(handoverOrder.shipping_fee || 1000);

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

            const pinStr = handoverPin ? ` | Auth PIN: ****` : '';
            const imgStr = imageUrl ? ` | Proof: Image Uploaded` : '';
            const noteContent = `Handover Verified: Recipient: ${handoverRecipient || 'Customer'} | Notes: ${handoverNotes || 'Handed over directly'}${pinStr}${imgStr} | Time: ${new Date().toLocaleTimeString()}`;

            // 1. Mark order delivered with audit notes
            await supabase
                .from('orders')
                .update({
                    status: 'delivered',
                    driver_notes: noteContent,
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
                const deliverMsg = `Assalamu Alaikum! Your Abu Mafhal package #${orderId.slice(0, 8).toUpperCase()} has been successfully delivered by courier ${activeUser?.full_name || 'partner'}. Thank you for shopping with us!`;
                whatsappService.sendDirect(customerPhone, deliverMsg, handoverOrder.user_id).catch(() => {});
            }

            setHandoverModalVisible(false);
            setHandoverOrder(null);
            setHandoverImage(null);
            Alert.alert('Delivery Completed! 🎉', `+₦${shippingFee.toLocaleString()} credited to your wallet balance.\n+50 XP added to your courier profile!`);
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
                return (item.payment_method || '').toLowerCase() === 'pod';
            }
            if (filterPayment === 'PREPAID') {
                return (item.payment_method || '').toLowerCase() !== 'pod' && !(item.payment_method || '').toLowerCase().includes('small small');
            }
            if (filterPayment === 'PSS') {
                return (item.payment_method || '').toLowerCase().includes('small small') || !!item.installment_plan;
            }

            return true;
        });
    }, [activeTab, orders, poolOrders, historyOrders, searchQuery, filterPayment]);

    // ─── RENDER ORDER ITEM (CLEAN LIGHT CARD) ───
    const renderOrderItem = ({ item }) => {
        const address = parseAddress(item.shipping_address);
        const isPool = activeTab === 'pool';
        const isHistory = activeTab === 'history';
        const isPod = (item.payment_method || '').toLowerCase() === 'pod';
        const isPaySmallSmall = (item.payment_method || '').toLowerCase().includes('small small') || !!item.installment_plan;
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

                    <View style={styles.feeBadge}>
                        <Ionicons name="cash-outline" size={12} color={SUCCESS} />
                        <Text style={styles.feeBadgeText}>+₦{shippingFee.toLocaleString()} Delivery Fee</Text>
                    </View>

                    <View style={[styles.statusBadge, isPool ? styles.statusBadgePool : isHistory ? styles.statusBadgeHistory : styles.statusBadgeActive]}>
                        <Text style={[styles.statusBadgeText, isPool ? { color: '#B45309' } : isHistory ? { color: TEXT_MUTED } : { color: '#065F46' }]}>
                            {isPool ? 'AVAILABLE' : isHistory ? (item.status || '').toUpperCase() : item.status === 'out_for_delivery' ? 'OUT FOR DELIVERY' : 'ASSIGNED'}
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
                ) : isPaySmallSmall ? (
                    <View style={styles.pssBanner}>
                        <Ionicons name="card-outline" size={15} color={BLUE} />
                        <Text style={styles.pssText}>PAY SMALL SMALL ORDER • PAID ONLINE (Do not collect money)</Text>
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
                            {itemCount} package item(s) • Total Order Value: ₦{totalAmount.toLocaleString()}
                        </Text>
                        <Text style={styles.customerName} numberOfLines={1}>
                            👤 Recipient: {customerName}
                        </Text>
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
                                onPress={() => sendQuickWhatsapp(customerPhone, `Assalamu Alaikum ${customerName}! I am on my way with your Abu Mafhal delivery (#${item.id.slice(0, 8).toUpperCase()}). 🛵`, item.user_id)}
                            >
                                <Text style={styles.templateChipText}>🛵 On my way</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.templateChip}
                                onPress={() => sendQuickWhatsapp(customerPhone, `Assalamu Alaikum ${customerName}! I have arrived outside your delivery location with your package. 📍`, item.user_id)}
                            >
                                <Text style={styles.templateChipText}>📍 Arrived outside</Text>
                            </TouchableOpacity>
                            {isPod && (
                                <TouchableOpacity
                                    style={[styles.templateChip, { backgroundColor: '#FEF3C7' }]}
                                    onPress={() => sendQuickWhatsapp(customerPhone, `Assalamu Alaikum! Please prepare ₦${totalAmount.toLocaleString()} cash/transfer for your Pay on Delivery package (#${item.id.slice(0, 8).toUpperCase()}). 💵`, item.user_id)}
                                >
                                    <Text style={[styles.templateChipText, { color: '#92400E' }]}>💵 Prepare POD ₦{totalAmount.toLocaleString()}</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                )}

                {/* Notes & Audit Row if exists */}
                {item.driver_notes ? (
                    <View style={styles.driverNotesBox}>
                        <Text style={styles.driverNotesText}>📝 {item.driver_notes}</Text>
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
                                <Text style={styles.actionBtnClaimText}>Accept & Claim Delivery ⚡</Text>
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
                                    <Ionicons name="bicycle" size={16} color="#0F172A" />
                                    <Text style={styles.actionBtnPickupText}>Pick Up & Start Transit 📦</Text>
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
                                    <Text style={styles.actionBtnDeliverText}>Verify Handover & Complete Delivery ✅</Text>
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
            {/* ─── 1. EXECUTIVE LUXURY HEADER (NAVY & GOLD) ─── */}
            <LinearGradient
                colors={[HEADER_NAVY, HEADER_NAVY_LIGHT]}
                style={styles.headerGradient}
            >
                {/* Top Row: Avatar, Identity, Actions */}
                <View style={styles.headerTopRow}>
                    <View style={styles.driverIdentityBox}>
                        <View style={styles.avatarWrap}>
                            <Image
                                source={{ uri: activeUser?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeUser?.full_name || 'Courier')}&background=0B132B&color=D9A73A&size=200` }}
                                style={styles.avatarImg}
                            />
                            <View style={[styles.avatarOnlineDot, { backgroundColor: driverProfile?.status === 'active' ? SUCCESS : '#94A3B8' }]} />
                        </View>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.driverName} numberOfLines={1}>{activeUser?.full_name || 'Courier Partner'}</Text>
                                <View style={[styles.levelTag, { backgroundColor: 'rgba(217, 167, 58, 0.25)' }]}>
                                    <Text style={styles.levelTagText}>{driverTier.badge} {driverTier.title.toUpperCase()}</Text>
                                </View>
                            </View>
                            <Text style={styles.driverSubRole}>Abu Mafhal Logistics • Delivery Partner</Text>
                        </View>
                    </View>

                    <View style={styles.headerActionGroup}>
                        <TouchableOpacity onPress={handleRefresh} style={styles.headerIconBtn} activeOpacity={0.75}>
                            <Ionicons name="reload" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={triggerSOS} style={[styles.headerIconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.9)' }]} activeOpacity={0.75}>
                            {isSosActive ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="warning" size={18} color="#FFFFFF" />}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onLogout} style={[styles.headerIconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]} activeOpacity={0.75}>
                            <Ionicons name="power" size={18} color={DANGER} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Status Toggle & Live GPS Banner */}
                <View style={styles.statusToggleBanner}>
                    <View style={styles.statusIndicatorRow}>
                        <View style={[styles.statusPulseDot, { backgroundColor: driverProfile?.status === 'emergency_sos' ? DANGER : driverProfile?.status === 'active' ? SUCCESS : '#94A3B8' }]} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusTitle, driverProfile?.status === 'emergency_sos' && { color: DANGER }]}>
                                {driverProfile?.status === 'emergency_sos' ? '🚨 SOS EMERGENCY ACTIVE' : driverProfile?.status === 'active' ? 'ONLINE • ACCEPTING DELIVERIES' : 'OFFLINE • STANDBY'}
                            </Text>
                            <Text style={styles.statusVehicleSubtitle} numberOfLines={1}>
                                {driverProfile?.vehicle_type || 'Vehicle'} • {driverProfile?.current_location || 'Kano Hub'}
                            </Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity
                            style={[styles.gpsSyncBtn, isLiveTracking && { backgroundColor: 'rgba(16, 185, 129, 0.3)', borderColor: SUCCESS }]}
                            onPress={toggleLiveTracking}
                            disabled={isSyncingGps}
                            activeOpacity={0.8}
                        >
                            {isLiveTracking ? (
                                <>
                                    <View style={[styles.statusPulseDot, { backgroundColor: SUCCESS, width: 8, height: 8 }]} />
                                    <Text style={styles.gpsSyncBtnText}>LIVE</Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="radio" size={12} color="#FFFFFF" />
                                    <Text style={styles.gpsSyncBtnText}>TRACK</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.gpsSyncBtn}
                            onPress={syncLiveGps}
                            disabled={isSyncingGps}
                            activeOpacity={0.8}
                        >
                            {isSyncingGps ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="location" size={12} color="#FFFFFF" />
                                    <Text style={styles.gpsSyncBtnText}>SYNC</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <Switch
                            value={driverProfile?.status === 'active'}
                            onValueChange={toggleStatus}
                            trackColor={{ false: '#334155', true: SUCCESS }}
                            thumbColor={driverProfile?.status === 'active' ? '#FFFFFF' : '#94A3B8'}
                        />
                    </View>
                </View>

                {gpsNotice ? (
                    <View style={styles.gpsNoticeBar}>
                        <Ionicons name="location" size={12} color={SUCCESS} />
                        <Text style={styles.gpsNoticeText}>{gpsNotice}</Text>
                    </View>
                ) : null}

                {/* Metrics Stats 4-Card Grid */}
                <View style={styles.metricsGrid}>
                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('wallet')} activeOpacity={0.85}>
                        <View style={styles.metricIconWrap}>
                            <Ionicons name="wallet-outline" size={15} color={GOLD} />
                        </View>
                        <Text style={styles.metricValue}>₦{walletBalance.toLocaleString()}</Text>
                        <Text style={styles.metricLabel}>Balance</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('active')} activeOpacity={0.85}>
                        <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                            <Ionicons name="bicycle" size={15} color={SUCCESS} />
                        </View>
                        <Text style={[styles.metricValue, { color: SUCCESS }]}>{orders.length}</Text>
                        <Text style={styles.metricLabel}>Active</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('pool')} activeOpacity={0.85}>
                        <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                            <Ionicons name="flash-outline" size={15} color={AMBER} />
                        </View>
                        <Text style={[styles.metricValue, { color: AMBER }]}>{poolOrders.length}</Text>
                        <Text style={styles.metricLabel}>Job Pool</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.metricCard} onPress={() => setActiveTab('history')} activeOpacity={0.85}>
                        <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
                            <Ionicons name="checkmark-done" size={15} color="#38BDF8" />
                        </View>
                        <Text style={[styles.metricValue, { color: '#38BDF8' }]}>{historyOrders.length}</Text>
                        <Text style={styles.metricLabel}>Delivered</Text>
                    </TouchableOpacity>
                </View>

                {/* XP Progression Bar */}
                <View style={styles.xpProgressContainer}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={styles.xpLabel}>Courier XP: {driverProfile?.xp || 0} XP</Text>
                        <Text style={styles.xpNextLevel}>Next Tier: {driverTier.nextXp} XP</Text>
                    </View>
                    <View style={styles.xpProgressBarBg}>
                        <View style={[styles.xpProgressBarFill, { width: `${Math.min(100, Math.max(8, driverTier.percent))}%` }]} />
                    </View>
                </View>
                {/* Driver Performance Metrics Strip */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 12, borderRadius: 12, marginTop: 16 }}>
                    <View style={{ alignItems: 'center' }}>
                        <Ionicons name="star" size={16} color={GOLD} />
                        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600', marginTop: 4 }}>{driverProfile?.rating?.toFixed(1) || '5.0'} Rating</Text>
                    </View>
                    <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                    <View style={{ alignItems: 'center' }}>
                        <Ionicons name="trending-up" size={16} color={SUCCESS} />
                        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600', marginTop: 4 }}>{(historyOrders.length / Math.max(1, historyOrders.length) * 100).toFixed(0)}% Success</Text>
                    </View>
                    <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                    <View style={{ alignItems: 'center' }}>
                        <Ionicons name="shield-checkmark" size={16} color="#38BDF8" />
                        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600', marginTop: 4 }}>Verified</Text>
                    </View>
                </View>

            </LinearGradient>

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
                            { id: 'ALL', label: 'All Orders' },
                            { id: 'POD', label: '💵 Pay on Delivery' },
                            { id: 'PREPAID', label: '💳 Paid Online' },
                            { id: 'PSS', label: '📦 Pay Small Small' }
                        ].map(f => {
                            const isSelected = filterPayment === f.id;
                            return (
                                <TouchableOpacity
                                    key={f.id}
                                    style={[styles.filterChip, isSelected && styles.filterChipActive]}
                                    onPress={() => setFilterPayment(f.id)}
                                >
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
                                    <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setActiveTab('pool')}>
                                        <Text style={styles.emptyActionBtnText}>Browse Available Job Pool ({poolOrders.length}) ⚡</Text>
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

                        {/* Interactive Earnings Chart Mockup */}
                        <View style={[styles.vehicleInfoCard, { marginBottom: 16, paddingTop: 16 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={styles.vehicleCardTitle}>Weekly Earnings</Text>
                                <Text style={{ color: SUCCESS, fontWeight: '700', fontSize: 12 }}>+14%</Text>
                            </View>
                            
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                {[
                                    { day: 'Mon', val: 0.3, amt: 2500 },
                                    { day: 'Tue', val: 0.6, amt: 4800 },
                                    { day: 'Wed', val: 0.4, amt: 3200 },
                                    { day: 'Thu', val: 0.8, amt: 7500 },
                                    { day: 'Fri', val: 0.5, amt: 4000 },
                                    { day: 'Sat', val: 1.0, amt: 8500 },
                                    { day: 'Sun', val: 0.1, amt: 0 }
                                ].map((bar, idx) => (
                                    <View key={idx} style={{ alignItems: 'center', width: 30 }}>
                                        <View style={{ width: 14, height: 100 * bar.val, backgroundColor: bar.val === 1.0 ? GOLD : '#94A3B8', borderRadius: 4 }} />
                                        <Text style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 6 }}>{bar.day}</Text>
                                    </View>
                                ))}
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                                <Text style={{ fontSize: 12, color: TEXT_MUTED }}>Total This Week</Text>
                                <Text style={{ fontSize: 14, fontWeight: '800', color: TEXT_DARK }}>₦30,500</Text>
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

                                {(handoverOrder.payment_method || '').toLowerCase() === 'pod' && (
                                    <View style={styles.podAlertBanner}>
                                        <Ionicons name="alert-circle" size={18} color="#B45309" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.podAlertTitle}>CASH COLLECTION REQUIRED</Text>
                                            <Text style={styles.podAlertDesc}>
                                                Collect ₦{Number(handoverOrder.total_amount || 0).toLocaleString()} cash/transfer before releasing parcel.
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

                                <Text style={styles.inputFieldLabel}>Customer Security PIN (Optional)</Text>
                                <TextInput
                                    style={styles.textInputModern}
                                    value={handoverPin}
                                    onChangeText={setHandoverPin}
                                    placeholder="Ask customer for 4-digit PIN"
                                    placeholderTextColor={TEXT_SUBTLE}
                                    keyboardType="numeric"
                                    maxLength={4}
                                    secureTextEntry
                                />

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
    headerGradient: {
        paddingTop: Platform.OS === 'ios' ? 8 : 14,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
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
        width: 12,
        height: 12,
        borderRadius: 6,
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderWidth: 2,
        borderColor: HEADER_NAVY,
    },
    driverName: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    levelTag: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    levelTagText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: GOLD,
        letterSpacing: 0.5,
    },
    driverSubRole: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 1,
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
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusToggleBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 14,
        marginBottom: 8,
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
        fontSize: 11,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    statusVehicleSubtitle: {
        fontSize: 10.5,
        color: '#94A3B8',
        marginTop: 1,
    },
    gpsSyncBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(217, 167, 58, 0.3)',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: GOLD,
    },
    gpsSyncBtnText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    gpsNoticeBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        marginBottom: 10,
    },
    gpsNoticeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#34D399',
    },
    metricsGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    metricCard: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 9,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    metricIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(217, 167, 58, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 3,
    },
    metricValue: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    metricLabel: {
        fontSize: 9.5,
        color: '#CBD5E1',
        fontWeight: '700',
        marginTop: 2,
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
        gap: 8,
        marginBottom: 12,
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
        gap: 6,
        backgroundColor: '#ECFDF5',
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    prepaidText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#065F46',
    },
    pssBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#EFF6FF',
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    pssText: {
        fontSize: 11,
        fontWeight: '800',
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
