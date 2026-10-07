import * as React from 'react';
import {
    View, Text, TouchableOpacity, FlatList, ActivityIndicator,
    Alert, TextInput, RefreshControl, ScrollView, Modal, StyleSheet,
    Share, Animated, StatusBar, Easing, Pressable, Linking, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { NotificationService } from '../../lib/notifications';
import { UserAvatar } from '../../components/UserAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminUserDetails } from './AdminUserDetails';
import { WhatsAppActionModal } from '../../components/WhatsAppActionModal';

// ─── Warm Luxury Palette (Neither Stark White Nor Dark) ─────────────────────
const W = {
    canvas: '#F5F2EB',          // Warm alabaster cream canvas
    canvasAlt: '#EFEAE1',       // Warm section divider tone
    cardBg: '#FFFFFF',          // Crisp warm porcelain card
    cardBorder: '#E6E0D5',      // Warm champagne/stone border
    cardBorderActive: '#D97706',
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

// ─── Roles Configuration ─────────────────────────────────────────────────────
const ROLES = {
    admin: { label: 'Administrator', color: W.purple, icon: 'shield-checkmark', bg: W.purpleBg, border: W.purpleBorder },
    vendor: { label: 'Merchant Vendor', color: '#C2410C', icon: 'storefront', bg: '#FFF7ED', border: '#FFEDD5' },
    driver: { label: 'Fleet Courier', color: W.sky, icon: 'bicycle', bg: W.skyBg, border: W.skyBorder },
    customer: { label: 'Shopper Client', color: W.emerald, icon: 'person', bg: W.emeraldBg, border: W.emeraldBorder },
};
const getRoleCfg = (role) => ROLES[role] || ROLES.customer;

// ─── Spending Tiers ──────────────────────────────────────────────────────────
const TIERS = [
    { min: 1000000, label: '💎 Diamond VIP', color: W.purple, bg: W.purpleBg, border: W.purpleBorder },
    { min: 250000, label: '🥇 Gold Elite', color: W.gold, bg: W.goldBg, border: W.goldBorder },
    { min: 50000, label: '🥈 Silver Member', color: '#475569', bg: '#F1F5F9', border: '#E2E8F0' },
    { min: 0, label: '🥉 Starter', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
];
const getTier = (spend = 0) => TIERS.find(t => spend >= t.min) || TIERS[3];

const fmtAmt = (val) => {
    if (!val || isNaN(val)) return '₦0';
    const num = Number(val);
    if (num >= 1e6) return `₦${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `₦${(num / 1e3).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`;
    return `₦${num.toLocaleString('en-US')}`;
};

const timeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (sec < 60) return 'Just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
};

const PRESET_TAGS = [
    { id: 'vip', label: '⭐ VIP Client', color: W.gold, bg: W.goldBg, border: W.goldBorder },
    { id: 'wholesale', label: '📦 Wholesale Buyer', color: W.sky, bg: W.skyBg, border: W.skyBorder },
    { id: 'loyal', label: '❤️ High Loyalty', color: '#BE123C', bg: '#FFF1F2', border: '#FECDD3' },
    { id: 'risk', label: '⚠️ Suspicious Activity', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
    { id: 'fraud', label: '🚨 Fraud Alert', color: W.crimson, bg: W.crimsonBg, border: W.crimsonBorder },
    { id: 'partner', label: '🤝 Strategic Partner', color: W.emerald, bg: W.emeraldBg, border: W.emeraldBorder },
    { id: 'priority', label: '⚡ Priority Support', color: W.purple, bg: W.purpleBg, border: W.purpleBorder },
];

export const AdminUsers = ({ navigation: propNav }) => {
    const nav = propNav || useNavigation();
    const insets = useSafeAreaInsets();

    // Data State
    const [users, setUsers] = React.useState([]);
    const [stats, setStats] = React.useState({
        total: 0,
        vendors: 0,
        drivers: 0,
        customers: 0,
        admins: 0,
        banned: 0,
        verified: 0,
        totalBal: 0,
        todayNew: 0,
    });
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);

    // Filters and Search
    const [search, setSearch] = React.useState('');
    const [filter, setFilter] = React.useState('all');
    const [sortBy, setSortBy] = React.useState('newest');

    // Modals & Actionable
    const [selUser, setSelUser] = React.useState(null);
    const [detailVis, setDetailVis] = React.useState(false);
    const [sheetVis, setSheetVis] = React.useState(false);
    const [actUser, setActUser] = React.useState(null);

    // Wallet adjustment modal
    const [walVis, setWalVis] = React.useState(false);
    const [walAmt, setWalAmt] = React.useState('');
    const [walReason, setWalReason] = React.useState('');

    // Role, Note, Tag, Direct Message modals
    const [roleVis, setRoleVis] = React.useState(false);
    const [tagVis, setTagVis] = React.useState(false);
    const [noteVis, setNoteVis] = React.useState(false);
    const [noteText, setNoteText] = React.useState('');
    const [directMsgVis, setDirectMsgVis] = React.useState(false);
    const [directTitle, setDirectTitle] = React.useState('');
    const [directBody, setDirectBody] = React.useState('');

    // Broadcast modal
    const [bcastVis, setBcastVis] = React.useState(false);
    const [bTitle, setBTitle] = React.useState('');
    const [bMsg, setBMsg] = React.useState('');
    const [bcastSending, setBcastSending] = React.useState(false);

    // WhatsApp modal
    const [whatsappVisible, setWhatsappVisible] = React.useState(false);
    const [whatsappPhone, setWhatsappPhone] = React.useState('');
    const [whatsappUserId, setWhatsappUserId] = React.useState(null);
    const [whatsappRecipientName, setWhatsappRecipientName] = React.useState('User');

    // Bulk Actions
    const [selMode, setSelMode] = React.useState(false);
    const [selIds, setSelIds] = React.useState([]);

    const sheetY = React.useRef(new Animated.Value(750)).current;

    const openSheet = (user) => {
        setActUser(user);
        setSheetVis(true);
        Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 11 }).start();
    };

    const closeSheet = (cb) => {
        Animated.timing(sheetY, { toValue: 750, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.ease) }).start(() => {
            setSheetVis(false);
            if (cb) cb();
        });
    };

    React.useEffect(() => {
        loadData();
    }, []);

    // ── Fetch Users & Ecosystem Data ─────────────────────────────────────────
    const loadData = async () => {
        setLoading(true);
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [pRes, wRes, dRes] = await Promise.all([
                supabase.from('profiles').select('*').order('created_at', { ascending: false }).range(0, 500),
                supabase.from('wallets').select('user_id, balance, pending_balance'),
                supabase.from('drivers').select('user_id, vehicle_type, plate_number, vehicle_color, status, name'),
            ]);

            const wMap = {};
            (wRes.data || []).forEach(w => { wMap[w.user_id] = w; });

            const dMap = {};
            (dRes.data || []).forEach(d => { dMap[d.user_id] = d; });

            const list = (pRes.data || []).map(u => ({
                ...u,
                is_online: u.last_seen ? (Date.now() - new Date(u.last_seen).getTime()) < 300000 : false,
                wallet: wMap[u.id] || null,
                tier: getTier(u.total_spend || 0),
                role_cfg: getRoleCfg(u.role),
                tags: u.admin_tags || [],
                driver_info: dMap[u.id] || null,
            }));

            const totalBal = list.reduce((sum, u) => sum + (u.wallet?.balance || 0), 0);
            const todayNew = list.filter(u => new Date(u.created_at) >= today).length;

            setUsers(list);
            setStats({
                total: list.length,
                vendors: list.filter(u => u.role === 'vendor').length,
                drivers: list.filter(u => u.role === 'driver').length,
                customers: list.filter(u => !u.role || u.role === 'customer').length,
                admins: list.filter(u => u.role === 'admin').length,
                banned: list.filter(u => u.is_banned).length,
                verified: list.filter(u => u.is_verified).length,
                totalBal,
                todayNew,
            });
        } catch (err) {
            console.error('Error fetching admin users:', err);
            Alert.alert('Notice', 'Could not refresh user database.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // ── Filters & Search ─────────────────────────────────────────────────────
    const filtered = React.useMemo(() => {
        let list = users;
        if (filter === 'vendor') list = list.filter(u => u.role === 'vendor');
        else if (filter === 'driver') list = list.filter(u => u.role === 'driver');
        else if (filter === 'customer') list = list.filter(u => !u.role || u.role === 'customer');
        else if (filter === 'admin') list = list.filter(u => u.role === 'admin');
        else if (filter === 'banned') list = list.filter(u => u.is_banned);
        else if (filter === 'verified') list = list.filter(u => u.is_verified);
        else if (filter === 'vip') list = list.filter(u => (u.total_spend || 0) >= 250000);
        else if (filter === 'wallet') list = list.filter(u => (u.wallet?.balance || 0) > 0);
        else if (filter === 'online') list = list.filter(u => u.is_online);
        else if (filter === 'new') {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            list = list.filter(u => new Date(u.created_at) >= lastWeek);
        }

        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(u =>
                (u.email || '').toLowerCase().includes(q) ||
                (u.full_name || '').toLowerCase().includes(q) ||
                (u.phone || '').includes(q) ||
                (u.role || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [users, filter, search]);

    const sorted = React.useMemo(() => {
        return [...filtered].sort((a, b) => {
            if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '');
            if (sortBy === 'spend') return (b.total_spend || 0) - (a.total_spend || 0);
            if (sortBy === 'balance') return (b.wallet?.balance || 0) - (a.wallet?.balance || 0);
            if (sortBy === 'active') return new Date(b.last_seen || 0) - new Date(a.last_seen || 0);
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }, [filtered, sortBy]);

    // ── Quick Administrative Actions ─────────────────────────────────────────
    const toggleVerify = async (u) => {
        try {
            const next = !u.is_verified;
            await supabase.from('profiles').update({ is_verified: next }).eq('id', u.id);
            Alert.alert('Status Updated', `${u.full_name || 'User'} is now ${next ? 'Verified' : 'Unverified'}.`);
            loadData();
        } catch {
            Alert.alert('Error', 'Unable to toggle verification.');
        }
    };

    const toggleRestrict = async (u) => {
        try {
            const next = !(u.is_restricted || false);
            await supabase.from('profiles').update({ is_restricted: next }).eq('id', u.id);
            Alert.alert('Access Updated', `${u.full_name || 'User'} is now ${next ? 'Restricted' : 'Unrestricted'}.`);
            loadData();
        } catch {
            Alert.alert('Error', 'Unable to update restriction.');
        }
    };

    const toggleBan = (u) => {
        const nextBan = !u.is_banned;
        Alert.alert(
            nextBan ? 'Confirm Suspension' : 'Confirm Restoration',
            nextBan ? `Are you sure you want to suspend ${u.full_name || 'this user'}?` : `Restore full access for ${u.full_name || 'this user'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: nextBan ? 'Suspend Account' : 'Restore Account',
                    style: nextBan ? 'destructive' : 'default',
                    onPress: async () => {
                        await supabase.from('profiles').update({ is_banned: nextBan }).eq('id', u.id);
                        loadData();
                    }
                }
            ]
        );
    };

    const changeRole = async (u, newRole) => {
        try {
            await supabase.from('profiles').update({ role: newRole }).eq('id', u.id);
            setRoleVis(false);
            Alert.alert('Role Updated', `${u.full_name || 'User'} is now assigned as ${newRole.toUpperCase()}.`);
            loadData();
        } catch {
            Alert.alert('Error', 'Could not assign new role.');
        }
    };

    const makeDriver = async (u) => {
        try {
            const { data } = await supabase.from('drivers').select('id').eq('user_id', u.id).maybeSingle();
            if (data) {
                Alert.alert('Notice', 'User is already registered as an active driver.');
                return;
            }
            await supabase.from('drivers').insert({
                name: u.full_name || 'Fleet Driver',
                phone: u.phone,
                vehicle_type: 'Motorcycle',
                user_id: u.id,
                status: 'active'
            });
            await supabase.from('profiles').update({ role: 'driver' }).eq('id', u.id);
            Alert.alert('Fleet Updated', `${u.full_name || 'User'} promoted to Active Driver.`);
            loadData();
        } catch (err) {
            Alert.alert('Error', 'Failed to promote user to driver.');
        }
    };

    const adjustWallet = async (type) => {
        const amt = parseFloat(walAmt);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid numeric amount.');
            return;
        }

        try {
            if (!actUser?.wallet) {
                await supabase.from('wallets').insert({
                    user_id: actUser.id,
                    balance: type === 'credit' ? amt : 0,
                    pending_balance: 0
                });
            } else {
                const current = actUser.wallet.balance || 0;
                const nextBal = type === 'credit' ? current + amt : Math.max(0, current - amt);
                await supabase.from('wallets').update({ balance: nextBal }).eq('user_id', actUser.id);
            }

            try {
                await supabase.from('wallet_transactions').insert({
                    user_id: actUser.id,
                    amount: amt,
                    type: type === 'credit' ? 'admin_credit' : 'admin_debit',
                    description: walReason.trim() || `Admin manual ${type}`,
                    status: 'completed'
                });
            } catch (ignore) {}

            setWalVis(false);
            setWalAmt('');
            setWalReason('');
            Alert.alert('Wallet Updated', `Successfully ${type === 'credit' ? 'credited' : 'debited'} ${fmtAmt(amt)}.`);
            loadData();
        } catch {
            Alert.alert('Error', 'Failed to adjust user wallet.');
        }
    };

    const toggleTag = async (u, tagId) => {
        const current = u.admin_tags || [];
        const next = current.includes(tagId) ? current.filter(t => t !== tagId) : [...current, tagId];
        await supabase.from('profiles').update({ admin_tags: next }).eq('id', u.id);
        loadData();
    };

    const saveNote = async () => {
        if (!noteText.trim() && !actUser?.admin_note) return;
        await supabase.from('profiles').update({ admin_note: noteText.trim() }).eq('id', actUser.id);
        setNoteVis(false);
        setNoteText('');
        Alert.alert('Success', 'Admin note saved.');
        loadData();
    };

    const sendDirectMessage = async () => {
        if (!directTitle.trim() || !directBody.trim()) {
            Alert.alert('Missing Fields', 'Please fill in both title and message body.');
            return;
        }
        try {
            await NotificationService.send({
                userId: actUser.id,
                title: directTitle.trim(),
                message: directBody.trim(),
                type: 'admin_direct',
                email: actUser.email
            });
            setDirectMsgVis(false);
            setDirectTitle('');
            setDirectBody('');
            Alert.alert('Message Sent', `Notification delivered to ${actUser.full_name || 'user'}.`);
        } catch {
            Alert.alert('Error', 'Unable to dispatch direct message.');
        }
    };

    const handleBulk = async (action) => {
        if (!selIds.length) return;
        let update = {};
        if (action === 'verify') update = { is_verified: true };
        if (action === 'ban') update = { is_banned: true };
        if (action === 'unban') update = { is_banned: false };

        Alert.alert(
            'Batch Execution',
            `Apply action "${action.toUpperCase()}" to ${selIds.length} selected accounts?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: 'destructive',
                    onPress: async () => {
                        await supabase.from('profiles').update(update).in('id', selIds);
                        setSelMode(false);
                        setSelIds([]);
                        loadData();
                    }
                }
            ]
        );
    };

    const sendBroadcast = async () => {
        if (!bTitle.trim() || !bMsg.trim()) {
            Alert.alert('Validation Error', 'Please supply both a broadcast title and message.');
            return;
        }
        setBcastSending(true);
        try {
            const targets = filtered.slice(0, 100);
            for (const u of targets) {
                await NotificationService.send({
                    userId: u.id,
                    title: bTitle.trim(),
                    message: bMsg.trim(),
                    type: 'system_broadcast',
                    email: u.email
                });
            }
            setBcastVis(false);
            setBTitle('');
            setBMsg('');
            Alert.alert('Broadcast Sent', `Delivered notification to ${targets.length} users.`);
        } catch {
            Alert.alert('Error', 'Some broadcast dispatches failed.');
        } finally {
            setBcastSending(false);
        }
    };

    // ── User Card Component (Bigger, Bolder, Spacious) ──────────────────────
    const renderUserCard = ({ item }) => {
        const isSel = selIds.includes(item.id);
        const cfg = item.role_cfg;
        const bal = item.wallet?.balance || 0;
        const pend = item.wallet?.pending_balance || 0;
        const userTags = (item.admin_tags || []).map(id => PRESET_TAGS.find(t => t.id === id)).filter(Boolean);

        return (
            <Pressable
                onLongPress={() => !selMode && openSheet(item)}
                onPress={() => {
                    if (selMode) {
                        setSelIds(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]);
                    } else {
                        setSelUser(item);
                        setDetailVis(true);
                    }
                }}
                style={({ pressed }) => [
                    S.card,
                    pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
                    item.is_banned && S.cardBanned,
                    isSel && S.cardSelected,
                ]}
            >
                {/* Accent glow bar */}
                <View style={[S.cardAccentBar, { backgroundColor: cfg.color }]} />

                {selMode && (
                    <Ionicons
                        name={isSel ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={isSel ? W.gold : W.textSubtle}
                        style={{ marginRight: 12, marginLeft: 6 }}
                    />
                )}

                {/* Big Avatar */}
                <View style={S.avContainer}>
                    <View style={[S.avRing, { borderColor: cfg.border }]}>
                        <UserAvatar user={item} size={44} />
                    </View>
                    <View style={[
                        S.statusDot,
                        item.is_banned ? { backgroundColor: W.crimson } :
                        item.is_restricted ? { backgroundColor: W.gold } :
                        item.is_online ? { backgroundColor: W.emerald } :
                        { backgroundColor: '#CBD5E1' }
                    ]}>
                        {item.is_banned && <Ionicons name="ban" size={9} color="#FFFFFF" />}
                        {item.is_restricted && !item.is_banned && <Ionicons name="lock-closed" size={9} color="#FFFFFF" />}
                    </View>
                </View>

                {/* Primary Information */}
                <View style={S.infoContainer}>
                    <View style={S.nameRow}>
                        <Text style={S.userName} numberOfLines={1}>
                            {item.full_name || 'Anonymous User'}
                        </Text>
                        {item.is_verified && (
                            <Ionicons name="checkmark-circle" size={17} color={W.sky} style={{ marginLeft: 5 }} />
                        )}
                    </View>

                    <Text style={S.userEmail} numberOfLines={1}>
                        {item.email || (item.phone ? item.phone : 'No contact specified')}
                    </Text>

                    {/* Role & Tier Tags */}
                    <View style={S.tagRow}>
                        <View style={[S.chip, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                            <Ionicons name={cfg.icon} size={11} color={cfg.color} style={{ marginRight: 4 }} />
                            <Text style={[S.chipTxt, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>

                        <View style={[S.chip, { backgroundColor: item.tier.bg, borderColor: item.tier.border }]}>
                            <Text style={[S.chipTxt, { color: item.tier.color }]}>{item.tier.label}</Text>
                        </View>

                        {userTags.slice(0, 1).map(tag => (
                            <View key={tag.id} style={[S.chip, { backgroundColor: tag.bg, borderColor: tag.border }]}>
                                <Text style={[S.chipTxt, { color: tag.color }]}>{tag.label}</Text>
                            </View>
                        ))}

                        {item.admin_note ? (
                            <Ionicons name="document-text" size={15} color={W.gold} style={{ marginLeft: 3 }} />
                        ) : null}
                    </View>

                    {/* Big Financial & Time Strip */}
                    <View style={S.bottomStrip}>
                        <View style={[
                            S.walletPill,
                            bal > 0 ? { backgroundColor: W.emeraldBg, borderColor: W.emeraldBorder } : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }
                        ]}>
                            <Ionicons name="wallet-outline" size={13} color={bal > 0 ? W.emerald : W.textMuted} />
                            <Text style={[S.walletText, { color: bal > 0 ? W.emerald : W.textMuted }]}>
                                {fmtAmt(bal)}
                            </Text>
                            {pend > 0 && <Text style={S.walletPending}>+{fmtAmt(pend)}</Text>}
                        </View>

                        <Text style={S.lastActiveText}>
                            {timeAgo(item.last_seen || item.created_at)}
                        </Text>
                    </View>

                    {/* Driver details if role is driver */}
                    {item.role === 'driver' && item.driver_info && (
                        <View style={S.driverStrip}>
                            <Ionicons name="bicycle" size={13} color={W.sky} />
                            <Text style={S.driverStripText} numberOfLines={1}>
                                {item.driver_info.vehicle_type || 'Vehicle'} · {item.driver_info.plate_number || 'No Plate'}
                            </Text>
                            <View style={[
                                S.driverStatusBadge,
                                { backgroundColor: item.driver_info.status === 'active' ? W.emeraldBg : '#F1F5F9' }
                            ]}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: item.driver_info.status === 'active' ? W.emerald : W.textMuted }}>
                                    {(item.driver_info.status || 'OFFLINE').toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Right Interactive Quick Actions */}
                {!selMode && (
                    <View style={S.cardActions}>
                        <TouchableOpacity
                            onPress={() => openSheet(item)}
                            style={S.quickActionBtn}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons name="ellipsis-vertical" size={18} color={W.charcoal} />
                        </TouchableOpacity>
                    </View>
                )}
            </Pressable>
        );
    };

    return (
        <View style={S.container}>
            <StatusBar barStyle="dark-content" backgroundColor={W.canvas} />

            {/* ── WARM LUXURY HEADER ───────────────────────────────────────── */}
            <View style={[S.header, { paddingTop: Math.max(insets.top, 14) + 6 }]}>
                <View style={S.headerTopRow}>
                    <TouchableOpacity
                        onPress={() => {
                            if (selMode) {
                                setSelMode(false);
                                setSelIds([]);
                            } else {
                                nav.goBack();
                            }
                        }}
                        style={S.headerIconBtn}
                    >
                        <Ionicons name={selMode ? 'close' : 'arrow-back'} size={22} color={W.charcoal} />
                    </TouchableOpacity>

                    <View style={S.headerTitleBox}>
                        <Text style={S.headerTitle}>
                            {selMode ? `${selIds.length} Selected` : 'User Management'}
                        </Text>
                        <Text style={S.headerSubtitle}>
                            {stats.total} accounts · {stats.todayNew} new today · {fmtAmt(stats.totalBal)} float
                        </Text>
                    </View>

                    {!selMode ? (
                        <View style={S.headerActions}>
                            <TouchableOpacity
                                onPress={() => setBcastVis(true)}
                                style={[S.headerIconBtn, { backgroundColor: W.goldBg, borderColor: W.goldBorder }]}
                                title="Broadcast"
                            >
                                <Ionicons name="megaphone" size={19} color={W.gold} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    const csv = filtered.map(u => `${u.full_name},${u.email},${u.phone},${u.role},${u.wallet?.balance || 0}`).join('\n');
                                    Share.share({ message: `Name,Email,Phone,Role,Balance\n${csv}` });
                                }}
                                style={S.headerIconBtn}
                            >
                                <Ionicons name="share-outline" size={19} color={W.charcoal} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setSelMode(true)}
                                style={S.headerIconBtn}
                            >
                                <Ionicons name="checkbox-outline" size={19} color={W.charcoal} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={S.headerActions}>
                            <TouchableOpacity
                                onPress={() => handleBulk('verify')}
                                style={[S.headerIconBtn, { backgroundColor: W.emeraldBg, borderColor: W.emeraldBorder }]}
                            >
                                <Ionicons name="checkmark-done" size={19} color={W.emerald} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleBulk('ban')}
                                style={[S.headerIconBtn, { backgroundColor: W.crimsonBg, borderColor: W.crimsonBorder }]}
                            >
                                <Ionicons name="ban" size={19} color={W.crimson} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleBulk('unban')}
                                style={[S.headerIconBtn, { backgroundColor: W.skyBg, borderColor: W.skyBorder }]}
                            >
                                <Ionicons name="shield-checkmark" size={19} color={W.sky} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ── BIGGER KPI METRICS CARDS ─────────────────────────────── */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={S.kpiScroll}
                >
                    {[
                        { label: 'Total Users', val: stats.total, icon: 'people', color: W.charcoal, bg: '#FFFFFF', border: W.cardBorder },
                        { label: 'Vendors', val: stats.vendors, icon: 'storefront', color: '#C2410C', bg: '#FFF7ED', border: '#FFEDD5' },
                        { label: 'Drivers', val: stats.drivers, icon: 'bicycle', color: W.sky, bg: W.skyBg, border: W.skyBorder },
                        { label: 'Customers', val: stats.customers, icon: 'person', color: W.emerald, bg: W.emeraldBg, border: W.emeraldBorder },
                        { label: 'Total Float', val: fmtAmt(stats.totalBal), icon: 'wallet', color: W.gold, bg: W.goldBg, border: W.goldBorder },
                        { label: 'Verified', val: stats.verified, icon: 'checkmark-circle', color: W.sky, bg: W.skyBg, border: W.skyBorder },
                        { label: 'Suspended', val: stats.banned, icon: 'ban', color: W.crimson, bg: W.crimsonBg, border: W.crimsonBorder },
                    ].map((k, i) => (
                        <View key={i} style={[S.kpiCard, { backgroundColor: k.bg, borderColor: k.border }]}>
                            <View style={S.kpiCardTop}>
                                <Ionicons name={k.icon} size={15} color={k.color} />
                                <Text style={[S.kpiVal, { color: k.color }]}>{k.val}</Text>
                            </View>
                            <Text style={S.kpiLabel}>{k.label}</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>

            {/* ── BIG SEARCH & FILTER CONTROLS ─────────────────────────────── */}
            <View style={S.searchContainer}>
                <View style={S.searchBox}>
                    <Ionicons name="search" size={19} color={W.gold} style={{ marginRight: 10 }} />
                    <TextInput
                        placeholder="Search name, email, phone, role…"
                        placeholderTextColor={W.textSubtle}
                        value={search}
                        onChangeText={setSearch}
                        style={S.searchInput}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={20} color={W.textSubtle} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ── BIGGER FILTER PILLS ──────────────────────────────────────── */}
            <View style={S.filterBar}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={S.filterScroll}
                >
                    {[
                        { id: 'all', title: 'All Accounts', count: stats.total },
                        { id: 'customer', title: 'Customers', count: stats.customers },
                        { id: 'vendor', title: 'Vendors', count: stats.vendors },
                        { id: 'driver', title: 'Drivers', count: stats.drivers },
                        { id: 'admin', title: 'Admins', count: stats.admins },
                        { id: 'verified', title: 'Verified' },
                        { id: 'vip', title: 'VIP Tiers' },
                        { id: 'wallet', title: 'Has Balance' },
                        { id: 'online', title: 'Online Now' },
                        { id: 'new', title: 'New This Week' },
                        { id: 'banned', title: 'Suspended', count: stats.banned },
                    ].map((p) => {
                        const active = filter === p.id;
                        return (
                            <TouchableOpacity
                                key={p.id}
                                onPress={() => setFilter(p.id)}
                                style={[S.pill, active && S.pillActive]}
                            >
                                <Text style={[S.pillText, active && S.pillTextActive]}>
                                    {p.title}
                                </Text>
                                {p.count !== undefined && (
                                    <View style={[S.pillBadge, active && S.pillBadgeActive]}>
                                        <Text style={[S.pillBadgeText, active && S.pillBadgeTextActive]}>
                                            {p.count}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ── SORT & TOTALS RIBBON ─────────────────────────────────────── */}
            <View style={S.sortRibbon}>
                <View style={S.sortTotal}>
                    <View style={S.indicatorDot} />
                    <Text style={S.sortTotalText}>
                        {sorted.length} <Text style={{ color: W.textMuted }}>users found</Text>
                    </Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.sortOptions}>
                    {[
                        { key: 'newest', label: 'Recent', icon: 'time-outline' },
                        { key: 'balance', label: 'Balance', icon: 'wallet-outline' },
                        { key: 'spend', label: 'Top Spend', icon: 'cash-outline' },
                        { key: 'active', label: 'Active', icon: 'flash-outline' },
                        { key: 'name', label: 'A-Z', icon: 'text-outline' },
                    ].map(s => {
                        const active = sortBy === s.key;
                        return (
                            <TouchableOpacity
                                key={s.key}
                                onPress={() => setSortBy(s.key)}
                                style={[S.sortChip, active && S.sortChipActive]}
                            >
                                <Ionicons name={s.icon} size={13} color={active ? W.gold : W.textMuted} />
                                <Text style={[S.sortChipText, active && S.sortChipTextActive]}>{s.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ── USER LIST ────────────────────────────────────────────────── */}
            {loading ? (
                <View style={S.loadingContainer}>
                    <ActivityIndicator size="large" color={W.gold} />
                    <Text style={S.loadingText}>Synchronizing user accounts…</Text>
                </View>
            ) : (
                <FlatList
                    data={sorted}
                    keyExtractor={item => item.id}
                    renderItem={renderUserCard}
                    contentContainerStyle={S.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadData();
                            }}
                            tintColor={W.gold}
                            colors={[W.gold]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={S.emptyContainer}>
                            <Ionicons name="people-outline" size={60} color="#CBD5E1" />
                            <Text style={S.emptyTitle}>No matching accounts</Text>
                            <Text style={S.emptySubtitle}>Try adjusting your search query or role filter.</Text>
                        </View>
                    }
                />
            )}

            {/* ── BOTTOM ACTION SHEET (WARM LUXURY, SPACIOUS) ──────────────── */}
            <Modal
                visible={sheetVis}
                transparent
                animationType="none"
                onRequestClose={() => closeSheet()}
            >
                <TouchableOpacity
                    style={S.modalOverlay}
                    activeOpacity={1}
                    onPress={() => closeSheet()}
                />
                <Animated.View style={[S.actionSheet, { transform: [{ translateY: sheetY }] }]}>
                    <View style={S.dragHandle} />

                    {actUser && (
                        <>
                            {/* User Header in Sheet */}
                            <View style={S.sheetUserHeader}>
                                <UserAvatar user={actUser} size={54} />
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={S.sheetUserName} numberOfLines={1}>
                                            {actUser.full_name || 'Anonymous User'}
                                        </Text>
                                        {actUser.is_verified && (
                                            <Ionicons name="checkmark-circle" size={17} color={W.sky} style={{ marginLeft: 5 }} />
                                        )}
                                    </View>
                                    <Text style={S.sheetUserEmail} numberOfLines={1}>{actUser.email || actUser.phone}</Text>
                                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                                        <View style={[S.chip, { backgroundColor: actUser.role_cfg.bg, borderColor: actUser.role_cfg.border }]}>
                                            <Text style={[S.chipTxt, { color: actUser.role_cfg.color }]}>{actUser.role_cfg.label}</Text>
                                        </View>
                                        <View style={[S.chip, { backgroundColor: actUser.tier.bg, borderColor: actUser.tier.border }]}>
                                            <Text style={[S.chipTxt, { color: actUser.tier.color }]}>{actUser.tier.label}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 10, color: W.textMuted, textTransform: 'uppercase', fontWeight: '800' }}>Balance</Text>
                                    <Text style={{ fontSize: 19, fontWeight: '900', color: W.emerald }}>{fmtAmt(actUser.wallet?.balance || 0)}</Text>
                                </View>
                            </View>

                            {/* Internal Note snippet */}
                            {actUser.admin_note ? (
                                <View style={S.sheetNoteCard}>
                                    <Ionicons name="document-text" size={16} color={W.gold} />
                                    <Text style={S.sheetNoteText} numberOfLines={2}>{actUser.admin_note}</Text>
                                </View>
                            ) : null}

                            {/* Quick Action Grid (Bigger Touch Targets) */}
                            <Text style={S.sheetSectionTitle}>Management Controls</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={S.sheetActionsScroll}
                            >
                                {/* Direct WhatsApp */}
                                {actUser.phone ? (
                                    <TouchableOpacity
                                        onPress={() => {
                                            closeSheet(() => {
                                                setWhatsappPhone(actUser.phone);
                                                setWhatsappUserId(actUser.id);
                                                setWhatsappRecipientName(actUser.full_name || 'User');
                                                setWhatsappVisible(true);
                                            });
                                        }}
                                        style={S.sheetActionItem}
                                    >
                                        <View style={[S.sheetActionIcon, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]}>
                                            <Ionicons name="logo-whatsapp" size={24} color="#16A34A" />
                                        </View>
                                        <Text style={[S.sheetActionLabel, { color: '#16A34A' }]}>WhatsApp</Text>
                                    </TouchableOpacity>
                                ) : null}

                                {/* Direct Phone Call */}
                                {actUser.phone ? (
                                    <TouchableOpacity
                                        onPress={() => {
                                            closeSheet(() => Linking.openURL(`tel:${actUser.phone}`));
                                        }}
                                        style={S.sheetActionItem}
                                    >
                                        <View style={[S.sheetActionIcon, { backgroundColor: W.skyBg, borderColor: W.skyBorder }]}>
                                            <Ionicons name="call" size={24} color={W.sky} />
                                        </View>
                                        <Text style={[S.sheetActionLabel, { color: W.sky }]}>Direct Call</Text>
                                    </TouchableOpacity>
                                ) : null}

                                {/* Direct In-App Message */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => setDirectMsgVis(true));
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: W.goldBg, borderColor: W.goldBorder }]}>
                                        <Ionicons name="paper-plane" size={24} color={W.gold} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: W.gold }]}>Direct Alert</Text>
                                </TouchableOpacity>

                                {/* Full Profile */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => {
                                            setSelUser(actUser);
                                            setDetailVis(true);
                                        });
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: W.purpleBg, borderColor: W.purpleBorder }]}>
                                        <Ionicons name="person" size={24} color={W.purple} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: W.purple }]}>Full Profile</Text>
                                </TouchableOpacity>

                                {/* Wallet Adjustment */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => setWalVis(true));
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: W.emeraldBg, borderColor: W.emeraldBorder }]}>
                                        <Ionicons name="wallet" size={24} color={W.emerald} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: W.emerald }]}>Wallet Fund</Text>
                                </TouchableOpacity>

                                {/* Change Role */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => setRoleVis(true));
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' }]}>
                                        <Ionicons name="swap-horizontal" size={24} color="#C2410C" />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: '#C2410C' }]}>Switch Role</Text>
                                </TouchableOpacity>

                                {/* Verify Toggle */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => toggleVerify(actUser));
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: actUser.is_verified ? '#F1F5F9' : W.emeraldBg, borderColor: actUser.is_verified ? W.cardBorder : W.emeraldBorder }]}>
                                        <Ionicons name={actUser.is_verified ? 'close-circle' : 'checkmark-circle'} size={24} color={actUser.is_verified ? W.textMuted : W.emerald} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: actUser.is_verified ? W.textMuted : W.emerald }]}>
                                        {actUser.is_verified ? 'Revoke KYC' : 'Verify KYC'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Suspend Account */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => toggleBan(actUser));
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: W.crimsonBg, borderColor: W.crimsonBorder }]}>
                                        <Ionicons name={actUser.is_banned ? 'shield-checkmark' : 'ban'} size={24} color={W.crimson} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: W.crimson }]}>
                                        {actUser.is_banned ? 'Restore User' : 'Suspend User'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Promote to Driver */}
                                {actUser.role !== 'driver' && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            closeSheet(() => makeDriver(actUser));
                                        }}
                                        style={S.sheetActionItem}
                                    >
                                        <View style={[S.sheetActionIcon, { backgroundColor: W.skyBg, borderColor: W.skyBorder }]}>
                                            <Ionicons name="bicycle" size={24} color={W.sky} />
                                        </View>
                                        <Text style={[S.sheetActionLabel, { color: W.sky }]}>Make Driver</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Admin Tags */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => setTagVis(true));
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: W.goldBg, borderColor: W.goldBorder }]}>
                                        <Ionicons name="pricetags" size={24} color={W.gold} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: W.gold }]}>Set Tags</Text>
                                </TouchableOpacity>

                                {/* Admin Note */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => {
                                            setNoteText(actUser.admin_note || '');
                                            setNoteVis(true);
                                        });
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: '#F1F5F9', borderColor: W.cardBorder }]}>
                                        <Ionicons name="create" size={24} color={W.charcoal} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: W.charcoal }]}>Edit Note</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </>
                    )}
                </Animated.View>
            </Modal>

            {/* ── ROLE SELECTION MODAL ─────────────────────────────────────── */}
            <Modal visible={roleVis} transparent animationType="fade" onRequestClose={() => setRoleVis(false)}>
                <TouchableOpacity style={S.modalOverlay} onPress={() => setRoleVis(false)} />
                <View style={S.dialogContainer}>
                    <View style={S.dialogBox}>
                        <Text style={S.dialogTitle}>Change Account Role</Text>
                        <Text style={S.dialogSubtitle}>Assign a platform permission level for {actUser?.full_name}</Text>

                        {Object.entries(ROLES).map(([roleKey, roleCfg]) => {
                            const isCurrent = actUser?.role === roleKey;
                            return (
                                <TouchableOpacity
                                    key={roleKey}
                                    onPress={() => changeRole(actUser, roleKey)}
                                    style={[S.roleSelectItem, isCurrent && { borderColor: roleCfg.color, backgroundColor: roleCfg.bg }]}
                                >
                                    <View style={[S.roleSelectIcon, { backgroundColor: roleCfg.bg, borderColor: roleCfg.border }]}>
                                        <Ionicons name={roleCfg.icon} size={20} color={roleCfg.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[S.roleSelectLabel, { color: roleCfg.color }]}>{roleCfg.label}</Text>
                                        <Text style={S.roleSelectDesc}>
                                            {roleKey === 'admin' ? 'Complete marketplace authority' :
                                             roleKey === 'vendor' ? 'Store & product inventory manager' :
                                             roleKey === 'driver' ? 'Dispatch courier & fulfillment driver' :
                                             'Standard buyer & marketplace shopper'}
                                        </Text>
                                    </View>
                                    {isCurrent && <Ionicons name="checkmark-circle" size={22} color={roleCfg.color} />}
                                </TouchableOpacity>
                            );
                        })}

                        <TouchableOpacity onPress={() => setRoleVis(false)} style={S.dialogCancelBtn}>
                            <Text style={S.dialogCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── WALLET CREDIT/DEBIT MODAL WITH QUICK-AMOUNT BUTTONS ──────── */}
            <Modal visible={walVis} transparent animationType="fade" onRequestClose={() => setWalVis(false)}>
                <View style={S.dialogContainer}>
                    <View style={S.dialogBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                            <Ionicons name="wallet" size={24} color={W.gold} style={{ marginRight: 8 }} />
                            <Text style={S.dialogTitle}>Adjust Wallet Funds</Text>
                        </View>

                        <Text style={S.dialogSubtitle}>
                            Account: <Text style={{ color: W.charcoal, fontWeight: '800' }}>{actUser?.full_name}</Text>
                            {'\n'}Current Balance: <Text style={{ color: W.emerald, fontWeight: '800' }}>{fmtAmt(actUser?.wallet?.balance || 0)}</Text>
                        </Text>

                        {/* Quick-Pick Amount Buttons */}
                        <View style={S.quickPicksRow}>
                            {['1000', '5000', '10000', '50000'].map(val => (
                                <TouchableOpacity
                                    key={val}
                                    onPress={() => setWalAmt(val)}
                                    style={[S.quickPickBtn, walAmt === val && S.quickPickBtnActive]}
                                >
                                    <Text style={[S.quickPickTxt, walAmt === val && S.quickPickTxtActive]}>
                                        +{fmtAmt(val)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={S.dialogInput}
                            placeholder="Amount in Naira (e.g. 5000)"
                            placeholderTextColor={W.textSubtle}
                            value={walAmt}
                            onChangeText={setWalAmt}
                            keyboardType="numeric"
                        />

                        <TextInput
                            style={[S.dialogInput, { marginTop: 10 }]}
                            placeholder="Reason (e.g. Loyalty bonus, manual refund)"
                            placeholderTextColor={W.textSubtle}
                            value={walReason}
                            onChangeText={setWalReason}
                        />

                        <View style={S.dialogButtonRow}>
                            <TouchableOpacity
                                onPress={() => { setWalVis(false); setWalAmt(''); setWalReason(''); }}
                                style={S.dialogSecondaryBtn}
                            >
                                <Text style={S.dialogSecondaryBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => adjustWallet('debit')}
                                style={[S.dialogActionBtn, { backgroundColor: W.crimsonBg, borderColor: W.crimsonBorder }]}
                            >
                                <Text style={[S.dialogActionBtnText, { color: W.crimson }]}>Debit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => adjustWallet('credit')}
                                style={[S.dialogActionBtn, { backgroundColor: W.emeraldBg, borderColor: W.emeraldBorder }]}
                            >
                                <Text style={[S.dialogActionBtnText, { color: W.emerald }]}>Credit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── DIRECT MESSAGE MODAL ─────────────────────────────────────── */}
            <Modal visible={directMsgVis} transparent animationType="fade" onRequestClose={() => setDirectMsgVis(false)}>
                <View style={S.dialogContainer}>
                    <View style={S.dialogBox}>
                        <Text style={S.dialogTitle}>Send Direct In-App Alert</Text>
                        <Text style={S.dialogSubtitle}>Dispatch a targeted notification directly to {actUser?.full_name}</Text>

                        <TextInput
                            style={S.dialogInput}
                            placeholder="Message Title (e.g. Account Update 🎉)"
                            placeholderTextColor={W.textSubtle}
                            value={directTitle}
                            onChangeText={setDirectTitle}
                        />

                        <TextInput
                            style={[S.dialogInput, { height: 100, textAlignVertical: 'top', marginTop: 10 }]}
                            placeholder="Detailed notification message…"
                            placeholderTextColor={W.textSubtle}
                            value={directBody}
                            onChangeText={setDirectBody}
                            multiline
                        />

                        <View style={[S.dialogButtonRow, { marginTop: 14 }]}>
                            <TouchableOpacity onPress={() => setDirectMsgVis(false)} style={S.dialogSecondaryBtn}>
                                <Text style={S.dialogSecondaryBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={sendDirectMessage}
                                style={[S.dialogPrimaryBtn, { backgroundColor: W.charcoal }]}
                            >
                                <Text style={[S.dialogPrimaryBtnText, { color: '#FFFFFF' }]}>Send Alert</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── ADMIN TAGS MODAL ─────────────────────────────────────────── */}
            <Modal visible={tagVis} transparent animationType="slide" onRequestClose={() => setTagVis(false)}>
                <View style={S.modalOverlay}>
                    <View style={S.actionSheet}>
                        <View style={S.dragHandle} />
                        <Text style={S.dialogTitle}>Account Segmentation Tags</Text>
                        <Text style={S.dialogSubtitle}>Assign or remove customer classification flags</Text>

                        <View style={S.tagsContainer}>
                            {PRESET_TAGS.map(t => {
                                const active = (actUser?.admin_tags || []).includes(t.id);
                                return (
                                    <TouchableOpacity
                                        key={t.id}
                                        onPress={() => toggleTag(actUser, t.id)}
                                        style={[
                                            S.tagPill,
                                            { borderColor: active ? t.color : W.cardBorder, backgroundColor: active ? t.bg : '#FFFFFF' }
                                        ]}
                                    >
                                        <Text style={[S.tagPillText, { color: active ? t.color : W.textMuted }]}>
                                            {t.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            onPress={() => setTagVis(false)}
                            style={[S.dialogPrimaryBtn, { marginTop: 18, backgroundColor: W.charcoal }]}
                        >
                            <Text style={[S.dialogPrimaryBtnText, { color: '#FFFFFF' }]}>Save Tags</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── ADMIN NOTE MODAL ─────────────────────────────────────────── */}
            <Modal visible={noteVis} transparent animationType="fade" onRequestClose={() => setNoteVis(false)}>
                <View style={S.dialogContainer}>
                    <View style={S.dialogBox}>
                        <Text style={S.dialogTitle}>Internal Staff Memo</Text>
                        <Text style={S.dialogSubtitle}>Private notes visible only to marketplace administrators</Text>

                        <TextInput
                            style={[S.dialogInput, { height: 120, textAlignVertical: 'top' }]}
                            placeholder="Add administrative observations, compliance notes, or records…"
                            placeholderTextColor={W.textSubtle}
                            value={noteText}
                            onChangeText={setNoteText}
                            multiline
                        />

                        <View style={[S.dialogButtonRow, { marginTop: 14 }]}>
                            <TouchableOpacity onPress={() => setNoteVis(false)} style={S.dialogSecondaryBtn}>
                                <Text style={S.dialogSecondaryBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveNote} style={[S.dialogPrimaryBtn, { backgroundColor: W.charcoal }]}>
                                <Text style={[S.dialogPrimaryBtnText, { color: '#FFFFFF' }]}>Save Memo</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── BROADCAST MODAL ──────────────────────────────────────────── */}
            <Modal visible={bcastVis} transparent animationType="slide" onRequestClose={() => setBcastVis(false)}>
                <View style={S.modalOverlay}>
                    <View style={S.actionSheet}>
                        <View style={S.dragHandle} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Ionicons name="megaphone" size={22} color={W.gold} style={{ marginRight: 8 }} />
                            <Text style={S.dialogTitle}>Broadcast Notification</Text>
                        </View>
                        <Text style={S.dialogSubtitle}>
                            Will dispatch to <Text style={{ color: W.gold, fontWeight: '800' }}>{filtered.length}</Text> filtered users.
                        </Text>

                        <TextInput
                            style={S.dialogInput}
                            placeholder="Broadcast Title (e.g. Flash Promo! 🎉)"
                            placeholderTextColor={W.textSubtle}
                            value={bTitle}
                            onChangeText={setBTitle}
                        />

                        <TextInput
                            style={[S.dialogInput, { height: 110, textAlignVertical: 'top', marginTop: 10 }]}
                            placeholder="Broadcast Message Content…"
                            placeholderTextColor={W.textSubtle}
                            value={bMsg}
                            onChangeText={setBMsg}
                            multiline
                        />

                        <View style={[S.dialogButtonRow, { marginTop: 16 }]}>
                            <TouchableOpacity onPress={() => setBcastVis(false)} style={S.dialogSecondaryBtn}>
                                <Text style={S.dialogSecondaryBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={sendBroadcast}
                                disabled={bcastSending}
                                style={[S.dialogPrimaryBtn, { backgroundColor: W.charcoal }]}
                            >
                                {bcastSending ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <Text style={[S.dialogPrimaryBtnText, { color: '#FFFFFF' }]}>Dispatch Broadcast</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* User Details Slide Modal */}
            <AdminUserDetails
                visible={detailVis}
                user={selUser}
                navigation={nav}
                onClose={() => setDetailVis(false)}
                onUpdate={loadData}
            />

            {/* WhatsApp Integration Modal */}
            <WhatsAppActionModal
                visible={whatsappVisible}
                phone={whatsappPhone}
                userId={whatsappUserId}
                recipientName={whatsappRecipientName}
                onClose={() => setWhatsappVisible(false)}
            />
        </View>
    );
};

// ─── Warm Luxury Styling Sheet ───────────────────────────────────────────────
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: W.canvas,
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        backgroundColor: W.cardBg,
        borderBottomWidth: 1,
        borderBottomColor: W.cardBorder,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8 },
            android: { elevation: 3 }
        })
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerIconBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: W.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleBox: {
        flex: 1,
        paddingHorizontal: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: W.charcoal,
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 11,
        fontWeight: '600',
        color: W.textMuted,
        marginTop: 1,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 6,
    },
    kpiScroll: {
        gap: 8,
        marginTop: 10,
        paddingBottom: 2,
    },
    kpiCard: {
        borderRadius: 12,
        paddingVertical: 6,
        paddingHorizontal: 10,
        minWidth: 88,
        borderWidth: 1,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3 },
            android: { elevation: 1 }
        })
    },
    kpiCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 2,
    },
    kpiVal: {
        fontSize: 13.5,
        fontWeight: '900',
    },
    kpiLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: W.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    searchContainer: {
        paddingHorizontal: 14,
        marginTop: 8,
        marginBottom: 4,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: W.cardBorder,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4 },
            android: { elevation: 1 }
        })
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: W.charcoal,
    },
    filterBar: {
        backgroundColor: W.canvas,
        borderBottomWidth: 1,
        borderBottomColor: W.canvasAlt,
    },
    filterScroll: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        gap: 6,
    },
    pill: {
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: W.cardBorder,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    pillActive: {
        backgroundColor: W.charcoal,
        borderColor: W.charcoal,
    },
    pillText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: W.textBody,
    },
    pillTextActive: {
        color: '#FFFFFF',
        fontWeight: '900',
    },
    pillBadge: {
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
    },
    pillBadgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    pillBadgeText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: W.textMuted,
    },
    pillBadgeTextActive: {
        color: '#FFFFFF',
    },
    sortRibbon: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 6,
        justifyContent: 'space-between',
    },
    sortTotal: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    indicatorDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: W.gold,
    },
    sortTotalText: {
        fontSize: 12,
        fontWeight: '800',
        color: W.charcoal,
    },
    sortOptions: {
        gap: 6,
    },
    sortChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: W.cardBorder,
    },
    sortChipActive: {
        borderColor: W.gold,
        backgroundColor: W.goldBg,
    },
    sortChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: W.textMuted,
    },
    sortChipTextActive: {
        color: W.gold,
        fontWeight: '900',
    },
    listContent: {
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 9,
        paddingRight: 10,
        paddingLeft: 0,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 7,
        borderWidth: 1,
        borderColor: W.cardBorder,
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5 },
            android: { elevation: 1 }
        })
    },
    cardAccentBar: {
        width: 3.5,
        height: '100%',
        marginRight: 9,
    },
    cardBanned: {
        backgroundColor: W.crimsonBg,
        borderColor: W.crimsonBorder,
    },
    cardSelected: {
        borderColor: W.gold,
        backgroundColor: W.goldBg,
    },
    avContainer: {
        width: 46,
        height: 46,
        marginRight: 10,
        position: 'relative',
    },
    avRing: {
        borderRadius: 23,
        borderWidth: 1.5,
        padding: 1,
    },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoContainer: {
        flex: 1,
        minWidth: 0,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 1,
    },
    userName: {
        fontSize: 14,
        fontWeight: '900',
        color: W.charcoal,
        letterSpacing: -0.2,
    },
    userEmail: {
        fontSize: 11,
        color: W.textMuted,
        fontWeight: '500',
        marginBottom: 3,
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 3,
    },
    chip: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    chipTxt: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    bottomStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    walletPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 9,
        borderWidth: 1,
    },
    walletText: {
        fontSize: 11.5,
        fontWeight: '900',
    },
    walletPending: {
        fontSize: 10,
        fontWeight: '700',
        color: W.gold,
    },
    lastActiveText: {
        fontSize: 10.5,
        color: W.textSubtle,
        fontWeight: '600',
    },
    driverStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#F0F9FF',
    },
    driverStripText: {
        fontSize: 11,
        fontWeight: '700',
        color: W.sky,
        flex: 1,
    },
    driverStatusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
    },
    cardActions: {
        paddingLeft: 8,
    },
    quickActionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: W.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        fontWeight: '600',
        color: W.textMuted,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        gap: 8,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: W.charcoal,
    },
    emptySubtitle: {
        fontSize: 13,
        color: W.textMuted,
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    actionSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 22,
        paddingBottom: 38,
        borderTopWidth: 1,
        borderTopColor: W.cardBorder,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.1, shadowRadius: 14 },
            android: { elevation: 12 }
        })
    },
    dragHandle: {
        width: 44,
        height: 5,
        backgroundColor: '#CBD5E1',
        borderRadius: 2.5,
        alignSelf: 'center',
        marginBottom: 18,
    },
    sheetUserHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 14,
    },
    sheetUserName: {
        fontSize: 17,
        fontWeight: '900',
        color: W.charcoal,
    },
    sheetUserEmail: {
        fontSize: 12,
        color: W.textMuted,
    },
    sheetNoteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        backgroundColor: W.goldBg,
        borderWidth: 1,
        borderColor: W.goldBorder,
        padding: 12,
        borderRadius: 14,
        marginBottom: 14,
    },
    sheetNoteText: {
        fontSize: 12,
        color: '#92400E',
        flex: 1,
        fontWeight: '600',
    },
    sheetSectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: W.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    sheetActionsScroll: {
        gap: 14,
        paddingVertical: 6,
    },
    sheetActionItem: {
        alignItems: 'center',
        width: 80,
    },
    sheetActionIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 7,
        borderWidth: 1,
    },
    sheetActionLabel: {
        fontSize: 11,
        fontWeight: '800',
        textAlign: 'center',
    },
    dialogContainer: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    dialogBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 26,
        padding: 24,
        borderWidth: 1,
        borderColor: W.cardBorder,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20 },
            android: { elevation: 8 }
        })
    },
    dialogTitle: {
        fontSize: 19,
        fontWeight: '900',
        color: W.charcoal,
        letterSpacing: -0.3,
    },
    dialogSubtitle: {
        fontSize: 12.5,
        color: W.textMuted,
        marginTop: 4,
        marginBottom: 14,
        lineHeight: 19,
    },
    quickPicksRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    quickPickBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: W.cardBorder,
        alignItems: 'center',
    },
    quickPickBtnActive: {
        backgroundColor: W.goldBg,
        borderColor: W.gold,
    },
    quickPickTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: W.textBody,
    },
    quickPickTxtActive: {
        color: W.gold,
    },
    dialogInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: W.cardBorder,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 13,
        color: W.charcoal,
        fontSize: 15,
        fontWeight: '600',
    },
    dialogButtonRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    dialogSecondaryBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: W.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dialogSecondaryBtnText: {
        color: '#475569',
        fontWeight: '800',
        fontSize: 14,
    },
    dialogActionBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dialogActionBtnText: {
        fontWeight: '900',
        fontSize: 14,
    },
    dialogPrimaryBtn: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dialogPrimaryBtnText: {
        fontWeight: '900',
        fontSize: 14,
    },
    roleSelectItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 13,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: W.cardBorder,
        backgroundColor: '#FFFFFF',
        marginBottom: 9,
    },
    roleSelectIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    roleSelectLabel: {
        fontSize: 14,
        fontWeight: '900',
    },
    roleSelectDesc: {
        fontSize: 11,
        color: W.textMuted,
        marginTop: 2,
    },
    dialogCancelBtn: {
        marginTop: 10,
        alignItems: 'center',
        paddingVertical: 12,
    },
    dialogCancelText: {
        color: W.textMuted,
        fontWeight: '800',
        fontSize: 14,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 10,
    },
    tagPill: {
        paddingHorizontal: 15,
        paddingVertical: 9,
        borderRadius: 18,
        borderWidth: 1.5,
    },
    tagPillText: {
        fontSize: 13,
        fontWeight: '800',
    },
});
