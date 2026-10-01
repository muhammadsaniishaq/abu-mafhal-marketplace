import React, { useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, RefreshControl, Image,
    Linking, Alert, TextInput, StyleSheet, Platform, Modal,
    ScrollView, Animated, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';

const { width: SCREEN_W } = Dimensions.get('window');
const NAVY = '#070D1B';
const GOLD = '#D9A73A';

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS_CFG = {
    pending:         { color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', label: 'Pending',         icon: 'time-outline',             emoji: '⏳' },
    processing:      { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', label: 'Processing',      icon: 'sync-outline',             emoji: '⚙️' },
    shipped:         { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', label: 'Shipped',         icon: 'car-outline',              emoji: '🚚' },
    out_for_delivery:{ color: '#0284C7', bg: '#E0F2FE', border: '#BAE6FD', label: 'Out for Delivery',icon: 'bicycle-outline',          emoji: '🛵' },
    delivered:       { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', label: 'Delivered',       icon: 'checkmark-circle-outline', emoji: '✅' },
    cancelled:       { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Cancelled',       icon: 'close-circle-outline',     emoji: '❌' },
};

const PAYMENT_CFG = {
    paystack:    { label: 'Paystack',      icon: 'card-outline',      color: '#0BA4DB' },
    flutterwave: { label: 'Flutterwave',   icon: 'flash-outline',     color: '#F5A623' },
    wallet:      { label: 'Wallet',        icon: 'wallet-outline',    color: '#7C3AED' },
    pod:         { label: 'Pay on Delivery', icon: 'cash-outline',    color: '#059669' },
    crypto:      { label: 'Crypto',        icon: 'logo-bitcoin',      color: '#F59E0B' },
    transfer:    { label: 'Bank Transfer', icon: 'swap-horizontal-outline', color: '#2563EB' },
};

const CARRIERS = ['GIG Logistics', 'DHL', 'UPS', 'FedEx', 'NIPOST', 'Kwik Delivery', 'Aramex', 'Sendbox'];
const FILTERS  = ['All', 'Pending', 'Processing', 'Shipped', 'Out_for_delivery', 'Delivered', 'Cancelled'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => `₦${Number(n || 0).toLocaleString('en-NG')}`;
const shortId = (id) => (id ? id.toString().substring(0, 8).toUpperCase() : '—');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const parseAddress = (addr) => {
    if (!addr) return 'Address on file';
    if (typeof addr === 'string') return addr;
    const { address, city, state, zipCode } = addr;
    return [address, city, state, zipCode].filter(Boolean).join(', ');
};

// ─── Sub-components ──────────────────────────────────────────────────────────
const StatusBadge = ({ status, small }) => {
    const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
    return (
        <View style={[badge.wrap, { backgroundColor: cfg.bg, borderColor: cfg.border }, small && { paddingHorizontal: 7, paddingVertical: 3 }]}>
            <Ionicons name={cfg.icon} size={small ? 11 : 13} color={cfg.color} style={{ marginRight: 4 }} />
            <Text style={[badge.text, { color: cfg.color }, small && { fontSize: 10 }]}>{cfg.label.toUpperCase()}</Text>
        </View>
    );
};
const badge = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
    text: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
});

const InfoRow = ({ icon, label, value, valueColor }) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
        <Ionicons name={icon} size={14} color='#94A3B8' style={{ marginTop: 2, width: 20 }} />
        <Text style={{ fontSize: 12, color: '#94A3B8', width: 90 }}>{label}</Text>
        <Text style={[{ fontSize: 12.5, fontWeight: '600', color: valueColor || '#1E293B', flex: 1 }]} numberOfLines={3}>{value || '—'}</Text>
    </View>
);

const SectionCard = ({ title, icon, children, color = '#0F172A', accentColor }) => (
    <View style={det.section}>
        <View style={[det.sectionHeader, accentColor && { borderLeftColor: accentColor, borderLeftWidth: 3, paddingLeft: 10 }]}>
            <Ionicons name={icon} size={16} color={accentColor || color} />
            <Text style={[det.sectionTitle, { color }]}>{title}</Text>
        </View>
        {children}
    </View>
);
const det = StyleSheet.create({
    section: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 13.5, fontWeight: '800', color: '#0F172A' },
});

// ─── ORDER DETAIL MODAL ───────────────────────────────────────────────────────
const OrderDetailModal = ({ item, visible, onClose, onUpdateStatus, updatingId, vendor }) => {
    const [trackingNum, setTrackingNum] = useState(item?.trackingNumber || '');
    const [carrier, setCarrier] = useState('');
    const [statusNote, setStatusNote] = useState('');
    const [showCarrierPicker, setShowCarrierPicker] = useState(false);

    React.useEffect(() => {
        if (item) {
            setTrackingNum(item.trackingNumber || '');
            setStatusNote('');
            setCarrier('');
        }
    }, [item]);

    if (!item) return null;

    const statusKey = (item.status || 'pending').toLowerCase().replace(/ /g, '_');
    const statusCfg = STATUS_CFG[statusKey] || STATUS_CFG.pending;
    const isUpdating = updatingId === item.id;
    const isPOD = item.isPOD || item.paymentMethod === 'pod';
    const isInstallment = item.isInstallment;
    const plan = item.installmentPlan || {};
    const deliveredByAbumafhal = item.deliveredByAbumafhal || !!item.driverId;
    const paymentCfg = PAYMENT_CFG[item.paymentMethod] || PAYMENT_CFG.paystack;

    const getNextActions = () => {
        const map = {
            pending:    [{ to: 'Processing', label: 'Accept & Process', icon: 'checkmark-done', color: '#2563EB' }, { to: 'Cancelled', label: 'Reject Order', icon: 'close-circle', color: '#DC2626' }],
            processing: [{ to: 'Shipped', label: 'Mark as Shipped 🚚', icon: 'car', color: '#7C3AED' }, { to: 'Cancelled', label: 'Cancel Order', icon: 'close-circle', color: '#DC2626' }],
            shipped:    [{ to: 'Delivered', label: 'Confirm Delivered ✅', icon: 'checkmark-circle', color: '#059669' }],
            out_for_delivery: [{ to: 'Delivered', label: 'Confirm Delivered ✅', icon: 'checkmark-circle', color: '#059669' }],
            delivered:  [],
            cancelled:  [],
        };
        return map[statusKey] || [];
    };

    const handleCall = () => {
        if (!item.phone) return Alert.alert('No Phone', 'No phone number on file.');
        Linking.openURL(`tel:${item.phone.replace(/\D/g, '')}`);
    };

    const handleWhatsApp = () => {
        if (!item.phone) return Alert.alert('No WhatsApp', 'No phone number on file.');
        let phone = item.phone.replace(/\D/g, '');
        if (phone.startsWith('0')) phone = '234' + phone.slice(1);
        if (!phone.startsWith('234')) phone = '234' + phone;
        const msg = encodeURIComponent(
            `Hello ${item.customerName || 'Customer'}! 👋\n\nThis is regarding your Abu Mafhal Marketplace order #${shortId(item.id)}.\n\nCurrent Status: ${statusCfg.label}\n\nPlease feel free to reply with any questions.`
        );
        Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => Alert.alert('Error', 'Cannot open WhatsApp.'));
    };

    const confirmUpdate = (to) => {
        Alert.alert(
            `Update to "${to}"?`,
            `This will change Order #${shortId(item.id)} status to ${to}. ${trackingNum ? `\nTracking: ${trackingNum}` : ''}${isPOD && to === 'Delivered' ? '\n\n⚠️ PAY ON DELIVERY: Ensure you have collected ₦' + fmt(item.amount) + ' cash before confirming delivery.' : ''}`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: `Confirm → ${to}`, style: 'default', onPress: () => onUpdateStatus(item.id, to, trackingNum, statusNote) },
            ]
        );
    };

    const installmentPct = plan.total_installments > 0 ? Math.round((plan.paid_installments / plan.total_installments) * 100) : 0;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={mod.container}>
                {/* Modal Header */}
                <View style={mod.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={mod.orderId}>Order #{shortId(item.id)}</Text>
                        <Text style={mod.orderDate}>{fmtDateTime(item.raw_date)}</Text>
                    </View>
                    <StatusBadge status={statusKey} />
                    <TouchableOpacity onPress={onClose} style={mod.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close" size={22} color="#334155" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={mod.content} showsVerticalScrollIndicator={false}>

                    {/* ─── Special Banners ─────────────────────────────────── */}
                    {isPOD && (
                        <View style={[mod.banner, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                            <Ionicons name="cash" size={20} color="#059669" />
                            <View style={{ flex: 1 }}>
                                <Text style={[mod.bannerTitle, { color: '#065F46' }]}>💵 Pay on Delivery Order</Text>
                                <Text style={[mod.bannerDesc, { color: '#047857' }]}>
                                    Customer will pay {fmt(item.amount)} in CASH upon delivery. Collect payment before handing over the package!
                                </Text>
                            </View>
                        </View>
                    )}

                    {isInstallment && (
                        <View style={[mod.banner, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
                            <Ionicons name="layers-outline" size={20} color="#16A34A" />
                            <View style={{ flex: 1 }}>
                                <Text style={[mod.bannerTitle, { color: '#15803D' }]}>💳 Pay Small Small — Installment Plan</Text>
                                <Text style={[mod.bannerDesc, { color: '#166534' }]}>
                                    {plan.paid_installments || 0} of {plan.total_installments} installments paid ({installmentPct}%)
                                </Text>
                                {/* Installment Progress */}
                                <View style={mod.progressBar}>
                                    <View style={[mod.progressFill, { width: `${installmentPct}%`, backgroundColor: '#16A34A' }]} />
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                                    <Text style={{ fontSize: 11, color: '#166534', fontWeight: '700' }}>
                                        Paid: {fmt(plan.paid_amount || 0)}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600' }}>
                                        Remaining: {fmt((plan.total_amount || 0) - (plan.paid_amount || 0))}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ─── Delivery Method Banner ───────────────────────── */}
                    <View style={[mod.banner, deliveredByAbumafhal
                        ? { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }
                        : { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                        <Ionicons
                            name={deliveredByAbumafhal ? 'bicycle' : 'storefront-outline'}
                            size={20}
                            color={deliveredByAbumafhal ? '#2563EB' : '#EA580C'}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={[mod.bannerTitle, { color: deliveredByAbumafhal ? '#1D4ED8' : '#9A3412' }]}>
                                {deliveredByAbumafhal ? '🛵 Delivered by Abu Mafhal' : '📦 Self-Delivered by You (Vendor)'}
                            </Text>
                            <Text style={[mod.bannerDesc, { color: deliveredByAbumafhal ? '#3B82F6' : '#C2410C' }]}>
                                {deliveredByAbumafhal
                                    ? 'Our logistics team will handle pickup & delivery. Prepare the package for our driver.'
                                    : 'You are responsible for packaging and shipping this order to the customer.'}
                            </Text>
                        </View>
                    </View>

                    {/* ─── Product Info ──────────────────────────────────── */}
                    <SectionCard title="Product Details" icon="cube-outline" accentColor="#6366F1">
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={det2.imgBox}>
                                {item.image && item.image !== 'https://placehold.co/80' ? (
                                    <Image source={{ uri: item.image }} style={det2.img} resizeMode="cover" />
                                ) : (
                                    <Ionicons name="cube-outline" size={30} color="#CBD5E1" />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={det2.productName}>{item.item || 'Product'}</Text>
                                {item.variant && (
                                    <View style={det2.variantBadge}>
                                        <Text style={det2.variantText}>Variant: {item.variant}</Text>
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'center' }}>
                                    <View style={det2.qtyBox}>
                                        <Text style={det2.qtyText}>Qty: {item.quantity}</Text>
                                    </View>
                                    <Text style={{ fontSize: 12.5, color: '#64748B' }}>{fmt(item.price)} each</Text>
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '600' }}>Your Earnings</Text>
                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#10B981' }}>{fmt(item.amount)}</Text>
                            </View>
                        </View>
                    </SectionCard>

                    {/* ─── Financial Breakdown ──────────────────────────── */}
                    <SectionCard title="Financial Breakdown" icon="receipt-outline" accentColor="#10B981">
                        {[
                            ['Subtotal', item.subtotal],
                            ['Shipping Fee', item.shippingFee],
                            ...(item.discount > 0 ? [['Discount', -item.discount]] : []),
                            ...(item.tax > 0 ? [['Tax', item.tax]] : []),
                        ].map(([label, val]) => (
                            <View key={label} style={fin.row}>
                                <Text style={fin.label}>{label}</Text>
                                <Text style={[fin.val, val < 0 && { color: '#DC2626' }]}>{val < 0 ? `-${fmt(Math.abs(val))}` : fmt(val)}</Text>
                            </View>
                        ))}
                        <View style={fin.totalRow}>
                            <Text style={fin.totalLabel}>Order Total</Text>
                            <Text style={fin.totalVal}>{fmt(item.totalAmount || item.amount)}</Text>
                        </View>
                        {/* Payment method */}
                        <View style={[fin.row, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: '#F1F5F9' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name={paymentCfg.icon} size={14} color={paymentCfg.color} />
                                <Text style={[fin.label, { color: paymentCfg.color }]}>{paymentCfg.label}</Text>
                            </View>
                            <View style={[fin.payStatus, item.paymentStatus === 'paid' ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#FEF3C7' }]}>
                                <Text style={{ fontSize: 10.5, fontWeight: '800', color: item.paymentStatus === 'paid' ? '#16A34A' : '#D97706' }}>
                                    {(item.paymentStatus || 'UNPAID').toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    </SectionCard>

                    {/* ─── Installment Detail (if BNPL) ──────────────────── */}
                    {isInstallment && plan.schedule && plan.schedule.length > 0 && (
                        <SectionCard title="Installment Schedule" icon="layers-outline" accentColor="#16A34A">
                            {plan.schedule.map((inst, i) => (
                                <View key={i} style={[inst_s.row, inst.paid && inst_s.rowPaid]}>
                                    <View style={[inst_s.dot, { backgroundColor: inst.paid ? '#16A34A' : '#E2E8F0' }]} />
                                    <Text style={inst_s.label}>Installment {i + 1}</Text>
                                    <Text style={inst_s.date}>{fmtDate(inst.due_date)}</Text>
                                    <Text style={[inst_s.amount, { color: inst.paid ? '#16A34A' : '#64748B' }]}>{fmt(inst.amount)}</Text>
                                    {inst.paid && <Ionicons name="checkmark-circle" size={14} color="#16A34A" style={{ marginLeft: 4 }} />}
                                </View>
                            ))}
                        </SectionCard>
                    )}

                    {/* ─── Customer Details ──────────────────────────────── */}
                    <SectionCard title="Customer & Shipping" icon="person-outline" accentColor="#3B82F6">
                        <InfoRow icon="person-outline" label="Name" value={item.customerName} />
                        {item.phone ? <InfoRow icon="call-outline" label="Phone" value={item.phone} valueColor="#2563EB" /> : null}
                        {item.customerEmail ? <InfoRow icon="mail-outline" label="Email" value={item.customerEmail} valueColor="#2563EB" /> : null}
                        <InfoRow icon="location-outline" label="Address" value={parseAddress(item.address)} />
                        {item.notes ? <InfoRow icon="document-text-outline" label="Note" value={item.notes} valueColor="#D97706" /> : null}

                        {/* Call / WhatsApp buttons */}
                        {item.phone && (
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                <TouchableOpacity onPress={handleCall} style={act.callBtn} activeOpacity={0.8}>
                                    <Ionicons name="call" size={14} color="#2563EB" />
                                    <Text style={act.callText}>Call</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleWhatsApp} style={act.waBtn} activeOpacity={0.8}>
                                    <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                                    <Text style={act.waText}>WhatsApp</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </SectionCard>

                    {/* ─── Tracking ──────────────────────────────────────── */}
                    <SectionCard title="Tracking & Logistics" icon="map-outline" accentColor="#7C3AED">
                        <InfoRow icon="barcode-outline" label="Tracking #" value={item.trackingNumber} valueColor="#7C3AED" />
                        <InfoRow icon="time-outline" label="Ordered" value={fmtDateTime(item.raw_date)} />
                        {item.updatedAt && <InfoRow icon="refresh-outline" label="Updated" value={fmtDateTime(item.updatedAt)} />}

                        {/* Tracking number input for next update */}
                        {getNextActions().length > 0 && (
                            <View style={{ marginTop: 8 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6 }}>Update Tracking Number</Text>
                                <TextInput
                                    value={trackingNum}
                                    onChangeText={setTrackingNum}
                                    placeholder="e.g. GIG-1234567890"
                                    placeholderTextColor="#CBD5E1"
                                    style={act.input}
                                />
                                {/* Carrier */}
                                <TouchableOpacity onPress={() => setShowCarrierPicker(!showCarrierPicker)} style={[act.input, { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                                    <Text style={{ fontSize: 13, color: carrier ? '#0F172A' : '#CBD5E1', fontWeight: '600' }}>{carrier || 'Select Carrier'}</Text>
                                    <Ionicons name={showCarrierPicker ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" />
                                </TouchableOpacity>
                                {showCarrierPicker && (
                                    <View style={act.pickerList}>
                                        {CARRIERS.map((c) => (
                                            <TouchableOpacity key={c} onPress={() => { setCarrier(c); setShowCarrierPicker(false); }} style={act.pickerItem}>
                                                <Text style={[act.pickerText, carrier === c && { color: '#7C3AED', fontWeight: '800' }]}>{c}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                                <TextInput
                                    value={statusNote}
                                    onChangeText={setStatusNote}
                                    placeholder="Update note (e.g. Package dispatched...)"
                                    placeholderTextColor="#CBD5E1"
                                    style={[act.input, { marginTop: 6 }]}
                                    multiline
                                    numberOfLines={2}
                                />
                            </View>
                        )}
                    </SectionCard>

                    {/* ─── POD Special Warning ──────────────────────────── */}
                    {isPOD && statusKey === 'shipped' && (
                        <View style={[mod.banner, { backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1.5 }]}>
                            <Ionicons name="warning" size={22} color="#D97706" />
                            <View style={{ flex: 1 }}>
                                <Text style={[mod.bannerTitle, { color: '#92400E' }]}>⚠️ Cash Collection Required!</Text>
                                <Text style={[mod.bannerDesc, { color: '#78350F' }]}>
                                    This is a Pay on Delivery order. Collect exactly {fmt(item.amount)} cash from the customer before marking as Delivered. Do NOT mark delivered without collecting payment.
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* ─── Status Action Buttons ────────────────────────── */}
                    {getNextActions().length > 0 && (
                        <View style={act.actionsSection}>
                            <Text style={act.actionsTitle}>Update Order Status</Text>
                            {getNextActions().map((action) => (
                                <TouchableOpacity
                                    key={action.to}
                                    onPress={() => confirmUpdate(action.to)}
                                    disabled={isUpdating}
                                    style={[act.actionBtn, { backgroundColor: action.color }, isUpdating && { opacity: 0.5 }]}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name={action.icon} size={18} color="#FFFFFF" />
                                    <Text style={act.actionBtnText}>{action.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Delivered / Cancelled notice */}
                    {statusKey === 'delivered' && (
                        <View style={[mod.finalNotice, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                            <View>
                                <Text style={[mod.finalTitle, { color: '#065F46' }]}>Order Delivered 🎉</Text>
                                <Text style={[mod.finalDesc, { color: '#047857' }]}>
                                    {isPOD ? 'Cash collected & order delivered. Earnings will be credited to your balance.' : 'Earnings credited to your available balance.'}
                                </Text>
                            </View>
                        </View>
                    )}
                    {statusKey === 'cancelled' && (
                        <View style={[mod.finalNotice, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                            <Ionicons name="close-circle" size={28} color="#DC2626" />
                            <View><Text style={[mod.finalTitle, { color: '#991B1B' }]}>Order Cancelled</Text></View>
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </Modal>
    );
};

// Styles for detail modal
const mod = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#F1F5F9' },
    orderId: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
    orderDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
    content: { padding: 14 },
    banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
    bannerTitle: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
    bannerDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
    progressBar: { height: 6, backgroundColor: '#DCFCE7', borderRadius: 10, marginTop: 8, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 10 },
    finalNotice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    finalTitle: { fontSize: 14, fontWeight: '800' },
    finalDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
});
const det2 = StyleSheet.create({
    imgBox: { width: 70, height: 70, borderRadius: 14, backgroundColor: '#F1F5F9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    img: { width: '100%', height: '100%' },
    productName: { fontSize: 14, fontWeight: '800', color: '#0F172A', lineHeight: 19 },
    variantBadge: { backgroundColor: '#F5F3FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4, alignSelf: 'flex-start' },
    variantText: { fontSize: 11, color: '#7C3AED', fontWeight: '700' },
    qtyBox: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    qtyText: { fontSize: 11.5, fontWeight: '700', color: '#475569' },
});
const fin = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
    label: { fontSize: 12.5, color: '#64748B', fontWeight: '600' },
    val: { fontSize: 12.5, color: '#0F172A', fontWeight: '700' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderColor: '#F1F5F9', marginTop: 4 },
    totalLabel: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
    totalVal: { fontSize: 16, fontWeight: '900', color: '#10B981' },
    payStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});
const inst_s = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F8FAFC' },
    rowPaid: { opacity: 0.75 },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    label: { fontSize: 12, fontWeight: '700', color: '#334155', flex: 1 },
    date: { fontSize: 11, color: '#94A3B8', width: 80 },
    amount: { fontSize: 12.5, fontWeight: '800', width: 70, textAlign: 'right' },
});
const act = StyleSheet.create({
    actionsSection: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    actionsTitle: { fontSize: 13.5, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 8 },
    actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0F172A', fontWeight: '600' },
    pickerList: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden', marginTop: 4 },
    pickerItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F8FAFC' },
    pickerText: { fontSize: 13, color: '#334155', fontWeight: '600' },
    callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, backgroundColor: '#EFF6FF', borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE' },
    callText: { fontSize: 12.5, fontWeight: '800', color: '#2563EB' },
    waBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, backgroundColor: '#DCFCE7', borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0' },
    waText: { fontSize: 12.5, fontWeight: '800', color: '#16A34A' },
});

// ─── MAIN VendorOrders COMPONENT ─────────────────────────────────────────────
export const VendorOrders = ({
    orders = [],
    vendor,
    orderFilter = 'All',
    setOrderFilter,
    refreshing = false,
    setRefreshing,
    fetchDashboardData,
    handleUpdateOrderStatus,
}) => {
    const [search, setSearch] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [detailVisible, setDetailVisible] = useState(false);

    const openDetail = (item) => {
        setSelectedOrder(item);
        setDetailVisible(true);
    };

    // Status update handler (calls parent or does it directly)
    const executeUpdate = useCallback(async (orderId, newStatus, trackingNumber = '', notes = '') => {
        setUpdatingId(orderId);
        try {
            if (handleUpdateOrderStatus) {
                await handleUpdateOrderStatus(orderId, newStatus, trackingNumber, notes);
            } else {
                const now = new Date().toISOString();
                const payload = { status: newStatus.toLowerCase(), updated_at: now };
                if (trackingNumber) payload.tracking_number = trackingNumber;
                const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
                if (error) throw error;
                await supabase.from('order_status_logs').insert({
                    order_id: orderId, status: newStatus.toLowerCase(), title: newStatus,
                    description: notes || `Status updated to ${newStatus}`, created_at: now,
                });
                if (fetchDashboardData) await fetchDashboardData();
            }
            // Update modal if open on this order
            if (selectedOrder?.id === orderId) {
                setSelectedOrder((prev) => prev ? { ...prev, status: newStatus.toLowerCase(), trackingNumber: trackingNumber || prev.trackingNumber } : prev);
            }
            Alert.alert('✅ Updated', `Order marked as ${newStatus}`);
        } catch (err) {
            console.error('Order update error:', err);
            Alert.alert('Error', err.message || 'Could not update order status.');
        } finally {
            setUpdatingId(null);
        }
    }, [handleUpdateOrderStatus, fetchDashboardData, selectedOrder]);

    // Filter & search
    const filteredOrders = orders.filter((o) => {
        const fKey = (o.status || '').toLowerCase().replace(/ /g, '_');
        const filterKey = orderFilter.toLowerCase().replace(/ /g, '_');
        const matchFilter = filterKey === 'all' || fKey === filterKey;
        if (!matchFilter) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            (o.item || '').toLowerCase().includes(q) ||
            (o.customerName || '').toLowerCase().includes(q) ||
            shortId(o.id).toLowerCase().includes(q) ||
            (o.trackingNumber || '').toLowerCase().includes(q) ||
            (o.phone || '').includes(q)
        );
    });

    // Stats
    const counts = {
        All: orders.length,
        Pending: orders.filter((o) => o.status === 'pending').length,
        Processing: orders.filter((o) => o.status === 'processing').length,
        Shipped: orders.filter((o) => o.status === 'shipped').length,
        Out_for_delivery: orders.filter((o) => o.status === 'out_for_delivery').length,
        Delivered: orders.filter((o) => o.status === 'delivered').length,
        Cancelled: orders.filter((o) => o.status === 'cancelled').length,
    };
    const pendingRevenue = orders.filter((o) => !['delivered', 'cancelled', 'refunded'].includes(o.status)).reduce((s, o) => s + (o.amount || 0), 0);
    const deliveredRevenue = orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + (o.amount || 0), 0);
    const podPending = orders.filter((o) => o.isPOD && o.status !== 'delivered' && o.status !== 'cancelled');

    const FILTER_TABS = FILTERS.filter((f) => f === 'All' || counts[f] > 0 || f === 'All');

    return (
        <View style={s.container}>
            {/* ─── TOP STATS BAR ───────────────────────────────────────── */}
            <View style={s.statsBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
                    <View style={[s.statCard, { backgroundColor: '#0F172A' }]}>
                        <Text style={[s.statVal, { color: '#FFFFFF' }]}>{counts.All}</Text>
                        <Text style={[s.statLabel, { color: '#94A3B8' }]}>Total</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[s.statVal, { color: '#D97706' }]}>{counts.Pending}</Text>
                        <Text style={[s.statLabel, { color: '#92400E' }]}>Pending ⏳</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: '#ECFDF5' }]}>
                        <Text style={[s.statVal, { color: '#059669' }]}>{fmt(deliveredRevenue)}</Text>
                        <Text style={[s.statLabel, { color: '#065F46' }]}>Earned ✅</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: '#F0FDF4' }]}>
                        <Text style={[s.statVal, { color: '#16A34A' }]}>{fmt(pendingRevenue)}</Text>
                        <Text style={[s.statLabel, { color: '#166534' }]}>In Escrow 🔒</Text>
                    </View>
                    {podPending.length > 0 && (
                        <View style={[s.statCard, { backgroundColor: '#DCFCE7' }]}>
                            <Text style={[s.statVal, { color: '#16A34A' }]}>{podPending.length}</Text>
                            <Text style={[s.statLabel, { color: '#166534' }]}>POD 💵</Text>
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* ─── SEARCH + EXPORT ─────────────────────────────────────── */}
            <View style={s.toolbar}>
                <View style={s.searchBox}>
                    <Ionicons name="search" size={16} color="#94A3B8" />
                    <TextInput
                        placeholder="Search orders, customers..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                        style={s.searchInput}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ─── FILTER TABS ─────────────────────────────────────────── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
                {FILTER_TABS.map((f) => {
                    const isActive = orderFilter === f;
                    const count = counts[f] || 0;
                    const cfg = STATUS_CFG[f.toLowerCase().replace(/ /g, '_')];
                    return (
                        <TouchableOpacity key={f} onPress={() => setOrderFilter?.(f)} style={[s.chip, isActive && s.chipActive, isActive && cfg && { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                            <Text style={[s.chipText, isActive && s.chipTextActive, isActive && cfg && { color: cfg.color }]}>
                                {f === 'Out_for_delivery' ? 'Out for Delivery' : f}
                            </Text>
                            {count > 0 && (
                                <View style={[s.chipBadge, isActive && cfg && { backgroundColor: cfg.color }]}>
                                    <Text style={[s.chipBadgeText, isActive && { color: '#FFFFFF' }]}>{count}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* ─── ORDERS LIST ─────────────────────────────────────────── */}
            <FlatList
                data={filteredOrders}
                keyExtractor={(item, i) => `${item.id}-${i}`}
                contentContainerStyle={s.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing?.(true); fetchDashboardData?.(); }}
                        colors={[NAVY]} tintColor={NAVY}
                    />
                }
                renderItem={({ item }) => {
                    const statusKey = (item.status || 'pending').toLowerCase().replace(/ /g, '_');
                    const cfg = STATUS_CFG[statusKey] || STATUS_CFG.pending;
                    const isUpdating = updatingId === item.id;
                    const isPOD = item.isPOD || item.paymentMethod === 'pod';
                    const isInstallment = item.isInstallment;
                    const deliveredByAbumafhal = item.deliveredByAbumafhal || !!item.driverId;

                    return (
                        <TouchableOpacity onPress={() => openDetail(item)} activeOpacity={0.9} style={s.card}>
                            {/* Card Header */}
                            <View style={s.cardRow}>
                                <View style={s.orderIconBox}>
                                    <Ionicons name="receipt-outline" size={18} color={NAVY} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={s.orderId}>#{shortId(item.id)}</Text>
                                        {isPOD && <View style={s.podTag}><Text style={s.podTagText}>💵 POD</Text></View>}
                                        {isInstallment && <View style={s.installTag}><Text style={s.installTagText}>📅 Installment</Text></View>}
                                    </View>
                                    <Text style={s.orderDate}>{item.date}</Text>
                                </View>
                                <StatusBadge status={statusKey} small />
                            </View>

                            <View style={s.divider} />

                            {/* Product Row */}
                            <View style={s.productRow}>
                                <View style={s.thumbBox}>
                                    {item.image && item.image !== 'https://placehold.co/80' ? (
                                        <Image source={{ uri: item.image }} style={s.thumb} resizeMode="cover" />
                                    ) : (
                                        <Ionicons name="cube-outline" size={22} color="#CBD5E1" />
                                    )}
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={s.productName} numberOfLines={2}>{item.item}</Text>
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' }}>
                                        <View style={s.qtyBadge}><Text style={s.qtyText}>×{item.quantity}</Text></View>
                                        {item.variant && <View style={s.varTag}><Text style={s.varText}>{item.variant}</Text></View>}
                                        <Text style={s.unitPrice}>{fmt(item.price)}</Text>
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={s.earningsLabel}>Earnings</Text>
                                    <Text style={s.earningsVal}>{fmt(item.amount)}</Text>
                                </View>
                            </View>

                            {/* Customer Row */}
                            <View style={s.customerBar}>
                                <Ionicons name="person-circle-outline" size={14} color="#94A3B8" />
                                <Text style={s.customerName} numberOfLines={1}>{item.customerName}</Text>
                                {/* Delivery by badge */}
                                <View style={[s.deliveryTag, deliveredByAbumafhal ? { backgroundColor: '#EFF6FF' } : { backgroundColor: '#FFF7ED' }]}>
                                    <Ionicons name={deliveredByAbumafhal ? 'bicycle' : 'storefront-outline'} size={10} color={deliveredByAbumafhal ? '#2563EB' : '#EA580C'} />
                                    <Text style={[s.deliveryTagText, { color: deliveredByAbumafhal ? '#2563EB' : '#EA580C' }]}>
                                        {deliveredByAbumafhal ? 'Abu Mafhal' : 'By Vendor'}
                                    </Text>
                                </View>
                            </View>

                            {/* Quick Actions (in-card, for urgent statuses) */}
                            {['pending', 'processing', 'shipped'].includes(statusKey) && (
                                <View style={s.quickActions}>
                                    {statusKey === 'pending' && (
                                        <TouchableOpacity
                                            onPress={() => { Alert.alert('Accept Order?', `Accept order #${shortId(item.id)} and start processing?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Accept', onPress: () => executeUpdate(item.id, 'Processing') }]); }}
                                            disabled={isUpdating}
                                            style={[s.quickBtn, { backgroundColor: '#2563EB' }]}
                                        >
                                            <Ionicons name="checkmark-done" size={13} color="#FFF" />
                                            <Text style={s.quickBtnText}>Accept</Text>
                                        </TouchableOpacity>
                                    )}
                                    {statusKey === 'processing' && (
                                        <TouchableOpacity
                                            onPress={() => openDetail(item)}
                                            style={[s.quickBtn, { backgroundColor: '#7C3AED' }]}
                                        >
                                            <Ionicons name="car" size={13} color="#FFF" />
                                            <Text style={s.quickBtnText}>Ship</Text>
                                        </TouchableOpacity>
                                    )}
                                    {statusKey === 'shipped' && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                const msg = isPOD ? `⚠️ PAY ON DELIVERY! Ensure you collect ${fmt(item.amount)} CASH first.\n\nConfirm delivery of order #${shortId(item.id)}?` : `Confirm delivery of order #${shortId(item.id)}?`;
                                                Alert.alert('Confirm Delivered?', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delivered ✅', onPress: () => executeUpdate(item.id, 'Delivered') }]);
                                            }}
                                            disabled={isUpdating}
                                            style={[s.quickBtn, { backgroundColor: '#059669', flex: 1 }]}
                                        >
                                            <Ionicons name="checkmark-circle" size={13} color="#FFF" />
                                            <Text style={s.quickBtnText}>{isPOD ? '💵 Collect & Deliver' : 'Mark Delivered'}</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={() => openDetail(item)} style={[s.quickBtn, { backgroundColor: '#F1F5F9', flex: statusKey !== 'shipped' ? 1 : undefined }]}>
                                        <Ionicons name="eye-outline" size={13} color="#334155" />
                                        <Text style={[s.quickBtnText, { color: '#334155' }]}>Details</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {statusKey === 'delivered' && (
                                <View style={s.deliveredStrip}>
                                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                    <Text style={s.deliveredStripText}>
                                        {isPOD ? '💵 Cash collected & Delivered' : 'Delivered · Earnings Credited'}
                                    </Text>
                                </View>
                            )}
                            {statusKey === 'cancelled' && (
                                <View style={[s.deliveredStrip, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                                    <Ionicons name="close-circle" size={14} color="#DC2626" />
                                    <Text style={[s.deliveredStripText, { color: '#DC2626' }]}>Order Cancelled</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View style={s.emptyBox}>
                        <View style={s.emptyIconBox}><Ionicons name="bag-handle-outline" size={48} color="#CBD5E1" /></View>
                        <Text style={s.emptyTitle}>{search ? `No results for "${search}"` : 'No orders yet'}</Text>
                        <Text style={s.emptyDesc}>{search ? 'Try a different search term.' : 'When buyers purchase from your store, orders will appear here.'}</Text>
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}>
                                <Text style={s.clearBtnText}>Clear Search</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
            />

            {/* ─── ORDER DETAIL MODAL ───────────────────────────────────── */}
            {selectedOrder && (
                <OrderDetailModal
                    item={selectedOrder}
                    visible={detailVisible}
                    onClose={() => { setDetailVisible(false); setSelectedOrder(null); }}
                    onUpdateStatus={executeUpdate}
                    updatingId={updatingId}
                    vendor={vendor}
                />
            )}
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    statsBar: { backgroundColor: '#FFFFFF', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' },
    statCard: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, minWidth: 90, alignItems: 'center' },
    statVal: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
    statLabel: { fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'center' },
    toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF', gap: 8 },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
    searchInput: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#0F172A', height: '100%' },
    filterScroll: { paddingHorizontal: 14, paddingBottom: 10, paddingTop: 2, gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
    chipActive: { backgroundColor: NAVY, borderColor: NAVY },
    chipText: { fontSize: 12.5, fontWeight: '700', color: '#64748B' },
    chipTextActive: { color: '#FFFFFF' },
    chipBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, backgroundColor: '#E2E8F0', minWidth: 18, alignItems: 'center' },
    chipBadgeText: { fontSize: 10.5, fontWeight: '800', color: '#475569' },
    listContent: { padding: 14, paddingBottom: 120 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E8EFFE', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    orderIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    orderId: { fontSize: 13.5, fontWeight: '900', color: '#0F172A' },
    orderDate: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
    podTag: { backgroundColor: '#DCFCE7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    podTagText: { fontSize: 10, fontWeight: '800', color: '#16A34A' },
    installTag: { backgroundColor: '#F0FDF4', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    installTagText: { fontSize: 10, fontWeight: '800', color: '#15803D' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
    productRow: { flexDirection: 'row', alignItems: 'center' },
    thumbBox: { width: 62, height: 62, borderRadius: 12, backgroundColor: '#F8FAFC', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    thumb: { width: '100%', height: '100%' },
    productName: { fontSize: 13.5, fontWeight: '700', color: '#0F172A', lineHeight: 18 },
    qtyBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    qtyText: { fontSize: 11, fontWeight: '700', color: '#475569' },
    varTag: { backgroundColor: '#F5F3FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    varText: { fontSize: 10.5, color: '#7C3AED', fontWeight: '700' },
    unitPrice: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    earningsLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
    earningsVal: { fontSize: 17, fontWeight: '900', color: '#10B981', marginTop: 2 },
    customerBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: '#F8FAFC' },
    customerName: { fontSize: 12, fontWeight: '700', color: '#334155', flex: 1 },
    deliveryTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
    deliveryTagText: { fontSize: 10, fontWeight: '800' },
    quickActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    quickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10 },
    quickBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    deliveredStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8, backgroundColor: '#ECFDF5', borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' },
    deliveredStripText: { fontSize: 11.5, fontWeight: '800', color: '#059669' },
    emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
    emptyIconBox: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
    emptyDesc: { fontSize: 12.5, color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 18, maxWidth: 280 },
    clearBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: NAVY },
    clearBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
