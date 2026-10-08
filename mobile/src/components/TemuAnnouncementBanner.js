import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Animated,
    StyleSheet,
    Platform,
    Modal,
    Clipboard,
    Vibration,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Vibrant Modern Temu / Top E-Commerce Gradients
const GRADIENTS = {
    temu: ['#FF4500', '#FF7A00'],        // Iconic Temu Vibrant Flame
    obsidian: ['#0F172A', '#1E293B'],    // Executive Obsidian & Gold
    emerald: ['#047857', '#10B981'],     // Trust & Free Delivery Green
    cyber: ['#4F46E5', '#7C3AED'],       // High-Tech Cyber Purple
    crimson: ['#BE123C', '#E11D48'],     // Hot Sale Crimson
    sapphire: ['#1D4ED8', '#3B82F6']     // Classic Cobalt Blue
};

export const TemuAnnouncementBanner = ({
    settings,
    onPressAction,
    style
}) => {
    // Check if announcement is enabled
    const isActive = Boolean(
        typeof settings?.announcement_active === 'boolean'
            ? settings.announcement_active
            : (settings?.announcement_active?.value ?? true)
    );

    const [isDismissed, setIsDismissed] = useState(false);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [showPerksModal, setShowPerksModal] = useState(false);
    const [copiedCoupon, setCopiedCoupon] = useState(false);
    const [toastText, setToastText] = useState('');

    // Fade / Slide animation value
    const animValue = useRef(new Animated.Value(1)).current;
    const toastAnim = useRef(new Animated.Value(0)).current;

    // Active coupon code from admin or default
    const promoCode = (
        typeof settings?.announcement_coupon_code === 'string'
            ? settings.announcement_coupon_code
            : (settings?.announcement_coupon_code?.value || 'TEMU30')
    ).trim().toUpperCase();

    // Free delivery minimum from settings
    const freeDeliveryMin = Number(
        typeof settings?.free_shipping_min === 'object' && settings?.free_shipping_min !== null
            ? (settings.free_shipping_min.value ?? 5000)
            : (settings?.free_shipping_min || settings?.free_shipping_threshold || 5000)
    ) || 5000;

    // Messages pool: Main admin message + Temu high-converting value propositions
    const customText = typeof settings?.announcement_text === 'string'
        ? settings.announcement_text.trim()
        : (settings?.announcement_text?.value || '');

    const badgeLabel = typeof settings?.announcement_badge === 'string'
        ? settings.announcement_badge.trim()
        : (settings?.announcement_badge?.value || 'TEMU DEAL');

    const actionText = typeof settings?.announcement_action_text === 'string'
        ? settings.announcement_action_text.trim()
        : (settings?.announcement_action_text?.value || 'Claim ➔');

    const messages = [
        {
            id: 'promo',
            badge: badgeLabel || 'TEMU DEAL',
            icon: 'flash',
            text: customText || `⚡ Flash Deals: Up to 50% Off Limited Time Items with Code ${promoCode}!`,
            actionLabel: actionText || 'Claim ➔',
            actionType: 'claim_coupon'
        },
        {
            id: 'shipping',
            badge: 'FREE DELIVERY',
            icon: 'car-outline',
            text: `🚚 Free Express Delivery on orders over ₦${freeDeliveryMin.toLocaleString()} across Nigeria`,
            actionLabel: 'Details ➔',
            actionType: 'open_perks'
        },
        {
            id: 'guarantee',
            badge: 'BUYER PROTECTION',
            icon: 'shield-checkmark',
            text: '🛡️ 100% Escrow Protection Vault & Verified Merchant Deliveries',
            actionLabel: 'Shop ➔',
            actionType: 'shop'
        }
    ];

    // Auto-cycle through messages every 4.5 seconds
    useEffect(() => {
        if (!isActive || isDismissed) return;

        const interval = setInterval(() => {
            Animated.sequence([
                Animated.timing(animValue, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: Platform.OS !== 'web'
                }),
                Animated.timing(animValue, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: Platform.OS !== 'web'
                })
            ]).start();

            setCurrentIdx(prev => (prev + 1) % messages.length);
        }, 4500);

        return () => clearInterval(interval);
    }, [isActive, isDismissed, messages.length, animValue]);

    const showFloatingToast = (msg) => {
        setToastText(msg);
        Animated.sequence([
            Animated.timing(toastAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: Platform.OS !== 'web'
            }),
            Animated.delay(2600),
            Animated.timing(toastAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: Platform.OS !== 'web'
            })
        ]).start();
    };

    const handleCopyAndApplyCoupon = async (codeToCopy = promoCode) => {
        try {
            Clipboard.setString(codeToCopy);
            await AsyncStorage.setItem('@abumafhal_applied_coupon', codeToCopy);
            setCopiedCoupon(true);
            if (Platform.OS !== 'web') {
                Vibration.vibrate([0, 40, 30, 40]);
            }
            showFloatingToast(`🎉 Voucher ${codeToCopy} copied & applied to checkout!`);
            setTimeout(() => setCopiedCoupon(false), 3500);
        } catch (_) {}
    };

    const handleActionClick = (actionType) => {
        if (actionType === 'claim_coupon') {
            handleCopyAndApplyCoupon(promoCode);
            if (onPressAction) {
                onPressAction('flash_sales');
            }
        } else if (actionType === 'open_perks') {
            setShowPerksModal(true);
        } else {
            if (onPressAction) {
                onPressAction(actionType);
            } else {
                setShowPerksModal(true);
            }
        }
    };

    if (!isActive || isDismissed) {
        return null;
    }

    const currentMsg = messages[currentIdx] || messages[0];

    // Determine Gradient Palette
    const rawStyle = typeof settings?.announcement_style === 'string'
        ? settings.announcement_style
        : (settings?.announcement_style?.value || 'temu');
    const styleKey = (rawStyle || 'temu').toLowerCase();
    let gradientColors = GRADIENTS[styleKey] || GRADIENTS.temu;

    const rawColor = typeof settings?.announcement_color === 'string'
        ? settings.announcement_color
        : settings?.announcement_color?.value;
    if (rawColor && typeof rawColor === 'string' && rawColor.startsWith('#') && rawColor.length === 7 && styleKey === 'custom') {
        gradientColors = [rawColor, rawColor];
    }

    return (
        <View style={[S.wrapper, style]}>
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={S.gradientContainer}
            >
                {/* Banner Content Body (Opens Perks Modal on tap) */}
                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => setShowPerksModal(true)}
                    style={S.contentRow}
                >
                    {/* Badge Pill */}
                    <View style={S.badgePill}>
                        <Ionicons name={currentMsg.icon} size={11} color="#FFFFFF" />
                        <Text style={S.badgeText}>{currentMsg.badge}</Text>
                    </View>

                    {/* Animated Text Message */}
                    <Animated.View
                        style={[
                            S.textContainer,
                            {
                                opacity: animValue,
                                transform: [
                                    {
                                        translateY: animValue.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [-4, 0]
                                        })
                                    }
                                ]
                            }
                        ]}
                    >
                        <Text style={S.messageText} numberOfLines={1}>
                            {currentMsg.text}
                        </Text>
                    </Animated.View>
                </TouchableOpacity>

                {/* Action CTA Pill Button */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleActionClick(currentMsg.actionType)}
                    style={S.actionBtn}
                >
                    <Text style={S.actionBtnText}>{currentMsg.actionLabel}</Text>
                </TouchableOpacity>

                {/* Dismiss Button */}
                <TouchableOpacity
                    onPress={() => setIsDismissed(true)}
                    style={S.dismissBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="close" size={13} color="rgba(255, 255, 255, 0.85)" />
                </TouchableOpacity>
            </LinearGradient>

            {/* Floating Feedback Toast */}
            {toastText ? (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        S.toastBox,
                        {
                            opacity: toastAnim,
                            transform: [
                                {
                                    translateY: toastAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [10, 0]
                                    })
                                }
                            ]
                        }
                    ]}
                >
                    <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                    <Text style={S.toastTxt} numberOfLines={1}>{toastText}</Text>
                </Animated.View>
            ) : null}

            {/* ─── LIVE TEMU PERKS & VOUCHERS MODAL ─── */}
            <Modal
                visible={showPerksModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowPerksModal(false)}
            >
                <View style={S.modalOverlay}>
                    <View style={S.modalContainer}>
                        {/* Modal Header */}
                        <LinearGradient
                            colors={['#0F172A', '#1E293B']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={S.modalHeader}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={S.modalIconCircle}>
                                    <Ionicons name="gift" size={16} color="#FF7A00" />
                                </View>
                                <View>
                                    <Text style={S.modalHeaderTitle}>Exclusive Platform Perks</Text>
                                    <Text style={S.modalHeaderSub}>Live vouchers, free delivery & protection</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowPerksModal(false)}
                                style={S.modalCloseCircle}
                            >
                                <Ionicons name="close" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        </LinearGradient>

                        <ScrollView style={S.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Perk 1: Live Flash Promo Voucher */}
                            <View style={S.perkCard}>
                                <View style={S.perkCardHeader}>
                                    <View style={[S.perkBadge, { backgroundColor: '#FF4500' }]}>
                                        <Ionicons name="flash" size={11} color="#FFFFFF" />
                                        <Text style={S.perkBadgeText}>LIMITED PROMO</Text>
                                    </View>
                                    <Text style={S.perkValueTitle}>30% OFF Flash Coupon</Text>
                                </View>
                                <Text style={S.perkDesc}>
                                    Apply coupon code at checkout to receive instant savings on qualified merchandise.
                                </Text>

                                <View style={S.couponRow}>
                                    <View style={S.couponCodeBox}>
                                        <Text style={S.couponCodeLabel}>PROMO CODE</Text>
                                        <Text style={S.couponCodeValue}>{promoCode}</Text>
                                    </View>
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => handleCopyAndApplyCoupon(promoCode)}
                                        style={[
                                            S.couponCopyBtn,
                                            copiedCoupon && { backgroundColor: '#10B981' }
                                        ]}
                                    >
                                        <Ionicons
                                            name={copiedCoupon ? 'checkmark' : 'copy-outline'}
                                            size={14}
                                            color="#FFFFFF"
                                        />
                                        <Text style={S.couponCopyBtnText}>
                                            {copiedCoupon ? 'Applied!' : 'Copy Code'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Perk 2: Free Nationwide Delivery */}
                            <View style={S.perkCard}>
                                <View style={S.perkCardHeader}>
                                    <View style={[S.perkBadge, { backgroundColor: '#047857' }]}>
                                        <Ionicons name="car" size={11} color="#FFFFFF" />
                                        <Text style={S.perkBadgeText}>FREE DELIVERY</Text>
                                    </View>
                                    <Text style={S.perkValueTitle}>Orders Over ₦{freeDeliveryMin.toLocaleString()}</Text>
                                </View>
                                <Text style={S.perkDesc}>
                                    Enjoy zero delivery fees on orders crossing the ₦{freeDeliveryMin.toLocaleString()} threshold to all 36 states and FCT Abuja.
                                </Text>
                            </View>

                            {/* Perk 3: Escrow Buyer Protection */}
                            <View style={S.perkCard}>
                                <View style={S.perkCardHeader}>
                                    <View style={[S.perkBadge, { backgroundColor: '#4F46E5' }]}>
                                        <Ionicons name="shield-checkmark" size={11} color="#FFFFFF" />
                                        <Text style={S.perkBadgeText}>BUYER SAFEGUARD</Text>
                                    </View>
                                    <Text style={S.perkValueTitle}>100% Escrow Vault</Text>
                                </View>
                                <Text style={S.perkDesc}>
                                    Your payment remains securely deposited in our Escrow Vault until you receive and approve your package in person.
                                </Text>
                            </View>
                        </ScrollView>

                        {/* Modal Footer CTA */}
                        <View style={S.modalFooter}>
                            <TouchableOpacity
                                activeOpacity={0.88}
                                onPress={() => {
                                    setShowPerksModal(false);
                                    if (onPressAction) onPressAction('flash_sales');
                                }}
                                style={S.modalShopBtn}
                            >
                                <LinearGradient
                                    colors={['#FF4500', '#FF7A00']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={S.modalShopBtnGradient}
                                >
                                    <Text style={S.modalShopBtnText}>Explore Flash Deals Now ➔</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const S = StyleSheet.create({
    wrapper: {
        width: '100%',
        marginBottom: 8,
        borderRadius: 10,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3
    },
    gradientContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 10
    },
    contentRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0
    },
    badgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(0, 0, 0, 0.22)',
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 5,
        borderWidth: 0.8,
        borderColor: 'rgba(255, 255, 255, 0.25)'
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.3
    },
    textContainer: {
        flex: 1,
        minWidth: 0
    },
    messageText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '800',
        letterSpacing: -0.1
    },
    actionBtn: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 1,
        marginLeft: 6
    },
    actionBtnText: {
        color: '#0F172A',
        fontSize: 10,
        fontWeight: '900'
    },
    dismissBtn: {
        paddingLeft: 6,
        paddingRight: 2,
        paddingVertical: 4,
        alignItems: 'center',
        justifyContent: 'center'
    },
    toastBox: {
        position: 'absolute',
        bottom: -32,
        alignSelf: 'center',
        backgroundColor: '#0F172A',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        zIndex: 999,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 6
    },
    toastTxt: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800'
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
    },
    modalContainer: {
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 18,
        elevation: 12
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14
    },
    modalIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalHeaderTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900'
    },
    modalHeaderSub: {
        color: '#94A3B8',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 1
    },
    modalCloseCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalBody: {
        padding: 14
    },
    perkCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10
    },
    perkCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4
    },
    perkBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 5
    },
    perkBadgeText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.3
    },
    perkValueTitle: {
        color: '#0F172A',
        fontSize: 12.5,
        fontWeight: '900'
    },
    perkDesc: {
        color: '#64748B',
        fontSize: 11,
        lineHeight: 16,
        marginTop: 2
    },
    couponRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 8,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderStyle: 'dashed'
    },
    couponCodeBox: {
        flex: 1
    },
    couponCodeLabel: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5
    },
    couponCodeValue: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: 0.5
    },
    couponCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FF4500',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8
    },
    couponCopyBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900'
    },
    modalFooter: {
        padding: 14,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        backgroundColor: '#FFFFFF'
    },
    modalShopBtn: {
        borderRadius: 12,
        overflow: 'hidden'
    },
    modalShopBtnGradient: {
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalShopBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.3
    }
});
