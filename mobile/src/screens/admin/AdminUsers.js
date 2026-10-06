import * as React from 'react';
import {
    View, Text, TouchableOpacity, FlatList, ActivityIndicator,
    Alert, TextInput, RefreshControl, ScrollView, Modal, StyleSheet,
    Share, Animated, StatusBar, Easing, Pressable, Linking,
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

// ─── Theme Tokens (Deep Luxury Navy & Gold) ──────────────────────────────────
const C = {
    bgDark: '#071422',
    bgCardDark: '#0B1B2F',
    navyMuted: '#132844',
    gold: '#D9A73A',
    goldLight: '#F3C96A',
    goldMuted: 'rgba(217, 167, 58, 0.15)',
    emerald: '#10B981',
    emeraldBg: 'rgba(16, 185, 129, 0.12)',
    crimson: '#EF4444',
    crimsonBg: 'rgba(239, 68, 68, 0.12)',
    sky: '#0EA5E9',
    skyBg: 'rgba(14, 165, 233, 0.12)',
    purple: '#8B5CF6',
    purpleBg: 'rgba(139, 92, 246, 0.12)',
    amber: '#F59E0B',
    amberBg: 'rgba(245, 158, 11, 0.12)',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    borderDark: 'rgba(217, 167, 58, 0.18)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
};

// ─── Roles Configuration ─────────────────────────────────────────────────────
const ROLES = {
    admin: { label: 'ADMIN', color: '#A855F7', icon: 'shield-checkmark', bg: 'rgba(168, 85, 247, 0.16)' },
    vendor: { label: 'VENDOR', color: '#F97316', icon: 'storefront', bg: 'rgba(249, 115, 22, 0.16)' },
    driver: { label: 'DRIVER', color: '#0EA5E9', icon: 'bicycle', bg: 'rgba(14, 165, 233, 0.16)' },
    customer: { label: 'CUSTOMER', color: '#10B981', icon: 'person', bg: 'rgba(16, 185, 129, 0.16)' },
};
const getRoleCfg = (role) => ROLES[role] || ROLES.customer;

// ─── Spending Tiers ──────────────────────────────────────────────────────────
const TIERS = [
    { min: 1000000, label: '💎 Diamond VIP', color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)' },
    { min: 250000, label: '🥇 Gold Tier', color: '#D9A73A', bg: 'rgba(217, 167, 58, 0.15)' },
    { min: 50000, label: '🥈 Silver Tier', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' },
    { min: 0, label: '🥉 Bronze Tier', color: '#D97706', bg: 'rgba(217, 119, 6, 0.15)' },
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
    { id: 'vip', label: '⭐ VIP Client', color: '#D9A73A', bg: 'rgba(217, 167, 58, 0.18)' },
    { id: 'wholesale', label: '📦 Wholesale', color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.18)' },
    { id: 'loyal', label: '❤️ High Loyalty', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.18)' },
    { id: 'risk', label: '⚠️ Suspicious', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.18)' },
    { id: 'fraud', label: '🚨 Fraud Alert', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.18)' },
    { id: 'partner', label: '🤝 Strategic Partner', color: '#10B981', bg: 'rgba(16, 185, 129, 0.18)' },
    { id: 'new', label: '🆕 Fresh Account', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.18)' },
];

export const AdminUsers = ({ navigation: propNav }) => {
    const nav = propNav || useNavigation();
    const insets = useSafeAreaInsets();
    const shimmer = React.useRef(new Animated.Value(0)).current;

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

    const sheetY = React.useRef(new Animated.Value(700)).current;

    // Shimmer effect
    React.useEffect(() => {
        const loop = Animated.loop(Animated.sequence([
            Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: false }),
            Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: false }),
        ]));
        loop.start();
        return () => loop.stop();
    }, []);

    const openSheet = (user) => {
        setActUser(user);
        setSheetVis(true);
        Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 11 }).start();
    };

    const closeSheet = (cb) => {
        Animated.timing(sheetY, { toValue: 700, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.ease) }).start(() => {
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
            Alert.alert('Network Notice', 'Could not refresh user database. Please retry.');
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
            Alert.alert('Fleet Updated', `${u.full_name || 'User'} has been promoted to Active Driver.`);
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

            // Record transaction history if table exists
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
            const targets = filtered.slice(0, 100); // safety cap
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

    // ── User Card Component ──────────────────────────────────────────────────
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
                    pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] },
                    item.is_banned && S.cardBanned,
                    isSel && S.cardSelected,
                ]}
            >
                {/* Glow bar accent on left */}
                <View style={[S.cardAccentBar, { backgroundColor: cfg.color }]} />

                {selMode && (
                    <Ionicons
                        name={isSel ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={isSel ? C.gold : C.textSecondary}
                        style={{ marginRight: 10, marginLeft: 6 }}
                    />
                )}

                {/* Avatar with status indicator */}
                <View style={S.avContainer}>
                    <View style={[S.avRing, { borderColor: `${cfg.color}55` }]}>
                        <UserAvatar user={item} size={48} />
                    </View>
                    <View style={[
                        S.statusDot,
                        item.is_banned ? { backgroundColor: C.crimson } :
                        item.is_restricted ? { backgroundColor: C.amber } :
                        item.is_online ? { backgroundColor: C.emerald } :
                        { backgroundColor: '#475569' }
                    ]}>
                        {item.is_banned && <Ionicons name="ban" size={8} color="#FFFFFF" />}
                        {item.is_restricted && !item.is_banned && <Ionicons name="lock-closed" size={8} color="#FFFFFF" />}
                    </View>
                </View>

                {/* Primary Information */}
                <View style={S.infoContainer}>
                    <View style={S.nameRow}>
                        <Text style={S.userName} numberOfLines={1}>
                            {item.full_name || 'Anonymous User'}
                        </Text>
                        {item.is_verified && (
                            <Ionicons name="checkmark-circle" size={15} color="#38BDF8" style={{ marginLeft: 4 }} />
                        )}
                    </View>

                    <Text style={S.userEmail} numberOfLines={1}>
                        {item.email || (item.phone ? item.phone : 'No contact specified')}
                    </Text>

                    {/* Role & Tier Tags */}
                    <View style={S.tagRow}>
                        <View style={[S.chip, { backgroundColor: cfg.bg, borderColor: `${cfg.color}40` }]}>
                            <Ionicons name={cfg.icon} size={9} color={cfg.color} style={{ marginRight: 3 }} />
                            <Text style={[S.chipTxt, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>

                        <View style={[S.chip, { backgroundColor: item.tier.bg, borderColor: `${item.tier.color}40` }]}>
                            <Text style={[S.chipTxt, { color: item.tier.color }]}>{item.tier.label}</Text>
                        </View>

                        {userTags.slice(0, 1).map(tag => (
                            <View key={tag.id} style={[S.chip, { backgroundColor: tag.bg, borderColor: `${tag.color}40` }]}>
                                <Text style={[S.chipTxt, { color: tag.color }]}>{tag.label}</Text>
                            </View>
                        ))}

                        {item.admin_note ? (
                            <Ionicons name="document-text" size={13} color={C.gold} style={{ marginLeft: 2 }} />
                        ) : null}
                    </View>

                    {/* Financial & Time Strip */}
                    <View style={S.bottomStrip}>
                        <View style={[
                            S.walletPill,
                            bal > 0 ? { backgroundColor: C.emeraldBg, borderColor: 'rgba(16, 185, 129, 0.3)' } : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: C.borderSubtle }
                        ]}>
                            <Ionicons name="wallet-outline" size={11} color={bal > 0 ? C.emerald : C.textSecondary} />
                            <Text style={[S.walletText, { color: bal > 0 ? C.emerald : C.textSecondary }]}>
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
                            <Ionicons name="bicycle" size={11} color={C.sky} />
                            <Text style={S.driverStripText} numberOfLines={1}>
                                {item.driver_info.vehicle_type || 'Vehicle'} · {item.driver_info.plate_number || 'No Plate'}
                            </Text>
                            <View style={[
                                S.driverStatusBadge,
                                { backgroundColor: item.driver_info.status === 'active' ? C.emeraldBg : 'rgba(255,255,255,0.06)' }
                            ]}>
                                <Text style={{ fontSize: 8, fontWeight: '800', color: item.driver_info.status === 'active' ? C.emerald : C.textSecondary }}>
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
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="ellipsis-vertical" size={16} color={C.gold} />
                        </TouchableOpacity>
                    </View>
                )}
            </Pressable>
        );
    };

    return (
        <View style={S.container}>
            <StatusBar barStyle="light-content" backgroundColor={C.bgDark} />

            {/* ── LUXURY HEADER ────────────────────────────────────────────── */}
            <LinearGradient
                colors={['#06111C', '#0B1B2F', '#071422']}
                style={[S.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}
            >
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
                        <Ionicons name={selMode ? 'close' : 'arrow-back'} size={20} color={C.gold} />
                    </TouchableOpacity>

                    <View style={S.headerTitleBox}>
                        <Text style={S.headerTitle}>
                            {selMode ? `${selIds.length} Selected` : 'User Directory'}
                        </Text>
                        <Text style={S.headerSubtitle}>
                            {stats.total} accounts · {stats.todayNew} registered today
                        </Text>
                    </View>

                    {!selMode ? (
                        <View style={S.headerActions}>
                            <TouchableOpacity
                                onPress={() => setBcastVis(true)}
                                style={S.headerIconBtn}
                                title="Broadcast"
                            >
                                <Ionicons name="megaphone" size={17} color={C.gold} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    const csv = filtered.map(u => `${u.full_name},${u.email},${u.phone},${u.role},${u.wallet?.balance || 0}`).join('\n');
                                    Share.share({ message: `Name,Email,Phone,Role,Balance\n${csv}` });
                                }}
                                style={S.headerIconBtn}
                            >
                                <Ionicons name="share-outline" size={17} color={C.gold} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setSelMode(true)}
                                style={S.headerIconBtn}
                            >
                                <Ionicons name="checkbox-outline" size={17} color={C.gold} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={S.headerActions}>
                            <TouchableOpacity
                                onPress={() => handleBulk('verify')}
                                style={[S.headerIconBtn, { backgroundColor: C.emeraldBg, borderColor: C.emerald }]}
                            >
                                <Ionicons name="checkmark-done" size={17} color={C.emerald} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleBulk('ban')}
                                style={[S.headerIconBtn, { backgroundColor: C.crimsonBg, borderColor: C.crimson }]}
                            >
                                <Ionicons name="ban" size={17} color={C.crimson} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleBulk('unban')}
                                style={[S.headerIconBtn, { backgroundColor: C.skyBg, borderColor: C.sky }]}
                            >
                                <Ionicons name="shield-checkmark" size={17} color={C.sky} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ── KPI METRICS STRIP ────────────────────────────────────── */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={S.kpiScroll}
                >
                    {[
                        { label: 'Total Users', val: stats.total, icon: 'people', color: C.gold },
                        { label: 'Vendors', val: stats.vendors, icon: 'storefront', color: '#F97316' },
                        { label: 'Drivers', val: stats.drivers, icon: 'bicycle', color: C.sky },
                        { label: 'Customers', val: stats.customers, icon: 'person', color: C.emerald },
                        { label: 'Total Wallet', val: fmtAmt(stats.totalBal), icon: 'wallet', color: C.goldLight },
                        { label: 'Verified', val: stats.verified, icon: 'checkmark-circle', color: '#38BDF8' },
                        { label: 'Suspended', val: stats.banned, icon: 'ban', color: C.crimson },
                    ].map((k, i) => (
                        <View key={i} style={S.kpiCard}>
                            <View style={S.kpiCardTop}>
                                <Ionicons name={k.icon} size={13} color={k.color} />
                                <Text style={[S.kpiVal, { color: k.color }]}>{k.val}</Text>
                            </View>
                            <Text style={S.kpiLabel}>{k.label}</Text>
                        </View>
                    ))}
                </ScrollView>
            </LinearGradient>

            {/* ── SEARCH & FILTER CONTROLS ─────────────────────────────────── */}
            <View style={S.searchContainer}>
                <View style={S.searchBox}>
                    <Ionicons name="search" size={16} color={C.gold} style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search by name, email, phone, or role…"
                        placeholderTextColor="#64748B"
                        value={search}
                        onChangeText={setSearch}
                        style={S.searchInput}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ── HORIZONTAL ROLE PILLS ────────────────────────────────────── */}
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
                        {sorted.length} <Text style={{ color: C.textSecondary }}>results</Text>
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
                                <Ionicons name={s.icon} size={11} color={active ? C.gold : C.textSecondary} />
                                <Text style={[S.sortChipText, active && S.sortChipTextActive]}>{s.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ── USER LIST ────────────────────────────────────────────────── */}
            {loading ? (
                <View style={S.loadingContainer}>
                    <ActivityIndicator size="large" color={C.gold} />
                    <Text style={S.loadingText}>Synchronizing user ledger…</Text>
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
                            tintColor={C.gold}
                            colors={[C.gold]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={S.emptyContainer}>
                            <Ionicons name="people-outline" size={54} color="#334155" />
                            <Text style={S.emptyTitle}>No matching accounts</Text>
                            <Text style={S.emptySubtitle}>Try adjusting your search query or role filter.</Text>
                        </View>
                    }
                />
            )}

            {/* ── BOTTOM ACTION SHEET (MODERN LUXURY) ──────────────────────── */}
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
                                <UserAvatar user={actUser} size={48} />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={S.sheetUserName} numberOfLines={1}>
                                            {actUser.full_name || 'Anonymous User'}
                                        </Text>
                                        {actUser.is_verified && (
                                            <Ionicons name="checkmark-circle" size={15} color="#38BDF8" style={{ marginLeft: 4 }} />
                                        )}
                                    </View>
                                    <Text style={S.sheetUserEmail} numberOfLines={1}>{actUser.email || actUser.phone}</Text>
                                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                                        <View style={[S.chip, { backgroundColor: actUser.role_cfg.bg, borderColor: `${actUser.role_cfg.color}40` }]}>
                                            <Text style={[S.chipTxt, { color: actUser.role_cfg.color }]}>{actUser.role_cfg.label}</Text>
                                        </View>
                                        <View style={[S.chip, { backgroundColor: actUser.tier.bg, borderColor: `${actUser.tier.color}40` }]}>
                                            <Text style={[S.chipTxt, { color: actUser.tier.color }]}>{actUser.tier.label}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 9, color: C.textSecondary, textTransform: 'uppercase', fontWeight: '700' }}>Balance</Text>
                                    <Text style={{ fontSize: 17, fontWeight: '900', color: C.emerald }}>{fmtAmt(actUser.wallet?.balance || 0)}</Text>
                                </View>
                            </View>

                            {/* Internal Note snippet */}
                            {actUser.admin_note ? (
                                <View style={S.sheetNoteCard}>
                                    <Ionicons name="document-text" size={14} color={C.gold} />
                                    <Text style={S.sheetNoteText} numberOfLines={2}>{actUser.admin_note}</Text>
                                </View>
                            ) : null}

                            {/* Quick Action Grid */}
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
                                        <View style={[S.sheetActionIcon, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                                            <Ionicons name="logo-whatsapp" size={20} color="#22C55E" />
                                        </View>
                                        <Text style={[S.sheetActionLabel, { color: '#22C55E' }]}>WhatsApp</Text>
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
                                        <View style={[S.sheetActionIcon, { backgroundColor: C.skyBg }]}>
                                            <Ionicons name="call" size={20} color={C.sky} />
                                        </View>
                                        <Text style={[S.sheetActionLabel, { color: C.sky }]}>Direct Call</Text>
                                    </TouchableOpacity>
                                ) : null}

                                {/* Direct In-App Message */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => setDirectMsgVis(true));
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: C.goldMuted }]}>
                                        <Ionicons name="paper-plane" size={20} color={C.gold} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: C.gold }]}>Direct Alert</Text>
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
                                    <View style={[S.sheetActionIcon, { backgroundColor: C.purpleBg }]}>
                                        <Ionicons name="person" size={20} color={C.purple} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: C.purple }]}>Full Profile</Text>
                                </TouchableOpacity>

                                {/* Wallet Adjustment */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => setWalVis(true));
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: C.emeraldBg }]}>
                                        <Ionicons name="wallet" size={20} color={C.emerald} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: C.emerald }]}>Wallet Fund</Text>
                                </TouchableOpacity>

                                {/* Change Role */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => setRoleVis(true));
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
                                        <Ionicons name="swap-horizontal" size={20} color="#F97316" />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: '#F97316' }]}>Switch Role</Text>
                                </TouchableOpacity>

                                {/* Verify Toggle */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => toggleVerify(actUser));
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: actUser.is_verified ? 'rgba(255,255,255,0.08)' : C.emeraldBg }]}>
                                        <Ionicons name={actUser.is_verified ? 'close-circle' : 'checkmark-circle'} size={20} color={actUser.is_verified ? '#94A3B8' : C.emerald} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: actUser.is_verified ? '#94A3B8' : C.emerald }]}>
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
                                    <View style={[S.sheetActionIcon, { backgroundColor: C.crimsonBg }]}>
                                        <Ionicons name={actUser.is_banned ? 'shield-checkmark' : 'ban'} size={20} color={C.crimson} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: C.crimson }]}>
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
                                        <View style={[S.sheetActionIcon, { backgroundColor: C.skyBg }]}>
                                            <Ionicons name="bicycle" size={20} color={C.sky} />
                                        </View>
                                        <Text style={[S.sheetActionLabel, { color: C.sky }]}>Make Driver</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Admin Tags */}
                                <TouchableOpacity
                                    onPress={() => {
                                        closeSheet(() => setTagVis(true));
                                    }}
                                    style={S.sheetActionItem}
                                >
                                    <View style={[S.sheetActionIcon, { backgroundColor: C.goldMuted }]}>
                                        <Ionicons name="pricetags" size={20} color={C.gold} />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: C.gold }]}>Set Tags</Text>
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
                                    <View style={[S.sheetActionIcon, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                                        <Ionicons name="create" size={20} color="#FFFFFF" />
                                    </View>
                                    <Text style={[S.sheetActionLabel, { color: '#FFFFFF' }]}>Edit Note</Text>
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
                                    style={[S.roleSelectItem, isCurrent && { borderColor: roleCfg.color, backgroundColor: `${roleCfg.color}15` }]}
                                >
                                    <View style={[S.roleSelectIcon, { backgroundColor: roleCfg.bg }]}>
                                        <Ionicons name={roleCfg.icon} size={18} color={roleCfg.color} />
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
                                    {isCurrent && <Ionicons name="checkmark-circle" size={20} color={roleCfg.color} />}
                                </TouchableOpacity>
                            );
                        })}

                        <TouchableOpacity onPress={() => setRoleVis(false)} style={S.dialogCancelBtn}>
                            <Text style={S.dialogCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── WALLET CREDIT/DEBIT MODAL ────────────────────────────────── */}
            <Modal visible={walVis} transparent animationType="fade" onRequestClose={() => setWalVis(false)}>
                <View style={S.dialogContainer}>
                    <View style={S.dialogBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <Ionicons name="wallet" size={22} color={C.gold} style={{ marginRight: 8 }} />
                            <Text style={S.dialogTitle}>Adjust Wallet Funds</Text>
                        </View>

                        <Text style={S.dialogSubtitle}>
                            Account: <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{actUser?.full_name}</Text>
                            {'\n'}Current Balance: <Text style={{ color: C.emerald, fontWeight: '800' }}>{fmtAmt(actUser?.wallet?.balance || 0)}</Text>
                        </Text>

                        <TextInput
                            style={S.dialogInput}
                            placeholder="Amount in Naira (e.g. 5000)"
                            placeholderTextColor="#64748B"
                            value={walAmt}
                            onChangeText={setWalAmt}
                            keyboardType="numeric"
                        />

                        <TextInput
                            style={[S.dialogInput, { marginTop: 8 }]}
                            placeholder="Reason (e.g. Promotional bonus, refund)"
                            placeholderTextColor="#64748B"
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
                                style={[S.dialogActionBtn, { backgroundColor: C.crimsonBg, borderColor: C.crimson }]}
                            >
                                <Text style={[S.dialogActionBtnText, { color: C.crimson }]}>Debit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => adjustWallet('credit')}
                                style={[S.dialogActionBtn, { backgroundColor: C.emeraldBg, borderColor: C.emerald }]}
                            >
                                <Text style={[S.dialogActionBtnText, { color: C.emerald }]}>Credit</Text>
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
                            placeholder="Message Title (e.g. KYC Verified! 🎉)"
                            placeholderTextColor="#64748B"
                            value={directTitle}
                            onChangeText={setDirectTitle}
                        />

                        <TextInput
                            style={[S.dialogInput, { height: 90, textAlignVertical: 'top', marginTop: 10 }]}
                            placeholder="Detailed notification message…"
                            placeholderTextColor="#64748B"
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
                                style={[S.dialogPrimaryBtn, { backgroundColor: C.gold }]}
                            >
                                <Text style={[S.dialogPrimaryBtnText, { color: '#071422' }]}>Send Alert</Text>
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
                                            { borderColor: active ? t.color : C.borderSubtle, backgroundColor: active ? t.bg : 'rgba(255,255,255,0.03)' }
                                        ]}
                                    >
                                        <Text style={[S.tagPillText, { color: active ? t.color : C.textSecondary }]}>
                                            {t.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            onPress={() => setTagVis(false)}
                            style={[S.dialogPrimaryBtn, { marginTop: 18, backgroundColor: C.gold }]}
                        >
                            <Text style={[S.dialogPrimaryBtnText, { color: '#071422' }]}>Save Tags</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── ADMIN NOTE MODAL ─────────────────────────────────────────── */}
            <Modal visible={noteVis} transparent animationType="fade" onRequestClose={() => setNoteVis(false)}>
                <View style={S.dialogContainer}>
                    <View style={S.dialogBox}>
                        <Text style={S.dialogTitle}>Internal Admin Memo</Text>
                        <Text style={S.dialogSubtitle}>Private notes visible only to marketplace administrators</Text>

                        <TextInput
                            style={[S.dialogInput, { height: 120, textAlignVertical: 'top' }]}
                            placeholder="Add administrative observations, compliance notes, or records…"
                            placeholderTextColor="#64748B"
                            value={noteText}
                            onChangeText={setNoteText}
                            multiline
                        />

                        <View style={[S.dialogButtonRow, { marginTop: 14 }]}>
                            <TouchableOpacity onPress={() => setNoteVis(false)} style={S.dialogSecondaryBtn}>
                                <Text style={S.dialogSecondaryBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveNote} style={[S.dialogPrimaryBtn, { backgroundColor: C.gold }]}>
                                <Text style={[S.dialogPrimaryBtnText, { color: '#071422' }]}>Save Memo</Text>
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
                            <Ionicons name="megaphone" size={20} color={C.gold} style={{ marginRight: 8 }} />
                            <Text style={S.dialogTitle}>Broadcast Notification</Text>
                        </View>
                        <Text style={S.dialogSubtitle}>
                            Will dispatch to <Text style={{ color: C.gold, fontWeight: '800' }}>{filtered.length}</Text> filtered users.
                        </Text>

                        <TextInput
                            style={S.dialogInput}
                            placeholder="Broadcast Title (e.g. Weekend Flash Sale! 🎉)"
                            placeholderTextColor="#64748B"
                            value={bTitle}
                            onChangeText={setBTitle}
                        />

                        <TextInput
                            style={[S.dialogInput, { height: 110, textAlignVertical: 'top', marginTop: 10 }]}
                            placeholder="Broadcast Message Content…"
                            placeholderTextColor="#64748B"
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
                                style={[S.dialogPrimaryBtn, { backgroundColor: C.gold }]}
                            >
                                {bcastSending ? (
                                    <ActivityIndicator color="#071422" size="small" />
                                ) : (
                                    <Text style={[S.dialogPrimaryBtnText, { color: '#071422' }]}>Dispatch Broadcast</Text>
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

// ─── Luxury Styling Sheet ────────────────────────────────────────────────────
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#071422',
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 167, 58, 0.2)',
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleBox: {
        flex: 1,
        paddingHorizontal: 12,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    kpiScroll: {
        gap: 8,
        marginTop: 14,
        paddingBottom: 2,
    },
    kpiCard: {
        backgroundColor: '#0B1B2F',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)',
        borderRadius: 14,
        paddingVertical: 8,
        paddingHorizontal: 12,
        minWidth: 92,
    },
    kpiCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 2,
    },
    kpiVal: {
        fontSize: 14,
        fontWeight: '900',
    },
    kpiLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    searchContainer: {
        paddingHorizontal: 14,
        marginTop: 10,
        marginBottom: 4,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0B1B2F',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    filterBar: {
        backgroundColor: '#071422',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    filterScroll: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        gap: 8,
    },
    pill: {
        paddingHorizontal: 13,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pillActive: {
        backgroundColor: '#D9A73A',
        borderColor: '#D9A73A',
    },
    pillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
    },
    pillTextActive: {
        color: '#071422',
        fontWeight: '900',
    },
    pillBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 10,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    pillBadgeActive: {
        backgroundColor: '#071422',
    },
    pillBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94A3B8',
    },
    pillBadgeTextActive: {
        color: '#D9A73A',
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
        gap: 5,
    },
    indicatorDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#D9A73A',
    },
    sortTotalText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    sortOptions: {
        gap: 6,
    },
    sortChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    sortChipActive: {
        borderColor: 'rgba(217, 167, 58, 0.4)',
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
    },
    sortChipText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94A3B8',
    },
    sortChipTextActive: {
        color: '#D9A73A',
        fontWeight: '800',
    },
    listContent: {
        paddingHorizontal: 14,
        paddingTop: 6,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#0B1B2F',
        borderRadius: 16,
        paddingVertical: 12,
        paddingRight: 12,
        paddingLeft: 0,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.2)',
        overflow: 'hidden',
    },
    cardAccentBar: {
        width: 4,
        height: '100%',
        marginRight: 10,
    },
    cardBanned: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    cardSelected: {
        borderColor: '#D9A73A',
        backgroundColor: 'rgba(217, 167, 58, 0.06)',
    },
    avContainer: {
        width: 50,
        height: 50,
        marginRight: 11,
        position: 'relative',
    },
    avRing: {
        borderRadius: 25,
        borderWidth: 2,
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
        borderColor: '#0B1B2F',
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
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.2,
    },
    userEmail: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '500',
        marginBottom: 5,
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 5,
        marginBottom: 4,
    },
    chip: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    chipTxt: {
        fontSize: 9,
        fontWeight: '800',
    },
    bottomStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 3,
    },
    walletPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 8,
        borderWidth: 1,
    },
    walletText: {
        fontSize: 10.5,
        fontWeight: '800',
    },
    walletPending: {
        fontSize: 9.5,
        fontWeight: '600',
        color: '#F59E0B',
    },
    lastActiveText: {
        fontSize: 9.5,
        color: '#64748B',
        fontWeight: '600',
    },
    driverStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 5,
        paddingTop: 5,
        borderTopWidth: 1,
        borderTopColor: 'rgba(14, 165, 233, 0.15)',
    },
    driverStripText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0EA5E9',
        flex: 1,
    },
    driverStatusBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
    },
    cardActions: {
        paddingLeft: 6,
    },
    quickActionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(217, 167, 58, 0.1)',
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
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        gap: 8,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    emptySubtitle: {
        fontSize: 12,
        color: '#94A3B8',
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    actionSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0B1B2F',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        paddingBottom: 36,
        borderTopWidth: 1,
        borderTopColor: 'rgba(217, 167, 58, 0.3)',
    },
    dragHandle: {
        width: 38,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    sheetUserHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 12,
    },
    sheetUserName: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    sheetUserEmail: {
        fontSize: 11,
        color: '#94A3B8',
    },
    sheetNoteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
        padding: 10,
        borderRadius: 12,
        marginBottom: 12,
    },
    sheetNoteText: {
        fontSize: 11,
        color: '#F3C96A',
        flex: 1,
        fontWeight: '600',
    },
    sheetSectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    sheetActionsScroll: {
        gap: 12,
        paddingVertical: 4,
    },
    sheetActionItem: {
        alignItems: 'center',
        width: 74,
    },
    sheetActionIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    sheetActionLabel: {
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
    },
    dialogContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    dialogBox: {
        backgroundColor: '#0B1B2F',
        borderRadius: 24,
        padding: 22,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
    },
    dialogTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.3,
    },
    dialogSubtitle: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 4,
        marginBottom: 14,
        lineHeight: 18,
    },
    dialogInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#FFFFFF',
        fontSize: 14,
    },
    dialogButtonRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
    },
    dialogSecondaryBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dialogSecondaryBtnText: {
        color: '#94A3B8',
        fontWeight: '700',
        fontSize: 13,
    },
    dialogActionBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dialogActionBtnText: {
        fontWeight: '800',
        fontSize: 13,
    },
    dialogPrimaryBtn: {
        flex: 2,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dialogPrimaryBtnText: {
        fontWeight: '900',
        fontSize: 13,
    },
    roleSelectItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 8,
    },
    roleSelectIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    roleSelectLabel: {
        fontSize: 13,
        fontWeight: '900',
    },
    roleSelectDesc: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 2,
    },
    dialogCancelBtn: {
        marginTop: 10,
        alignItems: 'center',
        paddingVertical: 12,
    },
    dialogCancelText: {
        color: '#94A3B8',
        fontWeight: '700',
        fontSize: 13,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 10,
    },
    tagPill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1.5,
    },
    tagPillText: {
        fontSize: 12,
        fontWeight: '800',
    },
});
