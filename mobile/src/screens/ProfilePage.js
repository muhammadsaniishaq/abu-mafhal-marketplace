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
import { supabase } from '../lib/supabase';
import { UserAvatar } from '../components/UserAvatar';
import { useAppSettings } from '../context/AppSettingsContext';
import {
    getFollowedStoresList,
    toggleFollowStore,
    subscribeToFollowChanges
} from '../services/vendorFollowerService';

// Clean currency formatter
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

// Loyalty tier resolver
const getLoyaltyTier = (pts = 0) => {
    const points = pts || 0;
    if (points >= 5000) return { tier: 'VIP Gold', color: '#D97706', icon: 'shield-checkmark' };
    if (points >= 1500) return { tier: 'Platinum', color: '#F59E0B', icon: 'trophy' };
    if (points >= 500) return { tier: 'Silver', color: '#3B82F6', icon: 'ribbon' };
    return { tier: 'Bronze Member', color: '#64748B', icon: 'medal' };
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
    const [loading, setLoading] = useState(true);
    const [vendorApp, setVendorApp] = useState(null);
    const { settings } = useAppSettings();

    // Followed Stores State
    const [followedStores, setFollowedStores] = useState([]);
    const [showFollowedModal, setShowFollowedModal] = useState(false);
    const [followedLoading, setFollowedLoading] = useState(false);
    const [storeSearch, setStoreSearch] = useState('');

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
        const unsub = subscribeToFollowChanges(() => {
            loadFollowedStores();
        });
        return () => {
            if (typeof unsub === 'function') unsub();
        };
    }, [user?.id]);

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

    const handleUnfollowStore = async (storeId, storeName) => {
        try {
            await toggleFollowStore(storeId, storeName, user?.id);
            setFollowedStores(prev => prev.filter(s => s.id !== storeId));
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

        } catch (e) {
            console.log('Error loading profile data:', e);
        } finally {
            setLoading(false);
        }
    };

    const loyalty = getLoyaltyTier(wallet.points);

    // Dynamic role details
    const role = (user?.role || 'buyer').toLowerCase();
    const isAdmin = role === 'admin';
    const isVendor = role === 'vendor';
    const isDriver = role === 'driver';

    const displayName = user?.fullName || user?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Member';
    const displaySubtitle = user?.email || user?.phone || user?.phone_number || '';

    // Menu Group 1: Shopping & Activity
    const shoppingItems = [
        {
            icon: 'bag-handle-outline',
            label: 'My Orders',
            badge: pendingOrders > 0 ? `${pendingOrders} active` : ordersCount > 0 ? `${ordersCount}` : null,
            badgeColor: pendingOrders > 0 ? '#F59E0B' : '#64748B',
            screen: 'orders'
        },
        {
            icon: 'storefront-outline',
            label: 'Followed Stores',
            subtitle: 'Shagunan da nake bi',
            badge: followedStores.length > 0 ? `${followedStores.length} stores` : null,
            badgeColor: '#0284C7',
            action: () => setShowFollowedModal(true)
        },
        {
            icon: 'heart-outline',
            label: 'Wishlist & Favorites',
            screen: 'wishlist'
        },
        {
            icon: 'navigate-outline',
            label: 'Track Active Delivery',
            screen: 'TrackOrder'
        },
        {
            icon: 'chatbubbles-outline',
            label: 'Messages & Chats',
            screen: 'ConversationsScreen'
        }
    ];

    // Menu Group 2: Finances & Rewards
    const financeItems = [
        {
            icon: 'wallet-outline',
            label: 'Mafhal Pay & Wallet',
            extra: formatCurrency(wallet.balance),
            screen: 'wallet'
        },
        {
            icon: 'gift-outline',
            label: 'Refer & Earn (₦1,000 Bonus)',
            badge: 'Earn ₦1k',
            badgeColor: '#10B981',
            screen: 'referral'
        },
        {
            icon: 'location-outline',
            label: 'Delivery Addresses',
            screen: 'address'
        }
    ];

    // Menu Group 3: Account & Support
    const supportItems = [
        {
            icon: 'settings-outline',
            label: 'Account Settings',
            screen: 'settings'
        },
        {
            icon: 'headset-outline',
            label: 'Customer Support & WhatsApp',
            screen: 'support'
        },
        {
            icon: 'information-circle-outline',
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
        return st.name.toLowerCase().includes(q) || (st.category && st.category.toLowerCase().includes(q));
    });

    return (
        <SafeAreaView style={s.safeArea}>
            {/* ── TOP NAV BAR ── */}
            <View style={s.topBar}>
                <TouchableOpacity
                    onPress={onBack}
                    style={s.topBarBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-back" size={22} color="#0F172A" />
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                    <Text style={s.topBarTitle}>My Profile</Text>
                    <Text style={s.topBarSubtitle}>Account & Preferences</Text>
                </View>

                {user ? (
                    <TouchableOpacity
                        onPress={() => onNavigate && onNavigate('editProfile')}
                        style={s.topBarBtn}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="create-outline" size={20} color="#0F172A" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 38 }} />
                )}
            </View>

            <ScrollView
                style={s.scroll}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── USER HERO CARD ── */}
                {user ? (
                    <View style={s.heroCard}>
                        <View style={s.avatarWrap}>
                            <UserAvatar user={user} size={64} />
                            <View style={s.verifiedDot}>
                                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
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
                                        {isAdmin ? 'ADMIN' : isVendor ? 'VENDOR' : isDriver ? 'DRIVER' : 'MEMBER'}
                                    </Text>
                                </View>
                            </View>

                            {displaySubtitle ? (
                                <Text style={s.heroSub} numberOfLines={1}>{displaySubtitle}</Text>
                            ) : null}

                            {/* Action Pills Row */}
                            <View style={s.heroPillsRow}>
                                <TouchableOpacity
                                    style={s.editPillBtn}
                                    activeOpacity={0.75}
                                    onPress={() => onNavigate && onNavigate('editProfile')}
                                >
                                    <Ionicons name="pencil-sharp" size={12} color="#475569" style={{ marginRight: 4 }} />
                                    <Text style={s.editPillText}>Edit Profile</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={s.heroStoresPill}
                                    activeOpacity={0.75}
                                    onPress={() => setShowFollowedModal(true)}
                                >
                                    <Ionicons name="storefront" size={12} color="#0284C7" style={{ marginRight: 4 }} />
                                    <Text style={s.heroStoresPillText}>
                                        {followedStores.length} {followedStores.length === 1 ? 'Store' : 'Stores'} Followed
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ) : (
                    /* GUEST CARD */
                    <View style={s.guestCard}>
                        <View style={s.guestIconWrap}>
                            <Ionicons name="person-circle-outline" size={44} color="#0A192F" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.guestTitle}>Welcome to Abu Mafhal</Text>
                            <Text style={s.guestSub}>Sign in to access orders, wallet, rewards & more</Text>
                        </View>
                        <TouchableOpacity
                            style={s.guestSignInBtn}
                            activeOpacity={0.85}
                            onPress={() => onNavigate && onNavigate('Auth')}
                        >
                            <Text style={s.guestSignInBtnText}>Sign In</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── UNIFIED 3-IN-1 QUICK METRICS CARD (ZERO CLUTTER) ── */}
                {user && (
                    <View style={s.metricsCard}>
                        <TouchableOpacity
                            style={s.metricColumn}
                            activeOpacity={0.7}
                            onPress={() => onNavigate && onNavigate('wallet')}
                        >
                            <Text style={s.metricLabel}>WALLET</Text>
                            <Text style={s.metricValue} numberOfLines={1}>
                                {loading ? '...' : formatCurrency(wallet.balance)}
                            </Text>
                            <Text style={s.metricSub}>View Balance →</Text>
                        </TouchableOpacity>

                        <View style={s.metricDivider} />

                        <TouchableOpacity
                            style={s.metricColumn}
                            activeOpacity={0.7}
                            onPress={() => onNavigate && onNavigate('orders')}
                        >
                            <Text style={s.metricLabel}>ORDERS</Text>
                            <Text style={s.metricValue} numberOfLines={1}>
                                {loading ? '...' : `${ordersCount}`}
                            </Text>
                            <Text style={[s.metricSub, pendingOrders > 0 && { color: '#D97706', fontWeight: '700' }]}>
                                {pendingOrders > 0 ? `${pendingOrders} Pending` : 'All Completed'}
                            </Text>
                        </TouchableOpacity>

                        <View style={s.metricDivider} />

                        <TouchableOpacity
                            style={s.metricColumn}
                            activeOpacity={0.7}
                            onPress={() => onNavigate && onNavigate('referral')}
                        >
                            <Text style={s.metricLabel}>POINTS</Text>
                            <Text style={s.metricValue} numberOfLines={1}>
                                {loading ? '...' : `${wallet.points}`}
                            </Text>
                            <Text style={[s.metricSub, { color: loyalty.color, fontWeight: '700' }]}>
                                {loyalty.tier}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── CONTEXTUAL ROLE ACCESS BANNER (1 SINGLE CLEAN CARD) ── */}
                {user && (
                    isAdmin ? (
                        <TouchableOpacity
                            style={[s.roleCard, s.roleCardAdmin]}
                            activeOpacity={0.85}
                            onPress={onOpenAdmin}
                        >
                            <View style={[s.roleIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                                <Ionicons name="shield-checkmark" size={20} color="#DC2626" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.roleCardTitle}>Admin Control Console</Text>
                                <Text style={s.roleCardSub}>Inspect platform metrics, vendors & approvals</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={18} color="#DC2626" />
                        </TouchableOpacity>
                    ) : isVendor ? (
                        <TouchableOpacity
                            style={[s.roleCard, s.roleCardVendor]}
                            activeOpacity={0.85}
                            onPress={onOpenVendor}
                        >
                            <View style={[s.roleIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                <Ionicons name="storefront" size={20} color="#059669" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.roleCardTitle}>Vendor Management Dashboard</Text>
                                <Text style={s.roleCardSub}>Manage products, orders, followers & store earnings</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={18} color="#059669" />
                        </TouchableOpacity>
                    ) : isDriver ? (
                        <TouchableOpacity
                            style={[s.roleCard, s.roleCardDriver]}
                            activeOpacity={0.85}
                            onPress={() => onNavigate && onNavigate('DriverDashboard')}
                        >
                            <View style={[s.roleIconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                                <Ionicons name="bicycle" size={20} color="#7C3AED" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.roleCardTitle}>Driver Services Portal</Text>
                                <Text style={s.roleCardSub}>View pickups, deliveries & route tasks</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={18} color="#7C3AED" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[s.roleCard, s.roleCardBuyer]}
                            activeOpacity={0.85}
                            onPress={onOpenVendorRegister}
                        >
                            <View style={[s.roleIconCircle, { backgroundColor: '#FEF3C7' }]}>
                                <Ionicons name="briefcase-outline" size={20} color="#D97706" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.roleCardTitle}>
                                    {vendorApp?.status === 'pending'
                                        ? 'Seller Verification In Progress'
                                        : 'Sell on Abu Mafhal'}
                                </Text>
                                <Text style={s.roleCardSub}>
                                    {vendorApp?.status === 'pending'
                                        ? 'Your vendor application is currently under review'
                                        : 'Open your vendor store and sell across Nigeria'}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )
                )}

                {/* ── GROUP 1: SHOPPING & ORDERS ── */}
                <Text style={s.sectionHeader}>SHOPPING & ACTIVITY</Text>
                <View style={s.menuGroup}>
                    {shoppingItems.map((item, idx) => (
                        <View key={item.label}>
                            <TouchableOpacity
                                style={s.menuRow}
                                activeOpacity={0.65}
                                onPress={() => handleItemPress(item)}
                            >
                                <View style={s.menuIconBox}>
                                    <Ionicons name={item.icon} size={20} color="#1E293B" />
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

                                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                            </TouchableOpacity>
                            {idx < shoppingItems.length - 1 && <View style={s.menuDivider} />}
                        </View>
                    ))}
                </View>

                {/* ── GROUP 2: FINANCES & REWARDS ── */}
                <Text style={s.sectionHeader}>FINANCE & REWARDS</Text>
                <View style={s.menuGroup}>
                    {financeItems.map((item, idx) => (
                        <View key={item.label}>
                            <TouchableOpacity
                                style={s.menuRow}
                                activeOpacity={0.65}
                                onPress={() => handleItemPress(item)}
                            >
                                <View style={s.menuIconBox}>
                                    <Ionicons name={item.icon} size={20} color="#1E293B" />
                                </View>
                                <Text style={s.menuLabel}>{item.label}</Text>

                                {item.extra ? (
                                    <Text style={s.menuExtra}>{item.extra}</Text>
                                ) : item.badge ? (
                                    <View style={[s.menuBadge, { backgroundColor: item.badgeColor }]}>
                                        <Text style={s.menuBadgeText}>{item.badge}</Text>
                                    </View>
                                ) : null}

                                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                            </TouchableOpacity>
                            {idx < financeItems.length - 1 && <View style={s.menuDivider} />}
                        </View>
                    ))}
                </View>

                {/* ── GROUP 3: PREFERENCES & SUPPORT ── */}
                <Text style={s.sectionHeader}>SUPPORT & PREFERENCES</Text>
                <View style={s.menuGroup}>
                    {supportItems.map((item, idx) => (
                        <View key={item.label}>
                            <TouchableOpacity
                                style={s.menuRow}
                                activeOpacity={0.65}
                                onPress={() => handleItemPress(item)}
                            >
                                <View style={s.menuIconBox}>
                                    <Ionicons name={item.icon} size={20} color="#1E293B" />
                                </View>
                                <Text style={s.menuLabel}>{item.label}</Text>
                                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                            </TouchableOpacity>
                            {idx < supportItems.length - 1 && <View style={s.menuDivider} />}
                        </View>
                    ))}
                </View>

                {/* ── LOGOUT / AUTH BUTTON ── */}
                <View style={s.footerWrap}>
                    {user ? (
                        <TouchableOpacity
                            style={s.logoutBtn}
                            activeOpacity={0.8}
                            onPress={confirmLogout}
                        >
                            <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                            <Text style={s.logoutText}>Log Out Account</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={s.loginBtn}
                            activeOpacity={0.85}
                            onPress={() => onNavigate && onNavigate('Auth')}
                        >
                            <Ionicons name="log-in-outline" size={18} color="#0A192F" style={{ marginRight: 8 }} />
                            <Text style={s.loginText}>Sign In / Create Account</Text>
                        </TouchableOpacity>
                    )}

                    <Text style={s.versionText}>Abu Mafhal Marketplace • v1.0.0 (Encrypted)</Text>
                </View>
            </ScrollView>

            {/* ── FOLLOWED STORES MODAL ── */}
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={s.modalHeaderIconWrap}>
                                    <Ionicons name="storefront" size={18} color="#0284C7" />
                                </View>
                                <View>
                                    <Text style={s.modalTitle}>Shagunan Da Kake Bi</Text>
                                    <Text style={s.modalSubtitle}>Followed Stores ({followedStores.length})</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowFollowedModal(false)}
                                style={s.modalCloseBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        {followedStores.length > 0 && (
                            <View style={s.storeSearchBox}>
                                <Ionicons name="search-outline" size={16} color="#64748B" style={{ marginRight: 8 }} />
                                <TextInput
                                    placeholder="Nemi a cikin shagunan da kake bi..."
                                    placeholderTextColor="#94A3B8"
                                    value={storeSearch}
                                    onChangeText={setStoreSearch}
                                    style={s.storeSearchInput}
                                />
                                {storeSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setStoreSearch('')}>
                                        <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
                            {followedLoading ? (
                                <View style={s.modalLoaderWrap}>
                                    <ActivityIndicator size="small" color="#0284C7" />
                                    <Text style={s.modalLoaderText}>Ana ɗauko shagunan da kake bi...</Text>
                                </View>
                            ) : filteredFollowedStores.length === 0 ? (
                                <View style={s.modalEmptyWrap}>
                                    <View style={s.modalEmptyIconCircle}>
                                        <Ionicons name="storefront-outline" size={38} color="#94A3B8" />
                                    </View>
                                    <Text style={s.modalEmptyTitle}>
                                        {storeSearch ? 'Babu shagon da ya dace' : 'Ba ka bi kowane shago ba tukuna'}
                                    </Text>
                                    <Text style={s.modalEmptySub}>
                                        {storeSearch
                                            ? 'Babu shago a cikin jerin da kake bi mai wannan sunan.'
                                            : 'Yi follow na shagunan da kake so domin samun sanarwar sabbin kayayyaki, rangwame, da bayarwa kai tsaye.'}
                                    </Text>
                                    <TouchableOpacity
                                        style={s.modalDiscoverBtn}
                                        activeOpacity={0.85}
                                        onPress={() => {
                                            setShowFollowedModal(false);
                                            onNavigate && onNavigate('stores');
                                        }}
                                    >
                                        <Ionicons name="compass-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                        <Text style={s.modalDiscoverBtnText}>Gano Shagunan Kasuwa (Explore Stores)</Text>
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
                                                            <Ionicons name="storefront" size={24} color="#0284C7" />
                                                        </View>
                                                    )}
                                                    {store.isVerified && (
                                                        <View style={s.storeVerifiedDot}>
                                                            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                                                        </View>
                                                    )}
                                                </View>

                                                <View style={s.storeMetaCol}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                                                            <Ionicons name="star" size={12} color="#F59E0B" />
                                                            <Text style={s.storeStatTextBold}>{store.rating}</Text>
                                                            <Text style={s.storeStatTextDim}>({store.reviews})</Text>
                                                        </View>
                                                        <Text style={s.storeStatDot}>•</Text>
                                                        <View style={s.storeStatItem}>
                                                            <Ionicons name="cube-outline" size={12} color="#64748B" />
                                                            <Text style={s.storeStatTextDim}>{store.productsCount} Items</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Action Buttons */}
                                            <View style={s.followedActionsRow}>
                                                <TouchableOpacity
                                                    style={s.actionVisitBtn}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        setShowFollowedModal(false);
                                                        onNavigate && onNavigate('stores');
                                                    }}
                                                >
                                                    <Ionicons name="storefront-outline" size={13} color="#0284C7" />
                                                    <Text style={s.actionVisitText}>Duba Shago</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={s.actionWhatsAppBtn}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        const phone = store.phone ? store.phone.replace(/[^0-9]/g, '') : '2349021486162';
                                                        const text = encodeURIComponent(`Barka ${store.name}, ina tuntubar ku ne daga Abu Mafhal Marketplace.`);
                                                        Linking.openURL(`https://wa.me/${phone}?text=${text}`).catch(() => {});
                                                    }}
                                                >
                                                    <Ionicons name="logo-whatsapp" size={13} color="#059669" />
                                                    <Text style={s.actionWhatsAppText}>WhatsApp</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={s.actionUnfollowBtn}
                                                    activeOpacity={0.75}
                                                    onPress={() => handleUnfollowStore(store.id, store.name)}
                                                >
                                                    <Ionicons name="close-circle-outline" size={13} color="#EF4444" />
                                                    <Text style={s.actionUnfollowText}>Cire</Text>
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
        </SafeAreaView>
    );
};

export const ProfilePage = (props) => {
    return <ProfilePageInner {...props} />;
};

const s = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    topBar: {
        height: 54,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    topBarBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    topBarTitle: {
        fontSize: 15.5,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.2
    },
    topBarSubtitle: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 1
    },
    scroll: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 40
    },

    /* Hero Card */
    heroCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 12,
        boxShadow: '0px 2px 8px rgba(15, 23, 42, 0.04)',
        elevation: 1
    },
    avatarWrap: {
        position: 'relative',
        marginRight: 14
    },
    verifiedDot: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#10B981',
        borderWidth: 2,
        borderColor: '#FFFFFF',
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
        marginBottom: 3
    },
    heroName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.2
    },
    roleBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 1
    },
    roleBadgeBuyer: {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE'
    },
    roleBadgeVendor: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0'
    },
    roleBadgeAdmin: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA'
    },
    roleBadgeDriver: {
        backgroundColor: '#F5F3FF',
        borderColor: '#DDD6FE'
    },
    roleBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    roleTextBuyer: { color: '#2563EB' },
    roleTextVendor: { color: '#059669' },
    roleTextAdmin: { color: '#DC2626' },
    roleTextDriver: { color: '#7C3AED' },
    heroSub: {
        fontSize: 11.5,
        color: '#64748B',
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
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    editPillText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#475569'
    },
    heroStoresPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#BAE6FD'
    },
    heroStoresPillText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#0284C7'
    },

    /* Guest Card */
    guestCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
        gap: 12
    },
    guestIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    guestTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A'
    },
    guestSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    guestSignInBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7.5,
        borderRadius: 8,
        backgroundColor: '#F59E0B'
    },
    guestSignInBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0A192F'
    },

    /* Metrics Card */
    metricsCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    metricColumn: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 4
    },
    metricLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.8,
        marginBottom: 3
    },
    metricValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 2
    },
    metricSub: {
        fontSize: 10.5,
        color: '#0284C7',
        fontWeight: '600'
    },
    metricDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#F1F5F9'
    },

    /* Role Card */
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        marginBottom: 16,
        gap: 12
    },
    roleCardBuyer: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A'
    },
    roleCardVendor: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0'
    },
    roleCardAdmin: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA'
    },
    roleCardDriver: {
        backgroundColor: '#F5F3FF',
        borderColor: '#DDD6FE'
    },
    roleIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center'
    },
    roleCardTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A'
    },
    roleCardSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1
    },

    /* Menu Groups */
    sectionHeader: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.8,
        marginBottom: 6,
        marginLeft: 4
    },
    menuGroup: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
        overflow: 'hidden'
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 12
    },
    menuIconBox: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center'
    },
    menuLabel: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#0F172A'
    },
    menuSubLabel: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 1
    },
    menuBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        marginRight: 6
    },
    menuBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    menuExtra: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0F172A',
        marginRight: 6
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#F8FAFC',
        marginLeft: 56
    },

    /* Footer */
    footerWrap: {
        marginTop: 4,
        marginBottom: 20,
        alignItems: 'center',
        gap: 14
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 12,
        paddingVertical: 12,
        width: '100%'
    },
    logoutText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#DC2626'
    },
    loginBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A192F',
        borderRadius: 12,
        paddingVertical: 12,
        width: '100%'
    },
    loginText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    versionText: {
        fontSize: 10.5,
        color: '#94A3B8',
        fontWeight: '600'
    },

    /* Followed Stores Modal */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end'
    },
    modalCard: {
        backgroundColor: '#F8FAFC',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        paddingBottom: 24
    },
    modalHeader: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    modalHeaderIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A'
    },
    modalSubtitle: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    storeSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 6,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    storeSearchInput: {
        flex: 1,
        fontSize: 12.5,
        color: '#0F172A',
        padding: 0
    },
    modalScroll: {
        paddingHorizontal: 16,
        paddingTop: 8
    },
    modalLoaderWrap: {
        paddingVertical: 40,
        alignItems: 'center',
        gap: 8
    },
    modalLoaderText: {
        fontSize: 12,
        color: '#64748B'
    },
    modalEmptyWrap: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        marginTop: 12,
        gap: 8
    },
    modalEmptyIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalEmptyTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 4
    },
    modalEmptySub: {
        fontSize: 11.5,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 16
    },
    modalDiscoverBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0284C7',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 10,
        marginTop: 8
    },
    modalDiscoverBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    storesListWrap: {
        gap: 10,
        paddingBottom: 20
    },
    followedCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    followedTopRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 10
    },
    storeAvatarWrap: {
        position: 'relative'
    },
    storeLogo: {
        width: 46,
        height: 46,
        borderRadius: 12,
        backgroundColor: '#F1F5F9'
    },
    storeLogoFallback: {
        width: 46,
        height: 46,
        borderRadius: 12,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center'
    },
    storeVerifiedDot: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 15,
        height: 15,
        borderRadius: 7.5,
        backgroundColor: '#0284C7',
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
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    officialBadge: {
        backgroundColor: '#F59E0B',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4
    },
    officialBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5
    },
    storeCategory: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
        marginBottom: 3
    },
    storeStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5
    },
    storeStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3
    },
    storeStatTextBold: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0F172A'
    },
    storeStatTextDim: {
        fontSize: 10.5,
        color: '#64748B'
    },
    storeStatDot: {
        fontSize: 10,
        color: '#CBD5E1'
    },
    followedActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC'
    },
    actionVisitBtn: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E0F2FE',
        paddingVertical: 7,
        borderRadius: 8,
        gap: 4
    },
    actionVisitText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0284C7'
    },
    actionWhatsAppBtn: {
        flex: 1.1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        paddingVertical: 7,
        borderRadius: 8,
        gap: 4
    },
    actionWhatsAppText: {
        fontSize: 11,
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
        paddingVertical: 7,
        borderRadius: 8,
        gap: 4
    },
    actionUnfollowText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#DC2626'
    }
});
