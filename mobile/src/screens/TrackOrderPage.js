import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Image, Linking,
    Alert, StatusBar, Platform, RefreshControl, TextInput,
    ActivityIndicator, StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { whatsappService } from '../services/whatsappService';

const AM_LOGO = require('../../assets/am_logo.png');

function resolveProductImage(img) {
    if (!img) return 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=300&auto=format&fit=crop';
    if (Array.isArray(img)) return img[0];
    if (typeof img === 'string') {
        try {
            const parsed = JSON.parse(img);
            return Array.isArray(parsed) ? parsed[0] : img;
        } catch {
            return img;
        }
    }
    return img;
}

export const TrackOrderPage = ({ navigation, route, onBack, order: propOrder }) => {
    const passedOrder = propOrder || route?.params?.order;
    const passedOrderId = route?.params?.orderId || passedOrder?.id;
    const goBack = onBack || (() => navigation?.goBack());

    const [currentOrder, setCurrentOrder] = useState(passedOrder || null);
    const [userOrders, setUserOrders] = useState([]);
    const [loading, setLoading] = useState(!passedOrder);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    // Fetch full enriched order details from Supabase
    const fetchOrderDetails = useCallback(async (orderId) => {
        if (!orderId) return null;
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    driver:drivers(id, name, phone, vehicle_type, plate_number),
                    order_items(
                        id, quantity, price, variant, product_id,
                        product:products(id, name, images, store_id, vendor:vendors(store_name, business_name, full_name, phone))
                    )
                `)
                .eq('id', orderId)
                .maybeSingle();

            if (!error && data) {
                return data;
            }
            return null;
        } catch (err) {
            console.warn('[TrackOrder] Error fetching order details:', err);
            return null;
        }
    }, []);

    // Load initial order or user's active orders
    const loadTrackingData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. If an order ID was provided, fetch it directly
            if (passedOrderId) {
                const detailed = await fetchOrderDetails(passedOrderId);
                if (detailed) {
                    setCurrentOrder(detailed);
                } else if (passedOrder) {
                    setCurrentOrder(passedOrder);
                }
            }

            // 2. Fetch authenticated user's recent orders for switching & fallback
            const { data: authUser } = await supabase.auth.getUser();
            const userId = authUser?.user?.id;

            if (userId) {
                const { data: ordersList, error: ordersErr } = await supabase
                    .from('orders')
                    .select(`
                        *,
                        driver:drivers(id, name, phone, vehicle_type, plate_number),
                        order_items(
                            id, quantity, price, variant, product_id,
                            product:products(id, name, images, store_id, vendor:vendors(store_name, business_name, full_name, phone))
                        )
                    `)
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (!ordersErr && Array.isArray(ordersList)) {
                    setUserOrders(ordersList);
                    // If no order currently selected, select the first active or latest order
                    if (!passedOrderId && ordersList.length > 0) {
                        const active = ordersList.find(o => ['pending', 'processing', 'shipped', 'out_for_delivery', 'dispatched'].includes(o.status)) || ordersList[0];
                        setCurrentOrder(active);
                    }
                }
            }
        } catch (e) {
            console.warn('[TrackOrder] Init error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [passedOrderId, passedOrder, fetchOrderDetails]);

    useEffect(() => {
        loadTrackingData();
    }, [loadTrackingData]);

    // Real-time Postgres Subscription to listen for status or driver updates on the active order
    useEffect(() => {
        if (!currentOrder?.id) return;
        const channelName = `track_order_rt_${currentOrder.id}`;
        const sub = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${currentOrder.id}` },
                async (payload) => {
                    console.log('[TrackOrder] Live realtime update received:', payload.new?.status);
                    const fresh = await fetchOrderDetails(currentOrder.id);
                    if (fresh) {
                        setCurrentOrder(fresh);
                    } else if (payload.new) {
                        setCurrentOrder(prev => ({ ...prev, ...payload.new }));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [currentOrder?.id, fetchOrderDetails]);

    // Manual Tracking Search by Order ID or Reference
    const handleSearchOrder = async () => {
        const query = searchQuery.trim();
        if (!query) return;
        setSearchLoading(true);
        try {
            // Clean # or AMF prefix if customer entered it
            const cleanQuery = query.replace(/^[#]/, '').replace(/^AMF/i, '').trim();

            // Try exact id match first
            let { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    driver:drivers(id, name, phone, vehicle_type, plate_number),
                    order_items(
                        id, quantity, price, variant, product_id,
                        product:products(id, name, images, store_id, vendor:vendors(store_name, business_name, full_name, phone))
                    )
                `)
                .or(`id.eq.${query},payment_reference.eq.${query},id.ilike.%${cleanQuery}%`)
                .limit(1)
                .maybeSingle();

            if (data) {
                setCurrentOrder(data);
                setShowSearch(false);
                setSearchQuery('');
            } else {
                Alert.alert('Order Not Found', `No matching order found for "${query}". Please check your tracking number and try again.`);
            }
        } catch (e) {
            Alert.alert('Search Failed', 'Could not search for order at this moment. Please check your network connection.');
        } finally {
            setSearchLoading(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadTrackingData();
    };

    // Derived Order Properties
    const orderNumber = useMemo(() => {
        if (!currentOrder?.id) return 'N/A';
        return `#AMF${currentOrder.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    }, [currentOrder]);

    const orderDate = useMemo(() => {
        if (!currentOrder?.created_at) return 'Recently';
        try {
            return new Date(currentOrder.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return 'Recently';
        }
    }, [currentOrder]);

    const orderTime = useMemo(() => {
        if (!currentOrder?.created_at) return '';
        try {
            return new Date(currentOrder.created_at).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '';
        }
    }, [currentOrder]);

    const currentStatus = (currentOrder?.status || 'pending').toLowerCase();
    const isCancelled = currentStatus === 'cancelled';

    // Timeline Step calculation
    const activeStep = useMemo(() => {
        if (isCancelled) return -1;
        if (currentStatus === 'pending' || currentStatus === 'confirmed') return 0;
        if (currentStatus === 'processing') return 1;
        if (currentStatus === 'shipped' || currentStatus === 'in_transit') return 2;
        if (currentStatus === 'out_for_delivery' || currentStatus === 'dispatched') return 3;
        if (currentStatus === 'delivered' || currentStatus === 'completed') return 4;
        return 0;
    }, [currentStatus, isCancelled]);

    // Format Estimated Delivery based on real created_at
    const estimatedDeliveryText = useMemo(() => {
        if (!currentOrder?.created_at) return '2 - 3 business days';
        if (currentStatus === 'delivered') {
            const delDate = currentOrder.confirmed_at || currentOrder.updated_at || currentOrder.created_at;
            return `Delivered on ${new Date(delDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
        try {
            const base = new Date(currentOrder.created_at);
            const estDays = currentOrder.delivery_method === 'express' ? 1 : 2;
            const target = new Date(base.getTime() + estDays * 24 * 60 * 60 * 1000);
            return target.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return 'In 1 - 2 business days';
        }
    }, [currentOrder, currentStatus]);

    // Items list
    const orderItems = useMemo(() => {
        const raw = currentOrder?.order_items || currentOrder?.items;
        if (Array.isArray(raw) && raw.length > 0) return raw;
        return [];
    }, [currentOrder]);

    // Shipping Destination Address
    const shippingAddress = useMemo(() => {
        const addr = currentOrder?.shipping_address || currentOrder?.delivery_address;
        if (typeof addr === 'string') {
            try { return JSON.parse(addr); } catch { return { address: addr }; }
        }
        if (typeof addr === 'object' && addr !== null) return addr;
        return null;
    }, [currentOrder]);

    // Driver details
    const driver = currentOrder?.driver || null;

    // Contact WhatsApp Support
    const handleContactSupport = () => {
        const total = currentOrder?.total_amount ? `₦${Number(currentOrder.total_amount).toLocaleString()}` : '';
        const msg = `Hello Abu Mafhal Support, I am tracking my Order ${orderNumber} (${currentStatus.toUpperCase()}) ${total ? 'Total: ' + total : ''}. Please give me live status updates.`;
        whatsappService.openWhatsApp('2348145853539', msg);
    };

    // Share Tracking
    const handleShareTracking = () => {
        const link = `https://abumafhal.com/track?id=${currentOrder?.id || ''}`;
        const msg = `🚚 *Abu Mafhal Live Order Tracking*\nOrder: *${orderNumber}*\nStatus: *${currentStatus.toUpperCase()}*\nEstimated Delivery: *${estimatedDeliveryText}*\n\nTrack your order in real time:\n${link}`;
        whatsappService.openWhatsApp('', msg);
    };

    // Call Driver
    const handleCallDriver = () => {
        if (driver?.phone) {
            Linking.openURL(`tel:${driver.phone}`).catch(() => {
                Alert.alert('Call Failed', `Driver phone: ${driver.phone}`);
            });
        } else {
            Alert.alert('Driver Phone', 'Driver phone number is not available yet.');
        }
    };

    // Dynamic Timeline Steps with Real Timestamps
    const timelineSteps = useMemo(() => {
        return [
            {
                key: 'confirmed',
                label: 'Order Confirmed',
                sub: 'Order received and verified by system',
                time: orderDate + (orderTime ? `, ${orderTime}` : '')
            },
            {
                key: 'processing',
                label: 'Processing & Packaging',
                sub: 'Merchant is carefully packing your items',
                time: activeStep >= 1 ? 'Completed' : 'Pending'
            },
            {
                key: 'shipped',
                label: 'Dispatched / In Transit',
                sub: 'Package dispatched to central transit hub',
                time: activeStep >= 2 ? 'In Transit' : 'Pending'
            },
            {
                key: 'out_for_delivery',
                label: 'Out for Delivery',
                sub: driver ? `Assigned to ${driver.name}` : 'Driver on the way to destination',
                time: activeStep >= 3 ? 'En Route' : 'Pending'
            },
            {
                key: 'delivered',
                label: 'Delivered',
                sub: 'Package safely delivered to your doorstep',
                time: activeStep >= 4 ? (orderDate || 'Done') : '--'
            }
        ];
    }, [orderDate, orderTime, activeStep, driver]);

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#0A192F" barStyle="light-content" />

            {/* Top Navy Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>

                <View style={styles.headerBrand}>
                    <Image source={AM_LOGO} style={styles.headerLogo} />
                    <View>
                        <Text style={styles.headerTitle}>
                            ABU <Text style={{ color: '#38BDF8' }}>MAFHAL</Text>
                        </Text>
                        <Text style={styles.headerTagline}>
                            Your Marketplace, Your Choice.
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={() => setShowSearch(prev => !prev)}
                    style={styles.headerBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name={showSearch ? "close" : "search-outline"} size={22} color="white" />
                </TouchableOpacity>
            </View>

            {/* Expandable Order ID Search Bar */}
            {showSearch && (
                <View style={styles.searchBarContainer}>
                    <View style={styles.searchInputWrapper}>
                        <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Enter Order ID (e.g. AMF128 or full ID)..."
                            placeholderTextColor="#94A3B8"
                            style={styles.searchInput}
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
                        style={[styles.searchSubmitBtn, (!searchQuery.trim() || searchLoading) && { opacity: 0.6 }]}
                    >
                        {searchLoading ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Text style={styles.searchSubmitTxt}>Track</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A192F" />}
            >
                {/* Orders Selector Pills if user has multiple orders */}
                {userOrders.length > 1 && (
                    <View style={styles.orderSwitcherSection}>
                        <Text style={styles.orderSwitcherTitle}>Your Orders:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                            {userOrders.map((ord) => {
                                const isSelected = ord.id === currentOrder?.id;
                                const shortRef = `#AMF${ord.id.slice(0, 5).toUpperCase()}`;
                                const st = (ord.status || 'pending').toUpperCase();
                                return (
                                    <TouchableOpacity
                                        key={ord.id}
                                        onPress={() => setCurrentOrder(ord)}
                                        style={[
                                            styles.orderPill,
                                            isSelected && styles.orderPillActive
                                        ]}
                                    >
                                        <Text style={[styles.orderPillText, isSelected && styles.orderPillTextActive]}>
                                            {shortRef} • {st}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0A192F" />
                        <Text style={styles.loadingText}>Fetching live order status...</Text>
                    </View>
                ) : !currentOrder ? (
                    /* Clean Empty State when no order exists */
                    <View style={styles.emptyStateCard}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="cube-outline" size={44} color="#0A192F" />
                        </View>
                        <Text style={styles.emptyTitle}>No Order Selected</Text>
                        <Text style={styles.emptyDesc}>
                            You have no active orders in tracking. Enter your Order Tracking Number above or browse our marketplace to place an order.
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowSearch(true)}
                            style={styles.emptyTrackBtn}
                        >
                            <Ionicons name="search" size={16} color="white" />
                            <Text style={styles.emptyTrackBtnTxt}>Track With Order ID</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Header Title & Order ID Badge */}
                        <View style={styles.titleRow}>
                            <View>
                                <Text style={styles.pageHeading}>Order Tracking</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                    <View style={[styles.livePulseDot, { backgroundColor: isCancelled ? '#EF4444' : '#10B981' }]} />
                                    <Text style={styles.pageSubheading}>
                                        {isCancelled ? 'Order Cancelled' : 'Real-time Live Sync'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.orderBadge}>
                                <Text style={{ fontSize: 18 }}>📦</Text>
                                <View>
                                    <Text style={styles.orderBadgeRef}>{orderNumber}</Text>
                                    <Text style={styles.orderBadgeDate}>Placed on {orderDate}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Cancelled Warning Card if cancelled */}
                        {isCancelled && (
                            <View style={styles.cancelledCard}>
                                <Ionicons name="close-circle" size={24} color="#DC2626" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cancelledTitle}>Order Cancelled</Text>
                                    <Text style={styles.cancelledSub}>
                                        This order was cancelled. If you already made a payment, your refund has been credited to your Abu Mafhal Wallet or original method.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Real Order Items Card */}
                        <View style={styles.itemsCard}>
                            <View style={styles.itemsCardHeader}>
                                <Text style={styles.itemsCardTitle}>Order Items ({orderItems.length || 1})</Text>
                                {currentOrder?.total_amount && (
                                    <Text style={styles.itemsCardTotal}>
                                        ₦{Number(currentOrder.total_amount).toLocaleString()}
                                    </Text>
                                )}
                            </View>

                            {orderItems.length > 0 ? (
                                orderItems.map((it, idx) => {
                                    const prod = it.product || {};
                                    const imgUri = resolveProductImage(prod.images || it.image);
                                    const vendorName = prod.vendor?.store_name || prod.vendor?.business_name || it.vendor || 'Abu Mafhal Merchant';
                                    return (
                                        <View key={it.id || idx} style={[styles.itemRow, idx < orderItems.length - 1 && styles.itemRowBorder]}>
                                            <Image source={{ uri: imgUri }} style={styles.itemImage} />
                                            <View style={{ flex: 1, paddingRight: 8 }}>
                                                <Text numberOfLines={1} style={styles.itemName}>
                                                    {prod.name || it.name || 'Marketplace Product'}
                                                </Text>
                                                <Text numberOfLines={1} style={styles.itemVendor}>
                                                    Merchant: {vendorName}
                                                </Text>
                                                <View style={styles.itemPriceRow}>
                                                    <Text style={styles.itemPrice}>
                                                        ₦{Number(it.price || 0).toLocaleString()}
                                                    </Text>
                                                    <Text style={styles.itemQty}>Qty: {it.quantity || 1}</Text>
                                                    {it.variant && (
                                                        <Text style={styles.itemVariant}>• {it.variant}</Text>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <View style={styles.singleFallbackRow}>
                                    <Ionicons name="cube-outline" size={36} color="#94A3B8" />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.itemName}>Order Summary</Text>
                                        <Text style={styles.itemVendor}>Payment Ref: {currentOrder?.payment_reference || orderNumber}</Text>
                                        <Text style={styles.itemPrice}>₦{Number(currentOrder?.total_amount || 0).toLocaleString()}</Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Real-time Vertical Timeline */}
                        {!isCancelled && (
                            <View style={styles.timelineCard}>
                                <Text style={styles.timelineHeader}>Tracking Timeline</Text>
                                {timelineSteps.map((step, idx) => {
                                    const isDone = idx <= activeStep;
                                    const isCurrent = idx === activeStep;
                                    const isLast = idx === timelineSteps.length - 1;
                                    return (
                                        <View key={step.key} style={styles.timelineStepRow}>
                                            <View style={styles.timelineTrackCol}>
                                                <View style={[
                                                    styles.timelineDot,
                                                    isDone ? styles.timelineDotDone : styles.timelineDotPending,
                                                    isCurrent && styles.timelineDotCurrent
                                                ]}>
                                                    {isDone && <Ionicons name="checkmark" size={13} color="white" />}
                                                </View>
                                                {!isLast && (
                                                    <View style={[
                                                        styles.timelineLine,
                                                        isDone && idx < activeStep ? styles.timelineLineDone : styles.timelineLinePending
                                                    ]} />
                                                )}
                                            </View>

                                            <View style={[styles.timelineContent, isLast && { paddingBottom: 0 }]}>
                                                <View style={styles.timelineTitleRow}>
                                                    <Text style={[
                                                        styles.timelineStepTitle,
                                                        { color: isDone ? '#0F172A' : '#94A3B8', fontWeight: isDone ? '800' : '600' }
                                                    ]}>
                                                        {step.label}
                                                    </Text>
                                                    <Text style={[
                                                        styles.timelineStepTime,
                                                        { color: isDone ? '#475569' : '#CBD5E1' }
                                                    ]}>
                                                        {step.time}
                                                    </Text>
                                                </View>
                                                <Text style={styles.timelineStepSub}>
                                                    {step.sub}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Real Estimated Delivery Box */}
                        <View style={styles.estDeliveryCard}>
                            <View style={styles.estIconBox}>
                                <Ionicons name="time-outline" size={26} color="#059669" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.estLabel}>
                                    {currentStatus === 'delivered' ? 'DELIVERY STATUS' : 'ESTIMATED ARRIVAL'}
                                </Text>
                                <Text style={styles.estDate}>
                                    {estimatedDeliveryText}
                                </Text>
                                <Text style={styles.estNote}>
                                    {currentStatus === 'delivered'
                                        ? 'Successfully handed over to customer'
                                        : 'Standard Courier Dispatch (9:00 AM - 6:00 PM)'}
                                </Text>
                            </View>
                        </View>

                        {/* Real Destination Address Details */}
                        {shippingAddress && (
                            <View style={styles.shippingCard}>
                                <View style={styles.shippingHeader}>
                                    <Ionicons name="location" size={18} color="#0284C7" />
                                    <Text style={styles.shippingTitle}>Delivery Destination</Text>
                                </View>
                                <Text style={styles.shippingRecipient}>
                                    {shippingAddress.full_name || shippingAddress.name || 'Customer'}
                                </Text>
                                <Text style={styles.shippingText}>
                                    {shippingAddress.address || shippingAddress.street || 'Address on file'}
                                </Text>
                                <Text style={styles.shippingCity}>
                                    {[shippingAddress.lga, shippingAddress.city, shippingAddress.state].filter(Boolean).join(', ')}
                                </Text>
                                {shippingAddress.phone && (
                                    <Text style={styles.shippingPhone}>
                                        📞 {shippingAddress.phone}
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Real Driver / Courier Dispatch Info */}
                        <View style={styles.driverCard}>
                            <View style={styles.driverHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={styles.driverAvatar}>
                                        <Ionicons name="bicycle" size={20} color="#38BDF8" />
                                    </View>
                                    <View>
                                        <Text style={styles.driverName}>
                                            {driver ? driver.name : 'Assigning Logistics Courier'}
                                        </Text>
                                        <Text style={styles.driverSub}>
                                            {driver
                                                ? `${driver.vehicle_type || 'Dispatch Rider'} ${driver.plate_number ? '• ' + driver.plate_number : ''}`
                                                : 'Dispatch hub assigning nearest rider'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.liveTrackingBadge}>
                                    <View style={[styles.livePulseDot, { backgroundColor: driver ? '#10B981' : '#F59E0B' }]} />
                                    <Text style={[styles.liveTrackingBadgeText, { color: driver ? '#047857' : '#B45309' }]}>
                                        {driver ? 'Active Rider' : 'Assigning'}
                                    </Text>
                                </View>
                            </View>

                            {/* Direct Call / Contact Driver Button if driver is assigned */}
                            {driver && driver.phone && (
                                <View style={styles.driverActionsRow}>
                                    <TouchableOpacity onPress={handleCallDriver} style={styles.driverCallBtn}>
                                        <Ionicons name="call" size={15} color="white" />
                                        <Text style={styles.driverCallBtnTxt}>Call Rider ({driver.phone})</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Live Route Visualizer Canvas */}
                            <View style={styles.mapCanvas}>
                                <Image
                                    source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=600&auto=format&fit=crop' }}
                                    style={styles.mapBackground}
                                />

                                {/* Interactive Route Track */}
                                <View style={styles.routeTrackLine} />

                                {/* Vehicle Icon position based on activeStep */}
                                <View style={[
                                    styles.vehiclePin,
                                    activeStep === 0 && { left: '15%' },
                                    activeStep === 1 && { left: '30%' },
                                    activeStep === 2 && { left: '50%' },
                                    activeStep === 3 && { left: '75%' },
                                    activeStep >= 4 && { left: '88%' }
                                ]}>
                                    <Ionicons name={activeStep >= 4 ? "checkmark-circle" : "car"} size={16} color="white" />
                                </View>

                                {/* Origin Hub Marker */}
                                <View style={styles.originMarker}>
                                    <Text style={styles.markerTag}>HUB</Text>
                                </View>

                                {/* Destination Marker */}
                                <View style={styles.destinationMarker}>
                                    <Ionicons name="home" size={14} color="white" />
                                </View>
                            </View>
                        </View>

                        {/* Action Buttons: WhatsApp Support & Share */}
                        <View style={styles.actionButtonsContainer}>
                            <TouchableOpacity
                                onPress={handleContactSupport}
                                style={styles.whatsappBtn}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="logo-whatsapp" size={20} color="white" />
                                <Text style={styles.whatsappBtnText}>
                                    Live WhatsApp Support & Dispatch Updates
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleShareTracking}
                                style={styles.shareBtn}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="share-social-outline" size={18} color="#38BDF8" />
                                <Text style={styles.shareBtnText}>
                                    Share Live Tracking Link
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
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
        width: 34,
        height: 34,
        resizeMode: 'contain'
    },
    headerTitle: {
        color: '#00D2FF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.6
    },
    headerTagline: {
        color: '#94A3B8',
        fontSize: 7,
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
        height: 42,
        borderWidth: 1,
        borderColor: '#334155'
    },
    searchInput: {
        flex: 1,
        color: 'white',
        fontSize: 13,
        paddingVertical: 0
    },
    searchSubmitBtn: {
        backgroundColor: '#0284C7',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center'
    },
    searchSubmitTxt: {
        color: 'white',
        fontWeight: '800',
        fontSize: 13
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 120
    },
    orderSwitcherSection: {
        marginBottom: 16
    },
    orderSwitcherTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
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
        fontSize: 12,
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
        fontSize: 14,
        color: '#64748B',
        fontWeight: '600'
    },
    emptyStateCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginTop: 20
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 8
    },
    emptyDesc: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20
    },
    emptyTrackBtn: {
        backgroundColor: '#0A192F',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    emptyTrackBtnTxt: {
        color: 'white',
        fontWeight: '800',
        fontSize: 13.5
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16
    },
    pageHeading: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: -0.5
    },
    pageSubheading: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600'
    },
    livePulseDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5
    },
    orderBadge: {
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        paddingVertical: 6,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    orderBadgeRef: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#0A192F'
    },
    orderBadgeDate: {
        fontSize: 9.5,
        color: '#64748B',
        fontWeight: '600'
    },
    cancelledCard: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16
    },
    cancelledTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#991B1B'
    },
    cancelledSub: {
        fontSize: 11.5,
        color: '#B91C1C',
        marginTop: 2,
        lineHeight: 16
    },
    itemsCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2
    },
    itemsCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 12
    },
    itemsCardTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A'
    },
    itemsCardTotal: {
        fontSize: 15,
        fontWeight: '900',
        color: '#059669'
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10
    },
    itemRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC'
    },
    itemImage: {
        width: 58,
        height: 58,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        marginRight: 12
    },
    itemName: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    itemVendor: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
        marginBottom: 3
    },
    itemPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    itemPrice: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#0F172A'
    },
    itemQty: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600'
    },
    itemVariant: {
        fontSize: 11,
        color: '#94A3B8'
    },
    singleFallbackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8
    },
    timelineCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    timelineHeader: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 14
    },
    timelineStepRow: {
        flexDirection: 'row',
        minHeight: 48
    },
    timelineTrackCol: {
        alignItems: 'center',
        width: 28,
        marginRight: 12
    },
    timelineDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2
    },
    timelineDotDone: {
        backgroundColor: '#10B981'
    },
    timelineDotPending: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#CBD5E1'
    },
    timelineDotCurrent: {
        borderColor: '#0284C7',
        borderWidth: 3
    },
    timelineLine: {
        width: 2,
        flex: 1,
        marginVertical: 2
    },
    timelineLineDone: {
        backgroundColor: '#10B981'
    },
    timelineLinePending: {
        backgroundColor: '#E2E8F0'
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 18
    },
    timelineTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    timelineStepTitle: {
        fontSize: 13.5
    },
    timelineStepTime: {
        fontSize: 11,
        fontWeight: '600'
    },
    timelineStepSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    estDeliveryCard: {
        backgroundColor: '#ECFDF5',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#A7F3D0',
        gap: 14
    },
    estIconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center'
    },
    estLabel: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#059669',
        letterSpacing: 0.6
    },
    estDate: {
        fontSize: 16,
        fontWeight: '900',
        color: '#064E3B',
        marginTop: 1
    },
    estNote: {
        fontSize: 11,
        color: '#047857',
        fontWeight: '500',
        marginTop: 1
    },
    shippingCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    shippingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8
    },
    shippingTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0F172A',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    shippingRecipient: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 2
    },
    shippingText: {
        fontSize: 12.5,
        color: '#475569',
        lineHeight: 18
    },
    shippingCity: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    shippingPhone: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0284C7',
        marginTop: 4
    },
    driverCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    driverHeader: {
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    driverAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#0A192F',
        alignItems: 'center',
        justifyContent: 'center'
    },
    driverName: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    driverSub: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '500'
    },
    liveTrackingBadge: {
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#BBF7D0',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5
    },
    liveTrackingBadgeText: {
        fontSize: 11,
        fontWeight: '800'
    },
    driverActionsRow: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    driverCallBtn: {
        backgroundColor: '#0284C7',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
    },
    driverCallBtnTxt: {
        color: 'white',
        fontWeight: '800',
        fontSize: 12.5
    },
    mapCanvas: {
        height: 120,
        backgroundColor: '#E2E8F0',
        position: 'relative',
        overflow: 'hidden'
    },
    mapBackground: {
        width: '100%',
        height: '100%',
        opacity: 0.25
    },
    routeTrackLine: {
        position: 'absolute',
        left: 40,
        right: 40,
        top: 58,
        height: 4,
        backgroundColor: '#0284C7',
        borderRadius: 2
    },
    vehiclePin: {
        position: 'absolute',
        top: 45,
        backgroundColor: '#0A192F',
        padding: 6,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3
    },
    originMarker: {
        position: 'absolute',
        left: 24,
        top: 48,
        backgroundColor: '#475569',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6
    },
    markerTag: {
        color: 'white',
        fontSize: 9,
        fontWeight: '900'
    },
    destinationMarker: {
        position: 'absolute',
        right: 24,
        top: 45,
        backgroundColor: '#059669',
        padding: 6,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'white'
    },
    actionButtonsContainer: {
        gap: 10
    },
    whatsappBtn: {
        backgroundColor: '#16A34A',
        borderRadius: 16,
        paddingVertical: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3
    },
    whatsappBtnText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 13.5
    },
    shareBtn: {
        backgroundColor: '#0A192F',
        borderRadius: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8
    },
    shareBtnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 13
    }
});
