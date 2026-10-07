import * as React from 'react';
import {
    View, Text, Modal, TouchableOpacity, ScrollView, TextInput,
    ActivityIndicator, Alert, StyleSheet, Linking, KeyboardAvoidingView,
    Platform, Dimensions, Clipboard
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../components/UserAvatar';

const { width } = Dimensions.get('window');

// ─── Warm Luxury Palette (Neither Stark White Nor Dark) ─────────────────────
const W = {
    canvas: '#F6F3EC',          // Warm alabaster cream canvas
    canvasAlt: '#EFE8DC',       // Warm champagne divider tone
    cardBg: '#FFFFFF',          // Crisp warm porcelain card
    cardBorder: '#E6DFD3',      // Warm champagne stone border
    cardBorderHighlight: '#D5C9B3',
    gold: '#B45309',            // Rich metallic bronze-gold
    goldLight: '#D97706',
    goldBg: '#FEF3C7',
    goldBorder: '#FDE68A',
    emerald: '#047857',
    emeraldLight: '#10B981',
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
    { min: 1000000, next: null, label: 'Diamond VIP', icon: 'diamond', color: W.purple, bg: W.purpleBg, border: W.purpleBorder, barColor: '#9333EA' },
    { min: 250000, next: 1000000, label: 'Gold Elite', icon: 'ribbon', color: W.gold, bg: W.goldBg, border: W.goldBorder, barColor: '#D97706' },
    { min: 50000, next: 250000, label: 'Silver Member', icon: 'shield-outline', color: '#475569', bg: '#F1F5F9', border: '#E2E8F0', barColor: '#64748B' },
    { min: 0, next: 50000, label: 'Starter Tier', icon: 'sparkles', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', barColor: '#B45309' },
];
const getTier = (spend = 0) => TIERS.find(t => spend >= t.min) || TIERS[3];

const PRESET_TAGS = [
    { id: 'vip', label: '⭐ VIP Client', color: W.gold, bg: W.goldBg, border: W.goldBorder },
    { id: 'wholesale', label: '📦 Wholesaler', color: W.sky, bg: W.skyBg, border: W.skyBorder },
    { id: 'loyal', label: '❤️ Top Spender', color: '#BE123C', bg: '#FFF1F2', border: '#FECDD3' },
    { id: 'fast', label: '⚡ Fast Payer', color: W.emerald, bg: W.emeraldBg, border: W.emeraldBorder },
    { id: 'verified', label: '🛡️ Verified ID', color: W.purple, bg: W.purpleBg, border: W.purpleBorder },
    { id: 'risk', label: '⚠️ High Risk', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
];

export const AdminUserDetails = ({ visible, user, navigation, onClose, onUpdate }) => {
    const insets = useSafeAreaInsets();

    // Data State
    const [wallet, setWallet] = React.useState(null);
    const [transactions, setTransactions] = React.useState([]);
    const [orders, setOrders] = React.useState([]);
    const [driverInfo, setDriverInfo] = React.useState(null);
    const [loadingData, setLoadingData] = React.useState(false);

    // Active Tab
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
    const [selectedTags, setSelectedTags] = React.useState([]);
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
            
            // Extract notes and tags
            const rawNote = user.admin_note || user.admin_notes || '';
            setAdminNotes(rawNote);
            
            // Parse tags from note if present
            const tagMatch = rawNote.match(/\[TAGS:(.*?)\]/);
            if (tagMatch && tagMatch[1]) {
                const tagsFound = tagMatch[1].split(',').map(t => t.trim()).filter(Boolean);
                setSelectedTags(tagsFound);
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
                supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
                supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
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

    // Commercial Metrics
    const totalSpent = React.useMemo(() => {
        return orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    }, [orders]);
    const avgOrderVal = orders.length > 0 ? (totalSpent / orders.length) : 0;
    const tier = getTier(totalSpent);

    // Progress to next tier
    const tierProgress = React.useMemo(() => {
        if (!tier.next) return 100;
        const currentTierBase = tier.min;
        const range = tier.next - currentTierBase;
        const currentProgress = totalSpent - currentTierBase;
        return Math.min(100, Math.max(5, Math.round((currentProgress / range) * 100)));
    }, [tier, totalSpent]);

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

    // Toggle Tag
    const handleToggleTag = async (tagId) => {
        const nextTags = selectedTags.includes(tagId)
            ? selectedTags.filter(t => t !== tagId)
            : [...selectedTags, tagId];
        
        setSelectedTags(nextTags);
        
        // Clean base note and embed tags
        const baseNote = adminNotes.replace(/\[TAGS:(.*?)\]/g, '').trim();
        const updatedNote = nextTags.length > 0 
            ? `${baseNote}\n[TAGS: ${nextTags.join(', ')}]`.trim()
            : baseNote;
        
        setAdminNotes(updatedNote);
        
        try {
            await supabase.from('profiles').update({ admin_note: updatedNote }).eq('id', user.id);
            if (onUpdate) onUpdate();
        } catch (e) {
            console.log("Tag update err:", e);
        }
    };

    // 1-Tap Copy Full Executive Dossier
    const handleCopyDossier = () => {
        const lines = [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🏛️ ABU MAFHAL EXECUTIVE DOSSIER`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `👤 Name: ${user.full_name || 'Anonymous User'}`,
            `🆔 User ID: ${user.id}`,
            `📧 Email: ${user.email || 'N/A'}`,
            `📞 Phone: ${user.phone || 'N/A'}`,
            `🎭 Role: ${(role || 'customer').toUpperCase()}`,
            `🛡️ KYC: ${isVerified ? 'VERIFIED ✓' : 'PENDING'}`,
            `💳 Wallet Float: ${fmtAmt(wallet?.balance || 0)}`,
            `🛍️ Total Orders: ${orders.length}`,
            `💎 Lifetime Value: ${fmtAmt(totalSpent)}`,
            `🏆 VIP Status: ${tier.label}`,
            `🏷️ Tags: ${selectedTags.length > 0 ? selectedTags.join(', ') : 'None'}`,
            `📍 Location: ${city || ''} ${state || ''} ${address || ''}`.trim(),
            `🗓️ Joined: ${user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB') : 'N/A'}`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        ];
        copyText(lines.join('\n'), 'Full Executive Dossier');
    };

    // Instant Quick Credit (+₦500, +₦1,000, +₦5,000)
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
                    description: `Instant Quick Credit +₦${amt.toLocaleString()}`,
                    status: 'completed'
                });
            } catch (e) {}

            setWallet(prev => ({ ...prev, balance: nextBal }));
            Alert.alert('Wallet Credited', `Successfully credited ${fmtAmt(amt)} to ${user.full_name || 'user'}'s account.`);
            fetchUserData();
            if (onUpdate) onUpdate();
        } catch (err) {
            Alert.alert('Error', 'Quick credit operation failed.');
        }
    };

    // Toggle KYC Verification
    const handleToggleKYC = async () => {
        const nextVal = !isVerified;
        try {
            const { error } = await supabase.from('profiles').update({ is_verified: nextVal }).eq('id', user.id);
            if (error) throw error;
            setIsVerified(nextVal);
            Alert.alert('KYC Updated', nextVal ? 'Account verified successfully.' : 'KYC verification revoked.');
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
            Alert.alert('Status Updated', nextVal ? 'Account suspended.' : 'Account restored.');
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
            Alert.alert('Restriction Updated', nextVal ? 'Checkout access restricted.' : 'Restrictions lifted.');
            if (onUpdate) onUpdate();
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    // Execute Custom Wallet Adjustment
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

            Alert.alert('Complete', `Wallet successfully ${transactType}ed with ${fmtAmt(amt)}.`);
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
            Alert.alert('Saved', 'Profile updated successfully.');
            if (onUpdate) onUpdate();
        } catch (e) {
            Alert.alert('Save Failed', e.message);
        } finally {
            setSaving(false);
        }
    };

    // Password Override
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
            Alert.alert('Success', 'Password has been overridden.');
            setNewPassword('');
        } catch (e) {
            Alert.alert('Notice', 'Direct RPC failed. Please use Dispatch Email Reset for standard recovery.');
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

    // WhatsApp Launcher
    const sendWhatsApp = (msg) => {
        if (!user.phone) {
            Alert.alert('No Phone', 'No telephone number recorded for this customer.');
            return;
        }
        const clean = user.phone.replace(/[^0-9]/g, '');
        Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`);
    };

    if (!user) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={S.container}>

                {/* ── 1. LUXURY EXECUTIVE TOP BAR ── */}
                <View style={S.topBar}>
                    <TouchableOpacity onPress={onClose} style={S.iconCircleBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={19} color={W.charcoal} />
                    </TouchableOpacity>

                    <View style={S.topBarCenter}>
                        <View style={[S.badgePill, { backgroundColor: W.goldBg, borderColor: W.goldBorder }]}>
                            <Ionicons name="shield-checkmark" size={11} color={W.gold} style={{ marginRight: 3 }} />
                            <Text style={[S.badgeTxt, { color: W.gold }]}>{(role || 'customer').toUpperCase()}</Text>
                        </View>
                        {isVerified && (
                            <View style={[S.badgePill, { backgroundColor: W.skyBg, borderColor: W.skyBorder, marginLeft: 6 }]}>
                                <Ionicons name="checkmark-circle" size={11} color={W.sky} style={{ marginRight: 2 }} />
                                <Text style={[S.badgeTxt, { color: W.sky }]}>VERIFIED</Text>
                            </View>
                        )}
                        {isSuspended && (
                            <View style={[S.badgePill, { backgroundColor: W.crimsonBg, borderColor: W.crimsonBorder, marginLeft: 6 }]}>
                                <Ionicons name="lock-closed" size={10} color={W.crimson} style={{ marginRight: 2 }} />
                                <Text style={[S.badgeTxt, { color: W.crimson }]}>FROZEN</Text>
                            </View>
                        )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity onPress={handleCopyDossier} style={S.dossierCopyBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <Ionicons name="copy-outline" size={13} color={W.charcoal} />
                            <Text style={S.dossierCopyBtnTxt}>Dossier</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => editMode ? handleSaveProfile() : setEditMode(true)}
                            disabled={saving}
                            style={[S.editSaveBtn, editMode && { backgroundColor: W.emerald, borderColor: W.emerald }]}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name={editMode ? "checkmark" : "create-outline"} size={13} color={editMode ? "#FFFFFF" : W.charcoal} />
                                    <Text style={[S.editSaveBtnText, editMode && { color: '#FFFFFF' }]}>
                                        {editMode ? "Save" : "Edit"}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── 2. DECORATED EXECUTIVE IDENTITY HERO CARD ── */}
                <LinearGradient
                    colors={['#FFFFFF', '#FDFBF7', '#FAF5EC']}
                    style={S.heroCard}
                >
                    <View style={S.heroTopRow}>
                        {/* Avatar with Halo Frame */}
                        <View style={S.avatarFrame}>
                            <UserAvatar user={user} size={48} />
                            {isVerified ? (
                                <View style={S.verifyHaloDot}>
                                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                                </View>
                            ) : null}
                            {totalSpent >= 250000 && (
                                <View style={S.crownBadge}>
                                    <Ionicons name="ribbon" size={10} color={W.gold} />
                                </View>
                            )}
                        </View>

                        {/* Identity & Direct Contact */}
                        <View style={S.heroDetails}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={S.heroName} numberOfLines={1}>{user.full_name || 'Anonymous User'}</Text>
                                <View style={[S.tierMicroBadge, { backgroundColor: tier.bg, borderColor: tier.border }]}>
                                    <Text style={[S.tierMicroBadgeTxt, { color: tier.color }]}>{tier.label}</Text>
                                </View>
                            </View>

                            <View style={S.contactLine}>
                                <Ionicons name="mail-outline" size={11} color={W.textSubtle} />
                                <Text style={S.contactTxt} numberOfLines={1}>{user.email || 'No email'}</Text>
                                {user.email && (
                                    <TouchableOpacity onPress={() => copyText(user.email, 'Email')} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                                        <Ionicons name="copy-outline" size={11} color={W.textSubtle} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {user.phone && (
                                <View style={[S.contactLine, { marginTop: 2 }]}>
                                    <Ionicons name="call-outline" size={11} color={W.textSubtle} />
                                    <Text style={S.contactTxt}>{user.phone}</Text>
                                    <TouchableOpacity onPress={() => copyText(user.phone, 'Phone')} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                                        <Ionicons name="copy-outline" size={11} color={W.textSubtle} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* VIP Loyalty Tier Progress Bar (Decoration & Feature) */}
                    <View style={S.tierProgressContainer}>
                        <View style={S.tierProgressHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="sparkles" size={11} color={tier.color} />
                                <Text style={[S.tierProgressLbl, { color: tier.color }]}>VIP Progress: {tier.label}</Text>
                            </View>
                            <Text style={S.tierProgressVal}>
                                {tier.next ? `${fmtAmt(totalSpent)} / ${fmtAmt(tier.next)} (${tierProgress}%)` : `Diamond Top (${fmtAmt(totalSpent)})`}
                            </Text>
                        </View>
                        <View style={S.tierProgressTrack}>
                            <View style={[S.tierProgressFill, { width: `${tierProgress}%`, backgroundColor: tier.barColor }]} />
                        </View>
                    </View>

                    {/* 4 Decorated Metric Tiles */}
                    <View style={S.kpiGrid}>
                        <View style={S.kpiTile}>
                            <View style={[S.kpiIconDot, { backgroundColor: W.emeraldBg }]}>
                                <Ionicons name="wallet" size={11} color={W.emerald} />
                            </View>
                            <Text style={S.kpiLabel}>Wallet Float</Text>
                            <Text style={[S.kpiVal, { color: W.emerald }]}>{fmtAmt(wallet?.balance || 0)}</Text>
                        </View>

                        <View style={S.kpiTile}>
                            <View style={[S.kpiIconDot, { backgroundColor: W.skyBg }]}>
                                <Ionicons name="cart" size={11} color={W.sky} />
                            </View>
                            <Text style={S.kpiLabel}>Total Orders</Text>
                            <Text style={S.kpiVal}>{orders.length}</Text>
                        </View>

                        <View style={S.kpiTile}>
                            <View style={[S.kpiIconDot, { backgroundColor: W.goldBg }]}>
                                <Ionicons name="trending-up" size={11} color={W.gold} />
                            </View>
                            <Text style={S.kpiLabel}>Lifetime Value</Text>
                            <Text style={[S.kpiVal, { color: W.gold }]}>{fmtAmt(totalSpent)}</Text>
                        </View>

                        <View style={S.kpiTile}>
                            <View style={[S.kpiIconDot, { backgroundColor: W.purpleBg }]}>
                                <Ionicons name="ribbon" size={11} color={W.purple} />
                            </View>
                            <Text style={S.kpiLabel}>Avg Basket</Text>
                            <Text style={[S.kpiVal, { color: W.purple }]}>{fmtAmt(avgOrderVal)}</Text>
                        </View>
                    </View>

                    {/* Multi-Channel Quick Action Launcher */}
                    <View style={S.multiChannelDock}>
                        {user.phone ? (
                            <TouchableOpacity onPress={() => Linking.openURL(`tel:${user.phone}`)} style={S.channelBtn}>
                                <Ionicons name="call" size={12} color={W.charcoal} />
                                <Text style={S.channelBtnTxt}>Call</Text>
                            </TouchableOpacity>
                        ) : null}

                        {user.phone ? (
                            <TouchableOpacity onPress={() => Linking.openURL(`sms:${user.phone}`)} style={S.channelBtn}>
                                <Ionicons name="chatbubble-ellipses" size={12} color={W.sky} />
                                <Text style={[S.channelBtnTxt, { color: W.sky }]}>SMS</Text>
                            </TouchableOpacity>
                        ) : null}

                        {user.phone ? (
                            <TouchableOpacity
                                onPress={() => sendWhatsApp(`Hello ${user.full_name || 'Valued Customer'}, greetings from Abu Mafhal Marketplace!`)}
                                style={[S.channelBtn, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]}
                            >
                                <Ionicons name="logo-whatsapp" size={12} color="#15803D" />
                                <Text style={[S.channelBtnTxt, { color: '#15803D' }]}>WhatsApp</Text>
                            </TouchableOpacity>
                        ) : null}

                        {user.email ? (
                            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${user.email}`)} style={S.channelBtn}>
                                <Ionicons name="mail" size={12} color={W.purple} />
                                <Text style={[S.channelBtnTxt, { color: W.purple }]}>Email</Text>
                            </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity onPress={() => handleQuickCredit(1000)} style={[S.channelBtn, { backgroundColor: W.emeraldBg, borderColor: W.emeraldBorder }]}>
                            <Ionicons name="flash" size={12} color={W.emerald} />
                            <Text style={[S.channelBtnTxt, { color: W.emerald }]}>+₦1K</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleToggleKYC} style={[S.channelBtn, isVerified && { backgroundColor: W.skyBg, borderColor: W.skyBorder }]}>
                            <Ionicons name="shield-checkmark" size={12} color={isVerified ? W.sky : W.textMuted} />
                            <Text style={[S.channelBtnTxt, isVerified && { color: W.sky }]}>
                                {isVerified ? 'KYC ✓' : 'Verify'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* ── 3. SEGMENTED NAVIGATION TABS ── */}
                <View style={S.tabsBar}>
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
                                <Ionicons name={t.icon} size={13} color={active ? W.charcoal : W.textMuted} style={{ marginRight: 4 }} />
                                <Text style={[S.tabItemTxt, active && S.tabItemTxtActive]}>
                                    {t.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── 4. TAB CONTENT ── */}
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false}>

                        {/* ────────────── TAB 1: OVERVIEW ────────────── */}
                        {activeTab === 'overview' && (
                            <View style={{ gap: 12 }}>
                                
                                {/* Interactive Customer Tags Manager */}
                                <View style={S.decoratedCard}>
                                    <View style={S.cardHeaderRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                            <Ionicons name="pricetags" size={14} color={W.gold} />
                                            <Text style={S.cardHeading}>Customer Badges & Classification Tags</Text>
                                        </View>
                                        <Text style={{ fontSize: 9.5, color: W.textMuted, fontWeight: '700' }}>Tap to toggle</Text>
                                    </View>
                                    <View style={S.tagsContainer}>
                                        {PRESET_TAGS.map(tag => {
                                            const isSelected = selectedTags.includes(tag.id);
                                            return (
                                                <TouchableOpacity
                                                    key={tag.id}
                                                    onPress={() => handleToggleTag(tag.id)}
                                                    style={[
                                                        S.tagPill,
                                                        isSelected
                                                            ? { backgroundColor: tag.bg, borderColor: tag.color }
                                                            : { backgroundColor: '#F8FAFC', borderColor: W.cardBorder }
                                                    ]}
                                                >
                                                    <Text style={[S.tagPillTxt, isSelected ? { color: tag.color, fontWeight: '800' } : { color: W.textMuted }]}>
                                                        {tag.label}
                                                    </Text>
                                                    {isSelected && (
                                                        <Ionicons name="checkmark-circle" size={11} color={tag.color} style={{ marginLeft: 3 }} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Account Audit & Activity Milestones Timeline */}
                                <View style={S.decoratedCard}>
                                    <View style={S.cardHeaderRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                            <Ionicons name="time" size={14} color={W.charcoal} />
                                            <Text style={S.cardHeading}>Account Audit & Activity Milestones</Text>
                                        </View>
                                    </View>

                                    <View style={S.timelineWrapper}>
                                        {/* Step 1: Registered */}
                                        <View style={S.timelineStep}>
                                            <View style={[S.timelineDot, { backgroundColor: W.emerald }]}>
                                                <Ionicons name="person-add" size={10} color="#FFFFFF" />
                                            </View>
                                            <View style={S.timelineBody}>
                                                <Text style={S.timelineTitle}>Account Registered</Text>
                                                <Text style={S.timelineSub}>
                                                    {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown date'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Step 2: KYC */}
                                        <View style={S.timelineStep}>
                                            <View style={[S.timelineDot, { backgroundColor: isVerified ? W.sky : W.textSubtle }]}>
                                                <Ionicons name={isVerified ? "shield-checkmark" : "shield-outline"} size={10} color="#FFFFFF" />
                                            </View>
                                            <View style={S.timelineBody}>
                                                <Text style={S.timelineTitle}>KYC Verification Status</Text>
                                                <Text style={[S.timelineSub, isVerified && { color: W.sky, fontWeight: '700' }]}>
                                                    {isVerified ? 'Identity Authenticated & Approved' : 'Pending Customer Submission'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Step 3: Wallet Activity */}
                                        <View style={S.timelineStep}>
                                            <View style={[S.timelineDot, { backgroundColor: transactions.length > 0 ? W.gold : W.textSubtle }]}>
                                                <Ionicons name="wallet" size={10} color="#FFFFFF" />
                                            </View>
                                            <View style={S.timelineBody}>
                                                <Text style={S.timelineTitle}>Wallet Activity</Text>
                                                <Text style={S.timelineSub}>
                                                    {transactions.length > 0 ? `Latest: ${fmtAmt(transactions[0].amount)} (${transactions[0].type || 'Ledger'})` : 'No transactions recorded yet'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Step 4: Orders */}
                                        <View style={[S.timelineStep, { borderLeftWidth: 0, paddingBottom: 0 }]}>
                                            <View style={[S.timelineDot, { backgroundColor: orders.length > 0 ? W.purple : W.textSubtle }]}>
                                                <Ionicons name="cart" size={10} color="#FFFFFF" />
                                            </View>
                                            <View style={S.timelineBody}>
                                                <Text style={S.timelineTitle}>Marketplace Commercial Activity</Text>
                                                <Text style={S.timelineSub}>
                                                    {orders.length > 0 ? `Completed ${orders.length} orders totaling ${fmtAmt(totalSpent)}` : 'No orders placed yet'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* WhatsApp Communication Presets */}
                                {user.phone ? (
                                    <View style={S.decoratedCard}>
                                        <View style={S.cardHeaderRow}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                <Ionicons name="logo-whatsapp" size={14} color="#15803D" />
                                                <Text style={[S.cardHeading, { color: '#15803D' }]}>One-Tap WhatsApp Business Presets</Text>
                                            </View>
                                        </View>
                                        <View style={{ gap: 6 }}>
                                            {[
                                                { title: '👋 Welcome & Onboarding', msg: `Hello ${user.full_name || 'Valued Customer'}, welcome to Abu Mafhal Marketplace! Your account is active. How may we assist you today?` },
                                                { title: '✅ KYC Verification Approved', msg: `Congratulations ${user.full_name || ''}! Your marketplace account and identification documents have been approved successfully.` },
                                                { title: '💰 Wallet Funded Receipt', msg: `Hello ${user.full_name || ''}, your marketplace wallet float has just been updated. You can review your statement anytime.` },
                                                { title: '📦 Order Follow-up Desk', msg: `Hello ${user.full_name || ''}, checking in from Abu Mafhal Marketplace regarding your orders. Is everything running smoothly?` },
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
                                                    <Ionicons name="send" size={12} color="#15803D" style={{ marginLeft: 6 }} />
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                ) : null}

                                {/* Personal Profile & Address */}
                                <View style={S.decoratedCard}>
                                    <View style={S.cardHeaderRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                            <Ionicons name="person-circle" size={15} color={W.charcoal} />
                                            <Text style={S.cardHeading}>Identity & Delivery Information</Text>
                                        </View>
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
                                <View style={S.decoratedCard}>
                                    <View style={S.cardHeaderRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                            <Ionicons name="document-text" size={14} color={W.gold} />
                                            <Text style={[S.cardHeading, { color: W.gold }]}>Internal Staff Observation Memo</Text>
                                        </View>
                                    </View>
                                    <TextInput
                                        value={adminNotes}
                                        onChangeText={setAdminNotes}
                                        editable={editMode}
                                        multiline
                                        style={[S.fieldInput, { height: 75, textAlignVertical: 'top' }, !editMode && S.fieldInputDisabled]}
                                        placeholder="Add private staff records or compliance notes…"
                                        placeholderTextColor={W.textSubtle}
                                    />
                                </View>
                            </View>
                        )}

                        {/* ────────────── TAB 2: WALLET & LEDGER ────────────── */}
                        {activeTab === 'wallet' && (
                            <View style={{ gap: 12 }}>
                                
                                {/* Fintech Styled Wallet Float Card */}
                                <LinearGradient
                                    colors={['#0F172A', '#1E293B']}
                                    style={S.fintechCard}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>
                                            Abu Mafhal Wallet Float
                                        </Text>
                                        <View style={S.fintechChip}>
                                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#10B981' }}>● LIVE LEDGER</Text>
                                        </View>
                                    </View>

                                    <Text style={S.fintechBalance}>{fmtAmt(wallet?.balance || 0)}</Text>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
                                        <View>
                                            <Text style={{ fontSize: 10, color: '#94A3B8' }}>Pending Clearing</Text>
                                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#F59E0B', marginTop: 1 }}>
                                                {fmtAmt(wallet?.pending_balance || 0)}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ fontSize: 10, color: '#94A3B8' }}>Currency</Text>
                                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF', marginTop: 1 }}>NGN (₦)</Text>
                                        </View>
                                    </View>
                                </LinearGradient>

                                {/* Instant Quick Action Preset Chips */}
                                <View style={S.decoratedCard}>
                                    <View style={S.cardHeaderRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                            <Ionicons name="flash" size={14} color={W.emerald} />
                                            <Text style={S.cardHeading}>Instant Quick Balance Presets</Text>
                                        </View>
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                                        {[
                                            { amt: 500, label: '+₦500', color: W.emerald, bg: W.emeraldBg, border: W.emeraldBorder },
                                            { amt: 1000, label: '+₦1,000', color: W.emerald, bg: W.emeraldBg, border: W.emeraldBorder },
                                            { amt: 2500, label: '+₦2,500', color: W.emerald, bg: W.emeraldBg, border: W.emeraldBorder },
                                            { amt: 5000, label: '+₦5,000', color: W.emerald, bg: W.emeraldBg, border: W.emeraldBorder },
                                            { amt: 10000, label: '+₦10,000', color: W.emerald, bg: W.emeraldBg, border: W.emeraldBorder },
                                        ].map(btn => (
                                            <TouchableOpacity
                                                key={btn.amt}
                                                onPress={() => handleQuickCredit(btn.amt)}
                                                style={[S.quickAmtChip, { backgroundColor: btn.bg, borderColor: btn.border }]}
                                            >
                                                <Ionicons name="add-circle" size={12} color={btn.color} />
                                                <Text style={[S.quickAmtChipTxt, { color: btn.color }]}>{btn.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                        <TouchableOpacity
                                            onPress={() => { setTransactType('credit'); setTransactVisible(true); }}
                                            style={[S.customAdjustBtn, { backgroundColor: W.emerald }]}
                                        >
                                            <Ionicons name="add" size={15} color="#FFFFFF" />
                                            <Text style={S.customAdjustBtnTxt}>Custom Credit</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => { setTransactType('debit'); setTransactVisible(true); }}
                                            style={[S.customAdjustBtn, { backgroundColor: W.crimson }]}
                                        >
                                            <Ionicons name="remove" size={15} color="#FFFFFF" />
                                            <Text style={S.customAdjustBtnTxt}>Custom Debit</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Recent Ledger Transactions Statement */}
                                <View style={S.decoratedCard}>
                                    <View style={S.cardHeaderRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                            <Ionicons name="receipt" size={14} color={W.charcoal} />
                                            <Text style={S.cardHeading}>Ledger Statement History ({transactions.length})</Text>
                                        </View>
                                    </View>

                                    {transactions.length === 0 ? (
                                        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                                            <Ionicons name="receipt-outline" size={32} color={W.textSubtle} />
                                            <Text style={{ fontSize: 12, color: W.textMuted, marginTop: 6, fontWeight: '600' }}>
                                                No ledger transactions recorded yet.
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
                                                                size={12}
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
                                    <View style={[S.decoratedCard, { alignItems: 'center', paddingVertical: 32 }]}>
                                        <Ionicons name="cart-outline" size={40} color={W.textSubtle} />
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: W.charcoal, marginTop: 8 }}>No Orders Placed</Text>
                                        <Text style={{ fontSize: 11, color: W.textMuted, marginTop: 2 }}>This customer has not completed any purchases yet.</Text>
                                    </View>
                                ) : (
                                    orders.map(order => (
                                        <View key={order.id} style={S.decoratedCard}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={S.orderNum}>Order #{order.id.toString().slice(0, 8)}</Text>
                                                <View style={[S.badgePill, {
                                                    backgroundColor: order.status === 'delivered' ? W.emeraldBg : W.goldBg,
                                                    borderColor: order.status === 'delivered' ? W.emeraldBorder : W.goldBorder
                                                }]}>
                                                    <Text style={[S.badgeTxt, { color: order.status === 'delivered' ? W.emerald : W.gold }]}>
                                                        {(order.status || 'PENDING').toUpperCase()}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                                <Text style={{ fontSize: 11, color: W.textMuted }}>
                                                    {order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
                                                </Text>
                                                <Text style={{ fontSize: 13, fontWeight: '900', color: W.charcoal }}>
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
                                <View style={S.decoratedCard}>
                                    <View style={S.cardHeaderRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                            <Ionicons name="lock-closed" size={14} color={W.crimson} />
                                            <Text style={[S.cardHeading, { color: W.crimson }]}>Security Controls & Access Locks</Text>
                                        </View>
                                    </View>

                                    <View style={S.switchRow}>
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                            <Text style={S.switchTitle}>Account Suspension (Freeze)</Text>
                                            <Text style={S.switchSub}>Locks customer out of authentication.</Text>
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
                                            <Text style={S.switchSub}>User can browse catalog but checkout is disabled.</Text>
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
                                <View style={S.decoratedCard}>
                                    <View style={S.cardHeaderRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                            <Ionicons name="key" size={14} color={W.charcoal} />
                                            <Text style={S.cardHeading}>Manual Password Override</Text>
                                        </View>
                                    </View>
                                    <Text style={{ fontSize: 11, color: W.textMuted, marginBottom: 8 }}>
                                        Set a temporary administrative password immediately:
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
                                        <Ionicons name="mail-outline" size={14} color={W.sky} style={{ marginRight: 6 }} />
                                        <Text style={{ fontSize: 11.5, fontWeight: '800', color: W.sky }}>
                                            Dispatch Password Recovery Link via Email
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={{ height: 36 }} />
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
                                {['1000', '2500', '5000', '10000'].map(val => (
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

// ─── Decorated Executive Stylesheet ─────────────────────────────────────────
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: W.canvas,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 9,
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
    dossierCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    dossierCopyBtnTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: W.charcoal,
    },
    editSaveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    editSaveBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: W.charcoal,
    },
    badgePill: {
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    badgeTxt: {
        fontSize: 9,
        fontWeight: '900',
    },

    // Identity Hero Card
    heroCard: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: W.cardBorder,
    },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarFrame: {
        position: 'relative',
        marginRight: 10,
    },
    verifyHaloDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: W.sky,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    crownBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: W.goldBg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: W.goldBorder,
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
    tierMicroBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 5,
        borderWidth: 1,
    },
    tierMicroBadgeTxt: {
        fontSize: 9,
        fontWeight: '900',
    },
    contactLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    contactTxt: {
        fontSize: 11,
        color: W.textMuted,
        fontWeight: '600',
    },

    // VIP Progress Bar
    tierProgressContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 7,
        borderWidth: 1,
        borderColor: W.cardBorder,
        marginTop: 10,
    },
    tierProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    tierProgressLbl: {
        fontSize: 9.5,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    tierProgressVal: {
        fontSize: 9.5,
        fontWeight: '700',
        color: W.textMuted,
    },
    tierProgressTrack: {
        height: 5,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        overflow: 'hidden',
    },
    tierProgressFill: {
        height: '100%',
        borderRadius: 3,
    },

    // 4 KPI Tiles Grid
    kpiGrid: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 8,
    },
    kpiTile: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 9,
        borderWidth: 1,
        borderColor: W.cardBorder,
        paddingVertical: 6,
        paddingHorizontal: 5,
        alignItems: 'center',
    },
    kpiIconDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    kpiLabel: {
        fontSize: 8,
        fontWeight: '800',
        textTransform: 'uppercase',
        color: W.textMuted,
    },
    kpiVal: {
        fontSize: 11.5,
        fontWeight: '900',
        color: W.charcoal,
        marginTop: 1,
    },

    // Multi-Channel Dock
    multiChannelDock: {
        flexDirection: 'row',
        gap: 5,
        marginTop: 8,
    },
    channelBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingVertical: 5.5,
        borderRadius: 7,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    channelBtnTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: W.charcoal,
    },

    // Segmented Tabs Bar
    tabsBar: {
        flexDirection: 'row',
        padding: 3,
        backgroundColor: W.cardBg,
        marginHorizontal: 12,
        marginVertical: 8,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        borderRadius: 7,
    },
    tabItemActive: {
        backgroundColor: W.canvas,
    },
    tabItemTxt: {
        fontSize: 10.5,
        fontWeight: '700',
        color: W.textMuted,
    },
    tabItemTxtActive: {
        color: W.charcoal,
        fontWeight: '900',
    },

    // Content
    scrollContent: {
        paddingHorizontal: 12,
        paddingBottom: 24,
    },
    decoratedCard: {
        backgroundColor: W.cardBg,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardHeading: {
        fontSize: 11.5,
        fontWeight: '900',
        color: W.charcoal,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },

    // Tags
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    tagPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4.5,
        borderRadius: 7,
        borderWidth: 1,
    },
    tagPillTxt: {
        fontSize: 10.5,
    },

    // Timeline
    timelineWrapper: {
        paddingLeft: 4,
    },
    timelineStep: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderLeftWidth: 1.5,
        borderLeftColor: W.cardBorder,
        paddingLeft: 12,
        paddingBottom: 12,
        marginLeft: 6,
        position: 'relative',
    },
    timelineDot: {
        position: 'absolute',
        left: -8,
        top: 0,
        width: 15,
        height: 15,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineBody: {
        flex: 1,
    },
    timelineTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: W.charcoal,
    },
    timelineSub: {
        fontSize: 10,
        color: W.textMuted,
        marginTop: 1,
    },

    // WhatsApp Presets
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
        fontSize: 10.5,
        fontWeight: '800',
        color: '#15803D',
    },
    presetTmplSnippet: {
        fontSize: 9.5,
        color: '#166534',
        marginTop: 1,
    },

    // Form
    fieldBox: {
        marginBottom: 7,
    },
    fieldLabel: {
        fontSize: 9.5,
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

    // Fintech Wallet Card
    fintechCard: {
        borderRadius: 14,
        padding: 14,
    },
    fintechChip: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    fintechBalance: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 6,
        letterSpacing: -0.5,
    },
    quickAmtChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 7,
        borderWidth: 1,
    },
    quickAmtChipTxt: {
        fontSize: 10.5,
        fontWeight: '800',
    },
    customAdjustBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        borderRadius: 8,
    },
    customAdjustBtnTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF',
    },

    // Ledger Rows
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        gap: 8,
    },
    txIconBox: {
        width: 22,
        height: 22,
        borderRadius: 11,
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
        fontSize: 11.5,
        fontWeight: '900',
    },

    // Orders
    orderNum: {
        fontSize: 12,
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
        fontSize: 11,
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
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
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
        fontSize: 13,
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
        fontSize: 11.5,
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
        fontSize: 11.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
});
