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
    Switch,
    ActivityIndicator,
    TouchableWithoutFeedback,
    Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { LucideIcon } from './LucideIcon';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.84, 340);

const NAVY = '#0B132B';
const DARK_SURFACE = '#111E38';
const GOLD = '#D9A73A';
const SUCCESS = '#10B981';
const DANGER = '#EF4444';
const AMBER = '#F59E0B';
const TEXT_MUTED = '#94A3B8';
const TEXT_DARK = '#0F172A';
const BORDER_COLOR = '#E2E8F0';

export const DriverDrawer = ({
    visible,
    onClose,
    activeTab,
    onSelectTab,
    driverProfile,
    activeUser,
    walletBalance = 0,
    orders = [],
    poolOrders = [],
    historyOrders = [],
    driverTier = { title: 'Diamond Courier', color: '#38BDF8', badge: '💎', percent: 100 },
    isLiveTracking,
    toggleLiveTracking,
    isSyncingGps,
    syncLiveGps,
    toggleStatus,
    triggerSOS,
    onOpenVehicleModal,
    onOpenShiftSummary,
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
                    duration: 240,
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
            if (tabKey === 'vehicle') {
                onOpenVehicleModal?.();
            } else if (tabKey === 'shift_summary') {
                onOpenShiftSummary?.();
            } else {
                onSelectTab?.(tabKey);
            }
        }, 120);
    };

    if (!visible) return null;

    const isOnline = driverProfile?.status === 'active';

    const NAV_ITEMS = [
        {
            id: 'active',
            title: 'Active Deliveries',
            desc: 'In transit consignments',
            icon: 'bicycle',
            color: SUCCESS,
            badge: orders.length > 0 ? `${orders.length}` : null
        },
        {
            id: 'pool',
            title: 'Available Job Pool',
            desc: 'Claim ready packages',
            icon: 'flash',
            color: AMBER,
            badge: poolOrders.length > 0 ? `${poolOrders.length}` : null
        },
        {
            id: 'wallet',
            title: 'Escrow Wallet & Payouts',
            desc: 'Balance & bank transfers',
            icon: 'wallet',
            color: GOLD,
            badge: `₦${walletBalance.toLocaleString()}`
        },
        {
            id: 'history',
            title: 'Completed Deliveries',
            desc: 'Receipts & past orders',
            icon: 'time',
            color: '#38BDF8',
            badge: historyOrders.length > 0 ? `${historyOrders.length}` : null
        },
        {
            id: 'profile',
            title: 'Vehicle & Performance',
            desc: 'Plate, engine & rating',
            icon: 'truck',
            color: '#A855F7',
            badge: driverProfile?.vehicle_type || 'Motorcycle'
        }
    ];

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
                            paddingTop: Math.max(insets.top, 14),
                            paddingBottom: Math.max(insets.bottom, 16)
                        }
                    ]}
                >
                    <LinearGradient
                        colors={[NAVY, DARK_SURFACE]}
                        style={StyleSheet.absoluteFillObject}
                    />

                    {/* ─── 1. TOP HEADER & PROFILE ─── */}
                    <View style={styles.drawerHeader}>
                        <View style={styles.profileRow}>
                            <View style={styles.avatarWrap}>
                                <Image
                                    source={{
                                        uri:
                                            activeUser?.avatar_url ||
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                activeUser?.full_name || 'Courier'
                                            )}&background=0B132B&color=D9A73A&size=200`
                                    }}
                                    style={styles.avatarImg}
                                />
                                <View
                                    style={[
                                        styles.avatarStatusDot,
                                        { backgroundColor: isOnline ? SUCCESS : '#94A3B8' }
                                    ]}
                                />
                            </View>

                            <View style={styles.profileInfo}>
                                <Text style={styles.driverName} numberOfLines={1}>
                                    {activeUser?.full_name || 'Courier Partner'}
                                </Text>
                                <View style={styles.levelBadge}>
                                    <Text style={styles.levelBadgeText}>
                                        {driverTier.badge} {driverTier.title.toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={styles.driverPhone} numberOfLines={1}>
                                    {activeUser?.phone || driverProfile?.phone || 'Abu Mafhal Logistics'}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.closeBtn}
                                activeOpacity={0.7}
                            >
                                <LucideIcon name="close" size={18} color="#CBD5E1" />
                            </TouchableOpacity>
                        </View>

                        {/* XP Progress Bar */}
                        <View style={styles.xpCard}>
                            <View style={styles.xpRow}>
                                <Text style={styles.xpTitle}>COURIER RANK</Text>
                                <Text style={styles.xpValue}>{driverProfile?.xp || 0} XP</Text>
                            </View>
                            <View style={styles.xpTrack}>
                                <View
                                    style={[
                                        styles.xpFill,
                                        { width: `${Math.min(driverTier.percent || 50, 100)}%` }
                                    ]}
                                />
                            </View>
                        </View>
                    </View>

                    {/* ─── 2. STATUS & GPS CONTROLS ─── */}
                    <View style={styles.statusSection}>
                        <View style={styles.statusMainRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <View
                                    style={[
                                        styles.statusIndicatorDot,
                                        { backgroundColor: isOnline ? SUCCESS : '#64748B' }
                                    ]}
                                />
                                <View>
                                    <Text style={styles.statusTitleText}>
                                        {isOnline ? 'ONLINE • DISPATCH READY' : 'OFFLINE • STANDBY'}
                                    </Text>
                                    <Text style={styles.statusSubText} numberOfLines={1}>
                                        {driverProfile?.current_location || 'Kano Hub Central'}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={isOnline}
                                onValueChange={toggleStatus}
                                trackColor={{ false: '#334155', true: SUCCESS }}
                                thumbColor={isOnline ? '#FFFFFF' : '#94A3B8'}
                            />
                        </View>

                        {/* GPS Action Bar */}
                        <View style={styles.gpsRow}>
                            <TouchableOpacity
                                style={[
                                    styles.gpsBtn,
                                    isLiveTracking && { backgroundColor: 'rgba(16, 185, 129, 0.25)', borderColor: SUCCESS }
                                ]}
                                onPress={toggleLiveTracking}
                                activeOpacity={0.8}
                            >
                                <LucideIcon name="radio" size={13} color={isLiveTracking ? SUCCESS : '#FFFFFF'} />
                                <Text style={[styles.gpsBtnText, isLiveTracking && { color: SUCCESS }]}>
                                    {isLiveTracking ? 'LIVE TRACK ON' : 'TRACK GPS'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.gpsBtn}
                                onPress={syncLiveGps}
                                disabled={isSyncingGps}
                                activeOpacity={0.8}
                            >
                                {isSyncingGps ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <LucideIcon name="refresh-cw" size={13} color="#FFFFFF" />
                                        <Text style={styles.gpsBtnText}>SYNC LOCATION</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ─── 3. NAVIGATION MENU LIST ─── */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        <Text style={styles.sectionHeader}>LOGISTICS NAVIGATION</Text>

                        {NAV_ITEMS.map((item) => {
                            const isActive = activeTab === item.id;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.navItem, isActive && styles.navItemActive]}
                                    onPress={() => handleSelect(item.id)}
                                    activeOpacity={0.8}
                                >
                                    <View
                                        style={[
                                            styles.navIconBox,
                                            { backgroundColor: isActive ? GOLD : 'rgba(255, 255, 255, 0.08)' }
                                        ]}
                                    >
                                        <LucideIcon
                                            name={item.icon}
                                            size={17}
                                            color={isActive ? NAVY : item.color || '#FFFFFF'}
                                        />
                                    </View>
                                    <View style={styles.navTextWrap}>
                                        <Text
                                            style={[styles.navTitle, isActive && styles.navTitleActive]}
                                            numberOfLines={1}
                                        >
                                            {item.title}
                                        </Text>
                                        <Text style={styles.navDesc} numberOfLines={1}>
                                            {item.desc}
                                        </Text>
                                    </View>
                                    {item.badge ? (
                                        <View
                                            style={[
                                                styles.navBadge,
                                                isActive && { backgroundColor: GOLD }
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.navBadgeText,
                                                    isActive && { color: NAVY }
                                                ]}
                                            >
                                                {item.badge}
                                            </Text>
                                        </View>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}

                        {/* Shift & Safety Section */}
                        <Text style={[styles.sectionHeader, { marginTop: 18 }]}>SHIFT & EMERGENCY</Text>

                        <TouchableOpacity
                            style={styles.actionRowBtn}
                            onPress={() => handleSelect('shift_summary')}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.navIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                                <LucideIcon name="clock" size={16} color="#38BDF8" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionRowTitle}>Shift Summary & Timer</Text>
                                <Text style={styles.navDesc}>Rating: 5.0 ★ • Clock-out</Text>
                            </View>
                            <LucideIcon name="chevron-right" size={14} color="#64748B" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionRowBtn}
                            onPress={() => Linking.openURL('tel:08002286234')}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.navIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                <LucideIcon name="phone" size={16} color={SUCCESS} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionRowTitle}>Call Logistics Dispatch</Text>
                                <Text style={styles.navDesc}>Toll-free 24/7 hotline</Text>
                            </View>
                            <LucideIcon name="chevron-right" size={14} color="#64748B" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionRowBtn, { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}
                            onPress={() => {
                                onClose();
                                setTimeout(triggerSOS, 200);
                            }}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.navIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                                <LucideIcon name="alert-triangle" size={16} color={DANGER} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.actionRowTitle, { color: DANGER }]}>Emergency SOS Alert</Text>
                                <Text style={[styles.navDesc, { color: '#FCA5A5' }]}>Send instant GPS signal</Text>
                            </View>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* ─── 4. LOGOUT FOOTER ─── */}
                    <View style={styles.drawerFooter}>
                        <TouchableOpacity
                            style={styles.logoutBtn}
                            onPress={() => {
                                onClose();
                                setTimeout(onLogout, 150);
                            }}
                            activeOpacity={0.8}
                        >
                            <LucideIcon name="power" size={16} color={DANGER} />
                            <Text style={styles.logoutBtnText}>Sign Out of Courier Account</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        flexDirection: 'row',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(11, 19, 43, 0.72)',
    },
    drawerContainer: {
        width: DRAWER_WIDTH,
        height: '100%',
        backgroundColor: NAVY,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 20,
    },
    drawerHeader: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    avatarWrap: {
        position: 'relative',
    },
    avatarImg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: GOLD,
    },
    avatarStatusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderWidth: 2,
        borderColor: NAVY,
    },
    profileInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    levelBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(217, 167, 58, 0.2)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 3,
    },
    levelBadgeText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: GOLD,
        letterSpacing: 0.4,
    },
    driverPhone: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    xpCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 10,
        padding: 8,
    },
    xpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    xpTitle: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5,
    },
    xpValue: {
        fontSize: 10,
        fontWeight: '800',
        color: GOLD,
    },
    xpTrack: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    xpFill: {
        height: '100%',
        backgroundColor: GOLD,
        borderRadius: 2,
    },
    statusSection: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    statusMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusIndicatorDot: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
    },
    statusTitleText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.4,
    },
    statusSubText: {
        fontSize: 10.5,
        color: '#94A3B8',
        marginTop: 1,
    },
    gpsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    gpsBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.4)',
    },
    gpsBtnText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    scrollContent: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 20,
    },
    sectionHeader: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748B',
        letterSpacing: 0.7,
        marginBottom: 8,
        marginLeft: 4,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 12,
        marginBottom: 4,
    },
    navItemActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.09)',
        borderLeftWidth: 3,
        borderLeftColor: GOLD,
    },
    navIconBox: {
        width: 32,
        height: 32,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navTextWrap: {
        flex: 1,
    },
    navTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#E2E8F0',
    },
    navTitleActive: {
        color: '#FFFFFF',
        fontWeight: '900',
    },
    navDesc: {
        fontSize: 10.5,
        color: '#94A3B8',
        marginTop: 1,
    },
    navBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    navBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    actionRowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: 12,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    actionRowTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#E2E8F0',
    },
    drawerFooter: {
        paddingHorizontal: 16,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        paddingVertical: 11,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    logoutBtnText: {
        fontSize: 12,
        fontWeight: '900',
        color: DANGER,
    },
});

export default DriverDrawer;
