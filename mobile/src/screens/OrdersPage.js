import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, ActivityIndicator,
    SafeAreaView, ScrollView, Image, Share, Linking, RefreshControl,
    TextInput, Alert, Modal, StatusBar, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const STATUS_CFG = {
    pending: { color: '#D97706', bg: '#FEF3C7', icon: 'time-outline', label: 'Pending' },
    processing: { color: '#2563EB', bg: '#DBEAFE', icon: 'reload-outline', label: 'Processing' },
    shipped: { color: '#7C3AED', bg: '#EDE9FE', icon: 'bicycle-outline', label: 'Shipped' },
    delivered: { color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle', label: 'Delivered' },
    cancelled: { color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline', label: 'Cancelled' },
};
const STEPS = ['pending', 'processing', 'shipped', 'delivered'];
const FILTERS = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

function getImg(images) {
    if (!images) return null;
    if (Array.isArray(images)) return images[0] || null;
    if (typeof images === 'string') {
        try { const a = JSON.parse(images); return Array.isArray(a) ? a[0] : images; } catch { return images; }
    }
    return null;
}

export const OrdersPage = ({ onBack, user, onNavigate }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState(null);

    // Review modal
    const [reviewModal, setReviewModal] = useState(null); // { order, item, type: 'product' | 'driver' }
    const [reviewText, setReviewText] = useState('');
    const [reviewRating, setRating] = useState(5);
    const [submitting, setSubmitting] = useState(false);

    // Cancel / Confirm order
    const [cancelling, setCancelling] = useState(null);
    const [confirming, setConfirming] = useState(null);

    useEffect(() => { if (user) fetchOrders(); }, [user]);

    const fetchOrders = async () => {
        if (!user) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*, driver:drivers(id, name), order_items(id, quantity, price, variant, product_id, product:products(id, name, images))')
            .eq('user_id', user.id || user.sub)
            .order('created_at', { ascending: false });
        if (!error) setOrders(data || []);
        setLoading(false);
        setRefreshing(false);
    };

    const stats = useMemo(() => ({
        total: orders.length,
        active: orders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status)).length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        spend: orders.reduce((s, o) => s + (o.total_amount || 0), 0), // sum all orders
    }), [orders]);

    const filtered = useMemo(() => {
        let r = orders;
        if (filter !== 'All') r = r.filter(o => o.status?.toLowerCase() === filter.toLowerCase());
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter(o => o.id.toLowerCase().includes(q) || o.payment_reference?.toLowerCase().includes(q));
        }
        return r;
    }, [orders, filter, search]);

    // ── Cancel Order ──────────────────────────────────────────────────────────
    const handleCancel = (order) => {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`Cancel order #${order.id.slice(0, 8).toUpperCase()}?\n\nThis action cannot be undone.`);
            if (confirmed) {
                executeCancel(order.id);
            }
        } else {
            Alert.alert(
                'Cancel Order',
                `Cancel order #${order.id.slice(0, 8).toUpperCase()}?\n\nThis action cannot be undone.`,
                [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes, Cancel', style: 'destructive', onPress: () => executeCancel(order.id) }
                ]
            );
        }
    };

    const executeCancel = async (orderId) => {
        setCancelling(orderId);
        const { error } = await supabase.from('orders')
            .update({ status: 'cancelled' })
            .eq('id', orderId)
            .eq('user_id', user.id || user.sub);
        if (!error) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o));
            if (Platform.OS === 'web') {
                window.alert('Your order has been cancelled.');
            } else {
                Alert.alert('Cancelled', 'Your order has been cancelled.');
            }
        } else {
            if (Platform.OS === 'web') {
                window.alert('Could not cancel. Please contact support.');
            } else {
                Alert.alert('Error', 'Could not cancel. Please contact support.');
            }
        }
        setCancelling(null);
    };

    // ── Confirm Receipt ───────────────────────────────────────────────────────
    const handleConfirmReceipt = (order) => {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`Have you received order #${order.id.slice(0, 8).toUpperCase()} in good condition?\n\nThis will complete the order and release payment to the seller.`);
            if (confirmed) {
                executeConfirm(order.id);
            }
        } else {
            Alert.alert(
                'Confirm Receipt',
                `Have you received order #${order.id.slice(0, 8).toUpperCase()} in good condition?\n\nThis will complete the order and release payment to the seller.`,
                [
                    { text: 'Not Yet', style: 'cancel' },
                    { text: 'Yes, I received it', onPress: () => executeConfirm(order.id) }
                ]
            );
        }
    };

    const executeConfirm = async (orderId) => {
        setConfirming(orderId);
        try {
            const { error } = await supabase.rpc('confirm_order_receipt', { p_order_id: orderId });
            if (error) throw error;

            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, user_confirmed: true } : o));

            if (Platform.OS === 'web') {
                window.alert('Order confirmed! Thank you for shopping with us.');
            } else {
                Alert.alert('Success', 'Order confirmed! Thank you for shopping with us.');
            }
        } catch (err) {
            if (Platform.OS === 'web') {
                window.alert(err.message || 'Could not confirm order.');
            } else {
                Alert.alert('Error', err.message || 'Could not confirm order.');
            }
        } finally {
            setConfirming(null);
        }
    };

    // ── Submit Review ─────────────────────────────────────────────────────────
    const submitReview = async () => {
        if (!reviewModal) return;
        setSubmitting(true);
        try {
            const isDriver = reviewModal.type === 'driver';
            await supabase.from('reviews').insert({
                user_id: user.id || user.sub,
                product_id: isDriver ? null : reviewModal.item?.product_id,
                driver_id: isDriver ? reviewModal.order?.driver_id : null,
                order_id: reviewModal.order?.id,
                review_type: reviewModal.type || 'product',
                rating: reviewRating,
                comment: reviewText.trim(),
            });
            setReviewModal(null);
            setReviewText('');
            setRating(5);
            Alert.alert('Thank you!', 'Your review has been submitted.');
        } catch (e) {
            Alert.alert('Error', 'Could not submit review. Please try again.');
        }
        setSubmitting(false);
    };

    // ── Share Order ───────────────────────────────────────────────────────────
    const shareOrder = (order) => {
        Share.share({
            message: `📦 Abu Mafhal Order\n#${order.id.slice(0, 8).toUpperCase()}\nStatus: ${order.status?.toUpperCase()}\nTotal: ₦${order.total_amount?.toLocaleString()}\nDate: ${new Date(order.created_at).toLocaleDateString()}`
        });
    };

    // ── Contact Support ───────────────────────────────────────────────────────
    const contactSupport = (order) => {
        const msg = encodeURIComponent(`Hi Abu Mafhal Support, I need help with order #${order.id.slice(0, 8).toUpperCase()}`);
        Linking.openURL(`whatsapp://send?phone=+2348145853539&text=${msg}`)
            .catch(() => Linking.openURL('mailto:support@abumafhal.com'));
    };

    // ── Render Card ───────────────────────────────────────────────────────────
    const renderCard = ({ item }) => {
        const status = item.status?.toLowerCase() || 'pending';
        const cfg = STATUS_CFG[status] || { color: '#64748B', bg: '#F1F5F9', icon: 'help-circle-outline', label: status };
        const isExpanded = expandedId === item.id;
        const isCancelled = status === 'cancelled';
        const isDelivered = status === 'delivered';
        const isConfirmed = isDelivered && item.user_confirmed === true;
        const needsConfirmation = isDelivered && !isConfirmed;
        const canCancel = ['pending', 'processing'].includes(status);
        const stepIndex = STEPS.indexOf(status);
        const items = item.order_items || [];
        const images = items.slice(0, 5).map(oi => getImg(oi.product?.images)).filter(Boolean);

        return (
            <View style={C.card}>
                {/* Header row */}
                <TouchableOpacity activeOpacity={0.85} onPress={() => setExpandedId(isExpanded ? null : item.id)}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        {/* Left: icon + ID + date */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View style={[C.iconBox, { backgroundColor: cfg.bg }]}>
                                <Ionicons name={cfg.icon} size={17} color={cfg.color} />
                            </View>
                            <View>
                                <Text style={C.orderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                                <Text style={C.orderDate}>{new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                            </View>
                        </View>
                        {/* Right: badge + amount */}
                        <View style={{ alignItems: 'flex-end' }}>
                            <View style={[C.statusBadge, { backgroundColor: cfg.bg }]}>
                                <Text style={[C.statusText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 4 }}>
                                ₦{(item.total_amount || 0).toLocaleString()}
                            </Text>
                        </View>
                    </View>

                    {/* Product image strip */}
                    {images.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 7, marginTop: 12 }}>
                            {images.map((url, i) => (
                                <Image key={i} source={{ uri: url }} style={C.thumb} resizeMode="cover" />
                            ))}
                            {items.length > 5 && (
                                <View style={[C.thumb, { backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }]}>
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 12 }}>+{items.length - 5}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Delivery date estimate */}
                    {!isCancelled && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}>
                            <Ionicons name="calendar-outline" size={13} color="#64748B" />
                            <Text style={{ fontSize: 12, color: '#64748B' }}>
                                {isDelivered
                                    ? '✅ Delivered'
                                    : `Est. delivery: ${new Date(new Date(item.created_at).getTime() + 5 * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                                }
                            </Text>
                        </View>
                    )}

                    {/* Progress Steps */}
                    {!isCancelled && (
                        <View style={{ marginTop: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {STEPS.map((step, i) => {
                                    const done = i <= stepIndex;
                                    return (
                                        <React.Fragment key={step}>
                                            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: done ? '#0F172A' : '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                                                {done ? <Ionicons name="checkmark" size={11} color="white" /> : <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' }} />}
                                            </View>
                                            {i < STEPS.length - 1 && <View style={{ flex: 1, height: 2, backgroundColor: i < stepIndex ? '#0F172A' : '#E2E8F0' }} />}
                                        </React.Fragment>
                                    );
                                })}
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                                {STEPS.map(s => <Text key={s} style={{ fontSize: 8, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', width: 20, textAlign: 'center' }}>{s.slice(0, 4)}</Text>)}
                            </View>
                        </View>
                    )}

                    {isCancelled && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 10, marginTop: 10 }}>
                            <Ionicons name="close-circle" size={14} color="#DC2626" />
                            <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600' }}>Order Cancelled</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Expanded Content */}
                {isExpanded && (
                    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 14 }}>

                        {/* Items list */}
                        <Text style={C.sectionLabel}>ITEMS ORDERED</Text>
                        {items.length > 0 ? items.map((oi, i) => {
                            const imgUrl = getImg(oi.product?.images);
                            return (
                                <View key={oi.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    {imgUrl
                                        ? <Image source={{ uri: imgUrl }} style={C.itemImg} resizeMode="cover" />
                                        : <View style={[C.itemImg, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                                            <Ionicons name="image-outline" size={18} color="#CBD5E1" />
                                        </View>
                                    }
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 13 }}>{oi.product?.name || 'Product'}</Text>
                                        <Text style={{ color: '#64748B', fontSize: 12 }}>Qty: {oi.quantity}{oi.variant ? ` • ${oi.variant}` : ''}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontWeight: '800', color: '#0F172A' }}>₦{((oi.price || 0) * (oi.quantity || 1)).toLocaleString()}</Text>
                                        {/* Leave Review button per item */}
                                        {isConfirmed && (
                                            <TouchableOpacity onPress={() => { setReviewModal({ order: item, item: oi, type: 'product' }); setReviewText(''); setRating(5); }}
                                                style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                                <Ionicons name="star-outline" size={11} color="#F59E0B" />
                                                <Text style={{ fontSize: 10, color: '#F59E0B', fontWeight: '700' }}>Review</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        }) : <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 10 }}>No item details found.</Text>}

                        {/* Delivery address */}
                        {item.shipping_address && (
                            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 10, marginBottom: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                <Ionicons name="location" size={15} color="#16A34A" />
                                <Text style={{ flex: 1, fontSize: 12, color: '#166534' }}>
                                    {(() => {
                                        const a = item.shipping_address;
                                        if (typeof a === 'object' && a) return a.address || JSON.stringify(a);
                                        try { const p = JSON.parse(a); return p?.address || a; } catch { return a; }
                                    })()}
                                </Text>
                            </View>
                        )}

                        {/* Payment summary */}
                        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, marginBottom: 14 }}>
                            <Text style={C.sectionLabel}>PAYMENT SUMMARY</Text>
                            {[
                                ['Method', item.payment_method || 'N/A'],
                                ['Shipping', `₦${(item.shipping_fee || 0).toLocaleString()}`],
                                item.discount_applied > 0 && ['Discount', `-₦${(item.discount_applied || 0).toLocaleString()}`],
                            ].filter(Boolean).map(([l, v]) => (
                                <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <Text style={{ color: '#64748B', fontSize: 12 }}>{l}</Text>
                                    <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 12 }}>{v}</Text>
                                </View>
                            ))}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                                <Text style={{ fontWeight: '800', color: '#0F172A' }}>Total Paid</Text>
                                <Text style={{ fontWeight: '900', color: '#0F172A', fontSize: 16 }}>₦{(item.total_amount || 0).toLocaleString()}</Text>
                            </View>
                        </View>

                        {/* Action Buttons */}
                        <View style={{ gap: 10 }}>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity onPress={() => onNavigate('TrackOrder', { order: item })}
                                    style={[C.btn, { backgroundColor: '#0F172A', flex: 2 }]}>
                                    <Ionicons name="location-outline" size={15} color="white" />
                                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Track Order</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => shareOrder(item)}
                                    style={[C.btn, { backgroundColor: '#F1F5F9', flex: 1 }]}>
                                    <Ionicons name="share-outline" size={15} color="#0F172A" />
                                    <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 13 }}>Share</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity onPress={() => onNavigate('shop')}
                                    style={[C.btn, { backgroundColor: '#EFF6FF', flex: 1 }]}>
                                    <Ionicons name="refresh-outline" size={14} color="#2563EB" />
                                    <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 12 }}>Reorder</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => contactSupport(item)}
                                    style={[C.btn, { backgroundColor: '#F0FDF4', flex: 1 }]}>
                                    <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                                    <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 12 }}>Support</Text>
                                </TouchableOpacity>
                                {canCancel && (
                                    <TouchableOpacity
                                        onPress={() => handleCancel(item)}
                                        disabled={cancelling === item.id}
                                        style={[C.btn, { backgroundColor: '#FEF2F2', flex: 1 }]}>
                                        {cancelling === item.id
                                            ? <ActivityIndicator size="small" color="#DC2626" />
                                            : <>
                                                <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
                                                <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>Cancel</Text>
                                            </>
                                        }
                                    </TouchableOpacity>
                                )}
                                {needsConfirmation && (
                                    <TouchableOpacity
                                        onPress={() => handleConfirmReceipt(item)}
                                        disabled={confirming === item.id}
                                        style={[C.btn, { backgroundColor: '#16A34A', flex: 1.5 }]}>
                                        {confirming === item.id
                                            ? <ActivityIndicator size="small" color="white" />
                                            : <>
                                                <Ionicons name="checkmark-done" size={15} color="white" />
                                                <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Confirm Receipt</Text>
                                            </>
                                        }
                                    </TouchableOpacity>
                                )}
                                {isConfirmed && item.driver_id && (
                                    <TouchableOpacity onPress={() => { setReviewModal({ order: item, type: 'driver' }); setReviewText(''); setRating(5); }}
                                        style={[C.btn, { backgroundColor: '#FEF3C7', flex: 1 }]}>
                                        <Ionicons name="star" size={14} color="#D97706" />
                                        <Text style={{ color: '#D97706', fontWeight: '700', fontSize: 12 }}>Rate Driver</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                )}

                {/* Expand toggle */}
                <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : item.id)} style={{ alignItems: 'center', marginTop: 10 }}>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#CBD5E1" />
                </TouchableOpacity>
            </View>
        );
    };

    // ── List header: stats + search + filters (scrolls with list) ──────────────
    const ListHeader = () => (
        <View>
            {/* Stats chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 10 }}>
                {[
                    { label: 'Total Spend', value: `₦${stats.spend.toLocaleString()}`, icon: 'wallet-outline', color: '#2563EB' },
                    { label: 'Active', value: stats.active, icon: 'time-outline', color: '#D97706' },
                    { label: 'Delivered', value: stats.delivered, icon: 'checkmark-done', color: '#16A34A' },
                    { label: 'All Orders', value: stats.total, icon: 'list-outline', color: '#7C3AED' },
                ].map(s => (
                    <View key={s.label} style={{ backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 }}>
                        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: s.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name={s.icon} size={14} color={s.color} />
                        </View>
                        <View>
                            <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' }}>{s.label}</Text>
                            <Text style={{ color: '#0F172A', fontSize: 15, fontWeight: '900' }}>{s.value}</Text>
                        </View>
                    </View>
                ))}
            </ScrollView>

            {/* Search bar */}
            <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 }}>
                    <Ionicons name="search" size={16} color="#94A3B8" />
                    <TextInput
                        placeholder="Search by ID or reference..."
                        placeholderTextColor="#94A3B8"
                        style={{ flex: 1, fontSize: 14, color: '#0F172A' }}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
                {FILTERS.map(f => (
                    <TouchableOpacity
                        key={f}
                        onPress={() => setFilter(f)}
                        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: filter === f ? '#0F172A' : 'white', borderWidth: 1, borderColor: filter === f ? '#0F172A' : '#E2E8F0' }}
                    >
                        <Text style={{ color: filter === f ? 'white' : '#64748B', fontSize: 12, fontWeight: '700' }}>{f}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Loading spinner */}
            {loading && !refreshing && <ActivityIndicator size="large" color="#0F172A" style={{ marginTop: 40 }} />}
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>

            {/* ── Header — pushes below status bar ── */}
            <StatusBar backgroundColor="#0F172A" barStyle="light-content" />
            <View style={{ backgroundColor: '#0F172A', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 14, paddingBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={onBack}
                        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
                    >
                        <Ionicons name="arrow-back" size={18} color="white" />
                    </TouchableOpacity>
                    <Text style={{ color: 'white', fontSize: 17, fontWeight: '900', flex: 1 }}>My Orders</Text>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' }}>{orders.length} total</Text>
                    </View>
                </View>
            </View>

            {/* ── Single FlatList — stats + search + filters scroll WITH content ── */}
            <FlatList
                data={loading && !refreshing ? [] : filtered}
                keyExtractor={o => o.id}
                renderItem={renderCard}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                ListHeaderComponent={<ListHeader />}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} colors={['#0F172A']} />}
                ListEmptyComponent={
                    !loading ? (
                        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                                <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
                            </View>
                            <Text style={{ fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>No Orders Found</Text>
                            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                                {filter !== 'All' ? `No ${filter} orders yet.` : "You haven't placed any orders yet."}
                            </Text>
                            <TouchableOpacity
                                onPress={() => onNavigate('shop')}
                                style={{ marginTop: 20, backgroundColor: '#0F172A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                            >
                                <Ionicons name="bag-outline" size={15} color="white" />
                                <Text style={{ color: 'white', fontWeight: '700' }}>Start Shopping</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null
                }
            />

            {/* ── Review Modal ── */}
            <Modal visible={!!reviewModal} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 4 }}>
                            {reviewModal?.type === 'driver' ? 'Rate your Driver' : 'Leave a Review'}
                        </Text>
                        <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>
                            {reviewModal?.type === 'driver' ? (reviewModal?.order?.driver?.name || 'Driver') : (reviewModal?.item?.product?.name || 'Product')}
                        </Text>

                        {/* Star Rating */}
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                            {[1, 2, 3, 4, 5].map(n => (
                                <TouchableOpacity key={n} onPress={() => setRating(n)}>
                                    <Ionicons name={n <= reviewRating ? 'star' : 'star-outline'} size={32} color="#F59E0B" />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 14, color: '#0F172A', minHeight: 80, backgroundColor: '#F8FAFC', marginBottom: 16 }}
                            placeholder="Write your experience..."
                            placeholderTextColor="#94A3B8"
                            value={reviewText}
                            onChangeText={setReviewText}
                            multiline
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity onPress={() => setReviewModal(null)}
                                style={{ flex: 1, padding: 14, backgroundColor: '#F1F5F9', borderRadius: 14, alignItems: 'center' }}>
                                <Text style={{ fontWeight: '700', color: '#64748B' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={submitReview} disabled={submitting}
                                style={{ flex: 2, padding: 14, backgroundColor: '#F59E0B', borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                                {submitting ? <ActivityIndicator color="white" size="small" /> : <>
                                    <Ionicons name="star" size={15} color="white" />
                                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>Submit Review</Text>
                                </>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const C = {
    card: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 13, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    iconBox: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    orderId: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
    orderDate: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
    thumb: { width: 52, height: 52, borderRadius: 13, backgroundColor: '#F1F5F9' },
    itemImg: { width: 46, height: 46, borderRadius: 12 },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 13 },
    sectionLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 8 },
};
