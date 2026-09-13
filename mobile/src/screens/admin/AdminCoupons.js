import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, TextInput,
    Alert, Modal, Switch, ScrollView, StyleSheet,
    ActivityIndicator, Clipboard, Dimensions, StatusBar, RefreshControl, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const NAVY = '#0E1A2E';
const DEEP_NAVY = '#1E293B';
const GOLD = '#D9A73A';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtNum = (n) => n == null ? '∞' : Number(n).toLocaleString();
const usagePercent = (c) => {
    if (!c.usage_limit) return null;
    return Math.min(100, Math.round(((c.usage_count || 0) / c.usage_limit) * 100));
};
const isExpired = (c) => c.expires_at && new Date(c.expires_at) < new Date();
const couponStatus = (c) => {
    if (!c.is_active) return { label: 'A Boye', color: '#64748B', bg: '#F1F5F9' };
    if (isExpired(c)) return { label: 'Ya Kare', color: '#EF4444', bg: '#FEF2F2' };
    const pct = usagePercent(c);
    if (pct === 100) return { label: 'An Gama', color: '#F59E0B', bg: '#FFFBEB' };
    return { label: 'A Kasuwa', color: '#059669', bg: '#ECFDF5' };
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
                    <Ionicons name="chevron-back" size={16} color={NAVY} />
                </TouchableOpacity>
                <Text style={CS.calMonth}>{MONTHS[month]} {year}</Text>
                <TouchableOpacity onPress={next} style={CS.calArrow}>
                    <Ionicons name="chevron-forward" size={16} color={NAVY} />
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
                            <Text style={[CS.calCellTxt, isSelected(d) && { color: NAVY, fontWeight: '800' }, isToday(d) && !isSelected(d) && { color: GOLD, fontWeight: '800' }]}>
                                {d || ''}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ))}

            {/* Actions */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                <TouchableOpacity onPress={() => onSelect(null)} style={CS.calClearBtn}>
                    <Text style={CS.calClearTxt}>Goge (Clear)</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={CS.calDoneBtn}>
                    <Text style={CS.calDoneTxt}>Kammala (Done)</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ─── Date Picker Button ────────────────────────────────────────────────────────
const DatePickerBtn = ({ label, value, active, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[CS.dateBtn, active && { borderColor: GOLD, backgroundColor: '#FFFBEB' }]}>
        <Ionicons name="calendar" size={16} color={active ? GOLD : value ? NAVY : '#CBD5E1'} />
        <View style={{ flex: 1 }}>
            <Text style={[CS.dateBtnLbl, active && { color: NAVY }]}>{label}</Text>
            <Text style={[CS.dateBtnVal, !value && { color: '#94A3B8' }]}>{value ? fmtDate(value) : 'Zaɓi Rana'}</Text>
        </View>
        <Ionicons name={active ? 'chevron-up' : 'chevron-down'} size={13} color={active ? GOLD : '#CBD5E1'} />
    </TouchableOpacity>
);

// ─── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color, bg }) => (
    <View style={[S.statCard, { borderColor: '#E2E8F0', backgroundColor: bg || '#FFFFFF' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={icon} size={15} color={color} />
            <Text style={S.statLbl}>{label}</Text>
        </View>
        <Text style={[S.statVal, { color }]}>{value}</Text>
    </View>
);

// ─── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ onAdd }) => (
    <View style={S.empty}>
        <View style={S.emptyIcon}>
            <Ionicons name="pricetag" size={40} color={GOLD} />
        </View>
        <Text style={S.emptyTitle}>Babu Wata Lambar Rangwame</Text>
        <Text style={S.emptyTxt}>Ƙirƙiri sabon promo code don bawa abokan ciniki rangwame na musamman a kasuwa.</Text>
        <TouchableOpacity onPress={onAdd} style={S.emptyBtn}>
            <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={S.emptyBtnTxt}>Ƙirƙiri Coupon Yanzu</Text>
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
        if (!form.code.trim()) return Alert.alert('Kuskure', 'Lambar coupon (Code) wajibi ne');
        if (!form.discount_value) return Alert.alert('Kuskure', 'Adadin rangwame wajibi ne');
        const dVal = parseFloat(form.discount_value);
        if (isNaN(dVal) || dVal <= 0) return Alert.alert('Kuskure', 'Sanya adadin rangwame mai inganci');
        if (form.discount_type === 'percentage' && dVal > 100)
            return Alert.alert('Kuskure', 'Kashi cikin dari ba zai wuce 100% ba');

        setSaving(true);
        try {
            const payload = {
                code: form.code.trim().toUpperCase(),
                description: form.description.trim() || null,
                discount_type: form.discount_type,
                discount_value: dVal,
                min_order_amount: form.min_order_amount ? (parseFloat(form.min_order_amount) || 0) : 0,
                max_discount: form.max_discount ? (parseFloat(form.max_discount) || null) : null,
                usage_limit: form.usage_limit ? (parseInt(form.usage_limit, 10) || null) : null,
                per_user_limit: form.per_user_limit ? (parseInt(form.per_user_limit, 10) || 1) : 1,
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
            console.error('Save coupon error:', err);
            Alert.alert('Kuskure', err.message || 'An samu matsala wajen adana coupon.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={S.modalOverlay}>
                <View style={[S.modalCard, { paddingBottom: insets.bottom + 20 }]}>
                    <View style={S.modalHeader}>
                        <View>
                            <Text style={S.modalTitle}>{editTarget ? 'Gyara Coupon' : 'Sabuwar Lambar Rangwame'}</Text>
                            <Text style={S.modalSub}>Sanya bayanan rangwame da dokokin amfani</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={S.closeModalBtn}>
                            <Ionicons name="close" size={20} color={NAVY} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
                        <View>
                            <Text style={S.fieldLabel}>Lambar Rangwame (Promo Code) *</Text>
                            <View style={S.codeInputRow}>
                                <TextInput
                                    style={[S.input, { flex: 1 }]}
                                    placeholder="Misali: SALLAH50"
                                    placeholderTextColor="#94A3B8"
                                    value={form.code}
                                    onChangeText={v => setF('code', v.toUpperCase())}
                                    autoCapitalize="characters"
                                />
                                <TouchableOpacity onPress={() => setF('code', genCode())} style={S.genBtn} activeOpacity={0.8}>
                                    <Ionicons name="refresh" size={16} color={NAVY} />
                                    <Text style={S.genBtnTxt}>Auto</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View>
                            <Text style={S.fieldLabel}>Bayanin Coupon (Na Zabi)</Text>
                            <TextInput 
                                style={S.input} 
                                placeholder="Misali: Rangwamen 20% ga sabbin masu sayayya" 
                                placeholderTextColor="#94A3B8"
                                value={form.description} 
                                onChangeText={v => setF('description', v)} 
                            />
                        </View>

                        <View>
                            <Text style={S.fieldLabel}>Nau'in Rangwame (Discount Type)</Text>
                            <View style={S.segRow}>
                                {[
                                    { k: 'percentage', l: '% Kaso (Percentage)', icon: 'trending-down' }, 
                                    { k: 'fixed', l: '₦ Kudi Tsaye (Fixed)', icon: 'cash' }
                                ].map(t => (
                                    <TouchableOpacity 
                                        key={t.k} 
                                        onPress={() => setF('discount_type', t.k)} 
                                        style={[S.segBtn, form.discount_type === t.k && S.segBtnOn]}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name={t.icon} size={14} color={form.discount_type === t.k ? NAVY : '#94A3B8'} />
                                        <Text style={[S.segBtnTxt, form.discount_type === t.k && { color: NAVY, fontWeight: '800' }]}>{t.l}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={S.fieldLabel}>{form.discount_type === 'percentage' ? 'Kashi (%) *' : 'Adadin Kudi (₦) *'}</Text>
                                <TextInput 
                                    style={S.input} 
                                    placeholder={form.discount_type === 'percentage' ? '0–100' : 'e.g. 500'} 
                                    placeholderTextColor="#94A3B8"
                                    value={form.discount_value} 
                                    onChangeText={v => setF('discount_value', v)} 
                                    keyboardType="decimal-pad" 
                                />
                            </View>
                            {form.discount_type === 'percentage' && (
                                <View style={{ flex: 1 }}>
                                    <Text style={S.fieldLabel}>Iyakar Rangwame (₦ Max)</Text>
                                    <TextInput 
                                        style={S.input} 
                                        placeholder="Kudin da ba zai wuce ba" 
                                        placeholderTextColor="#94A3B8"
                                        value={form.max_discount} 
                                        onChangeText={v => setF('max_discount', v)} 
                                        keyboardType="decimal-pad" 
                                    />
                                </View>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={S.fieldLabel}>Karancin Saye (₦ Min Order)</Text>
                                <TextInput 
                                    style={S.input} 
                                    placeholder="Misali: 2000" 
                                    placeholderTextColor="#94A3B8"
                                    value={form.min_order_amount} 
                                    onChangeText={v => setF('min_order_amount', v)} 
                                    keyboardType="decimal-pad" 
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={S.fieldLabel}>Adadin Masu Amfani (Limit)</Text>
                                <TextInput 
                                    style={S.input} 
                                    placeholder="∞ Ba Iyaka" 
                                    placeholderTextColor="#94A3B8"
                                    value={form.usage_limit} 
                                    onChangeText={v => setF('usage_limit', v)} 
                                    keyboardType="number-pad" 
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={S.fieldLabel}>Amfanin Mutum Daya</Text>
                                <TextInput 
                                    style={S.input} 
                                    placeholder="1" 
                                    placeholderTextColor="#94A3B8"
                                    value={form.per_user_limit} 
                                    onChangeText={v => setF('per_user_limit', v)} 
                                    keyboardType="number-pad" 
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={S.fieldLabel}>Wa Zai Yi Amfani</Text>
                                <View style={S.pickerWrap}>
                                    {['all', 'first_order'].map(opt => (
                                        <TouchableOpacity 
                                            key={opt} 
                                            onPress={() => setF('applicable_to', opt)} 
                                            style={[S.pickerBtn, form.applicable_to === opt && { backgroundColor: '#FFFBEB', borderColor: GOLD }]}
                                        >
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: form.applicable_to === opt ? NAVY : '#64748B', textTransform: 'capitalize' }}>
                                                {opt === 'all' ? 'Kowa (All)' : 'Saye Na 1'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <DatePickerBtn
                                label="Farkon Aiki"
                                value={form.valid_from}
                                active={calPicker.field === 'valid_from' && calPicker.visible}
                                onPress={() => setCalPicker({ field: 'valid_from', visible: true })}
                            />
                            <DatePickerBtn
                                label="Karshen Aiki"
                                value={form.expires_at}
                                active={calPicker.field === 'expires_at' && calPicker.visible}
                                onPress={() => setCalPicker({ field: 'expires_at', visible: true })}
                            />
                        </View>

                        <View style={S.toggleRow}>
                            <View>
                                <Text style={S.fieldLabel}>Kunnawa A Kasuwa (Active)</Text>
                                <Text style={{ fontSize: 11, color: '#94A3B8' }}>Bada damar amfani da wannan coupon</Text>
                            </View>
                            <Switch 
                                value={form.is_active} 
                                onValueChange={v => setF('is_active', v)} 
                                trackColor={{ false: '#E2E8F0', true: '#FEF3C7' }} 
                                thumbColor={form.is_active ? GOLD : '#CBD5E1'} 
                            />
                        </View>

                        <TouchableOpacity onPress={handleSave} disabled={saving} style={S.submitBtn} activeOpacity={0.85}>
                            {saving ? <ActivityIndicator color={NAVY} /> : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name={editTarget ? 'checkmark-circle' : 'add-circle'} size={18} color={NAVY} />
                                    <Text style={S.submitBtnTxt}>{editTarget ? 'Adana Canje-canje' : 'Ƙirƙiri Coupon Yanzu'}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </ScrollView>

                    {calPicker.visible && calPicker.field && (
                        <TouchableOpacity
                            style={CS.calOverlay}
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
    const [refreshing, setRefreshing] = useState(false);
    
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
        try {
            const { data, error } = await supabase
                .from('coupons')
                .select('*')
                .order('created_at', { ascending: false });
            if (data) setCoupons(data);
            if (error) console.error('Fetch coupons error:', error.message);
        } catch (e) {
            console.error('Fetch coupons catch:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchCoupons();
    };

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
        const nextState = !c.is_active;
        await supabase.from('coupons').update({ is_active: nextState }).eq('id', c.id);
        setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: nextState } : x));
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
        Alert.alert('Goge Coupon', `Kana son goge "${c.code}"? Ba za a iya dawo da shi ba.`, [
            { text: 'A\'a', style: 'cancel' },
            {
                text: 'Eh, Goge', style: 'destructive',
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
        try {
            if (Clipboard && Clipboard.setString) {
                Clipboard.setString(code);
            } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(code);
            }
            Alert.alert('An Kwafa!', `"${code}" an saka a clipboard.`);
        } catch (e) {
            Alert.alert('Lambar Coupon', code);
        }
    };

    // ── Render Coupon Card ─────────────────────────────────────────────────────
    const renderItem = ({ item: c }) => {
        const st = couponStatus(c);
        const pct = usagePercent(c);
        return (
            <TouchableOpacity
                onPress={() => setDetailCoupon(c)}
                activeOpacity={0.85}
                style={S.card}
            >
                <View style={[S.cardAccent, { backgroundColor: c.is_active ? GOLD : '#CBD5E1' }]} />
                
                <View style={{ flex: 1, padding: 14 }}>
                    <View style={S.cardTop}>
                        <TouchableOpacity onPress={() => copyCode(c.code)} style={S.codeWrap} activeOpacity={0.7}>
                            <Text style={S.codeText}>{c.code}</Text>
                            <Ionicons name="copy-outline" size={13} color={GOLD} style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                        <View style={[S.statusBadge, { backgroundColor: st.bg }]}>
                            <Text style={[S.statusTxt, { color: st.color }]}>{st.label}</Text>
                        </View>
                    </View>

                    <Text style={S.discountTxt}>
                        {c.discount_type === 'percentage' ? `${c.discount_value}% RANGWAME` : `₦${Number(c.discount_value).toLocaleString()} RANGWAME`}
                        {c.max_discount ? <Text style={S.maxTxt}> (Max ₦{Number(c.max_discount).toLocaleString()})</Text> : null}
                    </Text>

                    {c.description ? <Text style={S.descTxt} numberOfLines={1}>{c.description}</Text> : null}

                    {/* Usage progress */}
                    {c.usage_limit ? (
                        <View style={S.progBar}>
                            <View style={[S.progFill, { width: `${pct}%`, backgroundColor: pct >= 90 ? '#EF4444' : GOLD }]} />
                        </View>
                    ) : null}

                    <View style={S.metaRow}>
                        <View style={S.metaItem}>
                            <Ionicons name="repeat" size={12} color="#64748B" />
                            <Text style={S.metaTxt}>{fmtNum(c.usage_count)} / {fmtNum(c.usage_limit)}</Text>
                        </View>
                        {c.min_order_amount > 0 && (
                            <View style={S.metaItem}>
                                <Ionicons name="cart-outline" size={12} color="#64748B" />
                                <Text style={S.metaTxt}>Min ₦{Number(c.min_order_amount).toLocaleString()}</Text>
                            </View>
                        )}
                        {c.expires_at && (
                            <View style={S.metaItem}>
                                <Ionicons name="time-outline" size={12} color="#64748B" />
                                <Text style={S.metaTxt}>{fmtDate(c.expires_at)}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Quick actions */}
                <View style={S.cardActions}>
                    <TouchableOpacity onPress={() => toggleActive(c)} style={S.iconBtn}>
                        <Ionicons name={c.is_active ? "eye" : "eye-off"} size={16} color={c.is_active ? '#059669' : '#94A3B8'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openEdit(c)} style={S.iconBtn}>
                        <Ionicons name="pencil" size={15} color={NAVY} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => duplicateCoupon(c)} style={S.iconBtn}>
                        <Ionicons name="copy-outline" size={15} color={GOLD} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteCoupon(c)} style={[S.iconBtn, { backgroundColor: '#FEF2F2' }]}>
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    // ── DETAIL MODAL ───────────────────────────────────────────────────────────
    let detailModalJSX = null;
    if (detailCoupon) {
        const c = detailCoupon;
        const st = couponStatus(c);
        detailModalJSX = (
            <Modal visible animationType="fade" transparent onRequestClose={() => setDetailCoupon(null)}>
                <View style={S.modalOverlay}>
                    <View style={S.detailModalCard}>
                        <View style={S.modalHeader}>
                            <View>
                                <Text style={S.modalTitle}>Cikakken Bayanin Coupon</Text>
                                <Text style={S.modalSub}>{c.code}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setDetailCoupon(null)} style={S.closeModalBtn}>
                                <Ionicons name="close" size={20} color={NAVY} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
                            <View style={S.detailHeaderPill}>
                                <Text style={S.detailCodeTxt}>{c.code}</Text>
                                <Text style={S.detailDiscountTxt}>
                                    {c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `₦${Number(c.discount_value).toLocaleString()} OFF`}
                                </Text>
                            </View>

                            <View style={S.detailGrid}>
                                {[
                                    { label: 'Matsayi', value: st.label, color: st.color },
                                    { label: 'An Yi Amfani', value: `${fmtNum(c.usage_count)} / ${fmtNum(c.usage_limit)}` },
                                    { label: 'Min Order', value: c.min_order_amount ? `₦${Number(c.min_order_amount).toLocaleString()}` : 'Babu' },
                                    { label: 'Max Discount', value: c.max_discount ? `₦${Number(c.max_discount).toLocaleString()}` : 'Babu' },
                                    { label: 'Farkon Aiki', value: fmtDate(c.valid_from) },
                                    { label: 'Karshen Aiki', value: fmtDate(c.expires_at) },
                                ].map((g, i) => (
                                    <View key={i} style={S.detailGridCell}>
                                        <Text style={S.detailLabel}>{g.label}</Text>
                                        <Text style={[S.detailGridVal, g.color ? { color: g.color } : null]}>{g.value}</Text>
                                    </View>
                                ))}
                            </View>

                            {c.description ? (
                                <View style={S.detailDescBox}>
                                    <Text style={S.detailLabel}>Bayani:</Text>
                                    <Text style={S.detailDescVal}>{c.description}</Text>
                                </View>
                            ) : null}

                            {/* Actions */}
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <TouchableOpacity onPress={() => { setDetailCoupon(null); openEdit(c); }} style={[S.actionBtn, { backgroundColor: '#F1F5F9', flex: 1 }]}>
                                    <Ionicons name="pencil" size={15} color={NAVY} />
                                    <Text style={[S.actionBtnTxt, { color: NAVY }]}>Gyara</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setDetailCoupon(null); duplicateCoupon(c); }} style={[S.actionBtn, { backgroundColor: '#FFFBEB', flex: 1, borderColor: GOLD, borderWidth: 1 }]}>
                                    <Ionicons name="copy-outline" size={15} color={NAVY} />
                                    <Text style={[S.actionBtnTxt, { color: NAVY }]}>Kwafa (Duplicate)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setDetailCoupon(null); deleteCoupon(c); }} style={[S.actionBtn, { backgroundColor: '#FEF2F2', flex: 1 }]}>
                                    <Ionicons name="trash" size={15} color="#EF4444" />
                                    <Text style={[S.actionBtnTxt, { color: '#EF4444' }]}>Goge</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    }

    // ── MAIN RENDER ────────────────────────────────────────────────────────────
    return (
        <View style={S.root}>
            <StatusBar barStyle="dark-content" />

            {/* LIGHT HEADER */}
            <View style={[S.hdr, { paddingTop: Platform.OS === 'ios' ? insets.top + 10 : 16 }]}>
                <View style={S.hdrRow}>
                    <View style={S.hdrTitleWrap}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="ticket" size={22} color={GOLD} />
                            <Text style={S.hdrTitle}>Lambobin Rangwame</Text>
                        </View>
                        <Text style={S.hdrSub}>{stats.total} coupons gaba daya · {stats.active} suna aiki</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => { setEditTarget(null); setDuplicateTarget(null); setShowForm(true); }}
                        style={S.addBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add" size={18} color="#FFFFFF" />
                        <Text style={S.addBtnTxt}>Sabo</Text>
                    </TouchableOpacity>
                </View>

                {/* Stat row */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
                    <StatCard icon="pricetag" label="Duka" value={stats.total} color={NAVY} bg="#FFFFFF" />
                    <StatCard icon="checkmark-circle" label="A Kasuwa" value={stats.active} color="#059669" bg="#ECFDF5" />
                    <StatCard icon="time-outline" label="Sun Kare" value={stats.expired} color="#EF4444" bg="#FEF2F2" />
                    <StatCard icon="repeat" label="Amfani" value={stats.uses} color={GOLD} bg="#FFFBEB" />
                </ScrollView>
            </View>

            {/* SEARCH */}
            <View style={S.searchWrap}>
                <View style={S.searchIconWrap}>
                    <Ionicons name="search" size={14} color={GOLD} />
                </View>
                <TextInput
                    style={S.searchIn}
                    placeholder="Bincika lamba ko bayani…"
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={17} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* FILTER PILLS */}
            <View style={S.filterBar}>
                <ScrollView
                    horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
                >
                    {[
                        { id: 'all', label: 'Duka (All)', count: stats.total },
                        { id: 'active', label: 'A Kasuwa', count: stats.active },
                        { id: 'inactive', label: 'A Boye' },
                        { id: 'expired', label: 'Sun Kare', count: stats.expired },
                    ].map(f => (
                        <TouchableOpacity key={f.id} onPress={() => setFilter(f.id)} style={[S.pill, filter === f.id && S.pillOn]}>
                            <Text style={[S.pillTxt, filter === f.id && S.pillTxtActive]}>{f.label}</Text>
                            {f.count != null && (
                                <View style={[S.pillBadge, filter === f.id && S.pillBadgeActive]}>
                                    <Text style={[S.pillBadgeTxt, filter === f.id && S.pillBadgeTxtActive]}>{f.count}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* LIST */}
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={{ color: '#64748B', marginTop: 10, fontWeight: '600' }}>Ana loda lambobin rangwame…</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={i => i.id ? i.id.toString() : Math.random().toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: insets.bottom + 80 }}
                    ListEmptyComponent={<EmptyState onAdd={() => { setEditTarget(null); setDuplicateTarget(null); setShowForm(true); }} />}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
                />
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
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    hdr: { 
        backgroundColor: '#FFFFFF', 
        paddingHorizontal: 18, 
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2
    },
    hdrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    hdrTitleWrap: { flex: 1 },
    hdrTitle: { color: NAVY, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
    hdrSub: { color: '#64748B', fontSize: 12, marginTop: 2, fontWeight: '500' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: NAVY, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: GOLD },
    addBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

    // Stat card
    statCard: { 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingVertical: 10, 
        borderRadius: 14, 
        borderWidth: 1, 
        gap: 2,
        minWidth: 90
    },
    statVal: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
    statLbl: { fontSize: 10, color: '#64748B', fontWeight: '800', textTransform: 'uppercase' },

    // Search
    searchWrap: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: 'white', 
        marginHorizontal: 14, 
        marginTop: 12, 
        marginBottom: 8, 
        borderRadius: 14, 
        paddingHorizontal: 12, 
        paddingVertical: 10, 
        borderWidth: 1, 
        borderColor: '#E2E8F0' 
    },
    searchIconWrap: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    searchIn: { flex: 1, fontSize: 14, fontWeight: '600', color: NAVY },

    // Filter pills
    filterBar: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', gap: 5 },
    pillOn: { backgroundColor: NAVY, borderColor: NAVY },
    pillTxt: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    pillTxtActive: { color: GOLD },
    pillBadge: { backgroundColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
    pillBadgeActive: { backgroundColor: 'rgba(217, 167, 58, 0.2)' },
    pillBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#64748B' },
    pillBadgeTxtActive: { color: GOLD },

    // Cards
    card: { 
        backgroundColor: 'white', 
        borderRadius: 16, 
        flexDirection: 'row', 
        borderWidth: 1, 
        borderColor: '#E2E8F0', 
        shadowColor: NAVY, 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.05, 
        shadowRadius: 6, 
        elevation: 2, 
        overflow: 'hidden' 
    },
    cardAccent: { width: 5 },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    codeWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    codeText: { fontSize: 14, fontWeight: '900', color: NAVY, letterSpacing: 1 },
    discountTxt: { fontSize: 16, fontWeight: '900', color: NAVY, marginBottom: 4 },
    maxTxt: { fontSize: 11, color: '#64748B', fontWeight: '500' },
    descTxt: { fontSize: 12, color: '#64748B', marginBottom: 8 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaTxt: { fontSize: 11, color: '#64748B', fontWeight: '600' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    statusTxt: { fontSize: 10, fontWeight: '800' },
    progBar: { height: 5, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
    progFill: { height: '100%', borderRadius: 4 },
    cardActions: { paddingVertical: 10, paddingRight: 10, alignItems: 'center', gap: 6 },
    iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },

    // Empty
    empty: { alignItems: 'center', padding: 40, gap: 12, backgroundColor: '#FFFFFF', borderRadius: 20, margin: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FDE68A' },
    emptyTitle: { fontSize: 17, fontWeight: '800', color: NAVY },
    emptyTxt: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: NAVY, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: GOLD },
    emptyBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(14, 26, 46, 0.65)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '90%' },
    detailModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalTitle: { fontSize: 17, fontWeight: '900', color: NAVY },
    modalSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
    closeModalBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

    detailHeaderPill: { backgroundColor: NAVY, borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: GOLD },
    detailCodeTxt: { color: GOLD, fontSize: 22, fontWeight: '900', letterSpacing: 2 },
    detailDiscountTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 4 },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    detailGridCell: { flex: 1, minWidth: '45%', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 2 },
    detailGridVal: { fontSize: 14, fontWeight: '800', color: NAVY },
    detailLabel: { fontSize: 10, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' },
    detailDescBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    detailDescVal: { fontSize: 13, color: NAVY, marginTop: 2, lineHeight: 18 },

    // Form Fields
    fieldLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 14, color: NAVY, fontWeight: '600' },
    codeInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    genBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' },
    genBtnTxt: { color: NAVY, fontWeight: '800', fontSize: 13 },
    segRow: { flexDirection: 'row', gap: 8 },
    segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    segBtnOn: { borderColor: GOLD, backgroundColor: '#FFFBEB' },
    segBtnTxt: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    pickerWrap: { flexDirection: 'row', gap: 6 },
    pickerBtn: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: GOLD, padding: 15, borderRadius: 16, marginTop: 10 },
    submitBtnTxt: { color: NAVY, fontWeight: '900', fontSize: 15 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12 },
    actionBtnTxt: { fontWeight: '800', fontSize: 13 },
});

// ─── Calendar Styles ───────────────────────────────────────────────────────────
const CS = StyleSheet.create({
    dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    dateBtnLbl: { fontSize: 9, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
    dateBtnVal: { fontSize: 13, fontWeight: '700', color: NAVY, marginTop: 2 },

    calOverlay: { flex: 1, backgroundColor: 'rgba(14, 26, 46, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    calWrap: { backgroundColor: 'white', borderRadius: 20, padding: 18, width: Math.min(width - 40, 340), shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },

    calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    calArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    calMonth: { fontSize: 15, fontWeight: '900', color: NAVY },

    calRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    calDayHdr: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#64748B' },

    calCell: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    calCellSel: { backgroundColor: GOLD },
    calCellToday: { backgroundColor: '#FFFBEB' },
    calCellTxt: { fontSize: 13, fontWeight: '600', color: NAVY },

    calClearBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F1F5F9' },
    calClearTxt: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    calDoneBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: NAVY },
    calDoneTxt: { fontSize: 12, fontWeight: '800', color: GOLD },
});
