import * as React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Image, StyleSheet, Linking, FlatList, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

/* --- HELPER COMPONENTS --- */

const TabButton = ({ title, active, onPress, count }) => (
    <TouchableOpacity
        onPress={onPress}
        style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
        <Text style={[styles.tabText, active && styles.tabTextActive]}>
            {title} {count !== undefined && count > 0 && `(${count})`}
        </Text>
    </TouchableOpacity>
);

const SectionHeader = ({ title, icon, color = '#64748B' }) => (
    <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    </View>
);

const RoleCard = ({ role, selected, onSelect, disabled }) => {
    const getRoleIcon = (r) => {
        switch (r) {
            case 'admin': return 'shield-checkmark';
            case 'vendor': return 'storefront'; // Replaced 'business' with 'storefront'
            case 'driver': return 'bicycle';
            default: return 'person';
        }
    };

    const getColor = (r) => {
        switch (r) {
            case 'admin': return '#EF4444';
            case 'vendor': return '#8B5CF6';
            case 'driver': return '#F59E0B';
            default: return '#3B82F6';
        }
    };

    const color = getColor(role);
    const icon = getRoleIcon(role);

    return (
        <TouchableOpacity
            onPress={() => onSelect(role)}
            disabled={disabled}
            style={[
                styles.roleCard,
                selected && { borderColor: color, backgroundColor: `${color}10` },
                disabled && { opacity: 0.5 }
            ]}
        >
            <View style={[styles.roleIconBox, { backgroundColor: selected ? color : '#F1F5F9' }]}>
                <Ionicons name={icon} size={20} color={selected ? 'white' : '#64748B'} />
            </View>
            <Text style={[styles.roleCardText, selected && { color: color, fontWeight: '800' }]}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
            </Text>
            {selected && <View style={[styles.checkCircle, { backgroundColor: color }]}>
                <Ionicons name="checkmark" size={12} color="white" />
            </View>}
        </TouchableOpacity>
    );
};


/* --- MAIN COMPONENT --- */

export const AdminUserDetails = ({ visible, user, onClose, onUpdate, navigation: propNavigation }) => {
    const internalNavigation = useNavigation();
    const navigation = propNavigation || internalNavigation;
    const insets = useSafeAreaInsets();

    // Data State
    const [wallet, setWallet] = React.useState(null);
    const [orders, setOrders] = React.useState([]);
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
    const [country, setCountry] = React.useState(''); // Not used in UI yet but good for state
    const [adminNotes, setAdminNotes] = React.useState('');
    const [role, setRole] = React.useState('buyer');

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
            setAdminNotes(user.admin_notes || '');
            setRole(user.role || 'buyer');
            setNewPassword('');
            fetchUserData();
        }
    }, [visible, user]);

    const fetchUserData = async () => {
        setLoadingData(true);
        try {
            const { data: walletData } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
            setWallet(walletData || { balance: 0, points: 0 });

            const { data: ordersData } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);
            setOrders(ordersData || []);
        } catch (e) {
            console.log("Error fetching user details:", e);
        } finally {
            setLoadingData(false);
        }
    };

    const handleSaveProfile = async () => {
        // Confirmation for Role Change
        if (role !== user.role && role === 'admin') {
            Alert.alert(
                'Confrm Admin Access',
                `Are you sure you want to promote ${user.email} to ADMIN? They will have full access to the system backend.`,
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
            full_name: fullName,
            phone: phone,
            address: address,
            city: city,
            state: state,
            country: country,
            admin_notes: adminNotes,
            role: role
        }).eq('id', user.id);

        setSaving(false);

        if (error) Alert.alert('Error', error.message);
        else {
            Alert.alert('Success', 'Profile updated successfully.');
            setEditMode(false);
            onUpdate();
        }
    };

    const handleTransaction = async () => {
        const amtVal = parseFloat(amount);
        if (isNaN(amtVal) || amtVal <= 0) return Alert.alert('Invalid Amount');

        setTransacting(true);
        const currentBal = wallet?.balance || 0;
        const newBal = transactType === 'credit' ? currentBal + amtVal : currentBal - amtVal;

        const { error: walletError } = await supabase
            .from('wallets')
            .upsert({ user_id: user.id, balance: newBal, currency: 'NGN' });

        if (walletError) {
            Alert.alert('Error', walletError.message);
            setTransacting(false);
            return;
        }

        const { data: { user: admin } } = await supabase.auth.getUser();
        await supabase.rpc('append_audit_log', {
            user_id: user.id,
            log_entry: {
                event: `WALLET_${transactType.toUpperCase()}`,
                amount: amtVal,
                note: note,
                admin: admin.email,
                timestamp: new Date().toISOString()
            }
        });

        Alert.alert('Success', `Wallet ${transactType}ed successfully.`);
        setTransactVisible(false);
        setTransacting(false);
        setAmount('');
        setNote('');
        fetchUserData();
    };

    const handleManualPasswordReset = async () => {
        if (!newPassword || newPassword.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters.');

        Alert.alert(
            'Confirm Force Reset',
            `Manually set password for ${user.email}?`,
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
                            Alert.alert('Success', 'Password updated manually.');
                            setNewPassword('');
                        }
                    }
                }
            ]
        );
    };

    const handleEmailReset = async () => {
        Alert.alert('Confirm', `Send reset email to ${user.email}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Send Email',
                onPress: async () => {
                    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: 'abumafhal://reset-password' });
                    if (error) Alert.alert('Error', error.message);
                    else Alert.alert('Sent', 'Reset link sent.');
                }
            }
        ]);
    };

    const handleToggleStatus = async (field, currentValue) => {
        const { error } = await supabase.from('profiles').update({ [field]: !currentValue }).eq('id', user.id);
        if (error) Alert.alert('Error', error.message);
        else {
            onUpdate();
            // Optimistic handle
            // In a real app, update local state or re-fetch.
            fetchUserData();
        }
    };

    if (!user) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                        <Ionicons name="close" size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>User Profile</Text>
                    <TouchableOpacity
                        onPress={() => editMode ? handleSaveProfile() : setEditMode(true)}
                        disabled={saving}
                        style={[styles.editButton, editMode && { backgroundColor: '#3B82F6' }]}
                    >
                        {saving ? <ActivityIndicator size="small" color={editMode ? 'white' : '#3B82F6'} /> : (
                            <Text style={[styles.editButtonText, editMode && { color: 'white' }]}>{editMode ? 'Save' : 'Edit'}</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Profile Summary */}
                <View style={styles.summaryContainer}>
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarText}>{(user.full_name || user.email || 'U').charAt(0).toUpperCase()}</Text>
                        <View style={[styles.roleBadgeAbsolute, { backgroundColor: user.role === 'admin' ? '#EF4444' : user.role === 'vendor' ? '#8B5CF6' : '#3B82F6' }]}>
                            <Ionicons name={user.role === 'admin' ? 'shield' : user.role === 'vendor' ? 'storefront' : 'person'} size={12} color="white" />
                        </View>
                    </View>
                    <View style={{ alignItems: 'center', marginTop: 12 }}>
                        <Text style={styles.profileName}>{user.full_name || 'No Name'}</Text>
                        <Text style={styles.profileEmail}>{user.email}</Text>
                        <Text style={styles.profileId}>ID: {user.id.slice(0, 8)}...</Text>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TabButton title="Overview" active={activeTab === 'overview'} onPress={() => setActiveTab('overview')} />
                    <TabButton title="Wallet" active={activeTab === 'wallet'} onPress={() => setActiveTab('wallet')} />
                    <TabButton title="Orders" count={orders.length} active={activeTab === 'orders'} onPress={() => setActiveTab('orders')} />
                    <TabButton title="Security" active={activeTab === 'security'} onPress={() => setActiveTab('security')} />
                </View>

                {/* Content */}
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                        {/* ---------------- OVERVIEW ---------------- */}
                        {activeTab === 'overview' && (
                            <View style={{ gap: 24 }}>
                                {/* Role Selector (Only in Edit Mode or View Mode Display) */}
                                <View>
                                    <SectionHeader title="Role & Permissions" icon="people" />
                                    {editMode ? (
                                        <View style={styles.roleGrid}>
                                            {['buyer', 'vendor', 'driver', 'admin'].map(r => (
                                                <RoleCard key={r} role={r} selected={role === r} onSelect={setRole} />
                                            ))}
                                        </View>
                                    ) : (
                                        <View style={styles.readOnlyField}>
                                            <Text style={styles.readOnlyLabel}>Current Role</Text>
                                            <Text style={styles.readOnlyValue}>{user.role?.toUpperCase()}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Personal Info */}
                                <View>
                                    <SectionHeader title="Personal Details" icon="person-circle" />
                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>Full Name</Text>
                                        <TextInput
                                            style={[styles.input, !editMode && styles.inputDisabled]}
                                            value={fullName} onChangeText={setFullName} editable={editMode}
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>Phone Number</Text>
                                        <TextInput
                                            style={[styles.input, !editMode && styles.inputDisabled]}
                                            value={phone} onChangeText={setPhone} editable={editMode} keyboardType="phone-pad"
                                        />
                                    </View>
                                </View>

                                {/* Location */}
                                <View>
                                    <SectionHeader title="Location" icon="location" />
                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>Address</Text>
                                        <TextInput
                                            style={[styles.input, !editMode && styles.inputDisabled]}
                                            value={address} onChangeText={setAddress} editable={editMode} placeholder="Street Address"
                                        />
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={[styles.formGroup, { flex: 1 }]}>
                                            <Text style={styles.label}>City</Text>
                                            <TextInput
                                                style={[styles.input, !editMode && styles.inputDisabled]}
                                                value={city} onChangeText={setCity} editable={editMode} placeholder="City"
                                            />
                                        </View>
                                        <View style={[styles.formGroup, { flex: 1 }]}>
                                            <Text style={styles.label}>State</Text>
                                            <TextInput
                                                style={[styles.input, !editMode && styles.inputDisabled]}
                                                value={state} onChangeText={setState} editable={editMode} placeholder="State"
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Admin Notes */}
                                <View>
                                    <SectionHeader title="Internal Notes" icon="document-text" />
                                    <TextInput
                                        style={[styles.input, { height: 100, textAlignVertical: 'top' }, !editMode && styles.inputDisabled]}
                                        value={adminNotes} onChangeText={setAdminNotes} editable={editMode} multiline
                                        placeholder="Add notes visible only to admins..."
                                    />
                                </View>

                                {/* Quick Actions */}
                                <View style={{ marginTop: 20 }}>
                                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${user.phone}`)} style={styles.largeActionBtn}>
                                        <Ionicons name="call" size={20} color="white" />
                                        <Text style={styles.largeActionBtnText}>Call User</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* ---------------- WALLET ---------------- */}
                        {activeTab === 'wallet' && (
                            <View style={{ gap: 24 }}>
                                <View style={styles.balanceCard}>
                                    <Text style={styles.balanceLabel}>Current Balance</Text>
                                    <Text style={styles.balanceValue}>₦{(wallet?.balance || 0).toLocaleString()}</Text>
                                    <View style={styles.balanceActions}>
                                        <TouchableOpacity
                                            onPress={() => { setTransactType('credit'); setTransactVisible(true); }}
                                            style={[styles.balanceBtn, { backgroundColor: '#22C55E' }]}
                                        >
                                            <Ionicons name="arrow-down-circle" size={20} color="white" />
                                            <Text style={styles.balanceBtnText}>Credit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => { setTransactType('debit'); setTransactVisible(true); }}
                                            style={[styles.balanceBtn, { backgroundColor: '#EF4444' }]}
                                        >
                                            <Ionicons name="arrow-up-circle" size={20} color="white" />
                                            <Text style={styles.balanceBtnText}>Debit</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.infoBox}>
                                    <Ionicons name="information-circle" size={20} color="#3B82F6" />
                                    <Text style={styles.infoText}>
                                        Transactions modify the user's wallet immediately. All actions are logged.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* ---------------- ORDERS ---------------- */}
                        {activeTab === 'orders' && (
                            <View>
                                {orders.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="cart-outline" size={64} color="#CBD5E1" />
                                        <Text style={styles.emptyText}>No orders found</Text>
                                    </View>
                                ) : (
                                    orders.map(order => (
                                        <View key={order.id} style={styles.orderItem}>
                                            <View style={styles.orderHeader}>
                                                <Text style={styles.orderNumber}>#{order.id.toString().slice(0, 8)}</Text>
                                                <View style={[styles.statusPill, {
                                                    backgroundColor: order.status === 'delivered' ? '#DCFCE7' : '#F1F5F9'
                                                }]}>
                                                    <Text style={[styles.statusPillText, {
                                                        color: order.status === 'delivered' ? '#16A34A' : '#64748B'
                                                    }]}>{order.status.toUpperCase()}</Text>
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

                        {/* ---------------- SECURITY ---------------- */}
                        {activeTab === 'security' && (
                            <View style={{ gap: 24 }}>
                                <View style={styles.securitySection}>
                                    <SectionHeader title="Authentication" icon="lock-closed" />

                                    <TouchableOpacity style={styles.securityActionRow} onPress={handleEmailReset}>
                                        <View style={styles.securityIconBox}>
                                            <Ionicons name="mail" size={20} color="#3B82F6" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.securityActionTitle}>Send Password Reset Email</Text>
                                            <Text style={styles.securityActionDesc}>Send a link to the user's inbox.</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                                    </TouchableOpacity>

                                    <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 }} />

                                    <Text style={styles.label}>Manual Password Override</Text>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                            placeholder="Enter new password"
                                            value={newPassword} onChangeText={setNewPassword} secureTextEntry
                                        />
                                        <TouchableOpacity
                                            onPress={handleManualPasswordReset}
                                            disabled={!newPassword}
                                            style={[styles.btnSmall, { backgroundColor: newPassword ? '#0F172A' : '#E2E8F0' }]}
                                        >
                                            <Text style={{ color: newPassword ? 'white' : '#94A3B8', fontWeight: 'bold' }}>Set</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={[styles.securitySection, { borderColor: '#FECACA' }]}>
                                    <SectionHeader title="Danger Zone" icon="alert-circle" color="#EF4444" />

                                    <View style={styles.switchRow}>
                                        <Text style={styles.switchLabel}>Block User Access</Text>
                                        <SwitchBtn value={user.is_banned} onToggle={() => handleToggleStatus('is_banned', user.is_banned)} color="#EF4444" />
                                    </View>
                                    <Text style={styles.switchDesc}>Prevent this user from logging in entirely.</Text>

                                    <View style={styles.switchRow}>
                                        <Text style={styles.switchLabel}>Restrict Purchasing</Text>
                                        <SwitchBtn value={user.is_restricted} onToggle={() => handleToggleStatus('is_restricted', user.is_restricted)} color="#F59E0B" />
                                    </View>
                                    <Text style={styles.switchDesc}>Allow login but disable buying/selling.</Text>
                                </View>
                            </View>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Transaction Modal Overlay */}
                <Modal visible={transactVisible} transparent animationType="fade" onRequestClose={() => setTransactVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                        <View style={styles.transactCard}>
                            <View style={styles.transactIconBox}>
                                <Ionicons name={transactType === 'credit' ? "wallet" : "card"} size={32} color={transactType === 'credit' ? "#22C55E" : "#EF4444"} />
                            </View>
                            <Text style={styles.transactTitle}>{transactType === 'credit' ? 'Add Funds' : 'Deduct Funds'}</Text>
                            <Text style={styles.transactSub}>Enter amount to {transactType} user wallet.</Text>

                            <TextInput
                                placeholder="Amount (₦)"
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                                style={styles.transactInput}
                                autoFocus
                            />
                            <TextInput
                                placeholder="Reason / Note (Optional)"
                                value={note}
                                onChangeText={setNote}
                                style={styles.transactNoteInput}
                            />

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity onPress={() => setTransactVisible(false)} style={styles.btnSecondary}>
                                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleTransaction} disabled={transacting} style={[styles.btnPrimary, { backgroundColor: transactType === 'credit' ? '#22C55E' : '#EF4444' }]}>
                                    {transacting ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Confirm</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </View>
        </Modal>
    );
};

/* --- SHARED STYLES --- */

const SwitchBtn = ({ value, onToggle, color }) => (
    <TouchableOpacity onPress={onToggle} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: value ? color : '#E2E8F0', padding: 2, justifyContent: 'center' }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'white', alignSelf: value ? 'flex-end' : 'flex-start', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }} />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9' },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    iconButton: { padding: 8, borderRadius: 20, backgroundColor: '#F8FAFC' },
    editButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
    editButtonText: { fontSize: 14, fontWeight: '600', color: '#64748B' },

    // Summary
    summaryContainer: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderColor: '#F1F5F9' },
    avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    avatarText: { fontSize: 32, fontWeight: '800', color: '#64748B' },
    roleBadgeAbsolute: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
    profileName: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
    profileEmail: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    profileId: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

    // Tabs
    tabContainer: { flexDirection: 'row', padding: 4, backgroundColor: '#F1F5F9', margin: 16, borderRadius: 12 },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    tabBtnActive: { backgroundColor: 'white', boxShadow: '0px 2px 4px rgba(0,0,0,0.05)', elevation: 2 },
    tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    tabTextActive: { color: '#0F172A' },

    // Scroll Content
    scrollContent: { paddingHorizontal: 20 },

    // Sections
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 8 },
    sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

    // Forms
    formGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 },
    input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 15, color: '#0F172A' },
    inputDisabled: { backgroundColor: '#F8FAFC', color: '#64748B', borderColor: 'transparent' },

    // Roles
    roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    roleCard: { width: (width - 60) / 2, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', gap: 10 },
    roleIconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    roleCardText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    checkCircle: { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
    readOnlyField: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10 },
    readOnlyLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' },
    readOnlyValue: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 4 },

    // Buttons
    largeActionBtn: { backgroundColor: '#0F172A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 10 },
    largeActionBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
    btnSmall: { paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

    // Wallet
    balanceCard: { backgroundColor: '#0F172A', padding: 24, borderRadius: 20, alignItems: 'center' },
    balanceLabel: { color: '#94A3B8', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
    balanceValue: { color: 'white', fontSize: 40, fontWeight: '900' },
    balanceActions: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
    balanceBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8 },
    balanceBtnText: { color: 'white', fontWeight: '700' },
    infoBox: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#EFF6FF', borderRadius: 12 },
    infoText: { flex: 1, fontSize: 13, lineHeight: 20, color: '#1E40AF' },

    // Orders
    orderItem: { backgroundColor: 'white', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12 },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    orderNumber: { fontWeight: '700', fontSize: 15, color: '#0F172A' },
    statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusPillText: { fontSize: 10, fontWeight: '700' },
    orderRow: { flexDirection: 'row', justifyContent: 'space-between' },
    orderDate: { fontSize: 13, color: '#64748B' },
    orderAmount: { fontSize: 15, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#94A3B8', marginTop: 12, fontWeight: '600' },

    // Security
    securitySection: { padding: 16, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    securityActionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    securityIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    securityActionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    securityActionDesc: { fontSize: 12, color: '#64748B' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 4 },
    switchLabel: { fontSize: 14, fontWeight: '600', color: '#334155' },
    switchDesc: { fontSize: 12, color: '#64748B', maxWidth: '80%' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    transactCard: { backgroundColor: 'white', padding: 24, borderRadius: 24, alignItems: 'center' },
    transactIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    transactTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
    transactSub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 },
    transactInput: { width: '100%', fontSize: 24, fontWeight: '700', textAlign: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, marginBottom: 12 },
    transactNoteInput: { width: '100%', fontSize: 14, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, marginBottom: 24 },
    btnPrimary: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    btnPrimaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
    btnSecondary: { padding: 16, marginRight: 12 },
    btnSecondaryText: { color: '#64748B', fontWeight: '600' }
});
