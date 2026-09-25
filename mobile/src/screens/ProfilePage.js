import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Image,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    Platform,
    Alert,
    Modal,
    Linking,
    StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { UserAvatar } from '../components/UserAvatar';
import { useAppSettings } from '../context/AppSettingsContext';
import {
    getFollowedStoresList,
    getVendorFollowersList,
    toggleFollowStore,
    subscribeToFollowChanges
} from '../services/vendorFollowerService';

// Compact currency formatter
const formatCurrency = (amount) => {
    try {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            maximumFractionDigits: 0
        }).format(amount || 0).replace('NGN', '₦');
    } catch (_) {
        return '₦' + Number(amount || 0).toLocaleString();
    }
};

// Loyalty tier resolver with progress and perks
const getLoyaltyTier = (pts = 0) => {
    const points = pts || 0;
    if (points >= 5000) {
        return {
            tier: 'VIP Gold',
            color: '#D4AF37',
            icon: 'shield-checkmark',
            nextTier: 'Max Tier',
            nextPoints: 5000,
            progress: 1.0,
            perk: 'VIP Concierge & 5% Instant Cashback on All Orders'
        };
    }
    if (points >= 1500) {
        return {
            tier: 'Platinum Member',
            color: '#F59E0B',
            icon: 'trophy',
            nextTier: 'VIP Gold',
            nextPoints: 5000,
            progress: Math.min(1, Math.max(0.12, (points - 1500) / 3500)),
            perk: 'Free Delivery on Orders > ₦15k & Priority Support'
        };
    }
    if (points >= 500) {
        return {
            tier: 'Silver Member',
            color: '#3B82F6',
            icon: 'ribbon',
            nextTier: 'Platinum',
            nextPoints: 1500,
            progress: Math.min(1, Math.max(0.12, (points - 500) / 1000)),
            perk: '2% Cash Rebate & Exclusive Flash Deal Access'
        };
    }
    return {
        tier: 'Bronze Member',
        color: '#64748B',
        icon: 'medal',
        nextTier: 'Silver',
        nextPoints: 500,
        progress: Math.min(1, Math.max(0.08, points / 500)),
        perk: 'Earn 10 reward points for every ₦1,000 spent'
    };
};

const ProfilePageInner = ({
    user,
    onLogout,
    onBack,
    onOpenVendorRegister,
    onOpenAdmin,
    onOpenVendor,
    onNavigate,
    onUpdateUser
}) => {
    const [wallet, setWallet] = useState({ balance: 0, points: 0 });
    const [ordersCount, setOrdersCount] = useState(0);
    const [pendingOrders, setPendingOrders] = useState(0);
    const [activeBnplCount, setActiveBnplCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [vendorApp, setVendorApp] = useState(null);
    const { settings } = useAppSettings();

    // Followed Stores State
    const [followedStores, setFollowedStores] = useState([]);
    const [showFollowedModal, setShowFollowedModal] = useState(false);
    const [followedLoading, setFollowedLoading] = useState(false);
    const [storeSearch, setStoreSearch] = useState('');

    // Vendor Followers State (Admin & Vendor Only)
    const [vendorFollowersCount, setVendorFollowersCount] = useState(0);
    const [vendorFollowersList, setVendorFollowersList] = useState([]);
    const [showVendorFollowersModal, setShowVendorFollowersModal] = useState(false);
    const [followersLoading, setFollowersLoading] = useState(false);
    const [followersSearch, setFollowersSearch] = useState('');

    // New Features State
    const [showVouchersModal, setShowVouchersModal] = useState(false);
    const [showMemberPassModal, setShowMemberPassModal] = useState(false);
    const [copiedCode, setCopiedCode] = useState(null);

    const availableVouchers = [
        {
            id: 'v1',
            code: 'MAFHALGOLD',
            title: '₦2,500 Off Storewide',
            minSpend: 'Orders above ₦20,000',
            expiry: 'Expires in 5 days',
            badge: 'EXCLUSIVE',
            badgeColor: '#D97706'
        },
        {
            id: 'v2',
            code: 'FREESHIP26',
            title: '100% Free Express Delivery',
            minSpend: 'Next 2 store orders',
            expiry: 'Expires in 7 days',
            badge: 'POPULAR',
            badgeColor: '#059669'
        },
        {
            id: 'v3',
            code: 'VIPCASH5',
            title: '5% Instant Wallet Rebate',
            minSpend: 'Electronics & Fashion category',
            expiry: 'Valid all month',
            badge: 'CASHBACK',
            badgeColor: '#7C3AED'
        }
    ];

    const copyCodeToClipboard = (code, desc = 'Voucher code') => {
        try {
            if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(code);
            }
        } catch (_) {}
        setCopiedCode(code);
        if (Platform.OS === 'web') {
            alert(`${desc} "${code}" copied to clipboard! Apply at checkout.`);
        } else {
            Alert.alert('Copied!', `${desc} "${code}" copied to clipboard. Apply at checkout.`);
        }
        setTimeout(() => setCopiedCode(null), 3500);
    };

    useEffect(() => {
        const loadProfileData = async () => {
            let activeUid = user?.id;
            if (!activeUid) {
                try {
                    const { data: { user: authUser } } = await supabase.auth.getUser();
                    if (authUser) {
                        activeUid = authUser.id;
                        if (onUpdateUser) {
                            onUpdateUser({
                                id: authUser.id,
                                email: authUser.email,
                                full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
                                fullName: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
                                phone: authUser.user_metadata?.phone || authUser.phone,
                                avatar_url: authUser.user_metadata?.avatar_url,
                                role: authUser.user_metadata?.role || 'buyer'
                            });
                        }
                    }
                } catch (_) {}
            }

            if (activeUid) {
                fetchData(activeUid);
            } else {
                setLoading(false);
            }
        };

        loadProfileData();
    }, [user?.id]);

    useEffect(() => {
        loadFollowedStores();
        loadVendorFollowers();
        const unsub = subscribeToFollowChanges(() => {
            loadFollowedStores();
            loadVendorFollowers();
        });
        return () => {
            if (typeof unsub === 'function') unsub();
        };
    }, [user?.id, user?.role]);

    const loadFollowedStores = async () => {
        try {
            setFollowedLoading(true);
            const list = await getFollowedStoresList(user?.id);
            setFollowedStores(list || []);
        } catch (_) {
        } finally {
            setFollowedLoading(false);
        }
    };

    const loadVendorFollowers = async () => {
        if (!user?.id) return;
        const roleLower = (user?.role || '').toLowerCase();
        if (roleLower === 'admin' || roleLower === 'vendor') {
            try {
                setFollowersLoading(true);
                const res = await getVendorFollowersList(user.id);
                setVendorFollowersCount(res.totalCount || 0);
                setVendorFollowersList(res.followers || []);
            } catch (_) {
            } finally {
                setFollowersLoading(false);
            }
        } else {
            setVendorFollowersCount(0);
            setVendorFollowersList([]);
        }
    };

    const handleUnfollowStore = async (storeId, storeName) => {
        try {
            await toggleFollowStore(storeId, storeName, user?.id);
            const freshList = await getFollowedStoresList(user?.id);
            setFollowedStores(freshList || []);
        } catch (_) {}
    };

    const fetchData = async (uid) => {
        try {
            setLoading(true);
            const [profileRes, walletRes, ordersRes, vendorAppRes] = await Promise.allSettled([
                supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
                supabase.from('wallets').select('balance, points').eq('user_id', uid).maybeSingle(),
                supabase.from('orders').select('id, status').eq('user_id', uid),
                supabase.from('vendor_applications').select('status').eq('user_id', uid).maybeSingle()
            ]);

            const pData = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
            if (pData && onUpdateUser) {
                onUpdateUser({ ...user, ...pData });
            }

            const wData = walletRes.status === 'fulfilled' ? walletRes.value.data : null;
            if (wData) {
                setWallet({
                    balance: wData.balance || 0,
                    points: Math.max(wData.points || 0, pData?.mafhal_coins || 0)
                });
            } else {
                setWallet({ balance: 0, points: pData?.mafhal_coins || 0 });
            }

            const oData = ordersRes.status === 'fulfilled' ? ordersRes.value.data || [] : [];
            setOrdersCount(oData.length);
            const pending = oData.filter(o => {
                const s = (o.status || '').toLowerCase();
                return s === 'pending' || s === 'processing';
            }).length;
            setPendingOrders(pending);

            const vData = vendorAppRes.status === 'fulfilled' ? vendorAppRes.value.data : null;
            if (vData) setVendorApp(vData);

            // Fetch active Pay Small Small installments count
            try {
                const cachedPss = await AsyncStorage.getItem(`@abumafhal_pss_plans_${uid}`);
                if (cachedPss) {
                    const parsed = JSON.parse(cachedPss);
                    if (Array.isArray(parsed)) {
                        setActiveBnplCount(parsed.filter(p => !p.isCompleted).length);
                    }
                }
            } catch (_) {}

        } catch (e) {
            console.log('Error loading profile data:', e);
        } finally {
            setLoading(false);
        }
    };

    const loyalty = getLoyaltyTier(wallet.points);

    // Dynamic role details & robust Admin resolver
    const role = (user?.role || 'buyer').toLowerCase();
    const userEmail = (user?.email || '').toLowerCase().trim();
    const KNOWN_ADMIN_EMAILS = ['sale.abumafhal@gmail.com', 'admin@abumafhal.com', 'abumafhal@gmail.com'];
    const isAdmin = role === 'admin' ||
                    user?.role === 'admin' ||
                    user?.user_metadata?.role === 'admin' ||
                    KNOWN_ADMIN_EMAILS.includes(userEmail) ||
                    userEmail.includes('admin');
    const isVendor = role === 'vendor' || user?.role === 'vendor';
    const isDriver = role === 'driver' || user?.role === 'driver';

    const handleOpenAdminConsole = () => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@abumafhal_last_screen', 'AdminDashboard');
                if (window.location.hash !== '#admin') window.location.hash = 'admin';
            }
        } catch (_) {}

        if (typeof onOpenAdmin === 'function') {
            try {
                onOpenAdmin();
                return;
            } catch (err) {
                console.warn('onOpenAdmin error:', err);
            }
        }
        if (typeof onNavigate === 'function') {
            try {
                onNavigate('AdminDashboard');
                return;
            } catch (err) {
                console.warn('onNavigate error:', err);
            }
        }
    };

    const displayName = user?.fullName || user?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Member';
    const displaySubtitle = user?.email || user?.phone || user?.phone_number || '';

    // Menu Group 1: Shopping & Activity (Navy & Gold Theme)
    const shoppingItems = [
        {
            icon: 'bag-handle-outline',
            iconColor: '#D9A73A',
            iconBg: 'rgba(217, 167, 58, 0.12)',
            label: 'My Orders',
            badge: pendingOrders > 0 ? `${pendingOrders} active` : ordersCount > 0 ? `${ordersCount}` : null,
            badgeColor: pendingOrders > 0 ? '#D97706' : '#D9A73A',
            screen: 'orders'
        },
        {
            icon: 'storefront-outline',
            iconColor: '#F59E0B',
            iconBg: 'rgba(245, 158, 11, 0.12)',
            label: 'Following Stores',
            subtitle: 'Stores you follow',
            badge: followedStores.length > 0 ? `${followedStores.length}` : null,
            badgeColor: '#D9A73A',
            action: () => setShowFollowedModal(true)
        },
        ...((isAdmin || isVendor) ? [{
            icon: 'people-outline',
            iconColor: '#10B981',
            iconBg: 'rgba(16, 185, 129, 0.12)',
            label: 'Store Followers',
            subtitle: 'Customers following your store',
            badge: vendorFollowersCount > 0 ? `${vendorFollowersCount}` : null,
            badgeColor: '#10B981',
            action: () => setShowVendorFollowersModal(true)
        }] : []),
        {
            icon: 'heart-outline',
            iconColor: '#F43F5E',
            iconBg: 'rgba(244, 63, 94, 0.12)',
            label: 'Wishlist & Saved',
            screen: 'wishlist'
        },
        {
            icon: 'navigate-outline',
            iconColor: '#38BDF8',
            iconBg: 'rgba(56, 189, 248, 0.12)',
            label: 'Track Delivery',
            screen: 'TrackOrder'
        },
        {
            icon: 'chatbubbles-outline',
            iconColor: '#14B8A6',
            iconBg: 'rgba(20, 184, 166, 0.12)',
            label: 'Messages & Chats',
            screen: 'ConversationsScreen'
        }
    ];

    // Menu Group 2: Finances & Rewards
    const financeItems = [
        {
            icon: 'wallet-outline',
            iconColor: '#D9A73A',
            iconBg: 'rgba(217, 167, 58, 0.15)',
            label: 'Mafhal Pay & Wallet',
            extra: formatCurrency(wallet.balance),
            screen: 'wallet'
        },
        {
            icon: 'calendar-outline',
            iconColor: '#F59E0B',
            iconBg: 'rgba(245, 158, 11, 0.12)',
            label: 'Pay Small Small (BNPL)',
            badge: activeBnplCount > 0 ? `${activeBnplCount} Active` : '0% Interest',
            badgeColor: '#D9A73A',
            screen: 'PaySmallSmall'
        },
        {
            icon: 'gift-outline',
            iconColor: '#10B981',
            iconBg: 'rgba(16, 185, 129, 0.12)',
            label: 'Refer & Earn (₦1,000 Bonus)',
            badge: '₦1k Bonus',
            badgeColor: '#10B981',
            screen: 'referral'
        },
        {
            icon: 'location-outline',
            iconColor: '#A78BFA',
            iconBg: 'rgba(167, 139, 250, 0.12)',
            label: 'Delivery Addresses',
            screen: 'address'
        }
    ];

    // Menu Group 3: Account & Support
    const supportItems = [
        ...(isAdmin ? [{
            icon: 'shield-checkmark-outline',
            iconColor: '#D9A73A',
            iconBg: 'rgba(217, 167, 58, 0.2)',
            label: 'Admin Control Console',
            subtitle: 'Platform metrics, vendor approvals & control',
            badge: 'ADMIN',
            badgeColor: '#D9A73A',
            action: handleOpenAdminConsole
        }] : []),
        {
            icon: 'settings-outline',
            iconColor: '#94A3B8',
            iconBg: 'rgba(148, 163, 184, 0.12)',
            label: 'Account Settings',
            screen: 'settings'
        },
        {
            icon: 'headset-outline',
            iconColor: '#10B981',
            iconBg: 'rgba(16, 185, 129, 0.12)',
            label: 'Customer Support & WhatsApp',
            screen: 'support'
        },
        {
            icon: 'information-circle-outline',
            iconColor: '#D9A73A',
            iconBg: 'rgba(217, 167, 58, 0.12)',
            label: 'About Abu Mafhal',
            screen: 'about'
        }
    ];

    const handleItemPress = (item) => {
        if (item.action) {
            item.action();
            return;
        }
        const screen = item.screen;
        if (!screen) return;
        if (!user && screen !== 'support' && screen !== 'about') {
            onNavigate && onNavigate('Auth');
            return;
        }
        if (onNavigate) {
            onNavigate(screen);
        }
    };

    const confirmLogout = () => {
        if (Platform.OS === 'web') {
            const ok = typeof window !== 'undefined' ? window.confirm('Are you sure you want to log out?') : true;
            if (ok && onLogout) onLogout();
        } else {
            Alert.alert(
                'Log Out',
                'Are you sure you want to log out of Abu Mafhal?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Log Out', style: 'destructive', onPress: onLogout }
                ]
            );
        }
    };

    // Filter followed stores
    const filteredFollowedStores = followedStores.filter(st => {
        if (!storeSearch) return true;
        const q = storeSearch.toLowerCase();
        return (st.name || '').toLowerCase().includes(q) || (st.category && st.category.toLowerCase().includes(q));
    });

    // Filter vendor followers (for Admin & Vendor)
    const filteredVendorFollowers = vendorFollowersList.filter(f => {
        if (!followersSearch) return true;
        const q = followersSearch.toLowerCase();
        const name = (f.name || f.full_name || f.username || '').toLowerCase();
        const email = (f.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
    });

    return (
        <SafeAreaView style={s.safeArea}>
            {/* ── TOP NAV BAR (COMPACT & SLEEK) ── */}
            <View style={s.topBar}>
                <TouchableOpacity
                    onPress={onBack}
                    style={s.topBarBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="chevron-back" size={19} color="#0A192F" />
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                    <Text style={s.topBarTitle}>My Profile</Text>
                    <Text style={s.topBarSubtitle}>Account & Verified Services</Text>
                </View>

                {user ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                            onPress={() => setShowMemberPassModal(true)}
                            style={s.topBarBtn}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="qr-code-outline" size={16} color="#0A192F" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onNavigate && onNavigate('editProfile')}
                            style={s.topBarBtn}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="create-outline" size={16} color="#0A192F" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={{ width: 32 }} />
                )}
            </View>

            <ScrollView
                style={s.scroll}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── USER HERO CARD (LUXURY ROYAL NAVY & GOLD VIP PASSPORT CARD) ── */}
                {user ? (
                    <LinearGradient
                        colors={['#071932', '#0A2540', '#10375C']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.heroCard}
                    >
                        {/* Decorative Top Passport Accent */}
                        <View style={s.heroTopBarDecor}>
                            <View style={s.passportBadge}>
                                <Ionicons name="sparkles" size={10} color="#D4AF37" />
                                <Text style={s.passportText}>✦ VIP ESCROW PASSPORT</Text>
                            </View>
                            <View style={s.heroStatusPill}>
                                <View style={s.activeDot} />
                                <Text style={s.heroStatusText}>Active Escrow Member</Text>
                            </View>
                        </View>

                        <View style={s.heroMainRow}>
                            <View style={s.avatarWrap}>
                                <View style={s.avatarRing}>
                                    <UserAvatar user={user} size={48} />
                                </View>
                                <View style={s.verifiedDot}>
                                    <Ionicons name="checkmark" size={9} color="#D9A73A" />
                                </View>
                            </View>

                            <View style={s.heroInfo}>
                                <View style={s.heroNameRow}>
                                    <Text style={s.heroName} numberOfLines={1}>{displayName}</Text>
                                    <View style={[
                                        s.roleBadge,
                                        isAdmin ? s.roleBadgeAdmin : isVendor ? s.roleBadgeVendor : isDriver ? s.roleBadgeDriver : s.roleBadgeBuyer
                                    ]}>
                                        <Text style={[
                                            s.roleBadgeText,
                                            isAdmin ? s.roleTextAdmin : isVendor ? s.roleTextVendor : isDriver ? s.roleTextDriver : s.roleTextBuyer
                                        ]}>
                                            {isAdmin ? 'ADMIN' : isVendor ? 'VENDOR' : isDriver ? 'DRIVER' : 'BUYER'}
                                        </Text>
                                    </View>
                                </View>

                                {displaySubtitle ? (
                                    <Text style={s.heroSub} numberOfLines={1}>{displaySubtitle}</Text>
                                ) : null}

                                {/* Compact Action Pills Row */}
                                <View style={s.heroPillsRow}>
                                    <TouchableOpacity
                                        style={s.editPillBtn}
                                        activeOpacity={0.75}
                                        onPress={() => onNavigate && onNavigate('editProfile')}
                                    >
                                        <Ionicons name="pencil-sharp" size={10} color="#D9A73A" style={{ marginRight: 3 }} />
                                        <Text style={s.editPillText}>Edit Profile</Text>
                                    </TouchableOpacity>

                                    {/* Followers Pill - Admin & Vendor Only */}
                                    {(isAdmin || isVendor) && (
                                        <TouchableOpacity
                                            style={s.heroFollowersPill}
                                            activeOpacity={0.75}
                                            onPress={() => setShowVendorFollowersModal(true)}
                                        >
                                            <Ionicons name="people" size={10} color="#10B981" style={{ marginRight: 3 }} />
                                            <Text style={s.heroFollowersPillText}>
                                                {vendorFollowersCount} {vendorFollowersCount === 1 ? 'Follower' : 'Followers'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {/* Following Pill - Available to ALL roles (Admin, Vendor, Buyer, Driver) */}
                                    <TouchableOpacity
                                        style={s.heroStoresPill}
                                        activeOpacity={0.75}
                                        onPress={() => setShowFollowedModal(true)}
                                    >
                                        <Ionicons name="storefront" size={10} color="#D9A73A" style={{ marginRight: 3 }} />
                                        <Text style={s.heroStoresPillText}>
                                            {followedStores.length} Following
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>
                ) : (
                    /* GUEST CARD */
                    <LinearGradient
                        colors={['#0E223D', '#070F1E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.guestCard}
                    >
                        <View style={s.guestIconWrap}>
                            <Ionicons name="person-circle-outline" size={38} color="#D9A73A" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.guestTitle}>Welcome to Abu Mafhal</Text>
                            <Text style={s.guestSub}>Sign in to access orders, wallet & rewards</Text>
                        </View>
                        <TouchableOpacity
                            style={s.guestSignInBtn}
                            activeOpacity={0.85}
                            onPress={() => onNavigate && onNavigate('Auth')}
                        >
                            <Text style={s.guestSignInBtnText}>Sign In</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                )}

                {/* ── UNIFIED 3-IN-1 QUICK METRICS CARD (CLEAN WHITE & ROYAL NAVY) ── */}
                {user && (
                    <View style={s.metricsCard}>
                        <TouchableOpacity
                            style={s.metricColumn}
                            activeOpacity={0.7}
                            onPress={() => onNavigate && onNavigate('wallet')}
                        >
                            <Text style={s.metricLabel}>WALLET BALANCE</Text>
                            <Text style={s.metricValue} numberOfLines={1}>
                                {loading ? '...' : formatCurrency(wallet.balance)}
                            </Text>
                            <View style={s.metricActionRow}>
                                <Ionicons name="add-circle" size={11} color="#D4AF37" />
                                <Text style={s.metricActionText}>Top Up ↗</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={s.metricDivider} />

                        <TouchableOpacity
                            style={s.metricColumn}
                            activeOpacity={0.7}
                            onPress={() => onNavigate && onNavigate('orders')}
                        >
                            <Text style={s.metricLabel}>MY ORDERS</Text>
                            <Text style={s.metricValue} numberOfLines={1}>
                                {loading ? '...' : `${ordersCount}`}
                            </Text>
                            <View style={s.metricActionRow}>
                                <View style={[s.metricDot, pendingOrders > 0 ? { backgroundColor: '#F59E0B' } : { backgroundColor: '#10B981' }]} />
                                <Text style={[s.metricActionText, pendingOrders > 0 && { color: '#F59E0B' }]}>
                                    {pendingOrders > 0 ? `${pendingOrders} Active` : 'History →'}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <View style={s.metricDivider} />

                        <TouchableOpacity
                            style={s.metricColumn}
                            activeOpacity={0.7}
                            onPress={() => onNavigate && onNavigate('referral')}
                        >
                            <Text style={s.metricLabel}>REWARD PTS</Text>
                            <Text style={s.metricValue} numberOfLines={1}>
                                {loading ? '...' : `${wallet.points}`}
                            </Text>
                            <View style={s.metricActionRow}>
                                <Ionicons name="sparkles" size={10} color="#D4AF37" />
                                <Text style={[s.metricActionText, { color: loyalty.color || '#D4AF37' }]}>
                                    {loyalty.tier}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── QUICK HUB 4-TILE SERVICES GRID (NEW CLEAN ARRANGEMENT) ── */}
                {user && (
                    <View style={s.quickHubWrap}>
                        <View style={s.quickHubGrid}>
                            <TouchableOpacity
                                style={s.quickHubTile}
                                activeOpacity={0.8}
                                onPress={() => onNavigate && onNavigate('orders')}
                            >
                                <View style={[s.quickHubIconBox, { backgroundColor: 'rgba(217, 167, 58, 0.12)' }]}>
                                    <Ionicons name="cube-outline" size={20} color="#D4AF37" />
                                    {pendingOrders > 0 && (
                                        <View style={s.quickHubBadge}>
                                            <Text style={s.quickHubBadgeText}>{pendingOrders}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={s.quickHubTitle}>My Orders</Text>
                                <Text style={s.quickHubSub}>Track & History</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={s.quickHubTile}
                                activeOpacity={0.8}
                                onPress={() => onNavigate && onNavigate('wallet')}
                            >
                                <View style={[s.quickHubIconBox, { backgroundColor: 'rgba(10, 25, 47, 0.08)' }]}>
                                    <Ionicons name="wallet-outline" size={20} color="#0A192F" />
                                </View>
                                <Text style={s.quickHubTitle}>Mafhal Pay</Text>
                                <Text style={s.quickHubSub}>Top Up & Send</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={s.quickHubTile}
                                activeOpacity={0.8}
                                onPress={() => setShowVouchersModal(true)}
                            >
                                <View style={[s.quickHubIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                                    <Ionicons name="ticket-outline" size={20} color="#F59E0B" />
                                    <View style={[s.quickHubBadge, { backgroundColor: '#F59E0B' }]}>
                                        <Text style={s.quickHubBadgeText}>3</Text>
                                    </View>
                                </View>
                                <Text style={s.quickHubTitle}>Vouchers</Text>
                                <Text style={s.quickHubSub}>3 Coupons Ready</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={s.quickHubTile}
                                activeOpacity={0.8}
                                onPress={() => setShowMemberPassModal(true)}
                            >
                                <View style={[s.quickHubIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                                    <Ionicons name="qr-code-outline" size={20} color="#10B981" />
                                </View>
                                <Text style={s.quickHubTitle}>VIP Pass</Text>
                                <Text style={s.quickHubSub}>Digital Hub QR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ── VIP LOYALTY TIER PROGRESS TRACKER (CLEAN ELEVATED CARD) ── */}
                {user && (
                    <View style={s.loyaltyCard}>
                        <View style={s.loyaltyTopRow}>
                            <View style={s.loyaltyTierBadge}>
                                <Ionicons name={loyalty.icon || 'trophy'} size={12} color="#D4AF37" />
                                <Text style={s.loyaltyTierName}>{loyalty.tier}</Text>
                            </View>
                            <Text style={s.loyaltyPointsText}>
                                <Text style={s.loyaltyPointsBold}>{wallet.points}</Text> / {loyalty.nextPoints} pts
                            </Text>
                        </View>

                        {/* Gold Progress Track */}
                        <View style={s.loyaltyTrack}>
                            <View style={[s.loyaltyBar, { width: `${Math.round(loyalty.progress * 100)}%` }]} />
                        </View>

                        {/* Perk Subtext */}
                        <View style={s.loyaltyPerkRow}>
                            <Ionicons name="sparkles" size={11} color="#D4AF37" />
                            <Text style={s.loyaltyPerkText} numberOfLines={1}>{loyalty.perk}</Text>
                        </View>
                    </View>
                )}

                {/* ── FOLLOWED STORES LIVE STRIP (QUICK STORE CAROUSEL) ── */}
                {user && followedStores.length > 0 && (
                    <View style={s.liveStoresWrap}>
                        <View style={s.liveStoresHeader}>
                            <Text style={s.liveStoresTitle}>
                                <Text style={s.sectionHeaderSpark}>✦ </Text>STORES YOU FOLLOW
                            </Text>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setShowFollowedModal(true)}
                            >
                                <Text style={s.liveStoresViewAll}>View All ({followedStores.length}) →</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={s.liveStoresScroll}
                        >
                            {followedStores.map(store => (
                                <TouchableOpacity
                                    key={store.id}
                                    style={s.liveStoreItem}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        setShowFollowedModal(false);
                                        onNavigate && onNavigate('stores');
                                    }}
                                >
                                    <View style={s.liveStoreRing}>
                                        {store.logo ? (
                                            <Image source={{ uri: store.logo }} style={s.liveStoreAvatar} />
                                        ) : (
                                            <View style={s.liveStoreFallback}>
                                                <Ionicons name="storefront" size={16} color="#D9A73A" />
                                            </View>
                                        )}
                                        <View style={s.liveStoreDot} />
                                    </View>
                                    <Text style={s.liveStoreName} numberOfLines={1}>{store.name}</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={s.liveStoreAddBtn}
                                activeOpacity={0.8}
                                onPress={() => {
                                    onNavigate && onNavigate('stores');
                                }}
                            >
                                <View style={s.liveStoreAddIconWrap}>
                                    <Ionicons name="add" size={18} color="#D9A73A" />
                                </View>
                                <Text style={s.liveStoreName}>Discover</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                )}

                {/* ── CONTEXTUAL ROLE ACCESS BANNER (COMPACT) ── */}
                {user && (
                    isAdmin ? (
                        <TouchableOpacity
                            style={s.adminConsoleCard}
                            activeOpacity={0.88}
                            onPress={handleOpenAdminConsole}
                        >
                            <View style={s.adminConsoleGlow} />

                            <View style={s.adminConsoleLeft}>
                                <View style={s.adminShieldCircle}>
                                    <Ionicons name="shield-checkmark" size={22} color="#D4AF37" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={s.adminBadgeRow}>
                                        <View style={s.adminLiveDot} />
                                        <Text style={s.adminBadgeText}>MASTER ADMIN ACCESS</Text>
                                    </View>
                                    <Text style={s.adminConsoleTitle}>Admin Control Console</Text>
                                    <Text style={s.adminConsoleSub}>
                                        Inspect platform metrics, approve vendors, manage products & orders
                                    </Text>
                                </View>
                            </View>

                            <View style={s.adminConsoleRight}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="speedometer-outline" size={13} color="#D4AF37" />
                                    <Text style={s.adminConsoleStatusTxt}>Platform Status: <Text style={{ color: '#10B981', fontWeight: '800' }}>Active</Text></Text>
                                </View>
                                <View style={s.adminEnterBtn}>
                                    <Text style={s.adminEnterBtnTxt}>Access Console</Text>
                                    <Ionicons name="arrow-forward" size={13} color="#0A192F" />
                                </View>
                            </View>
                        </TouchableOpacity>
                    ) : isVendor ? (
                        <TouchableOpacity
                            style={[s.roleCard, s.roleCardVendor]}
                            activeOpacity={0.85}
                            onPress={onOpenVendor}
                        >
                            <View style={[s.roleIconCircle, { backgroundColor: '#D1FAE5' }]}>
                                <Ionicons name="storefront" size={17} color="#059669" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.roleCardTitle}>Vendor Management Dashboard</Text>
                                <Text style={s.roleCardSub}>Manage products, orders, followers & payouts</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={15} color="#059669" />
                        </TouchableOpacity>
                    ) : isDriver ? (
                        <TouchableOpacity
                            style={[s.roleCard, s.roleCardDriver]}
                            activeOpacity={0.85}
                            onPress={() => onNavigate && onNavigate('DriverDashboard')}
                        >
                            <View style={[s.roleIconCircle, { backgroundColor: '#EDE9FE' }]}>
                                <Ionicons name="bicycle" size={17} color="#7C3AED" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.roleCardTitle}>Driver Services Portal</Text>
                                <Text style={s.roleCardSub}>View pickups, deliveries & route tasks</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={15} color="#7C3AED" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[s.roleCard, s.roleCardBuyer]}
                            activeOpacity={0.85}
                            onPress={onOpenVendorRegister}
                        >
                            <View style={[s.roleIconCircle, { backgroundColor: '#0A192F' }]}>
                                <Ionicons name="briefcase-outline" size={16} color="#F59E0B" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.roleCardTitle}>
                                    {vendorApp?.status === 'pending'
                                        ? 'Seller Application In Review'
                                        : 'Sell on Abu Mafhal'}
                                </Text>
                                <Text style={s.roleCardSub}>
                                    {vendorApp?.status === 'pending'
                                        ? 'Your application is currently under review'
                                        : 'Open your vendor store and reach buyers nationwide'}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={15} color="#94A3B8" />
                        </TouchableOpacity>
                    )
                )}

                {/* ── GROUP 1: SHOPPING & ACTIVITY ── */}
                <Text style={s.sectionHeader}><Text style={s.sectionHeaderSpark}>✦ </Text>SHOPPING & ACTIVITY</Text>
                <View style={s.menuGroup}>
                    {shoppingItems.map((item, idx) => (
                        <View key={item.label}>
                            <TouchableOpacity
                                style={s.menuRow}
                                activeOpacity={0.65}
                                onPress={() => handleItemPress(item)}
                            >
                                <View style={[s.menuIconBox, { backgroundColor: item.iconBg }]}>
                                    <Ionicons name={item.icon} size={16} color={item.iconColor} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.menuLabel}>{item.label}</Text>
                                    {item.subtitle && (
                                        <Text style={s.menuSubLabel}>{item.subtitle}</Text>
                                    )}
                                </View>

                                {item.badge ? (
                                    <View style={[s.menuBadge, { backgroundColor: item.badgeColor }]}>
                                        <Text style={s.menuBadgeText}>{item.badge}</Text>
                                    </View>
                                ) : null}

                                <Ionicons name="chevron-forward" size={14} color="#D9A73A" />
                            </TouchableOpacity>
                            {idx < shoppingItems.length - 1 && <View style={s.menuDivider} />}
                        </View>
                    ))}
                </View>

                {/* ── GROUP 2: FINANCES & REWARDS ── */}
                <Text style={s.sectionHeader}><Text style={s.sectionHeaderSpark}>✦ </Text>FINANCE & REWARDS</Text>
                <View style={s.menuGroup}>
                    {financeItems.map((item, idx) => (
                        <View key={item.label}>
                            <TouchableOpacity
                                style={s.menuRow}
                                activeOpacity={0.65}
                                onPress={() => handleItemPress(item)}
                            >
                                <View style={[s.menuIconBox, { backgroundColor: item.iconBg }]}>
                                    <Ionicons name={item.icon} size={16} color={item.iconColor} />
                                </View>
                                <Text style={s.menuLabel}>{item.label}</Text>

                                {item.extra ? (
                                    <Text style={s.menuExtra}>{item.extra}</Text>
                                ) : item.badge ? (
                                    <View style={[s.menuBadge, { backgroundColor: item.badgeColor }]}>
                                        <Text style={s.menuBadgeText}>{item.badge}</Text>
                                    </View>
                                ) : null}

                                <Ionicons name="chevron-forward" size={14} color="#D9A73A" />
                            </TouchableOpacity>
                            {idx < financeItems.length - 1 && <View style={s.menuDivider} />}
                        </View>
                    ))}
                </View>

                {/* ── GROUP 3: PREFERENCES & SUPPORT ── */}
                <Text style={s.sectionHeader}><Text style={s.sectionHeaderSpark}>✦ </Text>PREFERENCES & SUPPORT</Text>
                <View style={s.menuGroup}>
                    {supportItems.map((item, idx) => (
                        <View key={item.label}>
                            <TouchableOpacity
                                style={s.menuRow}
                                activeOpacity={0.65}
                                onPress={() => handleItemPress(item)}
                            >
                                <View style={[s.menuIconBox, { backgroundColor: item.iconBg }]}>
                                    <Ionicons name={item.icon} size={16} color={item.iconColor} />
                                </View>
                                <Text style={s.menuLabel}>{item.label}</Text>
                                <Ionicons name="chevron-forward" size={14} color="#D9A73A" />
                            </TouchableOpacity>
                            {idx < supportItems.length - 1 && <View style={s.menuDivider} />}
                        </View>
                    ))}
                </View>

                {/* ── SECURITY TRUST CARD ── */}
                <View style={s.securityCard}>
                    <View style={s.securityIconWrap}>
                        <Ionicons name="shield-checkmark" size={15} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.securityTitle}>Account Protection: Active</Text>
                            <View style={s.securityBadge}>
                                <Text style={s.securityBadgeText}>256-BIT SSL</Text>
                            </View>
                        </View>
                        <Text style={s.securitySub}>Biometric session verified • Zero-liability purchase protection</Text>
                    </View>
                </View>

                {/* ── LOGOUT / AUTH BUTTON ── */}
                <View style={s.footerWrap}>
                    {user ? (
                        <TouchableOpacity
                            style={s.logoutBtn}
                            activeOpacity={0.8}
                            onPress={confirmLogout}
                        >
                            <Ionicons name="log-out-outline" size={15} color="#DC2626" style={{ marginRight: 6 }} />
                            <Text style={s.logoutText}>Log Out</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={s.loginBtn}
                            activeOpacity={0.85}
                            onPress={() => onNavigate && onNavigate('Auth')}
                        >
                            <Ionicons name="log-in-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={s.loginText}>Sign In / Create Account</Text>
                        </TouchableOpacity>
                    )}

                    <Text style={s.versionText}>Abu Mafhal Marketplace • v1.0.0 (Secure)</Text>
                </View>
            </ScrollView>

            {/* ── FOLLOWED STORES MODAL (COMPACT & REFINED) ── */}
            <Modal
                visible={showFollowedModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowFollowedModal(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        {/* Modal Header */}
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={s.modalHeaderIconWrap}>
                                    <Ionicons name="storefront" size={16} color="#F59E0B" />
                                </View>
                                <View>
                                    <Text style={s.modalTitle}>Followed Stores</Text>
                                    <Text style={s.modalSubtitle}>{followedStores.length} stores followed</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowFollowedModal(false)}
                                style={s.modalCloseBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={18} color="#D9A73A" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        {followedStores.length > 0 && (
                            <View style={s.storeSearchBox}>
                                <Ionicons name="search-outline" size={15} color="#D9A73A" style={{ marginRight: 6 }} />
                                <TextInput
                                    placeholder="Search stores you follow..."
                                    placeholderTextColor="#94A3B8"
                                    value={storeSearch}
                                    onChangeText={setStoreSearch}
                                    style={s.storeSearchInput}
                                />
                                {storeSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setStoreSearch('')}>
                                        <Ionicons name="close-circle" size={15} color="#D9A73A" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
                            {followedLoading ? (
                                <View style={s.modalLoaderWrap}>
                                    <ActivityIndicator size="small" color="#D9A73A" />
                                    <Text style={s.modalLoaderText}>Loading stores...</Text>
                                </View>
                            ) : filteredFollowedStores.length === 0 ? (
                                <View style={s.modalEmptyWrap}>
                                    <View style={s.modalEmptyIconCircle}>
                                        <Ionicons name="storefront-outline" size={32} color="#D9A73A" />
                                    </View>
                                    <Text style={s.modalEmptyTitle}>
                                        {storeSearch ? 'No matching stores' : 'No Followed Stores Yet'}
                                    </Text>
                                    <Text style={s.modalEmptySub}>
                                        {storeSearch
                                            ? 'No store in your followed list matches that query.'
                                            : 'Follow your favorite verified sellers to receive real-time updates on new arrivals, discounts, and order faster.'}
                                    </Text>
                                    <TouchableOpacity
                                        style={s.modalDiscoverBtn}
                                        activeOpacity={0.85}
                                        onPress={() => {
                                            setShowFollowedModal(false);
                                            onNavigate && onNavigate('stores');
                                        }}
                                    >
                                        <Ionicons name="compass-outline" size={14} color="#070F1E" style={{ marginRight: 5 }} />
                                        <Text style={s.modalDiscoverBtnText}>Explore Verified Stores</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={s.storesListWrap}>
                                    {filteredFollowedStores.map(store => (
                                        <View key={store.id} style={s.followedCard}>
                                            <View style={s.followedTopRow}>
                                                <View style={s.storeAvatarWrap}>
                                                    {store.logo ? (
                                                        <Image source={{ uri: store.logo }} style={s.storeLogo} />
                                                    ) : (
                                                        <View style={s.storeLogoFallback}>
                                                            <Ionicons name="storefront" size={20} color="#D9A73A" />
                                                        </View>
                                                    )}
                                                    {store.isVerified && (
                                                        <View style={s.storeVerifiedDot}>
                                                            <Ionicons name="checkmark" size={8} color="#070F1E" />
                                                        </View>
                                                    )}
                                                </View>

                                                <View style={s.storeMetaCol}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                        <Text style={s.storeCardName} numberOfLines={1}>{store.name}</Text>
                                                        {store.isOfficial && (
                                                            <View style={s.officialBadge}>
                                                                <Text style={s.officialBadgeText}>OFFICIAL</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text style={s.storeCategory} numberOfLines={1}>{store.category}</Text>

                                                    <View style={s.storeStatsRow}>
                                                        <View style={s.storeStatItem}>
                                                            <Ionicons name="star" size={10} color="#F59E0B" />
                                                            <Text style={s.storeStatTextBold}>{store.rating}</Text>
                                                            <Text style={s.storeStatTextDim}>({store.reviews})</Text>
                                                        </View>
                                                        <Text style={s.storeStatDot}>•</Text>
                                                        <View style={s.storeStatItem}>
                                                            <Ionicons name="cube-outline" size={10} color="#64748B" />
                                                            <Text style={s.storeStatTextDim}>{store.productsCount} Items</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Compact Action Buttons */}
                                            <View style={s.followedActionsRow}>
                                                <TouchableOpacity
                                                    style={s.actionVisitBtn}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        setShowFollowedModal(false);
                                                        onNavigate && onNavigate('stores');
                                                    }}
                                                >
                                                    <Ionicons name="storefront-outline" size={12} color="#D9A73A" />
                                                    <Text style={s.actionVisitText}>Visit Store</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={s.actionWhatsAppBtn}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        const phone = store.phone ? store.phone.replace(/[^0-9]/g, '') : '08145853539';
                                                        const text = encodeURIComponent(`Hello ${store.name}, I am contacting you directly from Abu Mafhal Marketplace.`);
                                                        Linking.openURL(`https://wa.me/${phone}?text=${text}`).catch(() => {});
                                                    }}
                                                >
                                                    <Ionicons name="logo-whatsapp" size={12} color="#059669" />
                                                    <Text style={s.actionWhatsAppText}>WhatsApp</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={s.actionUnfollowBtn}
                                                    activeOpacity={0.75}
                                                    onPress={() => handleUnfollowStore(store.id, store.name)}
                                                >
                                                    <Ionicons name="close-circle-outline" size={12} color="#EF4444" />
                                                    <Text style={s.actionUnfollowText}>Unfollow</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ── STORE FOLLOWERS MODAL (ADMIN & VENDOR ONLY) ── */}
            <Modal
                visible={showVendorFollowersModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowVendorFollowersModal(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        {/* Modal Header */}
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[s.modalHeaderIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }]}>
                                    <Ionicons name="people" size={16} color="#10B981" />
                                </View>
                                <View>
                                    <Text style={s.modalTitle}>Store Followers</Text>
                                    <Text style={s.modalSubtitle}>{vendorFollowersCount} {vendorFollowersCount === 1 ? 'customer following' : 'customers following'}</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowVendorFollowersModal(false)}
                                style={s.modalCloseBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={18} color="#D9A73A" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        {vendorFollowersList.length > 0 && (
                            <View style={s.storeSearchBox}>
                                <Ionicons name="search-outline" size={15} color="#D9A73A" style={{ marginRight: 6 }} />
                                <TextInput
                                    placeholder="Search followers..."
                                    placeholderTextColor="#94A3B8"
                                    value={followersSearch}
                                    onChangeText={setFollowersSearch}
                                    style={s.storeSearchInput}
                                />
                                {followersSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setFollowersSearch('')}>
                                        <Ionicons name="close-circle" size={15} color="#D9A73A" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
                            {followersLoading ? (
                                <View style={s.modalLoaderWrap}>
                                    <ActivityIndicator size="small" color="#10B981" />
                                    <Text style={s.modalLoaderText}>Loading followers...</Text>
                                </View>
                            ) : filteredVendorFollowers.length === 0 ? (
                                <View style={s.modalEmptyWrap}>
                                    <View style={[s.modalEmptyIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                                        <Ionicons name="people-outline" size={32} color="#10B981" />
                                    </View>
                                    <Text style={s.modalEmptyTitle}>
                                        {followersSearch ? 'No matching followers' : 'No Followers Yet'}
                                    </Text>
                                    <Text style={s.modalEmptySub}>
                                        {followersSearch
                                            ? 'No customer in your followers list matches that query.'
                                            : 'Customers who follow your store will be notified of new products, offers, and store updates.'}
                                    </Text>
                                </View>
                            ) : (
                                <View style={s.storesListWrap}>
                                    {filteredVendorFollowers.map((follower, idx) => {
                                        const customerName = follower.name || follower.full_name || follower.username || 'Valued Customer';
                                        const customerInitial = customerName.charAt(0).toUpperCase();
                                        return (
                                            <View key={follower.id || follower.user_id || idx} style={s.followerCard}>
                                                <View style={s.followerLeft}>
                                                    <View style={s.followerAvatarWrap}>
                                                        {follower.avatar_url ? (
                                                            <Image source={{ uri: follower.avatar_url }} style={s.followerAvatar} />
                                                        ) : (
                                                            <View style={s.followerAvatarFallback}>
                                                                <Text style={s.followerAvatarInitial}>{customerInitial}</Text>
                                                            </View>
                                                        )}
                                                        <View style={s.followerOnlineDot} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={s.followerName} numberOfLines={1}>{customerName}</Text>
                                                        <Text style={s.followerMeta} numberOfLines={1}>
                                                            {follower.email ? follower.email : (follower.followed_at ? `Followed ${new Date(follower.followed_at).toLocaleDateString()}` : 'Verified Customer')}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <TouchableOpacity
                                                    style={s.followerChatBtn}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        setShowVendorFollowersModal(false);
                                                        if (onNavigate) {
                                                            onNavigate('ConversationsScreen', {
                                                                recipientId: follower.user_id || follower.id,
                                                                recipientName: customerName
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <Ionicons name="chatbubble-ellipses-outline" size={13} color="#059669" style={{ marginRight: 4 }} />
                                                    <Text style={s.followerChatText}>Message</Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ── VOUCHERS & PROMOS MODAL (NEW FEATURE) ── */}
            <Modal
                visible={showVouchersModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowVouchersModal(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalCard}>
                        <View style={s.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[s.modalHeaderIconWrap, { backgroundColor: 'rgba(217, 167, 58, 0.15)', borderColor: '#D9A73A' }]}>
                                    <Ionicons name="ticket" size={16} color="#D9A73A" />
                                </View>
                                <View>
                                    <Text style={s.modalTitle}>Vouchers & Rewards</Text>
                                    <Text style={s.modalSubtitle}>{availableVouchers.length} active coupons available</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowVouchersModal(false)}
                                style={s.modalCloseBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={18} color="#D9A73A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
                            <View style={{ gap: 10, paddingBottom: 24, paddingTop: 8 }}>
                                {availableVouchers.map((v) => (
                                    <View key={v.id} style={s.voucherCard}>
                                        <View style={[s.voucherLeftAccent, { backgroundColor: v.badgeColor }]} />
                                        <View style={s.voucherContent}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                                <View style={[s.voucherBadge, { backgroundColor: v.badgeColor + '18' }]}>
                                                    <Text style={[s.voucherBadgeText, { color: v.badgeColor }]}>{v.badge}</Text>
                                                </View>
                                                <Text style={s.voucherExpiryText}>{v.expiry}</Text>
                                            </View>
                                            <Text style={s.voucherTitle}>{v.title}</Text>
                                            <Text style={s.voucherMinSpend}>{v.minSpend}</Text>

                                            <View style={s.voucherCodeRow}>
                                                <View style={s.voucherCodeBox}>
                                                    <Text style={s.voucherCodeText}>{v.code}</Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={s.voucherCopyBtn}
                                                    activeOpacity={0.8}
                                                    onPress={() => copyCodeToClipboard(v.code, 'Voucher')}
                                                >
                                                    <Ionicons
                                                        name={copiedCode === v.code ? 'checkmark-circle' : 'copy-outline'}
                                                        size={12}
                                                        color={copiedCode === v.code ? '#10B981' : '#D9A73A'}
                                                    />
                                                    <Text style={[s.voucherCopyBtnText, copiedCode === v.code && { color: '#10B981' }]}>
                                                        {copiedCode === v.code ? 'Copied' : 'Copy'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ── DIGITAL MEMBER PASSPORT & QR MODAL (NEW LUXURY FEATURE) ── */}
            <Modal
                visible={showMemberPassModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowMemberPassModal(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.memberPassCard}>
                        <View style={s.passHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="sparkles" size={13} color="#D9A73A" />
                                <Text style={s.passHeaderTitle}>ABU MAFHAL PASSPORT</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowMemberPassModal(false)}
                                style={s.passCloseBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={16} color="#D9A73A" />
                            </TouchableOpacity>
                        </View>

                        <View style={s.passInterior}>
                            <View style={s.passUserRow}>
                                <View style={s.passAvatarRing}>
                                    <UserAvatar user={user} size={46} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.passUserName} numberOfLines={1}>{displayName}</Text>
                                    <Text style={s.passMemberId}>
                                        MEMBER ID: AM-{(user?.id || '202688').slice(0, 8).toUpperCase()}
                                    </Text>
                                    <View style={s.passTierBadge}>
                                        <Ionicons name="shield-checkmark" size={10} color="#D9A73A" style={{ marginRight: 3 }} />
                                        <Text style={s.passTierBadgeText}>{loyalty.tier.toUpperCase()}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={s.qrBoxContainer}>
                                <View style={s.qrFrame}>
                                    <Ionicons name="qr-code" size={130} color="#0A192F" />
                                </View>
                                <Text style={s.qrScanPrompt}>Scan for Hub VIP Verification & Partner Discounts</Text>
                            </View>

                            <View style={s.barcodeWrap}>
                                <View style={s.barcodeLinesRow}>
                                    {[2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 2, 3, 2, 1, 3, 2, 4, 1].map((w, i) => (
                                        <View
                                            key={i}
                                            style={{
                                                width: w,
                                                height: 20,
                                                backgroundColor: '#D9A73A',
                                                marginHorizontal: 1.2
                                            }}
                                        />
                                    ))}
                                </View>
                                <Text style={s.barcodeText}>SECURE PASSPORT • 2026-AM-VERIFIED</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export const ProfilePage = (props) => {
    return <ProfilePageInner {...props} />;
};

export default ProfilePage;

const s = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    topBar: {
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0'
    },
    topBarBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    topBarTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: -0.2
    },
    topBarSubtitle: {
        fontSize: 9.5,
        color: '#D4AF37',
        fontWeight: '700',
        marginTop: 0.5
    },
    scroll: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    scrollContent: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 40
    },

    /* Hero Card (Luxury Royal Navy & Gold Centerpiece) */
    heroCard: {
        borderRadius: 20,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        marginBottom: 12,
        shadowColor: '#0A192F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 6
    },
    heroTopBarDecor: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 167, 58, 0.2)'
    },
    passportBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    passportText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#FCD34D',
        letterSpacing: 0.8
    },
    heroStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)'
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981'
    },
    heroStatusText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#10B981'
    },
    heroMainRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    avatarWrap: {
        position: 'relative',
        marginRight: 12
    },
    avatarRing: {
        padding: 2,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: '#D4AF37',
        backgroundColor: '#071932',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 3
    },
    verifiedDot: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 17,
        height: 17,
        borderRadius: 8.5,
        backgroundColor: '#0A192F',
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center'
    },
    heroInfo: {
        flex: 1,
        justifyContent: 'center'
    },
    heroNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 2
    },
    heroName: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.2
    },
    roleBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1
    },
    roleBadgeBuyer: {
        backgroundColor: 'rgba(217, 167, 58, 0.18)',
        borderColor: '#D4AF37'
    },
    roleBadgeVendor: {
        backgroundColor: 'rgba(16, 185, 129, 0.18)',
        borderColor: '#10B981'
    },
    roleBadgeAdmin: {
        backgroundColor: 'rgba(239, 68, 68, 0.18)',
        borderColor: '#EF4444'
    },
    roleBadgeDriver: {
        backgroundColor: 'rgba(124, 58, 237, 0.18)',
        borderColor: '#A78BFA'
    },
    roleBadgeText: {
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.6
    },
    roleTextBuyer: { color: '#FCD34D' },
    roleTextVendor: { color: '#34D399' },
    roleTextAdmin: { color: '#F87171' },
    roleTextDriver: { color: '#C4B5FD' },
    heroSub: {
        fontSize: 10.5,
        color: '#CBD5E1',
        marginBottom: 8
    },
    heroPillsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap'
    },
    editPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 6,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.35)'
    },
    editPillText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#D4AF37'
    },
    heroStoresPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 6,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.35)'
    },
    heroStoresPillText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FCD34D'
    },
    heroFollowersPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 6,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.35)'
    },
    heroFollowersPillText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#10B981'
    },

    /* Guest Card */
    guestCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 18,
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        marginBottom: 12,
        gap: 12,
        shadowColor: 'rgba(10, 25, 47, 0.06)',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 2
    },
    guestIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    guestTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0A192F'
    },
    guestSub: {
        fontSize: 10.5,
        color: '#64748B',
        marginTop: 1
    },
    guestSignInBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#0A192F',
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    guestSignInBtnText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#D4AF37'
    },

    /* Metrics Card (Clean White & Royal Navy Elevated Bar) */
    metricsCard: {
        flexDirection: 'row',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: 'rgba(10, 25, 47, 0.06)',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 2
    },
    metricColumn: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 2
    },
    metricLabel: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#64748B',
        letterSpacing: 0.8,
        marginBottom: 3
    },
    metricValue: {
        fontSize: 14.5,
        fontWeight: '900',
        color: '#0A192F',
        marginBottom: 3
    },
    metricActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3
    },
    metricActionText: {
        fontSize: 9.5,
        color: '#D4AF37',
        fontWeight: '800'
    },
    metricDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 2
    },
    metricDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#F1F5F9'
    },

    /* Quick Hub 4-Tile Grid (New Organized Layout) */
    quickHubWrap: {
        marginBottom: 12
    },
    quickHubGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'space-between'
    },
    quickHubTile: {
        width: '48.5%',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: 'rgba(10, 25, 47, 0.04)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 2
    },
    quickHubIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        position: 'relative'
    },
    quickHubBadge: {
        position: 'absolute',
        top: -3,
        right: -4,
        backgroundColor: '#D97706',
        borderRadius: 6,
        paddingHorizontal: 4,
        paddingVertical: 1
    },
    quickHubBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    quickHubTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0A192F',
        marginBottom: 1
    },
    quickHubSub: {
        fontSize: 9.5,
        color: '#64748B'
    },

    /* VIP Loyalty Progress Tracker (Clean White Card) */
    loyaltyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.35)',
        marginBottom: 12,
        shadowColor: 'rgba(10, 25, 47, 0.04)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 2
    },
    loyaltyTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    loyaltyTierBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    loyaltyTierName: {
        fontSize: 10,
        fontWeight: '900',
        color: '#0A192F'
    },
    loyaltyPointsText: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '600'
    },
    loyaltyPointsBold: {
        fontWeight: '900',
        color: '#0A192F'
    },
    loyaltyTrack: {
        height: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8
    },
    loyaltyBar: {
        height: '100%',
        backgroundColor: '#D4AF37',
        borderRadius: 3
    },
    loyaltyPerkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5
    },
    loyaltyPerkText: {
        fontSize: 9.5,
        color: '#475569',
        fontWeight: '600',
        flex: 1
    },

    /* Followed Stores Live Strip */
    liveStoresWrap: {
        marginBottom: 12
    },
    liveStoresHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingHorizontal: 2
    },
    liveStoresTitle: {
        fontSize: 10.5,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.8
    },
    liveStoresViewAll: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#D4AF37'
    },
    liveStoresScroll: {
        gap: 10,
        paddingVertical: 2
    },
    liveStoreItem: {
        alignItems: 'center',
        width: 56
    },
    liveStoreRing: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        padding: 1.5,
        backgroundColor: '#FFFFFF',
        position: 'relative'
    },
    liveStoreAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 22
    },
    liveStoreFallback: {
        width: '100%',
        height: '100%',
        borderRadius: 22,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    liveStoreDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#10B981',
        borderWidth: 1.5,
        borderColor: '#FFFFFF'
    },
    liveStoreName: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#0A192F',
        marginTop: 3,
        textAlign: 'center'
    },
    liveStoreAddBtn: {
        alignItems: 'center',
        width: 56
    },
    liveStoreAddIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center'
    },

    /* Executive Admin Command Console Card */
    adminConsoleCard: {
        backgroundColor: '#0A192F',
        borderRadius: 18,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        shadowColor: '#0A192F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 4,
        position: 'relative',
        overflow: 'hidden'
    },
    adminConsoleGlow: {
        position: 'absolute',
        top: -20,
        right: -20,
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: 'rgba(217, 167, 58, 0.15)'
    },
    adminConsoleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    adminShieldCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center'
    },
    adminBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 2
    },
    adminLiveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#10B981'
    },
    adminBadgeText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 0.8
    },
    adminConsoleTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.2
    },
    adminConsoleSub: {
        fontSize: 11,
        color: '#CBD5E1',
        marginTop: 2,
        lineHeight: 15
    },
    adminConsoleRight: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    adminConsoleStatusTxt: {
        fontSize: 11,
        color: '#E2E8F0',
        fontWeight: '600'
    },
    adminEnterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#D4AF37',
        paddingHorizontal: 13,
        paddingVertical: 6,
        borderRadius: 18
    },
    adminEnterBtnTxt: {
        color: '#070F1E',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.3
    },

    /* Role Card (Clean White with Colored Left Accent) */
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        marginBottom: 12,
        gap: 10,
        backgroundColor: '#FFFFFF',
        shadowColor: 'rgba(10, 25, 47, 0.04)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 2
    },
    roleCardBuyer: {
        borderColor: '#E2E8F0',
        borderLeftWidth: 3.5,
        borderLeftColor: '#D4AF37'
    },
    roleCardVendor: {
        borderColor: '#E2E8F0',
        borderLeftWidth: 3.5,
        borderLeftColor: '#10B981'
    },
    roleCardAdmin: {
        borderColor: '#E2E8F0',
        borderLeftWidth: 3.5,
        borderLeftColor: '#EF4444'
    },
    roleCardDriver: {
        borderColor: '#E2E8F0',
        borderLeftWidth: 3.5,
        borderLeftColor: '#A78BFA'
    },
    roleIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    roleCardTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0A192F'
    },
    roleCardSub: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 1
    },

    /* Menu Groups (Clean White Cards with Soft Shadow) */
    sectionHeader: {
        fontSize: 10.5,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.8,
        marginTop: 12,
        marginBottom: 6,
        marginLeft: 2
    },
    sectionHeaderSpark: {
        color: '#D4AF37',
        fontSize: 10
    },
    menuGroup: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 12,
        overflow: 'hidden',
        shadowColor: 'rgba(10, 25, 47, 0.04)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 2
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 12
    },
    menuIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.2)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    menuLabel: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#0A192F'
    },
    menuSubLabel: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 1
    },
    menuBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
        marginRight: 4
    },
    menuBadgeText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    menuExtra: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0A192F',
        marginRight: 4
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 56
    },

    /* Security Trust Card */
    securityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
        gap: 10,
        shadowColor: 'rgba(10, 25, 47, 0.03)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 4,
        elevation: 1
    },
    securityIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.25)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    securityTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#0A192F'
    },
    securityBadge: {
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    securityBadgeText: {
        fontSize: 7.5,
        fontWeight: '900',
        color: '#92400E',
        letterSpacing: 0.4
    },
    securitySub: {
        fontSize: 9.5,
        color: '#64748B',
        marginTop: 2
    },

    /* Footer */
    footerWrap: {
        marginTop: 4,
        marginBottom: 16,
        alignItems: 'center',
        gap: 10
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 12,
        paddingVertical: 11,
        width: '100%'
    },
    logoutText: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#DC2626'
    },
    loginBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A192F',
        borderWidth: 1,
        borderColor: '#D4AF37',
        borderRadius: 12,
        paddingVertical: 11,
        width: '100%'
    },
    loginText: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#D4AF37'
    },
    versionText: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '600'
    },

    /* Followed Stores Modal (Crisp White with Royal Navy Header) */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10, 25, 47, 0.65)',
        justifyContent: 'flex-end'
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTopWidth: 2,
        borderTopColor: '#D4AF37',
        maxHeight: '85%',
        paddingBottom: 20
    },
    modalHeader: {
        backgroundColor: '#0A192F',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    modalHeaderIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        borderWidth: 1,
        borderColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalTitle: {
        fontSize: 14.5,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.2
    },
    modalSubtitle: {
        fontSize: 10,
        color: '#D4AF37',
        fontWeight: '700',
        marginTop: 0.5
    },
    modalCloseBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    storeSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        marginHorizontal: 14,
        marginTop: 10,
        marginBottom: 6,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    storeSearchInput: {
        flex: 1,
        fontSize: 11.5,
        color: '#0A192F',
        padding: 0
    },
    modalScroll: {
        paddingHorizontal: 14,
        paddingTop: 6
    },
    modalLoaderWrap: {
        paddingVertical: 30,
        alignItems: 'center',
        gap: 6
    },
    modalLoaderText: {
        fontSize: 11,
        color: '#64748B'
    },
    modalEmptyWrap: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        marginTop: 10,
        gap: 6
    },
    modalEmptyIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalEmptyTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0A192F',
        marginTop: 2
    },
    modalEmptySub: {
        fontSize: 10.5,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 15
    },
    modalDiscoverBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0A192F',
        borderWidth: 1,
        borderColor: '#D4AF37',
        paddingHorizontal: 14,
        paddingVertical: 7.5,
        borderRadius: 8,
        marginTop: 6
    },
    modalDiscoverBtnText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#D4AF37'
    },
    storesListWrap: {
        gap: 8,
        paddingBottom: 16
    },
    followedCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 11,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: 'rgba(10, 25, 47, 0.04)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 3,
        elevation: 1
    },
    followedTopRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 8
    },
    storeAvatarWrap: {
        position: 'relative'
    },
    storeLogo: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    storeLogoFallback: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    storeVerifiedDot: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#0A192F',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF'
    },
    storeMetaCol: {
        flex: 1,
        justifyContent: 'center'
    },
    storeCardName: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0A192F'
    },
    officialBadge: {
        backgroundColor: '#D4AF37',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3
    },
    officialBadgeText: {
        fontSize: 7.5,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.4
    },
    storeCategory: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 1,
        marginBottom: 2
    },
    storeStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    storeStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2
    },
    storeStatTextBold: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0A192F'
    },
    storeStatTextDim: {
        fontSize: 9.5,
        color: '#64748B'
    },
    storeStatDot: {
        fontSize: 9,
        color: '#CBD5E1'
    },
    followedActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    actionVisitBtn: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        paddingVertical: 6,
        borderRadius: 7,
        gap: 3
    },
    actionVisitText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0A192F'
    },
    actionWhatsAppBtn: {
        flex: 1.1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        paddingVertical: 6,
        borderRadius: 7,
        gap: 3
    },
    actionWhatsAppText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#059669'
    },
    actionUnfollowBtn: {
        flex: 0.9,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        paddingVertical: 6,
        borderRadius: 7,
        gap: 3
    },
    actionUnfollowText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#DC2626'
    },

    /* Follower Card (Vendor/Admin Followers Modal) */
    followerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 11,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 8
    },
    followerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10
    },
    followerAvatarWrap: {
        position: 'relative',
        marginRight: 10
    },
    followerAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F8FAFC'
    },
    followerAvatarFallback: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center'
    },
    followerAvatarInitial: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0A192F'
    },
    followerOnlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#10B981',
        borderWidth: 2,
        borderColor: '#FFFFFF'
    },
    followerName: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0A192F'
    },
    followerMeta: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 1
    },
    followerChatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 7,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0'
    },
    followerChatText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#059669'
    },

    /* Voucher Card & Modal Styles */
    voucherCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
        shadowColor: 'rgba(10, 25, 47, 0.04)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 3,
        elevation: 1
    },
    voucherLeftAccent: {
        width: 4
    },
    voucherContent: {
        flex: 1,
        padding: 10
    },
    voucherBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4
    },
    voucherBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.4
    },
    voucherExpiryText: {
        fontSize: 9.5,
        color: '#64748B'
    },
    voucherTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0A192F',
        marginTop: 2
    },
    voucherMinSpend: {
        fontSize: 10,
        color: '#64748B',
        marginBottom: 8
    },
    voucherCodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderRadius: 7,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.35)',
        borderStyle: 'dashed'
    },
    voucherCodeBox: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    voucherCodeText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.8
    },
    voucherCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    voucherCopyBtnText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#92400E'
    },

    /* Digital Member Pass Modal Styles */
    memberPassCard: {
        backgroundColor: '#0A192F',
        width: '90%',
        maxWidth: 360,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        overflow: 'hidden',
        shadowColor: '#0A192F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10
    },
    passHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(217, 167, 58, 0.25)',
        backgroundColor: '#0D213E'
    },
    passHeaderTitle: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 0.8
    },
    passCloseBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    passInterior: {
        backgroundColor: '#FFFFFF',
        margin: 10,
        borderRadius: 14,
        padding: 14,
        alignItems: 'center'
    },
    passUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    passAvatarRing: {
        padding: 1.5,
        borderRadius: 25,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        backgroundColor: '#F8FAFC'
    },
    passUserName: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0A192F'
    },
    passMemberId: {
        fontSize: 9,
        fontWeight: '700',
        color: '#64748B',
        letterSpacing: 0.5,
        marginTop: 1
    },
    passTierBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        marginTop: 3,
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    passTierBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#92400E',
        letterSpacing: 0.5
    },
    qrBoxContainer: {
        alignItems: 'center',
        paddingVertical: 10
    },
    qrFrame: {
        padding: 10,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    qrScanPrompt: {
        fontSize: 9.5,
        color: '#64748B',
        marginTop: 6,
        textAlign: 'center',
        fontWeight: '600'
    },
    barcodeWrap: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    barcodeLinesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    barcodeText: {
        fontSize: 7.5,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 1,
        marginTop: 3
    }
});
