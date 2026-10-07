import * as React from 'react';
import {
    View, Text, Modal, TouchableOpacity, ScrollView, TextInput,
    ActivityIndicator, Alert, StyleSheet, Linking, KeyboardAvoidingView,
    Platform, Dimensions, Clipboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../components/UserAvatar';

const { width } = Dimensions.get('window');

// ─── Pristine Modern Color Palette (Clean, Structured, Airy) ───────────────
const C = {
    canvas: '#F8FAFC',          // Crisp clean slate-50 canvas
    cardBg: '#FFFFFF',          // Pure white card
    border: '#E2E8F0',          // Subtle slate-200 border
    borderLight: '#F1F5F9',     // Ultra light separator
    dark: '#0F172A',            // Slate-900 heading typography
    body: '#334155',            // Slate-700 body typography
    muted: '#64748B',           // Slate-500 secondary
    subtle: '#94A3B8',          // Slate-400 placeholder
    emerald: '#059669',         // Emerald-600
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    amber: '#D97706',           // Amber-600
    amberBg: '#FEF3C7',
    amberBorder: '#FDE68A',
    rose: '#E11D48',            // Rose-600
    roseBg: '#FFF1F2',
    roseBorder: '#FECDD3',
    blue: '#2563EB',            // Blue-600
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE',
    purple: '#7C3AED',          // Purple-600
    purpleBg: '#F5F3FF',
    purpleBorder: '#DDD6FE',
};

// ─── Amount Formatter ───────────────────────────────────────────────────────
const fmtAmt = (val) => {
    if (!val || isNaN(val)) return '₦0';
    const num = Number(val);
    if (num >= 1e6) return `₦${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `₦${(num / 1e3).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`;
    return `₦${num.toLocaleString('en-US')}`;
};

const PRESET_TAGS = [
    { id: 'vip', label: '⭐ VIP Client', color: C.amber, bg: C.amberBg, border: C.amberBorder },
    { id: 'wholesale', label: '📦 Wholesaler', color: C.blue, bg: C.blueBg, border: C.blueBorder },
    { id: 'top_spender', label: '💎 Top Spender', color: C.purple, bg: C.purpleBg, border: C.purpleBorder },
    { id: 'fast_payer', label: '⚡ Fast Payer', color: C.emerald, bg: C.emeraldBg, border: C.emeraldBorder },
    { id: 'verified_id', label: '🛡️ Verified ID', color: C.blue, bg: C.blueBg, border: C.blueBorder },
    { id: 'high_risk', label: '⚠️ High Risk', color: C.rose, bg: C.roseBg, border: C.roseBorder },
];

export const AdminUserDetails = ({ visible, user, navigation, onClose, onUpdate }) => {
    const insets = useSafeAreaInsets();

    // Data State
    const [wallet, setWallet] = React.useState(null);
    const [transactions, setTransactions] = React.useState([]);
    const [orders, setOrders] = React.useState([]);
    const [loadingData, setLoadingData] = React.useState(false);

    // Active Tab
    const [activeTab, setActiveTab] = React.useState('overview'); // 'overview' | 'wallet' | 'orders' | 'security'
    const [editMode, setEditMode] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    // Profile Fields
    const [fullName, setFullName] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [city, setCity] = React.useState('');
    const [state, setState] = React.useState('');
    const [adminNotes, setAdminNotes] = React.useState('');
    const [selectedTags, setSelectedTags] = React.useState([]);
    const [role, setRole] = React.useState('customer');
    const [isVerified, setIsVerified] = React.useState(false);
    const [isSuspended, setIsSuspended] = React.useState(false);
    const [isRestricted, setIsRestricted] = React.useState(false);

    // Security Field
    const [newPassword, setNewPassword] = React.useState('');

    // Wallet Adjust Modal
    const [adjustModal, setAdjustModal] = React.useState(false);
    const [adjustType, setAdjustType] = React.useState('credit'); // 'credit' | 'debit'
    const [adjustAmount, setAdjustAmount] = React.useState('');
    const [adjustReason, setAdjustReason] = React.useState('');
    const [adjusting, setAdjusting] = React.useState(false);

    React.useEffect(() => {
        if (visible && user) {
            setFullName(user.full_name || '');
            setPhone(user.phone || '');
            setAddress(user.address || '');
            setCity(user.city || '');
            setState(user.state || '');
            
            const rawNote = user.admin_note || user.admin_notes || '';
            setAdminNotes(rawNote);

            const tagMatch = rawNote.match(/\[TAGS:(.*?)\]/);
            if (tagMatch && tagMatch[1]) {
                const parsed = tagMatch[1].split(',').map(t => t.trim()).filter(Boolean);
                setSelectedTags(parsed);
            } else {
                setSelectedTags([]);
            }

            setRole(user.role || 'customer');
            setIsVerified(!!user.is_verified);
            setIsSuspended(!!(user.is_banned || user.suspended));
            setIsRestricted(!!user.is_restricted);
            setNewPassword('');
            fetchUserData();
        }
    }, [visible, user]);

    const fetchUserData = async () => {
        if (!user?.id) return;
        setLoadingData(true);
        try {
            const [walletRes, txRes, ordersRes] = await Promise.all([
                supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
                supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
                supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
            ]);

            setWallet(walletRes.data || { balance: 0, pending_balance: 0 });
            setTransactions(txRes.data || []);
            setOrders(ordersRes.data || []);
        } catch (e) {
            console.log("Error loading user profile:", e);
        } finally {
            setLoadingData(false);
        }
    };

    const totalSpent = React.useMemo(() => {
        return orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    }, [orders]);

    const copyText = (val, label) => {
        if (!val) return;
        if (Platform.OS === 'web') {
            navigator.clipboard.writeText(val);
        } else {
            Clipboard.setString(val);
        }
        Alert.alert('Copied', `${label} copied to clipboard.`);
    };

    const handleCopyDossier = () => {
        const text = [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `ABU MAFHAL USER PROFILE DOSSIER`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Name: ${user.full_name || 'N/A'}`,
            `Email: ${user.email || 'N/A'}`,
            `Phone: ${user.phone || 'N/A'}`,
            `Role: ${(role || 'customer').toUpperCase()}`,
            `Status: ${isSuspended ? 'SUSPENDED' : 'ACTIVE'}`,
            `KYC: ${isVerified ? 'VERIFIED' : 'PENDING'}`,
            `Wallet Balance: ${fmtAmt(wallet?.balance || 0)}`,
            `Total Spent: ${fmtAmt(totalSpent)}`,
            `Total Orders: ${orders.length}`,
            `Joined: ${user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB') : 'N/A'}`,
            `Tags: ${selectedTags.length > 0 ? selectedTags.join(', ') : 'None'}`,
            `Address: ${[address, city, state].filter(Boolean).join(', ') || 'N/A'}`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        ].join('\n');
        copyText(text, 'Full Profile Dossier');
    };

    const handleToggleTag = async (tagId) => {
        const nextTags = selectedTags.includes(tagId)
            ? selectedTags.filter(t => t !== tagId)
            : [...selectedTags, tagId];
        
        setSelectedTags(nextTags);
        const baseNote = adminNotes.replace(/\[TAGS:(.*?)\]/g, '').trim();
        const updatedNote = nextTags.length > 0 ? `${baseNote}\n[TAGS: ${nextTags.join(', ')}]`.trim() : baseNote;
        setAdminNotes(updatedNote);

        try {
            await supabase.from('profiles').update({ admin_note: updatedNote }).eq('id', user.id);
            if (onUpdate) onUpdate();
        } catch (e) {
            console.log("Tag update err:", e);
        }
    };

    const handleQuickCredit = async (amt = 1000) => {
        try {
            const current = wallet?.balance || 0;
            const nextBal = current + amt;
            if (!wallet) {
                await supabase.from('wallets').insert({ user_id: user.id, balance: amt, currency: 'NGN' });
            } else {
                await supabase.from('wallets').update({ balance: nextBal }).eq('user_id', user.id);
            }
            try {
                await supabase.from('wallet_transactions').insert({
                    user_id: user.id,
                    amount: amt,
                    type: 'admin_credit',
                    description: `Instant Credit +₦${amt.toLocaleString()}`,
                    status: 'completed'
                });
            } catch (e) {}

            setWallet(prev => ({ ...prev, balance: nextBal }));
            Alert.alert('Success', `Credited ${fmtAmt(amt)} to account.`);
            fetchUserData();
            if (onUpdate) onUpdate();
        } catch (err) {
            Alert.alert('Error', 'Quick credit failed.');
        }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const { error } = await supabase.from('profiles').update({
                full_name: fullName.trim(),
                phone: phone.trim(),
                address: address.trim(),
                city: city.trim(),
                state: state.trim(),
                admin_note: adminNotes.trim(),
                role: role
            }).eq('id', user.id);

            if (error) throw error;
            setEditMode(false);
            Alert.alert('Saved', 'Profile updated successfully.');
            if (onUpdate) onUpdate();
        } catch (e) {
            Alert.alert('Save Failed', e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleKYC = async () => {
        const nextVal = !isVerified;
        try {
            const { error } = await supabase.from('profiles').update({ is_verified: nextVal }).eq('id', user.id);
            if (error) throw error;
            setIsVerified(nextVal);
            Alert.alert('KYC Updated', nextVal ? 'Account marked Verified.' : 'KYC revoked.');
            if (onUpdate) onUpdate();
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    const handleToggleSuspend = async () => {
        const nextVal = !isSuspended;
        try {
            const { error } = await supabase.from('profiles').update({
                suspended: nextVal,
                is_banned: nextVal
            }).eq('id', user.id);
            if (error) throw error;
            setIsSuspended(nextVal);
            Alert.alert('Status Updated', nextVal ? 'Account has been suspended.' : 'Account restored to active.');
            if (onUpdate) onUpdate();
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    const handleExecuteAdjustment = async () => {
        const amt = parseFloat(adjustAmount);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid numeric amount.');
            return;
        }

        setAdjusting(true);
        try {
            const current = wallet?.balance || 0;
            const nextBal = adjustType === 'credit' ? current + amt : Math.max(0, current - amt);

            if (!wallet) {
                await supabase.from('wallets').insert({ user_id: user.id, balance: nextBal, currency: 'NGN' });
            } else {
                await supabase.from('wallets').update({ balance: nextBal }).eq('user_id', user.id);
            }

            try {
                await supabase.from('wallet_transactions').insert({
                    user_id: user.id,
                    amount: amt,
                    type: adjustType === 'credit' ? 'admin_credit' : 'admin_debit',
                    description: adjustReason.trim() || `Admin manual ${adjustType}`,
                    status: 'completed'
                });
            } catch (e) {}

            Alert.alert('Complete', `Wallet successfully ${adjustType}ed.`);
            setAdjustModal(false);
            setAdjustAmount('');
            setAdjustReason('');
            fetchUserData();
            if (onUpdate) onUpdate();
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setAdjusting(false);
        }
    };

    const handlePasswordOverride = async () => {
        if (!newPassword || newPassword.length < 6) {
            Alert.alert('Validation', 'Password must be at least 6 characters.');
            return;
        }
        try {
            const { error } = await supabase.rpc('admin_reset_password', {
                target_user_id: user.id,
                new_password: newPassword
            });
            if (error) throw error;
            Alert.alert('Success', 'Password has been overridden.');
            setNewPassword('');
        } catch (e) {
            Alert.alert('Notice', 'Direct RPC failed. Please dispatch reset email.');
        }
    };

    const handleEmailReset = async () => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email);
            if (error) throw error;
            Alert.alert('Email Dispatched', `Password reset link sent to ${user.email}.`);
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    const openWhatsApp = () => {
        if (!user.phone) {
            Alert.alert('No Phone', 'No telephone number found.');
            return;
        }
        const clean = user.phone.replace(/[^0-9]/g, '');
        Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(`Hello ${user.full_name || 'Valued Customer'}, greetings from Abu Mafhal Marketplace!`)}`);
    };

    if (!user) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={S.container}>

                {/* ── CLEAN TOP BAR ── */}
                <View style={S.topBar}>
                    <TouchableOpacity onPress={onClose} style={S.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={20} color={C.dark} />
                    </TouchableOpacity>

                    <Text style={S.topBarTitle}>User Details</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity onPress={handleCopyDossier} style={S.dossierBtn} title="Copy Dossier">
                            <Ionicons name="copy-outline" size={14} color={C.body} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => editMode ? handleSaveProfile() : setEditMode(true)}
                            disabled={saving}
                            style={[S.editBtn, editMode && S.editBtnActive]}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={[S.editBtnText, editMode && { color: '#FFFFFF' }]}>
                                    {editMode ? 'Save' : 'Edit'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── PROFILE HEADER & METRICS SUMMARY ── */}
                <View style={S.headerProfile}>
                    <View style={S.profileMainRow}>
                        <UserAvatar user={user} size={50} />

                        <View style={S.profileTextCol}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={S.profileName} numberOfLines={1}>{user.full_name || 'Anonymous User'}</Text>
                                {isVerified && (
                                    <Ionicons name="checkmark-circle" size={15} color={C.blue} />
                                )}
                            </View>

                            <View style={S.profileSubRow}>
                                <Text style={S.profileContact} numberOfLines={1}>{user.email || 'No email'}</Text>
                                {user.phone && <Text style={S.profileContact}>· {user.phone}</Text>}
                            </View>

                            <View style={S.badgesRow}>
                                <View style={[S.badgePill, { backgroundColor: C.borderLight }]}>
                                    <Text style={[S.badgeText, { color: C.body }]}>{(role || 'customer').toUpperCase()}</Text>
                                </View>
                                <View style={[S.badgePill, isSuspended ? { backgroundColor: C.roseBg } : { backgroundColor: C.emeraldBg }]}>
                                    <Text style={[S.badgeText, { color: isSuspended ? C.rose : C.emerald }]}>
                                        {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* 3 Balanced Metric Tiles */}
                    <View style={S.metricsRow}>
                        <View style={S.metricCard}>
                            <Text style={S.metricLabel}>Wallet Balance</Text>
                            <Text style={[S.metricValue, { color: C.emerald }]}>{fmtAmt(wallet?.balance || 0)}</Text>
                        </View>
                        <View style={S.metricCard}>
                            <Text style={S.metricLabel}>Total Spent</Text>
                            <Text style={S.metricValue}>{fmtAmt(totalSpent)}</Text>
                        </View>
                        <View style={S.metricCard}>
                            <Text style={S.metricLabel}>Total Orders</Text>
                            <Text style={S.metricValue}>{orders.length}</Text>
                        </View>
                    </View>

                    {/* 4 Clean Action Buttons */}
                    <View style={S.actionsRow}>
                        <TouchableOpacity onPress={() => { setAdjustType('credit'); setAdjustModal(true); }} style={[S.actionBtn, { backgroundColor: C.emeraldBg, borderColor: C.emeraldBorder }]}>
                            <Ionicons name="wallet-outline" size={14} color={C.emerald} />
                            <Text style={[S.actionBtnTxt, { color: C.emerald }]}>Fund</Text>
                        </TouchableOpacity>

                        {user.phone ? (
                            <TouchableOpacity onPress={openWhatsApp} style={[S.actionBtn, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                                <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                                <Text style={[S.actionBtnTxt, { color: '#16A34A' }]}>WhatsApp</Text>
                            </TouchableOpacity>
                        ) : null}

                        {user.phone ? (
                            <TouchableOpacity onPress={() => Linking.openURL(`tel:${user.phone}`)} style={S.actionBtn}>
                                <Ionicons name="call-outline" size={14} color={C.body} />
                                <Text style={S.actionBtnTxt}>Call</Text>
                            </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity onPress={handleToggleKYC} style={[S.actionBtn, isVerified && { backgroundColor: C.blueBg, borderColor: C.blueBorder }]}>
                            <Ionicons name="shield-checkmark-outline" size={14} color={isVerified ? C.blue : C.muted} />
                            <Text style={[S.actionBtnTxt, isVerified && { color: C.blue }]}>
                                {isVerified ? 'Verified' : 'Verify'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── CLEAN SEGMENTED TABS ── */}
                <View style={S.tabsBar}>
                    {[
                        { id: 'overview', label: 'Overview' },
                        { id: 'wallet', label: 'Wallet & Ledger' },
                        { id: 'orders', label: `Orders (${orders.length})` },
                        { id: 'security', label: 'Security' }
                    ].map(tab => {
                        const active = activeTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setActiveTab(tab.id)}
                                style={[S.tabItem, active && S.tabItemActive]}
                            >
                                <Text style={[S.tabItemText, active && S.tabItemTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── TAB CONTENT ── */}
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false}>

                        {/* ────────────── TAB 1: OVERVIEW ────────────── */}
                        {activeTab === 'overview' && (
                            <View style={{ gap: 12 }}>
                                
                                {/* Section 1: Customer Tags */}
                                <View style={S.card}>
                                    <Text style={S.cardTitle}>Customer Classification Tags</Text>
                                    <View style={S.tagsRow}>
                                        {PRESET_TAGS.map(t => {
                                            const active = selectedTags.includes(t.id);
                                            return (
                                                <TouchableOpacity
                                                    key={t.id}
                                                    onPress={() => handleToggleTag(t.id)}
                                                    style={[
                                                        S.tagPill,
                                                        active ? { backgroundColor: t.bg, borderColor: t.color } : { backgroundColor: '#F8FAFC', borderColor: C.border }
                                                    ]}
                                                >
                                                    <Text style={[S.tagPillText, active ? { color: t.color, fontWeight: '800' } : { color: C.muted }]}>
                                                        {t.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Section 2: Contact & Personal Details */}
                                <View style={S.card}>
                                    <Text style={S.cardTitle}>Contact & Location</Text>

                                    <View style={S.fieldRow}>
                                        <Text style={S.fieldLabel}>Full Legal Name</Text>
                                        <TextInput
                                            value={fullName}
                                            onChangeText={setFullName}
                                            editable={editMode}
                                            style={[S.textInput, !editMode && S.textInputDisabled]}
                                            placeholder="Full name"
                                            placeholderTextColor={C.subtle}
                                        />
                                    </View>

                                    <View style={S.fieldRow}>
                                        <Text style={S.fieldLabel}>Phone Number</Text>
                                        <TextInput
                                            value={phone}
                                            onChangeText={setPhone}
                                            editable={editMode}
                                            keyboardType="phone-pad"
                                            style={[S.textInput, !editMode && S.textInputDisabled]}
                                            placeholder="Phone number"
                                            placeholderTextColor={C.subtle}
                                        />
                                    </View>

                                    <View style={S.fieldRow}>
                                        <Text style={S.fieldLabel}>Street Address</Text>
                                        <TextInput
                                            value={address}
                                            onChangeText={setAddress}
                                            editable={editMode}
                                            style={[S.textInput, !editMode && S.textInputDisabled]}
                                            placeholder="Street address"
                                            placeholderTextColor={C.subtle}
                                        />
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={[S.fieldRow, { flex: 1 }]}>
                                            <Text style={S.fieldLabel}>City</Text>
                                            <TextInput
                                                value={city}
                                                onChangeText={setCity}
                                                editable={editMode}
                                                style={[S.textInput, !editMode && S.textInputDisabled]}
                                                placeholder="City"
                                                placeholderTextColor={C.subtle}
                                            />
                                        </View>
                                        <View style={[S.fieldRow, { flex: 1 }]}>
                                            <Text style={S.fieldLabel}>State</Text>
                                            <TextInput
                                                value={state}
                                                onChangeText={setState}
                                                editable={editMode}
                                                style={[S.textInput, !editMode && S.textInputDisabled]}
                                                placeholder="State"
                                                placeholderTextColor={C.subtle}
                                            />
                                        </View>
                                    </View>

                                    <View style={S.infoItem}>
                                        <Text style={S.infoItemLabel}>Registered Date</Text>
                                        <Text style={S.infoItemVal}>
                                            {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Section 3: Staff Notes */}
                                <View style={S.card}>
                                    <Text style={S.cardTitle}>Staff Observations & Notes</Text>
                                    <TextInput
                                        value={adminNotes}
                                        onChangeText={setAdminNotes}
                                        editable={editMode}
                                        multiline
                                        style={[S.textInput, { height: 70, textAlignVertical: 'top' }, !editMode && S.textInputDisabled]}
                                        placeholder="Add internal compliance notes…"
                                        placeholderTextColor={C.subtle}
                                    />
                                </View>
                            </View>
                        )}

                        {/* ────────────── TAB 2: WALLET & LEDGER ────────────── */}
                        {activeTab === 'wallet' && (
                            <View style={{ gap: 12 }}>
                                {/* Clean Balance Summary */}
                                <View style={S.card}>
                                    <Text style={S.cardTitle}>Wallet Balance</Text>
                                    <Text style={S.largeBalance}>{fmtAmt(wallet?.balance || 0)}</Text>
                                    <Text style={S.balanceSub}>
                                        Pending clearing: <Text style={{ fontWeight: '700', color: C.amber }}>{fmtAmt(wallet?.pending_balance || 0)}</Text>
                                    </Text>

                                    {/* 1-Tap Quick Credit Pills */}
                                    <View style={S.quickPillsRow}>
                                        {[1000, 2500, 5000, 10000].map(amt => (
                                            <TouchableOpacity
                                                key={amt}
                                                onPress={() => handleQuickCredit(amt)}
                                                style={S.quickPill}
                                            >
                                                <Text style={S.quickPillText}>+{fmtAmt(amt)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                        <TouchableOpacity
                                            onPress={() => { setAdjustType('credit'); setAdjustModal(true); }}
                                            style={[S.submitBtn, { backgroundColor: C.emerald }]}
                                        >
                                            <Text style={S.submitBtnText}>Credit Funds</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => { setAdjustType('debit'); setAdjustModal(true); }}
                                            style={[S.submitBtn, { backgroundColor: C.rose }]}
                                        >
                                            <Text style={S.submitBtnText}>Debit Funds</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Transaction Statement */}
                                <View style={S.card}>
                                    <Text style={S.cardTitle}>Recent Ledger Transactions ({transactions.length})</Text>

                                    {transactions.length === 0 ? (
                                        <View style={S.emptyState}>
                                            <Ionicons name="receipt-outline" size={28} color={C.subtle} />
                                            <Text style={S.emptyStateText}>No ledger transactions recorded.</Text>
                                        </View>
                                    ) : (
                                        transactions.map(tx => {
                                            const isCredit = tx.type?.includes('credit') || tx.type === 'deposit';
                                            return (
                                                <View key={tx.id} style={S.txItem}>
                                                    <View style={[S.txIconBox, { backgroundColor: isCredit ? C.emeraldBg : C.roseBg }]}>
                                                        <Ionicons
                                                            name={isCredit ? "arrow-down" : "arrow-up"}
                                                            size={12}
                                                            color={isCredit ? C.emerald : C.rose}
                                                        />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={S.txDesc} numberOfLines={1}>{tx.description || (isCredit ? 'Credit' : 'Debit')}</Text>
                                                        <Text style={S.txDate}>
                                                            {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                                        </Text>
                                                    </View>
                                                    <Text style={[S.txAmount, { color: isCredit ? C.emerald : C.rose }]}>
                                                        {isCredit ? '+' : '-'}{fmtAmt(tx.amount || 0)}
                                                    </Text>
                                                </View>
                                            );
                                        })
                                    )}
                                </View>
                            </View>
                        )}

                        {/* ────────────── TAB 3: ORDERS ────────────── */}
                        {activeTab === 'orders' && (
                            <View style={{ gap: 10 }}>
                                {orders.length === 0 ? (
                                    <View style={[S.card, S.emptyState]}>
                                        <Ionicons name="cart-outline" size={32} color={C.subtle} />
                                        <Text style={S.emptyStateText}>No orders recorded for this user.</Text>
                                    </View>
                                ) : (
                                    orders.map(o => (
                                        <View key={o.id} style={S.orderCard}>
                                            <View style={S.orderTop}>
                                                <Text style={S.orderId}>Order #{o.id.toString().slice(0, 8)}</Text>
                                                <View style={[S.badgePill, {
                                                    backgroundColor: o.status === 'delivered' ? C.emeraldBg : C.amberBg,
                                                    borderColor: o.status === 'delivered' ? C.emeraldBorder : C.amberBorder
                                                }]}>
                                                    <Text style={[S.badgeText, { color: o.status === 'delivered' ? C.emerald : C.amber }]}>
                                                        {(o.status || 'PENDING').toUpperCase()}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={S.orderBottom}>
                                                <Text style={S.orderDate}>
                                                    {o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
                                                </Text>
                                                <Text style={S.orderTotal}>{fmtAmt(o.total_amount || 0)}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        )}

                        {/* ────────────── TAB 4: SECURITY ────────────── */}
                        {activeTab === 'security' && (
                            <View style={{ gap: 12 }}>
                                <View style={S.card}>
                                    <Text style={S.cardTitle}>Account Security & Controls</Text>

                                    <View style={S.switchRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={S.switchTitle}>Suspend Account</Text>
                                            <Text style={S.switchSubtitle}>Block user from logging in</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={handleToggleSuspend}
                                            style={[S.toggleBtn, isSuspended ? { backgroundColor: C.rose } : { backgroundColor: C.border }]}
                                        >
                                            <Text style={[S.toggleBtnTxt, isSuspended && { color: '#FFFFFF' }]}>
                                                {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={S.divider} />

                                    <View style={S.switchRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={S.switchTitle}>Restrict Purchases</Text>
                                            <Text style={S.switchSubtitle}>Disable checkout for this user</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setIsRestricted(!isRestricted)}
                                            style={[S.toggleBtn, isRestricted ? { backgroundColor: C.amber } : { backgroundColor: C.border }]}
                                        >
                                            <Text style={[S.toggleBtnTxt, isRestricted && { color: '#FFFFFF' }]}>
                                                {isRestricted ? 'RESTRICTED' : 'ALLOWED'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={S.card}>
                                    <Text style={S.cardTitle}>Manual Password Override</Text>
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                        <TextInput
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry
                                            placeholder="New password (min 6 chars)"
                                            placeholderTextColor={C.subtle}
                                            style={[S.textInput, { flex: 1 }]}
                                        />
                                        <TouchableOpacity
                                            onPress={handlePasswordOverride}
                                            disabled={!newPassword}
                                            style={[S.editBtn, { backgroundColor: newPassword ? C.dark : C.border, paddingHorizontal: 12 }]}
                                        >
                                            <Text style={[S.editBtnText, { color: newPassword ? '#FFFFFF' : C.subtle }]}>Override</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={S.divider} />

                                    <TouchableOpacity onPress={handleEmailReset} style={S.resetLinkBtn}>
                                        <Ionicons name="mail-outline" size={14} color={C.blue} style={{ marginRight: 6 }} />
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: C.blue }}>
                                            Send Password Reset Email
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={{ height: 32 }} />
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* ── CUSTOM WALLET MODAL ── */}
                <Modal visible={adjustModal} transparent animationType="fade" onRequestClose={() => setAdjustModal(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalOverlay}>
                        <View style={S.modalCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={S.modalTitle}>
                                    {adjustType === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
                                </Text>
                                <TouchableOpacity onPress={() => setAdjustModal(false)}>
                                    <Ionicons name="close" size={18} color={C.muted} />
                                </TouchableOpacity>
                            </View>

                            <TextInput
                                placeholder="Amount in Naira (₦)"
                                placeholderTextColor={C.subtle}
                                keyboardType="numeric"
                                value={adjustAmount}
                                onChangeText={setAdjustAmount}
                                style={S.textInput}
                                autoFocus
                            />

                            <TextInput
                                placeholder="Reason / Description"
                                placeholderTextColor={C.subtle}
                                value={adjustReason}
                                onChangeText={setAdjustReason}
                                style={[S.textInput, { marginTop: 8 }]}
                            />

                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                                <TouchableOpacity onPress={() => setAdjustModal(false)} style={S.cancelBtn}>
                                    <Text style={S.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleExecuteAdjustment}
                                    disabled={adjusting}
                                    style={[S.confirmBtn, { backgroundColor: adjustType === 'credit' ? C.emerald : C.rose }]}
                                >
                                    {adjusting ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <Text style={S.confirmBtnText}>Confirm {adjustType === 'credit' ? 'Credit' : 'Debit'}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

            </View>
        </Modal>
    );
};

// ─── Crisp, Structured Stylesheet ───────────────────────────────────────────
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.canvas,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: C.cardBg,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
    },
    topBarTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: C.dark,
    },
    dossierBtn: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
    },
    editBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
    },
    editBtnActive: {
        backgroundColor: C.emerald,
        borderColor: C.emerald,
    },
    editBtnText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: C.dark,
    },

    // Header Profile Summary
    headerProfile: {
        backgroundColor: C.cardBg,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    profileMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    profileTextCol: {
        flex: 1,
        minWidth: 0,
    },
    profileName: {
        fontSize: 16,
        fontWeight: '900',
        color: C.dark,
    },
    profileSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    profileContact: {
        fontSize: 11,
        color: C.muted,
        fontWeight: '500',
    },
    badgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    badgePill: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '900',
    },

    // Metrics Row
    metricsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    metricCard: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
    },
    metricLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: C.muted,
        textTransform: 'uppercase',
    },
    metricValue: {
        fontSize: 13,
        fontWeight: '900',
        color: C.dark,
        marginTop: 2,
    },

    // Actions Row
    actionsRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 10,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
    },
    actionBtnTxt: {
        fontSize: 10.5,
        fontWeight: '800',
        color: C.body,
    },

    // Tabs Bar
    tabsBar: {
        flexDirection: 'row',
        backgroundColor: C.cardBg,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    tabItem: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabItemActive: {
        borderBottomColor: C.dark,
    },
    tabItemText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.muted,
    },
    tabItemTextActive: {
        color: C.dark,
        fontWeight: '900',
    },

    // Scroll & Cards
    scrollContent: {
        padding: 12,
    },
    card: {
        backgroundColor: C.cardBg,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: C.border,
    },
    cardTitle: {
        fontSize: 11.5,
        fontWeight: '900',
        color: C.dark,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        marginBottom: 10,
    },

    // Tags
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    tagPill: {
        paddingHorizontal: 9,
        paddingVertical: 4.5,
        borderRadius: 7,
        borderWidth: 1,
    },
    tagPillText: {
        fontSize: 10.5,
    },

    // Fields
    fieldRow: {
        marginBottom: 8,
    },
    fieldLabel: {
        fontSize: 9.5,
        fontWeight: '700',
        color: C.muted,
        textTransform: 'uppercase',
        marginBottom: 3,
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        fontSize: 12,
        color: C.dark,
    },
    textInputDisabled: {
        backgroundColor: '#F8FAFC',
        color: C.body,
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 6,
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: C.borderLight,
    },
    infoItemLabel: {
        fontSize: 10.5,
        fontWeight: '600',
        color: C.muted,
    },
    infoItemVal: {
        fontSize: 11,
        fontWeight: '800',
        color: C.dark,
    },

    // Wallet Section
    largeBalance: {
        fontSize: 26,
        fontWeight: '900',
        color: C.emerald,
        letterSpacing: -0.5,
    },
    balanceSub: {
        fontSize: 11,
        color: C.muted,
        marginTop: 2,
    },
    quickPillsRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 12,
    },
    quickPill: {
        flex: 1,
        paddingVertical: 6,
        borderRadius: 7,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
    },
    quickPillText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: C.dark,
    },
    submitBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitBtnText: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },

    // Tx Item
    txItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: C.borderLight,
        gap: 8,
    },
    txIconBox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txDesc: {
        fontSize: 11.5,
        fontWeight: '700',
        color: C.dark,
    },
    txDate: {
        fontSize: 9.5,
        color: C.muted,
    },
    txAmount: {
        fontSize: 12,
        fontWeight: '900',
    },

    // Orders
    orderCard: {
        backgroundColor: C.cardBg,
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border,
    },
    orderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderId: {
        fontSize: 12,
        fontWeight: '800',
        color: C.dark,
    },
    orderBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    orderDate: {
        fontSize: 10.5,
        color: C.muted,
    },
    orderTotal: {
        fontSize: 12.5,
        fontWeight: '900',
        color: C.dark,
    },

    // Security Controls
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    switchTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: C.dark,
    },
    switchSubtitle: {
        fontSize: 10.5,
        color: C.muted,
    },
    toggleBtn: {
        paddingHorizontal: 9,
        paddingVertical: 4.5,
        borderRadius: 6,
    },
    toggleBtnTxt: {
        fontSize: 9.5,
        fontWeight: '900',
        color: C.body,
    },
    divider: {
        height: 1,
        backgroundColor: C.borderLight,
        marginVertical: 10,
    },
    resetLinkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 7,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    emptyStateText: {
        fontSize: 11.5,
        color: C.muted,
        marginTop: 6,
        fontWeight: '600',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        width: '100%',
        maxWidth: 340,
        borderWidth: 1,
        borderColor: C.border,
    },
    modalTitle: {
        fontSize: 13.5,
        fontWeight: '900',
        color: C.dark,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: C.body,
    },
    confirmBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    confirmBtnText: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
});
