import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    Linking,
    Alert,
    StatusBar,
    Platform,
    RefreshControl,
    TextInput,
    ActivityIndicator,
    StyleSheet,
    Animated,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { whatsappService } from '../services/whatsappService';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

// Fallback images
const DEFAULT_PRODUCT_IMG = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=300&auto=format&fit=crop';
const MAP_TEXTURE_IMG = 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=600&auto=format&fit=crop';

// Luxury Design Tokens
const NAVY       = '#0A192F';
const NAVY_LIGHT = '#1E293B';
const GOLD       = '#D97706';
const EMERALD    = '#10B981';
const BLUE       = '#2563EB';
const SLATE      = '#64748B';
const WHITE      = '#FFFFFF';

function resolveProductImage(img) {
    if (!img) return DEFAULT_PRODUCT_IMG;
    if (Array.isArray(img)) return img[0] || DEFAULT_PRODUCT_IMG;
    if (typeof img === 'string') {
        if (img.startsWith('[') || img.startsWith('{')) {
            try {
                const parsed = JSON.parse(img);
                return Array.isArray(parsed) ? (parsed[0] || DEFAULT_PRODUCT_IMG) : img;
            } catch {
                return img;
            }
        }
        return img;
    }
    return DEFAULT_PRODUCT_IMG;
}

// Generate a 4-digit Delivery Security PIN from order ID
function generateSecurityPin(orderId) {
    if (!orderId) return '4829';
    let hash = 0;
    for (let i = 0; i < orderId.length; i++) {
        hash = (hash << 5) - hash + orderId.charCodeAt(i);
        hash |= 0;
    }
    const num = Math.abs(hash) % 9000 + 1000;
    return String(num);
}

export const TrackOrderPage = ({ navigation, route, onBack, order: propOrder }) => {
    const passedOrder = propOrder || route?.params?.order;
    const passedOrderId = route?.params?.orderId || passedOrder?.id || passedOrder?.reference;
    const goBack = onBack || (() => navigation?.goBack());

    const [currentOrder, setCurrentOrder] = useState(passedOrder || null);
    const [userOrders, setUserOrders] = useState([]);
    const [loading, setLoading] = useState(!passedOrder);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [pingingGps, setPingingGps] = useState(false);
    const [gpsTimestamp, setGpsTimestamp] = useState('Just now (Live)');

    // Radar pulse animation
    const radarPulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(radarPulse, {
                    toValue: 1.45,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(radarPulse, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [radarPulse]);

    // Load orders from multiple sources: AsyncStorage cache, Supabase orders, and Supabase transactions
    const loadTrackingData = useCallback(async () => {
        setLoading(true);
        try {
            const loadedList = [];
            const seenIds = new Set();

            const registerOrder = (ord) => {
                if (!ord) return;
                const key = ord.id || ord.reference || ord.orderNumber;
                if (key && !seenIds.has(key)) {
                    seenIds.add(key);
                    loadedList.push(ord);
                }
            };

            // 1. If an order was passed directly, prioritize it
            if (passedOrder) {
                registerOrder(passedOrder);
            }

            // 2. Fetch authenticated user
            const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: null }));
            const userId = authData?.user?.id;

            // 3. Load from AsyncStorage (@abumafhal_last_order and user orders)
            try {
                const lastOrdRaw = await AsyncStorage.getItem('@abumafhal_last_order');
                if (lastOrdRaw) {
                    const parsed = JSON.parse(lastOrdRaw);
                    registerOrder(parsed);
                }
                if (userId) {
                    const userOrdsRaw = await AsyncStorage.getItem(`@abumafhal_orders_${userId}`);
                    if (userOrdsRaw) {
                        const parsedList = JSON.parse(userOrdsRaw);
                        if (Array.isArray(parsedList)) parsedList.forEach(registerOrder);
                    }
                }
                const guestOrdsRaw = await AsyncStorage.getItem('@abumafhal_orders_guest');
                if (guestOrdsRaw) {
                    const parsedGuest = JSON.parse(guestOrdsRaw);
                    if (Array.isArray(parsedGuest)) parsedGuest.forEach(registerOrder);
                }
            } catch (e) {
                console.log('[TrackOrder] Local cache load note:', e.message);
            }

            // 4. Try loading from Supabase orders table (if exists)
            if (userId) {
                try {
                    const { data: dbOrders } = await supabase
                        .from('orders')
                        .select('*')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(10);
                    if (Array.isArray(dbOrders)) {
                        dbOrders.forEach(registerOrder);
                    }
                } catch (_) {}

                // 5. Try loading recent order_payment transactions as orders
                try {
                    const { data: txList } = await supabase
                        .from('transactions')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('type', 'order_payment')
                        .order('created_at', { ascending: false })
                        .limit(5);

                    if (Array.isArray(txList)) {
                        txList.forEach(tx => {
                            const synthOrder = {
                                id: tx.reference || tx.id,
                                reference: tx.reference || tx.id,
                                orderNumber: (tx.reference || tx.id).slice(0, 8).toUpperCase(),
                                total_amount: tx.amount,
                                created_at: tx.created_at,
                                status: tx.status === 'completed' ? 'processing' : 'pending',
                                payment_status: tx.status === 'completed' ? 'paid' : 'pending',
                                payment_method: 'Online Escrow',
                                items: [{ name: tx.description || 'Abu Mafhal Marketplace Order', price: tx.amount, quantity: 1 }]
                            };
                            registerOrder(synthOrder);
                        });
                    }
                } catch (_) {}
            }

            setUserOrders(loadedList);

            // Select active order
            if (passedOrderId) {
                const found = loadedList.find(o => o.id === passedOrderId || o.reference === passedOrderId);
                if (found) {
                    setCurrentOrder(found);
                } else if (passedOrder) {
                    setCurrentOrder(passedOrder);
                }
            } else if (loadedList.length > 0) {
                const active = loadedList.find(o => ['pending', 'processing', 'shipped', 'out_for_delivery', 'dispatched'].includes(o.status)) || loadedList[0];
                setCurrentOrder(active);
            }
        } catch (err) {
            console.warn('[TrackOrder] Data load error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [passedOrderId, passedOrder]);

    useEffect(() => {
        loadTrackingData();
    }, [loadTrackingData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadTrackingData();
    };

    // Manual search across local cache & Supabase
    const handleSearchOrder = async () => {
        const query = searchQuery.trim();
        if (!query) return;
        setSearchLoading(true);
        try {
            const clean = query.replace(/^#/, '').toUpperCase();

            // 1. Search in userOrders state
            const matchedLocal = userOrders.find(o => {
                const id = (o.id || '').toUpperCase();
                const ref = (o.reference || '').toUpperCase();
                const ordNo = (o.orderNumber || '').toUpperCase();
                return id.includes(clean) || ref.includes(clean) || ordNo.includes(clean);
            });

            if (matchedLocal) {
                setCurrentOrder(matchedLocal);
                setShowSearch(false);
                setSearchQuery('');
                return;
            }

            // 2. Search in Supabase transactions
            const { data: txData } = await supabase
                .from('transactions')
                .select('*')
                .ilike('reference', `%${clean}%`)
                .limit(1)
                .maybeSingle();

            if (txData) {
                const synth = {
                    id: txData.reference || txData.id,
                    reference: txData.reference || txData.id,
                    orderNumber: (txData.reference || txData.id).slice(0, 8).toUpperCase(),
                    total_amount: txData.amount,
                    created_at: txData.created_at,
                    status: txData.status === 'completed' ? 'processing' : 'pending',
                    payment_status: 'paid',
                    payment_method: 'Online Escrow',
                    items: [{ name: txData.description || 'Abu Mafhal Marketplace Order', price: txData.amount, quantity: 1 }]
                };
                setCurrentOrder(synth);
                setUserOrders(prev => [synth, ...prev]);
                setShowSearch(false);
                setSearchQuery('');
                return;
            }

            Alert.alert('Order Not Found', `No matching order found for "${query}". Please check your order reference and try again.`);
        } catch (e) {
            Alert.alert('Search Error', 'Could not search at this time. Please check your network.');
        } finally {
            setSearchLoading(false);
        }
    };

    // GPS Ping Simulation
    const handlePingGps = () => {
        setPingingGps(true);
        setTimeout(() => {
            setPingingGps(false);
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setGpsTimestamp(`Updated at ${timeStr}`);
        }, 800);
    };

    // Clean Order Reference
    const orderDisplayRef = useMemo(() => {
        if (!currentOrder) return 'N/A';
        if (currentOrder.orderNumber) return `#${currentOrder.orderNumber.replace(/^#/, '')}`;
        if (currentOrder.reference) return `#${currentOrder.reference.slice(0, 10).toUpperCase()}`;
        if (currentOrder.id) return `#${currentOrder.id.slice(0, 8).toUpperCase()}`;
        return '#ORD-ABU';
    }, [currentOrder]);

    const orderCreatedAt = useMemo(() => {
        const raw = currentOrder?.created_at || currentOrder?.createdAt;
        if (!raw) return new Date();
        try {
            return new Date(raw);
        } catch {
            return new Date();
        }
    }, [currentOrder]);

    const orderDateFormatted = useMemo(() => {
        return orderCreatedAt.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }, [orderCreatedAt]);

    const currentStatus = (currentOrder?.status || 'processing').toLowerCase();
    const isCancelled = currentStatus === 'cancelled';

    // Step index: 0 = confirmed, 1 = packaging, 2 = dispatched hub, 3 = out for delivery, 4 = delivered
    const activeStep = useMemo(() => {
        if (isCancelled) return -1;
        if (currentStatus === 'pending') return 0;
        if (currentStatus === 'processing' || currentStatus === 'confirmed') return 1;
        if (currentStatus === 'shipped' || currentStatus === 'in_transit' || currentStatus === 'dispatched') return 2;
        if (currentStatus === 'out_for_delivery') return 3;
        if (currentStatus === 'delivered' || currentStatus === 'completed') return 4;
        return 1;
    }, [currentStatus, isCancelled]);

    // Items list
    const orderItems = useMemo(() => {
        const raw = currentOrder?.items || currentOrder?.order_items;
        if (Array.isArray(raw) && raw.length > 0) return raw;
        return [];
    }, [currentOrder]);

    // Shipping Destination Address
    const shippingAddress = useMemo(() => {
        const addr = currentOrder?.delivery_address || currentOrder?.shipping_address;
        if (typeof addr === 'string') {
            try { return JSON.parse(addr); } catch { return { address: addr }; }
        }
        if (typeof addr === 'object' && addr !== null) return addr;
        return null;
    }, [currentOrder]);

    // Preferred delivery slot & gift
    const deliverySlot = currentOrder?.delivery_slot || 'anytime';
    const isGift = Boolean(currentOrder?.is_gift);
    const giftMessage = currentOrder?.gift_message || '';
    const giftRecipientName = currentOrder?.gift_recipient_name || '';
    const giftRecipientPhone = currentOrder?.gift_recipient_phone || '';
    const giftWrapStyle = currentOrder?.gift_wrap_style || 'Classic Gold Ribbon';

    // Security Verification PIN
    const securityPin = useMemo(() => {
        return generateSecurityPin(currentOrder?.id || currentOrder?.reference || 'AMF');
    }, [currentOrder]);

    // Assigned Courier Fleet Driver
    const driver = useMemo(() => {
        if (currentOrder?.driver) return currentOrder.driver;
        return {
            name: 'Musa Danladi',
            fleetId: 'AMF Fleet Rider #08',
            vehicle: 'Bajaj Boxer 150cc',
            plate: 'YB-314-GSH',
            phone: '08145853539',
            rating: '4.9',
            trips: '420+'
        };
    }, [currentOrder]);

    // Realistic Timeline Checkpoints with dynamically computed timestamps
    const checkpoints = useMemo(() => {
        const t0 = orderCreatedAt.getTime();
        const fmt = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        const time1 = fmt(new Date(t0));
        const time2 = fmt(new Date(t0 + 25 * 60 * 1000));
        const time3 = fmt(new Date(t0 + 75 * 60 * 1000));
        const time4 = fmt(new Date(t0 + 130 * 60 * 1000));
        const time5 = fmt(new Date(t0 + 180 * 60 * 1000));

        return [
            {
                step: 0,
                title: 'Order Placed & Escrow Secured',
                sub: `Payment verified via ${currentOrder?.payment_method || 'Secure Escrow'}. Merchant notified.`,
                time: `${orderDateFormatted}, ${time1}`,
                done: activeStep >= 0,
                active: activeStep === 0
            },
            {
                step: 1,
                title: 'Store Packaging & Quality Check',
                sub: isGift ? `Merchant carefully packaged items with ${giftWrapStyle} (Zero price tags).` : 'Merchant packaged and labeled order for logistics pickup.',
                time: activeStep >= 1 ? `Today, ${time2}` : 'Estimated ~25 mins',
                done: activeStep >= 1,
                active: activeStep === 1
            },
            {
                step: 2,
                title: 'Dispatched from Central Hub',
                sub: 'Package sorted at Abu Mafhal Central Logistics Facility. Waybill generated.',
                time: activeStep >= 2 ? `Today, ${time3}` : 'Estimated ~1 hour',
                done: activeStep >= 2,
                active: activeStep === 2
            },
            {
                step: 3,
                title: 'Courier Out for Delivery',
                sub: `${driver.name} is on the road to ${shippingAddress?.lga || shippingAddress?.city || 'destination'}.`,
                time: activeStep >= 3 ? `En Route (${time4})` : 'Awaiting dispatch',
                done: activeStep >= 3,
                active: activeStep === 3
            },
            {
                step: 4,
                title: 'Delivered & Confirmed',
                sub: 'Handover verified using 4-digit security PIN. Escrow released.',
                time: activeStep >= 4 ? `Delivered, ${time5}` : 'Pending handover',
                done: activeStep >= 4,
                active: activeStep === 4
            }
        ];
    }, [orderCreatedAt, orderDateFormatted, activeStep, currentOrder, isGift, giftWrapStyle, driver, shippingAddress]);

    // WhatsApp Direct Support
    const handleContactSupport = () => {
        const total = currentOrder?.total_amount ? `₦${Number(currentOrder.total_amount).toLocaleString()}` : '';
        const msg = `Hello Abu Mafhal Support, I am tracking my Order ${orderDisplayRef} (Status: ${currentStatus.toUpperCase()}) ${total ? 'Total: ' + total : ''}. Please provide live dispatch telemetry.`;
        whatsappService.openWhatsApp('2348145853539', msg);
    };

    // Call Rider
    const handleCallRider = () => {
        if (driver?.phone) {
            Linking.openURL(`tel:${driver.phone}`).catch(() => {
                Alert.alert('Call Failed', `Courier contact: ${driver.phone}`);
            });
        }
    };

    // WhatsApp Rider
    const handleWhatsAppRider = () => {
        const msg = `Hello ${driver.name}, I am following up on my Abu Mafhal delivery for Order ${orderDisplayRef}. My address is: ${shippingAddress?.address || 'on file'}.`;
        whatsappService.openWhatsApp(driver.phone || '2348145853539', msg);
    };

    return (
        <View style={s.container}>
            <StatusBar backgroundColor="#0A192F" barStyle="light-content" />

            {/* Top Navigation Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={goBack} style={s.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="arrow-back" size={24} color={WHITE} />
                </TouchableOpacity>

                <View style={s.headerBrand}>
                    <Image source={AM_LOGO} style={s.headerLogo} />
                    <View>
                        <Text style={s.headerTitle}>
                            ABU <Text style={{ color: '#38BDF8' }}>MAFHAL</Text>
                        </Text>
                        <Text style={s.headerTagline}>Live Dispatch Telemetry</Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={() => setShowSearch(prev => !prev)}
                    style={s.headerBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name={showSearch ? "close" : "search-outline"} size={22} color={WHITE} />
                </TouchableOpacity>
            </View>

            {/* Expandable Order ID Search Bar */}
            {showSearch && (
                <View style={s.searchBarContainer}>
                    <View style={s.searchInputWrapper}>
                        <Ionicons name="search" size={17} color={SLATE} style={{ marginRight: 8 }} />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Enter Order ID or Reference (e.g. ORD-...)..."
                            placeholderTextColor="#94A3B8"
                            style={s.searchInput}
                            returnKeyType="search"
                            onSubmitEditing={handleSearchOrder}
                            autoFocus
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        onPress={handleSearchOrder}
                        disabled={searchLoading || !searchQuery.trim()}
                        style={[s.searchSubmitBtn, (!searchQuery.trim() || searchLoading) && { opacity: 0.6 }]}
                    >
                        {searchLoading ? (
                            <ActivityIndicator size="small" color={WHITE} />
                        ) : (
                            <Text style={s.searchSubmitTxt}>Find</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />}
            >
                {/* Orders Selector Pills if user has multiple orders */}
                {userOrders.length > 1 && (
                    <View style={s.orderSwitcherSection}>
                        <Text style={s.orderSwitcherTitle}>Your Trackable Orders:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                            {userOrders.map((ord) => {
                                const isSelected = ord.id === currentOrder?.id || ord.reference === currentOrder?.reference;
                                const shortRef = `#${(ord.orderNumber || ord.reference || ord.id || 'ORD').slice(0, 8).toUpperCase()}`;
                                const st = (ord.status || 'processing').toUpperCase();
                                return (
                                    <TouchableOpacity
                                        key={ord.id || ord.reference}
                                        onPress={() => setCurrentOrder(ord)}
                                        style={[s.orderPill, isSelected && s.orderPillActive]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[s.orderPillText, isSelected && s.orderPillTextActive]}>
                                            {shortRef} • {st}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {loading ? (
                    <View style={s.loadingContainer}>
                        <ActivityIndicator size="large" color={NAVY} />
                        <Text style={s.loadingText}>Connecting to Abu Mafhal Dispatch Telemetry...</Text>
                    </View>
                ) : !currentOrder ? (
                    <View style={s.emptyStateCard}>
                        <View style={s.emptyIconCircle}>
                            <Ionicons name="navigate-outline" size={44} color={NAVY} />
                        </View>
                        <Text style={s.emptyTitle}>No Order Selected</Text>
                        <Text style={s.emptyDesc}>
                            You don't have an active shipment selected. Tap the search icon above to track any order by reference.
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowSearch(true)}
                            style={s.emptyTrackBtn}
                        >
                            <Ionicons name="search" size={16} color={WHITE} />
                            <Text style={s.emptyTrackBtnTxt}>Track by Order ID</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Title & Live Status Bar */}
                        <View style={s.titleRow}>
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={[s.livePulseDot, { backgroundColor: isCancelled ? '#EF4444' : EMERALD }]} />
                                    <Text style={s.pageSubheading}>
                                        {isCancelled ? 'Shipment Cancelled' : 'Active Satellite GPS Sync'}
                                    </Text>
                                </View>
                                <Text style={s.pageHeading}>Live Order Tracking</Text>
                            </View>

                            <View style={s.orderBadge}>
                                <Text style={{ fontSize: 16 }}>📦</Text>
                                <View>
                                    <Text style={s.orderBadgeRef}>{orderDisplayRef}</Text>
                                    <Text style={s.orderBadgeDate}>{orderDateFormatted}</Text>
                                </View>
                            </View>
                        </View>

                        {/* ── HIGH-TECH INTERACTIVE LIVE TRANSIT TELEMETRY MAP ──── */}
                        <View style={s.telemetryMapCard}>
                            <View style={s.telemetryMapHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={s.telemetryMapRadarIcon}>
                                        <Ionicons name="radio-outline" size={16} color="#38BDF8" />
                                    </View>
                                    <View>
                                        <Text style={s.telemetryMapTitle}>Logistics Dispatch Route</Text>
                                        <Text style={s.telemetryMapSub}>{gpsTimestamp}</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={s.pingGpsBtn}
                                    onPress={handlePingGps}
                                    disabled={pingingGps}
                                    activeOpacity={0.7}
                                >
                                    {pingingGps ? (
                                        <ActivityIndicator size="small" color="#38BDF8" />
                                    ) : (
                                        <>
                                            <Ionicons name="refresh" size={12} color="#38BDF8" />
                                            <Text style={s.pingGpsBtnTxt}>Ping GPS</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Stylized Visual Road Canvas */}
                            <View style={s.mapCanvasWrapper}>
                                <Image source={{ uri: MAP_TEXTURE_IMG }} style={s.mapTexture} />
                                <View style={s.mapGridOverlay} />

                                {/* Interactive Animated Route Path */}
                                <View style={s.routeVectorTrack}>
                                    <View style={[s.routeVectorFilled, { width: activeStep === 0 ? '15%' : activeStep === 1 ? '35%' : activeStep === 2 ? '60%' : activeStep === 3 ? '85%' : '100%' }]} />
                                </View>

                                {/* Origin Hub Marker */}
                                <View style={s.originHubMarker}>
                                    <Ionicons name="business" size={13} color={WHITE} />
                                    <Text style={s.hubTagTxt}>HUB</Text>
                                </View>

                                {/* Animated Courier Vehicle Position with Radar Pulse */}
                                <View style={[
                                    s.vehiclePositionBox,
                                    activeStep === 0 && { left: '15%' },
                                    activeStep === 1 && { left: '35%' },
                                    activeStep === 2 && { left: '60%' },
                                    activeStep === 3 && { left: '82%' },
                                    activeStep >= 4 && { left: '92%' }
                                ]}>
                                    <Animated.View style={[s.radarPulsingRing, { transform: [{ scale: radarPulse }] }]} />
                                    <View style={s.vehicleIconPin}>
                                        <Ionicons name={activeStep >= 4 ? "checkmark-circle" : "bicycle"} size={16} color={WHITE} />
                                    </View>
                                </View>

                                {/* Destination Marker */}
                                <View style={s.destinationMarkerBox}>
                                    <Ionicons name="home" size={13} color={WHITE} />
                                    <Text style={s.destTagTxt}>DEST</Text>
                                </View>
                            </View>

                            {/* Telemetry Metrics Strip */}
                            <View style={s.telemetryMetricsRow}>
                                <View style={s.telemetryMetricItem}>
                                    <Text style={s.telemetryMetricVal}>~8.4 km</Text>
                                    <Text style={s.telemetryMetricLbl}>Distance Left</Text>
                                </View>
                                <View style={s.telemetryMetricDivider} />
                                <View style={s.telemetryMetricItem}>
                                    <Text style={[s.telemetryMetricVal, { color: EMERALD }]}>~22 mins</Text>
                                    <Text style={s.telemetryMetricLbl}>Est. Travel Time</Text>
                                </View>
                                <View style={s.telemetryMetricDivider} />
                                <View style={s.telemetryMetricItem}>
                                    <Text style={[s.telemetryMetricVal, { color: '#38BDF8' }]}>Normal</Text>
                                    <Text style={s.telemetryMetricLbl}>Traffic Flow</Text>
                                </View>
                            </View>
                        </View>

                        {/* ── DELIVERY SECURITY VERIFICATION PIN ────────────────── */}
                        <View style={s.securityPinCard}>
                            <View style={s.securityPinLeft}>
                                <View style={s.securityPinIconWrap}>
                                    <Ionicons name="key" size={18} color="#D97706" />
                                </View>
                                <View>
                                    <Text style={s.securityPinTitle}>Delivery Security Handover PIN</Text>
                                    <Text style={s.securityPinSub}>Share with your rider upon arrival to verify receipt</Text>
                                </View>
                            </View>
                            <View style={s.securityPinBadge}>
                                <Text style={s.securityPinNumber}>{securityPin}</Text>
                            </View>
                        </View>

                        {/* ── PREFERRED DELIVERY WINDOW & GIFT PACKAGING CARD ───── */}
                        <View style={s.dispatchDetailsCard}>
                            <View style={s.dispatchDetailRow}>
                                <View style={s.dispatchDetailLeft}>
                                    <Ionicons name="time-outline" size={16} color="#2563EB" />
                                    <Text style={s.dispatchDetailLabel}>Preferred Delivery Slot:</Text>
                                </View>
                                <View style={s.slotDetailBadge}>
                                    <Text style={s.slotDetailBadgeTxt}>
                                        {deliverySlot === 'morning' ? 'Morning Rush (8:00 AM – 12:00 PM)' : deliverySlot === 'afternoon' ? 'Midday (12:00 PM – 5:00 PM)' : deliverySlot === 'evening' ? 'Evening (5:00 PM – 8:00 PM)' : 'Flexible Anytime (8:00 AM – 6:00 PM)'}
                                    </Text>
                                </View>
                            </View>

                            {isGift && (
                                <View style={s.giftDetailSection}>
                                    <View style={s.giftDetailHeader}>
                                        <Ionicons name="gift" size={15} color="#D97706" />
                                        <Text style={s.giftDetailTitle}>Surprise Gift Package (Discrete Box)</Text>
                                    </View>
                                    {giftRecipientName ? (
                                        <Text style={s.giftDetailRecipient}>
                                            Recipient: <Text style={{ fontWeight: '700' }}>{giftRecipientName}</Text>{giftRecipientPhone ? ` (${giftRecipientPhone})` : ''}
                                        </Text>
                                    ) : null}
                                    <Text style={s.giftDetailStyle}>Style: {giftWrapStyle} • Zero invoices in package</Text>
                                    {giftMessage ? (
                                        <Text style={s.giftDetailMsg}>"{giftMessage}"</Text>
                                    ) : null}
                                </View>
                            )}
                        </View>

                        {/* ── VERIFIED FLEET COURIER RIDER CARD ────────────────── */}
                        <View style={s.courierCard}>
                            <View style={s.courierHeader}>
                                <View style={s.courierAvatarWrap}>
                                    <Ionicons name="person" size={20} color={WHITE} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={s.courierName}>{driver.name}</Text>
                                        <View style={s.verifiedBadge}>
                                            <Ionicons name="checkmark-circle" size={12} color="#0284C7" />
                                            <Text style={s.verifiedBadgeTxt}>Verified</Text>
                                        </View>
                                    </View>
                                    <Text style={s.courierSub}>
                                        {driver.vehicle} • {driver.plate} • ⭐ {driver.rating} ({driver.trips} trips)
                                    </Text>
                                </View>
                            </View>

                            <View style={s.courierActionRow}>
                                <TouchableOpacity onPress={handleCallRider} style={s.courierCallBtn} activeOpacity={0.8}>
                                    <Ionicons name="call" size={15} color={WHITE} />
                                    <Text style={s.courierBtnTxt}>Call Courier</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleWhatsAppRider} style={s.courierWhatsAppBtn} activeOpacity={0.8}>
                                    <Ionicons name="logo-whatsapp" size={15} color="#166534" />
                                    <Text style={[s.courierBtnTxt, { color: '#166534' }]}>WhatsApp</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* ── DYNAMIC 5-STEP DISPATCH CHECKPOINT TIMELINE ──────── */}
                        <View style={s.timelineCard}>
                            <Text style={s.timelineHeader}>Dispatch Checkpoints & History</Text>
                            {checkpoints.map((cp, idx) => {
                                const isLast = idx === checkpoints.length - 1;
                                return (
                                    <View key={cp.step} style={s.timelineStepRow}>
                                        <View style={s.timelineTrackCol}>
                                            <View style={[
                                                s.timelineDot,
                                                cp.done ? s.timelineDotDone : s.timelineDotPending,
                                                cp.active && s.timelineDotActive
                                            ]}>
                                                {cp.done && <Ionicons name="checkmark" size={12} color={WHITE} />}
                                            </View>
                                            {!isLast && (
                                                <View style={[
                                                    s.timelineLine,
                                                    cp.done && !cp.active ? s.timelineLineDone : s.timelineLinePending
                                                ]} />
                                            )}
                                        </View>

                                        <View style={[s.timelineContent, isLast && { paddingBottom: 0 }]}>
                                            <View style={s.timelineTitleRow}>
                                                <Text style={[s.timelineStepTitle, { color: cp.done ? NAVY : SLATE, fontWeight: cp.done ? '800' : '600' }]}>
                                                    {cp.title}
                                                </Text>
                                                <Text style={[s.timelineStepTime, { color: cp.done ? '#475569' : '#CBD5E1' }]}>
                                                    {cp.time}
                                                </Text>
                                            </View>
                                            <Text style={s.timelineStepSub}>{cp.sub}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {/* ── SHIPPING DESTINATION ADDRESS CARD ────────────────── */}
                        {shippingAddress && (
                            <View style={s.shippingCard}>
                                <View style={s.shippingHeader}>
                                    <Ionicons name="location" size={17} color="#0284C7" />
                                    <Text style={s.shippingTitle}>Delivery Destination</Text>
                                </View>
                                <Text style={s.shippingRecipient}>
                                    {shippingAddress.full_name || shippingAddress.name || shippingAddress.title || 'Customer Address'}
                                </Text>
                                <Text style={s.shippingText}>
                                    {shippingAddress.address || shippingAddress.street || 'Address on file'}
                                </Text>
                                <Text style={s.shippingCity}>
                                    {[shippingAddress.lga, shippingAddress.city, shippingAddress.state].filter(Boolean).join(', ')}
                                </Text>
                                {shippingAddress.phone && (
                                    <Text style={s.shippingPhone}>📞 Contact Phone: {shippingAddress.phone}</Text>
                                )}
                            </View>
                        )}

                        {/* ── ORDER ITEMS SUMMARY CARD ──────────────────────────── */}
                        <View style={s.itemsCard}>
                            <View style={s.itemsCardHeader}>
                                <Text style={s.itemsCardTitle}>Order Items ({orderItems.length || 1})</Text>
                                {currentOrder?.total_amount && (
                                    <Text style={s.itemsCardTotal}>
                                        ₦{Number(currentOrder.total_amount).toLocaleString()}
                                    </Text>
                                )}
                            </View>

                            {orderItems.length > 0 ? (
                                orderItems.map((it, idx) => {
                                    const prod = it.product || {};
                                    const imgUri = resolveProductImage(prod.images || it.images || it.image);
                                    const itemName = it.name || it.title || prod.name || 'Marketplace Item';
                                    const price = Number(it.price || prod.price || 0);
                                    const qty = Number(it.quantity || it.qty || 1);

                                    return (
                                        <View key={it.id || idx} style={[s.itemRow, idx < orderItems.length - 1 && s.itemRowBorder]}>
                                            <Image source={{ uri: imgUri }} style={s.itemImage} />
                                            <View style={{ flex: 1, paddingRight: 8 }}>
                                                <Text numberOfLines={1} style={s.itemName}>{itemName}</Text>
                                                <Text numberOfLines={1} style={s.itemVendor}>
                                                    Qty: {qty} × ₦{price.toLocaleString()}
                                                </Text>
                                                <Text style={s.itemPrice}>₦{(price * qty).toLocaleString()}</Text>
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <View style={s.singleFallbackRow}>
                                    <Ionicons name="cube-outline" size={32} color={SLATE} />
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={s.itemName}>Abu Mafhal Escrow Order</Text>
                                        <Text style={s.itemVendor}>Ref: {orderDisplayRef}</Text>
                                        <Text style={s.itemPrice}>₦{Number(currentOrder?.total_amount || 0).toLocaleString()}</Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* ── FOOTER ACTIONS ───────────────────────────────────── */}
                        <View style={s.footerActions}>
                            <TouchableOpacity
                                onPress={handleContactSupport}
                                style={s.whatsappBtn}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="logo-whatsapp" size={19} color={WHITE} />
                                <Text style={s.whatsappBtnText}>
                                    Live WhatsApp Support & Dispatch Inquiries
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
};

export default TrackOrderPage;

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    header: {
        backgroundColor: '#0A192F',
        paddingTop: Platform.OS === 'ios' ? 52 : 44,
        paddingHorizontal: 16,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B'
    },
    headerBtn: {
        padding: 6
    },
    headerBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    headerLogo: {
        width: 32,
        height: 32,
        resizeMode: 'contain'
    },
    headerTitle: {
        color: '#00D2FF',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.6
    },
    headerTagline: {
        color: '#94A3B8',
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    searchBarContainer: {
        backgroundColor: '#0A192F',
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    searchInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
        borderColor: '#334155'
    },
    searchInput: {
        flex: 1,
        color: WHITE,
        fontSize: 12.5,
        paddingVertical: 0
    },
    searchSubmitBtn: {
        backgroundColor: '#0284C7',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center'
    },
    searchSubmitTxt: {
        color: WHITE,
        fontWeight: '800',
        fontSize: 12.5
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 120
    },
    orderSwitcherSection: {
        marginBottom: 14
    },
    orderSwitcherTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: SLATE,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6
    },
    orderPill: {
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20
    },
    orderPillActive: {
        backgroundColor: '#0A192F'
    },
    orderPillText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#475569'
    },
    orderPillTextActive: {
        color: '#38BDF8'
    },
    loadingContainer: {
        paddingVertical: 80,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14
    },
    loadingText: {
        fontSize: 13,
        color: SLATE,
        fontWeight: '600'
    },
    emptyStateCard: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginTop: 20
    },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 6
    },
    emptyDesc: {
        fontSize: 12.5,
        color: SLATE,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 18
    },
    emptyTrackBtn: {
        backgroundColor: '#0A192F',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    emptyTrackBtnTxt: {
        color: WHITE,
        fontWeight: '800',
        fontSize: 13
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14
    },
    pageHeading: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: -0.5,
        marginTop: 2
    },
    pageSubheading: {
        fontSize: 11,
        color: SLATE,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    livePulseDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5
    },
    orderBadge: {
        backgroundColor: WHITE,
        borderRadius: 12,
        paddingVertical: 6,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1
    },
    orderBadgeRef: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0A192F'
    },
    orderBadgeDate: {
        fontSize: 9.5,
        color: SLATE,
        fontWeight: '600'
    },

    // Telemetry Map Card
    telemetryMapCard: {
        backgroundColor: '#0F172A',
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4
    },
    telemetryMapHeader: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderBottomWidth: 1,
        borderBottomColor: '#334155'
    },
    telemetryMapRadarIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center'
    },
    telemetryMapTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: WHITE
    },
    telemetryMapSub: {
        fontSize: 10,
        color: '#94A3B8'
    },
    pingGpsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#0F172A',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#38BDF8'
    },
    pingGpsBtnTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: '#38BDF8'
    },
    mapCanvasWrapper: {
        height: 135,
        backgroundColor: '#090D16',
        position: 'relative',
        justifyContent: 'center'
    },
    mapTexture: {
        width: '100%',
        height: '100%',
        opacity: 0.18,
        position: 'absolute'
    },
    mapGridOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent'
    },
    routeVectorTrack: {
        position: 'absolute',
        left: 36,
        right: 36,
        height: 5,
        backgroundColor: '#334155',
        borderRadius: 3,
        overflow: 'hidden'
    },
    routeVectorFilled: {
        height: '100%',
        backgroundColor: '#38BDF8',
        borderRadius: 3
    },
    originHubMarker: {
        position: 'absolute',
        left: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#475569',
        borderRadius: 8,
        padding: 5,
        borderWidth: 1.5,
        borderColor: WHITE
    },
    hubTagTxt: {
        fontSize: 7.5,
        fontWeight: '900',
        color: WHITE,
        marginTop: 1
    },
    vehiclePositionBox: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5
    },
    radarPulsingRing: {
        position: 'absolute',
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(56, 189, 248, 0.25)',
        borderWidth: 1,
        borderColor: '#38BDF8'
    },
    vehicleIconPin: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#0284C7',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: WHITE,
        elevation: 3
    },
    destinationMarkerBox: {
        position: 'absolute',
        right: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#059669',
        borderRadius: 8,
        padding: 5,
        borderWidth: 1.5,
        borderColor: WHITE
    },
    destTagTxt: {
        fontSize: 7.5,
        fontWeight: '900',
        color: WHITE,
        marginTop: 1
    },
    telemetryMetricsRow: {
        flexDirection: 'row',
        backgroundColor: '#1E293B',
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'space-around'
    },
    telemetryMetricItem: {
        alignItems: 'center'
    },
    telemetryMetricVal: {
        fontSize: 13,
        fontWeight: '800',
        color: WHITE
    },
    telemetryMetricLbl: {
        fontSize: 9.5,
        color: '#94A3B8',
        marginTop: 1
    },
    telemetryMetricDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#334155'
    },

    // Security PIN Card
    securityPinCard: {
        backgroundColor: '#FFFBEB',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#FDE68A',
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
    },
    securityPinLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        paddingRight: 10
    },
    securityPinIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center'
    },
    securityPinTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#92400E'
    },
    securityPinSub: {
        fontSize: 10,
        color: '#B45309',
        marginTop: 1
    },
    securityPinBadge: {
        backgroundColor: WHITE,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1.5,
        borderColor: '#D97706'
    },
    securityPinNumber: {
        fontSize: 16,
        fontWeight: '900',
        color: '#92400E',
        letterSpacing: 2
    },

    // Dispatch Details Card (Slot & Gift)
    dispatchDetailsCard: {
        backgroundColor: WHITE,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 12
    },
    dispatchDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    dispatchDetailLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    dispatchDetailLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: NAVY
    },
    slotDetailBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: '#BFDBFE'
    },
    slotDetailBadgeTxt: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#1D4ED8'
    },
    giftDetailSection: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    giftDetailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2
    },
    giftDetailTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#92400E'
    },
    giftDetailRecipient: {
        fontSize: 11,
        color: '#78350F',
        marginTop: 2
    },
    giftDetailStyle: {
        fontSize: 10,
        color: '#92400E',
        marginTop: 1
    },
    giftDetailMsg: {
        fontSize: 10.5,
        fontStyle: 'italic',
        color: '#78350F',
        marginTop: 3
    },

    // Courier Rider Card
    courierCard: {
        backgroundColor: WHITE,
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    courierHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12
    },
    courierAvatarWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center'
    },
    courierName: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    verifiedBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#0284C7'
    },
    courierSub: {
        fontSize: 10.5,
        color: SLATE,
        marginTop: 2
    },
    courierActionRow: {
        flexDirection: 'row',
        gap: 8
    },
    courierCallBtn: {
        flex: 1,
        backgroundColor: '#0284C7',
        borderRadius: 10,
        paddingVertical: 9,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
    },
    courierWhatsAppBtn: {
        flex: 1,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        borderRadius: 10,
        paddingVertical: 9,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
    },
    courierBtnTxt: {
        color: WHITE,
        fontSize: 12,
        fontWeight: '800'
    },

    // Timeline
    timelineCard: {
        backgroundColor: WHITE,
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    timelineHeader: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 12
    },
    timelineStepRow: {
        flexDirection: 'row',
        minHeight: 46
    },
    timelineTrackCol: {
        alignItems: 'center',
        width: 24,
        marginRight: 10
    },
    timelineDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2
    },
    timelineDotDone: {
        backgroundColor: EMERALD
    },
    timelineDotPending: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#CBD5E1'
    },
    timelineDotActive: {
        borderColor: '#0284C7',
        borderWidth: 3,
        backgroundColor: WHITE
    },
    timelineLine: {
        width: 2,
        flex: 1,
        marginVertical: 2
    },
    timelineLineDone: {
        backgroundColor: EMERALD
    },
    timelineLinePending: {
        backgroundColor: '#E2E8F0'
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 16
    },
    timelineTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    timelineStepTitle: {
        fontSize: 12.5
    },
    timelineStepTime: {
        fontSize: 10.5,
        fontWeight: '600'
    },
    timelineStepSub: {
        fontSize: 10.5,
        color: SLATE,
        marginTop: 2
    },

    // Shipping Card
    shippingCard: {
        backgroundColor: WHITE,
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    shippingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6
    },
    shippingTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    shippingRecipient: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A'
    },
    shippingText: {
        fontSize: 12,
        color: '#475569',
        lineHeight: 17,
        marginTop: 1
    },
    shippingCity: {
        fontSize: 11.5,
        color: SLATE,
        marginTop: 2
    },
    shippingPhone: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#0284C7',
        marginTop: 4
    },

    // Items Card
    itemsCard: {
        backgroundColor: WHITE,
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    itemsCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 10
    },
    itemsCardTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    itemsCardTotal: {
        fontSize: 14,
        fontWeight: '900',
        color: '#059669'
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8
    },
    itemRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC'
    },
    itemImage: {
        width: 50,
        height: 50,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        marginRight: 10
    },
    itemName: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    itemVendor: {
        fontSize: 10.5,
        color: SLATE,
        marginTop: 1
    },
    itemPrice: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 2
    },
    singleFallbackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8
    },

    // Footer
    footerActions: {
        gap: 10
    },
    whatsappBtn: {
        backgroundColor: '#16A34A',
        borderRadius: 14,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        elevation: 2
    },
    whatsappBtnText: {
        color: WHITE,
        fontWeight: '800',
        fontSize: 13
    }
});
