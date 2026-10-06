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

// ─── Theme Colors (Pristine Luxury Light) ────────────────────────────────────
const L = {
    bgCanvas: '#F8FAFC',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    gold: '#D97706',
    goldBg: '#FEF3C7',
    goldBorder: '#FDE68A',
    emerald: '#059669',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    crimson: '#DC2626',
    crimsonBg: '#FEF2F2',
    crimsonBorder: '#FECACA',
    sky: '#0284C7',
    skyBg: '#F0F9FF',
    skyBorder: '#BAE6FD',
    purple: '#7C3AED',
    purpleBg: '#F5F3FF',
    purpleBorder: '#DDD6FE',
    textHeading: '#0F172A',
    textBody: '#334155',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
};

// ─── Tab Button Helper ───────────────────────────────────────────────────────
const TabButton = ({ title, active, onPress, count, icon }) => (
    <TouchableOpacity
        onPress={onPress}
        style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
        <Ionicons
            name={icon}
            size={14}
            color={active ? L.textHeading : L.textMuted}
            style={{ marginRight: 5 }}
        />
        <Text style={[styles.tabText, active && styles.tabTextActive]}>
            {title} {count !== undefined && count > 0 ? `(${count})` : ''}
        </Text>
    </TouchableOpacity>
);

// ─── Section Header Helper ───────────────────────────────────────────────────
const SectionHeader = ({ title, icon, color = L.textHeading }) => (
    <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    </View>
);

// ─── Role Card Helper ────────────────────────────────────────────────────────
const RoleCard = ({ role, selected, onSelect, disabled }) => {
    const getRoleMeta = (r) => {
        switch (r) {
            case 'admin': return { icon: 'shield-checkmark', color: L.purple, bg: L.purpleBg, border: L.purpleBorder, label: 'Admin' };
            case 'vendor': return { icon: 'storefront', color: '#EA580C', bg: '#FFF7ED', border: '#FFEDD5', label: 'Vendor' };
            case 'driver': return { icon: 'bicycle', color: L.sky, bg: L.skyBg, border: L.skyBorder, label: 'Driver' };
            default: return { icon: 'person', color: L.emerald, bg: L.emeraldBg, border: L.emeraldBorder, label: 'Customer' };
        }
    };

    const meta = getRoleMeta(role);

    return (
        <TouchableOpacity
            onPress={() => onSelect(role)}
            disabled={disabled}
            style={[
                styles.roleCard,
                { borderColor: selected ? meta.color : L.cardBorder, backgroundColor: selected ? meta.bg : '#FFFFFF' },
                disabled && { opacity: 0.5 }
            ]}
        >
            <View style={[styles.roleIconBox, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
            </View>
            <Text style={[styles.roleCardText, { color: selected ? meta.color : L.textBody, fontWeight: selected ? '900' : '700' }]}>
                {meta.label}
            </Text>
            {selected && (
                <View style={[styles.checkCircle, { backgroundColor: meta.color }]}>
                    <Ionicons name="checkmark" size={11} color="white" />
                </View>
            )}
        </TouchableOpacity>
    );
};

// ─── Switch Button Helper ───────────────────────────────────────────────────
const SwitchBtn = ({ value, onToggle, color = L.emerald }) => (
    <TouchableOpacity
        onPress={onToggle}
        style={{
            width: 46,
            height: 26,
            borderRadius: 13,
            backgroundColor: value ? color : '#E2E8F0',
            padding: 2,
            justifyContent: 'center'
        }}
    >
        <View style={{
            width: 22,
            height: 22,
            borderRadius: 11,
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

    if (!user) return null;

    const roleColor =
        user.role === 'admin' ? L.purple :
        user.role === 'vendor' ? '#EA580C' :
        user.role === 'driver' ? L.sky : L.emerald;

    const roleBg =
        user.role === 'admin' ? L.purpleBg :
        user.role === 'vendor' ? '#FFF7ED' :
        user.role === 'driver' ? L.skyBg : L.emeraldBg;

    const roleBorder =
        user.role === 'admin' ? L.purpleBorder :
        user.role === 'vendor' ? '#FFEDD5' :
        user.role === 'driver' ? L.skyBorder : L.emeraldBorder;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* ══ PRISTINE LUXURY LIGHT HERO HEADER ══ */}
                <View style={styles.heroHdr}>
                    {/* Top Navigation Row */}
                    <View style={styles.heroTopBar}>
                        <TouchableOpacity onPress={onClose} style={styles.heroCircleBtn}>
                            <Ionicons name="close" size={20} color={L.textHeading} />
                        </TouchableOpacity>

                        <View style={[styles.heroRolePill, { borderColor: roleBorder, backgroundColor: roleBg }]}>
                            <Ionicons
                                name={user.role === 'admin' ? 'shield-checkmark' : user.role === 'vendor' ? 'storefront' : user.role === 'driver' ? 'bicycle' : 'person'}
                                size={12}
                                color={roleColor}
                                style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.heroRolePillTxt, { color: roleColor }]}>
                                {(user.role || 'Customer').toUpperCase()}
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => editMode ? handleSaveProfile() : setEditMode(true)}
                            disabled={saving}
                            style={[styles.heroCircleBtn, editMode && { backgroundColor: L.emerald, borderColor: L.emerald }]}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Ionicons name={editMode ? 'checkmark' : 'create-outline'} size={18} color={editMode ? '#FFFFFF' : L.textHeading} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Avatar & Identity Center */}
                    <View style={styles.heroCentre}>
                        <View style={{ position: 'relative' }}>
                            <View style={[styles.heroAvatarRing, { borderColor: roleBorder }]}>
                                <UserAvatar user={user} size={82} />
                            </View>
                            {user.is_verified && (
                                <View style={styles.heroVerifyDot}>
                                    <Ionicons name="checkmark-circle" size={22} color="#0284C7" />
                                </View>
                            )}
                        </View>

                        <Text style={styles.heroName}>{user.full_name || 'Anonymous User'}</Text>
                        <Text style={styles.heroEmail}>{user.email || 'No email registered'}</Text>

                        {/* Status Pills */}
                        <View style={styles.heroChipRow}>
                            {user.is_banned ? (
                                <View style={[styles.heroChip, { backgroundColor: L.crimsonBg, borderColor: L.crimsonBorder }]}>
                                    <Ionicons name="ban" size={10} color={L.crimson} />
                                    <Text style={[styles.heroChipTxt, { color: L.crimson }]}>Suspended</Text>
                                </View>
                            ) : (
                                <View style={[styles.heroChip, { backgroundColor: L.emeraldBg, borderColor: L.emeraldBorder }]}>
                                    <Ionicons name="shield-checkmark" size={10} color={L.emerald} />
                                    <Text style={[styles.heroChipTxt, { color: L.emerald }]}>Active Account</Text>
                                </View>
                            )}

                            {user.is_restricted && (
                                <View style={[styles.heroChip, { backgroundColor: L.goldBg, borderColor: L.goldBorder }]}>
                                    <Ionicons name="lock-closed" size={10} color={L.gold} />
                                    <Text style={[styles.heroChipTxt, { color: L.gold }]}>Restricted</Text>
                                </View>
                            )}

                            <View style={[styles.heroChip, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                                <Text style={[styles.heroChipTxt, { color: L.textMuted, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                                    ID: {user.id ? user.id.slice(0, 8) : 'N/A'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Financial & Vital Summary Strip */}
                    <View style={styles.heroStrip}>
                        <View style={styles.heroStripItem}>
                            <View style={[styles.heroStripIconBox, { backgroundColor: L.emeraldBg }]}>
                                <Ionicons name="wallet-outline" size={15} color={L.emerald} />
                            </View>
                            <View>
                                <Text style={styles.heroStripLbl}>Wallet Balance</Text>
                                <Text style={[styles.heroStripVal, { color: L.emerald }]}>
                                    ₦{(wallet?.balance || 0).toLocaleString()}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.heroStripDiv} />

                        <View style={styles.heroStripItem}>
                            <View style={[styles.heroStripIconBox, { backgroundColor: '#F1F5F9' }]}>
                                <Ionicons name="calendar-outline" size={15} color={L.textBody} />
                            </View>
                            <View>
                                <Text style={styles.heroStripLbl}>Joined Date</Text>
                                <Text style={styles.heroStripVal2}>
                                    {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : 'Recent'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.heroStripDiv} />

                        <View style={styles.heroStripItem}>
                            <View style={[styles.heroStripIconBox, { backgroundColor: L.skyBg }]}>
                                <Ionicons name="call-outline" size={15} color={L.sky} />
                            </View>
                            <View>
                                <Text style={styles.heroStripLbl}>Phone Contact</Text>
                                <Text style={styles.heroStripVal2} numberOfLines={1}>
                                    {user.phone || 'None'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ── SMOOTH INTERACTIVE TABS ──────────────────────────────── */}
                <View style={styles.tabContainer}>
                    <TabButton title="Overview" active={activeTab === 'overview'} onPress={() => setActiveTab('overview')} icon="grid-outline" />
                    <TabButton title="Wallet" active={activeTab === 'wallet'} onPress={() => setActiveTab('wallet')} icon="wallet-outline" />
                    <TabButton title="Orders" count={orders.length} active={activeTab === 'orders'} onPress={() => setActiveTab('orders')} icon="cart-outline" />
                    <TabButton title="Security" active={activeTab === 'security'} onPress={() => setActiveTab('security')} icon="shield-outline" />
                </View>

                {/* ── SCROLL CONTENT ───────────────────────────────────────── */}
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                        {/* ──────────────── OVERVIEW TAB ──────────────── */}
                        {activeTab === 'overview' && (
                            <View style={{ gap: 20 }}>
                                {/* Role & Permissions Card */}
                                <View style={styles.card}>
                                    <SectionHeader title="Role & Permission Level" icon="people" color={L.textHeading} />
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
                                    <SectionHeader title="Personal Information" icon="person-circle" color={L.textHeading} />
                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>Full Name</Text>
                                        <TextInput
                                            style={[styles.input, !editMode && styles.inputDisabled]}
                                            value={fullName}
                                            onChangeText={setFullName}
                                            editable={editMode}
                                            placeholder="User's full name"
                                            placeholderTextColor={L.textSubtle}
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
                                            placeholderTextColor={L.textSubtle}
                                        />
                                    </View>
                                </View>

                                {/* Location Details Card */}
                                <View style={styles.card}>
                                    <SectionHeader title="Delivery & Shipping Location" icon="location" color={L.textHeading} />
                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>Street Address</Text>
                                        <TextInput
                                            style={[styles.input, !editMode && styles.inputDisabled]}
                                            value={address}
                                            onChangeText={setAddress}
                                            editable={editMode}
                                            placeholder="Street address or landmark"
                                            placeholderTextColor={L.textSubtle}
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
                                                placeholderTextColor={L.textSubtle}
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
                                                placeholderTextColor={L.textSubtle}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Driver Fleet Details if applicable */}
                                {user.role === 'driver' && driverInfo && (
                                    <View style={[styles.card, { backgroundColor: L.skyBg, borderColor: L.skyBorder }]}>
                                        <SectionHeader title="Fleet Courier Profile" icon="bicycle" color={L.sky} />
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
                                                <Text style={[styles.driverCellValue, { color: driverInfo.status === 'active' ? L.emerald : L.crimson }]}>
                                                    {(driverInfo.status || 'Active').toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {/* Admin Internal Memo Card */}
                                <View style={styles.card}>
                                    <SectionHeader title="Internal Administrator Memo" icon="document-text" color={L.gold} />
                                    <TextInput
                                        style={[styles.input, { height: 100, textAlignVertical: 'top' }, !editMode && styles.inputDisabled]}
                                        value={adminNotes}
                                        onChangeText={setAdminNotes}
                                        editable={editMode}
                                        multiline
                                        placeholder="Private administrative observations visible only to staff…"
                                        placeholderTextColor={L.textSubtle}
                                    />
                                </View>

                                {/* Direct Action Buttons */}
                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                                    {user.phone ? (
                                        <TouchableOpacity
                                            onPress={() => Linking.openURL(`tel:${user.phone}`)}
                                            style={[styles.actionBtn, { backgroundColor: L.textHeading }]}
                                        >
                                            <Ionicons name="call" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                                            <Text style={styles.actionBtnText}>Direct Call</Text>
                                        </TouchableOpacity>
                                    ) : null}

                                    {user.phone ? (
                                        <TouchableOpacity
                                            onPress={() => Linking.openURL(`https://wa.me/${user.phone.replace(/[^0-9]/g, '')}`)}
                                            style={[styles.actionBtn, { backgroundColor: '#16A34A' }]}
                                        >
                                            <Ionicons name="logo-whatsapp" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
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
                                            style={[styles.balanceBtn, { backgroundColor: L.emerald }]}
                                        >
                                            <Ionicons name="arrow-down-circle" size={18} color="white" style={{ marginRight: 6 }} />
                                            <Text style={styles.balanceBtnText}>Credit Funds</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => { setTransactType('debit'); setTransactVisible(true); }}
                                            style={[styles.balanceBtn, { backgroundColor: L.crimson }]}
                                        >
                                            <Ionicons name="arrow-up-circle" size={18} color="white" style={{ marginRight: 6 }} />
                                            <Text style={styles.balanceBtnText}>Debit Funds</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.infoBox}>
                                    <Ionicons name="information-circle" size={20} color="#0284C7" />
                                    <Text style={styles.infoText}>
                                        Manual balance adjustments directly affect the customer's spendable marketplace float. All actions are logged.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* ──────────────── ORDERS TAB ──────────────── */}
                        {activeTab === 'orders' && (
                            <View style={{ gap: 12 }}>
                                {orders.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="cart-outline" size={54} color="#CBD5E1" />
                                        <Text style={styles.emptyText}>No orders recorded yet</Text>
                                        <Text style={{ fontSize: 12, color: L.textMuted, marginTop: 4 }}>This customer has not placed any marketplace orders.</Text>
                                    </View>
                                ) : (
                                    orders.map(order => (
                                        <View key={order.id} style={styles.orderItem}>
                                            <View style={styles.orderHeader}>
                                                <Text style={styles.orderNumber}>Order #{order.id.toString().slice(0, 8)}</Text>
                                                <View style={[styles.statusPill, {
                                                    backgroundColor: order.status === 'delivered' ? L.emeraldBg : '#F1F5F9'
                                                }]}>
                                                    <Text style={[styles.statusPillText, {
                                                        color: order.status === 'delivered' ? L.emerald : L.textMuted
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
                                    <SectionHeader title="Authentication Controls" icon="lock-closed" color={L.textHeading} />

                                    <TouchableOpacity style={styles.securityActionRow} onPress={handleEmailReset}>
                                        <View style={[styles.securityIconBox, { backgroundColor: L.skyBg }]}>
                                            <Ionicons name="mail" size={18} color={L.sky} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.securityActionTitle}>Send Password Reset Email</Text>
                                            <Text style={styles.securityActionDesc}>Dispatches recovery instructions to {user.email}.</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={L.textSubtle} />
                                    </TouchableOpacity>

                                    <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 }} />

                                    <Text style={styles.label}>Direct Password Override</Text>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                            placeholder="Enter new account password"
                                            placeholderTextColor={L.textSubtle}
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry
                                        />
                                        <TouchableOpacity
                                            onPress={handleManualPasswordReset}
                                            disabled={!newPassword}
                                            style={[styles.btnSmall, { backgroundColor: newPassword ? L.textHeading : '#E2E8F0' }]}
                                        >
                                            <Text style={{ color: newPassword ? '#FFFFFF' : L.textMuted, fontWeight: '800', fontSize: 13 }}>Override</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Danger Zone Card */}
                                <View style={[styles.card, { borderColor: '#FECACA', backgroundColor: '#FFF5F5' }]}>
                                    <SectionHeader title="Account Restrictions & Enforcement" icon="alert-circle" color={L.crimson} />

                                    <View style={styles.switchRow}>
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <Text style={styles.switchLabel}>Suspend Full Access</Text>
                                            <Text style={styles.switchDesc}>Completely blocks customer from logging into the platform.</Text>
                                        </View>
                                        <SwitchBtn
                                            value={user.is_banned}
                                            onToggle={() => handleToggleStatus('is_banned', user.is_banned)}
                                            color={L.crimson}
                                        />
                                    </View>

                                    <View style={{ height: 1, backgroundColor: '#FEE2E2', marginVertical: 12 }} />

                                    <View style={styles.switchRow}>
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <Text style={styles.switchLabel}>Restrict Transactions</Text>
                                            <Text style={styles.switchDesc}>User can browse listings, but purchasing and ordering are blocked.</Text>
                                        </View>
                                        <SwitchBtn
                                            value={user.is_restricted}
                                            onToggle={() => handleToggleStatus('is_restricted', user.is_restricted)}
                                            color={L.gold}
                                        />
                                    </View>
                                </View>
                            </View>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* ── WALLET CREDIT/DEBIT MODAL ── */}
                <Modal visible={transactVisible} transparent animationType="fade" onRequestClose={() => setTransactVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                        <View style={styles.transactCard}>
                            <View style={[styles.transactIconBox, { backgroundColor: transactType === 'credit' ? L.emeraldBg : L.crimsonBg }]}>
                                <Ionicons
                                    name={transactType === 'credit' ? "wallet" : "card"}
                                    size={30}
                                    color={transactType === 'credit' ? L.emerald : L.crimson}
                                />
                            </View>

                            <Text style={styles.transactTitle}>
                                {transactType === 'credit' ? 'Credit Wallet Funds' : 'Debit Wallet Funds'}
                            </Text>
                            <Text style={styles.transactSub}>
                                Enter the Naira amount to {transactType} for {user.full_name || 'user'}.
                            </Text>

                            <TextInput
                                placeholder="Amount in Naira (₦)"
                                placeholderTextColor={L.textSubtle}
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                                style={styles.transactInput}
                                autoFocus
                            />

                            <TextInput
                                placeholder="Transaction note / reason (optional)"
                                placeholderTextColor={L.textSubtle}
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
                                    style={[styles.btnPrimary, { backgroundColor: transactType === 'credit' ? L.emerald : L.crimson }]}
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

// ─── Pristine Light Styling ──────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    heroHdr: {
        backgroundColor: '#FFFFFF',
        paddingTop: 16,
        paddingHorizontal: 18,
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
            android: { elevation: 2 }
        })
    },
    heroTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    heroCircleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroRolePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
    },
    heroRolePillTxt: {
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    heroCentre: {
        alignItems: 'center',
        marginBottom: 18,
    },
    heroAvatarRing: {
        borderRadius: 48,
        borderWidth: 2.5,
        padding: 3,
    },
    heroVerifyDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    heroName: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: 12,
        letterSpacing: -0.3,
    },
    heroEmail: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
        fontWeight: '500',
    },
    heroChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
        justifyContent: 'center',
    },
    heroChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 3.5,
        borderRadius: 20,
        borderWidth: 1,
    },
    heroChipTxt: {
        fontSize: 10,
        fontWeight: '800',
    },
    heroStrip: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        marginHorizontal: -18,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    heroStripItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
        backgroundColor: '#E2E8F0',
        marginHorizontal: 4,
    },
    heroStripLbl: {
        fontSize: 9,
        color: '#64748B',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    heroStripVal: {
        fontSize: 13,
        fontWeight: '900',
    },
    heroStripVal2: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0F172A',
    },
    tabContainer: {
        flexDirection: 'row',
        padding: 4,
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
    },
    tabBtnActive: {
        backgroundColor: '#F1F5F9',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    tabTextActive: {
        color: '#0F172A',
        fontWeight: '900',
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4 },
            android: { elevation: 1 }
        })
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    formGroup: {
        marginBottom: 12,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: '#0F172A',
    },
    inputDisabled: {
        backgroundColor: '#F1F5F9',
        color: '#475569',
        borderColor: '#E2E8F0',
    },
    roleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    roleCard: {
        width: (width - 64) / 2,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        position: 'relative',
    },
    roleIconBox: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    roleCardText: {
        fontSize: 13,
    },
    checkCircle: {
        position: 'absolute',
        top: -5,
        right: -5,
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    readOnlyField: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    readOnlyLabel: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    readOnlyValue: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: 2,
    },
    driverGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    driverCell: {
        width: '47%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    driverCellLabel: {
        fontSize: 10,
        color: '#0284C7',
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 3,
    },
    driverCellValue: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14,
    },
    balanceCard: {
        backgroundColor: '#FFFFFF',
        padding: 22,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
            android: { elevation: 2 }
        })
    },
    balanceLabel: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    balanceValue: {
        color: '#059669',
        fontSize: 34,
        fontWeight: '900',
    },
    balanceActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
        width: '100%',
    },
    balanceBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        borderRadius: 14,
    },
    balanceBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 13,
    },
    infoBox: {
        flexDirection: 'row',
        gap: 10,
        padding: 14,
        backgroundColor: '#F0F9FF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
        color: '#0369A1',
        fontWeight: '500',
    },
    orderItem: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    orderNumber: {
        fontWeight: '800',
        fontSize: 14,
        color: '#0F172A',
    },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '800',
    },
    orderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderDate: {
        fontSize: 12,
        color: '#64748B',
    },
    orderAmount: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptyText: {
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '800',
        marginTop: 10,
    },
    securityActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    securityIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    securityActionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    securityActionDesc: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    btnSmall: {
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    switchLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    switchDesc: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    transactCard: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16 },
            android: { elevation: 6 }
        })
    },
    transactIconBox: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    transactTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 4,
    },
    transactSub: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 18,
    },
    transactInput: {
        width: '100%',
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
        padding: 14,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10,
        color: '#0F172A',
    },
    transactNoteInput: {
        width: '100%',
        fontSize: 13,
        padding: 14,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 20,
        color: '#0F172A',
    },
    btnPrimary: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnPrimaryText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14,
    },
    btnSecondary: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnSecondaryText: {
        color: '#64748B',
        fontWeight: '700',
        fontSize: 14,
    },
});
