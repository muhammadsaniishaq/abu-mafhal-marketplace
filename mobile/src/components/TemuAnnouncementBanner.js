import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Animated,
    StyleSheet,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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

    // Fade / Slide animation value
    const animValue = useRef(new Animated.Value(1)).current;

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
            text: customText || '⚡ Flash Deals: Up to 50% Off Limited Time Items!',
            actionLabel: actionText || 'Claim ➔',
            actionType: 'flash_sales'
        },
        {
            id: 'shipping',
            badge: 'FREE DELIVERY',
            icon: 'car-outline',
            text: '🚚 Free Express Delivery on orders over ₦15,000 across Nigeria',
            actionLabel: 'Details ➔',
            actionType: 'shipping'
        },
        {
            id: 'guarantee',
            badge: 'BUYER PROTECTION',
            icon: 'shield-checkmark',
            text: '🛡️ 100% Genuine Verified Merchants & 90-Day Returns',
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

    const handleBannerPress = () => {
        if (onPressAction) {
            onPressAction(currentMsg.actionType);
        }
    };

    return (
        <View style={[S.wrapper, style]}>
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={S.gradientContainer}
            >
                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={handleBannerPress}
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

                    {/* Action CTA Pill */}
                    <View style={S.actionBtn}>
                        <Text style={S.actionBtnText}>{currentMsg.actionLabel}</Text>
                    </View>
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
        elevation: 1
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
    }
});
