import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    FlatList,
    RefreshControl,
    Image,
    Linking,
    Alert,
    TextInput,
    StyleSheet,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';

const STATUS_CONFIG = {
    pending: {
        color: '#D97706',
        bg: '#FEF3C7',
        border: '#FDE68A',
        label: 'Pending',
        icon: 'time-outline'
    },
    processing: {
        color: '#2563EB',
        bg: '#EFF6FF',
        border: '#BFDBFE',
        label: 'Processing',
        icon: 'sync-outline'
    },
    shipped: {
        color: '#7C3AED',
        bg: '#F5F3FF',
        border: '#DDD6FE',
        label: 'Shipped',
        icon: 'car-outline'
    },
    delivered: {
        color: '#059669',
        bg: '#ECFDF5',
        border: '#A7F3D0',
        label: 'Delivered',
        icon: 'checkmark-circle-outline'
    },
    cancelled: {
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FECACA',
        label: 'Cancelled',
        icon: 'close-circle-outline'
    }
};

export const VendorOrders = ({
    orders = [],
    vendor,
    orderFilter = 'All',
    setOrderFilter,
    refreshing = false,
    setRefreshing,
    fetchDashboardData,
    handleUpdateOrderStatus
}) => {
    const [search, setSearch] = useState('');
    const [updatingId, setUpdatingId] = useState(null);

    // Direct status updater as robust fallback
    const executeStatusUpdate = async (orderId, newStatus) => {
        const confirmMsg = `Update Order #${orderId?.toString().slice(0, 8).toUpperCase()} to "${newStatus}"?`;

        const proceed = async () => {
            setUpdatingId(orderId);
            try {
                if (handleUpdateOrderStatus) {
                    await handleUpdateOrderStatus(orderId, newStatus);
                } else {
                    const statusLower = newStatus.toLowerCase();
                    const { error } = await supabase
                        .from('orders')
                        .update({
                            status: statusLower,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', orderId);

                    if (error) throw error;
                    if (fetchDashboardData) await fetchDashboardData();
                }

                if (Platform.OS === 'web') alert(`Order updated to ${newStatus}`);
                else Alert.alert('Success', `Order marked as ${newStatus}`);
            } catch (err) {
                console.error('Order update error:', err);
                if (Platform.OS === 'web') alert('Failed to update: ' + err.message);
                else Alert.alert('Error', err.message || 'Could not update order status.');
            } finally {
                setUpdatingId(null);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm && window.confirm(confirmMsg)) {
                proceed();
            } else if (!window.confirm) {
                proceed();
            }
        } else {
            Alert.alert('Update Order Status', confirmMsg, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', onPress: proceed }
            ]);
        }
    };

    const copyTracking = (tracking) => {
        if (!tracking) return;
        Clipboard.setStringAsync(tracking);
        if (Platform.OS === 'web') alert(`Copied tracking number: ${tracking}`);
        else Alert.alert('Copied', `Tracking #${tracking} copied to clipboard.`);
    };

    const handleCallCustomer = (phone) => {
        if (!phone) return Alert.alert('No Phone', 'Customer did not provide a phone number.');
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        Linking.openURL(`tel:${cleanPhone}`).catch(() => {
            Alert.alert('Error', 'Unable to initiate call.');
        });
    };

    const handleWhatsAppCustomer = (phone, customerName, orderId) => {
        if (!phone) return Alert.alert('No WhatsApp', 'Customer did not provide a phone number.');
        let cleanPhone = phone.replace(/[^\d]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '234' + cleanPhone.slice(1);
        if (!cleanPhone.startsWith('234')) cleanPhone = '234' + cleanPhone;

        const text = encodeURIComponent(
            `Hello ${customerName || 'Customer'}, this is regarding your Abu Mafhal Marketplace Order #${orderId?.toString().slice(0, 8).toUpperCase()}.`
        );
        Linking.openURL(`https://wa.me/${cleanPhone}?text=${text}`).catch(() => {
            Alert.alert('Error', 'Unable to open WhatsApp.');
        });
    };

    const handlePrintPackingSlip = async (item) => {
        try {
            const storeName = vendor?.business_name || vendor?.name || 'Abu Mafhal Verified Store';
            const storePhone = vendor?.phone || vendor?.whatsapp || 'N/A';
            const tracking = item.trackingNumber || `ORD-${(item.id || '').slice(0, 8).toUpperCase()}`;

            const html = `
                <html>
                    <head>
                        <style>
                            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 24px; color: #0F172A; }
                            .header { border-bottom: 2px solid #0F172A; padding-bottom: 14px; margin-bottom: 20px; }
                            .title { font-size: 20px; font-weight: 900; margin: 0; color: #0F172A; }
                            .sub { font-size: 12px; color: #64748B; margin-top: 4px; }
                            .grid { display: flex; justify-content: space-between; margin-bottom: 20px; }
                            .box { flex: 1; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; background: #F8FAFC; margin-right: 10px; }
                            .box:last-child { margin-right: 0; }
                            .label { font-size: 10px; text-transform: uppercase; color: #64748B; font-weight: 700; }
                            .val { font-size: 13px; font-weight: 700; margin-top: 4px; color: #0F172A; }
                            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                            th, td { border: 1px solid #E2E8F0; padding: 10px; text-align: left; font-size: 12px; }
                            th { background: #0F172A; color: white; font-weight: 800; }
                            .total-row { font-size: 14px; font-weight: 900; background: #F1F5F9; }
                            .footer { margin-top: 30px; font-size: 11px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1 class="title">${storeName} - Dispatch Packing Slip</h1>
                            <div class="sub">Order & Shipping Slip • Generated: ${new Date().toLocaleString()}</div>
                        </div>

                        <div class="grid">
                            <div class="box">
                                <div class="label">Order & Tracking</div>
                                <div class="val">#${(item.id || '').slice(0, 8).toUpperCase()}</div>
                                <div style="font-size: 11px; color: #2563EB; margin-top: 2px;">Tracking: ${tracking}</div>
                                <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Date: ${item.date || 'Recent'}</div>
                            </div>

                            <div class="box">
                                <div class="label">Customer Destination</div>
                                <div class="val">${item.customerName || 'Verified Buyer'}</div>
                                <div style="font-size: 11px; color: #475569; margin-top: 2px;">Phone: ${item.phone || 'N/A'}</div>
                                <div style="font-size: 11px; color: #64748B; margin-top: 2px;">${item.address || 'Address on file'}</div>
                            </div>
                        </div>

                        <table>
                            <tr>
                                <th>Item Description</th>
                                <th style="width: 70px; text-align: center;">Qty</th>
                                <th style="width: 100px; text-align: right;">Unit Price (₦)</th>
                                <th style="width: 120px; text-align: right;">Amount (₦)</th>
                            </tr>
                            <tr>
                                <td><strong>${item.item || 'Product'}</strong></td>
                                <td style="text-align: center;">${item.quantity || 1}</td>
                                <td style="text-align: right;">₦${Number(item.price || item.amount || 0).toLocaleString()}</td>
                                <td style="text-align: right;">₦${Number(item.amount || 0).toLocaleString()}</td>
                            </tr>
                            <tr class="total-row">
                                <td colspan="3" style="text-align: right;">Total Store Payout:</td>
                                <td style="text-align: right; color: #16A34A;">₦${Number(item.amount || 0).toLocaleString()}</td>
                            </tr>
                        </table>

                        <div class="footer">
                            Official Abu Mafhal Marketplace Merchant Packing Slip • Delivered with Buyer Protection
                        </div>
                    </body>
                </html>
            `;
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (err) {
            console.error('Print slip error:', err);
            Alert.alert('Error', 'Could not generate packing slip.');
        }
    };

    const handleExportAllOrdersPdf = async () => {
        if (!orders || orders.length === 0) return Alert.alert('Notice', 'No orders to export.');
        try {
            const storeName = vendor?.business_name || vendor?.name || 'Abu Mafhal Verified Store';
            const html = `
                <html>
                    <head>
                        <style>
                            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #0F172A; }
                            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
                            th, td { border: 1px solid #E2E8F0; padding: 8px; text-align: left; }
                            th { background: #0F172A; color: white; font-weight: 800; }
                            .delivered { color: #16A34A; font-weight: bold; }
                            .pending { color: #D97706; font-weight: bold; }
                        </style>
                    </head>
                    <body>
                        <h2>${storeName} - All Orders Summary</h2>
                        <p style="font-size: 12px; color: #64748B;">Generated: ${new Date().toLocaleString()} • Total Orders: ${orders.length}</p>
                        <table>
                            <tr><th>Order ID</th><th>Date</th><th>Customer</th><th>Item</th><th>Qty</th><th>Earnings (₦)</th><th>Status</th></tr>
                            ${orders.map(o => `
                                <tr>
                                    <td>#${(o.id || '').slice(0, 8).toUpperCase()}</td>
                                    <td>${o.date || 'Recent'}</td>
                                    <td>${o.customerName || 'Buyer'}</td>
                                    <td>${o.item || 'Product'}</td>
                                    <td>${o.quantity || 1}</td>
                                    <td>₦${Number(o.amount || 0).toLocaleString()}</td>
                                    <td class="${(o.status || '').toLowerCase()}">${(o.status || 'PENDING').toUpperCase()}</td>
                                </tr>
                            `).join('')}
                        </table>
                    </body>
                </html>
            `;
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (err) {
            console.error('Export all orders error:', err);
            Alert.alert('Error', 'Could not export orders report.');
        }
    };

    // Filter & search
    const filteredOrders = orders.filter(o => {
        const matchesFilter =
            orderFilter === 'All' ||
            (o.status || '').toLowerCase() === orderFilter.toLowerCase();

        if (!matchesFilter) return false;

        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            (o.item || '').toLowerCase().includes(q) ||
            (o.customerName || '').toLowerCase().includes(q) ||
            (o.id || '').toLowerCase().includes(q) ||
            (o.trackingNumber || '').toLowerCase().includes(q) ||
            (o.phone || '').includes(q)
        );
    });

    const counts = {
        all: orders.length,
        pending: orders.filter(o => (o.status || '').toLowerCase() === 'pending').length,
        processing: orders.filter(o => (o.status || '').toLowerCase() === 'processing').length,
        shipped: orders.filter(o => (o.status || '').toLowerCase() === 'shipped').length,
        delivered: orders.filter(o => (o.status || '').toLowerCase() === 'delivered').length,
        cancelled: orders.filter(o => (o.status || '').toLowerCase() === 'cancelled').length,
    };

    const FILTER_TABS = [
        { id: 'All', label: 'All', count: counts.all },
        { id: 'Pending', label: 'Pending', count: counts.pending },
        { id: 'Processing', label: 'Processing', count: counts.processing },
        { id: 'Shipped', label: 'Shipped', count: counts.shipped },
        { id: 'Delivered', label: 'Delivered', count: counts.delivered },
        { id: 'Cancelled', label: 'Cancelled', count: counts.cancelled },
    ];

    return (
        <View style={styles.container}>
            {/* Search Bar & PDF Export */}
            <View style={styles.topToolbar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, gap: 8 }}>
                    <View style={[styles.searchBar, { flex: 1, marginHorizontal: 0 }]}>
                        <Ionicons name="search" size={17} color="#94A3B8" />
                        <TextInput
                            placeholder="Search orders, customers, tracking..."
                            placeholderTextColor="#94A3B8"
                            value={search}
                            onChangeText={setSearch}
                            style={styles.searchInput}
                            returnKeyType="search"
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')}>
                                <Ionicons name="close-circle" size={17} color="#CBD5E1" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={handleExportAllOrdersPdf}
                        style={styles.exportPdfBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="download-outline" size={15} color="#0F172A" />
                        <Text style={styles.exportPdfBtnText}>PDF</Text>
                    </TouchableOpacity>
                </View>

                {/* Filter Scroll */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterScroll}
                >
                    {FILTER_TABS.map(tab => {
                        const isActive = orderFilter === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                style={[styles.filterChip, isActive && styles.filterChipActive]}
                                onPress={() => setOrderFilter?.(tab.id)}
                                activeOpacity={0.75}
                            >
                                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                                    {tab.label}
                                </Text>
                                {tab.count > 0 && (
                                    <View style={[styles.chipCountBox, isActive && styles.chipCountBoxActive]}>
                                        <Text style={[styles.chipCountText, isActive && styles.chipCountTextActive]}>
                                            {tab.count}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Orders FlatList */}
            <FlatList
                data={filteredOrders}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing?.(true);
                            fetchDashboardData?.();
                        }}
                        colors={['#0F172A']}
                        tintColor="#0F172A"
                    />
                }
                renderItem={({ item }) => {
                    const statusKey = (item.status || 'pending').toLowerCase();
                    const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
                    const isUpdating = updatingId === item.id;
                    const tracking = item.trackingNumber || `TRK-${(item.id || '').slice(0, 8).toUpperCase()}`;

                    return (
                        <View style={styles.card}>
                            {/* Card Header: Order ID & Status */}
                            <View style={styles.cardHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                    <View style={styles.orderIconBox}>
                                        <Ionicons name="receipt-outline" size={18} color="#0F172A" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.orderIdText}>
                                                Order #{item.id?.toString().slice(0, 8).toUpperCase()}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => copyTracking(tracking)}
                                                style={styles.copyBtn}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons name="copy-outline" size={13} color="#64748B" />
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.orderDateText}>{item.date || 'Recent Order'}</Text>
                                    </View>
                                </View>

                                {/* Action Buttons: Status & Packing Slip */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <TouchableOpacity
                                        style={styles.printSlipBtn}
                                        onPress={() => handlePrintPackingSlip(item)}
                                        activeOpacity={0.75}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Ionicons name="print-outline" size={13} color="#334155" />
                                        <Text style={styles.printSlipBtnText}>Slip</Text>
                                    </TouchableOpacity>

                                    {/* Status Pill */}
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            {
                                                backgroundColor: statusCfg.bg,
                                                borderColor: statusCfg.border
                                            }
                                        ]}
                                    >
                                        <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} style={{ marginRight: 4 }} />
                                        <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
                                            {statusCfg.label.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.cardDivider} />

                            {/* Product Info Row */}
                            <View style={styles.productRow}>
                                <View style={styles.productThumbBox}>
                                    <Image
                                        source={{ uri: item.image || 'https://placehold.co/80' }}
                                        style={styles.productThumb}
                                        resizeMode="cover"
                                    />
                                </View>

                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.productName} numberOfLines={2}>
                                        {item.item || 'Order Product'}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                        <View style={styles.qtyBadge}>
                                            <Text style={styles.qtyBadgeText}>Qty: {item.quantity || 1}</Text>
                                        </View>
                                        <Text style={styles.unitPriceText}>
                                            ₦{(item.price || item.amount || 0).toLocaleString()}
                                        </Text>
                                    </View>
                                </View>

                                {/* Net Vendor Earnings */}
                                <View style={styles.earningsBox}>
                                    <Text style={styles.earningsLabel}>Store Earnings</Text>
                                    <Text style={styles.earningsValue}>
                                        ₦{(item.amount || 0).toLocaleString()}
                                    </Text>
                                </View>
                            </View>

                            {/* Customer & Address Details */}
                            <View style={styles.customerBox}>
                                <View style={styles.customerRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                        <Ionicons name="person-outline" size={14} color="#64748B" />
                                        <Text style={styles.customerNameText} numberOfLines={1}>
                                            {item.customerName || 'Verified Marketplace Buyer'}
                                        </Text>
                                    </View>

                                    {/* Action Call & WhatsApp Buttons */}
                                    {item.phone ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <TouchableOpacity
                                                onPress={() => handleCallCustomer(item.phone)}
                                                style={styles.contactBtn}
                                            >
                                                <Ionicons name="call" size={12} color="#2563EB" />
                                                <Text style={styles.contactBtnText}>Call</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => handleWhatsAppCustomer(item.phone, item.customerName, item.id)}
                                                style={[styles.contactBtn, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]}
                                            >
                                                <Ionicons name="logo-whatsapp" size={13} color="#16A34A" />
                                                <Text style={[styles.contactBtnText, { color: '#16A34A' }]}>Chat</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : null}
                                </View>

                                {item.address ? (
                                    <View style={styles.addressRow}>
                                        <Ionicons name="location-outline" size={14} color="#94A3B8" />
                                        <Text style={styles.addressText} numberOfLines={2}>
                                            {item.address}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            {/* ACTION BUTTONS (Fast order handling) */}
                            <View style={styles.actionsRow}>
                                {statusKey === 'pending' && (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.actionBtnBlue]}
                                            onPress={() => executeStatusUpdate(item.id, 'Processing')}
                                            disabled={isUpdating}
                                        >
                                            <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                                            <Text style={styles.actionBtnTextWhite}>Accept Order</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.actionBtnPurple]}
                                            onPress={() => executeStatusUpdate(item.id, 'Shipped')}
                                            disabled={isUpdating}
                                        >
                                            <Ionicons name="car" size={14} color="#FFFFFF" />
                                            <Text style={styles.actionBtnTextWhite}>Ship Now</Text>
                                        </TouchableOpacity>
                                    </>
                                )}

                                {statusKey === 'processing' && (
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.actionBtnPurple, { flex: 1 }]}
                                        onPress={() => executeStatusUpdate(item.id, 'Shipped')}
                                        disabled={isUpdating}
                                    >
                                        <Ionicons name="car" size={15} color="#FFFFFF" />
                                        <Text style={styles.actionBtnTextWhite}>Mark as Dispatched / Shipped</Text>
                                    </TouchableOpacity>
                                )}

                                {statusKey === 'shipped' && (
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.actionBtnGreen, { flex: 1 }]}
                                        onPress={() => executeStatusUpdate(item.id, 'Delivered')}
                                        disabled={isUpdating}
                                    >
                                        <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                                        <Text style={styles.actionBtnTextWhite}>Confirm Order Delivered</Text>
                                    </TouchableOpacity>
                                )}

                                {statusKey === 'delivered' && (
                                    <View style={styles.deliveredNotice}>
                                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                        <Text style={styles.deliveredNoticeText}>
                                            Delivered & Credited to Available Balance
                                        </Text>
                                    </View>
                                )}

                                {statusKey === 'cancelled' && (
                                    <View style={[styles.deliveredNotice, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                                        <Ionicons name="close-circle" size={16} color="#EF4444" />
                                        <Text style={[styles.deliveredNoticeText, { color: '#DC2626' }]}>
                                            Order Cancelled
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconBox}>
                            <Ionicons name="bag-handle-outline" size={44} color="#CBD5E1" />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {search ? `No orders matching "${search}"` : 'No orders in this category'}
                        </Text>
                        <Text style={styles.emptyDesc}>
                            {search
                                ? 'Try a different keyword or search query.'
                                : 'When customers purchase items from your store, their orders will appear here in real time.'}
                        </Text>
                        {search.length > 0 && (
                            <TouchableOpacity
                                style={styles.clearSearchBtn}
                                onPress={() => setSearch('')}
                            >
                                <Text style={styles.clearSearchBtnText}>Clear Search Filter</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    topToolbar: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
        paddingTop: 12,
        paddingBottom: 10
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        marginHorizontal: 16,
        paddingHorizontal: 12,
        height: 42,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 8
    },
    searchInput: {
        flex: 1,
        fontSize: 13.5,
        fontWeight: '600',
        color: '#0F172A',
        height: '100%'
    },
    filterScroll: {
        paddingHorizontal: 16,
        paddingTop: 10,
        gap: 8
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6
    },
    filterChipActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A'
    },
    filterChipText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#64748B'
    },
    filterChipTextActive: {
        color: '#FFFFFF'
    },
    chipCountBox: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10,
        backgroundColor: '#E2E8F0'
    },
    chipCountBoxActive: {
        backgroundColor: 'rgba(255,255,255,0.2)'
    },
    chipCountText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#475569'
    },
    chipCountTextActive: {
        color: '#FFFFFF'
    },
    listContent: {
        padding: 16,
        paddingBottom: 120
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    orderIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    orderIdText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    copyBtn: {
        padding: 2
    },
    orderDateText: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '500',
        marginTop: 1
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 9,
        paddingVertical: 4.5,
        borderRadius: 10,
        borderWidth: 1
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 12
    },
    productRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    productThumbBox: {
        width: 60,
        height: 60,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    productThumb: {
        width: '100%',
        height: '100%'
    },
    productName: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#0F172A',
        lineHeight: 18
    },
    qtyBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    qtyBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569'
    },
    unitPriceText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600'
    },
    earningsBox: {
        alignItems: 'flex-end',
        paddingLeft: 8
    },
    earningsLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '600'
    },
    earningsValue: {
        fontSize: 15,
        fontWeight: '900',
        color: '#10B981',
        marginTop: 2
    },
    customerBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 10,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        gap: 6
    },
    customerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    customerNameText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155'
    },
    contactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 6,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE'
    },
    contactBtnText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#2563EB'
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginTop: 2
    },
    addressText: {
        fontSize: 11,
        color: '#64748B',
        lineHeight: 15,
        flex: 1
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderColor: '#F1F5F9'
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        borderRadius: 10
    },
    actionBtnBlue: {
        backgroundColor: '#2563EB'
    },
    actionBtnPurple: {
        backgroundColor: '#7C3AED'
    },
    actionBtnGreen: {
        backgroundColor: '#059669'
    },
    actionBtnTextWhite: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800'
    },
    deliveredNotice: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        backgroundColor: '#ECFDF5',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#A7F3D0'
    },
    deliveredNoticeText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#059669'
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 50,
        paddingHorizontal: 20
    },
    emptyIconBox: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        textAlign: 'center'
    },
    emptyDesc: {
        fontSize: 12.5,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
        maxWidth: 280
    },
    clearSearchBtn: {
        marginTop: 14,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#0F172A'
    },
    clearSearchBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700'
    },
    exportPdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        paddingHorizontal: 12,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center'
    },
    exportPdfBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A'
    },
    printSlipBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4.5,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    printSlipBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155'
    }
});
