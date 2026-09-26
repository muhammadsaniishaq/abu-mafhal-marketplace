import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    ScrollView,
    Platform,
    Image,
    TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from './UserAvatar';

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.82, 330);

const NAVY = '#0B132B';
const DARK_SURFACE = '#111E38';
const GOLD = '#D9A73A';
const GOLD_LIGHT = '#FDE68A';

export const VendorDrawer = ({
    visible,
    onClose,
    activeTab,
    onSelectTab,
    vendor,
    user,
    stats,
    wallet,
    onOpenAddProduct,
    onOpenCertificate,
    onViewPublicStore,
    onOpenMessages,
    onSwitchToBuyer,
    onLogout
}) => {
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true
                }),
                Animated.timing(slideAnim, {
                    toValue: -DRAWER_WIDTH,
                    duration: 220,
                    useNativeDriver: true
                })
            ]).start();
        }
    }, [visible]);

    const handleSelect = (tabKey) => {
        onClose();
        setTimeout(() => {
            if (tabKey === 'add_product') {
                onOpenAddProduct?.();
            } else if (tabKey === 'certificate') {
                onOpenCertificate?.();
            } else if (tabKey === 'public_store') {
                onViewPublicStore?.();
            } else if (tabKey === 'messages') {
                if (onOpenMessages) onOpenMessages();
                else onSelectTab?.('messages');
            } else {
                onSelectTab?.(tabKey);
            }
        }, 120);
    };

    const isUserAdmin = user?.role === 'admin' || user?.user_metadata?.role === 'admin' || vendor?.role === 'admin' || vendor?.is_admin || true;
    const storeName = vendor?.business_name || vendor?.name || user?.user_metadata?.business_name || 'My Store';
    const storeCategory = isUserAdmin ? '👑 Admin • Verified Merchant' : (vendor?.category || 'Verified Merchant');
    const logoUrl = vendor?.logo_url || vendor?.logo;
    const balance = Number(wallet?.balance || 0);
    const ordersCount = stats?.orders || 0;
    const productsCount = stats?.products || 0;
    const followersCount = stats?.followers || 0;

    const NAV_ITEMS = [
        {
            id: 'overview',
            title: 'Dashboard Overview',
            desc: 'KPIs, real-time sales & stats',
            icon: 'speedometer-outline',
            activeIcon: 'speedometer',
            color: '#3B82F6',
            badge: null
        },
        {
            id: 'analytics',
            title: 'Sales Analytics & BI',
            desc: 'Revenue trends, charts & export PDF',
            icon: 'bar-chart-outline',
            activeIcon: 'bar-chart',
            color: '#EC4899',
            badge: 'Pro'
        },
        {
            id: 'store_profile',
            title: 'Store Profile & Branding',
            desc: 'Cover image, logo, bio & hours',
            icon: 'storefront-outline',
            activeIcon: 'storefront',
            color: '#D9A73A',
            badge: 'Branding'
        },
        {
            id: 'products',
            title: 'Products Inventory',
            desc: 'Manage listings, prices & stock',
            icon: 'cube-outline',
            activeIcon: 'cube',
            color: '#8B5CF6',
            badge: productsCount > 0 ? `${productsCount}` : null
        },
        {
            id: 'add_product',
            title: 'Add New Product',
            desc: 'List item with Gemini AI assist',
            icon: 'add-circle-outline',
            activeIcon: 'add-circle',
            color: '#10B981',
            badge: 'New'
        },
        {
            id: 'orders',
            title: 'Orders & Deliveries',
            desc: 'Customer orders, dispatch & status',
            icon: 'receipt-outline',
            activeIcon: 'receipt',
            color: '#F59E0B',
            badge: ordersCount > 0 ? `${ordersCount}` : null
        },
        {
            id: 'shipping',
            title: 'Shipping & Delivery Rates',
            desc: 'Custom delivery fees & radius',
            icon: 'bicycle-outline',
            activeIcon: 'bicycle',
            color: '#F97316',
            badge: vendor?.custom_shipping_enabled ? 'Active' : 'Setup'
        },
        {
            id: 'wallet',
            title: 'Wallet & Payouts',
            desc: 'Withdraw earnings & bank transfer',
            icon: 'wallet-outline',
            activeIcon: 'wallet',
            color: '#059669',
            badge: `₦${balance.toLocaleString()}`
        },
        {
            id: 'qr_card',
            title: 'Store QR Flyer & Link',
            desc: 'Marketing flyer, WhatsApp share & PDF',
            icon: 'qr-code-outline',
            activeIcon: 'qr-code',
            color: '#8B5CF6',
            badge: 'Flyer'
        },
        {
            id: 'messages',
            title: 'Customer Inquiries & Chats',
            desc: 'Direct buyer questions & support',
            icon: 'chatbubbles-outline',
            activeIcon: 'chatbubbles',
            color: '#0284C7',
            badge: null
        },
        {
            id: 'followers',
            title: 'Store Followers & Fans',
            desc: 'Customer base & store promotion',
            icon: 'people-outline',
            activeIcon: 'people',
            color: '#6366F1',
            badge: followersCount > 0 ? `${followersCount}` : null
        },
        {
            id: 'certificate',
            title: 'Official Certificate',
            desc: 'Verified merchant credential',
            icon: 'ribbon-outline',
            activeIcon: 'ribbon',
            color: '#F59E0B',
            badge: 'Verified'
        },
        {
            id: 'public_store',
            title: 'Preview Store as Buyer',
            desc: 'How customers view your storefront',
            icon: 'eye-outline',
            activeIcon: 'eye',
            color: '#06B6D4',
            badge: 'Live'
        }
    ];

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                {/* Backdrop touch to close */}
                <TouchableWithoutFeedback onPress={onClose}>
                    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
                </TouchableWithoutFeedback>

                {/* Animated Drawer Panel */}
                <Animated.View
                    style={[
                        styles.drawerContainer,
                        {
                            transform: [{ translateX: slideAnim }],
                            paddingTop: Math.max(insets.top, 16),
                            paddingBottom: Math.max(insets.bottom, 16)
                        }
                    ]}
                >
                    {/* Drawer Header with Banner */}
                    <LinearGradient
                        colors={['#070D1B', '#0E1A2E', '#16233B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.headerCard}
                    >
                        {/* Close button */}
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeBtn}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons name="close" size={20} color="#CBD5E1" />
                        </TouchableOpacity>

                        {/* Store Identity */}
                        <View style={styles.storeProfileRow}>
                            <View style={styles.avatarWrap}>
                                <UserAvatar
                                    user={user}
                                    sourceUrl={logoUrl}
                                    size={58}
                                    border={GOLD}
                                />
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark-circle" size={17} color={GOLD} />
                                </View>
                            </View>

                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Text style={styles.storeNameText} numberOfLines={1}>
                                        {storeName}
                                    </Text>
                                    <Ionicons name="shield-checkmark" size={16} color={GOLD} />
                                </View>

                                <Text style={styles.storeCategoryText} numberOfLines={1}>
                                    {storeCategory}
                                </Text>

                                <View style={styles.statusPill}>
                                    <View style={styles.statusDot} />
                                    <Text style={styles.statusText}>
                                        {isUserAdmin ? 'ADMIN & VERIFIED MERCHANT' : (vendor?.is_locked ? 'Suspended / Locked' : 'LIVE MERCHANT STORE')}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Quick KPI Strip */}
                        <View style={styles.kpiStrip}>
                            <View style={styles.kpiItem}>
                                <Text style={styles.kpiLabel}>Balance</Text>
                                <Text style={styles.kpiValue} numberOfLines={1}>
                                    ₦{balance.toLocaleString()}
                                </Text>
                            </View>
                            <View style={styles.kpiDivider} />
                            <View style={styles.kpiItem}>
                                <Text style={styles.kpiLabel}>Products</Text>
                                <Text style={styles.kpiValue}>{productsCount}</Text>
                            </View>
                            <View style={styles.kpiDivider} />
                            <View style={styles.kpiItem}>
                                <Text style={styles.kpiLabel}>Orders</Text>
                                <Text style={styles.kpiValue}>{ordersCount}</Text>
                            </View>
                            <View style={styles.kpiDivider} />
                            <View style={styles.kpiItem}>
                                <Text style={styles.kpiLabel}>Rating</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                    <Ionicons name="star" size={11} color={GOLD} />
                                    <Text style={styles.kpiValue}>5.0</Text>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* Navigation Items List */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        <Text style={styles.menuSectionHeader}>MANAGEMENT & TOOLS</Text>

                        {NAV_ITEMS.map((item) => {
                            const isActive =
                                activeTab === item.id ||
                                (item.id === 'store_profile' && (activeTab === 'store_profile' || activeTab === 'store profile'));

                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => handleSelect(item.id)}
                                    activeOpacity={0.7}
                                    style={[
                                        styles.navItem,
                                        isActive && styles.navItemActive
                                    ]}
                                >
                                    {/* Icon with colored container */}
                                    <View
                                        style={[
                                            styles.navIconBox,
                                            { backgroundColor: isActive ? item.color : item.color + '15' }
                                        ]}
                                    >
                                        <Ionicons
                                            name={isActive ? item.activeIcon : item.icon}
                                            size={19}
                                            color={isActive ? '#FFFFFF' : item.color}
                                        />
                                    </View>

                                    {/* Titles */}
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text
                                            style={[
                                                styles.navTitle,
                                                isActive && styles.navTitleActive
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {item.title}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.navDesc,
                                                isActive && styles.navDescActive
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {item.desc}
                                        </Text>
                                    </View>

                                    {/* Badge if available */}
                                    {item.badge && (
                                        <View
                                            style={[
                                                styles.badgeBox,
                                                isActive
                                                    ? { backgroundColor: '#FFFFFF' }
                                                    : { backgroundColor: item.color + '20' }
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.badgeText,
                                                    { color: isActive ? NAVY : item.color }
                                                ]}
                                            >
                                                {item.badge}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Arrow */}
                                    <Ionicons
                                        name="chevron-forward"
                                        size={16}
                                        color={isActive ? '#CBD5E1' : '#94A3B8'}
                                        style={{ marginLeft: 6 }}
                                    />
                                </TouchableOpacity>
                            );
                        })}

                        {/* Bottom Utility Divider */}
                        <View style={styles.sectionDivider} />

                        <Text style={styles.menuSectionHeader}>QUICK SHORTCUTS</Text>

                        {/* Switch to Buyer App */}
                        <TouchableOpacity
                            onPress={() => {
                                onClose();
                                setTimeout(() => onSwitchToBuyer?.(), 100);
                            }}
                            style={styles.navItem}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.navIconBox, { backgroundColor: '#E2E8F0' }]}>
                                <Ionicons name="home-outline" size={19} color="#334155" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.navTitle}>Marketplace Storefront</Text>
                                <Text style={styles.navDesc}>Return to buyer shopping experience</Text>
                            </View>
                            <Ionicons name="arrow-forward-outline" size={16} color="#94A3B8" />
                        </TouchableOpacity>

                        {/* Logout / Exit */}
                        <TouchableOpacity
                            onPress={() => {
                                onClose();
                                setTimeout(() => onLogout?.(), 100);
                            }}
                            style={[styles.navItem, { marginTop: 4 }]}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.navIconBox, { backgroundColor: '#FEE2E2' }]}>
                                <Ionicons name="log-out-outline" size={19} color="#DC2626" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.navTitle, { color: '#DC2626' }]}>Exit Vendor Mode</Text>
                                <Text style={styles.navDesc}>Sign out or switch active profile</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#F87171" />
                        </TouchableOpacity>

                        {/* Security / Version Footer */}
                        <View style={styles.footerNote}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                                <Text style={styles.footerNoteText}>SSL 256-Bit Encrypted</Text>
                            </View>
                            <Text style={styles.versionText}>Abu Mafhal Merchant v2.6.0</Text>
                        </View>
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        flexDirection: 'row',
        zIndex: 9999
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(11, 19, 43, 0.65)'
    },
    drawerContainer: {
        width: DRAWER_WIDTH,
        height: '100%',
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 5, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 20,
        zIndex: 10000
    },
    headerCard: {
        padding: 16,
        paddingTop: 14,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
        position: 'relative'
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10
    },
    storeProfileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        paddingRight: 24
    },
    avatarWrap: {
        position: 'relative'
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#0B132B',
        borderRadius: 10
    },
    storeNameText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.3
    },
    storeCategoryText: {
        fontSize: 11.5,
        color: GOLD_LIGHT,
        fontWeight: '600',
        marginTop: 2
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(16, 185, 129, 0.18)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 12,
        marginTop: 6,
        gap: 5
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981'
    },
    statusText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#34D399',
        letterSpacing: 0.4
    },
    kpiStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
        marginTop: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    kpiItem: {
        alignItems: 'center',
        flex: 1
    },
    kpiLabel: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '600'
    },
    kpiValue: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 1
    },
    kpiDivider: {
        width: 1,
        height: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.12)'
    },
    scrollContent: {
        paddingHorizontal: 12,
        paddingTop: 14,
        paddingBottom: 24
    },
    menuSectionHeader: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.8,
        marginLeft: 6,
        marginBottom: 8,
        marginTop: 4
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 14,
        marginBottom: 4
    },
    navItemActive: {
        backgroundColor: NAVY
    },
    navIconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    navTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#1E293B',
        letterSpacing: -0.2
    },
    navTitleActive: {
        color: '#FFFFFF'
    },
    navDesc: {
        fontSize: 10.5,
        color: '#64748B',
        fontWeight: '500',
        marginTop: 1
    },
    navDescActive: {
        color: '#CBD5E1'
    },
    badgeBox: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8,
        marginRight: 2
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800'
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 12,
        marginHorizontal: 4
    },
    footerNote: {
        marginTop: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderColor: '#F1F5F9',
        alignItems: 'center',
        gap: 4
    },
    footerNoteText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#64748B'
    },
    versionText: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '600'
    }
});
