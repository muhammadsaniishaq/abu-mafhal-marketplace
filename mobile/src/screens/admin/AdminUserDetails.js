import * as React from 'react';
import {
    View, Text, Modal, TouchableOpacity, ScrollView, TextInput,
    ActivityIndicator, Alert, StyleSheet, Linking, KeyboardAvoidingView,
    Platform, Dimensions, Pressable
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../components/UserAvatar';

const { width } = Dimensions.get('window');

// ─── Warm Luxury Palette (Neither Stark White Nor Dark) ─────────────────────
const W = {
    canvas: '#F5F2EB',          // Warm alabaster cream canvas
    canvasAlt: '#EFEAE1',
    cardBg: '#FFFFFF',          // Crisp warm porcelain card
    cardBorder: '#E6E0D5',      // Warm champagne/stone border
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

// ─── Tab Button Helper ───────────────────────────────────────────────────────
const TabButton = ({ title, active, onPress, count, icon }) => (
    <TouchableOpacity
        onPress={onPress}
        style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
        <Ionicons
            name={icon}
            size={16}
            color={active ? W.charcoal : W.textMuted}
            style={{ marginRight: 6 }}
        />
        <Text style={[styles.tabText, active && styles.tabTextActive]}>
            {title} {count !== undefined && count > 0 ? `(${count})` : ''}
        </Text>
    </TouchableOpacity>
);

// ─── Section Header Helper ───────────────────────────────────────────────────
const SectionHeader = ({ title, icon, color = W.charcoal }) => (
    <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    </View>
);

// ─── Role Card Helper (Spacious) ─────────────────────────────────────────────
const RoleCard = ({ role, selected, onSelect, disabled }) => {
    const getRoleMeta = (r) => {
        switch (r) {
            case 'admin': return { icon: 'shield-checkmark', color: W.purple, bg: W.purpleBg, border: W.purpleBorder, label: 'Administrator' };
            case 'vendor': return { icon: 'storefront', color: '#C2410C', bg: '#FFF7ED', border: '#FFEDD5', label: 'Merchant Vendor' };
            case 'driver': return { icon: 'bicycle', color: W.sky, bg: W.skyBg, border: W.skyBorder, label: 'Fleet Courier' };
            default: return { icon: 'person', color: W.emerald, bg: W.emeraldBg, border: W.emeraldBorder, label: 'Shopper Client' };
        }
    };

    const meta = getRoleMeta(role);

    return (
        <TouchableOpacity
            onPress={() => onSelect(role)}
            disabled={disabled}
            style={[
                styles.roleCard,
                { borderColor: selected ? meta.color : W.cardBorder, backgroundColor: selected ? meta.bg : '#FFFFFF' },
                disabled && { opacity: 0.5 }
            ]}
        >
            <View style={[styles.roleIconBox, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                <Ionicons name={meta.icon} size={20} color={meta.color} />
            </View>
            <Text style={[styles.roleCardText, { color: selected ? meta.color : W.textBody, fontWeight: selected ? '900' : '700' }]}>
                {meta.label}
            </Text>
            {selected && (
                <View style={[styles.checkCircle, { backgroundColor: meta.color }]}>
                    <Ionicons name="checkmark" size={12} color="white" />
                </View>
            )}
        </TouchableOpacity>
    );
};

// ─── Switch Button Helper ───────────────────────────────────────────────────
const SwitchBtn = ({ value, onToggle, color = W.emerald }) => (
    <TouchableOpacity
        onPress={onToggle}
        style={{
            width: 48,
            height: 28,
            borderRadius: 14,
            backgroundColor: value ? color : '#E2E8F0',
            padding: 2,
            justifyContent: 'center'
        }}
    >
        <View style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            alignSelf: value ? 'flex-end' : 'flex-start',
            ...Platform.select({
                ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3 },
                android: { elevation: 2 }
            })
        }} />
    </TouchableOpacity>
);

// ─── Main AdminUserDetails Component ─────────────────────────────────────────
export const AdminUserDetails = ({ visible, user, onClose, onUpdate, navigation: propNavigation }) => {
    const internalNavigation = useNavigation();
    const navigation = propNavigation || internalNavigation;
    const insets = useSafeAreaInsets();

    // Data State
    const [wallet, setWallet] = React.useState(null);
    const [orders, setOrders] = React.useState([]);
    const [driverInfo, setDriverInfo] = React.useState(null);
    const [loadingData, setLoadingData] = React.useState(false);

    // UI State
    const [activeTab, setActiveTab] = React.useState('overview');
    const [editMode, setEditMode] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    // Form State
    const [fullName, setFullName] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [city, setCity] = React.useState('');
    const [state, setState] = React.useState('');
    const [country, setCountry] = React.useState('');
    const [adminNotes, setAdminNotes] = React.useState('');
    const [role, setRole] = React.useState('customer');

    // Security State
    const [newPassword, setNewPassword] = React.useState('');

    // Transaction State
    const [transactVisible, setTransactVisible] = React.useState(false);
    const [transactType, setTransactType] = React.useState('credit');
    const [transacting, setTransacting] = React.useState(false);
    const [amount, setAmount] = React.useState('');
    const [note, setNote] = React.useState('');

    React.useEffect(() => {
        if (visible && user) {
            setFullName(user.full_name || '');
            setPhone(user.phone || '');
            setAddress(user.address || '');
            setCity(user.city || '');
            setState(user.state || '');
            setCountry(user.country || '');
            setAdminNotes(user.admin_note || user.admin_notes || '');
            setRole(user.role || 'customer');
            setNewPassword('');
            fetchUserData();
        }
    }, [visible, user]);

    const fetchUserData = async () => {
        if (!user?.id) return;
        setLoadingData(true);
        try {
            const { data: walletData } = await supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle();
            setWallet(walletData || { balance: 0, points: 0 });

            const { data: ordersData } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);
            setOrders(ordersData || []);

            if (user.role === 'driver') {
                const { data: driverData } = await supabase
                    .from('drivers')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();
                setDriverInfo(driverData || null);
            } else {
                setDriverInfo(null);
            }
        } catch (e) {
            console.log("Error fetching user details:", e);
        } finally {
            setLoadingData(false);
        }
    };

    const handleSaveProfile = async () => {
        if (role !== user.role && role === 'admin') {
            Alert.alert(
                'Confirm Administrator Access',
                `Are you sure you want to promote ${user.email || user.full_name} to ADMIN? They will receive full control over the marketplace backend.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Promote to Admin', style: 'destructive', onPress: () => executeSave() }
                ]
            );
            return;
        }
        executeSave();
    };

    const executeSave = async () => {
        setSaving(true);
        const { error } = await supabase.from('profiles').update({
            full_name: fullName.trim(),
            phone: phone.trim(),
            address: address.trim(),
            city: city.trim(),
            state: state.trim(),
            country: country.trim(),
            admin_note: adminNotes.trim(),
            role: role
        }).eq('id', user.id);

        setSaving(false);

        if (error) {
            Alert.alert('Save Error', error.message);
        } else {
            Alert.alert('Profile Saved', 'User information updated successfully.');
            setEditMode(false);
            if (onUpdate) onUpdate();
        }
    };

    const handleTransaction = async () => {
        const amtVal = parseFloat(amount);
        if (isNaN(amtVal) || amtVal <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid numeric amount.');
            return;
        }

        setTransacting(true);
        const currentBal = wallet?.balance || 0;
        const newBal = transactType === 'credit' ? currentBal + amtVal : Math.max(0, currentBal - amtVal);

        const { error: walletError } = await supabase
            .from('wallets')
            .upsert({ user_id: user.id, balance: newBal, currency: 'NGN' });

        if (walletError) {
            Alert.alert('Error', walletError.message);
            setTransacting(false);
            return;
        }

        try {
            await supabase.from('wallet_transactions').insert({
                user_id: user.id,
                amount: amtVal,
                type: transactType === 'credit' ? 'admin_credit' : 'admin_debit',
                description: note.trim() || `Admin manual ${transactType}`,
                status: 'completed'
            });
        } catch (e) {}

        Alert.alert('Wallet Updated', `Wallet successfully ${transactType}ed with ₦${amtVal.toLocaleString()}.`);
        setTransactVisible(false);
        setTransacting(false);
        setAmount('');
        setNote('');
        fetchUserData();
        if (onUpdate) onUpdate();
    };

    const handleManualPasswordReset = async () => {
        if (!newPassword || newPassword.length < 6) {
            Alert.alert('Validation Error', 'Password must contain at least 6 characters.');
            return;
        }

        Alert.alert(
            'Confirm Password Override',
            `Manually set a new password for ${user.email}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Set Password',
                    style: 'destructive',
                    onPress: async () => {
                        setLoadingData(true);
                        const { error } = await supabase.rpc('admin_reset_password', { target_user_id: user.id, new_password: newPassword });
                        setLoadingData(false);
                        if (error) Alert.alert('Error', error.message);
                        else {
                            Alert.alert('Password Updated', 'New password is now in effect.');
                            setNewPassword('');
                        }
                    }
                }
            ]
        );
    };

    const handleEmailReset = async () => {
        Alert.alert('Send Reset Email', `Send password recovery link to ${user.email}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Send Email',
                onPress: async () => {
                    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: 'abumafhal://reset-password' });
                    if (error) Alert.alert('Error', error.message);
                    else Alert.alert('Recovery Sent', 'Password reset instructions have been sent to their inbox.');
                }
            }
        ]);
    };

    const handleToggleStatus = async (field, currentValue) => {
        const { error } = await supabase.from('profiles').update({ [field]: !currentValue }).eq('id', user.id);
        if (error) {
            Alert.alert('Update Failed', error.message);
        } else {
            if (onUpdate) onUpdate();
            fetchUserData();
        }
    };

    const openWhatsAppTemplate = (msg) => {
        if (!user.phone) {
            Alert.alert('No Phone', 'This user has no telephone number registered.');
            return;
        }
        const cleanPhone = user.phone.replace(/[^0-9]/g, '');
        const encoded = encodeURIComponent(msg);
        Linking.openURL(`https://wa.me/${cleanPhone}?text=${encoded}`);
    };

    if (!user) return null;

    const roleColor =
        user.role === 'admin' ? W.purple :
        user.role === 'vendor' ? '#C2410C' :
        user.role === 'driver' ? W.sky : W.emerald;

    const roleBg =
        user.role === 'admin' ? W.purpleBg :
        user.role === 'vendor' ? '#FFF7ED' :
        user.role === 'driver' ? W.skyBg : W.emeraldBg;

    const roleBorder =
        user.role === 'admin' ? W.purpleBorder :
        user.role === 'vendor' ? '#FFEDD5' :
        user.role === 'driver' ? W.skyBorder : W.emeraldBorder;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* ══ WARM LUXURY HERO HEADER (BIGGER & PROMINENT) ══ */}
                <View style={styles.heroHdr}>
                    {/* Top Navigation Row */}
                    <View style={styles.heroTopBar}>
                        <TouchableOpacity onPress={onClose} style={styles.heroCircleBtn}>
                            <Ionicons name="close" size={22} color={W.charcoal} />
                        </TouchableOpacity>

                        <View style={[styles.heroRolePill, { borderColor: roleBorder, backgroundColor: roleBg }]}>
                            <Ionicons
                                name={user.role === 'admin' ? 'shield-checkmark' : user.role === 'vendor' ? 'storefront' : user.role === 'driver' ? 'bicycle' : 'person'}
                                size={14}
                                color={roleColor}
                                style={{ marginRight: 5 }}
                            />
                            <Text style={[styles.heroRolePillTxt, { color: roleColor }]}>
                                {(user.role || 'Customer').toUpperCase()}
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => editMode ? handleSaveProfile() : setEditMode(true)}
                            disabled={saving}
                            style={[styles.heroCircleBtn, editMode && { backgroundColor: W.emerald, borderColor: W.emerald }]}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Ionicons name={editMode ? 'checkmark' : 'create-outline'} size={20} color={editMode ? '#FFFFFF' : W.charcoal} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Avatar & Identity Center */}
                    <View style={styles.heroCentre}>
                        <View style={{ position: 'relative' }}>
                            <View style={[styles.heroAvatarRing, { borderColor: roleBorder }]}>
                                <UserAvatar user={user} size={62} />
                            </View>
                            {user.is_verified && (
                                <View style={styles.heroVerifyDot}>
                                    <Ionicons name="checkmark-circle" size={20} color={W.sky} />
                                </View>
                            )}
                        </View>

                        <Text style={styles.heroName}>{user.full_name || 'Anonymous User'}</Text>
                        <Text style={styles.heroEmail}>{user.email || 'No email registered'}</Text>

                        {/* Status Pills */}
                        <View style={styles.heroChipRow}>
                            {user.is_banned ? (
                                <View style={[styles.heroChip, { backgroundColor: W.crimsonBg, borderColor: W.crimsonBorder }]}>
                                    <Ionicons name="ban" size={12} color={W.crimson} />
                                    <Text style={[styles.heroChipTxt, { color: W.crimson }]}>Suspended</Text>
                                </View>
                            ) : (
                                <View style={[styles.heroChip, { backgroundColor: W.emeraldBg, borderColor: W.emeraldBorder }]}>
                                    <Ionicons name="shield-checkmark" size={12} color={W.emerald} />
                                    <Text style={[styles.heroChipTxt, { color: W.emerald }]}>Active Account</Text>
                                </View>
                            )}

                            {user.is_restricted && (
                                <View style={[styles.heroChip, { backgroundColor: W.goldBg, borderColor: W.goldBorder }]}>
                                    <Ionicons name="lock-closed" size={12} color={W.gold} />
                                    <Text style={[styles.heroChipTxt, { color: W.gold }]}>Restricted</Text>
                                </View>
                            )}

                            <View style={[styles.heroChip, { backgroundColor: '#F1F5F9', borderColor: W.cardBorder }]}>
                                <Text style={[styles.heroChipTxt, { color: W.textMuted, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                                    ID: {user.id ? user.id.slice(0, 8) : 'N/A'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Big Financial & Vital Summary Strip */}
                    <View style={styles.heroStrip}>
                        <View style={styles.heroStripItem}>
                            <View style={[styles.heroStripIconBox, { backgroundColor: W.emeraldBg }]}>
                                <Ionicons name="wallet-outline" size={18} color={W.emerald} />
                            </View>
                            <View>
                                <Text style={styles.heroStripLbl}>Wallet Balance</Text>
                                <Text style={[styles.heroStripVal, { color: W.emerald }]}>
                                    ₦{(wallet?.balance || 0).toLocaleString()}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.heroStripDiv} />

                        <View style={styles.heroStripItem}>
                            <View style={[styles.heroStripIconBox, { backgroundColor: '#F1F5F9' }]}>
                                <Ionicons name="calendar-outline" size={18} color={W.charcoal} />
                            </View>
                            <View>
                                <Text style={styles.heroStripLbl}>Registered</Text>
                                <Text style={styles.heroStripVal2}>
                                    {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : 'Recent'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.heroStripDiv} />

                        <View style={styles.heroStripItem}>
                            <View style={[styles.heroStripIconBox, { backgroundColor: W.skyBg }]}>
                                <Ionicons name="call-outline" size={18} color={W.sky} />
                            </View>
                            <View>
                                <Text style={styles.heroStripLbl}>Contact</Text>
                                <Text style={styles.heroStripVal2} numberOfLines={1}>
                                    {user.phone || 'None'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ── BIGGER INTERACTIVE TABS ──────────────────────────────── */}
                <View style={styles.tabContainer}>
                    <TabButton title="Overview" active={activeTab === 'overview'} onPress={() => setActiveTab('overview')} icon="grid-outline" />
                    <TabButton title="Wallet" active={activeTab === 'wallet'} onPress={() => setActiveTab('wallet')} icon="wallet-outline" />
                    <TabButton title="Orders" count={orders.length} active={activeTab === 'orders'} onPress={() => setActiveTab('orders')} icon="cart-outline" />
                    <TabButton title="Security" active={activeTab === 'security'} onPress={() => setActiveTab('security')} icon="shield-outline" />
                </View>

                {/* ── SCROLL CONTENT (SPACIOUS) ────────────────────────────── */}
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                        {/* ──────────────── OVERVIEW TAB ──────────────── */}
                        {activeTab === 'overview' && (
                            <View style={{ gap: 20 }}>
                                {/* Role & Permissions Card */}
                                <View style={styles.card}>
                                    <SectionHeader title="System Role & Permissions" icon="people" color={W.charcoal} />
                                    {editMode ? (
                                        <View style={styles.roleGrid}>
                                            {['customer', 'vendor', 'driver', 'admin'].map(r => (
                                                <RoleCard key={r} role={r} selected={role === r} onSelect={setRole} />
                                            ))}
                                        </View>
                                    ) : (
                                        <View style={styles.readOnlyField}>
                                            <Text style={styles.readOnlyLabel}>Active System Role</Text>
                                            <Text style={styles.readOnlyValue}>{(user.role || 'customer').toUpperCase()}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Personal Profile Details Card */}
                                <View style={styles.card}>
                                    <SectionHeader title="Personal Information" icon="person-circle" color={W.charcoal} />
                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>Full Name</Text>
                                        <TextInput
                                            style={[styles.input, !editMode && styles.inputDisabled]}
                                            value={fullName}
                                            onChangeText={setFullName}
                                            editable={editMode}
                                            placeholder="User's full name"
                                            placeholderTextColor={W.textSubtle}
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>Phone Number</Text>
                                        <TextInput
                                            style={[styles.input, !editMode && styles.inputDisabled]}
                                            value={phone}
                                            onChangeText={setPhone}
                                            editable={editMode}
                                            keyboardType="phone-pad"
                                            placeholder="Telephone number"
                                            placeholderTextColor={W.textSubtle}
                                        />
                                    </View>
                                </View>

                                {/* Location Details Card */}
                                <View style={styles.card}>
                                    <SectionHeader title="Delivery & Shipping Address" icon="location" color={W.charcoal} />
                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>Street Address</Text>
                                        <TextInput
                                            style={[styles.input, !editMode && styles.inputDisabled]}
                                            value={address}
                                            onChangeText={setAddress}
                                            editable={editMode}
                                            placeholder="Street address or landmark"
                                            placeholderTextColor={W.textSubtle}
                                        />
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={[styles.formGroup, { flex: 1 }]}>
                                            <Text style={styles.label}>City</Text>
                                            <TextInput
                                                style={[styles.input, !editMode && styles.inputDisabled]}
                                                value={city}
                                                onChangeText={setCity}
                                                editable={editMode}
                                                placeholder="City"
                                                placeholderTextColor={W.textSubtle}
                                            />
                                        </View>
                                        <View style={[styles.formGroup, { flex: 1 }]}>
                                            <Text style={styles.label}>State</Text>
                                            <TextInput
                                                style={[styles.input, !editMode && styles.inputDisabled]}
                                                value={state}
                                                onChangeText={setState}
                                                editable={editMode}
                                                placeholder="State"
                                                placeholderTextColor={W.textSubtle}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Quick WhatsApp Message Templates (New Feature!) */}
                                {user.phone && (
                                    <View style={styles.card}>
                                        <SectionHeader title="Instant WhatsApp Presets" icon="logo-whatsapp" color="#16A34A" />
                                        <Text style={{ fontSize: 12, color: W.textMuted, marginBottom: 12 }}>
                                            Launch pre-composed administrator messages to customer's WhatsApp in 1-tap:
                                        </Text>
                                        <View style={{ gap: 8 }}>
                                            {[
                                                { label: '👋 Welcome & Greeting', msg: `Hello ${user.full_name || 'Valued Customer'}, welcome to Abu Mafhal Marketplace! How may we assist you today?` },
                                                { label: '✅ KYC Verification Approval', msg: `Congratulations ${user.full_name || ''}! Your marketplace account and identity verification have been approved successfully.` },
                                                { label: '💰 Wallet Funding Receipt', msg: `Hello ${user.full_name || ''}, your marketplace wallet has been updated with recent funds. You can check your balance now.` },
                                                { label: '📦 Order Status Follow-up', msg: `Hello ${user.full_name || ''}, we are following up regarding your marketplace order. Please let us know if you need any assistance.` },
                                            ].map((tpl, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    onPress={() => openWhatsAppTemplate(tpl.msg)}
                                                    style={styles.templateBtn}
                                                >
                                                    <Ionicons name="chatbubble-ellipses" size={16} color="#16A34A" />
                                                    <Text style={styles.templateBtnTxt}>{tpl.label}</Text>
                                                    <Ionicons name="arrow-forward" size={14} color="#16A34A" />
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                {/* Driver Fleet Details if applicable */}
                                {user.role === 'driver' && driverInfo && (
                                    <View style={[styles.card, { backgroundColor: W.skyBg, borderColor: W.skyBorder }]}>
                                        <SectionHeader title="Fleet Courier Profile" icon="bicycle" color={W.sky} />
                                        <View style={styles.driverGrid}>
                                            <View style={styles.driverCell}>
                                                <Text style={styles.driverCellLabel}>Vehicle Type</Text>
                                                <Text style={styles.driverCellValue}>{driverInfo.vehicle_type || 'Motorcycle'}</Text>
                                            </View>
                                            <View style={styles.driverCell}>
                                                <Text style={styles.driverCellLabel}>Plate Number</Text>
                                                <Text style={styles.driverCellValue}>{driverInfo.plate_number || 'N/A'}</Text>
                                            </View>
                                            <View style={styles.driverCell}>
                                                <Text style={styles.driverCellLabel}>Vehicle Color</Text>
                                                <Text style={styles.driverCellValue}>{driverInfo.vehicle_color || 'Standard'}</Text>
                                            </View>
                                            <View style={styles.driverCell}>
                                                <Text style={styles.driverCellLabel}>Courier Status</Text>
                                                <Text style={[styles.driverCellValue, { color: driverInfo.status === 'active' ? W.emerald : W.crimson }]}>
                                                    {(driverInfo.status || 'Active').toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {/* Admin Internal Memo Card */}
                                <View style={styles.card}>
                                    <SectionHeader title="Internal Administrator Memo" icon="document-text" color={W.gold} />
                                    <TextInput
                                        style={[styles.input, { height: 110, textAlignVertical: 'top' }, !editMode && styles.inputDisabled]}
                                        value={adminNotes}
                                        onChangeText={setAdminNotes}
                                        editable={editMode}
                                        multiline
                                        placeholder="Private administrative observations visible only to staff…"
                                        placeholderTextColor={W.textSubtle}
                                    />
                                </View>

                                {/* Direct Action Buttons */}
                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                                    {user.phone ? (
                                        <TouchableOpacity
                                            onPress={() => Linking.openURL(`tel:${user.phone}`)}
                                            style={[styles.actionBtn, { backgroundColor: W.charcoal }]}
                                        >
                                            <Ionicons name="call" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.actionBtnText}>Direct Call</Text>
                                        </TouchableOpacity>
                                    ) : null}

                                    {user.phone ? (
                                        <TouchableOpacity
                                            onPress={() => Linking.openURL(`https://wa.me/${user.phone.replace(/[^0-9]/g, '')}`)}
                                            style={[styles.actionBtn, { backgroundColor: '#16A34A' }]}
                                        >
                                            <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.actionBtnText}>WhatsApp</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>
                        )}

                        {/* ──────────────── WALLET TAB ──────────────── */}
                        {activeTab === 'wallet' && (
                            <View style={{ gap: 20 }}>
                                <View style={styles.balanceCard}>
                                    <Text style={styles.balanceLabel}>Current Wallet Balance</Text>
                                    <Text style={styles.balanceValue}>₦{(wallet?.balance || 0).toLocaleString()}</Text>

                                    <View style={styles.balanceActions}>
                                        <TouchableOpacity
                                            onPress={() => { setTransactType('credit'); setTransactVisible(true); }}
                                            style={[styles.balanceBtn, { backgroundColor: W.emerald }]}
                                        >
                                            <Ionicons name="arrow-down-circle" size={20} color="white" style={{ marginRight: 6 }} />
                                            <Text style={styles.balanceBtnText}>Credit Funds</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => { setTransactType('debit'); setTransactVisible(true); }}
                                            style={[styles.balanceBtn, { backgroundColor: W.crimson }]}
                                        >
                                            <Ionicons name="arrow-up-circle" size={20} color="white" style={{ marginRight: 6 }} />
                                            <Text style={styles.balanceBtnText}>Debit Funds</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.infoBox}>
                                    <Ionicons name="information-circle" size={22} color={W.sky} />
                                    <Text style={styles.infoText}>
                                        Manual balance adjustments directly affect the customer's spendable marketplace float. All modifications are logged in audit ledger.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* ──────────────── ORDERS TAB ──────────────── */}
                        {activeTab === 'orders' && (
                            <View style={{ gap: 14 }}>
                                {orders.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="cart-outline" size={60} color="#CBD5E1" />
                                        <Text style={styles.emptyText}>No orders recorded yet</Text>
                                        <Text style={{ fontSize: 13, color: W.textMuted, marginTop: 4 }}>This customer has not placed any marketplace orders.</Text>
                                    </View>
                                ) : (
                                    orders.map(order => (
                                        <View key={order.id} style={styles.orderItem}>
                                            <View style={styles.orderHeader}>
                                                <Text style={styles.orderNumber}>Order #{order.id.toString().slice(0, 8)}</Text>
                                                <View style={[styles.statusPill, {
                                                    backgroundColor: order.status === 'delivered' ? W.emeraldBg : '#F1F5F9'
                                                }]}>
                                                    <Text style={[styles.statusPillText, {
                                                        color: order.status === 'delivered' ? W.emerald : W.textMuted
                                                    }]}>{(order.status || 'PENDING').toUpperCase()}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.orderRow}>
                                                <Text style={styles.orderDate}>{new Date(order.created_at).toDateString()}</Text>
                                                <Text style={styles.orderAmount}>₦{order.total_amount?.toLocaleString()}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        )}

                        {/* ──────────────── SECURITY TAB ──────────────── */}
                        {activeTab === 'security' && (
                            <View style={{ gap: 20 }}>
                                <View style={styles.card}>
                                    <SectionHeader title="Authentication Controls" icon="lock-closed" color={W.charcoal} />

                                    <TouchableOpacity style={styles.securityActionRow} onPress={handleEmailReset}>
                                        <View style={[styles.securityIconBox, { backgroundColor: W.skyBg }]}>
                                            <Ionicons name="mail" size={20} color={W.sky} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.securityActionTitle}>Send Password Reset Email</Text>
                                            <Text style={styles.securityActionDesc}>Dispatches recovery instructions to {user.email}.</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={W.textSubtle} />
                                    </TouchableOpacity>

                                    <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 }} />

                                    <Text style={styles.label}>Direct Admin Password Override</Text>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                            placeholder="Enter new account password"
                                            placeholderTextColor={W.textSubtle}
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry
                                        />
                                        <TouchableOpacity
                                            onPress={handleManualPasswordReset}
                                            disabled={!newPassword}
                                            style={[styles.btnSmall, { backgroundColor: newPassword ? W.charcoal : '#E2E8F0' }]}
                                        >
                                            <Text style={{ color: newPassword ? '#FFFFFF' : W.textMuted, fontWeight: '800', fontSize: 13.5 }}>Override</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Danger Zone Card */}
                                <View style={[styles.card, { borderColor: '#FECACA', backgroundColor: '#FFF5F5' }]}>
                                    <SectionHeader title="Account Restrictions & Enforcement" icon="alert-circle" color={W.crimson} />

                                    <View style={styles.switchRow}>
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <Text style={styles.switchLabel}>Suspend Full Access</Text>
                                            <Text style={styles.switchDesc}>Completely blocks customer from logging into the platform.</Text>
                                        </View>
                                        <SwitchBtn
                                            value={user.is_banned}
                                            onToggle={() => handleToggleStatus('is_banned', user.is_banned)}
                                            color={W.crimson}
                                        />
                                    </View>

                                    <View style={{ height: 1, backgroundColor: '#FEE2E2', marginVertical: 14 }} />

                                    <View style={styles.switchRow}>
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <Text style={styles.switchLabel}>Restrict Transactions</Text>
                                            <Text style={styles.switchDesc}>User can browse listings, but purchasing and ordering are blocked.</Text>
                                        </View>
                                        <SwitchBtn
                                            value={user.is_restricted}
                                            onToggle={() => handleToggleStatus('is_restricted', user.is_restricted)}
                                            color={W.gold}
                                        />
                                    </View>
                                </View>
                            </View>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* ── WALLET CREDIT/DEBIT MODAL WITH QUICK-AMOUNT BUTTONS ──────── */}
                <Modal visible={transactVisible} transparent animationType="fade" onRequestClose={() => setTransactVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                        <View style={styles.transactCard}>
                            <View style={[styles.transactIconBox, { backgroundColor: transactType === 'credit' ? W.emeraldBg : W.crimsonBg }]}>
                                <Ionicons
                                    name={transactType === 'credit' ? "wallet" : "card"}
                                    size={32}
                                    color={transactType === 'credit' ? W.emerald : W.crimson}
                                />
                            </View>

                            <Text style={styles.transactTitle}>
                                {transactType === 'credit' ? 'Credit Wallet Funds' : 'Debit Wallet Funds'}
                            </Text>
                            <Text style={styles.transactSub}>
                                Enter the Naira amount to {transactType} for {user.full_name || 'user'}.
                            </Text>

                            {/* Quick picks */}
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, width: '100%' }}>
                                {['1000', '5000', '10000', '50000'].map(val => (
                                    <TouchableOpacity
                                        key={val}
                                        onPress={() => setAmount(val)}
                                        style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: amount === val ? W.goldBg : '#F8FAFC', borderWidth: 1, borderColor: amount === val ? W.gold : W.cardBorder, alignItems: 'center' }}
                                    >
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: amount === val ? W.gold : W.textBody }}>
                                            +{fmtAmt(val)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TextInput
                                placeholder="Amount in Naira (₦)"
                                placeholderTextColor={W.textSubtle}
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                                style={styles.transactInput}
                                autoFocus
                            />

                            <TextInput
                                placeholder="Transaction note / reason (optional)"
                                placeholderTextColor={W.textSubtle}
                                value={note}
                                onChangeText={setNote}
                                style={styles.transactNoteInput}
                            />

                            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                                <TouchableOpacity onPress={() => setTransactVisible(false)} style={styles.btnSecondary}>
                                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleTransaction}
                                    disabled={transacting}
                                    style={[styles.btnPrimary, { backgroundColor: transactType === 'credit' ? W.emerald : W.crimson }]}
                                >
                                    {transacting ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <Text style={styles.btnPrimaryText}>Confirm Transaction</Text>
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

// ─── Warm Luxury Styling ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: W.canvas,
    },
    heroHdr: {
        backgroundColor: W.cardBg,
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: W.cardBorder,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
            android: { elevation: 2 }
        })
    },
    heroTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    heroCircleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: W.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroRolePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 18,
        borderWidth: 1,
    },
    heroRolePillTxt: {
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    heroCentre: {
        alignItems: 'center',
        marginBottom: 12,
    },
    heroAvatarRing: {
        borderRadius: 36,
        borderWidth: 2,
        padding: 2,
    },
    heroVerifyDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    heroName: {
        fontSize: 18,
        fontWeight: '900',
        color: W.charcoal,
        marginTop: 8,
        letterSpacing: -0.3,
    },
    heroEmail: {
        fontSize: 12,
        color: W.textMuted,
        marginTop: 2,
        fontWeight: '500',
    },
    heroChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
        justifyContent: 'center',
    },
    heroChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 16,
        borderWidth: 1,
    },
    heroChipTxt: {
        fontSize: 10,
        fontWeight: '800',
    },
    heroStrip: {
        flexDirection: 'row',
        backgroundColor: '#FAF8F5',
        marginHorizontal: -16,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: W.cardBorder,
    },
    heroStripItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    heroStripIconBox: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroStripDiv: {
        width: 1,
        backgroundColor: W.cardBorder,
        marginHorizontal: 3,
    },
    heroStripLbl: {
        fontSize: 9.5,
        color: W.textMuted,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    heroStripVal: {
        fontSize: 13.5,
        fontWeight: '900',
    },
    heroStripVal2: {
        fontSize: 11.5,
        fontWeight: '800',
        color: W.charcoal,
    },
    tabContainer: {
        flexDirection: 'row',
        padding: 3,
        backgroundColor: '#FFFFFF',
        marginHorizontal: 14,
        marginVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
    },
    tabBtnActive: {
        backgroundColor: W.canvas,
    },
    tabText: {
        fontSize: 12,
        fontWeight: '700',
        color: W.textMuted,
    },
    tabTextActive: {
        color: W.charcoal,
        fontWeight: '900',
    },
    scrollContent: {
        paddingHorizontal: 14,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: W.cardBorder,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4 },
            android: { elevation: 2 }
        })
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    formGroup: {
        marginBottom: 14,
    },
    label: {
        fontSize: 13,
        fontWeight: '800',
        color: '#475569',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: W.cardBorder,
        borderRadius: 14,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 15,
        color: W.charcoal,
    },
    inputDisabled: {
        backgroundColor: '#F1F5F9',
        color: '#475569',
        borderColor: W.cardBorder,
    },
    roleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    roleCard: {
        width: (width - 68) / 2,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        position: 'relative',
    },
    roleIconBox: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    roleCardText: {
        fontSize: 13.5,
    },
    checkCircle: {
        position: 'absolute',
        top: -5,
        right: -5,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    readOnlyField: {
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    readOnlyLabel: {
        fontSize: 10.5,
        color: W.textMuted,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    readOnlyValue: {
        fontSize: 15,
        fontWeight: '900',
        color: W.charcoal,
        marginTop: 3,
    },
    driverGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    driverCell: {
        width: '47%',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    driverCellLabel: {
        fontSize: 10.5,
        color: W.sky,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    driverCellValue: {
        fontSize: 14,
        fontWeight: '900',
        color: W.charcoal,
    },
    templateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
    },
    templateBtnTxt: {
        flex: 1,
        fontSize: 13,
        fontWeight: '800',
        color: '#166534',
        marginLeft: 10,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 12,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 13.5,
    },
    balanceCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: W.cardBorder,
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
            android: { elevation: 2 }
        })
    },
    balanceLabel: {
        color: W.textMuted,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    balanceValue: {
        color: W.emerald,
        fontSize: 26,
        fontWeight: '900',
    },
    balanceActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
        width: '100%',
    },
    balanceBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 12,
    },
    balanceBtnText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 13,
    },
    infoBox: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        backgroundColor: '#F0F9FF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        color: '#0369A1',
        fontWeight: '600',
    },
    orderItem: {
        backgroundColor: '#FFFFFF',
        padding: 18,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    orderNumber: {
        fontWeight: '900',
        fontSize: 15,
        color: W.charcoal,
    },
    statusPill: {
        paddingHorizontal: 9,
        paddingVertical: 3.5,
        borderRadius: 7,
    },
    statusPillText: {
        fontSize: 10.5,
        fontWeight: '800',
    },
    orderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderDate: {
        fontSize: 13,
        color: W.textMuted,
    },
    orderAmount: {
        fontSize: 16,
        fontWeight: '900',
        color: W.charcoal,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 54,
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    emptyText: {
        color: W.charcoal,
        fontSize: 16,
        fontWeight: '900',
        marginTop: 12,
    },
    securityActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    securityIconBox: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
    },
    securityActionTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: W.charcoal,
    },
    securityActionDesc: {
        fontSize: 11.5,
        color: W.textMuted,
        marginTop: 2,
    },
    btnSmall: {
        paddingHorizontal: 18,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    switchLabel: {
        fontSize: 14,
        fontWeight: '900',
        color: W.charcoal,
    },
    switchDesc: {
        fontSize: 11.5,
        color: W.textMuted,
        marginTop: 3,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    transactCard: {
        backgroundColor: '#FFFFFF',
        padding: 26,
        borderRadius: 26,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: W.cardBorder,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20 },
            android: { elevation: 8 }
        })
    },
    transactIconBox: {
        width: 66,
        height: 66,
        borderRadius: 33,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    transactTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: W.charcoal,
        marginBottom: 4,
    },
    transactSub: {
        fontSize: 13,
        color: W.textMuted,
        textAlign: 'center',
        marginBottom: 20,
    },
    transactInput: {
        width: '100%',
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        padding: 15,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: W.cardBorder,
        marginBottom: 12,
        color: W.charcoal,
    },
    transactNoteInput: {
        width: '100%',
        fontSize: 14,
        padding: 15,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: W.cardBorder,
        marginBottom: 22,
        color: W.charcoal,
    },
    btnPrimary: {
        flex: 2,
        paddingVertical: 15,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnPrimaryText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 15,
    },
    btnSecondary: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnSecondaryText: {
        color: '#64748B',
        fontWeight: '800',
        fontSize: 14.5,
    },
});
