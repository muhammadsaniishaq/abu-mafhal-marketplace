import * as React from 'react';
import {
    View, Text, Modal, TouchableOpacity, ScrollView, TextInput,
    ActivityIndicator, Alert, StyleSheet, Linking, KeyboardAvoidingView,
    Platform, Dimensions, Pressable, Clipboard
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../components/UserAvatar';

const { width } = Dimensions.get('window');

// ─── Warm Luxury Palette ───────────────────────────────────────────────────
const W = {
    canvas: '#F5F2EB',          // Warm alabaster cream canvas
    canvasAlt: '#EFEAE1',
    cardBg: '#FFFFFF',          // Crisp warm porcelain card
    cardBorder: '#E6E0D5',      // Warm champagne stone border
    gold: '#B45309',            // Rich metallic bronze-gold
    goldLight: '#D97706',
    goldBg: '#FEF3C7',
    goldBorder: '#FDE68A',
    emerald: '#047857',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    crimson: '#BE123C',
    crimsonBg: '#FFF1F2',
    crimsonBorder: '#FECDD3',
    sky: '#0284C7',
    skyBg: '#F0F9FF',
    skyBorder: '#BAE6FD',
    purple: '#6D28D9',
    purpleBg: '#F5F3FF',
    purpleBorder: '#DDD6FE',
    charcoal: '#0F172A',        // Deep luxury typography
    textBody: '#334155',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
};

// ─── Amount Formatter ───────────────────────────────────────────────────────
const fmtAmt = (val) => {
    if (!val || isNaN(val)) return '₦0';
    const num = Number(val);
    if (num >= 1e6) return `₦${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `₦${(num / 1e3).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`;
    return `₦${num.toLocaleString('en-US')}`;
};

const TIERS = [
    { min: 1000000, label: '💎 Diamond VIP', color: W.purple, bg: W.purpleBg, border: W.purpleBorder },
    { min: 250000, label: '🥇 Gold Elite', color: W.gold, bg: W.goldBg, border: W.goldBorder },
    { min: 50000, label: '🥈 Silver Member', color: '#475569', bg: '#F1F5F9', border: '#E2E8F0' },
    { min: 0, label: '🥉 Starter', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
];
const getTier = (spend = 0) => TIERS.find(t => spend >= t.min) || TIERS[3];

export const AdminUserDetails = ({ visible, user, navigation, onClose, onUpdate }) => {
    const insets = useSafeAreaInsets();

    // Data State
    const [wallet, setWallet] = React.useState(null);
    const [transactions, setTransactions] = React.useState([]);
    const [orders, setOrders] = React.useState([]);
    const [driverInfo, setDriverInfo] = React.useState(null);
    const [loadingData, setLoadingData] = React.useState(false);

    // Navigation Tab
    const [activeTab, setActiveTab] = React.useState('overview'); // 'overview' | 'wallet' | 'orders' | 'security'
    const [editMode, setEditMode] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    // Form fields
    const [fullName, setFullName] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [city, setCity] = React.useState('');
    const [state, setState] = React.useState('');
    const [adminNotes, setAdminNotes] = React.useState('');
    const [role, setRole] = React.useState('customer');
    const [isVerified, setIsVerified] = React.useState(false);
    const [isSuspended, setIsSuspended] = React.useState(false);
    const [isRestricted, setIsRestricted] = React.useState(false);

    // Security
    const [newPassword, setNewPassword] = React.useState('');

    // Custom Transaction Modal
    const [transactVisible, setTransactVisible] = React.useState(false);
    const [transactType, setTransactType] = React.useState('credit');
    const [transacting, setTransacting] = React.useState(false);
    const [transactAmount, setTransactAmount] = React.useState('');
    const [transactReason, setTransactReason] = React.useState('');

    React.useEffect(() => {
        if (visible && user) {
            setFullName(user.full_name || '');
            setPhone(user.phone || '');
            setAddress(user.address || '');
            setCity(user.city || '');
            setState(user.state || '');
            setAdminNotes(user.admin_note || user.admin_notes || '');
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
                supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(25),
                supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(25)
            ]);

            setWallet(walletRes.data || { balance: 0, pending_balance: 0 });
            setTransactions(txRes.data || []);
            setOrders(ordersRes.data || []);

            if (user.role === 'driver') {
                const { data: dData } = await supabase.from('drivers').select('*').eq('user_id', user.id).maybeSingle();
                setDriverInfo(dData || null);
            }
        } catch (e) {
            console.log("Error loading user profile:", e);
        } finally {
            setLoadingData(false);
        }
    };

    // Lifetime Analytics
    const totalSpent = React.useMemo(() => {
        return orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    }, [orders]);
    const avgOrderVal = orders.length > 0 ? (totalSpent / orders.length) : 0;
    const tier = getTier(totalSpent);

    // Copy to clipboard helper
    const copyText = (val, label) => {
        if (!val) return;
        if (Platform.OS === 'web') {
            navigator.clipboard.writeText(val);
        } else {
            Clipboard.setString(val);
        }
        Alert.alert('Copied', `${label} copied to clipboard.`);
    };

    // Instant Quick Credit (+₦1,000 / +₦5,000)
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
                    description: `Admin Instant Quick +₦${amt.toLocaleString()}`,
                    status: 'completed'
                });
            } catch (e) {}

            setWallet(prev => ({ ...prev, balance: nextBal }));
            Alert.alert('Wallet Credited', `Successfully added ${fmtAmt(amt)} to ${user.full_name || 'user'}'s account.`);
            fetchUserData();
            if (onUpdate) onUpdate();
        } catch (err) {
            Alert.alert('Error', 'Quick credit failed.');
        }
    };

    // Toggle KYC Verification
    const handleToggleKYC = async () => {
        const nextVal = !isVerified;
        try {
            const { error } = await supabase.from('profiles').update({ is_verified: nextVal }).eq('id', user.id);
            if (error) throw error;
            setIsVerified(nextVal);
            Alert.alert('KYC Updated', nextVal ? 'Account has been marked KYC Verified.' : 'KYC verification has been revoked.');
            if (onUpdate) onUpdate();
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    // Toggle Suspension
    const handleToggleSuspend = async () => {
        const nextVal = !isSuspended;
        try {
            const { error } = await supabase.from('profiles').update({
                suspended: nextVal,
                is_banned: nextVal
            }).eq('id', user.id);
            if (error) throw error;
            setIsSuspended(nextVal);
            Alert.alert('Status Updated', nextVal ? 'Account access suspended.' : 'Account restored to active status.');
            if (onUpdate) onUpdate();
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    // Toggle Restricted Purchases
    const handleToggleRestricted = async () => {
        const nextVal = !isRestricted;
        try {
            const { error } = await supabase.from('profiles').update({ is_restricted: nextVal }).eq('id', user.id);
            if (error) throw error;
            setIsRestricted(nextVal);
            Alert.alert('Restriction Updated', nextVal ? 'User ordering is now restricted.' : 'Ordering restrictions removed.');
            if (onUpdate) onUpdate();
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    // Execute Custom Wallet Transaction
    const handleCustomTransact = async () => {
        const amt = parseFloat(transactAmount);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid numeric amount.');
            return;
        }

        setTransacting(true);
        try {
            const current = wallet?.balance || 0;
            const nextBal = transactType === 'credit' ? current + amt : Math.max(0, current - amt);

            if (!wallet) {
                await supabase.from('wallets').insert({ user_id: user.id, balance: nextBal, currency: 'NGN' });
            } else {
                await supabase.from('wallets').update({ balance: nextBal }).eq('user_id', user.id);
            }

            try {
                await supabase.from('wallet_transactions').insert({
                    user_id: user.id,
                    amount: amt,
                    type: transactType === 'credit' ? 'admin_credit' : 'admin_debit',
                    description: transactReason.trim() || `Admin manual ${transactType}`,
                    status: 'completed'
                });
            } catch (e) {}

            Alert.alert('Transaction Complete', `Wallet successfully ${transactType}ed with ${fmtAmt(amt)}.`);
            setTransactVisible(false);
            setTransactAmount('');
            setTransactReason('');
            fetchUserData();
            if (onUpdate) onUpdate();
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setTransacting(false);
        }
    };

    // Save Profile edits
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
            Alert.alert('Saved', 'Profile information updated successfully.');
            if (onUpdate) onUpdate();
        } catch (e) {
            Alert.alert('Save Failed', e.message);
        } finally {
            setSaving(false);
        }
    };

    // Direct Password Override
    const handleManualPasswordReset = async () => {
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
            Alert.alert('Success', 'New password is now in effect.');
            setNewPassword('');
        } catch (e) {
            Alert.alert('Override Notice', 'Direct RPC failed. Please use Send Reset Email for standard authentication.');
        }
    };

    const handleEmailReset = async () => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email);
            if (error) throw error;
            Alert.alert('Email Dispatched', `Password recovery link sent to ${user.email}.`);
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    // WhatsApp Templates
    const sendWhatsApp = (msg) => {
        if (!user.phone) {
            Alert.alert('No Phone', 'This account has no phone number recorded.');
            return;
        }
        const clean = user.phone.replace(/[^0-9]/g, '');
        Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`);
    };

    if (!user) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={S.container}>
                {/* ── TOP EXECUTIVE APP BAR ── */}
                <View style={S.topBar}>
                    <TouchableOpacity onPress={onClose} style={S.iconCircleBtn}>
                        <Ionicons name="close" size={20} color={W.charcoal} />
                    </TouchableOpacity>

                    <View style={S.topBarCenter}>
                        <View style={[S.badge, { backgroundColor: W.goldBg, borderColor: W.goldBorder }]}>
                            <Text style={[S.badgeTxt, { color: W.gold }]}>{(role || 'customer').toUpperCase()}</Text>
                        </View>
                        {isVerified && (
                            <View style={[S.badge, { backgroundColor: W.skyBg, borderColor: W.skyBorder, marginLeft: 6 }]}>
                                <Ionicons name="checkmark-circle" size={11} color={W.sky} style={{ marginRight: 2 }} />
                                <Text style={[S.badgeTxt, { color: W.sky }]}>KYC VERIFIED</Text>
                            </View>
                        )}
                        {isSuspended && (
                            <View style={[S.badge, { backgroundColor: W.crimsonBg, borderColor: W.crimsonBorder, marginLeft: 6 }]}>
                                <Text style={[S.badgeTxt, { color: W.crimson }]}>SUSPENDED</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={() => editMode ? handleSaveProfile() : setEditMode(true)}
                        disabled={saving}
                        style={[S.editSaveBtn, editMode && { backgroundColor: W.emerald, borderColor: W.emerald }]}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name={editMode ? "checkmark" : "create-outline"} size={14} color={editMode ? "#FFFFFF" : W.charcoal} />
                                <Text style={[S.editSaveBtnText, editMode && { color: '#FFFFFF' }]}>
                                    {editMode ? "Save" : "Edit"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ── EXECUTIVE PROFILE HERO CARD ── */}
                <View style={S.heroCard}>
                    <View style={S.heroTopRow}>
                        <View style={S.avatarWrap}>
                            <UserAvatar user={user} size={46} />
                            {isVerified && (
                                <View style={S.verifyBadge}>
                                    <Ionicons name="checkmark-circle" size={16} color={W.sky} />
                                </View>
                            )}
                        </View>

                        <View style={S.heroDetails}>
                            <Text style={S.heroName} numberOfLines={1}>{user.full_name || 'Anonymous User'}</Text>
                            <View style={S.contactRow}>
                                <Text style={S.heroContactTxt} numberOfLines={1}>{user.email || 'No email'}</Text>
                                {user.email && (
                                    <TouchableOpacity onPress={() => copyText(user.email, 'Email')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                                        <Ionicons name="copy-outline" size={12} color={W.textSubtle} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            {user.phone && (
                                <View style={[S.contactRow, { marginTop: 1 }]}>
                                    <Text style={S.heroContactTxt}>{user.phone}</Text>
                                    <TouchableOpacity onPress={() => copyText(user.phone, 'Phone')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                                        <Ionicons name="copy-outline" size={12} color={W.textSubtle} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* 4-KPI Financial & Vital Summary Ribbon */}
                    <View style={S.kpiRibbon}>
                        <View style={S.kpiTile}>
                            <Text style={S.kpiLabel}>Wallet Float</Text>
                            <Text style={[S.kpiVal, { color: W.emerald }]}>{fmtAmt(wallet?.balance || 0)}</Text>
                        </View>
                        <View style={S.kpiDivider} />
                        <View style={S.kpiTile}>
                            <Text style={S.kpiLabel}>Total Orders</Text>
                            <Text style={S.kpiVal}>{orders.length}</Text>
                        </View>
                        <View style={S.kpiDivider} />
                        <View style={S.kpiTile}>
                            <Text style={S.kpiLabel}>Lifetime Value</Text>
                            <Text style={[S.kpiVal, { color: W.gold }]}>{fmtAmt(totalSpent)}</Text>
                        </View>
                        <View style={S.kpiDivider} />
                        <View style={S.kpiTile}>
                            <Text style={S.kpiLabel}>Tier Status</Text>
                            <Text style={[S.kpiVal, { fontSize: 11 }]}>{tier.label}</Text>
                        </View>
                    </View>

                    {/* 1-Tap Action Shortcuts Toolbar */}
                    <View style={S.shortcutsBar}>
                        {user.phone ? (
                            <TouchableOpacity onPress={() => Linking.openURL(`tel:${user.phone}`)} style={S.shortcutBtn}>
                                <Ionicons name="call" size={13} color={W.charcoal} />
                                <Text style={S.shortcutBtnTxt}>Call</Text>
                            </TouchableOpacity>
                        ) : null}

                        {user.phone ? (
                            <TouchableOpacity
                                onPress={() => sendWhatsApp(`Hello ${user.full_name || 'Valued Customer'}, greetings from Abu Mafhal Marketplace!`)}
                                style={[S.shortcutBtn, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]}
                            >
                                <Ionicons name="logo-whatsapp" size={13} color="#16A34A" />
                                <Text style={[S.shortcutBtnTxt, { color: '#16A34A' }]}>WhatsApp</Text>
                            </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity onPress={() => handleQuickCredit(1000)} style={[S.shortcutBtn, { backgroundColor: W.emeraldBg, borderColor: W.emeraldBorder }]}>
                            <Ionicons name="flash" size={13} color={W.emerald} />
                            <Text style={[S.shortcutBtnTxt, { color: W.emerald }]}>+₦1K</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => handleQuickCredit(5000)} style={[S.shortcutBtn, { backgroundColor: W.emeraldBg, borderColor: W.emeraldBorder }]}>
                            <Ionicons name="flash" size={13} color={W.emerald} />
                            <Text style={[S.shortcutBtnTxt, { color: W.emerald }]}>+₦5K</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleToggleKYC} style={[S.shortcutBtn, isVerified && { backgroundColor: W.skyBg, borderColor: W.skyBorder }]}>
                            <Ionicons name="shield-checkmark" size={13} color={isVerified ? W.sky : W.textMuted} />
                            <Text style={[S.shortcutBtnTxt, isVerified && { color: W.sky }]}>
                                {isVerified ? 'KYC ✓' : 'Verify'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── MODERN SEGMENTED TABS ── */}
                <View style={S.tabsContainer}>
                    {[
                        { id: 'overview', label: 'Overview', icon: 'grid-outline' },
                        { id: 'wallet', label: 'Wallet & Ledger', icon: 'wallet-outline' },
                        { id: 'orders', label: `Orders (${orders.length})`, icon: 'cart-outline' },
                        { id: 'security', label: 'Security & Access', icon: 'shield-outline' }
                    ].map(t => {
                        const active = activeTab === t.id;
                        return (
                            <TouchableOpacity
                                key={t.id}
                                onPress={() => setActiveTab(t.id)}
                                style={[S.tabItem, active && S.tabItemActive]}
                            >
                                <Ionicons name={t.icon} size={14} color={active ? W.charcoal : W.textMuted} style={{ marginRight: 4 }} />
                                <Text style={[S.tabItemText, active && S.tabItemTextActive]}>
                                    {t.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── SCROLLABLE TAB CONTENT ── */}
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false}>

                        {/* ────────────── TAB 1: OVERVIEW ────────────── */}
                        {activeTab === 'overview' && (
                            <View style={{ gap: 12 }}>
                                {/* Account Lifecycle & Metrics */}
                                <View style={S.card}>
                                    <View style={S.cardHeader}>
                                        <Ionicons name="analytics" size={15} color={W.charcoal} />
                                        <Text style={S.cardTitle}>Account Lifecycle & Commercial Metrics</Text>
                                    </View>
                                    <View style={S.gridRow}>
                                        <View style={S.gridCell}>
                                            <Text style={S.gridCellLbl}>Registration Date</Text>
                                            <Text style={S.gridCellVal}>
                                                {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={S.gridCell}>
                                            <Text style={S.gridCellLbl}>Average Order Value</Text>
                                            <Text style={S.gridCellVal}>{fmtAmt(avgOrderVal)}</Text>
                                        </View>
                                    </View>
                                    <View style={[S.gridRow, { marginTop: 8 }]}>
                                        <View style={S.gridCell}>
                                            <Text style={S.gridCellLbl}>User Unique ID</Text>
                                            <Text style={[S.gridCellVal, { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]} numberOfLines={1}>
                                                {user.id}
                                            </Text>
                                        </View>
                                        <View style={S.gridCell}>
                                            <Text style={S.gridCellLbl}>Assigned Tier</Text>
                                            <Text style={[S.gridCellVal, { color: tier.color }]}>{tier.label}</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* WhatsApp Communication Presets */}
                                {user.phone ? (
                                    <View style={S.card}>
                                        <View style={S.cardHeader}>
                                            <Ionicons name="logo-whatsapp" size={15} color="#16A34A" />
                                            <Text style={[S.cardTitle, { color: '#16A34A' }]}>One-Tap WhatsApp Business Presets</Text>
                                        </View>
                                        <View style={{ gap: 6 }}>
                                            {[
                                                { title: '👋 Welcome & Onboarding', msg: `Hello ${user.full_name || 'Valued Customer'}, welcome to Abu Mafhal Marketplace! Your account is active and verified. Let us know if you need assistance shopping!` },
                                                { title: '✅ KYC Verification Approved', msg: `Congratulations ${user.full_name || ''}! Your marketplace account and identification documents have been approved successfully.` },
                                                { title: '💰 Wallet Funding Receipt', msg: `Hello ${user.full_name || ''}, your marketplace wallet float has just been successfully updated. You can view your balance anytime.` },
                                                { title: '📦 Order Delivery Support', msg: `Hello ${user.full_name || ''}, our customer experience desk is checking in regarding your recent orders. Can we assist you today?` },
                                            ].map((tpl, i) => (
                                                <TouchableOpacity
                                                    key={i}
                                                    onPress={() => sendWhatsApp(tpl.msg)}
                                                    style={S.presetTmplBtn}
                                                >
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={S.presetTmplTitle}>{tpl.title}</Text>
                                                        <Text style={S.presetTmplSnippet} numberOfLines={1}>{tpl.msg}</Text>
                                                    </View>
                                                    <Ionicons name="send" size={13} color="#16A34A" style={{ marginLeft: 6 }} />
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                ) : null}

                                {/* Personal Profile & Address */}
                                <View style={S.card}>
                                    <View style={S.cardHeader}>
                                        <Ionicons name="person-circle" size={15} color={W.charcoal} />
                                        <Text style={S.cardTitle}>Identity & Delivery Information</Text>
                                    </View>

                                    <View style={S.fieldBox}>
                                        <Text style={S.fieldLabel}>Full Legal Name</Text>
                                        <TextInput
                                            value={fullName}
                                            onChangeText={setFullName}
                                            editable={editMode}
                                            style={[S.fieldInput, !editMode && S.fieldInputDisabled]}
                                            placeholder="User's full name"
                                            placeholderTextColor={W.textSubtle}
                                        />
                                    </View>

                                    <View style={S.fieldBox}>
                                        <Text style={S.fieldLabel}>Contact Telephone</Text>
                                        <TextInput
                                            value={phone}
                                            onChangeText={setPhone}
                                            editable={editMode}
                                            style={[S.fieldInput, !editMode && S.fieldInputDisabled]}
                                            keyboardType="phone-pad"
                                            placeholder="Phone number"
                                            placeholderTextColor={W.textSubtle}
                                        />
                                    </View>

                                    <View style={S.fieldBox}>
                                        <Text style={S.fieldLabel}>Street Address</Text>
                                        <TextInput
                                            value={address}
                                            onChangeText={setAddress}
                                            editable={editMode}
                                            style={[S.fieldInput, !editMode && S.fieldInputDisabled]}
                                            placeholder="Street address or delivery location"
                                            placeholderTextColor={W.textSubtle}
                                        />
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={[S.fieldBox, { flex: 1 }]}>
                                            <Text style={S.fieldLabel}>City</Text>
                                            <TextInput
                                                value={city}
                                                onChangeText={setCity}
                                                editable={editMode}
                                                style={[S.fieldInput, !editMode && S.fieldInputDisabled]}
                                                placeholder="City"
                                                placeholderTextColor={W.textSubtle}
                                            />
                                        </View>
                                        <View style={[S.fieldBox, { flex: 1 }]}>
                                            <Text style={S.fieldLabel}>State</Text>
                                            <TextInput
                                                value={state}
                                                onChangeText={setState}
                                                editable={editMode}
                                                style={[S.fieldInput, !editMode && S.fieldInputDisabled]}
                                                placeholder="State"
                                                placeholderTextColor={W.textSubtle}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Admin Private Memo */}
                                <View style={S.card}>
                                    <View style={S.cardHeader}>
                                        <Ionicons name="document-text" size={15} color={W.gold} />
                                        <Text style={[S.cardTitle, { color: W.gold }]}>Internal Staff Observation Memo</Text>
                                    </View>
                                    <TextInput
                                        value={adminNotes}
                                        onChangeText={setAdminNotes}
                                        editable={editMode}
                                        multiline
                                        style={[S.fieldInput, { height: 70, textAlignVertical: 'top' }, !editMode && S.fieldInputDisabled]}
                                        placeholder="Add private staff records or compliance notes…"
                                        placeholderTextColor={W.textSubtle}
                                    />
                                </View>
                            </View>
                        )}

                        {/* ────────────── TAB 2: WALLET & LEDGER ────────────── */}
                        {activeTab === 'wallet' && (
                            <View style={{ gap: 12 }}>
                                {/* Float Balance Card */}
                                <View style={S.card}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <Text style={S.cardTitle}>Marketplace Float Balance</Text>
                                        <View style={[S.badge, { backgroundColor: W.emeraldBg, borderColor: W.emeraldBorder }]}>
                                            <Text style={[S.badgeTxt, { color: W.emerald }]}>LIVE LEDGER</Text>
                                        </View>
                                    </View>

                                    <Text style={S.walletBalanceNum}>{fmtAmt(wallet?.balance || 0)}</Text>
                                    <Text style={{ fontSize: 11, color: W.textMuted, marginTop: 2 }}>
                                        Pending clearing: <Text style={{ color: W.gold, fontWeight: '700' }}>{fmtAmt(wallet?.pending_balance || 0)}</Text>
                                    </Text>

                                    {/* Action Buttons */}
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                        <TouchableOpacity
                                            onPress={() => { setTransactType('credit'); setTransactVisible(true); }}
                                            style={[S.transactBtn, { backgroundColor: W.emerald }]}
                                        >
                                            <Ionicons name="add-circle" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                                            <Text style={S.transactBtnText}>Credit Funds</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => { setTransactType('debit'); setTransactVisible(true); }}
                                            style={[S.transactBtn, { backgroundColor: W.crimson }]}
                                        >
                                            <Ionicons name="remove-circle" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                                            <Text style={S.transactBtnText}>Debit Funds</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Recent Wallet Transactions History Statement */}
                                <View style={S.card}>
                                    <View style={S.cardHeader}>
                                        <Ionicons name="receipt" size={15} color={W.charcoal} />
                                        <Text style={S.cardTitle}>Recent Ledger Transactions ({transactions.length})</Text>
                                    </View>

                                    {transactions.length === 0 ? (
                                        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                            <Ionicons name="receipt-outline" size={32} color={W.textSubtle} />
                                            <Text style={{ fontSize: 12, color: W.textMuted, marginTop: 6, fontWeight: '600' }}>
                                                No wallet transactions found.
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={{ gap: 6 }}>
                                            {transactions.map(tx => {
                                                const isCredit = tx.type?.includes('credit') || tx.type === 'deposit';
                                                return (
                                                    <View key={tx.id} style={S.txRow}>
                                                        <View style={[S.txIconBox, { backgroundColor: isCredit ? W.emeraldBg : W.crimsonBg }]}>
                                                            <Ionicons
                                                                name={isCredit ? "arrow-down" : "arrow-up"}
                                                                size={13}
                                                                color={isCredit ? W.emerald : W.crimson}
                                                            />
                                                        </View>
                                                        <View style={{ flex: 1, minWidth: 0 }}>
                                                            <Text style={S.txDesc} numberOfLines={1}>
                                                                {tx.description || (isCredit ? 'Wallet Credit' : 'Wallet Debit')}
                                                            </Text>
                                                            <Text style={S.txDate}>
                                                                {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                                            </Text>
                                                        </View>
                                                        <Text style={[S.txAmount, { color: isCredit ? W.emerald : W.crimson }]}>
                                                            {isCredit ? '+' : '-'}{fmtAmt(tx.amount || 0)}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* ────────────── TAB 3: ORDERS ────────────── */}
                        {activeTab === 'orders' && (
                            <View style={{ gap: 10 }}>
                                {orders.length === 0 ? (
                                    <View style={[S.card, { alignItems: 'center', paddingVertical: 30 }]}>
                                        <Ionicons name="cart-outline" size={40} color={W.textSubtle} />
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: W.charcoal, marginTop: 8 }}>No Marketplace Orders</Text>
                                        <Text style={{ fontSize: 11, color: W.textMuted, marginTop: 2 }}>This user has not completed any orders yet.</Text>
                                    </View>
                                ) : (
                                    orders.map(order => (
                                        <View key={order.id} style={S.orderCard}>
                                            <View style={S.orderTopRow}>
                                                <Text style={S.orderNum}>Order #{order.id.toString().slice(0, 8)}</Text>
                                                <View style={[S.badge, {
                                                    backgroundColor: order.status === 'delivered' ? W.emeraldBg : W.goldBg,
                                                    borderColor: order.status === 'delivered' ? W.emeraldBorder : W.goldBorder
                                                }]}>
                                                    <Text style={[S.badgeTxt, { color: order.status === 'delivered' ? W.emerald : W.gold }]}>
                                                        {(order.status || 'PENDING').toUpperCase()}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={S.orderBottomRow}>
                                                <Text style={S.orderDate}>
                                                    {order.created_at ? new Date(order.created_at).toDateString() : 'Recent'}
                                                </Text>
                                                <Text style={S.orderTotal}>
                                                    {fmtAmt(order.total_amount || 0)}
                                                </Text>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        )}

                        {/* ────────────── TAB 4: SECURITY & ACCESS ────────────── */}
                        {activeTab === 'security' && (
                            <View style={{ gap: 12 }}>
                                {/* Account Freeze & Restriction Toggles */}
                                <View style={S.card}>
                                    <View style={S.cardHeader}>
                                        <Ionicons name="lock-closed" size={15} color={W.crimson} />
                                        <Text style={[S.cardTitle, { color: W.crimson }]}>Security Controls & Access Locks</Text>
                                    </View>

                                    <View style={S.switchRow}>
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                            <Text style={S.switchTitle}>Account Suspension (Freeze)</Text>
                                            <Text style={S.switchSub}>Completely locks customer out of logging in.</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={handleToggleSuspend}
                                            style={[S.togglePill, isSuspended ? { backgroundColor: W.crimson } : { backgroundColor: '#E2E8F0' }]}
                                        >
                                            <Text style={[S.togglePillText, isSuspended && { color: '#FFFFFF' }]}>
                                                {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={{ height: 1, backgroundColor: W.canvasAlt, marginVertical: 10 }} />

                                    <View style={S.switchRow}>
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                            <Text style={S.switchTitle}>Restrict Purchases</Text>
                                            <Text style={S.switchSub}>User can browse but checkout is blocked.</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={handleToggleRestricted}
                                            style={[S.togglePill, isRestricted ? { backgroundColor: W.gold } : { backgroundColor: '#E2E8F0' }]}
                                        >
                                            <Text style={[S.togglePillText, isRestricted && { color: '#FFFFFF' }]}>
                                                {isRestricted ? 'RESTRICTED' : 'ALLOWED'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Direct Password Override */}
                                <View style={S.card}>
                                    <View style={S.cardHeader}>
                                        <Ionicons name="key" size={15} color={W.charcoal} />
                                        <Text style={S.cardTitle}>Manual Password Override</Text>
                                    </View>
                                    <Text style={{ fontSize: 11, color: W.textMuted, marginBottom: 8 }}>
                                        Set a new temporary password for this user immediately:
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TextInput
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry
                                            placeholder="Enter new password (min 6 chars)"
                                            placeholderTextColor={W.textSubtle}
                                            style={[S.fieldInput, { flex: 1, marginBottom: 0 }]}
                                        />
                                        <TouchableOpacity
                                            onPress={handleManualPasswordReset}
                                            disabled={!newPassword}
                                            style={[S.btnAction, { backgroundColor: newPassword ? W.charcoal : '#CBD5E1' }]}
                                        >
                                            <Text style={S.btnActionText}>Override</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={{ height: 1, backgroundColor: W.canvasAlt, marginVertical: 12 }} />

                                    <TouchableOpacity onPress={handleEmailReset} style={S.emailResetBtn}>
                                        <Ionicons name="mail-outline" size={15} color={W.sky} style={{ marginRight: 6 }} />
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: W.sky }}>
                                            Dispatch Password Recovery Link via Email
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* ── CUSTOM WALLET ADJUSTMENT MODAL ── */}
                <Modal visible={transactVisible} transparent animationType="fade" onRequestClose={() => setTransactVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalOverlay}>
                        <View style={S.transactCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons
                                        name={transactType === 'credit' ? "arrow-down-circle" : "arrow-up-circle"}
                                        size={20}
                                        color={transactType === 'credit' ? W.emerald : W.crimson}
                                    />
                                    <Text style={S.transactTitle}>
                                        {transactType === 'credit' ? 'Credit Wallet Funds' : 'Debit Wallet Funds'}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setTransactVisible(false)}>
                                    <Ionicons name="close" size={18} color={W.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <Text style={S.transactSub}>
                                Current balance: <Text style={{ fontWeight: '800', color: W.emerald }}>{fmtAmt(wallet?.balance || 0)}</Text>
                            </Text>

                            {/* Preset Buttons */}
                            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 10 }}>
                                {['1000', '5000', '10000', '50000'].map(val => (
                                    <TouchableOpacity
                                        key={val}
                                        onPress={() => setTransactAmount(val)}
                                        style={[
                                            S.presetBtn,
                                            transactAmount === val && { backgroundColor: W.goldBg, borderColor: W.gold }
                                        ]}
                                    >
                                        <Text style={[S.presetBtnText, transactAmount === val && { color: W.gold }]}>
                                            +{fmtAmt(val)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TextInput
                                placeholder="Amount in Naira (₦)"
                                placeholderTextColor={W.textSubtle}
                                keyboardType="numeric"
                                value={transactAmount}
                                onChangeText={setTransactAmount}
                                style={S.transactInput}
                                autoFocus
                            />

                            <TextInput
                                placeholder="Memo / Reason for adjustment"
                                placeholderTextColor={W.textSubtle}
                                value={transactReason}
                                onChangeText={setTransactReason}
                                style={[S.transactInput, { marginTop: 8 }]}
                            />

                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                                <TouchableOpacity onPress={() => setTransactVisible(false)} style={S.modalCancelBtn}>
                                    <Text style={S.modalCancelBtnText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleCustomTransact}
                                    disabled={transacting}
                                    style={[
                                        S.modalConfirmBtn,
                                        { backgroundColor: transactType === 'credit' ? W.emerald : W.crimson }
                                    ]}
                                >
                                    {transacting ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <Text style={S.modalConfirmBtnText}>
                                            Confirm {transactType === 'credit' ? 'Credit' : 'Debit'}
                                        </Text>
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

// ─── Executive Stylesheet ──────────────────────────────────────────────────
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: W.canvas,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: W.cardBg,
        borderBottomWidth: 1,
        borderBottomColor: W.cardBorder,
    },
    topBarCenter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircleBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: W.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editSaveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    editSaveBtnText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: W.charcoal,
    },
    badge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    badgeTxt: {
        fontSize: 9.5,
        fontWeight: '900',
    },

    // Hero Identity Card
    heroCard: {
        backgroundColor: W.cardBg,
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: W.cardBorder,
    },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarWrap: {
        position: 'relative',
        marginRight: 10,
    },
    verifyBadge: {
        position: 'absolute',
        top: -3,
        right: -3,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
    },
    heroDetails: {
        flex: 1,
        minWidth: 0,
    },
    heroName: {
        fontSize: 15,
        fontWeight: '900',
        color: W.charcoal,
        letterSpacing: -0.2,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    heroContactTxt: {
        fontSize: 11,
        color: W.textMuted,
        fontWeight: '500',
    },

    // KPI Ribbon
    kpiRibbon: {
        flexDirection: 'row',
        backgroundColor: '#FAF8F5',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: W.cardBorder,
        paddingVertical: 6,
        paddingHorizontal: 8,
        marginTop: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    kpiTile: {
        flex: 1,
        alignItems: 'center',
    },
    kpiLabel: {
        fontSize: 8.5,
        fontWeight: '800',
        textTransform: 'uppercase',
        color: W.textMuted,
        letterSpacing: 0.2,
    },
    kpiVal: {
        fontSize: 12.5,
        fontWeight: '900',
        color: W.charcoal,
        marginTop: 1,
    },
    kpiDivider: {
        width: 1,
        height: 18,
        backgroundColor: W.cardBorder,
    },

    // Shortcuts Bar
    shortcutsBar: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 8,
    },
    shortcutBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingVertical: 5.5,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    shortcutBtnTxt: {
        fontSize: 10.5,
        fontWeight: '800',
        color: W.charcoal,
    },

    // Tabs
    tabsContainer: {
        flexDirection: 'row',
        padding: 2.5,
        backgroundColor: W.cardBg,
        marginHorizontal: 12,
        marginVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6.5,
        borderRadius: 8,
    },
    tabItemActive: {
        backgroundColor: W.canvas,
    },
    tabItemText: {
        fontSize: 11,
        fontWeight: '700',
        color: W.textMuted,
    },
    tabItemTextActive: {
        color: W.charcoal,
        fontWeight: '900',
    },

    // Content cards
    scrollContent: {
        paddingHorizontal: 12,
        paddingBottom: 20,
    },
    card: {
        backgroundColor: W.cardBg,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 11.5,
        fontWeight: '900',
        color: W.charcoal,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },

    gridRow: {
        flexDirection: 'row',
        gap: 8,
    },
    gridCell: {
        flex: 1,
        backgroundColor: '#FAF8F5',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    gridCellLbl: {
        fontSize: 9,
        fontWeight: '800',
        color: W.textMuted,
        textTransform: 'uppercase',
    },
    gridCellVal: {
        fontSize: 12,
        fontWeight: '900',
        color: W.charcoal,
        marginTop: 2,
    },

    // Form inputs
    fieldBox: {
        marginBottom: 7,
    },
    fieldLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: W.textMuted,
        textTransform: 'uppercase',
        marginBottom: 3,
    },
    fieldInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: W.cardBorder,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 12,
        color: W.charcoal,
    },
    fieldInputDisabled: {
        backgroundColor: '#FAF8F5',
        color: W.charcoal,
    },

    // Presets
    presetTmplBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        borderRadius: 8,
    },
    presetTmplTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#15803D',
    },
    presetTmplSnippet: {
        fontSize: 9.5,
        color: '#166534',
        marginTop: 1,
    },

    // Wallet
    walletBalanceNum: {
        fontSize: 22,
        fontWeight: '900',
        color: W.emerald,
    },
    transactBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
    },
    transactBtnText: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
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
        fontSize: 11,
        fontWeight: '700',
        color: W.charcoal,
    },
    txDate: {
        fontSize: 9.5,
        color: W.textMuted,
    },
    txAmount: {
        fontSize: 12,
        fontWeight: '900',
    },

    // Orders
    orderCard: {
        backgroundColor: W.cardBg,
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    orderTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderNum: {
        fontSize: 12,
        fontWeight: '900',
        color: W.charcoal,
    },
    orderBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    orderDate: {
        fontSize: 10.5,
        color: W.textMuted,
    },
    orderTotal: {
        fontSize: 12.5,
        fontWeight: '900',
        color: W.charcoal,
    },

    // Security
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    switchTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: W.charcoal,
    },
    switchSub: {
        fontSize: 10,
        color: W.textMuted,
        marginTop: 1,
    },
    togglePill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    togglePillText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: W.textBody,
    },
    btnAction: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnActionText: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    emailResetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: W.skyBg,
        borderWidth: 1,
        borderColor: W.skyBorder,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    transactCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        width: '100%',
        maxWidth: 360,
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    transactTitle: {
        fontSize: 13.5,
        fontWeight: '900',
        color: W.charcoal,
    },
    transactSub: {
        fontSize: 11,
        color: W.textMuted,
    },
    presetBtn: {
        flex: 1,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#FAF8F5',
        borderWidth: 1,
        borderColor: W.cardBorder,
        alignItems: 'center',
    },
    presetBtnText: {
        fontSize: 10,
        fontWeight: '800',
        color: W.charcoal,
    },
    transactInput: {
        backgroundColor: '#FAF8F5',
        borderWidth: 1,
        borderColor: W.cardBorder,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        fontSize: 13,
        color: W.charcoal,
        fontWeight: '700',
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: W.cardBorder,
        alignItems: 'center',
    },
    modalCancelBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: W.charcoal,
    },
    modalConfirmBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalConfirmBtnText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#FFFFFF',
    },
});
