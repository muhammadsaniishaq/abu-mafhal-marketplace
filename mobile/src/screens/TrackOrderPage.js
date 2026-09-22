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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

// Fallback image
const DEFAULT_PRODUCT_IMG = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=300&auto=format&fit=crop';

// Luxury E-Commerce Palette
const NAVY       = '#0A192F';
const NAVY_DARK  = '#071224';
const NAVY_LIGHT = '#1E293B';
const GOLD       = '#D97706';
const EMERALD    = '#10B981';
const BLUE       = '#2563EB';
const SLATE      = '#64748B';
const SLATE_DARK = '#334155';
const BORDER_COL = '#E2E8F0';
const BG_PAGE    = '#F8FAFC';
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

// Generate consistent 4-digit Delivery Security PIN from order ID
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

export const TrackOrderPage = ({ navigation, route, onBack, order: propOrder, onNavigate }) => {
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
    const [copySuccess, setCopySuccess] = useState(false);

    // Soft pulse for live status dot
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 0.35,
                    duration: 900,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 900,
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseAnim]);

    // Load orders from authoritative sources: AsyncStorage cache & Supabase orders
    const loadTrackingData = useCallback(async () => {
        setLoading(true);
        try {
            const loadedList = [];
            const seenIds = new Set();

            const registerOrder = (ord) => {
                if (!ord) return;
                // Reject phantom transaction logs
                if (ord.source === 'supabase_transactions' || ord.source === 'transactions') return;
                const key = ord.id || ord.payment_reference || ord.reference || ord.orderNumber || ord.tracking_number;
                if (key && !seenIds.has(key)) {
                    seenIds.add(key);
                    loadedList.push(ord);
                }
            };

            // 1. If an order was passed directly, register first
            if (passedOrder) {
                registerOrder(passedOrder);
            }

            // 2. Fetch authenticated user
            const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: null }));
            const userId = authData?.user?.id;

            // 3. Load from AsyncStorage (authentic user orders)
            try {
                const lastOrdRaw = await AsyncStorage.getItem('@abumafhal_last_order');
                if (lastOrdRaw) {
                    const parsed = JSON.parse(lastOrdRaw);
                    if (parsed && parsed.source !== 'transactions' && parsed.source !== 'supabase_transactions') {
                        registerOrder(parsed);
                    }
                }
                if (userId) {
                    const userOrdsRaw = await AsyncStorage.getItem(`@abumafhal_orders_${userId}`);
                    if (userOrdsRaw) {
                        const parsedList = JSON.parse(userOrdsRaw);
                        if (Array.isArray(parsedList)) {
                            parsedList.filter(o => o && o.source !== 'transactions' && o.source !== 'supabase_transactions').forEach(registerOrder);
                        }
                    }
                }
            } catch (e) {
                console.log('[TrackOrder] Local cache load note:', e.message);
            }

            // 4. Load from Supabase orders table with driver and items joins
            try {
                if (userId) {
                    const { data: dbOrders, error: dbErr } = await supabase
                        .from('orders')
                        .select('*, driver:drivers(id, name, phone, vehicle_type, vehicle_number), order_items(*, product:products(name, images, price))')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(20);

                    if (!dbErr && Array.isArray(dbOrders) && dbOrders.length > 0) {
                        dbOrders.forEach(registerOrder);
                    }
                }
            } catch (e) {
                console.log('[TrackOrder] Supabase orders fetch note:', e.message);
            }

            setUserOrders(loadedList);

            // 5. Select active order (focus exclusively on the single tracked order)
            if (loadedList.length > 0) {
                if (passedOrderId) {
                    const found = loadedList.find(o =>
                        (o.id && o.id.toString().toLowerCase() === passedOrderId.toString().toLowerCase()) ||
                        (o.reference && o.reference.toString().toLowerCase() === passedOrderId.toString().toLowerCase()) ||
                        (o.payment_reference && o.payment_reference.toString().toLowerCase() === passedOrderId.toString().toLowerCase()) ||
                        (o.orderNumber && o.orderNumber.toString().toLowerCase() === passedOrderId.toString().toLowerCase()) ||
                        (o.tracking_number && o.tracking_number.toString().toLowerCase() === passedOrderId.toString().toLowerCase())
                    );
                    setCurrentOrder(found || loadedList[0]);
                } else if (!currentOrder) {
                    setCurrentOrder(loadedList[0]);
                }
            }
        } catch (err) {
            console.warn('[TrackOrder] Data load error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [passedOrder, passedOrderId, currentOrder]);

    useEffect(() => {
        loadTrackingData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadTrackingData();
    };

    // Search Handler for Order ID or Reference
    const handleSearchOrder = async () => {
        const query = searchQuery.trim();
        if (!query) return;

        setSearchLoading(true);
        try {
            // Check in memory list first
            const inMemory = userOrders.find(o =>
                (o.id && o.id.toString().toLowerCase().includes(query.toLowerCase())) ||
                (o.reference && o.reference.toString().toLowerCase().includes(query.toLowerCase())) ||
                (o.orderNumber && o.orderNumber.toString().toLowerCase().includes(query.toLowerCase()))
            );

            if (inMemory) {
                setCurrentOrder(inMemory);
                setShowSearch(false);
                setSearchQuery('');
                setSearchLoading(false);
                return;
            }

            // Check Supabase orders table
            try {
                const { data: ordData } = await supabase
                    .from('orders')
                    .select('*, driver:drivers(id, name, phone, vehicle_type, vehicle_number), order_items(*, product:products(name, images, price))')
                    .or(`id.eq.${query},payment_reference.ilike.%${query}%,tracking_number.ilike.%${query}%`)
                    .limit(1)
                    .maybeSingle();
                if (ordData) {
                    setCurrentOrder(ordData);
                    setUserOrders(prev => [ordData, ...prev.filter(o => o.id !== ordData.id)]);
                    setShowSearch(false);
                    setSearchQuery('');
                    setSearchLoading(false);
                    return;
                }
            } catch (_) {}

            Alert.alert(
                'Order Not Found',
                `No matching shipment was found for "${query}". Please check the ID or contact support.`,
                [{ text: 'OK' }]
            );
        } catch (e) {
            console.warn('Search order error:', e);
            Alert.alert('Search Error', 'Unable to look up order. Please check network.');
        } finally {
            setSearchLoading(false);
        }
    };

    // Derived Order Attributes
    const orderDisplayRef = useMemo(() => {
        if (!currentOrder) return '---';
        if (currentOrder.orderNumber) return `#${currentOrder.orderNumber.toUpperCase()}`;
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

    const orderTimeFormatted = useMemo(() => {
        return orderCreatedAt.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }, [orderCreatedAt]);

    const currentStatus = (currentOrder?.status || 'processing').toLowerCase();
    const isCancelled = currentStatus === 'cancelled';

    // Step index:
    // 0: Order Received
    // 1: Payment Confirmed & Escrow Secured
    // 2: Store Packaging & Quality Check
    // 3: Dispatched & Handed Over to Courier
    // 4: Out for Delivery
    // 5: Delivered & Confirmed
    const activeStep = useMemo(() => {
        if (isCancelled) return -1;
        if (currentStatus === 'pending') return 0;
        if (currentStatus === 'processing' || currentStatus === 'confirmed') return 2;
        if (currentStatus === 'shipped' || currentStatus === 'in_transit' || currentStatus === 'dispatched') return 3;
        if (currentStatus === 'out_for_delivery') return 4;
        if (currentStatus === 'delivered' || currentStatus === 'completed') return 5;
        return 2;
    }, [currentStatus, isCancelled]);

    // Live progress percentage calculation
    const statusProgress = useMemo(() => {
        if (isCancelled) return { pct: 0, label: 'Order Cancelled', color: '#EF4444' };
        switch (activeStep) {
            case 5: return { pct: 100, label: 'Delivered to Recipient', color: EMERALD };
            case 4: return { pct: 85, label: 'Out for Final Delivery', color: BLUE };
            case 3: return { pct: 60, label: 'In Transit between Hubs', color: BLUE };
            case 2: return { pct: 40, label: 'Package Packed & Dispatched', color: GOLD };
            case 1: return { pct: 25, label: 'Payment Confirmed', color: GOLD };
            default: return { pct: 15, label: 'Order Processing', color: GOLD };
        }
    }, [isCancelled, activeStep]);

    // Pay Small Small (BNPL) detection and ledger metrics
    const pssPlan = useMemo(() => {
        const raw = currentOrder?.installment_plan || currentOrder?.shipping_details?.installment_plan || currentOrder?.metadata?.installment_plan;
        if (!raw) return null;
        if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch (_) { return null; }
        }
        return raw;
    }, [currentOrder]);

    const isCurrentOrderPss = useMemo(() => {
        return !!(
            pssPlan ||
            (currentOrder?.payment_method && currentOrder?.payment_method.toLowerCase().includes('small')) ||
            (currentOrder?.payment_method && currentOrder?.payment_method.toLowerCase().includes('pss')) ||
            (currentOrder?.payment_status && currentOrder?.payment_status.toLowerCase().includes('pss')) ||
            (currentOrder?.payment_status && currentOrder?.payment_status.toLowerCase().includes('installment'))
        );
    }, [pssPlan, currentOrder]);

    const currentPssMetrics = useMemo(() => {
        if (!isCurrentOrderPss) return null;
        const total = Number(pssPlan?.totalAmount || currentOrder?.total_amount || 0);
        const paid = Number(pssPlan?.paidAmount || (currentOrder?.payment_status === 'paid' ? total : (currentOrder?.subtotal || Math.round(total * 0.25))));
        const remaining = Math.max(0, Number(pssPlan?.remainingAmount ?? (total - paid)));
        const schedule = Array.isArray(pssPlan?.schedule) ? pssPlan.schedule : [];
        const nextPending = schedule.find(s => s.status !== 'paid');
        const now = new Date();
        const dueDate = nextPending?.due_date ? new Date(nextPending.due_date) : null;
        const isOverdue = dueDate ? dueDate < now : false;
        const daysRemaining = dueDate ? Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)) : null;
        const count = pssPlan?.installmentsCount || schedule.length || 4;
        const paidCount = pssPlan?.installmentsPaid || schedule.filter(s => s.status === 'paid').length || (paid >= total ? count : 1);
        const isFullyPaid = remaining <= 0 || paidCount >= count;

        return {
            total,
            paid,
            remaining,
            count,
            paidCount,
            isFullyPaid,
            nextAmount: nextPending?.amount || (remaining > 0 ? Math.round(remaining / Math.max(1, count - paidCount)) : 0),
            dueDate,
            dateStr: dueDate ? dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
            isOverdue,
            daysRemaining,
            frequency: pssPlan?.frequency || 'Monthly'
        };
    }, [isCurrentOrderPss, pssPlan, currentOrder]);

    const handleGoToPaySmallSmall = () => {
        if (navigation?.navigate) {
            navigation.navigate('PaySmallSmall', { orderId: currentOrder?.id });
        } else if (onNavigate) {
            onNavigate('PaySmallSmall', { orderId: currentOrder?.id });
        }
    };

    const handleShareTrackingWhatsApp = () => {
        const ref = orderDisplayRef;
        const statusTxt = statusProgress.label.toUpperCase();
        const msg = `📦 *Abu Mafhal Shipment Tracking*\nOrder: *${ref}*\nStatus: *${statusTxt}*\nCurrent Location: *${currentOrder?.current_location || 'Central Sorting Hub'}*\nEstimated Delivery: *${estimatedDeliveryText}*\n\nTrack Live: https://abumafhal.com/orders?id=${currentOrder?.id || currentOrder?.reference}`;
        whatsappService.openWhatsApp('', msg);
    };

    // Items list (reliable fallback across Supabase order_items and local/cart items)
    const orderItems = useMemo(() => {
        if (Array.isArray(currentOrder?.order_items) && currentOrder.order_items.length > 0) {
            return currentOrder.order_items;
        }
        if (Array.isArray(currentOrder?.items) && currentOrder.items.length > 0) {
            return currentOrder.items;
        }
        return [];
    }, [currentOrder]);

    // Financial calculations
    const itemsSubtotal = useMemo(() => {
        if (orderItems.length === 0) return 0;
        return orderItems.reduce((sum, itm) => {
            const prod = itm.product || {};
            const p = parseFloat(itm.price || prod.price || 0) || 0;
            const q = parseInt(itm.quantity || itm.qty || 1, 10) || 1;
            return sum + (p * q);
        }, 0);
    }, [orderItems]);

    const totalAmount = parseFloat(currentOrder?.total_amount || 0) || 0;
    const shippingFee = parseFloat(currentOrder?.shipping_fee || 0) || 0;
    const discountApplied = parseFloat(currentOrder?.discount_applied || 0) || 0;
    const displaySubtotal = itemsSubtotal > 0 ? itemsSubtotal : Math.max(0, totalAmount - shippingFee + discountApplied);

    // Shipping Destination Address
    const shippingAddress = useMemo(() => {
        const addr = currentOrder?.delivery_address || currentOrder?.shipping_address;
        if (typeof addr === 'string') {
            try { return JSON.parse(addr); } catch { return { address: addr }; }
        }
        if (typeof addr === 'object' && addr !== null) return addr;
        return null;
    }, [currentOrder]);

    // Delivery Slot & Gift
    const deliverySlot = currentOrder?.delivery_slot || 'anytime';
    const isGift = Boolean(currentOrder?.is_gift);
    const giftMessage = currentOrder?.gift_message || '';
    const giftRecipientName = currentOrder?.gift_recipient_name || '';
    const giftRecipientPhone = currentOrder?.gift_recipient_phone || '';
    const giftWrapStyle = currentOrder?.gift_wrap_style || 'Classic Gold Ribbon';

    // Delivery Security PIN
    const securityPin = useMemo(() => {
        return generateSecurityPin(currentOrder?.id || currentOrder?.reference || 'AMF');
    }, [currentOrder]);

    // Real Estimated Delivery Date Window
    const estimatedDeliveryText = useMemo(() => {
        if (currentStatus === 'delivered' || currentStatus === 'completed') {
            return `Delivered on ${orderDateFormatted}`;
        }
        if (isCancelled) {
            return 'Order Cancelled';
        }
        const estDate = new Date(orderCreatedAt.getTime() + 24 * 60 * 60 * 1000);
        const estStr = estDate.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });

        let slotStr = 'Flexible (8:00 AM – 6:00 PM)';
        if (deliverySlot === 'morning') slotStr = 'Morning (8:00 AM – 12:00 PM)';
        if (deliverySlot === 'afternoon') slotStr = 'Afternoon (12:00 PM – 5:00 PM)';
        if (deliverySlot === 'evening') slotStr = 'Evening (5:00 PM – 8:00 PM)';

        return `Expected: ${estStr} • ${slotStr}`;
    }, [currentStatus, isCancelled, orderDateFormatted, orderCreatedAt, deliverySlot]);

    // Realistic Timeline Steps
    const timelineSteps = useMemo(() => {
        const t0 = orderCreatedAt.getTime();
        const fmtTime = (mins) => {
            const d = new Date(t0 + mins * 60 * 1000);
            return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        };

        return [
            {
                step: 0,
                title: 'Order Placed',
                sub: 'Order created and details logged into Abu Mafhal marketplace system.',
                timestamp: `${orderDateFormatted}, ${orderTimeFormatted}`,
                icon: 'document-text-outline',
                done: activeStep >= 0,
                active: activeStep === 0
            },
            {
                step: 1,
                title: 'Payment & Escrow Verified',
                sub: `Protected by Abu Mafhal Escrow (${currentOrder?.payment_method || 'Verified Payment'}). Funds safely secured until delivery.`,
                timestamp: activeStep >= 1 ? `${orderDateFormatted}, ${fmtTime(2)}` : 'Pending Verification',
                icon: 'shield-checkmark-outline',
                done: activeStep >= 1,
                active: activeStep === 1
            },
            {
                step: 2,
                title: 'Store Packaging & Quality Check',
                sub: isGift ? `Vendor carefully packaging items with ${giftWrapStyle} (No invoice/price tags).` : 'Merchant is packaging your items and preparing logistics waybill.',
                timestamp: activeStep >= 2 ? `Processing (${fmtTime(20)})` : 'Scheduled',
                icon: 'cube-outline',
                done: activeStep >= 2,
                active: activeStep === 2
            },
            {
                step: 3,
                title: 'Dispatched to Logistics Hub',
                sub: 'Package sorted and handed over to Abu Mafhal Express delivery fleet.',
                timestamp: activeStep >= 3 ? fmtTime(60) : 'Next in line',
                icon: 'git-network-outline',
                done: activeStep >= 3,
                active: activeStep === 3
            },
            {
                step: 4,
                title: 'Courier Out for Delivery',
                sub: `Courier rider is en route to ${shippingAddress?.lga || shippingAddress?.city || 'your destination'}.`,
                timestamp: activeStep >= 4 ? fmtTime(110) : 'Awaiting arrival',
                icon: 'bicycle-outline',
                done: activeStep >= 4,
                active: activeStep === 4
            },
            {
                step: 5,
                title: 'Delivered & Handover Confirmed',
                sub: 'Package received, inspected, and verified with 4-digit security PIN.',
                timestamp: activeStep >= 5 ? `${orderDateFormatted}, ${fmtTime(150)}` : 'Final Handover',
                icon: 'checkmark-done-circle-outline',
                done: activeStep >= 5,
                active: activeStep === 5
            }
        ];
    }, [orderCreatedAt, orderDateFormatted, orderTimeFormatted, activeStep, currentOrder, isGift, giftWrapStyle, shippingAddress]);

    // Copy Order ID
    const handleCopyRef = () => {
        const clean = (currentOrder?.reference || currentOrder?.id || '').slice(0, 12).toUpperCase();
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(clean);
            }
        } catch (_) {}
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // Direct WhatsApp Support
    const handleWhatsAppSupport = () => {
        const total = currentOrder?.total_amount ? `₦${Number(currentOrder.total_amount).toLocaleString()}` : '';
        const msg = `Hello Abu Mafhal Support, I am tracking my Order ${orderDisplayRef} (Status: ${currentStatus.toUpperCase()}) ${total ? 'Total: ' + total : ''}. Please provide live dispatch status.`;
        whatsappService.openWhatsApp('2348145853539', msg);
    };

    // View Invoice Screen
    const handleOpenInvoice = () => {
        if (!currentOrder) return;
        navigation?.navigate('Invoice', { order: currentOrder });
    };

    return (
        <View style={s.container}>
            <StatusBar backgroundColor={NAVY} barStyle="light-content" />

            {/* ── TOP APP BAR ────────────────────────────────────────────── */}
            <View style={s.header}>
                <TouchableOpacity onPress={goBack} style={s.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="arrow-back" size={24} color={WHITE} />
                </TouchableOpacity>

                <View style={s.headerCenter}>
                    <Text style={s.headerTitle}>Order Tracking</Text>
                    <Text style={s.headerSubtitle}>Live Status & Delivery Telemetry</Text>
                </View>

                <TouchableOpacity
                    onPress={() => setShowSearch(prev => !prev)}
                    style={s.headerBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name={showSearch ? "close" : "search-outline"} size={22} color={WHITE} />
                </TouchableOpacity>
            </View>

            {/* ── EXPANDABLE SEARCH BAR ─────────────────────────────────── */}
            {showSearch && (
                <View style={s.searchBarContainer}>
                    <View style={s.searchInputWrapper}>
                        <Ionicons name="search" size={17} color={SLATE} style={{ marginRight: 8 }} />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Enter Order ID or Reference..."
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
                {loading ? (
                    <View style={s.loadingBox}>
                        <ActivityIndicator size="large" color={BLUE} />
                        <Text style={s.loadingTxt}>Fetching real-time shipment updates...</Text>
                    </View>
                ) : !currentOrder ? (
                    <View style={s.emptyCard}>
                        <View style={s.emptyIconWrap}>
                            <Ionicons name="cube-outline" size={48} color={BLUE} />
                        </View>
                        <Text style={s.emptyTitle}>No Order to Track</Text>
                        <Text style={s.emptyDesc}>
                            You don't have an active shipment selected yet. Use the search bar above with your Order Reference to start tracking.
                        </Text>
                        <TouchableOpacity onPress={() => setShowSearch(true)} style={s.emptyBtn} activeOpacity={0.8}>
                            <Ionicons name="search" size={16} color={WHITE} />
                            <Text style={s.emptyBtnTxt}>Search by Order ID</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* ── LIVE PROGRESS TELEMETRY BAR (0% - 100%) ────────── */}
                        <View style={s.progressBarCard}>
                            <View style={s.progressBarHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                    <Animated.View style={[s.liveBeaconDot, { opacity: pulseAnim, backgroundColor: statusProgress.color }]} />
                                    <Text style={s.progressBarStageLabel}>
                                        {statusProgress.label.toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={[s.progressBarPctText, { color: statusProgress.color }]}>
                                    {statusProgress.pct}%
                                </Text>
                            </View>
                            <View style={s.progressBarTrack}>
                                <View style={[s.progressBarFill, { width: `${statusProgress.pct}%`, backgroundColor: statusProgress.color }]} />
                            </View>
                            <View style={s.progressBarStagesRow}>
                                <Text style={[s.stageTick, activeStep >= 0 && s.stageTickActive]}>Placed</Text>
                                <Text style={[s.stageTick, activeStep >= 2 && s.stageTickActive]}>Packed</Text>
                                <Text style={[s.stageTick, activeStep >= 3 && s.stageTickActive]}>In Transit</Text>
                                <Text style={[s.stageTick, activeStep >= 4 && s.stageTickActive]}>Out</Text>
                                <Text style={[s.stageTick, activeStep >= 5 && s.stageTickActive]}>Delivered</Text>
                            </View>
                        </View>

                        {/* ── PAY SMALL SMALL (BNPL) INSTALLMENT BREAKDOWN ──── */}
                        {isCurrentOrderPss && currentPssMetrics && (
                            <View style={s.bnplCard}>
                                <View style={s.bnplHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                        <Ionicons name="flash" size={17} color={GOLD} />
                                        <Text style={s.bnplTitle}>Pay Small Small • 0% Interest BNPL</Text>
                                    </View>
                                    <View style={[
                                        s.bnplBadge,
                                        currentPssMetrics.isFullyPaid ? s.bnplBadgePaid : currentPssMetrics.isOverdue ? s.bnplBadgeOverdue : s.bnplBadgeActive
                                    ]}>
                                        <Text style={[
                                            s.bnplBadgeTxt,
                                            currentPssMetrics.isFullyPaid ? { color: EMERALD } : currentPssMetrics.isOverdue ? { color: '#EF4444' } : { color: GOLD }
                                        ]}>
                                            {currentPssMetrics.isFullyPaid ? 'SETTLED' : currentPssMetrics.isOverdue ? 'OVERDUE' : 'ACTIVE PLAN'}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={s.bnplSub}>
                                    Installment plan: <Text style={{ fontWeight: '800', color: WHITE }}>{currentPssMetrics.paidCount} of {currentPssMetrics.count} installments paid</Text>
                                </Text>

                                {/* BNPL Progress Bar */}
                                <View style={s.bnplProgressTrack}>
                                    <View style={[s.bnplProgressFill, {
                                        width: `${Math.min(100, Math.round((currentPssMetrics.paid / Math.max(1, currentPssMetrics.total)) * 100))}%`,
                                        backgroundColor: currentPssMetrics.isFullyPaid ? EMERALD : GOLD
                                    }]} />
                                </View>

                                <View style={s.bnplMetricsRow}>
                                    <View style={s.bnplMetricCol}>
                                        <Text style={s.bnplMetricLbl}>Total Value</Text>
                                        <Text style={s.bnplMetricVal}>₦{currentPssMetrics.total.toLocaleString()}</Text>
                                    </View>
                                    <View style={s.bnplMetricDivider} />
                                    <View style={s.bnplMetricCol}>
                                        <Text style={s.bnplMetricLbl}>Deposit Paid</Text>
                                        <Text style={[s.bnplMetricVal, { color: EMERALD }]}>₦{currentPssMetrics.paid.toLocaleString()}</Text>
                                    </View>
                                    <View style={s.bnplMetricDivider} />
                                    <View style={s.bnplMetricCol}>
                                        <Text style={s.bnplMetricLbl}>Balance Due</Text>
                                        <Text style={[s.bnplMetricVal, { color: '#F87171' }]}>₦{currentPssMetrics.remaining.toLocaleString()}</Text>
                                    </View>
                                </View>

                                {!currentPssMetrics.isFullyPaid && (
                                    <View style={s.bnplDueActionBox}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.bnplDueLbl}>
                                                {currentPssMetrics.isOverdue ? '⚠️ Overdue Installment:' : 'Next Installment Due:'}
                                            </Text>
                                            <Text style={[s.bnplDueVal, currentPssMetrics.isOverdue && { color: '#EF4444' }]}>
                                                ₦{currentPssMetrics.nextAmount.toLocaleString()}
                                                {currentPssMetrics.dateStr ? ` • ${currentPssMetrics.dateStr}` : ''}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={handleGoToPaySmallSmall}
                                            style={s.bnplActionBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="card-outline" size={14} color={WHITE} />
                                            <Text style={s.bnplActionBtnTxt}>Pay Next →</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ── HERO STATUS CARD (CLEAN & PROFESSIONAL) ──────── */}
                        <View style={s.statusCard}>
                            {/* Order Ref & Copy Row */}
                            <View style={s.refHeaderRow}>
                                <View style={s.refLeftCol}>
                                    <Text style={s.refLabel}>ORDER REFERENCE</Text>
                                    <View style={s.refValRow}>
                                        <Text style={s.refValText}>{orderDisplayRef}</Text>
                                        <TouchableOpacity
                                            style={s.copyPill}
                                            onPress={handleCopyRef}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons
                                                name={copySuccess ? "checkmark" : "copy-outline"}
                                                size={13}
                                                color={copySuccess ? EMERALD : BLUE}
                                            />
                                            <Text style={[s.copyPillTxt, copySuccess && { color: EMERALD }]}>
                                                {copySuccess ? "Copied" : "Copy"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Live Pulse Status Badge */}
                                <View style={[
                                    s.statusBadgePill,
                                    isCancelled ? s.statusBadgeCancelled : activeStep >= 5 ? s.statusBadgeDelivered : s.statusBadgeActive
                                ]}>
                                    <Animated.View style={[
                                        s.statusDot,
                                        { opacity: isCancelled ? 1 : pulseAnim },
                                        isCancelled ? { backgroundColor: '#EF4444' } : activeStep >= 5 ? { backgroundColor: EMERALD } : { backgroundColor: BLUE }
                                    ]} />
                                    <Text style={[
                                        s.statusBadgeText,
                                        isCancelled ? { color: '#B91C1C' } : activeStep >= 5 ? { color: '#047857' } : { color: '#1D4ED8' }
                                    ]}>
                                        {isCancelled ? 'CANCELLED' : activeStep >= 5 ? 'DELIVERED' : activeStep >= 4 ? 'OUT FOR DELIVERY' : activeStep >= 3 ? 'IN TRANSIT' : 'PROCESSING'}
                                    </Text>
                                </View>
                            </View>

                            {/* Estimated Delivery Window Strip */}
                            <View style={s.etaBanner}>
                                <Ionicons name="calendar-outline" size={16} color={BLUE} />
                                <Text style={s.etaBannerTxt}>{estimatedDeliveryText}</Text>
                            </View>

                            {/* Payment & Security Snapshot */}
                            <View style={s.snapshotRow}>
                                <View style={s.snapshotItem}>
                                    <Text style={s.snapshotLbl}>Placed Date</Text>
                                    <Text style={s.snapshotVal}>{orderDateFormatted}</Text>
                                </View>
                                <View style={s.snapshotDivider} />
                                <View style={s.snapshotItem}>
                                    <Text style={s.snapshotLbl}>Payment Method</Text>
                                    <Text style={s.snapshotVal} numberOfLines={1}>{currentOrder?.payment_method || 'Escrow Verified'}</Text>
                                </View>
                                <View style={s.snapshotDivider} />
                                <View style={s.snapshotItem}>
                                    <Text style={s.snapshotLbl}>{isCurrentOrderPss ? 'Deposit Paid' : 'Amount Total'}</Text>
                                    <Text style={[s.snapshotVal, { color: EMERALD, fontWeight: '900' }]}>
                                        ₦{Number(isCurrentOrderPss && currentPssMetrics ? currentPssMetrics.paid : (currentOrder?.total_amount || 0)).toLocaleString()}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* ── DELIVERY SECURITY HANDOVER PIN CARD ──────────── */}
                        <View style={s.securityPinCard}>
                            <View style={s.securityPinLeft}>
                                <View style={s.securityPinIconBox}>
                                    <Ionicons name="key" size={20} color={GOLD} />
                                </View>
                                <View style={s.securityPinTextBox}>
                                    <Text style={s.securityPinTitle}>Delivery Security Handover PIN</Text>
                                    <Text style={s.securityPinSub}>
                                        Give this 4-digit code to your courier rider only after inspecting your package.
                                    </Text>
                                </View>
                            </View>
                            <View style={s.securityPinRightCol}>
                                <View style={s.securityPinBadge}>
                                    <Text style={s.securityPinDigits}>{securityPin}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                                            navigator.clipboard.writeText(securityPin);
                                            Alert.alert('PIN Copied', `Security PIN #${securityPin} copied to clipboard.`);
                                        } else {
                                            Alert.alert('Security PIN', `Your package handover PIN is ${securityPin}`);
                                        }
                                    }}
                                    style={s.copyPinBtn}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="copy-outline" size={11} color={NAVY} />
                                    <Text style={s.copyPinBtnTxt}>Copy PIN</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* ── PREFERRED DELIVERY WINDOW & GIFT PACKAGING ──── */}
                        {(deliverySlot !== 'anytime' || isGift) && (
                            <View style={s.prefCard}>
                                <View style={s.prefHeaderRow}>
                                    <Ionicons name="options-outline" size={16} color={NAVY} />
                                    <Text style={s.prefHeaderTitle}>Dispatch & Delivery Options</Text>
                                </View>

                                {deliverySlot !== 'anytime' && (
                                    <View style={s.prefItemRow}>
                                        <Text style={s.prefItemLbl}>Delivery Slot:</Text>
                                        <View style={s.prefBadgeBlue}>
                                            <Ionicons name="time-outline" size={13} color={BLUE} />
                                            <Text style={s.prefBadgeBlueTxt}>
                                                {deliverySlot === 'morning' ? 'Morning Rush (8:00 AM – 12:00 PM)' : deliverySlot === 'afternoon' ? 'Midday (12:00 PM – 5:00 PM)' : deliverySlot === 'evening' ? 'Evening (5:00 PM – 8:00 PM)' : 'Flexible Delivery'}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                {isGift && (
                                    <View style={s.giftBoxWrapper}>
                                        <View style={s.giftHeader}>
                                            <Ionicons name="gift" size={16} color={GOLD} />
                                            <Text style={s.giftTitle}>Surprise Gift Package 🎁</Text>
                                        </View>
                                        <Text style={s.giftSub}>
                                            Recipient: <Text style={{ fontWeight: '800', color: NAVY }}>{giftRecipientName || 'Gift Recipient'}</Text>
                                            {giftRecipientPhone ? ` • ${giftRecipientPhone}` : ''}
                                        </Text>
                                        <Text style={s.giftPackagingNotice}>
                                            Package Style: <Text style={{ fontWeight: '700' }}>{giftWrapStyle}</Text> • Discreet packaging with zero invoice/price tags attached.
                                        </Text>
                                        {giftMessage ? (
                                            <View style={s.giftMsgBox}>
                                                <Text style={s.giftMsgQuote}>"{giftMessage}"</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ── LIVE STANDING STATION (CURRENT SHIPMENT CHECKPOINT) ── */}
                        <View style={s.liveStationCard}>
                            <View style={s.liveStationHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                    <View style={s.pulseCircleOuter}>
                                        <Animated.View style={[s.pulseCircleInner, { opacity: pulseAnim }]} />
                                        <Ionicons name="location-sharp" size={17} color="#10B981" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.liveStationLabel}>CURRENT SHIPMENT CHECKPOINT</Text>
                                        <Text style={s.liveStationName} numberOfLines={2}>
                                            {currentOrder?.current_location || (activeStep >= 5 ? 'Delivered to Destination' : activeStep >= 4 ? 'Out for Final Delivery' : activeStep >= 3 ? 'Central Logistics Hub → Regional Route' : 'Central Fulfillment & Sorting Facility')}
                                        </Text>
                                    </View>
                                </View>
                                <View style={s.liveStationBadge}>
                                    <Text style={s.liveStationBadgeTxt}>LIVE</Text>
                                </View>
                            </View>

                            {/* Route Stations Visualizer */}
                            <View style={s.stationTrackBox}>
                                {[
                                    { id: 'origin', title: 'Merchant Hub', done: activeStep >= 0, icon: 'business-outline' },
                                    { id: 'transit', title: 'In Transit', done: activeStep >= 3, icon: 'swap-horizontal-outline' },
                                    { id: 'station', title: 'Local Hub', done: activeStep >= 4, icon: 'storefront-outline' },
                                    { id: 'dest', title: 'Delivered', done: activeStep >= 5, icon: 'home-outline' },
                                ].map((st, i) => (
                                    <React.Fragment key={st.id}>
                                        <View style={{ alignItems: 'center', minWidth: 55 }}>
                                            <View style={[s.stationNode, st.done && s.stationNodeDone]}>
                                                <Ionicons name={st.done ? 'checkmark' : st.icon} size={11} color={st.done ? WHITE : SLATE} />
                                            </View>
                                            <Text style={[s.stationNodeTxt, st.done && s.stationNodeTxtDone]}>{st.title}</Text>
                                        </View>
                                        {i < 3 && (
                                            <View style={[s.stationTrackLine, activeStep >= (i === 0 ? 3 : i === 1 ? 4 : 5) && s.stationTrackLineDone]} />
                                        )}
                                    </React.Fragment>
                                ))}
                            </View>

                            {/* Driver Card Row if assigned or in transit */}
                            {(currentOrder?.driver || activeStep >= 3) && (
                                <View style={s.driverCardBox}>
                                    <View style={s.driverAvatar}>
                                        <Ionicons name="person" size={18} color={NAVY} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={s.driverName}>
                                            {currentOrder?.driver?.name || 'Abu Mafhal Express Dispatch'}
                                        </Text>
                                        <Text style={s.driverVehicle}>
                                            {currentOrder?.driver?.vehicle_type || 'Express Dispatch Courier'}{currentOrder?.driver?.vehicle_number ? ` • ${currentOrder.driver.vehicle_number}` : ''}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        <TouchableOpacity
                                            onPress={() => Linking.openURL(`tel:${currentOrder?.driver?.phone || currentOrder?.contact_phone || '08000000000'}`)}
                                            style={s.driverCallBtn}
                                        >
                                            <Ionicons name="call" size={13} color={WHITE} />
                                            <Text style={s.driverBtnTxt}>Call Driver</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                const phone = currentOrder?.driver?.phone || currentOrder?.contact_phone;
                                                if (phone) {
                                                    whatsappService.openDirectChat(phone, `Hello, I am contacting you regarding my Order ${orderDisplayRef}`);
                                                } else {
                                                    Alert.alert('No WhatsApp Number', 'You can contact the courier directly via phone call.');
                                                }
                                            }}
                                            style={s.driverWhatsAppBtn}
                                        >
                                            <Ionicons name="logo-whatsapp" size={13} color={WHITE} />
                                            <Text style={s.driverBtnTxt}>WhatsApp</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* ── REAL MOBILE STEPPER TIMELINE (NEVER OVERFLOWS) ─── */}
                        <View style={s.stepperCard}>
                            <View style={s.stepperHeader}>
                                <Ionicons name="git-commit-outline" size={18} color={BLUE} />
                                <Text style={s.stepperHeaderTitle}>Live Dispatch Milestones</Text>
                            </View>

                            <View style={s.stepperList}>
                                {timelineSteps.map((step, idx) => {
                                    const isLast = idx === timelineSteps.length - 1;
                                    return (
                                        <View key={step.step} style={s.stepperRow}>
                                            {/* Column: Step Dot & Connecting Line */}
                                            <View style={s.stepperTrackCol}>
                                                <View style={[
                                                    s.stepperCircle,
                                                    step.done && s.stepperCircleDone,
                                                    step.active && s.stepperCircleActive
                                                ]}>
                                                    <Ionicons
                                                        name={step.done ? "checkmark" : step.icon}
                                                        size={step.done ? 14 : 13}
                                                        color={step.done ? WHITE : step.active ? BLUE : '#94A3B8'}
                                                    />
                                                </View>
                                                {!isLast && (
                                                    <View style={[
                                                        s.stepperLine,
                                                        step.done && !step.active && s.stepperLineDone
                                                    ]} />
                                                )}
                                            </View>

                                            {/* Column: Step Content */}
                                            <View style={[s.stepperContentCol, isLast && { paddingBottom: 4 }]}>
                                                <View style={s.stepperTitleRow}>
                                                    <Text style={[
                                                        s.stepperStepTitle,
                                                        step.done && s.stepperStepTitleDone,
                                                        step.active && s.stepperStepTitleActive
                                                    ]}>
                                                        {step.title}
                                                    </Text>
                                                    <Text style={[
                                                        s.stepperTimestamp,
                                                        step.done && { color: '#475569' }
                                                    ]}>
                                                        {step.timestamp}
                                                    </Text>
                                                </View>
                                                <Text style={s.stepperStepSub}>{step.sub}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>

                        {/* ── DELIVERY DESTINATION CARD ────────────────────── */}
                        {shippingAddress && (
                            <View style={s.addressCard}>
                                <View style={s.addressHeader}>
                                    <Ionicons name="location" size={17} color={BLUE} />
                                    <Text style={s.addressTitle}>Delivery Destination</Text>
                                </View>
                                <Text style={s.addressRecipient}>
                                    {shippingAddress.full_name || shippingAddress.name || shippingAddress.title || 'Customer Recipient'}
                                </Text>
                                <Text style={s.addressLine}>
                                    {shippingAddress.address || shippingAddress.street || 'Address on file'}
                                </Text>
                                <Text style={s.addressRegion}>
                                    {[shippingAddress.lga, shippingAddress.city, shippingAddress.state].filter(Boolean).join(', ')}
                                </Text>
                                {shippingAddress.phone && (
                                    <Text style={s.addressPhone}>📞 {shippingAddress.phone}</Text>
                                )}
                            </View>
                        )}

                        {/* ── ORDER ITEMS & FINANCIAL SUMMARY ──────────────── */}
                        <View style={s.itemsCard}>
                            <View style={s.itemsHeader}>
                                <Text style={s.itemsTitle}>Order Items ({orderItems.length || 1})</Text>
                                <TouchableOpacity onPress={handleOpenInvoice} style={s.viewInvoiceBtn}>
                                    <Ionicons name="receipt-outline" size={13} color={BLUE} />
                                    <Text style={s.viewInvoiceBtnTxt}>Official Receipt</Text>
                                </TouchableOpacity>
                            </View>

                            {orderItems.length > 0 ? (
                                orderItems.map((item, idx) => {
                                    const prod = item.product || {};
                                    const imgUri = resolveProductImage(prod.images || item.images || item.image);
                                    const itemName = item.name || item.title || prod.name || 'Marketplace Item';
                                    const price = Number(item.price || prod.price || 0);
                                    const qty = Number(item.quantity || item.qty || 1);

                                    return (
                                        <View key={item.id || idx} style={[s.itemRow, idx < orderItems.length - 1 && s.itemRowBorder]}>
                                            <Image source={{ uri: imgUri }} style={s.itemThumbnail} />
                                            <View style={s.itemInfoCol}>
                                                <Text numberOfLines={2} style={s.itemNameText}>{itemName}</Text>
                                                <View style={s.itemMetaRow}>
                                                    <Text style={s.itemQtyText}>Qty: {qty} × ₦{price.toLocaleString()}</Text>
                                                    <Text style={s.itemTotalText}>₦{(price * qty).toLocaleString()}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <View style={s.fallbackItemRow}>
                                    <Ionicons name="cube-outline" size={28} color={SLATE} />
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={s.itemNameText}>Marketplace Purchased Goods</Text>
                                        <Text style={s.itemQtyText}>Ref: {orderDisplayRef}</Text>
                                        <Text style={s.itemTotalText}>₦{Number(currentOrder?.total_amount || 0).toLocaleString()}</Text>
                                    </View>
                                </View>
                            )}

                            {/* Financial Calculation Breakdown */}
                            <View style={s.financialBreakdownBox}>
                                <View style={s.breakdownRow}>
                                    <Text style={s.breakdownLabel}>Items Subtotal</Text>
                                    <Text style={s.breakdownValue}>₦{displaySubtotal.toLocaleString()}</Text>
                                </View>
                                <View style={s.breakdownRow}>
                                    <Text style={s.breakdownLabel}>Delivery & Shipping</Text>
                                    <Text style={s.breakdownValue}>
                                        {shippingFee > 0 ? `₦${shippingFee.toLocaleString()}` : 'Free Delivery'}
                                    </Text>
                                </View>
                                {discountApplied > 0 && (
                                    <View style={s.breakdownRow}>
                                        <Text style={[s.breakdownLabel, { color: '#16A34A' }]}>Discount / Voucher</Text>
                                        <Text style={[s.breakdownValue, { color: '#16A34A' }]}>-₦{discountApplied.toLocaleString()}</Text>
                                    </View>
                                )}
                                <View style={s.breakdownRow}>
                                    <Text style={s.breakdownLabel}>Payment Method</Text>
                                    <Text style={s.breakdownValue}>{currentOrder?.payment_method || 'Verified Checkout'}</Text>
                                </View>
                                <View style={[s.breakdownRow, s.breakdownTotalRow]}>
                                    <Text style={s.breakdownTotalLabel}>Total Amount</Text>
                                    <Text style={s.breakdownTotalValue}>₦{totalAmount.toLocaleString()}</Text>
                                </View>
                            </View>
                        </View>

                        {/* ── ACTION BUTTONS ───────────────────────────────── */}
                        <View style={s.actionGroup}>
                            <TouchableOpacity
                                onPress={handleShareTrackingWhatsApp}
                                style={s.shareWhatsAppBtn}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="share-social" size={17} color={WHITE} />
                                <Text style={s.shareWhatsAppBtnTxt}>
                                    Share Live Tracking via WhatsApp
                                </Text>
                            </TouchableOpacity>

                            {isCurrentOrderPss && currentPssMetrics && !currentPssMetrics.isFullyPaid && (
                                <TouchableOpacity
                                    onPress={handleGoToPaySmallSmall}
                                    style={s.bnplShortcutBtn}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="card-outline" size={17} color={WHITE} />
                                    <Text style={s.bnplShortcutBtnTxt}>
                                        Manage Pay Small Small Plan (0% Interest)
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={handleWhatsAppSupport}
                                style={s.primaryActionBtn}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="logo-whatsapp" size={18} color={WHITE} />
                                <Text style={s.primaryActionBtnTxt}>
                                    24/7 Logistics Support & Dispatch Inquiries
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleOpenInvoice}
                                style={s.secondaryActionBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="document-text-outline" size={17} color={NAVY} />
                                <Text style={s.secondaryActionBtnTxt}>Download Official Invoice & Receipt</Text>
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
        backgroundColor: BG_PAGE
    },
    // Top App Bar
    header: {
        backgroundColor: NAVY,
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
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8
    },
    headerTitle: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.3
    },
    headerSubtitle: {
        color: '#94A3B8',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 1
    },

    // Search Bar
    searchBarContainer: {
        backgroundColor: NAVY_DARK,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B'
    },
    searchInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 42,
        borderWidth: 1,
        borderColor: '#334155'
    },
    searchInput: {
        flex: 1,
        color: WHITE,
        fontSize: 13,
        paddingVertical: 0
    },
    searchSubmitBtn: {
        backgroundColor: BLUE,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center'
    },
    searchSubmitTxt: {
        color: WHITE,
        fontWeight: '800',
        fontSize: 13
    },

    // Scroll
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 120
    },

    // Live Progress Telemetry Bar
    progressBarCard: {
        backgroundColor: WHITE,
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: BORDER_COL,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2
    },
    progressBarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10
    },
    liveBeaconDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    progressBarStageLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: 0.4
    },
    progressBarPctText: {
        fontSize: 14,
        fontWeight: '900'
    },
    progressBarTrack: {
        height: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4
    },
    progressBarStagesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 2
    },
    stageTick: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#94A3B8'
    },
    stageTickActive: {
        color: NAVY,
        fontWeight: '800'
    },

    // BNPL Pay Small Small Card
    bnplCard: {
        backgroundColor: '#071224',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.35)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 3
    },
    bnplHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4
    },
    bnplTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: WHITE,
        letterSpacing: 0.2
    },
    bnplBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    bnplBadgePaid: {
        backgroundColor: 'rgba(16, 185, 129, 0.18)'
    },
    bnplBadgeOverdue: {
        backgroundColor: 'rgba(239, 68, 68, 0.18)'
    },
    bnplBadgeActive: {
        backgroundColor: 'rgba(217, 167, 58, 0.18)'
    },
    bnplBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.4
    },
    bnplSub: {
        fontSize: 11,
        color: '#94A3B8',
        marginBottom: 10
    },
    bnplProgressTrack: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 12
    },
    bnplProgressFill: {
        height: '100%',
        borderRadius: 3
    },
    bnplMetricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 10
    },
    bnplMetricCol: {
        flex: 1,
        alignItems: 'center'
    },
    bnplMetricLbl: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '600'
    },
    bnplMetricVal: {
        fontSize: 12.5,
        fontWeight: '900',
        color: WHITE,
        marginTop: 2
    },
    bnplMetricDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255,255,255,0.1)'
    },
    bnplDueActionBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)'
    },
    bnplDueLbl: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700'
    },
    bnplDueVal: {
        fontSize: 13,
        fontWeight: '900',
        color: WHITE,
        marginTop: 1
    },
    bnplActionBtn: {
        backgroundColor: GOLD,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    bnplActionBtnTxt: {
        color: WHITE,
        fontSize: 11,
        fontWeight: '900'
    },
    bnplShortcutBtn: {
        backgroundColor: GOLD,
        borderRadius: 14,
        paddingVertical: 13,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 10
    },
    bnplShortcutBtnTxt: {
        color: WHITE,
        fontWeight: '900',
        fontSize: 12.5
    },

    // Security PIN Right Column & Copy Button
    securityPinRightCol: {
        alignItems: 'flex-end',
        gap: 5
    },
    copyPinBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6
    },
    copyPinBtnTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: NAVY
    },

    // Share Live Tracking via WhatsApp
    shareWhatsAppBtn: {
        backgroundColor: '#16A34A',
        borderRadius: 14,
        paddingVertical: 13,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 10,
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 2
    },
    shareWhatsAppBtnTxt: {
        color: WHITE,
        fontWeight: '900',
        fontSize: 12.5
    },

    // Loading & Empty
    loadingBox: {
        paddingVertical: 80,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12
    },
    loadingTxt: {
        fontSize: 13,
        color: SLATE,
        fontWeight: '600'
    },
    emptyCard: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER_COL,
        marginTop: 20
    },
    emptyIconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: NAVY,
        marginBottom: 6
    },
    emptyDesc: {
        fontSize: 13,
        color: SLATE,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20
    },
    emptyBtn: {
        backgroundColor: NAVY,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    emptyBtnTxt: {
        color: WHITE,
        fontWeight: '800',
        fontSize: 13.5
    },

    // Status Card
    statusCard: {
        backgroundColor: WHITE,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER_COL,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1
    },
    refHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 12
    },
    refLeftCol: {
        flex: 1
    },
    refLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: SLATE,
        letterSpacing: 0.5
    },
    refValRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 3,
        flexWrap: 'wrap'
    },
    refValText: {
        fontSize: 17,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: 0.3
    },
    copyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#BFDBFE'
    },
    copyPillTxt: {
        fontSize: 10.5,
        fontWeight: '700',
        color: BLUE
    },

    // Status Badge
    statusBadgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        alignSelf: 'flex-start'
    },
    statusBadgeActive: {
        backgroundColor: '#EFF6FF'
    },
    statusBadgeDelivered: {
        backgroundColor: '#ECFDF5'
    },
    statusBadgeCancelled: {
        backgroundColor: '#FEF2F2'
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5
    },
    statusBadgeText: {
        fontSize: 10.5,
        fontWeight: '800',
        letterSpacing: 0.4
    },

    // ETA Banner
    etaBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
        marginBottom: 14
    },
    etaBannerTxt: {
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
        color: NAVY_LIGHT
    },

    // Snapshot Row
    snapshotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    snapshotItem: {
        flex: 1,
        alignItems: 'center'
    },
    snapshotLbl: {
        fontSize: 10,
        color: SLATE,
        fontWeight: '600'
    },
    snapshotVal: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
        marginTop: 2
    },
    snapshotDivider: {
        width: 1,
        height: 22,
        backgroundColor: '#E2E8F0'
    },

    // Security PIN Card (Modern High-Trust Handover Code)
    securityPinCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1
    },
    securityPinLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    securityPinIconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center'
    },
    securityPinTextBox: {
        flex: 1
    },
    securityPinTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY
    },
    securityPinSub: {
        fontSize: 11,
        color: SLATE,
        marginTop: 2,
        lineHeight: 15
    },
    securityPinBadge: {
        backgroundColor: NAVY,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: '#1E293B'
    },
    securityPinDigits: {
        fontSize: 17,
        fontWeight: '900',
        color: '#FBBF24',
        letterSpacing: 2
    },

    // Preferred Options Card
    prefCard: {
        backgroundColor: WHITE,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: BORDER_COL,
        marginBottom: 14
    },
    prefHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10
    },
    prefHeaderTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY
    },
    prefItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap'
    },
    prefItemLbl: {
        fontSize: 11.5,
        color: SLATE,
        fontWeight: '600'
    },
    prefBadgeBlue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: '#BFDBFE'
    },
    prefBadgeBlueTxt: {
        fontSize: 10.5,
        fontWeight: '800',
        color: BLUE
    },
    giftBoxWrapper: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    giftHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 3
    },
    giftTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#92400E'
    },
    giftSub: {
        fontSize: 11,
        color: '#78350F',
        marginTop: 1
    },
    giftPackagingNotice: {
        fontSize: 10.5,
        color: '#92400E',
        marginTop: 2
    },
    giftMsgBox: {
        backgroundColor: '#FFFBEB',
        borderRadius: 8,
        padding: 8,
        marginTop: 6,
        borderLeftWidth: 3,
        borderLeftColor: GOLD
    },
    giftMsgQuote: {
        fontSize: 11,
        fontStyle: 'italic',
        color: '#78350F'
    },

    // Stepper Timeline (Strictly bounds-safe)
    stepperCard: {
        backgroundColor: WHITE,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER_COL,
        marginBottom: 14
    },
    stepperHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    stepperHeaderTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY
    },
    stepperList: {
        paddingLeft: 2
    },
    stepperRow: {
        flexDirection: 'row',
        minHeight: 52
    },
    stepperTrackCol: {
        alignItems: 'center',
        width: 30,
        marginRight: 10
    },
    stepperCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#F1F5F9',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2
    },
    stepperCircleDone: {
        backgroundColor: EMERALD,
        borderColor: EMERALD
    },
    stepperCircleActive: {
        backgroundColor: '#EFF6FF',
        borderColor: BLUE,
        borderWidth: 2
    },
    stepperLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 2
    },
    stepperLineDone: {
        backgroundColor: EMERALD
    },
    stepperContentCol: {
        flex: 1,
        paddingBottom: 16
    },
    stepperTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 6
    },
    stepperStepTitle: {
        fontSize: 12.5,
        fontWeight: '700',
        color: SLATE,
        flex: 1
    },
    stepperStepTitleDone: {
        color: NAVY,
        fontWeight: '800'
    },
    stepperStepTitleActive: {
        color: BLUE,
        fontWeight: '800'
    },
    stepperTimestamp: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '600'
    },
    stepperStepSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
        lineHeight: 16
    },

    // Destination Address Card
    addressCard: {
        backgroundColor: WHITE,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: BORDER_COL,
        marginBottom: 14
    },
    addressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8
    },
    addressTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    addressRecipient: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY
    },
    addressLine: {
        fontSize: 12,
        color: '#475569',
        marginTop: 2,
        lineHeight: 17
    },
    addressRegion: {
        fontSize: 11.5,
        color: SLATE,
        marginTop: 2
    },
    addressPhone: {
        fontSize: 11.5,
        fontWeight: '700',
        color: BLUE,
        marginTop: 4
    },

    // Items Card
    itemsCard: {
        backgroundColor: WHITE,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: BORDER_COL,
        marginBottom: 14
    },
    itemsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 8
    },
    itemsTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY
    },
    viewInvoiceBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    viewInvoiceBtnTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: BLUE
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
    itemThumbnail: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        marginRight: 10
    },
    itemInfoCol: {
        flex: 1
    },
    itemNameText: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
        lineHeight: 16
    },
    itemMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 3
    },
    itemQtyText: {
        fontSize: 11,
        color: SLATE
    },
    itemTotalText: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY
    },
    fallbackItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6
    },
    // Financial Cost Breakdown in Items Card
    financialBreakdownBox: {
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
    },
    breakdownLabel: {
        fontSize: 12,
        color: SLATE,
        fontWeight: '600'
    },
    breakdownValue: {
        fontSize: 12,
        fontWeight: '700',
        color: NAVY
    },
    breakdownTotalRow: {
        marginTop: 6,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        marginBottom: 0
    },
    breakdownTotalLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY
    },
    breakdownTotalValue: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY
    },

    // Action Group
    actionGroup: {
        gap: 10
    },
    primaryActionBtn: {
        backgroundColor: '#16A34A',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 2
    },
    primaryActionBtnTxt: {
        color: WHITE,
        fontWeight: '800',
        fontSize: 13
    },
    secondaryActionBtn: {
        backgroundColor: WHITE,
        borderRadius: 14,
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: BORDER_COL,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8
    },
    secondaryActionBtnTxt: {
        color: NAVY,
        fontWeight: '800',
        fontSize: 12.5
    },

    // Live Standing Station & Checkpoints (Modern Telemetry Card)
    liveStationCard: {
        backgroundColor: WHITE,
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: BORDER_COL,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1
    },
    liveStationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14
    },
    pulseCircleOuter: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
    },
    pulseCircleInner: {
        position: 'absolute',
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#D1FAE5'
    },
    liveStationLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#059669',
        letterSpacing: 0.5
    },
    liveStationName: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY,
        marginTop: 2
    },
    liveStationBadge: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    liveStationBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#059669'
    },
    stationTrackBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 12,
        marginBottom: 10
    },
    stationNode: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4
    },
    stationNodeDone: {
        backgroundColor: '#10B981'
    },
    stationNodeTxt: {
        fontSize: 9.5,
        fontWeight: '700',
        color: SLATE,
        textAlign: 'center'
    },
    stationNodeTxtDone: {
        color: '#065F46',
        fontWeight: '900'
    },
    stationTrackLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#E2E8F0',
        marginHorizontal: 4,
        marginTop: -14
    },
    stationTrackLineDone: {
        backgroundColor: '#10B981'
    },
    driverCardBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        padding: 10,
        borderRadius: 12,
        marginTop: 4
    },
    driverAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    driverName: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY
    },
    driverVehicle: {
        fontSize: 10.5,
        color: SLATE,
        marginTop: 1
    },
    driverCallBtn: {
        backgroundColor: '#0F172A',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 8
    },
    driverWhatsAppBtn: {
        backgroundColor: '#16A34A',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 8
    },
    driverBtnTxt: {
        color: WHITE,
        fontSize: 10.5,
        fontWeight: '800'
    }
});
