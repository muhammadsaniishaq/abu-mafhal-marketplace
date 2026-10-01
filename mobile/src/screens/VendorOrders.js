import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    Image,
    Linking,
    Alert,
    TextInput,
    StyleSheet,
    Modal,
    ScrollView,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const NAVY = '#070D1B';
const GOLD = '#D9A73A';

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
    pending:         { color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', label: 'Pending',         icon: 'time-outline' },
    processing:      { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', label: 'Processing',      icon: 'sync-outline' },
    shipped:         { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', label: 'Shipped',         icon: 'car-outline' },
    out_for_delivery:{ color: '#0284C7', bg: '#E0F2FE', border: '#BAE6FD', label: 'Out for Delivery',icon: 'bicycle-outline' },
    delivered:       { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', label: 'Delivered',       icon: 'checkmark-circle-outline' },
    cancelled:       { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Cancelled',       icon: 'close-circle-outline' },
};

const PAYMENT_CFG = {
    paystack:    { label: 'Paystack',       icon: 'card-outline',            color: '#0BA4DB' },
    flutterwave: { label: 'Flutterwave',    icon: 'flash-outline',           color: '#F5A623' },
    wallet:      { label: 'Wallet',         icon: 'wallet-outline',          color: '#7C3AED' },
    pod:         { label: 'Pay on Delivery',icon: 'cash-outline',            color: '#059669' },
    crypto:      { label: 'Crypto',         icon: 'logo-bitcoin',            color: '#F59E0B' },
    transfer:    { label: 'Bank Transfer',  icon: 'swap-horizontal-outline', color: '#2563EB' },
};

const CARRIERS = ['GIG Logistics', 'DHL', 'UPS', 'FedEx', 'NIPOST', 'Kwik Delivery', 'Aramex', 'Sendbox'];

// ─── Helpers ────────────────────────────────────────────────────────────────────
const fmt       = (n) => `\u20a6${Number(n || 0).toLocaleString('en-NG')}`;
const shortId   = (id) => (id ? id.toString().substring(0, 8).toUpperCase() : '\u2014');
const fmtDate   = (d) => d ? new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014';
const fmtDT     = (d) => d ? new Date(d).toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '\u2014';

const parseAddress = (addr) => {
    if (!addr) return 'Address on file';
    if (typeof addr === 'string') return addr;
    return [addr.address, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', ');
};

const getNextActions = (status) => {
    const map = {
        pending:         [{ to: 'Processing', label: 'Accept & Process', icon: 'checkmark-done', color: '#2563EB' }, { to: 'Cancelled', label: 'Reject', icon: 'close-circle', color: '#DC2626' }],
        processing:      [{ to: 'Shipped', label: 'Mark as Shipped', icon: 'car', color: '#7C3AED' }, { to: 'Cancelled', label: 'Cancel', icon: 'close-circle', color: '#DC2626' }],
        shipped:         [{ to: 'Delivered', label: 'Confirm Delivered', icon: 'checkmark-circle', color: '#059669' }],
        out_for_delivery:[{ to: 'Delivered', label: 'Confirm Delivered', icon: 'checkmark-circle', color: '#059669' }],
        delivered:       [],
        cancelled:       [],
    };
    return map[status] || [];
};

// ─── StatusBadge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status, small }) => {
    const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
    return (
        <View style={[
            bdg.wrap,
            { backgroundColor: cfg.bg, borderColor: cfg.border },
            small && { paddingHorizontal: 7, paddingVertical: 3 },
        ]}>
            <Ionicons name={cfg.icon} size={small ? 11 : 13} color={cfg.color} style={{ marginRight: 4 }} />
            <Text style={[bdg.text, { color: cfg.color }, small && { fontSize: 10 }]}>
                {cfg.label.toUpperCase()}
            </Text>
        </View>
    );
};
const bdg = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
    text: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
});

// ─── InfoRow ───────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, valueColor }) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
        <Ionicons name={icon} size={14} color="#94A3B8" style={{ marginTop: 2, width: 20 }} />
        <Text style={{ fontSize: 12, color: '#94A3B8', width: 88 }}>{label}</Text>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: valueColor || '#1E293B', flex: 1 }} numberOfLines={3}>
            {value || '\u2014'}
        </Text>
    </View>
);

// ─── SectionCard ──────────────────────────────────────────────────────────────
const SectionCard = ({ title, icon, children, accentColor }) => (
    <View style={sc.card}>
        <View style={[sc.header, accentColor && { borderLeftColor: accentColor, borderLeftWidth: 3, paddingLeft: 8 }]}>
            <Ionicons name={icon} size={15} color={accentColor || '#0F172A'} />
            <Text style={sc.title}>{title}</Text>
        </View>
        {children}
    </View>
);
const sc = StyleSheet.create({
    card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    title: { fontSize: 13.5, fontWeight: '800', color: '#0F172A' },
});

// ─── Banner ───────────────────────────────────────────────────────────────────
const Banner = ({ icon, iconColor, bgColor, borderColor, title, titleColor, desc, descColor }) => (
    <View style={[bnr.wrap, { backgroundColor: bgColor, borderColor }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
        <View style={{ flex: 1 }}>
            <Text style={[bnr.title, { color: titleColor }]}>{title}</Text>
            {desc ? <Text style={[bnr.desc, { color: descColor || titleColor }]}>{desc}</Text> : null}
        </View>
    </View>
);
const bnr = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
    title: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
    desc: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
});

// ─── ORDER DETAIL MODAL ────────────────────────────────────────────────────────
const OrderDetailModal = ({ item, visible, onClose, onUpdateStatus, updatingId }) => {
    const [trackingNum, setTrackingNum] = useState('');
    const [carrier, setCarrier] = useState('');
    const [note, setNote] = useState('');
    const [showCarriers, setShowCarriers] = useState(false);

    React.useEffect(() => {
        if (item) {
            setTrackingNum(item.trackingNumber || '');
            setNote('');
            setCarrier('');
            setShowCarriers(false);
        }
    }, [item?.id]);

    if (!item) return null;

    const statusKey = (item.status || 'pending').toLowerCase().replace(/ /g, '_');
    const isUpdating = updatingId === item.id;
    const isPOD = item.isPOD || item.paymentMethod === 'pod';
    const isInstallment = item.isInstallment;
    const plan = item.installmentPlan || {};
    const deliveredByAbumafhal = item.deliveredByAbumafhal || !!item.driverId;
    const paymentCfg = PAYMENT_CFG[item.paymentMethod] || PAYMENT_CFG.paystack;
    const actions = getNextActions(statusKey);

    const pctPaid = plan.total_installments > 0
        ? Math.round((plan.paid_installments / plan.total_installments) * 100)
        : 0;

    const handleCall = () => {
        if (!item.phone) return Alert.alert('No Phone', 'No phone number available.');
        Linking.openURL(`tel:${item.phone.replace(/\D/g, '')}`);
    };

    const handleWhatsApp = () => {
        if (!item.phone) return Alert.alert('No Phone', 'No phone number available.');
        let p = item.phone.replace(/\D/g, '');
        if (p.startsWith('0')) p = '234' + p.slice(1);
        if (!p.startsWith('234')) p = '234' + p;
        const msg = encodeURIComponent(
            `Hello ${item.customerName || 'Customer'}! \ud83d\udc4b\n\nThis is about your Abu Mafhal Marketplace order #${shortId(item.id)}.\nStatus: ${(STATUS_CFG[statusKey] || {}).label || statusKey}\n\nFeel free to reply with any questions.`
        );
        Linking.openURL(`https://wa.me/${p}?text=${msg}`).catch(() => Alert.alert('Error', 'Cannot open WhatsApp.'));
    };

    const confirmAction = (to) => {
        let msg = `Change order #${shortId(item.id)} to "${to}"?`;
        if (trackingNum) msg += `\n\nTracking: ${trackingNum}`;
        if (isPOD && to === 'Delivered') {
            msg += `\n\n\u26a0\ufe0f PAY ON DELIVERY!\nEnsure you have collected ${fmt(item.amount)} CASH before confirming!`;
        }
        Alert.alert(`Update to "${to}"?`, msg, [
            { text: 'Cancel', style: 'cancel' },
            { text: `Confirm \u2192 ${to}`, onPress: () => onUpdateStatus(item.id, to, trackingNum, note) },
        ]);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={mdl.container}>
                {/* Header */}
                <View style={mdl.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={mdl.orderId}>Order #{shortId(item.id)}</Text>
                        <Text style={mdl.orderDate}>{fmtDT(item.raw_date)}</Text>
                    </View>
                    <StatusBadge status={statusKey} />
                    <TouchableOpacity onPress={onClose} style={mdl.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <Ionicons name="close" size={22} color="#334155" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={mdl.body} showsVerticalScrollIndicator={false}>

                    {/* ── POD Banner ─── */}
                    {isPOD && (
                        <Banner
                            icon="cash" iconColor="#059669"
                            bgColor="#ECFDF5" borderColor="#A7F3D0"
                            title="\ud83d\udcb5 Pay on Delivery Order"
                            titleColor="#065F46"
                            desc={`Customer will pay ${fmt(item.amount)} CASH on delivery. Collect payment before handing over the package!`}
                            descColor="#047857"
                        />
                    )}

                    {/* ── POD Shipped Warning ─── */}
                    {isPOD && statusKey === 'shipped' && (
                        <Banner
                            icon="warning" iconColor="#D97706"
                            bgColor="#FFFBEB" borderColor="#FCD34D"
                            title="\u26a0\ufe0f Cash Collection Required!"
                            titleColor="#92400E"
                            desc={`Collect ${fmt(item.amount)} cash from customer BEFORE marking as Delivered. Do NOT confirm without payment!`}
                            descColor="#78350F"
                        />
                    )}

                    {/* ── Installment Banner ─── */}
                    {isInstallment && (
                        <View style={[bnr.wrap, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
                            <Ionicons name="layers-outline" size={20} color="#16A34A" />
                            <View style={{ flex: 1 }}>
                                <Text style={[bnr.title, { color: '#15803D' }]}>
                                    \ud83d\udcc5 Pay Small Small \u2014 Installment
                                </Text>
                                <Text style={[bnr.desc, { color: '#166534' }]}>
                                    {plan.paid_installments || 0} of {plan.total_installments} paid ({pctPaid}%)
                                </Text>
                                {/* Progress Bar */}
                                <View style={mdl.progBg}>
                                    <View style={[mdl.progFill, { width: `${pctPaid}%` }]} />
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                                    <Text style={{ fontSize: 11, color: '#166534', fontWeight: '700' }}>Paid: {fmt(plan.paid_amount || 0)}</Text>
                                    <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600' }}>Left: {fmt((plan.total_amount || 0) - (plan.paid_amount || 0))}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ── Delivery By Banner ─── */}
                    {deliveredByAbumafhal ? (
                        <Banner
                            icon="bicycle" iconColor="#2563EB"
                            bgColor="#EFF6FF" borderColor="#BFDBFE"
                            title="\ud83d\udee5\ufe0f Delivered by Abu Mafhal Logistics"
                            titleColor="#1D4ED8"
                            desc="Our driver will pick up and deliver. Prepare the package for driver collection."
                            descColor="#3B82F6"
                        />
                    ) : (
                        <Banner
                            icon="storefront-outline" iconColor="#EA580C"
                            bgColor="#FFF7ED" borderColor="#FED7AA"
                            title="\ud83d\udce6 Self-Delivery (You Ship This)"
                            titleColor="#9A3412"
                            desc="Package and ship this order yourself. Update tracking after dispatch."
                            descColor="#C2410C"
                        />
                    )}

                    {/* ── Product ─── */}
                    <SectionCard title="Product" icon="cube-outline" accentColor="#6366F1">
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={mdl.imgBox}>
                                {item.image && !item.image.includes('placehold') ? (
                                    <Image source={{ uri: item.image }} style={mdl.img} resizeMode="cover" />
                                ) : (
                                    <Ionicons name="cube-outline" size={28} color="#CBD5E1" />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={mdl.prodName}>{item.item || 'Product'}</Text>
                                {item.variant ? (
                                    <View style={mdl.variantBadge}>
                                        <Text style={mdl.variantText}>Variant: {item.variant}</Text>
                                    </View>
                                ) : null}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' }}>
                                    <View style={mdl.qtyBox}><Text style={mdl.qtyText}>Qty: {item.quantity}</Text></View>
                                    <Text style={{ fontSize: 12, color: '#64748B' }}>{fmt(item.price)} each</Text>
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '600' }}>Earnings</Text>
                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#10B981' }}>{fmt(item.amount)}</Text>
                            </View>
                        </View>
                    </SectionCard>

                    {/* ── Financial ─── */}
                    <SectionCard title="Financial Breakdown" icon="receipt-outline" accentColor="#10B981">
                        {[
                            ['Subtotal', item.subtotal || 0],
                            ['Shipping Fee', item.shippingFee || 0],
                            ...(item.discount > 0 ? [['Discount', -(item.discount)]] : []),
                            ...(item.tax > 0 ? [['Tax', item.tax]] : []),
                        ].map(([label, val]) => (
                            <View key={label} style={fin.row}>
                                <Text style={fin.label}>{label}</Text>
                                <Text style={[fin.val, val < 0 && { color: '#DC2626' }]}>
                                    {val < 0 ? `-${fmt(Math.abs(val))}` : fmt(val)}
                                </Text>
                            </View>
                        ))}
                        <View style={fin.totalRow}>
                            <Text style={fin.totalLabel}>Order Total</Text>
                            <Text style={fin.totalVal}>{fmt(item.totalAmount || item.amount)}</Text>
                        </View>
                        {/* Payment method */}
                        <View style={[fin.row, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: '#F1F5F9' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name={paymentCfg.icon} size={13} color={paymentCfg.color} />
                                <Text style={[fin.label, { color: paymentCfg.color }]}>{paymentCfg.label}</Text>
                            </View>
                            <View style={[fin.payBadge, {
                                backgroundColor: item.paymentStatus === 'paid' ? '#DCFCE7' : '#FEF3C7',
                            }]}>
                                <Text style={{ fontSize: 10.5, fontWeight: '800', color: item.paymentStatus === 'paid' ? '#16A34A' : '#D97706' }}>
                                    {(item.paymentStatus || 'UNPAID').toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    </SectionCard>

                    {/* ── Installment Schedule ─── */}
                    {isInstallment && plan.schedule && plan.schedule.length > 0 && (
                        <SectionCard title="Installment Schedule" icon="layers-outline" accentColor="#16A34A">
                            {plan.schedule.map((inst, i) => (
                                <View key={i} style={ins.row}>
                                    <View style={[ins.dot, { backgroundColor: inst.paid ? '#16A34A' : '#E2E8F0' }]} />
                                    <Text style={ins.label}>Installment {i + 1}</Text>
                                    <Text style={ins.date}>{fmtDate(inst.due_date)}</Text>
                                    <Text style={[ins.amount, { color: inst.paid ? '#16A34A' : '#64748B' }]}>{fmt(inst.amount)}</Text>
                                    {inst.paid && <Ionicons name="checkmark-circle" size={14} color="#16A34A" style={{ marginLeft: 4 }} />}
                                </View>
                            ))}
                        </SectionCard>
                    )}

                    {/* ── Customer ─── */}
                    <SectionCard title="Customer & Shipping" icon="person-outline" accentColor="#3B82F6">
                        <InfoRow icon="person-outline" label="Name" value={item.customerName} />
                        {item.phone ? <InfoRow icon="call-outline" label="Phone" value={item.phone} valueColor="#2563EB" /> : null}
                        {item.customerEmail ? <InfoRow icon="mail-outline" label="Email" value={item.customerEmail} valueColor="#2563EB" /> : null}
                        <InfoRow icon="location-outline" label="Address" value={parseAddress(item.address)} />
                        {item.notes ? <InfoRow icon="document-text-outline" label="Note" value={item.notes} valueColor="#D97706" /> : null}

                        {item.phone && (
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                <TouchableOpacity onPress={handleCall} style={cst.callBtn} activeOpacity={0.8}>
                                    <Ionicons name="call" size={14} color="#2563EB" />
                                    <Text style={cst.callText}>Call</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleWhatsApp} style={cst.waBtn} activeOpacity={0.8}>
                                    <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                                    <Text style={cst.waText}>WhatsApp</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </SectionCard>

                    {/* ── Tracking ─── */}
                    <SectionCard title="Tracking & Logistics" icon="map-outline" accentColor="#7C3AED">
                        <InfoRow icon="barcode-outline" label="Tracking #" value={item.trackingNumber} valueColor="#7C3AED" />
                        <InfoRow icon="time-outline" label="Ordered" value={fmtDT(item.raw_date)} />
                        {item.updatedAt ? <InfoRow icon="refresh-outline" label="Updated" value={fmtDT(item.updatedAt)} /> : null}

                        {actions.length > 0 && (
                            <View style={{ marginTop: 10 }}>
                                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#64748B', marginBottom: 8 }}>
                                    Update Tracking (optional)
                                </Text>
                                <TextInput
                                    value={trackingNum}
                                    onChangeText={setTrackingNum}
                                    placeholder="e.g. GIG-1234567890"
                                    placeholderTextColor="#CBD5E1"
                                    style={inp.field}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowCarriers(!showCarriers)}
                                    style={[inp.field, { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                                >
                                    <Text style={{ fontSize: 13, color: carrier ? '#0F172A' : '#CBD5E1', fontWeight: '600' }}>
                                        {carrier || 'Select Carrier (optional)'}
                                    </Text>
                                    <Ionicons name={showCarriers ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" />
                                </TouchableOpacity>
                                {showCarriers && (
                                    <View style={inp.dropdown}>
                                        {CARRIERS.map((c) => (
                                            <TouchableOpacity
                                                key={c}
                                                onPress={() => { setCarrier(c); setShowCarriers(false); }}
                                                style={inp.dropItem}
                                            >
                                                <Text style={[inp.dropText, carrier === c && { color: '#7C3AED', fontWeight: '800' }]}>{c}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                                <TextInput
                                    value={note}
                                    onChangeText={setNote}
                                    placeholder="Status note (e.g. Package dispatched to Lagos...)"
                                    placeholderTextColor="#CBD5E1"
                                    style={[inp.field, { marginTop: 8 }]}
                                    multiline
                                    numberOfLines={2}
                                />
                            </View>
                        )}
                    </SectionCard>

                    {/* ── Action Buttons ─── */}
                    {actions.length > 0 && (
                        <View style={act.section}>
                            <Text style={act.title}>Update Order Status</Text>
                            {actions.map((action) => (
                                <TouchableOpacity
                                    key={action.to}
                                    onPress={() => confirmAction(action.to)}
                                    disabled={isUpdating}
                                    style={[act.btn, { backgroundColor: action.color }, isUpdating && { opacity: 0.5 }]}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name={action.icon} size={18} color="#FFFFFF" />
                                    <Text style={act.btnText}>
                                        {action.label}
                                        {action.to === 'Delivered' && isPOD ? ' \ud83d\udcb5 (Collect Cash)' : ''}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* ── Final Status ─── */}
                    {statusKey === 'delivered' && (
                        <View style={[fin2.notice, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                            <View style={{ flex: 1 }}>
                                <Text style={[fin2.title, { color: '#065F46' }]}>Order Delivered \ud83c\udf89</Text>
                                <Text style={[fin2.desc, { color: '#047857' }]}>
                                    {isPOD ? 'Cash collected & order delivered successfully.' : 'Earnings have been credited to your balance.'}
                                </Text>
                            </View>
                        </View>
                    )}
                    {statusKey === 'cancelled' && (
                        <View style={[fin2.notice, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                            <Ionicons name="close-circle" size={28} color="#DC2626" />
                            <View style={{ flex: 1 }}>
                                <Text style={[fin2.title, { color: '#991B1B' }]}>Order Cancelled</Text>
                            </View>
                        </View>
                    )}

                    <View style={{ height: 50 }} />
                </ScrollView>
            </View>
        </Modal>
    );
};

// Modal styles
const mdl = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#F1F5F9' },
    orderId: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
    orderDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
    body: { padding: 14 },
    progBg: { height: 6, backgroundColor: '#DCFCE7', borderRadius: 10, marginTop: 8, overflow: 'hidden' },
    progFill: { height: '100%', borderRadius: 10, backgroundColor: '#16A34A' },
    imgBox: { width: 68, height: 68, borderRadius: 14, backgroundColor: '#F1F5F9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    img: { width: '100%', height: '100%' },
    prodName: { fontSize: 14, fontWeight: '800', color: '#0F172A', lineHeight: 19 },
    variantBadge: { backgroundColor: '#F5F3FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 4, alignSelf: 'flex-start' },
    variantText: { fontSize: 11, color: '#7C3AED', fontWeight: '700' },
    qtyBox: { backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    qtyText: { fontSize: 11.5, fontWeight: '700', color: '#475569' },
});
const fin = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
    label: { fontSize: 12.5, color: '#64748B', fontWeight: '600' },
    val: { fontSize: 12.5, color: '#0F172A', fontWeight: '700' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderColor: '#F1F5F9', marginTop: 4 },
    totalLabel: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
    totalVal: { fontSize: 16, fontWeight: '900', color: '#10B981' },
    payBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});
const ins = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F8FAFC' },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    label: { fontSize: 12, fontWeight: '700', color: '#334155', flex: 1 },
    date: { fontSize: 11, color: '#94A3B8', width: 80 },
    amount: { fontSize: 12.5, fontWeight: '800', width: 72, textAlign: 'right' },
});
const cst = StyleSheet.create({
    callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, backgroundColor: '#EFF6FF', borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE' },
    callText: { fontSize: 12.5, fontWeight: '800', color: '#2563EB' },
    waBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, backgroundColor: '#DCFCE7', borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0' },
    waText: { fontSize: 12.5, fontWeight: '800', color: '#16A34A' },
});
const inp = StyleSheet.create({
    field: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0F172A', fontWeight: '600' },
    dropdown: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden', marginTop: 4 },
    dropItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F8FAFC' },
    dropText: { fontSize: 13, color: '#334155', fontWeight: '600' },
});
const act = StyleSheet.create({
    section: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    title: { fontSize: 13.5, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 8 },
    btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
const fin2 = StyleSheet.create({
    notice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    title: { fontSize: 14, fontWeight: '800' },
    desc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
});

// ─── MAIN VendorOrders Component ───────────────────────────────────────────────
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
    const [modalVisible, setModalVisible] = useState(false);

    const openDetail = (item) => {
        setSelectedOrder(item);
        setModalVisible(true);
    };
    const closeDetail = () => {
        setModalVisible(false);
        setSelectedOrder(null);
    };

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
                    order_id: orderId,
                    status: newStatus.toLowerCase(),
                    title: newStatus,
                    description: notes || `Status updated to ${newStatus}`,
                    created_at: now,
                });
                if (fetchDashboardData) await fetchDashboardData();
            }
            // Update the selected order in modal if open
            if (selectedOrder?.id === orderId) {
                setSelectedOrder((prev) => prev ? { ...prev, status: newStatus.toLowerCase(), trackingNumber: trackingNumber || prev.trackingNumber } : prev);
            }
            Alert.alert('\u2705 Updated', `Order marked as ${newStatus}`);
        } catch (err) {
            console.error('Order update error:', err);
            Alert.alert('Error', err.message || 'Could not update order.');
        } finally {
            setUpdatingId(null);
        }
    }, [handleUpdateOrderStatus, fetchDashboardData, selectedOrder]);

    // Filter + Search
    const filteredOrders = orders.filter((o) => {
        const sk = (o.status || '').toLowerCase().replace(/ /g, '_');
        const fk = orderFilter.toLowerCase().replace(/ /g, '_');
        if (fk !== 'all' && sk !== fk) return false;
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

    // Counts
    const cnt = {
        All: orders.length,
        Pending: orders.filter((o) => o.status === 'pending').length,
        Processing: orders.filter((o) => o.status === 'processing').length,
        Shipped: orders.filter((o) => o.status === 'shipped').length,
        Delivered: orders.filter((o) => o.status === 'delivered').length,
        Cancelled: orders.filter((o) => o.status === 'cancelled').length,
    };
    const earnedRevenue = orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + (o.amount || 0), 0);
    const escrowRevenue = orders.filter((o) => !['delivered','cancelled'].includes(o.status)).reduce((s, o) => s + (o.amount || 0), 0);
    const podPending    = orders.filter((o) => o.isPOD && !['delivered','cancelled'].includes(o.status)).length;

    const FILTER_TABS = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

    return (
        <View style={s.container}>

            {/* ── Stats Bar ─────────────────────────────────────── */}
            <View style={s.statsBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
                    <View style={[s.statCard, { backgroundColor: '#0F172A' }]}>
                        <Text style={[s.statVal, { color: '#FFFFFF' }]}>{cnt.All}</Text>
                        <Text style={[s.statLbl, { color: '#94A3B8' }]}>Total</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[s.statVal, { color: '#D97706' }]}>{cnt.Pending}</Text>
                        <Text style={[s.statLbl, { color: '#92400E' }]}>Pending \u23f3</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: '#ECFDF5' }]}>
                        <Text style={[s.statVal, { color: '#059669', fontSize: 13 }]}>{fmt(earnedRevenue)}</Text>
                        <Text style={[s.statLbl, { color: '#065F46' }]}>Earned \u2705</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: '#EFF6FF' }]}>
                        <Text style={[s.statVal, { color: '#2563EB', fontSize: 13 }]}>{fmt(escrowRevenue)}</Text>
                        <Text style={[s.statLbl, { color: '#1D4ED8' }]}>Escrow \ud83d\udd12</Text>
                    </View>
                    {podPending > 0 && (
                        <View style={[s.statCard, { backgroundColor: '#DCFCE7' }]}>
                            <Text style={[s.statVal, { color: '#16A34A' }]}>{podPending}</Text>
                            <Text style={[s.statLbl, { color: '#166534' }]}>POD \ud83d\udcb5</Text>
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* ── Search Bar ────────────────────────────────────── */}
            <View style={s.searchWrap}>
                <View style={s.searchBox}>
                    <Ionicons name="search" size={16} color="#94A3B8" />
                    <TextInput
                        placeholder="Search orders, customers, tracking..."
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

            {/* ── Filter Tabs ───────────────────────────────────── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
                {FILTER_TABS.map((f) => {
                    const isActive = orderFilter === f;
                    const count = cnt[f] || 0;
                    const cfg = STATUS_CFG[f.toLowerCase()];
                    return (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setOrderFilter?.(f)}
                            style={[
                                s.chip,
                                isActive && s.chipActive,
                                isActive && cfg && { backgroundColor: cfg.bg, borderColor: cfg.border },
                            ]}
                        >
                            <Text style={[s.chipText, isActive && s.chipTextActive, isActive && cfg && { color: cfg.color }]}>
                                {f}
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

            {/* ── Orders List ───────────────────────────────────── */}
            <FlatList
                data={filteredOrders}
                keyExtractor={(item, i) => `${item.id}-${i}`}
                contentContainerStyle={s.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing?.(true); fetchDashboardData?.(); }}
                        colors={[NAVY]}
                        tintColor={NAVY}
                    />
                }
                renderItem={({ item }) => {
                    const sk = (item.status || 'pending').toLowerCase().replace(/ /g, '_');
                    const cfg = STATUS_CFG[sk] || STATUS_CFG.pending;
                    const isUpdating = updatingId === item.id;
                    const isPOD = item.isPOD || item.paymentMethod === 'pod';
                    const isInstall = item.isInstallment;
                    const byAbumafhal = item.deliveredByAbumafhal || !!item.driverId;

                    return (
                        <TouchableOpacity onPress={() => openDetail(item)} activeOpacity={0.9} style={s.card}>

                            {/* Card Header */}
                            <View style={s.cardTop}>
                                <View style={s.iconBox}>
                                    <Ionicons name="receipt-outline" size={18} color={NAVY} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
                                        <Text style={s.orderId}>#{shortId(item.id)}</Text>
                                        {isPOD && (
                                            <View style={s.podTag}>
                                                <Text style={s.podTagText}>\ud83d\udcb5 POD</Text>
                                            </View>
                                        )}
                                        {isInstall && (
                                            <View style={s.installTag}>
                                                <Text style={s.installTagText}>\ud83d\udcc5 Installment</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={s.orderDate}>{item.date}</Text>
                                </View>
                                <StatusBadge status={sk} small />
                            </View>

                            <View style={s.divider} />

                            {/* Product Row */}
                            <View style={s.productRow}>
                                <View style={s.thumbBox}>
                                    {item.image && !item.image.includes('placehold') ? (
                                        <Image source={{ uri: item.image }} style={s.thumb} resizeMode="cover" />
                                    ) : (
                                        <Ionicons name="cube-outline" size={22} color="#CBD5E1" />
                                    )}
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={s.productName} numberOfLines={2}>{item.item}</Text>
                                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' }}>
                                        <View style={s.qtyBadge}><Text style={s.qtyText}>\u00d7{item.quantity}</Text></View>
                                        {item.variant ? <View style={s.varTag}><Text style={s.varText}>{item.variant}</Text></View> : null}
                                        <Text style={s.unitPrice}>{fmt(item.price)}</Text>
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={s.earningsLabel}>Earnings</Text>
                                    <Text style={s.earningsVal}>{fmt(item.amount)}</Text>
                                </View>
                            </View>

                            {/* Customer + Delivery Tag */}
                            <View style={s.customerBar}>
                                <Ionicons name="person-circle-outline" size={14} color="#94A3B8" />
                                <Text style={s.customerName} numberOfLines={1}>{item.customerName}</Text>
                                <View style={[s.deliveryTag, byAbumafhal ? { backgroundColor: '#EFF6FF' } : { backgroundColor: '#FFF7ED' }]}>
                                    <Ionicons name={byAbumafhal ? 'bicycle' : 'storefront-outline'} size={10} color={byAbumafhal ? '#2563EB' : '#EA580C'} />
                                    <Text style={[s.deliveryTagText, { color: byAbumafhal ? '#2563EB' : '#EA580C' }]}>
                                        {byAbumafhal ? 'Abu Mafhal' : 'By Vendor'}
                                    </Text>
                                </View>
                            </View>

                            {/* Quick Action Buttons */}
                            {sk === 'pending' && (
                                <View style={s.quickRow}>
                                    <TouchableOpacity
                                        onPress={() => Alert.alert('Accept Order?', `Accept order #${shortId(item.id)}?`, [
                                            { text: 'No', style: 'cancel' },
                                            { text: 'Accept \u2714', onPress: () => executeUpdate(item.id, 'Processing') },
                                        ])}
                                        disabled={isUpdating}
                                        style={[s.quickBtn, { backgroundColor: '#2563EB', flex: 1 }]}
                                    >
                                        <Ionicons name="checkmark-done" size={13} color="#FFF" />
                                        <Text style={s.quickBtnText}>Accept Order</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => openDetail(item)} style={[s.quickBtn, { backgroundColor: '#F1F5F9' }]}>
                                        <Ionicons name="eye-outline" size={13} color="#334155" />
                                        <Text style={[s.quickBtnText, { color: '#334155' }]}>View</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {sk === 'processing' && (
                                <View style={s.quickRow}>
                                    <TouchableOpacity onPress={() => openDetail(item)} style={[s.quickBtn, { backgroundColor: '#7C3AED', flex: 1 }]}>
                                        <Ionicons name="car" size={13} color="#FFF" />
                                        <Text style={s.quickBtnText}>Ship Order \ud83d\ude9a</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => openDetail(item)} style={[s.quickBtn, { backgroundColor: '#F1F5F9' }]}>
                                        <Ionicons name="eye-outline" size={13} color="#334155" />
                                        <Text style={[s.quickBtnText, { color: '#334155' }]}>View</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {sk === 'shipped' && (
                                <View style={s.quickRow}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            const msg = isPOD
                                                ? `\u26a0\ufe0f PAY ON DELIVERY! Collect ${fmt(item.amount)} CASH first!\n\nConfirm delivery of #${shortId(item.id)}?`
                                                : `Confirm delivery of order #${shortId(item.id)}?`;
                                            Alert.alert('Confirm Delivered?', msg, [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: 'Delivered \u2705', onPress: () => executeUpdate(item.id, 'Delivered') },
                                            ]);
                                        }}
                                        disabled={isUpdating}
                                        style={[s.quickBtn, { backgroundColor: '#059669', flex: 1 }]}
                                    >
                                        <Ionicons name="checkmark-circle" size={13} color="#FFF" />
                                        <Text style={s.quickBtnText}>{isPOD ? '\ud83d\udcb5 Collect & Deliver' : 'Mark Delivered \u2705'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => openDetail(item)} style={[s.quickBtn, { backgroundColor: '#F1F5F9' }]}>
                                        <Ionicons name="eye-outline" size={13} color="#334155" />
                                        <Text style={[s.quickBtnText, { color: '#334155' }]}>View</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {sk === 'delivered' && (
                                <View style={s.deliveredStrip}>
                                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                                    <Text style={s.deliveredStripText}>
                                        {isPOD ? '\ud83d\udcb5 Cash Collected & Delivered' : 'Delivered \u2022 Earnings Credited'}
                                    </Text>
                                </View>
                            )}

                            {sk === 'cancelled' && (
                                <View style={[s.deliveredStrip, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                                    <Ionicons name="close-circle" size={14} color="#DC2626" />
                                    <Text style={[s.deliveredStripText, { color: '#DC2626' }]}>Order Cancelled</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View style={s.emptyWrap}>
                        <View style={s.emptyIcon}>
                            <Ionicons name="bag-handle-outline" size={48} color="#CBD5E1" />
                        </View>
                        <Text style={s.emptyTitle}>
                            {search ? `No results for "${search}"` : 'No orders yet'}
                        </Text>
                        <Text style={s.emptyDesc}>
                            {search
                                ? 'Try a different search term.'
                                : 'When customers buy from your store, orders will appear here.'}
                        </Text>
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}>
                                <Text style={s.clearBtnText}>Clear Search</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
            />

            {/* ── Order Detail Modal ────────────────────────────── */}
            <OrderDetailModal
                item={selectedOrder}
                visible={modalVisible}
                onClose={closeDetail}
                onUpdateStatus={executeUpdate}
                updatingId={updatingId}
                vendor={vendor}
            />
        </View>
    );
};

// ─── Main Styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container:        { flex: 1, backgroundColor: '#F8FAFC' },
    statsBar:         { backgroundColor: '#FFFFFF', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' },
    statCard:         { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, minWidth: 85, alignItems: 'center' },
    statVal:          { fontSize: 16, fontWeight: '900', textAlign: 'center' },
    statLbl:          { fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'center' },
    searchWrap:       { backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10 },
    searchBox:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
    searchInput:      { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#0F172A', height: '100%' },
    filterScroll:     { paddingHorizontal: 14, paddingBottom: 10, paddingTop: 4, gap: 8 },
    chip:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
    chipActive:       { backgroundColor: NAVY, borderColor: NAVY },
    chipText:         { fontSize: 12.5, fontWeight: '700', color: '#64748B' },
    chipTextActive:   { color: '#FFFFFF' },
    chipBadge:        { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, backgroundColor: '#E2E8F0', minWidth: 18, alignItems: 'center' },
    chipBadgeText:    { fontSize: 10.5, fontWeight: '800', color: '#475569' },
    listContent:      { padding: 14, paddingBottom: 120 },
    card:             { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E8EFFE', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    cardTop:          { flexDirection: 'row', alignItems: 'center' },
    iconBox:          { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    orderId:          { fontSize: 13.5, fontWeight: '900', color: '#0F172A' },
    orderDate:        { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
    podTag:           { backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    podTagText:       { fontSize: 10, fontWeight: '800', color: '#16A34A' },
    installTag:       { backgroundColor: '#F0FDF4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    installTagText:   { fontSize: 10, fontWeight: '800', color: '#15803D' },
    divider:          { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
    productRow:       { flexDirection: 'row', alignItems: 'center' },
    thumbBox:         { width: 60, height: 60, borderRadius: 12, backgroundColor: '#F8FAFC', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    thumb:            { width: '100%', height: '100%' },
    productName:      { fontSize: 13.5, fontWeight: '700', color: '#0F172A', lineHeight: 18 },
    qtyBadge:         { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    qtyText:          { fontSize: 11, fontWeight: '700', color: '#475569' },
    varTag:           { backgroundColor: '#F5F3FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    varText:          { fontSize: 10.5, color: '#7C3AED', fontWeight: '700' },
    unitPrice:        { fontSize: 12, color: '#64748B', fontWeight: '600' },
    earningsLabel:    { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
    earningsVal:      { fontSize: 17, fontWeight: '900', color: '#10B981', marginTop: 2 },
    customerBar:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: '#F8FAFC' },
    customerName:     { fontSize: 12, fontWeight: '700', color: '#334155', flex: 1 },
    deliveryTag:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
    deliveryTagText:  { fontSize: 10, fontWeight: '800' },
    quickRow:         { flexDirection: 'row', gap: 8, marginTop: 10 },
    quickBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10 },
    quickBtnText:     { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    deliveredStrip:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8, backgroundColor: '#ECFDF5', borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' },
    deliveredStripText:{ fontSize: 11.5, fontWeight: '800', color: '#059669' },
    emptyWrap:        { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
    emptyIcon:        { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle:       { fontSize: 17, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
    emptyDesc:        { fontSize: 12.5, color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 18, maxWidth: 280 },
    clearBtn:         { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: NAVY },
    clearBtnText:     { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
