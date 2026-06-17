import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Image, Linking,
    Alert, Share, Animated, StatusBar, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { WhatsAppActionModal } from '../components/WhatsAppActionModal';

const STEPS = [
    { key: 'pending', title: 'Order Placed', desc: 'We received your order successfully.', icon: 'document-text-outline' },
    { key: 'processing', title: 'Preparing', desc: 'Your items are being packed by the seller.', icon: 'cube-outline' },
    { key: 'shipped', title: 'On the Way', desc: 'Your driver is heading to your address.', icon: 'bicycle-outline' },
    { key: 'delivered', title: 'Delivered', desc: 'Your package has arrived. Enjoy!', icon: 'checkmark-circle-outline' },
];

function getImg(images) {
    if (!images) return null;
    if (Array.isArray(images)) return images[0] || null;
    try { const a = JSON.parse(images); return Array.isArray(a) ? a[0] : images; } catch { return images; }
}

function formatAddress(addr) {
    if (!addr) return 'Address not set';
    if (typeof addr === 'string') {
        try { const p = JSON.parse(addr); return p?.address || p?.street || addr; } catch { return addr; }
    }
    return addr?.address || addr?.street || JSON.stringify(addr);
}

export const TrackOrderPage = ({ navigation, route, onBack, order: propOrder }) => {
    // Support both React Navigation and custom nav patterns
    const order = propOrder || route?.params?.order;
    const goBack = onBack || (() => navigation?.goBack());

    const [driver, setDriver] = useState(order?.driver || null);
    const [orderItems, setItems] = useState(order?.order_items || []);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [timeline, setTimeline] = useState([]);
    const [whatsappVisible, setWhatsappVisible] = useState(false);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [whatsappRecipientName, setWhatsappRecipientName] = useState('');

    // Pulse animation for current step dot
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.4, duration: 700, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, []);

    useEffect(() => {
        if (!order) return;
        fetchExtras();
    }, [order]);

    const fetchExtras = async () => {
        setLoading(true);
        try {
            // Fetch driver if not already embedded
            if (order.driver_id && !order.driver) {
                const { data: d } = await supabase.from('drivers').select('*').eq('id', order.driver_id).single();
                if (d) setDriver(d);
            }
            // Fetch order items with product images if not already embedded
            if (!order.order_items || order.order_items.length === 0) {
                const { data: items } = await supabase
                    .from('order_items')
                    .select('*, product:products(name, images)')
                    .eq('order_id', order.id);
                if (items) setItems(items);
            }
            // Fetch status history timeline
            const { data: logs } = await supabase
                .from('order_status_logs')
                .select('*')
                .eq('order_id', order.id)
                .order('created_at', { ascending: true });
            if (logs) setTimeline(logs);
        } catch (e) {
            console.log('TrackOrder fetch error:', e);
        }
        setLoading(false);
    };

    if (!order) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
                <Ionicons name="alert-circle-outline" size={48} color="#CBD5E1" />
                <Text style={{ color: '#64748B', marginTop: 12, fontSize: 15 }}>Order information missing.</Text>
                <TouchableOpacity onPress={goBack} style={{ marginTop: 20, backgroundColor: '#0F172A', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 }}>
                    <Text style={{ color: 'white', fontWeight: '700' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const status = order.status?.toLowerCase() || 'pending';
    const isCancelled = status === 'cancelled';
    const isDelivered = status === 'delivered';
    const stepIndex = isCancelled ? -1 : STEPS.findIndex(s => s.key === status);

    // Estimated delivery
    const estDate = new Date(new Date(order.created_at).getTime() + 5 * 86400000);
    const estLabel = isDelivered ? 'Delivered ✅' : isCancelled ? 'Cancelled ❌' : `Est. ${estDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;

    const handleCopy = () => {
        try {
            const { Clipboard } = require('react-native');
            Clipboard.setString(order.id);
        } catch { }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        Alert.alert('Copied!', 'Order ID copied to clipboard.');
    };

    const handleWhatsAppDriver = () => {
        if (!driver?.phone) { Alert.alert('No Driver', 'No driver assigned yet.'); return; }
        setWhatsappPhone(driver.phone);
        setWhatsappRecipientName(driver.name || 'Driver');
        setWhatsappVisible(true);
    };

    const handleCallDriver = () => {
        if (!driver?.phone) { Alert.alert('No Driver', 'No driver assigned yet.'); return; }
        Linking.openURL(`tel:${driver.phone}`);
    };

    const handleOpenMaps = () => {
        const addr = encodeURIComponent(formatAddress(order.shipping_address));
        Linking.openURL(`https://maps.google.com/?q=${addr}`);
    };

    const handleShare = () => {
        Share.share({
            message: `📦 Order #${order.id.slice(0, 8).toUpperCase()}\nStatus: ${status.toUpperCase()}\nTotal: ₦${(order.total_amount || 0).toLocaleString()}\n${estLabel}`
        });
    };

    const handleCancel = () => {
        Alert.alert('Cancel Order?', 'Are you sure you want to cancel this order?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
                    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
                    Alert.alert('Cancelled', 'Your order has been cancelled.');
                    goBack();
                }
            }
        ]);
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar backgroundColor="#0F172A" barStyle="light-content" />

            {/* ── Hero Header ── */}
            <View style={{ backgroundColor: '#0F172A', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 6 : 52, paddingBottom: 28, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}>
                {/* Top row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <TouchableOpacity onPress={goBack} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name="arrow-back" size={20} color="white" />
                    </TouchableOpacity>
                    <Text style={{ color: 'white', fontSize: 17, fontWeight: '900', flex: 1 }}>Track Order</Text>
                    <TouchableOpacity onPress={handleShare} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="share-outline" size={19} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Order ID + copy */}
                <TouchableOpacity onPress={handleCopy} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>ORDER ID</Text>
                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>#{order.id.slice(0, 8).toUpperCase()}</Text>
                    <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={14} color={copied ? '#34D399' : 'rgba(255,255,255,0.5)'} />
                </TouchableOpacity>

                {/* Status row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isCancelled ? 'rgba(239,68,68,0.2)' : isDelivered ? 'rgba(22,163,74,0.2)' : 'rgba(59,130,246,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isCancelled ? '#EF4444' : isDelivered ? '#22C55E' : '#60A5FA' }} />
                        <Text style={{ color: isCancelled ? '#FCA5A5' : isDelivered ? '#86EFAC' : '#93C5FD', fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }}>
                            {status}
                        </Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' }}>{estLabel}</Text>
                    </View>
                </View>

                {/* Total */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Total Amount</Text>
                    <Text style={{ color: 'white', fontSize: 22, fontWeight: '900' }}>₦{(order.total_amount || 0).toLocaleString()}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

                {/* ── Driver Card ── */}
                <View style={{ margin: 16, backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 }}>
                    <Text style={S.sectionLabel}>DELIVERY DRIVER</Text>
                    {loading
                        ? <ActivityIndicator color="#0F172A" />
                        : driver ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Image
                                    source={{ uri: driver.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.name)}&background=0F172A&color=fff` }}
                                    style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#F1F5F9', marginRight: 14 }}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>{driver.name}</Text>
                                    <Text style={{ fontSize: 12, color: '#64748B' }}>{driver.vehicle_type} • {driver.vehicle_plate_number || 'N/A'}</Text>
                                    {driver.rating && <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 3 }}>
                                        <Ionicons name="star" size={11} color="#F59E0B" />
                                        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700' }}>{driver.rating}</Text>
                                    </View>}
                                </View>
                                <View style={{ gap: 8 }}>
                                    <TouchableOpacity onPress={handleCallDriver} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="call" size={18} color="white" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleWhatsAppDriver} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="logo-whatsapp" size={18} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : isCancelled ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 4 }}>
                                <Ionicons name="close-circle" size={22} color="#EF4444" />
                                <Text style={{ color: '#64748B', fontSize: 13 }}>Order was cancelled — no driver assigned.</Text>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 4 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="bicycle" size={20} color="#CBD5E1" />
                                </View>
                                <View>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>Finding your driver...</Text>
                                    <Text style={{ fontSize: 12, color: '#64748B' }}>We're looking for a nearby rider</Text>
                                </View>
                            </View>
                        )
                    }
                </View>

                {/* ── Order Timeline ── */}
                <View style={{ marginHorizontal: 16, backgroundColor: 'white', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 }}>
                    <Text style={S.sectionLabel}>ORDER TIMELINE</Text>

                    {isCancelled && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                            <Ionicons name="close-circle" size={18} color="#DC2626" />
                            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>This order was cancelled</Text>
                        </View>
                    )}

                    {STEPS.map((step, i) => {
                        const done = !isCancelled && i <= stepIndex;
                        const current = !isCancelled && i === stepIndex;
                        const isLast = i === STEPS.length - 1;
                        // Find matching timeline log
                        const log = timeline.find(l => l.status?.toLowerCase() === step.key);

                        return (
                            <View key={step.key} style={{ flexDirection: 'row', minHeight: 70 }}>
                                {/* Dot + line */}
                                <View style={{ alignItems: 'center', marginRight: 16, width: 28 }}>
                                    {current ? (
                                        <Animated.View style={{ transform: [{ scale: pulse }], width: 28, height: 28, borderRadius: 14, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name={step.icon} size={13} color="white" />
                                        </Animated.View>
                                    ) : (
                                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: done ? '#0F172A' : '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: done ? '#0F172A' : '#E2E8F0' }}>
                                            <Ionicons name={step.icon} size={13} color={done ? 'white' : '#CBD5E1'} />
                                        </View>
                                    )}
                                    {!isLast && <View style={{ width: 2, flex: 1, backgroundColor: done && !current ? '#0F172A' : '#E2E8F0', marginVertical: 4 }} />}
                                </View>
                                {/* Content */}
                                <View style={{ flex: 1, paddingBottom: 24 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 14, fontWeight: done ? '800' : '600', color: done ? '#0F172A' : '#94A3B8' }}>{step.title}</Text>
                                        {log && <Text style={{ fontSize: 10, color: '#94A3B8' }}>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>}
                                    </View>
                                    <Text style={{ fontSize: 12, color: done ? '#475569' : '#94A3B8', marginTop: 2 }}>{step.desc}</Text>
                                    {log?.note && <Text style={{ fontSize: 11, color: '#3B82F6', marginTop: 3, fontStyle: 'italic' }}>"{log.note}"</Text>}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* ── Delivery Address ── */}
                {order.shipping_address && (
                    <TouchableOpacity onPress={handleOpenMaps} style={{ marginHorizontal: 16, backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 }}>
                        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="location" size={20} color="#16A34A" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={S.sectionLabel}>DELIVERY ADDRESS</Text>
                            <Text style={{ fontSize: 13, color: '#0F172A', fontWeight: '600', marginTop: 1 }}>{formatAddress(order.shipping_address)}</Text>
                        </View>
                        <Ionicons name="open-outline" size={16} color="#16A34A" />
                    </TouchableOpacity>
                )}

                {/* ── Products Ordered ── */}
                {orderItems.length > 0 && (
                    <View style={{ marginHorizontal: 16, backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 }}>
                        <Text style={S.sectionLabel}>ITEMS ORDERED</Text>
                        {orderItems.map((oi, i) => {
                            const imgUrl = getImg(oi.product?.images);
                            return (
                                <View key={oi.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: i < orderItems.length - 1 ? 1 : 0, borderBottomColor: '#F8FAFC' }}>
                                    {imgUrl
                                        ? <Image source={{ uri: imgUrl }} style={{ width: 50, height: 50, borderRadius: 12, backgroundColor: '#F1F5F9' }} resizeMode="cover" />
                                        : <View style={{ width: 50, height: 50, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="image-outline" size={20} color="#CBD5E1" />
                                        </View>
                                    }
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 13 }}>{oi.product?.name || 'Product'}</Text>
                                        <Text style={{ color: '#64748B', fontSize: 12 }}>Qty: {oi.quantity}{oi.variant ? ` · ${oi.variant}` : ''}</Text>
                                    </View>
                                    <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13 }}>₦{((oi.price || 0) * (oi.quantity || 1)).toLocaleString()}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* ── Payment Summary ── */}
                <View style={{ marginHorizontal: 16, backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 }}>
                    <Text style={S.sectionLabel}>PAYMENT SUMMARY</Text>
                    {[
                        ['Method', order.payment_method || 'N/A'],
                        ['Shipping', `₦${(order.shipping_fee || 0).toLocaleString()}`],
                        order.discount_applied > 0 && ['Discount', `-₦${(order.discount_applied || 0).toLocaleString()}`],
                    ].filter(Boolean).map(([label, val], i) => (
                        <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                            <Text style={{ color: '#64748B', fontSize: 13 }}>{label}</Text>
                            <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 13 }}>{val}</Text>
                        </View>
                    ))}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                        <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 14 }}>Total</Text>
                        <Text style={{ fontWeight: '900', color: '#0F172A', fontSize: 18 }}>₦{(order.total_amount || 0).toLocaleString()}</Text>
                    </View>
                </View>

                {/* ── Quick Action Buttons ── */}
                <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 }}>
                    <TouchableOpacity onPress={handleShare} style={[S.btn, { backgroundColor: '#EFF6FF', flex: 1 }]}>
                        <Ionicons name="share-outline" size={16} color="#2563EB" />
                        <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 13 }}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleOpenMaps} style={[S.btn, { backgroundColor: '#F0FDF4', flex: 1 }]}>
                        <Ionicons name="navigate-outline" size={16} color="#16A34A" />
                        <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 13 }}>Navigate</Text>
                    </TouchableOpacity>
                    {driver && (
                        <TouchableOpacity onPress={handleWhatsAppDriver} style={[S.btn, { backgroundColor: '#F0FDF4', flex: 1 }]}>
                            <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                            <Text style={{ color: '#25D366', fontWeight: '700', fontSize: 13 }}>Driver</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── Cancel Order ── */}
                {['pending', 'processing'].includes(status) && (
                    <TouchableOpacity onPress={handleCancel} style={{ marginHorizontal: 16, marginBottom: 16, padding: 16, backgroundColor: '#FEF2F2', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                        <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 14 }}>Cancel Order</Text>
                    </TouchableOpacity>
                )}

                {/* ── Delivered - Leave Review nudge ── */}
                {isDelivered && (
                    <View style={{ marginHorizontal: 16, backgroundColor: '#FFFBEB', borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Ionicons name="star" size={24} color="#F59E0B" />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '800', color: '#92400E', fontSize: 14 }}>How was your order?</Text>
                            <Text style={{ color: '#B45309', fontSize: 12, marginTop: 2 }}>Go to My Orders to leave a review for each item.</Text>
                        </View>
                    </View>
                )}

            </ScrollView>
            <WhatsAppActionModal
                visible={whatsappVisible}
                phone={whatsappPhone}
                recipientName={whatsappRecipientName}
                orderData={order}
                onClose={() => setWhatsappVisible(false)}
            />
        </View>
    );
};

const S = {
    sectionLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
};
