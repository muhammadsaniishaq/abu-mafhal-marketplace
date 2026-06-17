import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, ActivityIndicator,
    Alert, Modal, ScrollView, TextInput, Share, Linking, RefreshControl, Clipboard, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../lib/supabase';
import { sendOrderStatusUpdateEmail, sendDriverAssignmentEmail } from '../../services/simpleEmailService';
import { whatsappService } from '../../services/whatsappService';
import { WhatsAppActionModal } from '../../components/WhatsAppActionModal';

const STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const STATUS_COLORS = {
    pending: { bg: '#FEF3C7', text: '#D97706' },
    processing: { bg: '#DBEAFE', text: '#2563EB' },
    shipped: { bg: '#E0E7FF', text: '#7C3AED' },
    delivered: { bg: '#DCFCE7', text: '#16A34A' },
    cancelled: { bg: '#FEE2E2', text: '#DC2626' },
};

function safeAddress(addr) {
    if (!addr) return null;
    if (typeof addr === 'object') return addr;
    try { return JSON.parse(addr); } catch { return null; }
}

function formatAddress(addr) {
    const parsed = safeAddress(addr);
    if (!parsed) return typeof addr === 'string' ? addr : 'No address';
    return [parsed.address, parsed.city, parsed.state].filter(Boolean).join(', ');
}

export const AdminOrders = () => {
    const [orders, setOrders] = useState([]);
    const [whatsappVisible, setWhatsappVisible] = useState(false);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [whatsappUserId, setWhatsappUserId] = useState(null);
    const [whatsappRecipientName, setWhatsappRecipientName] = useState('Customer');
    const [whatsappOrder, setWhatsappOrder] = useState(null);
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Selected order + detail data
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Filters
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('all'); // 'all','today','week','month'

    // Bulk selection
    const [bulkMode, setBulkMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkUpdating, setBulkUpdating] = useState(false);

    // Admin notes
    const [adminNote, setAdminNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    // Actions
    const [updating, setUpdating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [copiedRef, setCopiedRef] = useState(false);

    // Refund modal
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundReason, setRefundReason] = useState('');
    const [refundOrder, setRefundOrder] = useState(null);

    // Realtime subscription ref
    const realtimeChannelRef = useRef(null);

    useEffect(() => {
        fetchOrders();
        fetchDrivers();
        setupRealtimeSubscription();
        return () => {
            if (realtimeChannelRef.current) {
                supabase.removeChannel(realtimeChannelRef.current);
            }
        };
    }, []);

    // ─── Realtime Subscription ───────────────────────────────────────────────
    const setupRealtimeSubscription = () => {
        const channel = supabase
            .channel('admin-orders-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'UPDATE') {
                    setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
                    if (selectedOrder?.id === payload.new.id) {
                        setSelectedOrder(prev => prev ? { ...prev, ...payload.new } : prev);
                    }
                } else if (payload.eventType === 'INSERT') {
                    fetchOrders(); // Reload on new order
                }
            })
            .subscribe();
        realtimeChannelRef.current = channel;
    };

    // ─── Data Fetching ───────────────────────────────────────────────────────
    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*, user:profiles(full_name, email, phone), driver:drivers(name, vehicle_type, phone, xp), order_items(id, quantity, price, product:products(name, images))')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.error('Fetch Orders Error:', error);
                Alert.alert('Error', error.message || 'Failed to fetch orders');
            } else {
                setOrders(data || []);
            }
        } catch (err) {
            console.error('Fetch Orders Crash:', err);
            Alert.alert('Network Error', 'Could not load orders. Please check your connection.');
        }
        setLoading(false);
        setRefreshing(false);
    };

    const fetchDrivers = async () => {
        try {
            const { data, error } = await supabase
                .from('drivers')
                .select('*, user:profiles(email)')
                .limit(50);
            if (!error) setDrivers(data || []);
        } catch (e) {
            console.log('Fetch Drivers Error', e);
        }
    };

    const fetchOrderItems = async (orderId) => {
        setLoadingItems(true);
        setOrderItems([]);
        setTimeline([]);
        try {
            const [itemsRes, timelineRes] = await Promise.all([
                supabase.from('order_items')
                    .select('*, product:products(name, images, price)')
                    .eq('order_id', orderId)
                    .limit(50),
                supabase.from('order_status_logs')
                    .select('*, changed_by_profile:profiles(full_name)')
                    .eq('order_id', orderId)
                    .order('created_at', { ascending: false })
                    .limit(20)
            ]);

            if (!itemsRes.error) setOrderItems(itemsRes.data || []);
            if (!timelineRes.error) setTimeline(timelineRes.data || []);
        } catch (e) {
            console.log('Fetch Order Items Error:', e);
        }
        setLoadingItems(false);
    };

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        fetchOrderItems(order.id);
    };

    // ─── Status Update + Timeline Log ───────────────────────────────────────
    const updateStatus = async (id, newStatus, currentOrder = null, note = '') => {
        setUpdating(true);
        const statusLower = newStatus.toLowerCase();
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: statusLower })
                .eq('id', id);

            if (error) {
                Alert.alert('Error', 'Failed to update status');
            } else {
                setOrders(prev => prev.map(o => o.id === id ? { ...o, status: statusLower } : o));
                if (selectedOrder?.id === id) setSelectedOrder(prev => ({ ...prev, status: statusLower }));

                // Credit vendor wallets explicitly when delivered
                if (statusLower === 'delivered') {
                    const { error: creditErr } = await supabase.rpc('credit_vendors_on_delivery', { p_order_id: id });
                    if (creditErr) {
                        console.log('Vendor credit error:', creditErr.message);
                        Alert.alert('Wallet Credit Failed', creditErr.message);
                        return; // Stop execution to show the error
                    }
                    else console.log('Vendor credited successfully via RPC.');
                }

                // Log in timeline
                const { data: { user } } = await supabase.auth.getUser();
                await supabase.from('order_status_logs').insert({
                    order_id: id,
                    status: statusLower,
                    note: note || null,
                    changed_by: user?.id || null,
                });
                // Refresh timeline
                fetchOrderItems(id);

                // Email customer
                const orderToNotify = currentOrder || orders.find(o => o.id === id);
                if (orderToNotify?.user?.email) {
                    sendOrderStatusUpdateEmail({
                        name: orderToNotify.user.full_name || 'Customer',
                        email: orderToNotify.user.email,
                        orderId: id,
                        status: newStatus
                    }).catch(e => console.log('Email err:', e));
                }
                if (orderToNotify?.user?.phone) {
                    const statusMsg = `Your Abu Mafhal order #${id.slice(0, 8).toUpperCase()} status has been updated to: ${newStatus.toUpperCase()}.`;
                    whatsappService.sendDirect(orderToNotify.user.phone, statusMsg, orderToNotify?.user_id)
                        .catch(e => console.log('Status update WhatsApp error:', e));
                }
                Alert.alert('Success', `Order marked as ${newStatus}`);
            }
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to update status');
        }
        setUpdating(false);
    };


    // ─── Assign Driver ───────────────────────────────────────────────────────
    const assignDriver = async (orderId, driverId) => {
        setUpdating(true);
        try {
            const { error } = await supabase.from('orders')
                .update({ driver_id: driverId, status: 'shipped' })
                .eq('id', orderId);

            if (error) {
                Alert.alert('Error', 'Failed to assign driver');
            } else {
                const assignedDriver = drivers.find(d => d.id === driverId);
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, driver_id: driverId, driver: assignedDriver, status: 'shipped' } : o));
                if (selectedOrder) setSelectedOrder(prev => ({ ...prev, driver_id: driverId, driver: assignedDriver, status: 'shipped' }));

                // Log
                const { data: { user } } = await supabase.auth.getUser();
                await supabase.from('order_status_logs').insert({
                    order_id: orderId,
                    status: 'shipped',
                    note: `Driver assigned: ${assignedDriver?.name || 'Unknown'}`,
                    changed_by: user?.id || null,
                });
                fetchOrderItems(orderId);

                Alert.alert('Success', 'Driver assigned: ' + (assignedDriver?.name || ''));

                const orderToNotify = orders.find(o => o.id === orderId) || selectedOrder;
                if (assignedDriver?.user?.email) {
                    const addressData = safeAddress(orderToNotify?.shipping_address);
                    sendDriverAssignmentEmail({
                        driverName: assignedDriver.name,
                        driverEmail: assignedDriver.user.email,
                        orderId,
                        pickupAddress: 'Abu Mafhal Central Hub',
                        deliveryAddress: addressData?.address || formatAddress(orderToNotify?.shipping_address),
                        customerPhone: orderToNotify?.user?.phone || 'N/A',
                        earnings: '500.00'
                    }).catch(e => console.log('Driver Email Error', e));
                }
                if (orderToNotify?.user?.phone) {
                    const driverMsg = `Your Abu Mafhal order #${orderId.slice(0, 8).toUpperCase()} has been shipped! Driver ${assignedDriver?.name || 'Unknown'} is on the way.`;
                    whatsappService.sendDirect(orderToNotify.user.phone, driverMsg, orderToNotify?.user_id)
                        .catch(e => console.log('Driver assignment WhatsApp error:', e));
                }
            }
        } catch (err) {
            Alert.alert('Error', err.message);
        }
        setUpdating(false);
    };

    // ─── Refund / Cancel ─────────────────────────────────────────────────────
    const openRefundModal = (order) => {
        setRefundOrder(order);
        setRefundReason('');
        setShowRefundModal(true);
    };

    const handleRefund = async () => {
        if (!refundOrder) return;
        if (!refundReason.trim()) {
            Alert.alert('Reason Required', 'Please enter a reason for cancellation/refund.');
            return;
        }
        setShowRefundModal(false);

        // 7. Stock Restore on Cancel
        try {
            for (const item of orderItems) {
                if (item.product_id && item.quantity) {
                    const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
                    if (prod) {
                        await supabase.from('products').update({ stock_quantity: (prod.stock_quantity || 0) + item.quantity }).eq('id', item.product_id);
                    }
                }
            }
        } catch (e) { console.log('Stock restore error:', e); }

        await updateStatus(refundOrder.id, 'Cancelled', refundOrder, `Refund/Cancel Reason: ${refundReason}`);
        setRefundOrder(null);
        setRefundReason('');
    };

    // 1. BULK ACTIONS ──────────────────────────────────────────────────────────
    const toggleBulkSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleBulkUpdate = (newStatus) => {
        if (selectedIds.size === 0) return Alert.alert('No orders selected', 'Tap orders to select them first.');
        Alert.alert(
            `Mark ${selectedIds.size} order(s) as ${newStatus}?`, '',
            [{ text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm', onPress: async () => {
                    setBulkUpdating(true);
                    for (const id of selectedIds) {
                        await supabase.from('orders').update({ status: newStatus.toLowerCase() }).eq('id', id);
                    }
                    setOrders(prev => prev.map(o => selectedIds.has(o.id) ? { ...o, status: newStatus.toLowerCase() } : o));
                    setSelectedIds(new Set());
                    setBulkMode(false);
                    setBulkUpdating(false);
                    Alert.alert('Done', `${selectedIds.size} orders updated to ${newStatus}`);
                }
            }]
        );
    };

    // 2. ADMIN INTERNAL NOTES ─────────────────────────────────────────────────
    const saveAdminNote = async () => {
        if (!adminNote.trim() || !selectedOrder) return;
        setSavingNote(true);
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('order_status_logs').insert({
            order_id: selectedOrder.id,
            status: selectedOrder.status || 'note',
            note: `📌 Admin Note: ${adminNote}`,
            changed_by: user?.id || null,
        });
        setAdminNote('');
        fetchOrderItems(selectedOrder.id);
        setSavingNote(false);
    };

    // 4. WHATSAPP ─────────────────────────────────────────────────────────────
    const openWhatsApp = (phone, order, recipientName = 'Customer') => {
        if (!phone) return Alert.alert('No phone', 'Phone number not available.');
        setWhatsappPhone(phone);
        setWhatsappUserId(order?.user_id || null);
        setWhatsappRecipientName(recipientName);
        setWhatsappOrder(order);
        setWhatsappVisible(true);
    };

    // 5. OPEN IN MAPS ─────────────────────────────────────────────────────────
    const openMaps = (addr) => {
        const formattedAddr = encodeURIComponent(formatAddress(addr));
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${formattedAddr}`);
    };

    // 6. COPY REFERENCE ───────────────────────────────────────────────────────
    const copyReference = (ref) => {
        if (!ref) return;
        Clipboard.setString(ref);
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 2000);
    };

    // 9. CUSTOMER RECEIPT ─────────────────────────────────────────────────────
    const shareReceipt = (order, items) => {
        const itemLines = items.map(i => `• ${i.product?.name || 'Item'} x${i.quantity} = ₦${((i.price || 0) * (i.quantity || 1)).toLocaleString()}`).join('\n');
        const msg = `🛍 Abu Mafhal Receipt\n` +
            `Order: #${order.id.slice(0, 8).toUpperCase()}\n` +
            `Date: ${new Date(order.created_at).toLocaleDateString()}\n\n` +
            `${itemLines}\n\n` +
            `Subtotal: ₦${(order.subtotal || 0).toLocaleString()}\n` +
            `Shipping: ₦${(order.shipping_fee || 0).toLocaleString()}\n` +
            `Tax: ₦${(order.tax || 0).toLocaleString()}\n` +
            `TOTAL: ₦${(order.total_amount || 0).toLocaleString()}\n\n` +
            `Thank you for shopping with us! 🎉`;
        Share.share({ message: msg });
    };

    // ─── Export Invoice ───────────────────────────────────────────────────────
    const handleExportInvoice = async (order, items) => {
        try {
            setIsExporting(true);
            const itemsHtml = items.map(i => `
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #eee;">${i.product?.name || 'Product'}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">₦${(i.price || 0).toLocaleString()}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">₦${((i.price || 0) * (i.quantity || 1)).toLocaleString()}</td>
                </tr>
            `).join('');

            const html = `
                <!DOCTYPE html><html><head>
                <meta charset="UTF-8">
                <style>
                    body{font-family:Arial,sans-serif;color:#333;padding:24px;margin:0;}
                    .header{background:#0F172A;color:white;padding:24px;border-radius:8px;margin-bottom:24px;}
                    .header h1{margin:0;font-size:22px;}
                    .header p{margin:4px 0;font-size:13px;opacity:0.7;}
                    .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:bold;text-transform:uppercase;background:#DCFCE7;color:#16A34A;}
                    .section{margin-bottom:20px;padding:16px;border:1px solid #E2E8F0;border-radius:8px;}
                    .section h3{margin:0 0 12px 0;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;}
                    table{width:100%;border-collapse:collapse;font-size:13px;}
                    th{background:#F8FAFC;padding:8px;text-align:left;font-size:11px;color:#64748B;text-transform:uppercase;}
                    .total-row{background:#0F172A;color:white;font-weight:bold;}
                    .total-row td{padding:10px;}
                    .footer{text-align:center;margin-top:24px;color:#94A3B8;font-size:11px;}
                </style>
                </head><body>
                <div class="header">
                    <h1>Abu Mafhal Marketplace</h1>
                    <p>INVOICE</p>
                    <p>Order #${order.id.slice(0, 8).toUpperCase()} &nbsp;|&nbsp; ${new Date(order.created_at).toLocaleDateString()}</p>
                    <span class="badge" style="background:rgba(255,255,255,0.15);color:white;">${order.status?.toUpperCase()}</span>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
                    <div class="section">
                        <h3>Bill To</h3>
                        <strong>${order.user?.full_name || 'N/A'}</strong><br>
                        ${order.user?.email || ''}<br>
                        ${order.user?.phone || ''}
                    </div>
                    <div class="section">
                        <h3>Deliver To</h3>
                        ${formatAddress(order.shipping_address)}
                    </div>
                </div>

                <div class="section">
                    <h3>Payment</h3>
                    <table>
                        <tr><td>Method:</td><td><strong>${order.payment_method || 'N/A'}</strong></td></tr>
                        <tr><td>Reference:</td><td><strong>${order.payment_reference || 'N/A'}</strong></td></tr>
                    </table>
                </div>

                <div class="section">
                    <h3>Items Ordered</h3>
                    <table>
                        <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                        <tfoot>
                            <tr><td colspan="3" style="padding:8px;text-align:right;color:#64748B;">Subtotal</td><td style="padding:8px;text-align:right;">₦${(order.subtotal || 0).toLocaleString()}</td></tr>
                            <tr><td colspan="3" style="padding:8px;text-align:right;color:#64748B;">Shipping</td><td style="padding:8px;text-align:right;">₦${(order.shipping_fee || 0).toLocaleString()}</td></tr>
                            <tr><td colspan="3" style="padding:8px;text-align:right;color:#64748B;">Tax (5%)</td><td style="padding:8px;text-align:right;">₦${(order.tax || 0).toLocaleString()}</td></tr>
                            ${order.discount_applied ? `<tr><td colspan="3" style="padding:8px;text-align:right;color:#16A34A;">Discount</td><td style="padding:8px;text-align:right;color:#16A34A;">-₦${(order.discount_applied).toLocaleString()}</td></tr>` : ''}
                            <tr class="total-row"><td colspan="3" style="text-align:right;">TOTAL</td><td style="text-align:right;">₦${(order.total_amount || 0).toLocaleString()}</td></tr>
                        </tfoot>
                    </table>
                </div>
                <div class="footer">Abu Mafhal Marketplace &bull; Abuja, FCT, Nigeria &bull; support@abumafhal.com</div>
                </body></html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { dialogTitle: `Invoice - Order #${order.id.slice(0, 8).toUpperCase()}` });
            } else {
                Alert.alert('Success', 'Invoice generated!');
            }
        } catch (e) {
            console.error('Export Error:', e);
            Alert.alert('Export Failed', 'Could not generate invoice.');
        } finally {
            setIsExporting(false);
        }
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const getLevel = (xp) => {
        if (!xp) return 'Bronze';
        if (xp < 100) return 'Bronze';
        if (xp < 500) return 'Silver';
        if (xp < 2000) return 'Gold';
        return 'Elite';
    };

    const stats = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const filterDate = dateFilter === 'today' ? startOfToday : dateFilter === 'week' ? startOfWeek : dateFilter === 'month' ? startOfMonth : null;
        const filterable = filterDate ? orders.filter(o => new Date(o.created_at) >= filterDate) : orders;
        const totalRevenue = filterable.reduce((s, o) => s + (o.payment_status === 'paid' ? (o.total_amount || 0) : 0), 0);
        const pendingCount = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
        const deliveredCount = orders.filter(o => o.status === 'delivered').length;
        return { totalRevenue, pendingCount, deliveredCount, total: orders.length };
    }, [orders, dateFilter]);

    const filteredOrders = useMemo(() => {
        const now = new Date();
        let result = orders;
        // 3. Date Range Filter
        if (dateFilter === 'today') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            result = result.filter(o => new Date(o.created_at) >= start);
        } else if (dateFilter === 'week') {
            const start = new Date(now); start.setDate(start.getDate() - 7);
            result = result.filter(o => new Date(o.created_at) >= start);
        } else if (dateFilter === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            result = result.filter(o => new Date(o.created_at) >= start);
        }
        if (filter !== 'All') result = result.filter(o => o.status?.toLowerCase() === filter.toLowerCase());
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(o =>
                o.id.toLowerCase().includes(q) ||
                o.user?.full_name?.toLowerCase().includes(q) ||
                o.user?.email?.toLowerCase().includes(q) ||
                o.payment_reference?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [orders, filter, searchQuery, dateFilter]);

    // ─── Render Order Card ────────────────────────────────────────────────────
    const renderOrderItem = ({ item }) => {
        const status = item.status?.toLowerCase() || 'pending';
        const colorSet = STATUS_COLORS[status] || { bg: '#F1F5F9', text: '#64748B' };
        const isSelected = selectedIds.has(item.id);
        return (
            <TouchableOpacity
                style={[S.orderCard, isSelected && { borderColor: '#3B82F6', borderWidth: 2 }]}
                onPress={() => bulkMode ? toggleBulkSelect(item.id) : handleSelectOrder(item)}
                onLongPress={() => { setBulkMode(true); toggleBulkSelect(item.id); }}
            >
                {bulkMode && (
                    <View style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: isSelected ? '#3B82F6' : '#E2E8F0', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        {isSelected && <Ionicons name="checkmark" size={13} color="white" />}
                    </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={S.orderRef}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                    <View style={[S.badge, { backgroundColor: colorSet.bg }]}>
                        <Text style={{ color: colorSet.text, fontSize: 10, fontWeight: '700' }}>{status.toUpperCase()}</Text>
                    </View>
                </View>
                <Text style={{ fontWeight: '600', color: '#0F172A', marginBottom: 2 }}>
                    {item.user?.full_name || item.user?.email || 'Unknown'}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>
                        {item.items_count || '?'} item{item.items_count !== 1 ? 's' : ''} • {item.payment_method || 'N/A'}
                    </Text>
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>₦{(item.total_amount || 0).toLocaleString()}</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                    {new Date(item.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
                {item.driver && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                        <Ionicons name="bicycle" size={12} color="#3B82F6" />
                        <Text style={{ fontSize: 11, color: '#3B82F6', fontWeight: '600' }}>{item.driver.name} – {getLevel(item.driver?.xp)}</Text>
                    </View>
                )}
                {/* Product Image Thumbnails */}
                {item.order_items && item.order_items.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, alignItems: 'center' }}>
                        {item.order_items.slice(0, 4).map((oi, idx) => {
                            const imgArr = oi.product?.images;
                            const imgUrl = Array.isArray(imgArr) ? imgArr[0] : (typeof imgArr === 'string' ? imgArr : null);
                            return imgUrl ? (
                                <Image
                                    key={oi.id || idx}
                                    source={{ uri: imgUrl }}
                                    style={{ width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View key={oi.id || idx} style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="image-outline" size={16} color="#CBD5E1" />
                                </View>
                            );
                        })}
                        {item.order_items.length > 4 && (
                            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>+{item.order_items.length - 4}</Text>
                            </View>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const order = selectedOrder;
    const statusColor = order ? (STATUS_COLORS[order.status?.toLowerCase()] || { bg: '#F1F5F9', text: '#64748B' }) : {};

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* ── Stats Header ── */}
            <View style={{ backgroundColor: '#0F172A', padding: 20, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
                <Text style={{ color: 'white', fontSize: 22, fontWeight: '900', marginBottom: 12 }}>Order Management</Text>
                {/* 8. Revenue Summary by Date */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>REVENUE</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            {[['all', 'All'], ['today', 'Today'], ['week', '7d'], ['month', '30d']].map(([val, label]) => (
                                <TouchableOpacity key={val} onPress={() => setDateFilter(val)}
                                    style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: dateFilter === val ? 'white' : 'transparent' }}>
                                    <Text style={{ color: dateFilter === val ? '#0F172A' : 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700' }}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    <Text style={{ color: 'white', fontSize: 26, fontWeight: '900' }}>₦{stats.totalRevenue.toLocaleString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {[
                        { label: 'Total', value: stats.total, icon: 'list' },
                        { label: 'Pending', value: stats.pendingCount, icon: 'time' },
                        { label: 'Delivered', value: stats.deliveredCount, icon: 'checkmark-circle' },
                    ].map(s => (
                        <View key={s.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 16, alignItems: 'center' }}>
                            <Ionicons name={s.icon} size={18} color="rgba(255,255,255,0.6)" />
                            <Text style={{ color: 'white', fontSize: 20, fontWeight: '800', marginTop: 4 }}>{s.value}</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', marginTop: 2 }}>{s.label.toUpperCase()}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* 1. Bulk Action Bar */}
            {bulkMode && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', padding: 12, gap: 10 }}>
                    <TouchableOpacity onPress={() => { setBulkMode(false); setSelectedIds(new Set()); }} style={{ padding: 8 }}>
                        <Ionicons name="close" size={18} color="white" />
                    </TouchableOpacity>
                    <Text style={{ color: 'white', flex: 1, fontWeight: '700' }}>{selectedIds.size} selected</Text>
                    {bulkUpdating
                        ? <ActivityIndicator color="white" />
                        : (<>
                            <TouchableOpacity onPress={() => handleBulkUpdate('Delivered')}
                                style={{ backgroundColor: '#16A34A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
                                <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✓ Delivered</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleBulkUpdate('Cancelled')}
                                style={{ backgroundColor: '#DC2626', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
                                <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✕ Cancel</Text>
                            </TouchableOpacity>
                        </>)
                    }
                </View>
            )}

            {/* ── Search + Filters ── */}
            <View style={{ padding: 16, paddingBottom: 0 }}>
                <View style={S.searchBar}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput
                        placeholder="Search by name, ID, reference..."
                        placeholderTextColor="#94A3B8"
                        style={S.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                    {['All', ...STATUSES].map(f => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setFilter(f)}
                            style={[S.filterChip, filter === f && S.activeChip]}
                        >
                            <Text style={{ color: filter === f ? 'white' : '#64748B', fontSize: 12, fontWeight: '700' }}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* ── Orders List ── */}
            {loading && !refreshing
                ? <ActivityIndicator color="#0F172A" style={{ marginTop: 60 }} size="large" />
                : (
                    <FlatList
                        data={filteredOrders}
                        keyExtractor={item => item.id}
                        renderItem={renderOrderItem}
                        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} colors={['#0F172A']} />}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 60 }}>
                                <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
                                <Text style={{ color: '#94A3B8', marginTop: 12, fontWeight: '600' }}>No orders found</Text>
                            </View>
                        }
                    />
                )
            }

            {/* ─────── Order Detail Modal ─────── */}
            <Modal visible={!!selectedOrder} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '95%' }}>
                        {order && (
                            <>
                                {/* Modal Header */}
                                <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View>
                                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>Order Details</Text>
                                            <Text style={{ color: '#64748B', fontSize: 12 }}>#{order.id.slice(0, 8).toUpperCase()}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                                            <TouchableOpacity onPress={() => Share.share({ message: `Order #${order.id.slice(0, 8).toUpperCase()}\nCustomer: ${order.user?.full_name}\nTotal: ₦${order.total_amount?.toLocaleString()}\nStatus: ${order.status?.toUpperCase()}` })}>
                                                <Ionicons name="share-outline" size={22} color="#64748B" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => { setSelectedOrder(null); setOrderItems([]); setTimeline([]); }}>
                                                <Ionicons name="close-circle" size={28} color="#CBD5E1" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

                                    {/* ─ Status Badge + Update Row ─ */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                        <View style={[S.badge, { backgroundColor: statusColor.bg, paddingHorizontal: 14, paddingVertical: 6 }]}>
                                            <Text style={{ color: statusColor.text, fontWeight: '800', fontSize: 13 }}>{order.status?.toUpperCase()}</Text>
                                        </View>
                                        <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                                            {new Date(order.created_at).toLocaleString()}
                                        </Text>
                                    </View>

                                    {/* ─ Customer Info ─ */}
                                    <View style={S.card}>
                                        <Text style={S.cardTitle}>👤 Customer</Text>
                                        <Text style={S.cardValue}>{order.user?.full_name || 'N/A'}</Text>
                                        <Text style={S.cardSub}>{order.user?.email}</Text>
                                        {/* 4. Call + WhatsApp */}
                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                            {order.user?.phone && (
                                                <TouchableOpacity onPress={() => Linking.openURL('tel:' + order.user.phone)} style={[S.callBtn, { marginTop: 0 }]}>
                                                    <Ionicons name="call" size={14} color="white" />
                                                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>Call</Text>
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity onPress={() => openWhatsApp(order.user?.phone, order)} style={[S.callBtn, { marginTop: 0, backgroundColor: '#25D366' }]}>
                                                <Ionicons name="logo-whatsapp" size={14} color="white" />
                                                <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>WhatsApp</Text>
                                            </TouchableOpacity>
                                        </View>
                                        {/* 5. Address + Open in Maps */}
                                        <TouchableOpacity onPress={() => openMaps(order.shipping_address)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6, backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10 }}>
                                            <Ionicons name="location" size={14} color="#16A34A" />
                                            <Text style={{ fontSize: 13, color: '#166534', flex: 1 }}>{formatAddress(order.shipping_address)}</Text>
                                            <Ionicons name="open-outline" size={14} color="#16A34A" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* ─ Payment Details ─ */}
                                    <View style={S.card}>
                                        <Text style={S.cardTitle}>💳 Payment Details</Text>
                                        <View style={S.detailRow}>
                                            <Text style={S.detailLabel}>Method</Text>
                                            <Text style={S.detailValue}>{order.payment_method || 'N/A'}</Text>
                                        </View>
                                        {/* 6. Copy Reference */}
                                        <View style={S.detailRow}>
                                            <Text style={S.detailLabel}>Reference</Text>
                                            <TouchableOpacity onPress={() => copyReference(order.payment_reference)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Text style={{ fontSize: 11, color: '#3B82F6', fontWeight: '700', maxWidth: 140 }} numberOfLines={1}>{order.payment_reference || 'N/A'}</Text>
                                                <Ionicons name={copiedRef ? 'checkmark-circle' : 'copy-outline'} size={14} color={copiedRef ? '#16A34A' : '#94A3B8'} />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={[S.detailRow, { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8, marginTop: 4 }]}>
                                            <Text style={S.detailLabel}>Subtotal</Text>
                                            <Text style={S.detailValue}>₦{(order.subtotal || 0).toLocaleString()}</Text>
                                        </View>
                                        <View style={S.detailRow}>
                                            <Text style={S.detailLabel}>Shipping</Text>
                                            <Text style={S.detailValue}>₦{(order.shipping_fee || 0).toLocaleString()}</Text>
                                        </View>
                                        <View style={S.detailRow}>
                                            <Text style={S.detailLabel}>Tax (5%)</Text>
                                            <Text style={S.detailValue}>₦{(order.tax || 0).toLocaleString()}</Text>
                                        </View>
                                        {order.discount_applied > 0 && (
                                            <View style={S.detailRow}>
                                                <Text style={[S.detailLabel, { color: '#16A34A' }]}>Discount</Text>
                                                <Text style={[S.detailValue, { color: '#16A34A' }]}>-₦{(order.discount_applied).toLocaleString()}</Text>
                                            </View>
                                        )}
                                        <View style={[S.detailRow, { backgroundColor: '#0F172A', borderRadius: 10, padding: 12, marginTop: 8 }]}>
                                            <Text style={{ color: '#94A3B8', fontWeight: '700' }}>TOTAL</Text>
                                            <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>₦{(order.total_amount || 0).toLocaleString()}</Text>
                                        </View>
                                    </View>

                                    {/* ─ Order Items ─ */}
                                    <View style={S.card}>
                                        <Text style={S.cardTitle}>📦 Items Ordered</Text>
                                        {loadingItems
                                            ? <ActivityIndicator color="#3B82F6" />
                                            : orderItems.length === 0
                                                ? <Text style={S.cardSub}>No items found in database.</Text>
                                                : orderItems.map((item, i) => {
                                                    const imgArr = item.product?.images;
                                                    const imgUrl = Array.isArray(imgArr) ? imgArr[0] : (typeof imgArr === 'string' ? imgArr : null);
                                                    return (
                                                        <View key={item.id || i} style={[S.detailRow, { paddingVertical: 10, alignItems: 'flex-start', borderBottomWidth: i < orderItems.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9' }]}>
                                                            {/* Product Image */}
                                                            {imgUrl
                                                                ? <Image source={{ uri: imgUrl }} style={{ width: 52, height: 52, borderRadius: 12, marginRight: 10, backgroundColor: '#F1F5F9' }} resizeMode="cover" />
                                                                : <View style={{ width: 52, height: 52, borderRadius: 12, marginRight: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <Ionicons name="image-outline" size={22} color="#CBD5E1" />
                                                                </View>
                                                            }
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 13 }}>{item.product?.name || 'Product'}</Text>
                                                                <Text style={{ color: '#64748B', fontSize: 12 }}>Qty: {item.quantity} × ₦{(item.price || 0).toLocaleString()}</Text>
                                                                {item.variant && <Text style={{ color: '#94A3B8', fontSize: 11 }}>Variant: {item.variant}</Text>}
                                                            </View>
                                                            <Text style={{ fontWeight: '800', color: '#0F172A', marginTop: 4 }}>₦{((item.price || 0) * (item.quantity || 1)).toLocaleString()}</Text>
                                                        </View>
                                                    );
                                                })
                                        }
                                    </View>

                                    {/* ─ Order Notes ─ */}
                                    {order.order_notes ? (
                                        <View style={S.card}>
                                            <Text style={S.cardTitle}>📝 Order Notes</Text>
                                            <Text style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>"{order.order_notes}"</Text>
                                        </View>
                                    ) : null}

                                    {/* ─ Driver Assignment ─ */}
                                    <View style={S.card}>
                                        <Text style={S.cardTitle}>🚴 Assign Driver</Text>
                                        {drivers.length === 0
                                            ? <Text style={S.cardSub}>No drivers available.</Text>
                                            : (
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                                                        {drivers.map(driver => {
                                                            const isAssigned = order.driver_id === driver.id;
                                                            return (
                                                                <TouchableOpacity
                                                                    key={driver.id}
                                                                    onPress={() => assignDriver(order.id, driver.id)}
                                                                    disabled={updating}
                                                                    style={[S.driverChip, isAssigned && { backgroundColor: '#0F172A', borderColor: '#0F172A' }]}
                                                                >
                                                                    <Ionicons name="bicycle" size={13} color={isAssigned ? 'white' : '#3B82F6'} />
                                                                    <Text style={{ color: isAssigned ? 'white' : '#0F172A', fontSize: 12, fontWeight: '700' }}>{driver.name}</Text>
                                                                    <Text style={{ color: isAssigned ? 'rgba(255,255,255,0.6)' : '#94A3B8', fontSize: 10 }}>{getLevel(driver.xp)}</Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                </ScrollView>
                                            )
                                        }
                                        {order.driver && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6, backgroundColor: '#EFF6FF', padding: 10, borderRadius: 10 }}>
                                                <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: '#1D4ED8', fontWeight: '700', fontSize: 13 }}>{order.driver.name}</Text>
                                                    <Text style={{ color: '#60A5FA', fontSize: 11 }}>{order.driver.vehicle_type} • {order.driver.xp || 0} XP</Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                                    <TouchableOpacity onPress={() => Linking.openURL('tel:' + order.driver.phone)} style={[S.callBtn, { marginTop: 0 }]}>
                                                        <Ionicons name="call" size={14} color="white" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => openWhatsApp(order.driver.phone, order, order.driver.name)} style={[S.callBtn, { marginTop: 0, backgroundColor: '#25D366' }]}>
                                                        <Ionicons name="logo-whatsapp" size={14} color="white" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    {/* ─ Update Status ─ */}
                                    <View style={S.card}>
                                        <Text style={S.cardTitle}>🔄 Update Status</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                            {STATUSES.map(status => {
                                                const isCurrent = order.status?.toLowerCase() === status.toLowerCase();
                                                return (
                                                    <TouchableOpacity
                                                        key={status}
                                                        onPress={() => updateStatus(order.id, status, order)}
                                                        disabled={updating || isCurrent}
                                                        style={[S.statusBtn, isCurrent && { backgroundColor: '#0F172A', borderColor: '#0F172A', opacity: 1 }]}
                                                    >
                                                        {updating && isCurrent
                                                            ? <ActivityIndicator size="small" color="white" />
                                                            : <Text style={{ color: isCurrent ? 'white' : '#475569', fontWeight: '700', fontSize: 12 }}>{status}</Text>
                                                        }
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>

                                    {/* ─ Order Timeline ─ */}
                                    <View style={S.card}>
                                        <Text style={S.cardTitle}>🕐 Order Timeline</Text>
                                        {loadingItems
                                            ? <ActivityIndicator color="#3B82F6" />
                                            : timeline.length === 0
                                                ? <Text style={S.cardSub}>No history yet. Status changes will appear here.</Text>
                                                : timeline.map((log, i) => {
                                                    const logColor = STATUS_COLORS[log.status?.toLowerCase()] || { bg: '#F1F5F9', text: '#64748B' };
                                                    return (
                                                        <View key={log.id || i} style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                                                            <View style={{ alignItems: 'center' }}>
                                                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: logColor.text, marginTop: 3 }} />
                                                                {i < timeline.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: 2 }} />}
                                                            </View>
                                                            <View style={{ flex: 1, paddingBottom: 6 }}>
                                                                <View style={[S.badge, { backgroundColor: logColor.bg, alignSelf: 'flex-start', marginBottom: 4 }]}>
                                                                    <Text style={{ color: logColor.text, fontWeight: '800', fontSize: 10 }}>{log.status?.toUpperCase()}</Text>
                                                                </View>
                                                                {log.note && <Text style={{ fontSize: 12, color: '#475569', marginBottom: 2 }}>{log.note}</Text>}
                                                                <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                                                                    {new Date(log.created_at).toLocaleString()} {log.changed_by_profile ? `— by ${log.changed_by_profile.full_name}` : ''}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    );
                                                })
                                        }
                                    </View>

                                    {/* 2. Admin Internal Notes */}
                                    <View style={S.card}>
                                        <Text style={S.cardTitle}>📌 Admin Notes (Internal)</Text>
                                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                                            <TextInput
                                                style={{ flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10, fontSize: 13, color: '#0F172A', backgroundColor: '#F8FAFC', minHeight: 44 }}
                                                placeholder="Add a private note for this order..."
                                                placeholderTextColor="#94A3B8"
                                                value={adminNote}
                                                onChangeText={setAdminNote}
                                                multiline
                                            />
                                            <TouchableOpacity onPress={saveAdminNote} disabled={savingNote || !adminNote.trim()}
                                                style={{ backgroundColor: adminNote.trim() ? '#0F172A' : '#E2E8F0', padding: 12, borderRadius: 12 }}>
                                                {savingNote ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="send" size={16} color={adminNote.trim() ? 'white' : '#94A3B8'} />}
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* ─ Action Buttons ─ */}
                                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                                        <TouchableOpacity
                                            onPress={() => handleExportInvoice(order, orderItems)}
                                            disabled={isExporting}
                                            style={[S.actionBtn, { backgroundColor: '#EFF6FF', flex: 1 }]}
                                        >
                                            {isExporting
                                                ? <ActivityIndicator color="#3B82F6" size="small" />
                                                : <><Ionicons name="download-outline" size={16} color="#3B82F6" /><Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 13 }}>Invoice PDF</Text></>
                                            }
                                        </TouchableOpacity>
                                        {/* 9. Customer Receipt */}
                                        <TouchableOpacity
                                            onPress={() => shareReceipt(order, orderItems)}
                                            style={[S.actionBtn, { backgroundColor: '#F0FDF4', flex: 1 }]}
                                        >
                                            <Ionicons name="receipt-outline" size={16} color="#16A34A" />
                                            <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 13 }}>Receipt</Text>
                                        </TouchableOpacity>
                                        {order.status !== 'cancelled' && order.status !== 'delivered' && (
                                            <TouchableOpacity
                                                onPress={() => openRefundModal(order)}
                                                style={[S.actionBtn, { backgroundColor: '#FEF2F2', flex: 1 }]}
                                            >
                                                <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                                                <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Refund</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ─── Refund Modal ─── */}
            <Modal visible={showRefundModal} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 24 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>Refund & Cancel Order</Text>
                        <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
                            Order #{refundOrder?.id?.slice(0, 8).toUpperCase()} — ₦{(refundOrder?.total_amount || 0).toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>Reason *</Text>
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, padding: 14, fontSize: 14, color: '#0F172A', minHeight: 80, backgroundColor: '#F8FAFC', marginBottom: 20 }}
                            placeholder="e.g. Customer requested cancellation, item out of stock..."
                            placeholderTextColor="#94A3B8"
                            value={refundReason}
                            onChangeText={setRefundReason}
                            multiline
                        />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setShowRefundModal(false)}
                                style={{ flex: 1, padding: 16, backgroundColor: '#F1F5F9', borderRadius: 14, alignItems: 'center' }}
                            >
                                <Text style={{ fontWeight: '700', color: '#64748B' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleRefund}
                                style={{ flex: 1.5, padding: 16, backgroundColor: '#EF4444', borderRadius: 14, alignItems: 'center' }}
                            >
                                <Text style={{ fontWeight: '800', color: 'white' }}>Confirm Refund</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <WhatsAppActionModal
                visible={whatsappVisible}
                phone={whatsappPhone}
                userId={whatsappUserId}
                recipientName={whatsappRecipientName}
                orderData={whatsappOrder}
                onClose={() => setWhatsappVisible(false)}
            />
        </View>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
    orderCard: { backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    orderRef: { fontSize: 13, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
    searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8 },
    activeChip: { backgroundColor: '#0F172A' },
    card: { backgroundColor: 'white', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
    cardTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 12, letterSpacing: 0.2 },
    cardValue: { fontWeight: '700', fontSize: 16, color: '#0F172A', marginBottom: 2 },
    cardSub: { fontSize: 13, color: '#64748B' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    detailLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    detailValue: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    callBtn: { backgroundColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginTop: 10, alignSelf: 'flex-start' },
    driverChip: { flexDirection: 'column', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', gap: 2, minWidth: 80 },
    statusBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'white', alignItems: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 14 },
};
