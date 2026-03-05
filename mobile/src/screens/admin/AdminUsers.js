import * as React from 'react';
import {
    View, Text, TouchableOpacity, FlatList, ActivityIndicator,
    Alert, TextInput, RefreshControl, ScrollView, Modal, StyleSheet,
    Share, Animated, StatusBar, Easing, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { NotificationService } from '../../lib/notifications';
import { UserAvatar } from '../../components/UserAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminUserDetails } from './AdminUserDetails';

// ─── Helpers ────────────────────────────────────────────────────────────────
const ROLES = {
    admin: { label: 'ADMIN', color: '#7C3AED', icon: 'shield-checkmark', bg: '#F5F3FF' },
    vendor: { label: 'VENDOR', color: '#EA580C', icon: 'storefront', bg: '#FFF7ED' },
    driver: { label: 'DRIVER', color: '#0EA5E9', icon: 'bicycle', bg: '#F0F9FF' },
    customer: { label: 'CUSTOMER', color: '#059669', icon: 'person', bg: '#ECFDF5' },
};
const rc = (role) => ROLES[role] || ROLES.customer;

const TIERS = [
    { min: 1000000, label: '💎 Diamond', color: '#7C3AED' },
    { min: 250000, label: '🥇 Gold', color: '#D97706' },
    { min: 50000, label: '🥈 Silver', color: '#64748B' },
    { min: 0, label: '🥉 Bronze', color: '#92400E' },
];
const getTier = (n = 0) => TIERS.find(t => n >= t.min) || TIERS[3];
const fmtAmt = (n) => { if (!n) return '₦0'; if (n >= 1e6) return `₦${(n / 1e6).toFixed(1)}M`; if (n >= 1e3) return `₦${(n / 1e3).toFixed(0)}K`; return `₦${n}`; };
const timeAgo = (d) => {
    if (!d) return 'Never';
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
};

const PRESET_TAGS = [
    { id: 'vip', label: '⭐ VIP', color: '#7C3AED', bg: '#F5F3FF' },
    { id: 'loyal', label: '❤️ Loyal', color: '#E11D48', bg: '#FFF1F2' },
    { id: 'risk', label: '⚠️ At Risk', color: '#D97706', bg: '#FFFBEB' },
    { id: 'fraud', label: '🚨 Fraud', color: '#EF4444', bg: '#FEF2F2' },
    { id: 'new', label: '🆕 New', color: '#0EA5E9', bg: '#F0F9FF' },
    { id: 'inactive', label: '😴 Inactive', color: '#64748B', bg: '#F8FAFC' },
    { id: 'partner', label: '🤝 Partner', color: '#059669', bg: '#ECFDF5' },
];

// ─── Skeleton Card ───────────────────────────────────────────────────────────
const SkeletonCard = ({ anim }) => {
    const bg = anim.interpolate({ inputRange: [0, 1], outputRange: ['#E2E8F0', '#F8FAFC'] });
    const base = (w, h, br = 8) => <Animated.View style={{ width: w, height: h, borderRadius: br, backgroundColor: bg, marginBottom: 6 }} />;
    return (
        <View style={[S.card, { marginBottom: 8 }]}>
            <Animated.View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: bg, marginRight: 12 }} />
            <View style={{ flex: 1 }}>
                {base('60%', 14, 6)}
                {base('80%', 10, 6)}
                <View style={{ flexDirection: 'row', gap: 6 }}>{base(50, 18, 9)}{base(60, 18, 9)}</View>
            </View>
        </View>
    );
};

// ─── Filter Pill ─────────────────────────────────────────────────────────────
const Pill = ({ id, title, count, active, onSelect }) => (
    <TouchableOpacity onPress={() => onSelect(id)} style={[S.pill, active === id && S.pillOn]}>
        <Text style={[S.pillTxt, active === id && S.pillTxtOn]}>{title}</Text>
        {count !== undefined && (
            <View style={[S.pillBadge, active === id && { backgroundColor: 'rgba(255,255,255,0.28)' }]}>
                <Text style={[S.pillBadgeTxt, active === id && { color: '#fff' }]}>{count}</Text>
            </View>
        )}
    </TouchableOpacity>
);

// ─── Quick Action Btn ─────────────────────────────────────────────────────────
const QBtn = ({ icon, label, color, bg, onPress }) => (
    <TouchableOpacity onPress={onPress} style={S.qBtn}>
        <View style={[S.qIcon, { backgroundColor: bg || `${color}18` }]}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[S.qLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
);

// ─── Main ────────────────────────────────────────────────────────────────────
export const AdminUsers = ({ navigation: propNav }) => {
    const nav = propNav || useNavigation();
    const insets = useSafeAreaInsets();
    const shimmer = React.useRef(new Animated.Value(0)).current;

    const [users, setUsers] = React.useState([]);
    const [stats, setStats] = React.useState({ total: 0, vendors: 0, drivers: 0, customers: 0, banned: 0, verified: 0, totalBal: 0, todayNew: 0 });
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [filter, setFilter] = React.useState('all');
    const [sortBy, setSortBy] = React.useState('newest');

    // Modals & actionable state
    const [selUser, setSelUser] = React.useState(null);
    const [detailVis, setDetailVis] = React.useState(false);
    const [sheetVis, setSheetVis] = React.useState(false);
    const [actUser, setActUser] = React.useState(null);
    const [bcastVis, setBcastVis] = React.useState(false);
    const [bTitle, setBTitle] = React.useState('');
    const [bMsg, setBMsg] = React.useState('');
    const [roleVis, setRoleVis] = React.useState(false);
    const [noteVis, setNoteVis] = React.useState(false);
    const [noteText, setNoteText] = React.useState('');
    const [walVis, setWalVis] = React.useState(false);
    const [walAmt, setWalAmt] = React.useState('');
    const [tagVis, setTagVis] = React.useState(false);

    // Bulk
    const [selMode, setSelMode] = React.useState(false);
    const [selIds, setSelIds] = React.useState([]);

    const sheetY = React.useRef(new Animated.Value(600)).current;

    // shimmer loop
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
        Animated.timing(sheetY, { toValue: 600, duration: 200, useNativeDriver: true, easing: Easing.in(Easing.ease) }).start(() => {
            setSheetVis(false);
            if (cb) cb();
        });
    };

    React.useEffect(() => { load(); }, []);

    // ── FETCH ────────────────────────────────────────────────────────────
    const load = async () => {
        setLoading(true);
        try {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const [pRes, wRes, dRes] = await Promise.all([
                supabase.from('profiles').select('*').order('created_at', { ascending: false }).range(0, 300),
                supabase.from('wallets').select('user_id,balance,pending_balance'),
                supabase.from('drivers').select('user_id,vehicle_type,plate_number,vehicle_color,driver_license,status,name'),
            ]);
            const wMap = {};
            (wRes.data || []).forEach(w => wMap[w.user_id] = w);
            const dMap = {};
            (dRes.data || []).forEach(d => dMap[d.user_id] = d);

            const list = (pRes.data || []).map(u => ({
                ...u,
                is_online: u.last_seen ? (Date.now() - new Date(u.last_seen)) < 300000 : false,
                wallet: wMap[u.id] || null,
                tier: getTier(u.total_spend || 0),
                role_cfg: rc(u.role),
                tags: u.admin_tags || [],
                driver_info: dMap[u.id] || null,
            }));

            const totalBal = list.reduce((s, u) => s + (u.wallet?.balance || 0), 0);
            const todayNew = list.filter(u => new Date(u.created_at) >= today).length;
            setUsers(list);
            setStats({
                total: list.length,
                vendors: list.filter(u => u.role === 'vendor').length,
                drivers: list.filter(u => u.role === 'driver').length,
                customers: list.filter(u => !u.role || u.role === 'customer').length,
                banned: list.filter(u => u.is_banned).length,
                verified: list.filter(u => u.is_verified).length,
                totalBal, todayNew,
            });
        } catch { Alert.alert('Error', 'Could not load users.'); }
        finally { setLoading(false); setRefreshing(false); }
    };

    // ── FILTERS ──────────────────────────────────────────────────────────
    const filtered = React.useMemo(() => {
        let list = users;
        if (filter === 'vendor') list = list.filter(u => u.role === 'vendor');
        if (filter === 'driver') list = list.filter(u => u.role === 'driver');
        if (filter === 'customer') list = list.filter(u => !u.role || u.role === 'customer');
        if (filter === 'admin') list = list.filter(u => u.role === 'admin');
        if (filter === 'banned') list = list.filter(u => u.is_banned);
        if (filter === 'verified') list = list.filter(u => u.is_verified);
        if (filter === 'vip') list = list.filter(u => (u.total_spend || 0) >= 250000);
        if (filter === 'wallet') list = list.filter(u => (u.wallet?.balance || 0) > 0);
        if (filter === 'online') list = list.filter(u => u.is_online);
        if (filter === 'new') list = list.filter(u => { const d = new Date(); d.setDate(d.getDate() - 7); return new Date(u.created_at) >= d; });
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(u => u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q) || u.phone?.includes(q));
        }
        return list;
    }, [users, filter, search]);

    const sorted = React.useMemo(() => [...filtered].sort((a, b) => {
        if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '');
        if (sortBy === 'spend') return (b.total_spend || 0) - (a.total_spend || 0);
        if (sortBy === 'balance') return (b.wallet?.balance || 0) - (a.wallet?.balance || 0);
        if (sortBy === 'active') return new Date(b.last_seen || 0) - new Date(a.last_seen || 0);
        return new Date(b.created_at) - new Date(a.created_at);
    }), [filtered, sortBy]);

    // ── ACTIONS ──────────────────────────────────────────────────────────
    const toggleVerify = async (u) => { await supabase.from('profiles').update({ is_verified: !u.is_verified }).eq('id', u.id); load(); };
    const toggleRestrict = async (u) => { await supabase.from('profiles').update({ is_restricted: !(u.is_restricted || false) }).eq('id', u.id); load(); };
    const toggleBan = (u) => {
        const ban = !u.is_banned;
        Alert.alert(ban ? 'Ban User' : 'Unban User', ban ? `Ban ${u.full_name}?` : `Unban ${u.full_name}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: ban ? 'Ban' : 'Unban', style: ban ? 'destructive' : 'default', onPress: async () => { await supabase.from('profiles').update({ is_banned: ban }).eq('id', u.id); load(); } }
        ]);
    };
    const changeRole = async (u, role) => {
        await supabase.from('profiles').update({ role }).eq('id', u.id);
        Alert.alert('✅ Done', `${u.full_name} is now ${role}`);
        setRoleVis(false); load();
    };
    const makeDriver = async (u) => {
        const { data } = await supabase.from('drivers').select('id').eq('user_id', u.id).single();
        if (data) { Alert.alert('Already Driver'); return; }
        await supabase.from('drivers').insert({ name: u.full_name, phone: u.phone, vehicle_type: 'Bike', user_id: u.id });
        await supabase.from('profiles').update({ role: 'driver' }).eq('id', u.id);
        Alert.alert('✅ Done!', `${u.full_name} is now a driver!`); load();
    };
    const saveNote = async () => {
        if (!noteText.trim()) return;
        await supabase.from('profiles').update({ admin_note: noteText.trim() }).eq('id', actUser.id);
        setNoteVis(false); setNoteText(''); load();
    };
    const adjustWallet = async (type) => {
        const amt = parseFloat(walAmt);
        if (isNaN(amt) || amt <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
        if (!actUser?.wallet) {
            await supabase.from('wallets').insert({ user_id: actUser.id, balance: type === 'add' ? amt : 0, pending_balance: 0 });
        } else {
            const nb = type === 'add' ? (actUser.wallet.balance || 0) + amt : Math.max(0, (actUser.wallet.balance || 0) - amt);
            await supabase.from('wallets').update({ balance: nb }).eq('user_id', actUser.id);
        }
        setWalVis(false); setWalAmt('');
        Alert.alert('✅ Done', `Wallet ${type === 'add' ? 'credited' : 'debited'} ${fmtAmt(amt)}`);
        load();
    };
    const toggleTag = async (u, tagId) => {
        const curr = u.admin_tags || [];
        const next = curr.includes(tagId) ? curr.filter(t => t !== tagId) : [...curr, tagId];
        await supabase.from('profiles').update({ admin_tags: next }).eq('id', u.id);
        load();
    };
    const handleBulk = async (action) => {
        if (!selIds.length) return;
        let update = {};
        if (action === 'verify') update = { is_verified: true };
        if (action === 'ban') update = { is_banned: true };
        if (action === 'unban') update = { is_banned: false };
        Alert.alert('Confirm', `Apply "${action}" to ${selIds.length} users?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Apply', style: 'destructive', onPress: async () => { await supabase.from('profiles').update(update).in('id', selIds); setSelMode(false); setSelIds([]); load(); } }
        ]);
    };
    const sendBcast = async () => {
        if (!bTitle.trim() || !bMsg.trim()) { Alert.alert('', 'Fill title and message.'); return; }
        setLoading(true);
        for (const u of filtered) await NotificationService.send({ userId: u.id, title: bTitle, message: bMsg, type: 'system', email: u.email });
        setLoading(false); setBcastVis(false); setBTitle(''); setBMsg('');
        Alert.alert('✅ Sent!', `Broadcast sent to ${filtered.length} users.`);
    };

    // ── USER CARD ─────────────────────────────────────────────────────────
    const renderItem = ({ item }) => {
        const isSel = selIds.includes(item.id);
        const cfg = item.role_cfg;
        const bal = item.wallet?.balance || 0;
        const pend = item.wallet?.pending_balance || 0;
        const userTags = (item.admin_tags || []).map(id => PRESET_TAGS.find(t => t.id === id)).filter(Boolean);

        return (
            <Pressable
                onLongPress={() => !selMode && openSheet(item)}
                onPress={() => selMode
                    ? setSelIds(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id])
                    : (setSelUser(item), setDetailVis(true))
                }
                style={({ pressed }) => [S.card, pressed && { transform: [{ scale: 0.985 }], opacity: 0.9 }, item.is_banned && S.cardBanned, isSel && S.cardSel]}
            >
                {/* Left accent bar */}
                <View style={[S.cardAccent, { backgroundColor: cfg.color }]} />

                {selMode && <Ionicons name={isSel ? 'checkbox' : 'square-outline'} size={21} color={isSel ? '#6366F1' : '#CBD5E1'} style={{ marginRight: 8 }} />}

                {/* Avatar */}
                <View style={S.avWrap}>
                    <View style={[S.avRing, { borderColor: `${cfg.color}40` }]}>
                        <UserAvatar user={item} size={48} />
                    </View>
                    <View style={[S.dot,
                    item.is_banned ? { backgroundColor: '#EF4444' } :
                        item.is_restricted ? { backgroundColor: '#F59E0B' } :
                            item.is_online ? { backgroundColor: '#22C55E' } :
                                { backgroundColor: '#CBD5E1' }
                    ]}>
                        {item.is_banned && <Ionicons name="ban" size={7} color="white" />}
                        {item.is_restricted && !item.is_banned && <Ionicons name="lock-closed" size={7} color="white" />}
                    </View>
                </View>

                {/* Info */}
                <View style={{ flex: 1, minWidth: 0 }}>
                    {/* Name + verified */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                        <Text style={S.cName} numberOfLines={1}>{item.full_name || 'No Name'}</Text>
                        {item.is_verified && <Ionicons name="checkmark-circle" size={13} color="#3B82F6" />}
                    </View>
                    <Text style={S.cEmail} numberOfLines={1}>{item.email}</Text>

                    {/* Badges */}
                    <View style={S.badgeRow}>
                        <View style={[S.badge, { backgroundColor: cfg.bg }]}>
                            <Ionicons name={cfg.icon} size={8} color={cfg.color} style={{ marginRight: 2 }} />
                            <Text style={[S.bdgTxt, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        <View style={[S.badge, { backgroundColor: `${item.tier.color}15` }]}>
                            <Text style={[S.bdgTxt, { color: item.tier.color }]}>{item.tier.label}</Text>
                        </View>
                        {userTags.slice(0, 1).map(t => (
                            <View key={t.id} style={[S.badge, { backgroundColor: t.bg }]}>
                                <Text style={[S.bdgTxt, { color: t.color }]}>{t.label}</Text>
                            </View>
                        ))}
                        {item.admin_note && <Ionicons name="document-text" size={11} color="#D97706" />}
                    </View>

                    {/* Wallet + time */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
                        <View style={[S.walChip, { backgroundColor: bal > 0 ? '#ECFDF5' : '#F8FAFC', borderColor: bal > 0 ? '#A7F3D0' : '#E2E8F0' }]}>
                            <Ionicons name="wallet" size={9} color={bal > 0 ? '#059669' : '#CBD5E1'} />
                            <Text style={[S.walBal, { color: bal > 0 ? '#059669' : '#94A3B8', fontSize: 10 }]}>{fmtAmt(bal)}</Text>
                            {pend > 0 && <Text style={S.walPend}>+{fmtAmt(pend)}</Text>}
                        </View>
                        <Text style={S.lastSeen}>{timeAgo(item.last_seen)}</Text>
                    </View>

                    {/* Driver Info */}
                    {item.role === 'driver' && item.driver_info && (
                        <View style={S.driverInfoRow}>
                            <Ionicons name="bicycle" size={10} color="#0EA5E9" />
                            <Text style={S.driverInfoTxt} numberOfLines={1}>
                                {item.driver_info.vehicle_type || 'Unknown'}
                                {item.driver_info.plate_number ? ` · ${item.driver_info.plate_number}` : ''}
                            </Text>
                            <View style={[S.driverStatus, { backgroundColor: item.driver_info.status === 'active' ? '#DCFCE7' : '#F1F5F9' }]}>
                                <Text style={{ fontSize: 8, fontWeight: '800', color: item.driver_info.status === 'active' ? '#16A34A' : '#94A3B8' }}>
                                    {(item.driver_info.status || 'inactive').toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Right: chat + chevron */}
                {!selMode && (
                    <View style={{ alignItems: 'center', gap: 8, marginLeft: 4 }}>
                        <TouchableOpacity onPress={() => nav.navigate('Chat', { vendorId: item.id, vendorName: item.full_name })} style={S.chatBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="chatbubble-ellipses" size={15} color="#6366F1" />
                        </TouchableOpacity>
                        <Ionicons name="chevron-forward" size={13} color="#CBD5E1" />
                    </View>
                )}
            </Pressable>
        );
    };

    // ── HEADER STAT CHIP ────────────────────────────────────────────────
    const HChip = ({ label, val, color, icon }) => (
        <View style={[S.hChip, { borderColor: `${color}55` }]}>
            <Ionicons name={icon} size={13} color={color} style={{ marginBottom: 3 }} />
            <Text style={[S.hChipVal, { color }]}>{val}</Text>
            <Text style={S.hChipLbl}>{label}</Text>
        </View>
    );

    // ── RENDER ────────────────────────────────────────────────────────────
    return (
        <View style={S.root}>
            <StatusBar barStyle="light-content" />

            {/* HEADER */}
            <LinearGradient colors={['#060612', '#0F0E2E', '#1E1B4B', '#2D2A6E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[S.hdr, { paddingTop: insets.top + 6 }]}>

                {/* Top row */}
                <View style={S.hdrRow}>
                    <TouchableOpacity onPress={() => selMode ? (setSelMode(false), setSelIds([])) : nav.goBack()} style={S.iconCircle}>
                        <Ionicons name={selMode ? 'close' : 'arrow-back'} size={19} color="white" />
                    </TouchableOpacity>

                    <View style={{ flex: 1, paddingHorizontal: 10 }}>
                        {selMode ? (
                            <Text style={S.hdrTitle}>{selIds.length} Selected</Text>
                        ) : (
                            <>
                                <Text style={S.hdrTitle}>User Management</Text>
                                <Text style={S.hdrSub}>{stats.total} users · {stats.todayNew} new today · {fmtAmt(stats.totalBal)} total</Text>
                            </>
                        )}
                    </View>

                    {!selMode ? (
                        <View style={{ flexDirection: 'row', gap: 7 }}>
                            <TouchableOpacity onPress={() => setBcastVis(true)} style={S.iconCircle}><Ionicons name="megaphone" size={17} color="white" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => Share.share({ message: filtered.map(u => `${u.full_name},${u.email},${u.role}`).join('\n') })} style={S.iconCircle}><Ionicons name="cloud-download-outline" size={17} color="white" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => setSelMode(true)} style={S.iconCircle}><Ionicons name="checkbox-outline" size={17} color="white" /></TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', gap: 7 }}>
                            <TouchableOpacity onPress={() => handleBulk('verify')} style={[S.iconCircle, { backgroundColor: 'rgba(34,197,94,0.25)' }]}><Ionicons name="checkmark-done" size={17} color="#22C55E" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleBulk('ban')} style={[S.iconCircle, { backgroundColor: 'rgba(239,68,68,0.25)' }]}><Ionicons name="ban" size={17} color="#EF4444" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleBulk('unban')} style={[S.iconCircle, { backgroundColor: 'rgba(99,102,241,0.25)' }]}><Ionicons name="shield-checkmark" size={17} color="#6366F1" /></TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Compact stat pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
                    {[
                        { icon: 'people', label: 'Total', val: stats.total, color: '#A78BFA' },
                        { icon: 'storefront', label: 'Vendors', val: stats.vendors, color: '#FB923C' },
                        { icon: 'bicycle', label: 'Drivers', val: stats.drivers, color: '#38BDF8' },
                        { icon: 'person', label: 'Customers', val: stats.customers, color: '#34D399' },
                        { icon: 'checkmark-circle', label: 'Verified', val: stats.verified, color: '#4ADE80' },
                        { icon: 'ban', label: 'Banned', val: stats.banned, color: '#F87171' },
                    ].map(c => (
                        <View key={c.label} style={[S.statPill, { borderColor: `${c.color}35`, backgroundColor: `${c.color}14` }]}>
                            <Ionicons name={c.icon} size={11} color={c.color} />
                            <Text style={[S.statPillVal, { color: c.color }]}>{c.val}</Text>
                            <Text style={S.statPillLbl}>{c.label}</Text>
                        </View>
                    ))}
                </ScrollView>
            </LinearGradient>

            {/* SEARCH */}
            <View style={S.searchWrap}>
                <View style={S.searchIcon}>
                    <Ionicons name="search" size={15} color="#6366F1" />
                </View>
                <TextInput
                    placeholder="Search name, email, phone…"
                    placeholderTextColor="#CBD5E1"
                    value={search} onChangeText={setSearch}
                    style={S.searchIn}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 2 }}>
                        <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                )}
            </View>

            {/* FILTER PILLS */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9' }} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}>
                {[
                    { id: 'all', title: 'All', count: stats.total },
                    { id: 'customer', title: 'Customers', count: stats.customers },
                    { id: 'vendor', title: 'Vendors', count: stats.vendors },
                    { id: 'driver', title: 'Drivers', count: stats.drivers },
                    { id: 'admin', title: 'Admins' },
                    { id: 'online', title: '🟢 Online' },
                    { id: 'new', title: '🆕 This Week' },
                    { id: 'wallet', title: '💰 Has Balance' },
                    { id: 'banned', title: '🔴 Banned', count: stats.banned },
                    { id: 'verified', title: '✅ Verified' },
                    { id: 'vip', title: '💎 VIP' },
                ].map(f => <Pill key={f.id} {...f} active={filter} onSelect={setFilter} />)}
            </ScrollView>

            {/* SORT ROW */}
            <View style={S.sortRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366F1' }} />
                    <Text style={S.sortCount}>{sorted.length} <Text style={{ color: '#94A3B8' }}>users</Text></Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {[{ k: 'newest', l: 'Recent', icon: 'time' }, { k: 'active', l: 'Active', icon: 'flash' }, { k: 'name', l: 'Name', icon: 'text' }, { k: 'spend', l: 'Spend', icon: 'cash' }, { k: 'balance', l: 'Balance', icon: 'wallet' }].map(s => (
                        <TouchableOpacity key={s.k} onPress={() => setSortBy(s.k)} style={[S.sChip, sortBy === s.k && S.sChipOn]}>
                            <Ionicons name={s.icon} size={10} color={sortBy === s.k ? '#6366F1' : '#94A3B8'} />
                            <Text style={[S.sChipTxt, sortBy === s.k && { color: '#6366F1', fontWeight: '800' }]}>{s.l}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* LIST */}
            {loading ? (
                <FlatList data={[1, 2, 3, 4, 5, 6]} keyExtractor={i => `${i}`} renderItem={() => <SkeletonCard anim={shimmer} />} contentContainerStyle={{ padding: 14 }} />
            ) : (
                <FlatList
                    data={sorted}
                    keyExtractor={i => i.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6366F1" />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', paddingTop: 80, gap: 12 }}>
                            <Ionicons name="people-outline" size={52} color="#CBD5E1" />
                            <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '600' }}>No users found</Text>
                        </View>
                    }
                />
            )}

            {/* ══ QUICK ACTIONS SHEET ══ */}
            <Modal visible={sheetVis} transparent animationType="none" onRequestClose={() => closeSheet()}>
                <TouchableOpacity style={S.overlay} activeOpacity={1} onPress={() => closeSheet()} />
                <Animated.View style={[S.sheet, { transform: [{ translateY: sheetY }] }]}>
                    <View style={S.drag} />
                    {actUser && (
                        <>
                            {/* User info row */}
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                                <UserAvatar user={actUser} size={44} />
                                <View style={{ marginLeft: 12, flex: 1 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>{actUser.full_name || 'Unknown'}</Text>
                                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>{actUser.email}</Text>
                                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                                        <View style={[S.badge, { backgroundColor: actUser.role_cfg.bg }]}>
                                            <Text style={[S.bdgTxt, { color: actUser.role_cfg.color }]}>{actUser.role_cfg.label}</Text>
                                        </View>
                                        {actUser.is_verified && <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />}
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                    <Text style={{ fontSize: 8, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>Wallet</Text>
                                    <Text style={{ fontSize: 17, fontWeight: '900', color: '#059669' }}>{fmtAmt(actUser.wallet?.balance || 0)}</Text>
                                    {(actUser.wallet?.pending_balance || 0) > 0 && <Text style={{ fontSize: 9, color: '#D97706', fontWeight: '600' }}>+{fmtAmt(actUser.wallet.pending_balance)} pend.</Text>}
                                </View>
                            </View>

                            {actUser.admin_note && (
                                <View style={{ flexDirection: 'row', backgroundColor: '#FEF3C7', borderRadius: 10, padding: 8, marginBottom: 10, alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="document-text" size={13} color="#B45309" />
                                    <Text style={{ fontSize: 11, color: '#B45309', flex: 1, fontWeight: '600' }} numberOfLines={2}>{actUser.admin_note}</Text>
                                </View>
                            )}

                            {/* Action buttons */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                                <QBtn icon="chatbubble" label="Chat" color="#6366F1" onPress={() => closeSheet(() => nav.navigate('Chat', { vendorId: actUser.id, vendorName: actUser.full_name }))} />
                                <QBtn icon="person-outline" label="Profile" color="#0EA5E9" onPress={() => closeSheet(() => { setSelUser(actUser); setDetailVis(true); })} />
                                <QBtn icon={actUser.is_verified ? 'close-circle-outline' : 'checkmark-circle'} label={actUser.is_verified ? 'Unverify' : 'Verify'} color={actUser.is_verified ? '#64748B' : '#22C55E'} onPress={() => closeSheet(() => toggleVerify(actUser))} />
                                <QBtn icon={actUser.is_banned ? 'shield-checkmark' : 'ban'} label={actUser.is_banned ? 'Unban' : 'Ban'} color={actUser.is_banned ? '#22C55E' : '#EF4444'} onPress={() => closeSheet(() => toggleBan(actUser))} />
                                <QBtn icon={actUser.is_restricted ? 'lock-open-outline' : 'lock-closed-outline'} label={actUser.is_restricted ? 'Unrestrict' : 'Restrict'} color="#F59E0B" onPress={() => closeSheet(() => toggleRestrict(actUser))} />
                                <QBtn icon="swap-horizontal" label="Role" color="#8B5CF6" onPress={() => { setRoleVis(true); }} />
                                <QBtn icon="bicycle" label="→ Driver" color="#0EA5E9" onPress={() => closeSheet(() => makeDriver(actUser))} />
                                <QBtn icon="wallet" label="Wallet" color="#059669" onPress={() => setWalVis(true)} />
                                <QBtn icon="pricetag" label="Tags" color="#D97706" onPress={() => setTagVis(true)} />
                                <QBtn icon="create" label="Note" color="#6366F1" onPress={() => { setNoteText(actUser.admin_note || ''); setNoteVis(true); }} />
                            </ScrollView>
                        </>
                    )}
                </Animated.View>
            </Modal>

            {/* ══ ROLE PICKER ══ */}
            <Modal visible={roleVis} transparent animationType="fade" onRequestClose={() => setRoleVis(false)}>
                <TouchableOpacity style={S.overlay} onPress={() => setRoleVis(false)} />
                <View style={S.picker}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 16 }}>Change Role — {actUser?.full_name}</Text>
                    {Object.entries(ROLES).map(([role, cfg]) => (
                        <TouchableOpacity key={role} style={[S.pRow, actUser?.role === role && { backgroundColor: `${cfg.color}10` }]} onPress={() => changeRole(actUser, role)}>
                            <View style={[S.qIcon, { backgroundColor: cfg.bg, marginRight: 14 }]}><Ionicons name={cfg.icon} size={18} color={cfg.color} /></View>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: cfg.color, flex: 1 }}>{cfg.label}</Text>
                            {actUser?.role === role && <Ionicons name="checkmark-circle" size={18} color={cfg.color} />}
                        </TouchableOpacity>
                    ))}
                </View>
            </Modal>

            {/* ══ TAGS PICKER ══ */}
            <Modal visible={tagVis} transparent animationType="slide" onRequestClose={() => setTagVis(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 36 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 14 }}>🏷️ Tags — {actUser?.full_name}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {PRESET_TAGS.map(t => {
                                const active = (actUser?.admin_tags || []).includes(t.id);
                                return (
                                    <TouchableOpacity key={t.id} onPress={() => toggleTag(actUser, t.id)} style={[{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 2, borderColor: active ? t.color : '#E2E8F0', backgroundColor: active ? t.bg : 'white' }]}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: active ? t.color : '#64748B' }}>{t.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <TouchableOpacity onPress={() => setTagVis(false)} style={{ marginTop: 18, backgroundColor: '#6366F1', borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ══ NOTE MODAL ══ */}
            <Modal visible={noteVis} transparent animationType="slide" onRequestClose={() => setNoteVis(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }}>
                    <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 20 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 }}>📝 Admin Note — {actUser?.full_name}</Text>
                        <TextInput style={[S.fieldIn, { height: 120, textAlignVertical: 'top' }]} placeholder="Note about this user…" placeholderTextColor="#94A3B8" value={noteText} onChangeText={setNoteText} multiline />
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                            <TouchableOpacity onPress={() => setNoteVis(false)} style={{ flex: 1, backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}><Text style={{ color: '#64748B', fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={saveNote} style={{ flex: 2, backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}><Text style={{ color: 'white', fontWeight: '800' }}>Save</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ══ WALLET MODAL ══ */}
            <Modal visible={walVis} transparent animationType="slide" onRequestClose={() => setWalVis(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }}>
                    <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 20 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>💰 Adjust Wallet</Text>
                        <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>Current: <Text style={{ color: '#059669', fontWeight: '800' }}>{fmtAmt(actUser?.wallet?.balance || 0)}</Text></Text>
                        <TextInput style={[S.fieldIn, { height: 52 }]} placeholder="Amount (₦)" placeholderTextColor="#94A3B8" value={walAmt} onChangeText={setWalAmt} keyboardType="numeric" />
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                            <TouchableOpacity onPress={() => { setWalVis(false); setWalAmt(''); }} style={{ backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}><Text style={{ color: '#64748B', fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => adjustWallet('subtract')} style={{ flex: 1, backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}><Text style={{ color: '#EF4444', fontWeight: '800' }}>Debit</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => adjustWallet('add')} style={{ flex: 1, backgroundColor: '#ECFDF5', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}><Text style={{ color: '#059669', fontWeight: '800' }}>Credit</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ══ BROADCAST MODAL ══ */}
            <Modal visible={bcastVis} transparent animationType="slide" onRequestClose={() => setBcastVis(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
                        <LinearGradient colors={['#4F46E5', '#7C3AED']} style={{ flexDirection: 'row', alignItems: 'center', padding: 18, gap: 10 }}>
                            <Ionicons name="megaphone" size={20} color="white" />
                            <Text style={{ flex: 1, color: 'white', fontSize: 15, fontWeight: '800' }}>Broadcast to {filtered.length} users</Text>
                            <TouchableOpacity onPress={() => setBcastVis(false)}><Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" /></TouchableOpacity>
                        </LinearGradient>
                        <View style={{ padding: 18, gap: 12 }}>
                            <TextInput style={S.fieldIn} placeholder="Title (e.g. Special Offer! 🎉)" placeholderTextColor="#94A3B8" value={bTitle} onChangeText={setBTitle} />
                            <TextInput style={[S.fieldIn, { height: 100, textAlignVertical: 'top' }]} placeholder="Message…" placeholderTextColor="#94A3B8" value={bMsg} onChangeText={setBMsg} multiline />
                            <TouchableOpacity onPress={sendBcast} disabled={loading} style={{ borderRadius: 14, overflow: 'hidden' }}>
                                <LinearGradient colors={['#4F46E5', '#7C3AED']} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}>
                                    {loading ? <ActivityIndicator color="white" /> : <><Ionicons name="send" size={15} color="white" style={{ marginRight: 8 }} /><Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>Send Broadcast</Text></>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <AdminUserDetails visible={detailVis} user={selUser} navigation={nav} onClose={() => setDetailVis(false)} onUpdate={load} />
        </View>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F1F5F9' },
    hdr: { paddingHorizontal: 18, paddingBottom: 18 },
    hdrRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    hdrTitle: { color: 'white', fontSize: 20, fontWeight: '900', letterSpacing: -.5 },
    hdrSub: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '500', marginTop: 2 },
    hChip: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, minWidth: 68 },
    hChipVal: { fontSize: 15, fontWeight: '900' },
    hChipLbl: { fontSize: 8, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase' },
    statPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
    statPillVal: { fontSize: 13, fontWeight: '900' },
    statPillLbl: { fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
    searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', marginHorizontal: 14, marginTop: 12, marginBottom: 4, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1.5, borderColor: '#EEF2FF', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    searchIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    searchIn: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A' },
    pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', gap: 5 },
    pillOn: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    pillTxt: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    pillTxtOn: { color: 'white' },
    pillBadge: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
    pillBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#64748B' },
    sortRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, gap: 10 },
    sortCount: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
    sChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 4 },
    sChipOn: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
    sChipTxt: { fontSize: 11, fontWeight: '600', color: '#64748B' },
    card: { backgroundColor: 'white', borderRadius: 20, paddingVertical: 13, paddingRight: 12, paddingLeft: 0, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#1E1B4B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3, overflow: 'hidden' },
    cardAccent: { width: 4, height: '100%', borderRadius: 2, marginRight: 10 },
    cardBanned: { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' },
    cardSel: { borderColor: '#6366F1', borderWidth: 2, backgroundColor: '#EEF2FF' },
    avWrap: { width: 52, height: 52, marginRight: 11, position: 'relative' },
    avRing: { borderRadius: 26, borderWidth: 2, padding: 1 },
    dot: { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
    cName: { fontSize: 14, fontWeight: '800', color: '#0F172A', flex: 1, letterSpacing: -0.2 },
    cEmail: { fontSize: 10.5, color: '#94A3B8', marginBottom: 5, fontWeight: '500' },
    badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 2 },
    badge: { paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 7, flexDirection: 'row', alignItems: 'center' },
    bdgTxt: { fontSize: 9, fontWeight: '800' },
    walChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
    walBal: { fontSize: 11, fontWeight: '800' },
    walPend: { fontSize: 9.5, color: '#D97706', fontWeight: '600' },
    lastSeen: { fontSize: 9.5, color: '#CBD5E1', fontWeight: '600' },
    driverInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#F0F9FF' },
    driverInfoTxt: { fontSize: 10, fontWeight: '700', color: '#0EA5E9', flex: 1 },
    driverStatus: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
    chatBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 38 },
    drag: { width: 36, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
    picker: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 40 },
    pRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 10, borderRadius: 14, marginBottom: 6 },
    qBtn: { alignItems: 'center', width: 68 },
    qIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
    qLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
    fieldIn: { backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
});
