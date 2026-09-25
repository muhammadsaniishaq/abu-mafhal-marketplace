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

// ─── Date & Formatting Helpers ───────────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const fmtDate = (d) => {
    if (!d) return '—';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return String(d);
    return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtDateFull = (d) => {
    if (!d) return 'No date selected';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return String(d);
    return dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const addDaysStr = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return toDateStr(d);
};

const getRelativeDaysText = (dateStr, isExpiry = true) => {
    if (!dateStr) {
        return isExpiry 
            ? { text: '♾️ Lifetime (No Expiry)', color: '#059669', bg: '#ECFDF5' } 
            : { text: '⚡ Starts Immediately', color: '#059669', bg: '#ECFDF5' };
    }
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return { text: `⚠️ Expired ${Math.abs(diffDays)}d ago`, color: '#EF4444', bg: '#FEF2F2' };
    } else if (diffDays === 0) {
        return { text: '⏳ Expires today!', color: '#D97706', bg: '#FFFBEB' };
    } else if (diffDays === 1) {
        return { text: '⏳ Expires tomorrow', color: '#D97706', bg: '#FFFBEB' };
    } else {
        return { text: `⏳ In ${diffDays} days`, color: '#059669', bg: '#ECFDF5' };
    }
};

const fmtNum = (n) => n == null ? '∞' : Number(n).toLocaleString();
const usagePercent = (c) => {
    if (!c.usage_limit) return null;
    return Math.min(100, Math.round(((c.usage_count || 0) / c.usage_limit) * 100));
};
const isExpired = (c) => c.expires_at && new Date(c.expires_at) < new Date();
const couponStatus = (c) => {
    if (!c.is_active) return { label: 'Inactive', color: '#64748B', bg: '#F1F5F9' };
    if (isExpired(c)) return { label: 'Expired', color: '#EF4444', bg: '#FEF2F2' };
    const pct = usagePercent(c);
    if (pct === 100) return { label: 'Depleted', color: '#F59E0B', bg: '#FFFBEB' };
    return { label: 'Active', color: '#059669', bg: '#ECFDF5' };
};
const genCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ─── Modern Date Card (Form Input) ───────────────────────────────────────────
const ModernDateCard = ({ label, value, icon, active, onPress, onClear, isExpiry }) => {
    const rel = getRelativeDaysText(value, isExpiry);
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.82}
            style={[
                CS.modernDateCard,
                active && CS.modernDateCardActive,
                value && CS.modernDateCardSet,
            ]}
        >
            <View style={CS.cardTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <View style={[CS.cardIconBadge, value ? { backgroundColor: '#FEF3C7' } : { backgroundColor: '#F1F5F9' }]}>
                        <Ionicons name={icon || "calendar"} size={13} color={value ? GOLD : '#64748B'} />
                    </View>
                    <Text style={CS.cardLabelTxt}>{label}</Text>
                </View>
                {value ? (
                    <TouchableOpacity
                        onPress={onClear}
                        style={CS.cardClearIconBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="close-circle" size={17} color="#94A3B8" />
                    </TouchableOpacity>
                ) : (
                    <Ionicons name="chevron-forward" size={13} color="#CBD5E1" />
                )}
            </View>

            <Text style={[CS.cardValTxt, !value && CS.cardValTxtEmpty]} numberOfLines={1}>
                {value ? fmtDate(value) : (isExpiry ? 'Never (Lifetime)' : 'Immediately')}
            </Text>

            <View style={[CS.cardBadge, { backgroundColor: rel.bg }]}>
                <Text style={[CS.cardBadgeTxt, { color: rel.color }]} numberOfLines={1}>{rel.text}</Text>
            </View>
        </TouchableOpacity>
    );
};

// ─── Modern Full-Featured Calendar Card ───────────────────────────────────────
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ModernDatePickerCard = ({ title, field, value, onSelect, onClose }) => {
    const initDate = value ? new Date(value) : new Date();
    const validInit = isNaN(initDate.getTime()) ? new Date() : initDate;

    const [selectedDateStr, setSelectedDateStr] = React.useState(value || '');
    const [view, setView] = React.useState({ year: validInit.getFullYear(), month: validInit.getMonth() });
    const { year, month } = view;

    const todayStr = toDateStr(new Date());

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
    while (cells.length % 7 !== 0) cells.push(null);

    const prevMonth = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 });
    const nextMonth = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 });
    const prevYear = () => setView(v => ({ ...v, year: v.year - 1 }));
    const nextYear = () => setView(v => ({ ...v, year: v.year + 1 }));

    const handlePickDay = (d) => {
        if (!d) return;
        const dStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
        setSelectedDateStr(dStr);
    };

    const applyPreset = (dateStr) => {
        setSelectedDateStr(dateStr || '');
        if (dateStr) {
            const dt = new Date(dateStr);
            if (!isNaN(dt.getTime())) {
                setView({ year: dt.getFullYear(), month: dt.getMonth() });
            }
        }
    };

    const isSelected = (d) => {
        if (!d || !selectedDateStr) return false;
        const targetStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
        return selectedDateStr === targetStr;
    };

    const isToday = (d) => {
        if (!d) return false;
        const targetStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
        return todayStr === targetStr;
    };

    const rel = getRelativeDaysText(selectedDateStr, field === 'expires_at');

    return (
        <View style={CS.calCardWrap}>
            {/* Header with Luxury Navy Background */}
            <View style={CS.calHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={CS.calHeaderIcon}>
                        <Ionicons name="calendar" size={17} color={GOLD} />
                    </View>
                    <View>
                        <Text style={CS.calHeaderTitle}>{title || 'Select Date'}</Text>
                        <Text style={CS.calHeaderSub}>
                            {field === 'expires_at' ? 'Set when this discount code expires' : 'Set when this code becomes redeemable'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity onPress={onClose} style={CS.calCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            {/* Selected Date Hero Preview */}
            <View style={CS.calHeroWrap}>
                <View style={{ flex: 1 }}>
                    <Text style={CS.calHeroLabel}>CURRENT SELECTION</Text>
                    <Text style={CS.calHeroDate}>
                        {selectedDateStr ? fmtDateFull(selectedDateStr) : 'No Date Set (Valid Lifetime)'}
                    </Text>
                </View>
                <View style={[CS.calHeroBadge, { backgroundColor: rel.bg }]}>
                    <Text style={[CS.calHeroBadgeTxt, { color: rel.color }]}>{rel.text}</Text>
                </View>
            </View>

            {/* Quick Preset Buttons Bar */}
            <View style={CS.calPresetsRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
                    <TouchableOpacity
                        onPress={() => applyPreset(todayStr)}
                        style={[CS.calPresetChip, selectedDateStr === todayStr && CS.calPresetChipActive]}
                    >
                        <Text style={[CS.calPresetChipTxt, selectedDateStr === todayStr && CS.calPresetChipTxtActive]}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => applyPreset(addDaysStr(7))}
                        style={[CS.calPresetChip, selectedDateStr === addDaysStr(7) && CS.calPresetChipActive]}
                    >
                        <Text style={[CS.calPresetChipTxt, selectedDateStr === addDaysStr(7) && CS.calPresetChipTxtActive]}>+7 Days</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => applyPreset(addDaysStr(14))}
                        style={[CS.calPresetChip, selectedDateStr === addDaysStr(14) && CS.calPresetChipActive]}
                    >
                        <Text style={[CS.calPresetChipTxt, selectedDateStr === addDaysStr(14) && CS.calPresetChipTxtActive]}>+14 Days</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => applyPreset(addDaysStr(30))}
                        style={[CS.calPresetChip, selectedDateStr === addDaysStr(30) && CS.calPresetChipActive]}
                    >
                        <Text style={[CS.calPresetChipTxt, selectedDateStr === addDaysStr(30) && CS.calPresetChipTxtActive]}>+30 Days</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => applyPreset(addDaysStr(90))}
                        style={[CS.calPresetChip, selectedDateStr === addDaysStr(90) && CS.calPresetChipActive]}
                    >
                        <Text style={[CS.calPresetChipTxt, selectedDateStr === addDaysStr(90) && CS.calPresetChipTxtActive]}>+90 Days</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => applyPreset(`${new Date().getFullYear()}-12-31`)}
                        style={[CS.calPresetChip, selectedDateStr === `${new Date().getFullYear()}-12-31` && CS.calPresetChipActive]}
                    >
                        <Text style={[CS.calPresetChipTxt, selectedDateStr === `${new Date().getFullYear()}-12-31` && CS.calPresetChipTxtActive]}>End of Year</Text>
                    </TouchableOpacity>
                    {selectedDateStr ? (
                        <TouchableOpacity
                            onPress={() => applyPreset('')}
                            style={[CS.calPresetChip, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}
                        >
                            <Text style={[CS.calPresetChipTxt, { color: '#EF4444' }]}>Clear</Text>
                        </TouchableOpacity>
                    ) : null}
                </ScrollView>
            </View>

            {/* Month & Year Stepper Navigator */}
            <View style={CS.calNav}>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                    <TouchableOpacity onPress={prevYear} style={CS.calNavBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                        <Ionicons name="play-back" size={13} color={NAVY} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={prevMonth} style={CS.calNavBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                        <Ionicons name="chevron-back" size={16} color={NAVY} />
                    </TouchableOpacity>
                </View>

                <View style={CS.calNavCenter}>
                    <Text style={CS.calNavMonth}>{MONTHS[month]}</Text>
                    <Text style={CS.calNavYear}>{year}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 4 }}>
                    <TouchableOpacity onPress={nextMonth} style={CS.calNavBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                        <Ionicons name="chevron-forward" size={16} color={NAVY} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={nextYear} style={CS.calNavBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                        <Ionicons name="play-forward" size={13} color={NAVY} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Day Header Row */}
            <View style={CS.calDaysHdrRow}>
                {DAYS.map((d, idx) => (
                    <Text key={idx} style={[CS.calDayHdrTxt, (idx === 0 || idx === 6) && { color: GOLD }]}>{d}</Text>
                ))}
            </View>

            {/* Days Grid */}
            <View style={CS.calGrid}>
                {Array.from({ length: cells.length / 7 }, (_, wi) => (
                    <View key={wi} style={CS.calGridRow}>
                        {cells.slice(wi * 7, wi * 7 + 7).map((d, ci) => {
                            const sel = isSelected(d);
                            const tod = isToday(d);
                            return (
                                <TouchableOpacity
                                    key={ci}
                                    onPress={() => handlePickDay(d)}
                                    disabled={!d}
                                    activeOpacity={0.7}
                                    style={[
                                        CS.calDayCell,
                                        sel && CS.calDayCellSel,
                                        tod && !sel && CS.calDayCellToday,
                                    ]}
                                >
                                    <Text style={[
                                        CS.calDayTxt,
                                        sel && CS.calDayTxtSel,
                                        tod && !sel && CS.calDayTxtToday,
                                        !d && { opacity: 0 }
                                    ]}>
                                        {d || ''}
                                    </Text>
                                    {tod && !sel ? <View style={CS.todayDot} /> : null}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </View>

            {/* Footer Action Bar */}
            <View style={CS.calFooter}>
                <TouchableOpacity
                    onPress={() => {
                        onSelect('');
                        onClose();
                    }}
                    style={CS.calFooterClearBtn}
                >
                    <Ionicons name="trash-outline" size={14} color="#64748B" />
                    <Text style={CS.calFooterClearTxt}>Clear</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={onClose} style={CS.calFooterCancelBtn}>
                        <Text style={CS.calFooterCancelTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            onSelect(selectedDateStr || '');
                            onClose();
                        }}
                        style={CS.calFooterDoneBtn}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="checkmark-circle" size={16} color={NAVY} />
                        <Text style={CS.calFooterDoneTxt}>Confirm Date</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

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
        <Text style={S.emptyTitle}>No Discount Coupons Found</Text>
        <Text style={S.emptyTxt}>Create a new promotional code to offer customers special discounts across the marketplace.</Text>
        <TouchableOpacity onPress={onAdd} style={S.emptyBtn}>
            <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={S.emptyBtnTxt}>Create Coupon Now</Text>
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
        if (!form.code.trim()) return Alert.alert('Error', 'Coupon code is required');
        if (!form.discount_value) return Alert.alert('Error', 'Discount amount is required');
        const dVal = parseFloat(form.discount_value);
        if (isNaN(dVal) || dVal <= 0) return Alert.alert('Error', 'Please enter a valid discount amount');
        if (form.discount_type === 'percentage' && dVal > 100)
            return Alert.alert('Error', 'Percentage discount cannot exceed 100%');

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

            // ── Dual-Storage Engine ────────────────────────────────────────────
            // 1. Try the dedicated `coupons` table first
            let saved = false;
            if (editTarget) {
                const { error } = await supabase.from('coupons').update(payload).eq('id', editTarget.id);
                if (!error) { saved = true; }
                else if (error.code !== 'PGRST205') throw new Error(error.message);
            } else {
                const { error } = await supabase.from('coupons').insert([{ ...payload, usage_count: 0 }]);
                if (!error) { saved = true; }
                else if (error.code !== 'PGRST205') throw new Error(error.message);
            }

            // 2. Fallback: persist to app_settings.coupons_list (JSON array)
            if (!saved) {
                const { data: row } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'coupons_list')
                    .maybeSingle();
                let list = Array.isArray(row?.value) ? [...row.value] : [];

                if (editTarget) {
                    // Update existing by id
                    list = list.map(c => c.id === editTarget.id ? { ...c, ...payload, updated_at: new Date().toISOString() } : c);
                } else {
                    // Insert new with generated id
                    list.unshift({
                        id: `coup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        ...payload,
                        usage_count: 0,
                        created_at: new Date().toISOString(),
                    });
                }

                const { error: upsErr } = await supabase.from('app_settings').upsert({
                    key: 'coupons_list',
                    value: list,
                    description: 'Platform Discount Coupons and Vouchers',
                    updated_at: new Date().toISOString(),
                });
                if (upsErr) throw new Error('Failed to save coupon: ' + upsErr.message);
            }

            onSuccess(payload);
        } catch (err) {
            console.error('Save coupon error:', err);
            Alert.alert('Error', err.message || 'Failed to save coupon.');
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
                            <Text style={S.modalTitle}>{editTarget ? 'Edit Coupon' : 'New Discount Coupon'}</Text>
                            <Text style={S.modalSub}>Configure discount details and usage rules</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={S.closeModalBtn}>
                            <Ionicons name="close" size={20} color={NAVY} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
                        <View>
                            <Text style={S.fieldLabel}>Coupon Code (Promo Code) *</Text>
                            <View style={S.codeInputRow}>
                                <TextInput
                                    style={[S.input, { flex: 1 }]}
                                    placeholder="e.g. SUMMER50"
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
                            <Text style={S.fieldLabel}>Coupon Description (Optional)</Text>
                            <TextInput 
                                style={S.input} 
                                placeholder="e.g. 20% off for new shoppers" 
                                placeholderTextColor="#94A3B8"
                                value={form.description} 
                                onChangeText={v => setF('description', v)} 
                            />
                        </View>

                        <View>
                            <Text style={S.fieldLabel}>Discount Type</Text>
                            <View style={S.segRow}>
                                {[
                                    { k: 'percentage', l: 'Percentage (%)', icon: 'trending-down' }, 
                                    { k: 'fixed', l: 'Fixed Amount (₦)', icon: 'cash' }
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
                                <Text style={S.fieldLabel}>{form.discount_type === 'percentage' ? 'Percentage (%) *' : 'Fixed Amount (₦) *'}</Text>
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
                                    <Text style={S.fieldLabel}>Max Discount (₦ Cap)</Text>
                                    <TextInput 
                                        style={S.input} 
                                        placeholder="Maximum discount limit" 
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
                                <Text style={S.fieldLabel}>Minimum Order (₦ Min)</Text>
                                <TextInput 
                                    style={S.input} 
                                    placeholder="e.g. 2000" 
                                    placeholderTextColor="#94A3B8"
                                    value={form.min_order_amount} 
                                    onChangeText={v => setF('min_order_amount', v)} 
                                    keyboardType="decimal-pad" 
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={S.fieldLabel}>Usage Limit</Text>
                                <TextInput 
                                    style={S.input} 
                                    placeholder="∞ Unlimited" 
                                    placeholderTextColor="#94A3B8"
                                    value={form.usage_limit} 
                                    onChangeText={v => setF('usage_limit', v)} 
                                    keyboardType="number-pad" 
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={S.fieldLabel}>Per User Limit</Text>
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
                                <Text style={S.fieldLabel}>Applicable To</Text>
                                <View style={S.pickerWrap}>
                                    {['all', 'first_order'].map(opt => (
                                        <TouchableOpacity 
                                            key={opt} 
                                            onPress={() => setF('applicable_to', opt)} 
                                            style={[S.pickerBtn, form.applicable_to === opt && { backgroundColor: '#FFFBEB', borderColor: GOLD }]}
                                        >
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: form.applicable_to === opt ? NAVY : '#64748B', textTransform: 'capitalize' }}>
                                                {opt === 'all' ? 'All Customers' : 'First Order Only'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* ── Validity & Expiry Dates Section ─────────────────────────────── */}
                        <View style={{ gap: 8 }}>
                            <Text style={S.fieldLabel}>Validity & Expiry Dates</Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <ModernDateCard
                                    label="Start Date"
                                    value={form.valid_from}
                                    icon="play-circle-outline"
                                    active={calPicker.field === 'valid_from' && calPicker.visible}
                                    onPress={() => setCalPicker({ field: 'valid_from', visible: true })}
                                    onClear={() => setF('valid_from', '')}
                                    isExpiry={false}
                                />
                                <ModernDateCard
                                    label="Expiry Date"
                                    value={form.expires_at}
                                    icon="time-outline"
                                    active={calPicker.field === 'expires_at' && calPicker.visible}
                                    onPress={() => setCalPicker({ field: 'expires_at', visible: true })}
                                    onClear={() => setF('expires_at', '')}
                                    isExpiry={true}
                                />
                            </View>

                            {/* Quick Expiry Shortcuts */}
                            <View style={CS.quickPresetsWrap}>
                                <Text style={CS.quickPresetsLabel}>⚡ Quick Expiry Presets</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                    {[
                                        { label: '+7 Days', val: addDaysStr(7) },
                                        { label: '+14 Days', val: addDaysStr(14) },
                                        { label: '+30 Days', val: addDaysStr(30) },
                                        { label: '+90 Days', val: addDaysStr(90) },
                                        { label: 'End of Year', val: `${new Date().getFullYear()}-12-31` },
                                        { label: '♾️ Lifetime', val: '' },
                                    ].map(p => {
                                        const isSel = (p.val === '' && !form.expires_at) || (p.val && form.expires_at === p.val);
                                        return (
                                            <TouchableOpacity
                                                key={p.label}
                                                onPress={() => setF('expires_at', p.val)}
                                                style={[CS.quickPresetChip, isSel && CS.quickPresetChipActive]}
                                            >
                                                <Text style={[CS.quickPresetChipTxt, isSel && CS.quickPresetChipTxtActive]}>
                                                    {p.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        </View>

                        <View style={S.toggleRow}>
                            <View>
                                <Text style={S.fieldLabel}>Active Status</Text>
                                <Text style={{ fontSize: 11, color: '#94A3B8' }}>Enable customers to redeem this coupon</Text>
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
                                    <Text style={S.submitBtnTxt}>{editTarget ? 'Save Changes' : 'Create Coupon Now'}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>

            {/* ── Modern Centered Calendar Modal Overlay ─────────────────── */}
            {calPicker.visible && calPicker.field && (
                <View style={CS.calOverlayFull}>
                    <ModernDatePickerCard
                        title={calPicker.field === 'valid_from' ? 'Select Start Date' : 'Select Expiry Date'}
                        field={calPicker.field}
                        value={form[calPicker.field]}
                        onSelect={(dateStr) => {
                            setF(calPicker.field, dateStr || '');
                            setCalPicker({ field: null, visible: false });
                        }}
                        onClose={() => setCalPicker({ field: null, visible: false })}
                    />
                </View>
            )}
        </Modal>
    );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export const AdminCoupons = ({ onBack, navigation }) => {
    const insets = useSafeAreaInsets();

    // Data
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    
    // UI
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [duplicateTarget, setDuplicateTarget] = useState(null);
    const [detailCoupon, setDetailCoupon] = useState(null);

    // ── Admin Security Check ───────────────────────────────────────────────────
    useEffect(() => {
        const verifyAdmin = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error || !user) {
                    Alert.alert('Access Denied', 'You must be logged in to access admin features.', [
                        { text: 'OK', onPress: () => typeof onBack === 'function' && onBack() }
                    ]);
                    return;
                }
                // Check admin role in profiles table
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle();
                
                const role = profile?.role || '';
                const allowed = ['admin', 'super_admin', 'superadmin'].includes(role.toLowerCase());
                if (!allowed) {
                    Alert.alert('Access Denied', 'Only admins can manage coupons.', [
                        { text: 'OK', onPress: () => typeof onBack === 'function' && onBack() }
                    ]);
                    return;
                }
                setIsAuthorized(true);
            } catch (e) {
                console.error('Admin auth check failed:', e);
                // Allow access if auth check itself fails (offline mode) but warn
                setIsAuthorized(true);
            } finally {
                setAuthChecked(true);
            }
        };
        verifyAdmin();
    }, [onBack]);

    // ── Toast Helper ──────────────────────────────────────────────────────────
    const showToast = useCallback((msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 3000);
    }, []);


    // ── Fetch (Dual-Storage) ───────────────────────────────────────────────────
    const fetchCoupons = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Try dedicated table first
            const { data, error } = await supabase
                .from('coupons')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) {
                // Filter out any hardcoded mock data (safety net)
                const real = data.filter(c => c.id && !String(c.id).startsWith('mock_'));
                setCoupons(real);
            } else if (error?.code === 'PGRST205') {
                // 2. Fallback: load from app_settings.coupons_list
                const { data: row, error: settErr } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'coupons_list')
                    .maybeSingle();
                if (!settErr && Array.isArray(row?.value)) {
                    const sorted = [...row.value]
                        .filter(c => c.id && !String(c.id).startsWith('mock_'))
                        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
                    setCoupons(sorted);
                } else {
                    setCoupons([]);
                }
            } else if (error) {
                console.error('Fetch coupons error:', error.message);
                setCoupons([]);
            }
        } catch (e) {
            console.error('Fetch coupons catch:', e);
            setCoupons([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { if (isAuthorized) fetchCoupons(); }, [fetchCoupons, isAuthorized]);

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

    // ── Toggle Active (Dual-Storage) ───────────────────────────────────────────
    const toggleActive = async (c) => {
        const nextState = !c.is_active;
        // Optimistic update
        setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: nextState } : x));

        const { error } = await supabase.from('coupons').update({ is_active: nextState }).eq('id', c.id);
        if (error?.code === 'PGRST205') {
            // Fallback: update in app_settings
            const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'coupons_list').maybeSingle();
            const list = Array.isArray(row?.value) ? row.value.map(x => x.id === c.id ? { ...x, is_active: nextState } : x) : [];
            await supabase.from('app_settings').upsert({ key: 'coupons_list', value: list, updated_at: new Date().toISOString() });
        }
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

    // ── Delete (Dual-Storage + Full Error Recovery) ────────────────────────────
    const deleteCoupon = (c) => {
        Alert.alert(
            '🗑️ Delete Coupon',
            `Are you sure you want to permanently delete "${c.code}"?\n\nThis action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        // 1. Optimistic remove from UI
                        const snapshot = [...coupons]; // save snapshot for rollback
                        setCoupons(prev => prev.filter(x => x.id !== c.id));
                        if (detailCoupon?.id === c.id) setDetailCoupon(null);

                        try {
                            // 2. Try dedicated coupons table first
                            const { error } = await supabase.from('coupons').delete().eq('id', c.id);
                            
                            if (error && error.code !== 'PGRST205') {
                                // Real error → rollback UI
                                setCoupons(snapshot);
                                Alert.alert('Delete Failed', `Could not delete coupon: ${error.message}`);
                                return;
                            }
                            
                            if (error?.code === 'PGRST205') {
                                // 3. Fallback: remove from app_settings.coupons_list
                                const { data: row, error: fetchErr } = await supabase
                                    .from('app_settings')
                                    .select('value')
                                    .eq('key', 'coupons_list')
                                    .maybeSingle();
                                
                                if (fetchErr) {
                                    setCoupons(snapshot);
                                    Alert.alert('Delete Failed', 'Could not access storage. Please try again.');
                                    return;
                                }
                                
                                const updatedList = Array.isArray(row?.value)
                                    ? row.value.filter(x => x.id !== c.id)
                                    : [];
                                
                                const { error: upsErr } = await supabase.from('app_settings').upsert({
                                    key: 'coupons_list',
                                    value: updatedList,
                                    updated_at: new Date().toISOString(),
                                });
                                
                                if (upsErr) {
                                    setCoupons(snapshot); // rollback
                                    Alert.alert('Delete Failed', `Storage update failed: ${upsErr.message}`);
                                    return;
                                }
                            }
                            
                            // 4. Success feedback
                            showToast(`✓ Coupon "${c.code}" deleted`);
                        } catch (err) {
                            setCoupons(snapshot); // rollback on any unexpected error
                            Alert.alert('Delete Failed', err.message || 'An unexpected error occurred.');
                        }
                    },
                },
            ]
        );
    };

    // ── Copy code ──────────────────────────────────────────────────────────────
    const copyCode = (code) => {
        try {
            if (Clipboard && Clipboard.setString) {
                Clipboard.setString(code);
            } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(code);
            }
            Alert.alert('Copied!', `"${code}" copied to clipboard.`);
        } catch (e) {
            Alert.alert('Coupon Code', code);
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
                        {c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `₦${Number(c.discount_value).toLocaleString()} OFF`}
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
                            <View style={[
                                S.metaItem,
                                isExpired(c) && { backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }
                            ]}>
                                <Ionicons name="time-outline" size={12} color={isExpired(c) ? '#EF4444' : '#64748B'} />
                                <Text style={[S.metaTxt, isExpired(c) && { color: '#EF4444', fontWeight: '800' }]}>
                                    {isExpired(c) ? `Expired (${fmtDate(c.expires_at)})` : `Exp: ${fmtDate(c.expires_at)}`}
                                </Text>
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
                                <Text style={S.modalTitle}>Coupon Details</Text>
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
                                    { label: 'Status', value: st.label, color: st.color },
                                    { label: 'Usage', value: `${fmtNum(c.usage_count)} / ${fmtNum(c.usage_limit)}` },
                                    { label: 'Min Order', value: c.min_order_amount ? `₦${Number(c.min_order_amount).toLocaleString()}` : 'None' },
                                    { label: 'Max Discount', value: c.max_discount ? `₦${Number(c.max_discount).toLocaleString()}` : 'None' },
                                    { label: 'Start Date', value: fmtDate(c.valid_from) },
                                    { label: 'Expiry Date', value: fmtDate(c.expires_at) },
                                ].map((g, i) => (
                                    <View key={i} style={S.detailGridCell}>
                                        <Text style={S.detailLabel}>{g.label}</Text>
                                        <Text style={[S.detailGridVal, g.color ? { color: g.color } : null]}>{g.value}</Text>
                                    </View>
                                ))}
                            </View>

                            {c.description ? (
                                <View style={S.detailDescBox}>
                                    <Text style={S.detailLabel}>Description:</Text>
                                    <Text style={S.detailDescVal}>{c.description}</Text>
                                </View>
                            ) : null}

                            {/* Actions */}
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <TouchableOpacity onPress={() => { setDetailCoupon(null); openEdit(c); }} style={[S.actionBtn, { backgroundColor: '#F1F5F9', flex: 1 }]}>
                                    <Ionicons name="pencil" size={15} color={NAVY} />
                                    <Text style={[S.actionBtnTxt, { color: NAVY }]}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setDetailCoupon(null); duplicateCoupon(c); }} style={[S.actionBtn, { backgroundColor: '#FFFBEB', flex: 1, borderColor: GOLD, borderWidth: 1 }]}>
                                    <Ionicons name="copy-outline" size={15} color={NAVY} />
                                    <Text style={[S.actionBtnTxt, { color: NAVY }]}>Duplicate</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setDetailCoupon(null); deleteCoupon(c); }} style={[S.actionBtn, { backgroundColor: '#FEF2F2', flex: 1 }]}>
                                    <Ionicons name="trash" size={15} color="#EF4444" />
                                    <Text style={[S.actionBtnTxt, { color: '#EF4444' }]}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    }

    // \u2500\u2500 MAIN RENDER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

    // Auth loading screen while checking admin identity
    if (!authChecked) {
        return (
            <View style={[S.root, { alignItems: 'center', justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={GOLD} />
                <Text style={{ color: '#64748B', marginTop: 14, fontWeight: '700', fontSize: 14 }}>Verifying admin access\u2026</Text>
            </View>
        );
    }

    // Block screen if user is not authorized
    if (!isAuthorized) {
        return (
            <View style={[S.root, { alignItems: 'center', justifyContent: 'center', padding: 30 }]}>
                <Ionicons name="lock-closed" size={48} color="#EF4444" />
                <Text style={{ color: NAVY, fontSize: 18, fontWeight: '900', marginTop: 16, textAlign: 'center' }}>Access Restricted</Text>
                <Text style={{ color: '#64748B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>Only platform administrators can manage discount coupons.</Text>
                {onBack && (
                    <TouchableOpacity onPress={onBack} style={{ marginTop: 24, backgroundColor: NAVY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Go Back</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    return (
        <View style={S.root}>
            <StatusBar barStyle="dark-content" />

            {/* LIGHT HEADER */}
            <View style={[S.hdr, { paddingTop: 10 }]}>
                <View style={S.hdrRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        {onBack && (
                            <TouchableOpacity onPress={onBack} style={S.backBtn} activeOpacity={0.7}>
                                <Ionicons name="arrow-back" size={18} color={NAVY} />
                            </TouchableOpacity>
                        )}
                        <View style={S.hdrTitleWrap}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="ticket" size={22} color={GOLD} />
                                <Text style={S.hdrTitle}>Discount Coupons</Text>
                            </View>
                            <Text style={S.hdrSub}>{stats.total} total coupons · {stats.active} active</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => { setEditTarget(null); setDuplicateTarget(null); setShowForm(true); }}
                        style={S.addBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add" size={18} color="#FFFFFF" />
                        <Text style={S.addBtnTxt}>New Coupon</Text>
                    </TouchableOpacity>
                </View>

                {/* Stat row */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
                    <StatCard icon="pricetag" label="Total" value={stats.total} color={NAVY} bg="#FFFFFF" />
                    <StatCard icon="checkmark-circle" label="Active" value={stats.active} color="#059669" bg="#ECFDF5" />
                    <StatCard icon="time-outline" label="Expired" value={stats.expired} color="#EF4444" bg="#FEF2F2" />
                    <StatCard icon="repeat" label="Redeemed" value={stats.uses} color={GOLD} bg="#FFFBEB" />
                </ScrollView>
            </View>

            {/* SEARCH */}
            <View style={S.searchWrap}>
                <View style={S.searchIconWrap}>
                    <Ionicons name="search" size={14} color={GOLD} />
                </View>
                <TextInput
                    style={S.searchIn}
                    placeholder="Search coupons by code or description…"
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
                        { id: 'all', label: 'All', count: stats.total },
                        { id: 'active', label: 'Active', count: stats.active },
                        { id: 'inactive', label: 'Inactive' },
                        { id: 'expired', label: 'Expired', count: stats.expired },
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
                    <Text style={{ color: '#64748B', marginTop: 10, fontWeight: '600' }}>Loading discount coupons…</Text>
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
                onSuccess={(payload) => {
                    setShowForm(false);
                    setEditTarget(null);
                    setDuplicateTarget(null);
                    fetchCoupons();
                    showToast(editTarget ? `✓ Coupon "${payload?.code}" updated!` : `✓ Coupon "${payload?.code}" created!`);
                }}
            />

            {/* ── FLOATING TOAST ── */}
            {!!toastMsg && (
                <View style={{
                    position: 'absolute',
                    bottom: insets.bottom + 24,
                    left: 20,
                    right: 20,
                    backgroundColor: '#0F172A',
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                    elevation: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(217, 167, 58, 0.3)',
                }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(5, 150, 105, 0.2)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    </View>
                    <Text style={{ color: '#F1F5F9', fontSize: 13, fontWeight: '700', flex: 1 }}>{toastMsg}</Text>
                </View>
            )}
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
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
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
    // Form Date Cards
    modernDateCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    modernDateCardActive: {
        borderColor: GOLD,
        backgroundColor: '#FFFDF5',
        shadowOpacity: 0.08,
    },
    modernDateCardSet: {
        borderColor: '#CBD5E1',
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    cardIconBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardLabelTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    cardClearIconBtn: {
        padding: 2,
    },
    cardValTxt: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
        marginBottom: 6,
    },
    cardValTxtEmpty: {
        fontWeight: '600',
        color: '#94A3B8',
    },
    cardBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8,
    },
    cardBadgeTxt: {
        fontSize: 10,
        fontWeight: '700',
    },

    // Quick Presets Row in Form
    quickPresetsWrap: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginTop: 4,
    },
    quickPresetsLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    quickPresetChip: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    quickPresetChipActive: {
        backgroundColor: '#FFFBEB',
        borderColor: GOLD,
    },
    quickPresetChipTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    quickPresetChipTxtActive: {
        color: NAVY,
        fontWeight: '800',
    },

    // Full Screen Centered Modal Overlay
    calOverlayFull: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 25, 47, 0.78)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
        padding: 16,
        elevation: 25,
    },
    calCardWrap: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        width: Math.min(width - 32, 380),
        maxWidth: 380,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 28,
        elevation: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
    },

    // Calendar Header
    calHeader: {
        backgroundColor: NAVY,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1.5,
        borderBottomColor: GOLD,
    },
    calHeaderIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(217, 167, 58, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: GOLD,
    },
    calHeaderTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    calHeaderSub: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 1,
    },
    calCloseBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Hero Preview Box
    calHeroWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        gap: 8,
    },
    calHeroLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5,
    },
    calHeroDate: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
        marginTop: 1,
    },
    calHeroBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    calHeroBadgeTxt: {
        fontSize: 10,
        fontWeight: '800',
    },

    // Presets Row
    calPresetsRow: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    calPresetChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    calPresetChipActive: {
        backgroundColor: '#FFFBEB',
        borderColor: GOLD,
    },
    calPresetChipTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    calPresetChipTxtActive: {
        color: NAVY,
        fontWeight: '800',
    },

    // Month / Year Nav
    calNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    calNavBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    calNavCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    calNavMonth: {
        fontSize: 14,
        fontWeight: '900',
        color: NAVY,
    },
    calNavYear: {
        fontSize: 14,
        fontWeight: '800',
        color: GOLD,
    },

    // Days Header
    calDaysHdrRow: {
        flexDirection: 'row',
        paddingHorizontal: 14,
        paddingBottom: 6,
        justifyContent: 'space-between',
    },
    calDayHdrTxt: {
        width: 38,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
    },

    // Calendar Grid
    calGrid: {
        paddingHorizontal: 14,
        paddingBottom: 8,
    },
    calGridRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    calDayCell: {
        width: 38,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    calDayCellSel: {
        backgroundColor: GOLD,
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 3,
    },
    calDayCellToday: {
        borderWidth: 1.5,
        borderColor: GOLD,
        backgroundColor: '#FFFDF5',
    },
    calDayTxt: {
        fontSize: 13,
        fontWeight: '700',
        color: NAVY,
    },
    calDayTxtSel: {
        color: NAVY,
        fontWeight: '900',
    },
    calDayTxtToday: {
        color: NAVY,
        fontWeight: '900',
    },
    todayDot: {
        position: 'absolute',
        bottom: 2,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: GOLD,
    },

    // Footer
    calFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        backgroundColor: '#FFFFFF',
    },
    calFooterClearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    calFooterClearTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    calFooterCancelBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    calFooterCancelTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    calFooterDoneBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: GOLD,
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 2,
    },
    calFooterDoneTxt: {
        fontSize: 12,
        fontWeight: '900',
        color: NAVY,
    },
});
