import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, ActivityIndicator,
    SafeAreaView, ScrollView, Image, Share, Linking, RefreshControl,
    TextInput, Alert, Modal, StatusBar, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { useAppSettings } from '../context/AppSettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { whatsappService } from '../services/whatsappService';

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

export const getOrderPssMetrics = (item) => {
    if (!item) return null;
    const rawPlan = item.installment_plan || item.shipping_details?.installment_plan || item.metadata?.installment_plan;
    const plan = typeof rawPlan === 'string' ? (() => { try { return JSON.parse(rawPlan); } catch (_) { return null; } })() : rawPlan;
    const isPss = !!(
        plan ||
        (item.payment_method && item.payment_method.toLowerCase().includes('small')) ||
        (item.payment_method && item.payment_method.toLowerCase().includes('pss')) ||
        (item.payment_status && item.payment_status.toLowerCase().includes('pss')) ||
        (item.payment_status && item.payment_status.toLowerCase().includes('installment'))
    );
    if (!isPss) return null;

    const total = Number(plan?.total_amount || plan?.totalAmount || item.total_amount || 0);
    const schedule = Array.isArray(plan?.schedule) ? plan.schedule : [];
    
    // Accurate paid amount calculation from verified schedule items
    const schedulePaidSum = schedule.filter(s => s.status === 'paid').reduce((sum, s) => sum + Number(s.amount || 0), 0);
    let paid = schedulePaidSum;
    if (paid <= 0) {
        if (plan?.paid_amount !== undefined && plan?.paid_amount !== null) paid = Number(plan.paid_amount);
        else if (plan?.paidAmount !== undefined && plan?.paidAmount !== null) paid = Number(plan.paidAmount);
        else if (plan?.down_payment !== undefined && plan?.down_payment !== null) paid = Number(plan.down_payment);
        else if (plan?.downPayment !== undefined && plan?.downPayment !== null) paid = Number(plan.downPayment);
        else if (plan?.remaining_balance !== undefined && plan?.remaining_balance !== null) paid = Math.max(0, total - Number(plan.remaining_balance));
        else if (plan?.remainingAmount !== undefined && plan?.remainingAmount !== null) paid = Math.max(0, total - Number(plan.remainingAmount));
        else if (item.payment_status === 'paid') paid = total;
        else paid = Math.round(total * 0.25);
    }

    let remaining = 0;
    if (plan?.remaining_balance !== undefined && plan?.remaining_balance !== null) {
        remaining = Number(plan.remaining_balance);
    } else if (plan?.remainingAmount !== undefined && plan?.remainingAmount !== null) {
        remaining = Number(plan.remainingAmount);
    } else {
        remaining = Math.max(0, total - paid);
    }

    const count = Number(plan?.installmentsCount || plan?.installments_count || schedule.length || 4);
    const paidCount = schedule.filter(s => s.status === 'paid').length || Number(plan?.installments_paid || plan?.installmentsPaid || (paid >= total ? count : (paid > 0 ? 1 : 0)));
    const isFullyPaid = remaining <= 0 || paidCount >= count;

    const nextPending = schedule.find(s => s.status !== 'paid');
    const now = new Date();
    const dueDate = nextPending?.due_date ? new Date(nextPending.due_date) : null;
    const isOverdue = dueDate ? dueDate < now : false;
    const daysRemaining = dueDate ? Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)) : null;

    return {
        total,
        paid,
        remaining,
        count,
        paidCount,
        isFullyPaid,
        schedule,
        nextPending,
        nextAmount: nextPending?.amount || (remaining > 0 ? Math.round(remaining / Math.max(1, count - paidCount)) : 0),
        dueDate,
        dateStr: dueDate ? dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
        isOverdue,
        daysRemaining,
        frequency: plan?.frequency || 'Monthly'
    };
};

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
    const [reviewTitle, setReviewTitle] = useState('');
    const [reviewRating, setRating] = useState(5);
    const [reviewImages, setReviewImages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const { settings } = useAppSettings();

    // Cancel / Confirm order
    const [cancelling, setCancelling] = useState(null);
    const [confirming, setConfirming] = useState(null);

    useEffect(() => {
        fetchOrders();
    }, [user?.id]);

    const fetchOrders = async () => {
        let activeUserId = user?.id || user?.sub;
        if (!activeUserId) {
            const { data: authData } = await supabase.auth.getUser();
            activeUserId = authData?.user?.id;
        }

        let mergedOrders = [];
        const seenOrderKeys = new Set();

        const registerOrder = (ord) => {
            if (!ord) return;
            // Reject phantom transaction logs
            if (ord.source === 'transactions' || ord.source === 'supabase_transactions') return;
            const key = ord.id || ord.payment_reference || ord.reference || ord.orderNumber;
            if (key && !seenOrderKeys.has(key)) {
                seenOrderKeys.add(key);
                mergedOrders.push(ord);
            }
        };

        // 1. Instant cache load from local storage (filtering out any phantom records)
        try {
            if (activeUserId) {
                const userCached = await AsyncStorage.getItem(`@abumafhal_orders_${activeUserId}`);
                if (userCached) {
                    const parsed = JSON.parse(userCached);
                    if (Array.isArray(parsed)) {
                        parsed.filter(o => o && o.source !== 'transactions' && o.source !== 'supabase_transactions').forEach(registerOrder);
                    }
                }
            }
            const lastOrd = await AsyncStorage.getItem('@abumafhal_last_order');
            if (lastOrd) {
                const parsedLast = JSON.parse(lastOrd);
                if (parsedLast && parsedLast.source !== 'transactions' && parsedLast.source !== 'supabase_transactions') {
                    registerOrder(parsedLast);
                }
            }

            if (mergedOrders.length > 0) {
                setOrders([...mergedOrders].sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0)));
                setLoading(false);
            }
        } catch (_) {}

        if (!activeUserId) {
            setLoading(false);
            setRefreshing(false);
            return;
        }

        // 2. Fetch authoritative orders from Supabase orders table with joined products & driver
        try {
            const { data: dbOrders, error: dbErr } = await supabase
                .from('orders')
                .select('*, user_confirmed, confirmed_at, driver:drivers(id, name, phone), order_items(id, quantity, price, variant, product_id, product:products(id, name, images, price))')
                .eq('user_id', activeUserId)
                .order('created_at', { ascending: false });

            if (!dbErr && Array.isArray(dbOrders)) {
                // Supabase is the single source of truth for authentic orders
                mergedOrders = dbOrders;
            } else if (dbErr) {
                console.warn('Orders joined fetch note:', dbErr.message);
                const { data: simpleData } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('user_id', activeUserId)
                    .order('created_at', { ascending: false });
                if (Array.isArray(simpleData) && simpleData.length > 0) {
                    mergedOrders = simpleData;
                }
            }
        } catch (e) {
            console.log('Orders fetch error:', e);
        }

        // Filter and strip any phantom/empty transaction items
        mergedOrders = mergedOrders.filter(o => o && o.id && o.source !== 'transactions' && o.source !== 'supabase_transactions');

        // Sort descending and update state
        mergedOrders.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
        setOrders(mergedOrders);
        if (activeUserId) {
            AsyncStorage.setItem(`@abumafhal_orders_${activeUserId}`, JSON.stringify(mergedOrders)).catch(() => {});
        }
        setLoading(false);
        setRefreshing(false);
    };

    const stats = useMemo(() => {
        let totalSpend = 0;
        orders.forEach(o => {
            const m = getOrderPssMetrics(o);
            if (m) {
                totalSpend += m.paid;
            } else if (o.payment_status === 'paid' || o.status === 'delivered' || o.status === 'completed') {
                totalSpend += Number(o.total_amount || 0);
            }
        });
        return {
            total: orders.length,
            active: orders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status)).length,
            delivered: orders.filter(o => o.status === 'delivered').length,
            spend: totalSpend,
        };
    }, [orders]);

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
            const freshOrder = orders.find(o => o.id === orderId);

            if (Platform.OS === 'web') {
                window.alert('Order confirmed! Thank you for shopping with us.');
            } else {
                Alert.alert(
                    'Order Confirmed',
                    'Thank you for shopping with us! Would you like to rate the products now?',
                    [
                        { text: 'Maybe Later', style: 'cancel' },
                        {
                            text: 'Yes, Rate',
                            onPress: () => {
                                if (freshOrder && freshOrder.order_items && freshOrder.order_items.length > 0) {
                                    setReviewModal({ order: freshOrder, item: freshOrder.order_items[0], type: 'product' });
                                }
                            }
                        }
                    ]
                );
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
    // ── Image Handling ───────────────────────────────────────────────────────
    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'We need access to your gallery to upload photos.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            setReviewImages(prev => [...prev, ...result.assets]);
        }
    };

    const removeImage = (index) => {
        setReviewImages(prev => prev.filter((_, i) => i !== index));
    };

    const uploadReviewPhotos = async (orderId) => {
        const urls = [];
        setUploading(true);
        for (const asset of reviewImages) {
            try {
                const fileExt = asset.uri.split('.').pop();
                const fileName = `${user.id}/${orderId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${fileName}`;

                // Use Base64 for more reliable upload in React Native/Expo
                const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });

                const { data, error } = await supabase.storage
                    .from('products')
                    .upload(filePath, decode(base64), { contentType: `image/${fileExt}`, upsert: true });

                if (error) throw error;
                const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(filePath);
                urls.push(publicUrl);
            } catch (err) {
                console.error('Upload error:', err);
            }
        }
        setUploading(false);
        return urls;
    };

    // ── Submit Review ─────────────────────────────────────────────────────────
    const submitReview = async () => {
        if (!reviewModal) return;
        setSubmitting(true);
        try {
            const isDriver = reviewModal.type === 'driver';
            console.log("Submitting review for order:", reviewModal.order?.id);
            const uploadedUrls = await uploadReviewPhotos(reviewModal.order?.id);
            console.log("Uploaded photos:", uploadedUrls.length);

            const reviewData = {
                user_id: user.id || user.sub,
                product_id: isDriver ? null : reviewModal.item?.product_id,
                driver_id: isDriver ? reviewModal.order?.driver_id : null,
                order_id: reviewModal.order?.id,
                review_type: reviewModal.type || 'product',
                rating: reviewRating,
                title: reviewTitle.trim() || (isDriver ? 'Driver Review' : 'Product Review'),
                comment: reviewText.trim(),
                images: uploadedUrls,
                status: 'pending' // Explicitly set status to ensure visibility
            };

            const { data, error } = await supabase.from('reviews').insert(reviewData).select();
            if (error) {
                console.error("Supabase Insert Error:", error);
                throw error;
            }
            console.log("Review submitted successfully! Inserted ID:", data?.[0]?.id);

            setReviewModal(null);
            setReviewText('');
            setReviewTitle('');
            setRating(5);
            setReviewImages([]);
            Alert.alert('Thank you!', 'Your review has been submitted.');
        } catch (e) {
            console.error('Review Error:', e);
            Alert.alert('Error', 'Could not submit review. Please try again.');
        }
        setSubmitting(false);
    };

    // ── Share Order ───────────────────────────────────────────────────────────
    const shareOrder = (order) => {
        const orderShort = order.id.slice(0, 8).toUpperCase();
        Share.share({
            message: `📦 Abu Mafhal Marketplace Order #${orderShort}\nStatus: ${(order.status || 'Pending').toUpperCase()}\nTotal: ₦${(order.total_amount || 0).toLocaleString()}\nTrack: https://abumafhal.com/orders?id=${order.id}`
        });
    };

    const shareOrderWhatsApp = (order) => {
        const orderShort = order.id.slice(0, 8).toUpperCase();
        const msg = `📦 *Abu Mafhal Marketplace Order #${orderShort}*\nStatus: *${(order.status || 'Pending').toUpperCase()}*\nTotal: *₦${(order.total_amount || 0).toLocaleString()}*\nTrack Live: https://abumafhal.com/orders?id=${order.id}`;
        whatsappService.openWhatsApp('', msg);
    };

    // ── Contact Support ───────────────────────────────────────────────────────
    const contactSupport = (order) => {
        const orderShort = order.id.slice(0, 8).toUpperCase();
        const msg = `Hello Abu Mafhal Support Team, I need assistance with my Order #${orderShort} (Total: ₦${(order.total_amount || 0).toLocaleString()}, Status: ${(order.status || 'Active').toUpperCase()}).`;
        whatsappService.openWhatsApp('2348145853539', msg);
    };

    // ── Render Card ───────────────────────────────────────────────────────────
    const renderCard = ({ item }) => <OrderCard
        item={item}
        isExpanded={expandedId === item.id}
        onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
        onCancel={handleCancel}
        onConfirm={handleConfirmReceipt}
        onNavigate={onNavigate}
        onReview={(modal) => {
            setReviewModal(modal);
            setReviewText('');
            setRating(5);
        }}
        cancelling={cancelling === item.id}
        confirming={confirming === item.id}
        shareOrder={shareOrder}
        shareOrderWhatsApp={shareOrderWhatsApp}
        contactSupport={contactSupport}
        settings={settings}
    />;

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
                            style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC', marginBottom: 12 }}
                            placeholder="Review Title (e.g. Great Product!)"
                            placeholderTextColor="#94A3B8"
                            value={reviewTitle}
                            onChangeText={setReviewTitle}
                        />

                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 14, color: '#0F172A', minHeight: 80, backgroundColor: '#F8FAFC', marginBottom: 16 }}
                            placeholder="Write your experience..."
                            placeholderTextColor="#94A3B8"
                            value={reviewText}
                            onChangeText={setReviewText}
                            multiline
                        />

                        {/* Image Picker */}
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 10 }}>Add Photos (optional)</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                            <TouchableOpacity onPress={pickImage} style={{ width: 80, height: 80, borderRadius: 14, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
                                <Ionicons name="camera-outline" size={24} color="#64748B" />
                            </TouchableOpacity>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                                {reviewImages.map((asset, idx) => (
                                    <View key={idx} style={{ position: 'relative' }}>
                                        <Image source={{ uri: asset.uri }} style={{ width: 80, height: 80, borderRadius: 14 }} />
                                        <TouchableOpacity onPress={() => removeImage(idx)} style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'white', borderRadius: 10, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 }}>
                                            <Ionicons name="close-circle" size={20} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>

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

const OrderCard = React.memo(({ item, isExpanded, onToggle, onCancel, onConfirm, onNavigate, onReview, cancelling, confirming, shareOrder, shareOrderWhatsApp, contactSupport, settings }) => {
    const status = item.status?.toLowerCase() || 'pending';
    const cfg = STATUS_CFG[status] || { color: '#64748B', bg: '#F1F5F9', icon: 'help-circle-outline', label: status };
    const isCancelled = status === 'cancelled';
    const isDelivered = status === 'delivered';
    const isConfirmed = isDelivered && item.user_confirmed === true;
    const needsConfirmation = isDelivered && !isConfirmed;
    const canCancel = ['pending', 'processing'].includes(status);
    const stepIndex = STEPS.indexOf(status);
    const items = (item.order_items && item.order_items.length > 0)
        ? item.order_items
        : (Array.isArray(item.items) && item.items.length > 0 ? item.items : []);
    const images = items.slice(0, 5).map(oi => {
        const prod = oi.product || {};
        return getImg(prod.images || oi.images || oi.image);
    }).filter(Boolean);

    // Item pricing calculations
    const itemsSubtotal = items.reduce((sum, oi) => {
        const p = parseFloat(oi.price || oi.product?.price || 0) || 0;
        const q = parseInt(oi.quantity || oi.qty || 1, 10) || 1;
        return sum + (p * q);
    }, 0);
    const shippingFee = parseFloat(item.shipping_fee || 0) || 0;
    const discount = parseFloat(item.discount_applied || 0) || 0;
    const totalPaid = parseFloat(item.total_amount || (itemsSubtotal + shippingFee - discount) || 0);
    const displaySubtotal = itemsSubtotal > 0 ? itemsSubtotal : Math.max(0, totalPaid - shippingFee + discount);

    // Pay Small Small (BNPL) metrics
    const pssMetrics = useMemo(() => getOrderPssMetrics(item), [item]);
    const isPss = !!pssMetrics;

    return (
        <View style={C.card}>
            {/* Header row */}
            <TouchableOpacity activeOpacity={0.85} onPress={onToggle}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[C.iconBox, { backgroundColor: cfg.bg }]}>
                            <Ionicons name={cfg.icon} size={17} color={cfg.color} />
                        </View>
                        <View>
                            <Text style={C.orderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                            <Text style={C.orderDate}>{new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                            {isPss && (
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    backgroundColor: '#0E1A2E',
                                    borderColor: '#D97706',
                                    borderWidth: 1,
                                    paddingHorizontal: 7,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                    marginTop: 4,
                                    alignSelf: 'flex-start'
                                }}>
                                    <Ionicons name="flash" size={10} color="#D97706" />
                                    <Text style={{ color: '#F8FAFC', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 }}>
                                        0% INTEREST BNPL
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <View style={[C.statusBadge, { backgroundColor: cfg.bg }]}>
                            <Text style={[C.statusText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
                        </View>
                        {isPss && pssMetrics ? (
                            <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Paid:</Text>
                                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#10B981' }}>
                                        ₦{pssMetrics.paid.toLocaleString()}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: pssMetrics.isOverdue ? '#DC2626' : '#D97706', marginTop: 1 }}>
                                    {pssMetrics.isFullyPaid 
                                        ? 'Total: ₦' + pssMetrics.total.toLocaleString()
                                        : `Due: ₦${pssMetrics.remaining.toLocaleString()} of ₦${pssMetrics.total.toLocaleString()}`
                                    }
                                </Text>
                            </View>
                        ) : (
                            <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 4 }}>
                                ₦{totalPaid.toLocaleString()}
                            </Text>
                        )}
                    </View>
                </View>

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

                {/* ── BNPL (Pay Small Small) Installment Ledger Box ── */}
                {isPss && pssMetrics && (
                    <View style={{
                        backgroundColor: '#071224',
                        borderRadius: 14,
                        padding: 12,
                        marginTop: 12,
                        borderWidth: 1,
                        borderColor: pssMetrics.isOverdue ? '#EF4444' : 'rgba(217, 167, 58, 0.35)'
                    }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="wallet-outline" size={15} color="#D97706" />
                                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                                    Pay Small Small Plan ({pssMetrics.paidCount}/{pssMetrics.count} Paid)
                                </Text>
                            </View>
                            <View style={{
                                backgroundColor: pssMetrics.isFullyPaid ? 'rgba(16, 185, 129, 0.2)' : pssMetrics.isOverdue ? 'rgba(239, 68, 68, 0.2)' : 'rgba(217, 167, 58, 0.2)',
                                paddingHorizontal: 7,
                                paddingVertical: 2.5,
                                borderRadius: 6
                            }}>
                                <Text style={{
                                    fontSize: 9.5,
                                    fontWeight: '800',
                                    color: pssMetrics.isFullyPaid ? '#10B981' : pssMetrics.isOverdue ? '#EF4444' : '#D97706'
                                }}>
                                    {pssMetrics.isFullyPaid ? 'SETTLED' : pssMetrics.isOverdue ? 'OVERDUE' : 'ACTIVE PLAN'}
                                </Text>
                            </View>
                        </View>

                        {/* Progress Bar */}
                        <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginVertical: 6 }}>
                            <View style={{
                                height: '100%',
                                width: `${Math.min(100, Math.round((pssMetrics.paid / Math.max(1, pssMetrics.total)) * 100))}%`,
                                backgroundColor: pssMetrics.isFullyPaid ? '#10B981' : '#D97706'
                            }} />
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                            <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                                Paid: <Text style={{ color: '#10B981', fontWeight: '800' }}>₦{pssMetrics.paid.toLocaleString()}</Text>
                            </Text>
                            <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                                Balance: <Text style={{ color: '#F87171', fontWeight: '800' }}>₦{pssMetrics.remaining.toLocaleString()}</Text>
                            </Text>
                        </View>

                        {!pssMetrics.isFullyPaid && (
                            <View style={{
                                marginTop: 10,
                                paddingTop: 8,
                                borderTopWidth: 1,
                                borderTopColor: 'rgba(255,255,255,0.08)',
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: pssMetrics.isOverdue ? '#FCA5A5' : '#94A3B8', fontSize: 10, fontWeight: '700' }}>
                                        {pssMetrics.isOverdue ? '⚠️ Overdue Installment:' : 'Next Due Installment:'}
                                    </Text>
                                    <Text style={{ color: pssMetrics.isOverdue ? '#EF4444' : '#FFFFFF', fontSize: 13, fontWeight: '900' }}>
                                        ₦{pssMetrics.nextAmount.toLocaleString()}
                                        {pssMetrics.dateStr ? ` • ${pssMetrics.dateStr}` : ''}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => onNavigate && onNavigate('PaySmallSmall', { orderId: item.id })}
                                    activeOpacity={0.8}
                                    style={{
                                        backgroundColor: '#D97706',
                                        paddingHorizontal: 12,
                                        paddingVertical: 7,
                                        borderRadius: 8,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4
                                    }}
                                >
                                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Pay Next →</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                {/* Live Station Checkpoint Banner (One-Tap Live Track) */}
                {!isCancelled && (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => onNavigate && onNavigate('TrackOrder', { order: item })}
                        style={{ marginTop: 12, backgroundColor: '#0E1A2E', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.4)' }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#D97706', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 }}>
                                    LIVE CHECKPOINT:
                                </Text>
                                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                                    {item.current_location || (status === 'delivered' ? 'Delivered to Destination' : 'Abu Mafhal Central Logistics Hub')}
                                </Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>Track Live</Text>
                            <Ionicons name="chevron-forward" size={12} color="#D97706" />
                        </View>
                    </TouchableOpacity>
                )}

                {isCancelled && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 10, marginTop: 10 }}>
                        <Ionicons name="close-circle" size={14} color="#DC2626" />
                        <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600' }}>Order Cancelled</Text>
                    </View>
                )}
            </TouchableOpacity>

            {isExpanded && (
                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 14 }}>
                    <Text style={C.sectionLabel}>ITEMS ORDERED ({items.length})</Text>
                    {items.length > 0 ? items.map((oi, i) => {
                        const prod = oi.product || {};
                        const imgUrl = getImg(prod.images || oi.images || oi.image);
                        const itemName = prod.name || oi.name || oi.title || 'Marketplace Item';
                        const unitPrice = parseFloat(oi.price || prod.price || 0) || 0;
                        const qty = parseInt(oi.quantity || oi.qty || 1, 10) || 1;
                        const lineTotal = unitPrice * qty;

                        return (
                            <View key={oi.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9' }}>
                                {imgUrl
                                    ? <Image source={{ uri: imgUrl }} style={C.itemImg} resizeMode="cover" />
                                    : <View style={[C.itemImg, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                                        <Ionicons name="cube-outline" size={20} color="#94A3B8" />
                                    </View>
                                }
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                                        {itemName}
                                    </Text>
                                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                                        ₦{unitPrice.toLocaleString()} × {qty} item{qty > 1 ? 's' : ''}{oi.variant ? ` • ${oi.variant}` : ''}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13 }}>₦{lineTotal.toLocaleString()}</Text>
                                    {isConfirmed && settings?.enable_reviews !== false && (
                                        <TouchableOpacity onPress={() => onReview({ order: item, item: oi, type: 'product' })}
                                            style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
                                            <Ionicons name="star" size={10} color="#D97706" />
                                            <Text style={{ fontSize: 10, color: '#92400E', fontWeight: '700' }}>Review</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        );
                    }) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingVertical: 8 }}>
                            <Ionicons name="cube-outline" size={22} color="#94A3B8" />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 13 }}>Marketplace Purchased Items</Text>
                                <Text style={{ color: '#64748B', fontSize: 12 }}>Ref: #{(item.id || item.reference || '').slice(0, 8).toUpperCase()}</Text>
                            </View>
                            <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13 }}>₦{totalPaid.toLocaleString()}</Text>
                        </View>
                    )}

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

                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9' }}>
                        <Text style={C.sectionLabel}>PAYMENT SUMMARY</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={{ color: '#64748B', fontSize: 12 }}>Items Subtotal</Text>
                            <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 12 }}>₦{displaySubtotal.toLocaleString()}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={{ color: '#64748B', fontSize: 12 }}>Delivery & Shipping Fee</Text>
                            <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 12 }}>
                                {shippingFee > 0 ? `₦${shippingFee.toLocaleString()}` : 'Free'}
                            </Text>
                        </View>
                        {discount > 0 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ color: '#16A34A', fontSize: 12 }}>Discount Applied</Text>
                                <Text style={{ fontWeight: '700', color: '#16A34A', fontSize: 12 }}>-₦{discount.toLocaleString()}</Text>
                            </View>
                        )}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={{ color: '#64748B', fontSize: 12 }}>Payment Method</Text>
                            <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 12 }}>{item.payment_method || 'Verified Payment'}</Text>
                        </View>
                        {isPss && pssMetrics ? (
                            <>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                                    <Text style={{ color: '#0F172A', fontSize: 12, fontWeight: '800' }}>Actual Amount Paid (Deposit)</Text>
                                    <Text style={{ fontWeight: '900', color: '#10B981', fontSize: 13 }}>₦{pssMetrics.paid.toLocaleString()}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>Remaining Installment Debt</Text>
                                    <Text style={{ fontWeight: '800', color: '#DC2626', fontSize: 13 }}>₦{pssMetrics.remaining.toLocaleString()}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                                    <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13 }}>Total Order Contract Value</Text>
                                    <Text style={{ fontWeight: '900', color: '#0F172A', fontSize: 16 }}>₦{pssMetrics.total.toLocaleString()}</Text>
                                </View>
                            </>
                        ) : (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                                <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13 }}>Total Paid</Text>
                                <Text style={{ fontWeight: '900', color: '#0F172A', fontSize: 17 }}>₦{totalPaid.toLocaleString()}</Text>
                            </View>
                        )}
                    </View>

                    <View style={{ gap: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity onPress={() => onNavigate('TrackOrder', { order: item })}
                                style={[C.btn, { backgroundColor: '#0F172A', flex: 2 }]}>
                                <Ionicons name="location-outline" size={15} color="white" />
                                <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Track Order</Text>
                            </TouchableOpacity>
                            {isPss && pssMetrics && !pssMetrics.isFullyPaid && (
                                <TouchableOpacity onPress={() => onNavigate('PaySmallSmall', { orderId: item.id })}
                                    style={[C.btn, { backgroundColor: '#D97706', flex: 2 }]}>
                                    <Ionicons name="card-outline" size={15} color="white" />
                                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>Manage Plan</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => shareOrderWhatsApp ? shareOrderWhatsApp(item) : shareOrder(item)}
                                style={[C.btn, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1, flex: 1 }]}>
                                <Ionicons name="logo-whatsapp" size={15} color="#16A34A" />
                                <Text style={{ color: '#16A34A', fontWeight: '800', fontSize: 13 }}>WhatsApp</Text>
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
                                    onPress={() => onCancel(item)}
                                    disabled={cancelling}
                                    style={[C.btn, { backgroundColor: '#FEF2F2', flex: 1 }]}>
                                    {cancelling
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
                                    onPress={() => onConfirm(item)}
                                    disabled={confirming}
                                    style={[C.btn, { backgroundColor: '#16A34A', flex: 1.5 }]}>
                                    {confirming
                                        ? <ActivityIndicator size="small" color="white" />
                                        : <>
                                            <Ionicons name="checkmark-done" size={15} color="white" />
                                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Confirm Receipt</Text>
                                        </>
                                    }
                                </TouchableOpacity>
                            )}
                            {isConfirmed && item.driver_id && settings?.enable_ratings !== false && (
                                <TouchableOpacity onPress={() => onReview({ order: item, type: 'driver' })}
                                    style={[C.btn, { backgroundColor: '#FEF3C7', flex: 1 }]}>
                                    <Ionicons name="star" size={14} color="#D97706" />
                                    <Text style={{ color: '#D97706', fontWeight: '700', fontSize: 12 }}>Rate Driver</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            )}

            <TouchableOpacity onPress={onToggle} style={{ alignItems: 'center', marginTop: 10 }}>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#CBD5E1" />
            </TouchableOpacity>
        </View>
    );
});

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
