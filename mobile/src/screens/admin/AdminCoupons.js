import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, TextInput,
    Alert, Modal, Switch, ScrollView, StyleSheet,
    ActivityIndicator, Clipboard, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtNum = (n) => n == null ? '∞' : Number(n).toLocaleString();
const usagePercent = (c) => {
    if (!c.usage_limit) return null;
    return Math.min(100, Math.round((c.usage_count / c.usage_limit) * 100));
};
const isExpired = (c) => c.expires_at && new Date(c.expires_at) < new Date();
const couponStatus = (c) => {
    if (!c.is_active) return { label: 'Inactive', color: '#94A3B8', bg: '#F1F5F9' };
    if (isExpired(c)) return { label: 'Expired', color: '#EF4444', bg: '#FEF2F2' };
    const pct = usagePercent(c);
    if (pct === 100) return { label: 'Used Up', color: '#F59E0B', bg: '#FFFBEB' };
    return { label: 'Active', color: '#10B981', bg: '#ECFDF5' };
};
const genCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ─── Mini Calendar ─────────────────────────────────────────────────────────────
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MiniCalendar = ({ value, onSelect, onClose }) => {
    const init = value ? new Date(value) : new Date();
    const [view, setView] = React.useState({ year: init.getFullYear(), month: init.getMonth() });
    const { year, month } = view;
    const selected = value ? new Date(value) : null;
    const today = new Date();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
    // pad to full rows
    while (cells.length % 7 !== 0) cells.push(null);

    const prev = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 });
    const next = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 });

    const isSelected = (d) => {
        if (!d || !selected) return false;
        return selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === d;
    };
    const isToday = (d) => {
        if (!d) return false;
        return today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    };

    const pick = (d) => {
        if (!d) return;
        const pad = n => String(n).padStart(2, '0');
        onSelect(`${year}-${pad(month + 1)}-${pad(d)}`);
    };

    return (
        <View style={CS.calWrap}>
            {/* Month nav */}
            <View style={CS.calNav}>
                <TouchableOpacity onPress={prev} style={CS.calArrow}>
                    <Ionicons name="chevron-back" size={16} color="#6366F1" />
                </TouchableOpacity>
                <Text style={CS.calMonth}>{MONTHS[month]} {year}</Text>
                <TouchableOpacity onPress={next} style={CS.calArrow}>
                    <Ionicons name="chevron-forward" size={16} color="#6366F1" />
                </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={CS.calRow}>
                {DAYS.map(d => <Text key={d} style={CS.calDayHdr}>{d}</Text>)}
            </View>

            {/* Cells */}
            {Array.from({ length: cells.length / 7 }, (_, wi) => (
                <View key={wi} style={CS.calRow}>
                    {cells.slice(wi * 7, wi * 7 + 7).map((d, ci) => (
                        <TouchableOpacity
                            key={ci}
                            onPress={() => pick(d)}
                            disabled={!d}
                            style={[CS.calCell, isSelected(d) && CS.calCellSel, isToday(d) && !isSelected(d) && CS.calCellToday]}
                        >
                            <Text style={[CS.calCellTxt, isSelected(d) && { color: 'white', fontWeight: '800' }, isToday(d) && !isSelected(d) && { color: '#6366F1', fontWeight: '800' }]}>
                                {d || ''}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ))}

            {/* Actions */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <TouchableOpacity onPress={() => onSelect(null)} style={CS.calClearBtn}>
                    <Text style={CS.calClearTxt}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={CS.calDoneBtn}>
                    <Text style={CS.calDoneTxt}>Done</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ─── Date Picker Button ────────────────────────────────────────────────────────
const DatePickerBtn = ({ label, value, active, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[CS.dateBtn, active && { borderColor: '#6366F1', backgroundColor: '#EEF2FF' }]}>
        <Ionicons name="calendar" size={16} color={active ? '#6366F1' : value ? '#6366F1' : '#CBD5E1'} />
        <View style={{ flex: 1 }}>
            <Text style={[CS.dateBtnLbl, active && { color: '#6366F1' }]}>{label}</Text>
            <Text style={[CS.dateBtnVal, !value && { color: '#CBD5E1' }]}>{value ? fmtDate(value) : 'Tap to set'}</Text>
        </View>
        <Ionicons name={active ? 'chevron-up' : 'chevron-down'} size={13} color={active ? '#6366F1' : '#CBD5E1'} />
    </TouchableOpacity>
);

// ─── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color, sub }) => (
    <View style={[S.statCard, { borderColor: `${color}30`, backgroundColor: `${color}10` }]}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={[S.statVal, { color }]}>{value}</Text>
        <Text style={S.statLbl}>{label}</Text>
        {sub ? <Text style={S.statSub}>{sub}</Text> : null}
    </View>
);

// ─── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ onAdd }) => (
    <View style={S.empty}>
        <View style={S.emptyIcon}>
            <Ionicons name="pricetag" size={40} color="#A78BFA" />
        </View>
        <Text style={S.emptyTitle}>No Coupons Yet</Text>
        <Text style={S.emptyTxt}>Create your first promo code to start offering discounts to customers.</Text>
        <TouchableOpacity onPress={onAdd} style={S.emptyBtn}>
            <Ionicons name="add" size={16} color="white" style={{ marginRight: 6 }} />
            <Text style={S.emptyBtnTxt}>Create First Coupon</Text>
        </TouchableOpacity>
    </View>
);

// ─── Coupon Form Modal ─────────────────────────────────────────────────────────
const blankForm = {
    code: '', description: '',
    discount_type: 'percentage', discount_value: '',
    min_order_amount: '', max_discount: '',
    usage_limit: '', per_user_limit: '1',
    valid_from: '', expires_at: '',
    applicable_to: 'all', is_active: true,
};

const CouponFormModal = ({ visible, editTarget, duplicateTarget, onClose, onSuccess }) => {
    const insets = useSafeAreaInsets();
    const [form, setForm] = useState(blankForm);
    const [saving, setSaving] = useState(false);
    const [calPicker, setCalPicker] = useState({ field: null, visible: false });
    const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    useEffect(() => {
        if (visible) {
            if (editTarget) {
                setForm({
                    code: editTarget.code,
                    description: editTarget.description || '',
                    discount_type: editTarget.discount_type,
                    discount_value: String(editTarget.discount_value),
                    min_order_amount: editTarget.min_order_amount ? String(editTarget.min_order_amount) : '',
                    max_discount: editTarget.max_discount ? String(editTarget.max_discount) : '',
                    usage_limit: editTarget.usage_limit ? String(editTarget.usage_limit) : '',
                    per_user_limit: editTarget.per_user_limit ? String(editTarget.per_user_limit) : '1',
                    valid_from: editTarget.valid_from ? editTarget.valid_from.slice(0, 10) : '',
                    expires_at: editTarget.expires_at ? editTarget.expires_at.slice(0, 10) : '',
                    applicable_to: editTarget.applicable_to || 'all',
                    is_active: editTarget.is_active,
                });
            } else if (duplicateTarget) {
                setForm({
                    code: genCode(),
                    description: duplicateTarget.description || '',
                    discount_type: duplicateTarget.discount_type,
                    discount_value: String(duplicateTarget.discount_value),
                    min_order_amount: duplicateTarget.min_order_amount ? String(duplicateTarget.min_order_amount) : '',
                    max_discount: duplicateTarget.max_discount ? String(duplicateTarget.max_discount) : '',
                    usage_limit: duplicateTarget.usage_limit ? String(duplicateTarget.usage_limit) : '',
                    per_user_limit: duplicateTarget.per_user_limit ? String(duplicateTarget.per_user_limit) : '1',
                    valid_from: '', expires_at: '',
                    applicable_to: duplicateTarget.applicable_to || 'all',
                    is_active: true,
                });
            } else {
                setForm(blankForm);
            }
            setCalPicker({ field: null, visible: false });
        }
    }, [visible, editTarget, duplicateTarget]);

    const handleSave = async () => {
        if (!form.code.trim()) return Alert.alert('Error', 'Code is required');
        if (!form.discount_value) return Alert.alert('Error', 'Discount value is required');
        const dVal = parseFloat(form.discount_value);
        if (isNaN(dVal) || dVal <= 0) return Alert.alert('Error', 'Valid discount value is required');
        if (form.discount_type === 'percentage' && dVal > 100)
            return Alert.alert('Error', 'Percentage cannot exceed 100%');

        setSaving(true);
        try {
            const payload = {
                code: form.code.trim().toUpperCase(),
                description: form.description.trim() || null,
                discount_type: form.discount_type,
                discount_value: dVal,
                min_order_amount: form.min_order_amount ? (parseFloat(form.min_order_amount) || 0) : 0,
                max_discount: form.max_discount ? (parseFloat(form.max_discount) || null) : null,
                usage_limit: form.usage_limit ? (parseInt(form.usage_limit) || null) : null,
                per_user_limit: form.per_user_limit ? (parseInt(form.per_user_limit) || 1) : 1,
                valid_from: form.valid_from || null,
                expires_at: form.expires_at || null,
                applicable_to: form.applicable_to,
                is_active: form.is_active,
            };

            let error;
            if (editTarget) {
                ({ error } = await supabase.from('coupons').update(payload).eq('id', editTarget.id));
            } else {
                ({ error } = await supabase.from('coupons').insert([payload]));
            }

            if (error) throw new Error(error.message);
            onSuccess(payload);
        } catch (err) {
            console.error('Save error:', err);
            Alert.alert('Error', err.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                <LinearGradient colors={['#1E1B4B', '#312E81']} style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 18 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <TouchableOpacity onPress={onClose} style={S.detailClose}>
                            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '800' }}>{editTarget ? 'Edit Coupon' : 'New Coupon'}</Text>
                        <TouchableOpacity onPress={handleSave} disabled={saving} style={[S.detailClose, { backgroundColor: '#6366F1' }]}>
                            {saving ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="checkmark" size={18} color="white" />}
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                    <View>
                        <Text style={S.fieldLabel}>Coupon Code *</Text>
                        <View style={S.codeInputRow}>
                            <TextInput
                                style={[S.input, { flex: 1, margin: 0 }]}
                                placeholder="e.g. SUMMER25"
                                value={form.code}
                                onChangeText={v => setF('code', v.toUpperCase())}
                                autoCapitalize="characters"
                            />
                            <TouchableOpacity onPress={() => setF('code', genCode())} style={S.genBtn}>
                                <Ionicons name="refresh" size={16} color="#6366F1" />
                                <Text style={S.genBtnTxt}>Auto</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View>
                        <Text style={S.fieldLabel}>Description (Optional)</Text>
                        <TextInput style={S.input} placeholder="e.g. 25% off for new users" value={form.description} onChangeText={v => setF('description', v)} />
                    </View>

                    <View>
                        <Text style={S.fieldLabel}>Discount Type</Text>
                        <View style={S.segRow}>
                            {[{ k: 'percentage', l: '% Percentage', icon: 'trending-down' }, { k: 'fixed', l: '₦ Fixed Amount', icon: 'cash' }].map(t => (
                                <TouchableOpacity key={t.k} onPress={() => setF('discount_type', t.k)} style={[S.segBtn, form.discount_type === t.k && S.segBtnOn]}>
                                    <Ionicons name={t.icon} size={14} color={form.discount_type === t.k ? '#6366F1' : '#94A3B8'} />
                                    <Text style={[S.segBtnTxt, form.discount_type === t.k && { color: '#6366F1', fontWeight: '800' }]}>{t.l}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>{form.discount_type === 'percentage' ? 'Percentage (%)' : 'Amount (₦)'} *</Text>
                            <TextInput style={S.input} placeholder={form.discount_type === 'percentage' ? '0–100' : 'e.g. 500'} value={form.discount_value} onChangeText={v => setF('discount_value', v)} keyboardType="decimal-pad" />
                        </View>
                        {form.discount_type === 'percentage' && (
                            <View style={{ flex: 1 }}>
                                <Text style={S.fieldLabel}>Max Discount (₦)</Text>
                                <TextInput style={S.input} placeholder="Optional cap" value={form.max_discount} onChangeText={v => setF('max_discount', v)} keyboardType="decimal-pad" />
                            </View>
                        )}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>Min Order (₦)</Text>
                            <TextInput style={S.input} placeholder="Optional" value={form.min_order_amount} onChangeText={v => setF('min_order_amount', v)} keyboardType="decimal-pad" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>Usage Limit</Text>
                            <TextInput style={S.input} placeholder="∞ Unlimited" value={form.usage_limit} onChangeText={v => setF('usage_limit', v)} keyboardType="number-pad" />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>Per User Limit</Text>
                            <TextInput style={S.input} placeholder="1" value={form.per_user_limit} onChangeText={v => setF('per_user_limit', v)} keyboardType="number-pad" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>Applies To</Text>
                            <View style={S.pickerWrap}>
                                {['all', 'first_order'].map(opt => (
                                    <TouchableOpacity key={opt} onPress={() => setF('applicable_to', opt)} style={[S.pickerBtn, form.applicable_to === opt && { backgroundColor: '#EEF2FF', borderColor: '#6366F1' }]}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: form.applicable_to === opt ? '#6366F1' : '#64748B', textTransform: 'capitalize' }}>{opt.replace('_', ' ')}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <DatePickerBtn
                            label="Valid From"
                            value={form.valid_from}
                            active={calPicker.field === 'valid_from' && calPicker.visible}
                            onPress={() => setCalPicker({ field: 'valid_from', visible: true })}
                        />
                        <DatePickerBtn
                            label="Expires"
                            value={form.expires_at}
                            active={calPicker.field === 'expires_at' && calPicker.visible}
                            onPress={() => setCalPicker({ field: 'expires_at', visible: true })}
                        />
                    </View>

                    <View style={S.toggleRow}>
                        <View>
                            <Text style={S.fieldLabel}>Active</Text>
                            <Text style={{ fontSize: 11, color: '#94A3B8' }}>Make coupon available to customers</Text>
                        </View>
                        <Switch value={form.is_active} onValueChange={v => setF('is_active', v)} trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }} thumbColor={form.is_active ? '#10B981' : '#CBD5E1'} />
                    </View>

                    <TouchableOpacity onPress={handleSave} disabled={saving} style={S.submitBtn}>
                        {saving ? <ActivityIndicator color="white" /> : (
                            <>
                                <Ionicons name={editTarget ? 'checkmark-circle' : 'add-circle'} size={18} color="white" />
                                <Text style={S.submitBtnTxt}>{editTarget ? 'Save Changes' : 'Create Coupon'}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>

                {calPicker.visible && calPicker.field && (
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}
                        activeOpacity={1}
                        onPress={() => setCalPicker({ field: null, visible: false })}
                    >
                        <TouchableOpacity activeOpacity={1} onPress={() => { }}>
                            <MiniCalendar
                                value={form[calPicker.field]}
                                onSelect={(dateStr) => {
                                    setF(calPicker.field, dateStr || '');
                                    setCalPicker({ field: null, visible: false });
                                }}
                                onClose={() => setCalPicker({ field: null, visible: false })}
                            />
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}
            </View>
        </Modal>
    );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export const AdminCoupons = () => {
    const insets = useSafeAreaInsets();

    // Data
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    // UI
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [duplicateTarget, setDuplicateTarget] = useState(null);
    const [detailCoupon, setDetailCoupon] = useState(null);

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchCoupons = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setCoupons(data);
        if (error) console.error(error);
        setLoading(false);
    }, []);

    useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

    // ── Stats ──────────────────────────────────────────────────────────────────
    const stats = useMemo(() => ({
        total: coupons.length,
        active: coupons.filter(c => c.is_active && !isExpired(c)).length,
        expired: coupons.filter(c => isExpired(c)).length,
        uses: coupons.reduce((s, c) => s + (c.usage_count || 0), 0),
    }), [coupons]);

    // ── Filter + Search ────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = coupons;
        if (filter === 'active') list = list.filter(c => c.is_active && !isExpired(c));
        if (filter === 'inactive') list = list.filter(c => !c.is_active);
        if (filter === 'expired') list = list.filter(c => isExpired(c));
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(c =>
                c.code.toLowerCase().includes(q) ||
                (c.description || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [coupons, filter, search]);

    // ── Toggle Active ──────────────────────────────────────────────────────────
    const toggleActive = async (c) => {
        await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id);
        setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
    };

    // ── Duplicate ──────────────────────────────────────────────────────────────
    const duplicateCoupon = (c) => {
        setEditTarget(null);
        setDuplicateTarget(c);
        setShowForm(true);
    };

    // ── Edit ───────────────────────────────────────────────────────────────────
    const openEdit = (c) => {
        setEditTarget(c);
        setDuplicateTarget(null);
        setShowForm(true);
    };

    // ── Delete ──────────────────────────────────────────────────────────────────
    const deleteCoupon = (c) => {
        Alert.alert('Delete Coupon', `Delete "${c.code}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    await supabase.from('coupons').delete().eq('id', c.id);
                    setCoupons(prev => prev.filter(x => x.id !== c.id));
                    if (detailCoupon?.id === c.id) setDetailCoupon(null);
                },
            },
        ]);
    };

    // ── Copy code ──────────────────────────────────────────────────────────────
    const copyCode = (code) => {
        Clipboard.setString(code);
        Alert.alert('Copied!', `"${code}" copied to clipboard`);
    };

    // ── Render Coupon Card ─────────────────────────────────────────────────────
    const renderItem = ({ item: c }) => {
        const st = couponStatus(c);
        const pct = usagePercent(c);
        const expired = isExpired(c);
        return (
            <TouchableOpacity
                onPress={() => setDetailCoupon(c)}
                style={[S.card, expired && { opacity: 0.65 }]}
                activeOpacity={0.82}
            >
                {/* Left accent */}
                <View style={[S.cardAccent, { backgroundColor: st.color }]} />

                <View style={{ flex: 1, paddingLeft: 12, paddingRight: 8 }}>
                    {/* Top row */}
                    <View style={S.cardTop}>
                        <TouchableOpacity onPress={() => copyCode(c.code)} style={S.codeWrap}>
                            <Text style={S.codeText}>{c.code}</Text>
                            <Ionicons name="copy-outline" size={12} color="#A78BFA" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                        <View style={[S.statusBadge, { backgroundColor: st.bg }]}>
                            <Text style={[S.statusTxt, { color: st.color }]}>{st.label}</Text>
                        </View>
                    </View>

                    {/* Discount */}
                    <Text style={S.discountTxt}>
                        {c.discount_type === 'percentage'
                            ? `${c.discount_value}% OFF`
                            : `₦${Number(c.discount_value).toLocaleString()} OFF`}
                        {c.max_discount ? <Text style={S.maxTxt}> (max ₦{Number(c.max_discount).toLocaleString()})</Text> : null}
                    </Text>

                    {/* Description */}
                    {c.description ? <Text style={S.descTxt} numberOfLines={1}>{c.description}</Text> : null}

                    {/* Meta row */}
                    <View style={S.metaRow}>
                        <View style={S.metaItem}>
                            <Ionicons name="repeat" size={10} color="#94A3B8" />
                            <Text style={S.metaTxt}>{fmtNum(c.usage_count)}/{fmtNum(c.usage_limit)}</Text>
                        </View>
                        {c.min_order_amount > 0 && (
                            <View style={S.metaItem}>
                                <Ionicons name="cart-outline" size={10} color="#94A3B8" />
                                <Text style={S.metaTxt}>Min ₦{Number(c.min_order_amount).toLocaleString()}</Text>
                            </View>
                        )}
                        {c.expires_at && (
                            <View style={S.metaItem}>
                                <Ionicons name="time-outline" size={10} color={expired ? '#EF4444' : '#94A3B8'} />
                                <Text style={[S.metaTxt, expired && { color: '#EF4444' }]}>{fmtDate(c.expires_at)}</Text>
                            </View>
                        )}
                    </View>

                    {/* Usage progress bar */}
                    {pct !== null && (
                        <View style={S.progBar}>
                            <View style={[S.progFill, { width: `${pct}%`, backgroundColor: pct === 100 ? '#F59E0B' : '#6366F1' }]} />
                        </View>
                    )}
                </View>

                {/* Actions */}
                <View style={S.cardActions}>
                    <Switch
                        value={c.is_active}
                        onValueChange={() => toggleActive(c)}
                        trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
                        thumbColor={c.is_active ? '#10B981' : '#CBD5E1'}
                        style={{ transform: [{ scale: 0.75 }] }}
                    />
                    <TouchableOpacity onPress={() => openEdit(c)} style={S.iconBtn}>
                        <Ionicons name="create-outline" size={16} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteCoupon(c)} style={S.iconBtn}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    // ── Detail Modal JSX ────────────────────────────────────────────────────────
    let detailModalJSX = null;
    if (detailCoupon) {
        const c = detailCoupon;
        const st = couponStatus(c);
        const pct = usagePercent(c);
        detailModalJSX = (
            <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailCoupon(null)}>
                <LinearGradient colors={['#060612', '#1E1B4B']} style={{ flex: 0 }}>
                    <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => setDetailCoupon(null)} style={S.detailClose}>
                                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                            <View style={{ flex: 1, alignItems: 'center' }}>
                                <TouchableOpacity onPress={() => copyCode(c.code)} style={S.detailCode}>
                                    <Text style={S.detailCodeTxt}>{c.code}</Text>
                                    <Ionicons name="copy-outline" size={14} color="#A78BFA" style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                                <Text style={S.detailDiscount}>
                                    {c.discount_type === 'percentage'
                                        ? `${c.discount_value}% DISCOUNT`
                                        : `₦${Number(c.discount_value).toLocaleString()} OFF`}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => { setDetailCoupon(null); openEdit(c); }} style={S.detailClose}>
                                <Ionicons name="create-outline" size={18} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </View>
                        <View style={[S.statusBadge, { backgroundColor: `${st.color}25`, alignSelf: 'center', marginTop: 10 }]}>
                            <Text style={[S.statusTxt, { color: st.color }]}>{st.label}</Text>
                        </View>
                    </View>
                </LinearGradient>

                <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20, gap: 14 }}>
                    {c.description && <View style={S.detailCard}><Text style={S.detailLabel}>Description</Text><Text style={S.detailValue}>{c.description}</Text></View>}

                    <View style={S.detailGrid}>
                        {[
                            { label: 'Type', value: c.discount_type === 'percentage' ? `${c.discount_value}%` : `₦${c.discount_value}`, icon: 'pricetag' },
                            { label: 'Max Discount', value: c.max_discount ? `₦${Number(c.max_discount).toLocaleString()}` : '—', icon: 'trending-down' },
                            { label: 'Min Order', value: c.min_order_amount > 0 ? `₦${Number(c.min_order_amount).toLocaleString()}` : '—', icon: 'cart' },
                            { label: 'Per User Limit', value: fmtNum(c.per_user_limit), icon: 'person' },
                        ].map(r => (
                            <View key={r.label} style={S.detailGridCell}>
                                <Ionicons name={r.icon} size={14} color="#6366F1" />
                                <Text style={S.detailLabel}>{r.label}</Text>
                                <Text style={S.detailGridVal}>{r.value}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Usage */}
                    <View style={S.detailCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={S.detailLabel}>Usage</Text>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#6366F1' }}>
                                {fmtNum(c.usage_count)} / {fmtNum(c.usage_limit)}
                            </Text>
                        </View>
                        {pct !== null && (
                            <View style={[S.progBar, { height: 8 }]}>
                                <View style={[S.progFill, { width: `${pct}%`, backgroundColor: pct === 100 ? '#F59E0B' : '#6366F1' }]} />
                            </View>
                        )}
                    </View>

                    {/* Dates */}
                    <View style={S.detailCard}>
                        {[
                            { label: 'Valid From', value: fmtDate(c.valid_from) },
                            { label: 'Expires', value: fmtDate(c.expires_at) },
                            { label: 'Created', value: fmtDate(c.created_at) },
                            { label: 'Applies To', value: c.applicable_to || 'all' },
                        ].map(r => (
                            <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={S.detailLabel}>{r.label}</Text>
                                <Text style={S.detailValue}>{r.value}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                        <TouchableOpacity onPress={() => duplicateCoupon(c)} style={[S.actionBtn, { backgroundColor: '#EEF2FF', flex: 1 }]}>
                            <Ionicons name="copy" size={15} color="#6366F1" />
                            <Text style={[S.actionBtnTxt, { color: '#6366F1' }]}>Duplicate</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setDetailCoupon(null); deleteCoupon(c); }} style={[S.actionBtn, { backgroundColor: '#FEF2F2', flex: 1 }]}>
                            <Ionicons name="trash" size={15} color="#EF4444" />
                            <Text style={[S.actionBtnTxt, { color: '#EF4444' }]}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Modal>
        );
    }



    // ── MAIN RENDER ────────────────────────────────────────────────────────────
    return (
        <View style={S.root}>
            <StatusBar barStyle="light-content" />

            {/* HERO HEADER */}
            <LinearGradient
                colors={['#060612', '#0F0E2E', '#2D2A6E']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[S.hdr, { paddingTop: insets.top + 10 }]}
            >
                <View style={S.hdrRow}>
                    <View style={S.hdrTitleWrap}>
                        <Text style={S.hdrTitle}>Promo Codes</Text>
                        <Text style={S.hdrSub}>{stats.total} coupons · {stats.active} active</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => { setEditTarget(null); setForm(blankForm); setShowForm(true); }}
                        style={S.addBtn}
                    >
                        <Ionicons name="add" size={18} color="white" />
                        <Text style={S.addBtnTxt}>New</Text>
                    </TouchableOpacity>
                </View>

                {/* Stat row */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
                    <StatCard icon="pricetag" label="Total" value={stats.total} color="#A78BFA" />
                    <StatCard icon="checkmark-circle" label="Active" value={stats.active} color="#34D399" />
                    <StatCard icon="time-outline" label="Expired" value={stats.expired} color="#F87171" />
                    <StatCard icon="repeat" label="Uses" value={stats.uses} color="#38BDF8" />
                </ScrollView>
            </LinearGradient>

            {/* SEARCH */}
            <View style={S.searchWrap}>
                <View style={S.searchIconWrap}>
                    <Ionicons name="search" size={14} color="#6366F1" />
                </View>
                <TextInput
                    style={S.searchIn}
                    placeholder="Search code or description…"
                    placeholderTextColor="#CBD5E1"
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={17} color="#CBD5E1" />
                    </TouchableOpacity>
                )}
            </View>

            {/* FILTER PILLS */}
            <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={{ backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9' }}
                contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}
            >
                {[
                    { id: 'all', label: 'All', count: stats.total },
                    { id: 'active', label: '✅ Active', count: stats.active },
                    { id: 'inactive', label: '⏸ Inactive' },
                    { id: 'expired', label: '🔴 Expired', count: stats.expired },
                ].map(f => (
                    <TouchableOpacity key={f.id} onPress={() => setFilter(f.id)} style={[S.pill, filter === f.id && S.pillOn]}>
                        <Text style={[S.pillTxt, filter === f.id && { color: 'white' }]}>{f.label}</Text>
                        {f.count != null && (
                            <View style={[S.pillBadge, filter === f.id && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                                <Text style={[S.pillBadgeTxt, filter === f.id && { color: 'white' }]}>{f.count}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* LIST */}
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={{ color: '#94A3B8', marginTop: 10, fontWeight: '600' }}>Loading coupons…</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={i => i.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: insets.bottom + 80 }}
                    ListEmptyComponent={<EmptyState onAdd={() => { setEditTarget(null); setDuplicateTarget(null); setShowForm(true); }} />}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* FAB */}
            {!loading && filtered.length > 0 && (
                <TouchableOpacity
                    onPress={() => { setEditTarget(null); setDuplicateTarget(null); setShowForm(true); }}
                    style={[S.fab, { bottom: insets.bottom + 24 }]}
                >
                    <LinearGradient colors={['#6366F1', '#818CF8']} style={S.fabGrad}>
                        <Ionicons name="add" size={24} color="white" />
                    </LinearGradient>
                </TouchableOpacity>
            )}

            {detailModalJSX}
            <CouponFormModal
                visible={showForm}
                editTarget={editTarget}
                duplicateTarget={duplicateTarget}
                onClose={() => { setShowForm(false); setEditTarget(null); setDuplicateTarget(null); }}
                onSuccess={() => { setShowForm(false); setEditTarget(null); setDuplicateTarget(null); fetchCoupons(); }}
            />
        </View>
    );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F1F5F9' },
    hdr: { paddingHorizontal: 18, paddingBottom: 16 },
    hdrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    hdrTitleWrap: { flex: 1 },
    hdrTitle: { color: 'white', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    hdrSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2, fontWeight: '500' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#6366F1', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
    addBtnTxt: { color: 'white', fontWeight: '800', fontSize: 13 },

    // Stat card (inside header)
    statCard: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, gap: 2 },
    statVal: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
    statLbl: { fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase' },
    statSub: { fontSize: 9, color: 'rgba(255,255,255,0.3)' },

    // Search
    searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', marginHorizontal: 14, marginTop: 12, marginBottom: 4, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1.5, borderColor: '#EEF2FF' },
    searchIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    searchIn: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A' },

    // Filter pills
    pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', gap: 5 },
    pillOn: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    pillTxt: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    pillBadge: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
    pillBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#64748B' },

    // Cards
    card: { backgroundColor: 'white', borderRadius: 18, flexDirection: 'row', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#1E1B4B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
    cardAccent: { width: 4 },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, marginTop: 10 },
    codeWrap: { flexDirection: 'row', alignItems: 'center' },
    codeText: { fontSize: 14, fontWeight: '900', color: '#1E1B4B', letterSpacing: 1, fontFamily: 'monospace' },
    discountTxt: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 2 },
    maxTxt: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
    descTxt: { fontSize: 11, color: '#94A3B8', marginBottom: 6 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaTxt: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    statusTxt: { fontSize: 9, fontWeight: '800' },
    progBar: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
    progFill: { height: '100%', borderRadius: 4 },
    cardActions: { paddingVertical: 10, paddingRight: 10, alignItems: 'center', gap: 6 },
    iconBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },

    // FAB
    fab: { position: 'absolute', right: 20 },
    fabGrad: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },

    // Empty
    empty: { alignItems: 'center', padding: 40, gap: 12 },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    emptyTxt: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366F1', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
    emptyBtnTxt: { color: 'white', fontWeight: '800', fontSize: 14 },

    // Detail modal
    detailClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    detailCode: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
    detailCodeTxt: { color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: 2, fontFamily: 'monospace' },
    detailDiscount: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'center' },
    detailCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    detailGridCell: { flex: 1, minWidth: '45%', backgroundColor: 'white', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 4 },
    detailGridVal: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    detailLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
    detailValue: { fontSize: 13, fontWeight: '600', color: '#0F172A' },

    // Form
    fieldLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    input: { backgroundColor: 'white', padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', fontSize: 15, color: '#0F172A', fontWeight: '600' },
    codeInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    genBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#C7D2FE' },
    genBtnTxt: { color: '#6366F1', fontWeight: '800', fontSize: 13 },
    segRow: { flexDirection: 'row', gap: 8 },
    segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E2E8F0' },
    segBtnOn: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
    segBtnTxt: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
    pickerWrap: { flexDirection: 'row', gap: 6 },
    pickerBtn: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E2E8F0' },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366F1', padding: 16, borderRadius: 18 },
    submitBtnTxt: { color: 'white', fontWeight: '800', fontSize: 16 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 14 },
    actionBtnTxt: { fontWeight: '700', fontSize: 14 },
});

// ─── Calendar Styles ───────────────────────────────────────────────────────────
const CS = StyleSheet.create({
    // Date picker trigger button
    dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'white', padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0' },
    dateBtnLbl: { fontSize: 9, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
    dateBtnVal: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 2 },

    // Calendar overlay + wrapper
    calOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    calWrap: { backgroundColor: 'white', borderRadius: 20, padding: 18, width: Math.min(width - 40, 340), shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },

    // Navigation row
    calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    calArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    calMonth: { fontSize: 15, fontWeight: '800', color: '#1E1B4B' },

    // Day header row
    calRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    calDayHdr: { width: 36, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#94A3B8' },

    // Day cells
    calCell: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    calCellSel: { backgroundColor: '#6366F1' },
    calCellToday: { backgroundColor: '#EEF2FF' },
    calCellTxt: { fontSize: 13, fontWeight: '500', color: '#0F172A' },

    // Footer buttons
    calClearBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F1F5F9' },
    calClearTxt: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
    calDoneBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: '#6366F1' },
    calDoneTxt: { fontSize: 13, fontWeight: '800', color: 'white' },
});

