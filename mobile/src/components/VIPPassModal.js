import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    Modal,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Platform,
    Alert,
    Share,
    Dimensions,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'qrcode';
import { UserAvatar } from './UserAvatar';

const { width } = Dimensions.get('window');

// ─── Authentic Code-39 Barcode Encoding ──────────────────────────────────────
const CODE39_MAP = {
    '0': [1,0,1,0,0,1,1,0,1,1,0,1],
    '1': [1,1,0,1,0,0,1,0,1,0,1,1],
    '2': [1,0,1,1,0,0,1,0,1,0,1,1],
    '3': [1,1,0,1,1,0,0,1,0,1,0,1],
    '4': [1,0,1,0,0,1,1,0,1,0,1,1],
    '5': [1,1,0,1,0,0,1,1,0,1,0,1],
    '6': [1,0,1,1,0,0,1,1,0,1,0,1],
    '7': [1,0,1,0,0,1,0,1,1,0,1,1],
    '8': [1,1,0,1,0,0,1,0,1,1,0,1],
    '9': [1,0,1,1,0,0,1,0,1,1,0,1],
    'A': [1,1,0,1,0,1,0,0,1,0,1,1],
    'B': [1,0,1,1,0,1,0,0,1,0,1,1],
    'C': [1,1,0,1,1,0,1,0,0,1,0,1],
    'D': [1,0,1,0,1,1,0,0,1,0,1,1],
    'E': [1,1,0,1,0,1,1,0,0,1,0,1],
    'F': [1,0,1,1,0,1,1,0,0,1,0,1],
    'G': [1,0,1,0,1,0,0,1,1,0,1,1],
    'H': [1,1,0,1,0,1,0,0,1,1,0,1],
    'I': [1,0,1,1,0,1,0,0,1,1,0,1],
    'J': [1,0,1,0,1,1,0,0,1,1,0,1],
    'K': [1,1,0,1,0,1,0,1,0,0,1,1],
    'L': [1,0,1,1,0,1,0,1,0,0,1,1],
    'M': [1,1,0,1,1,0,1,0,1,0,0,1],
    'N': [1,0,1,0,1,1,0,1,0,0,1,1],
    'O': [1,1,0,1,0,1,1,0,1,0,0,1],
    'P': [1,0,1,1,0,1,1,0,1,0,0,1],
    'Q': [1,0,1,0,1,0,1,1,0,0,1,1],
    'R': [1,1,0,1,0,1,0,1,1,0,0,1],
    'S': [1,0,1,1,0,1,0,1,1,0,0,1],
    'T': [1,0,1,0,1,1,0,1,1,0,0,1],
    'U': [1,1,0,0,1,0,1,0,1,0,1,1],
    'V': [1,0,0,1,1,0,1,0,1,0,1,1],
    'W': [1,1,0,0,1,1,0,1,0,1,0,1],
    'X': [1,0,0,1,0,1,1,0,1,0,1,1],
    'Y': [1,1,0,0,1,0,1,1,0,1,0,1],
    'Z': [1,0,0,1,1,0,1,1,0,1,0,1],
    '-': [1,0,0,1,0,1,0,1,1,0,1,1],
    '*': [1,0,0,1,0,1,1,0,1,1,0,1]
};

const getBarcodeBits = (codeStr = '') => {
    const clean = ('*' + codeStr.toUpperCase().replace(/[^0-9A-Z-]/g, '') + '*').slice(0, 14);
    const bits = [];
    for (let i = 0; i < clean.length; i++) {
        const pattern = CODE39_MAP[clean[i]] || CODE39_MAP['*'];
        bits.push(...pattern);
        bits.push(0); // Inter-character separator
    }
    return bits;
};

// ─── All Loyalty Tiers Catalog ───────────────────────────────────────────────
export const ALL_TIERS = [
    {
        key: 'bronze',
        name: 'Bronze Member',
        badge: '✦ BRONZE MEMBER',
        color: '#64748B',
        lightBg: '#F8FAFC',
        lightBorder: '#CBD5E1',
        gradient: ['#FFFFFF', '#F8FAFC', '#E2E8F0'],
        minPoints: 0,
        maxPoints: 499,
        icon: 'medal-outline',
        cashback: '1% Instant Rebate',
        delivery: 'Standard Delivery',
        perks: [
            'Earn 10 reward points for every ₦1,000 spent',
            '100% Escrow Buyer Protection on All Purchases',
            'Full Access to Marketplace & Dispute Resolution',
            'Standard Package Tracking'
        ]
    },
    {
        key: 'silver',
        name: 'Silver Member',
        badge: '✦ SILVER MEMBER',
        color: '#2563EB',
        lightBg: '#EFF6FF',
        lightBorder: '#BFDBFE',
        gradient: ['#FFFFFF', '#EFF6FF', '#DBEAFE'],
        minPoints: 500,
        maxPoints: 1499,
        icon: 'ribbon-outline',
        cashback: '2% Instant Rebate',
        delivery: 'Discounted Shipping',
        perks: [
            '1.5x Multiplier on All Reward Mafhal Coins',
            '2% Instant Rebate on Selected Verified Deals',
            'Standard Escrow Buyer Protection Guaranteed',
            'Special Silver Promo Voucher Every Month'
        ]
    },
    {
        key: 'platinum',
        name: 'Platinum Member',
        badge: '✦ PLATINUM MEMBER',
        color: '#D97706',
        lightBg: '#FFFBEB',
        lightBorder: '#FDE68A',
        gradient: ['#FFFFFF', '#FFFBEB', '#FEF3C7'],
        minPoints: 1500,
        maxPoints: 4999,
        icon: 'trophy-outline',
        cashback: '3% Cash Rebate',
        delivery: 'Free Delivery (>₦15k)',
        perks: [
            '3% Cash Rebate on Qualified Electronics & Fashion',
            'Free Delivery on Orders > ₦15,000',
            'Priority Escrow Queue Clearance',
            'Dedicated Priority Email & In-App Support',
            'Early 12-Hour Access to Mega Sales'
        ]
    },
    {
        key: 'gold',
        name: 'VIP Gold',
        badge: '✦ VIP GOLD MEMBER',
        color: '#D4AF37',
        lightBg: '#FFFDF0',
        lightBorder: '#FDE68A',
        gradient: ['#FFFFFF', '#FFFDF0', '#FEF9C3'],
        minPoints: 5000,
        maxPoints: 9999,
        icon: 'shield-checkmark',
        cashback: '5% Instant Cashback',
        delivery: 'Free Delivery (>₦10k)',
        perks: [
            '5% Instant Cashback on All Store Purchases',
            'Free Delivery on Orders > ₦10,000',
            'Priority 1-Hour Escrow Processing',
            'Personal WhatsApp VIP Support Agent',
            'Exclusive VIP Secret Flash Sales & Vouchers'
        ]
    },
    {
        key: 'diamond',
        name: 'Royal Diamond',
        badge: '✦ ROYAL DIAMOND VIP',
        color: '#7C3AED',
        lightBg: '#F5F3FF',
        lightBorder: '#DDD6FE',
        gradient: ['#FFFFFF', '#F5F3FF', '#EDE9FE'],
        minPoints: 10000,
        maxPoints: Infinity,
        icon: 'diamond',
        cashback: '8% Instant Cashback',
        delivery: 'Free Express VIP Dispatch',
        perks: [
            '0% Escrow & Commission Fees across all orders',
            'Unlimited Free Express Delivery Everywhere',
            'Dedicated 24/7 VIP Concierge & Account Manager',
            'Instant Priority Liquidity & Escrow Release',
            'Invitation-Only Private Marketplace Secret Deals'
        ]
    }
];

// ─── Loyalty Tier Resolver ───────────────────────────────────────────────────
const resolveTier = (points = 0, role = '') => {
    const rLower = (role || '').toLowerCase();
    const isAdmin = rLower === 'admin' || rLower === 'super_admin' || rLower === 'superadmin';

    if (isAdmin || points >= 10000) {
        const t = ALL_TIERS[4];
        return {
            ...t,
            nextTier: 'Max Royal Prestige',
            nextPoints: 10000,
            progress: 1.0
        };
    }
    if (points >= 5000) {
        const t = ALL_TIERS[3];
        return {
            ...t,
            nextTier: 'Royal Diamond',
            nextPoints: 10000,
            progress: Math.min(1, Math.max(0.15, (points - 5000) / 5000))
        };
    }
    if (points >= 1500) {
        const t = ALL_TIERS[2];
        return {
            ...t,
            nextTier: 'VIP Gold',
            nextPoints: 5000,
            progress: Math.min(1, Math.max(0.12, (points - 1500) / 3500))
        };
    }
    if (points >= 500) {
        const t = ALL_TIERS[1];
        return {
            ...t,
            nextTier: 'Platinum Member',
            nextPoints: 1500,
            progress: Math.min(1, Math.max(0.10, (points - 500) / 1000))
        };
    }
    const t = ALL_TIERS[0];
    return {
        ...t,
        nextTier: 'Silver Member',
        nextPoints: 500,
        progress: Math.min(1, Math.max(0.08, points / 500))
    };
};

// ─── Card Theme Styles (Bright & Luxury Light Options) ────────────────────────
const CARD_FINISHES = {
    champagne: {
        name: 'Champagne Gold',
        icon: 'sparkles',
        gradient: ['#FFFFFF', '#FFFDF0', '#FEF9C3'],
        borderColor: '#D4AF37',
        accentColor: '#B48C28',
        chipColor: '#D4AF37',
        tagBg: 'rgba(212, 175, 55, 0.15)',
        textColor: '#0A192F',
        subTextColor: '#785A14'
    },
    pearl: {
        name: 'Platinum Pearl',
        icon: 'shield-outline',
        gradient: ['#FFFFFF', '#F8FAFC', '#E2E8F0'],
        borderColor: '#94A3B8',
        accentColor: '#475569',
        chipColor: '#64748B',
        tagBg: 'rgba(100, 116, 139, 0.12)',
        textColor: '#0A192F',
        subTextColor: '#475569'
    },
    emerald: {
        name: 'Emerald Mint',
        icon: 'leaf-outline',
        gradient: ['#FFFFFF', '#F0FDF4', '#DCFCE7'],
        borderColor: '#10B981',
        accentColor: '#059669',
        chipColor: '#10B981',
        tagBg: 'rgba(16, 185, 129, 0.14)',
        textColor: '#064E3B',
        subTextColor: '#047857'
    },
    sapphire: {
        name: 'Sapphire Royal',
        icon: 'water-outline',
        gradient: ['#FFFFFF', '#EFF6FF', '#DBEAFE'],
        borderColor: '#3B82F6',
        accentColor: '#1D4ED8',
        chipColor: '#3B82F6',
        tagBg: 'rgba(59, 130, 246, 0.12)',
        textColor: '#1E3A8A',
        subTextColor: '#1D4ED8'
    }
};

export const VIPPassModal = ({ visible, onClose, user, wallet, onNavigate }) => {
    const [activeTab, setActiveTab] = useState('card'); // 'card' | 'qr' | 'perks'
    const [cardFinish, setCardFinish] = useState('champagne'); // 'champagne' | 'pearl' | 'emerald' | 'sapphire'
    const [selectedPerkTier, setSelectedPerkTier] = useState(null); // for exploring other tiers
    const [qrUri, setQrUri] = useState(null);
    const [qrLoading, setQrLoading] = useState(true);
    const [copiedLabel, setCopiedLabel] = useState(null);
    const [showZoomQR, setShowZoomQR] = useState(false);

    // Dynamic Member Properties
    const rawUid = user?.id || '';
    const memberId = useMemo(() => {
        if (!rawUid) return 'AM-GUEST';
        const clean = rawUid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return `AM-${clean.slice(0, 8)}`;
    }, [rawUid]);

    const displayName = useMemo(() => {
        return user?.full_name || user?.fullName || (user?.email ? user.email.split('@')[0] : 'Valued Member');
    }, [user]);

    const userRole = useMemo(() => {
        const r = (user?.role || 'buyer').toUpperCase();
        if (r === 'SUPER_ADMIN' || r === 'SUPERADMIN') return 'SUPER ADMIN';
        return r;
    }, [user?.role]);

    const points = wallet?.points || user?.mafhal_coins || 0;
    const currentTier = useMemo(() => resolveTier(points, user?.role), [points, user?.role]);

    // Active tier in perks tab (defaults to currentTier, but allows user to tap any tier to preview perks)
    const activePerkViewTier = useMemo(() => {
        if (selectedPerkTier) {
            const found = ALL_TIERS.find(t => t.key === selectedPerkTier);
            if (found) return found;
        }
        return currentTier;
    }, [selectedPerkTier, currentTier]);

    const memberSinceYear = useMemo(() => {
        if (user?.created_at) {
            const yr = new Date(user.created_at).getFullYear();
            if (!isNaN(yr)) return yr;
        }
        return '2025';
    }, [user?.created_at]);

    const securityHash = useMemo(() => {
        const seed = rawUid ? rawUid.slice(-6).toUpperCase() : '2026AM';
        return `SEC-256-${seed}`;
    }, [rawUid]);

    const barcodeBits = useMemo(() => getBarcodeBits(memberId), [memberId]);
    const finishTheme = CARD_FINISHES[cardFinish] || CARD_FINISHES.champagne;

    // Live Dynamic QR Code Generation
    useEffect(() => {
        if (!visible) return;

        let isMounted = true;
        setQrLoading(true);

        const verifyUrl = `https://abumafhal.com/verify-pass?id=${encodeURIComponent(rawUid)}&code=${encodeURIComponent(memberId)}&tier=${encodeURIComponent(currentTier.name)}`;

        const generateQR = async () => {
            try {
                if (QRCode && typeof QRCode.toDataURL === 'function') {
                    const dataUrl = await QRCode.toDataURL(verifyUrl, {
                        width: 380,
                        margin: 1,
                        color: {
                            dark: '#0A192F',
                            light: '#FFFFFF'
                        },
                        errorCorrectionLevel: 'M'
                    });
                    if (isMounted && dataUrl) {
                        setQrUri(dataUrl);
                        setQrLoading(false);
                        return;
                    }
                }
            } catch (err) {
                console.warn('QRCode library error, using fallback:', err);
            }

            // High-reliability crisp CDN fallback if canvas/lib unavailable
            const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=380x380&margin=4&color=0a192f&bgcolor=ffffff&data=${encodeURIComponent(verifyUrl)}`;
            if (isMounted) {
                setQrUri(fallbackUrl);
                setQrLoading(false);
            }
        };

        generateQR();

        return () => {
            isMounted = false;
        };
    }, [visible, rawUid, memberId, currentTier.name]);

    const handleCopy = (text, label = 'Member ID') => {
        try {
            if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(text);
            }
        } catch (_) {}
        setCopiedLabel(label);
        if (Platform.OS === 'web') {
            // Web alert / subtle confirmation
        } else {
            Alert.alert('Copied! 📋', `${label} (${text}) copied to clipboard.`);
        }
        setTimeout(() => setCopiedLabel(null), 3000);
    };

    const handleShare = async () => {
        try {
            const message = `👑 Abu Mafhal Marketplace - Royal VIP Passport\n\n` +
                `👤 Member: ${displayName}\n` +
                `🆔 Member ID: ${memberId}\n` +
                `🎖️ Tier: ${currentTier.name}\n` +
                `🛡️ Escrow ID: ${securityHash}\n` +
                `🟢 Status: VERIFIED & ACTIVE\n\n` +
                `Verify authenticity online:\n` +
                `https://abumafhal.com/verify-pass?id=${rawUid}&code=${memberId}`;
            await Share.share({
                title: 'Abu Mafhal Royal VIP Passport',
                message
            });
        } catch (_) {}
    };

    const handleWhatsAppConcierge = () => {
        const text = encodeURIComponent(
            `Hello Abu Mafhal VIP Concierge! I am an active VIP Member (${displayName}, Member ID: ${memberId}, Tier: ${currentTier.name}). I need VIP concierge assistance.`
        );
        Linking.openURL(`https://wa.me/2348000000000?text=${text}`).catch(() => {
            Alert.alert('Concierge', 'VIP Concierge hotline is currently connecting via in-app tickets.');
        });
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={s.modalOverlay}>
                <View style={s.passContainer}>

                    {/* ── 1. Pristine Bright Header Bar ─────────────────── */}
                    <View style={s.passHeaderBar}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={s.crownIconBadge}>
                                <Ionicons name="sparkles" size={15} color="#D4AF37" />
                            </View>
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Text style={s.headerBrandTitle}>ABU MAFHAL PASSPORT</Text>
                                    <View style={s.officialLiveTag}>
                                        <Text style={s.officialLiveTagTxt}>OFFICIAL</Text>
                                    </View>
                                </View>
                                <Text style={s.headerBrandSub}>SECURE ESCROW & VIP VERIFICATION</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            style={s.headerCloseBtn}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close" size={17} color="#475569" />
                        </TouchableOpacity>
                    </View>

                    {/* Shimmering Gold Border Underline */}
                    <LinearGradient
                        colors={['#D4AF37', '#FDE68A', '#D4AF37']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.headerGoldLine}
                    />

                    {/* ── 2. Segmented Mode Tabs (Modern Clean Light Pills) ── */}
                    <View style={s.tabsWrap}>
                        {[
                            { key: 'card', label: 'VIP Card', icon: 'card-outline' },
                            { key: 'qr', label: 'Scan & QR', icon: 'qr-code-outline' },
                            { key: 'perks', label: 'Privileges', icon: 'gift-outline' }
                        ].map(t => {
                            const isSelected = activeTab === t.key;
                            return (
                                <TouchableOpacity
                                    key={t.key}
                                    onPress={() => setActiveTab(t.key)}
                                    style={[s.tabBtn, isSelected && s.tabBtnActive]}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={t.icon}
                                        size={14}
                                        color={isSelected ? '#0A192F' : '#64748B'}
                                    />
                                    <Text style={[s.tabBtnTxt, isSelected && s.tabBtnTxtActive]}>
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* ── 3. Scrollable Passport Body ────────────────────── */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={s.scrollContent}
                    >
                        {/* ═════════ TAB 1: VIP DIGITAL CARD VIEW (BRIGHT LUXURY) ═════════ */}
                        {activeTab === 'card' && (
                            <View style={{ gap: 14 }}>
                                {/* Card Finish Selector (Modern Bright Customizer) */}
                                <View style={s.finishBar}>
                                    <Text style={s.finishBarLabel}>CARD FINISH:</Text>
                                    <View style={s.finishPillsRow}>
                                        {Object.entries(CARD_FINISHES).map(([k, item]) => {
                                            const isCurr = cardFinish === k;
                                            return (
                                                <TouchableOpacity
                                                    key={k}
                                                    onPress={() => setCardFinish(k)}
                                                    style={[
                                                        s.finishPill,
                                                        isCurr && { borderColor: item.borderColor, backgroundColor: item.tagBg }
                                                    ]}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons
                                                        name={item.icon}
                                                        size={11}
                                                        color={isCurr ? item.accentColor : '#64748B'}
                                                    />
                                                    <Text style={[
                                                        s.finishPillTxt,
                                                        isCurr && { color: item.accentColor, fontWeight: '900' }
                                                    ]}>
                                                        {item.name.split(' ')[0]}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Luxury Bright Physical-Style Digital Passport Card */}
                                <LinearGradient
                                    colors={finishTheme.gradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={[s.vipCardHero, { borderColor: finishTheme.borderColor }]}
                                >
                                    {/* Background Shield Watermark */}
                                    <Ionicons
                                        name="shield-checkmark"
                                        size={210}
                                        color="rgba(212, 175, 55, 0.07)"
                                        style={s.cardWatermark}
                                    />

                                    {/* Top Row: Emblems, Chip & Contactless Wave */}
                                    <View style={s.cardHeroTop}>
                                        <View style={[s.cardHeroEmblemRow, { borderColor: finishTheme.borderColor, backgroundColor: finishTheme.tagBg }]}>
                                            <Ionicons name="sparkles" size={13} color={finishTheme.accentColor} />
                                            <Text style={[s.cardHeroEmblemTxt, { color: finishTheme.accentColor }]}>
                                                {currentTier.badge}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                            <Ionicons name="wifi" size={15} color={finishTheme.accentColor} style={{ transform: [{ rotate: '90deg' }] }} />
                                            {/* EMV Microchip */}
                                            <View style={[s.chipBox, { borderColor: finishTheme.borderColor }]}>
                                                <Ionicons name="hardware-chip-sharp" size={20} color={finishTheme.chipColor} />
                                            </View>
                                        </View>
                                    </View>

                                    {/* Middle Row: User Details */}
                                    <View style={s.cardHeroUserRow}>
                                        <View style={s.cardHeroAvatarRing}>
                                            <UserAvatar user={user} size={54} border={finishTheme.borderColor} />
                                            <View style={[s.cardVerifiedPill, { backgroundColor: finishTheme.accentColor }]}>
                                                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                                            </View>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[s.cardHeroName, { color: finishTheme.textColor }]} numberOfLines={1}>
                                                {displayName}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                                <View style={[s.cardRoleTag, { backgroundColor: finishTheme.tagBg, borderColor: finishTheme.borderColor }]}>
                                                    <Text style={[s.cardRoleTagTxt, { color: finishTheme.accentColor }]}>
                                                        {userRole}
                                                    </Text>
                                                </View>
                                                <Text style={[s.cardSinceTxt, { color: finishTheme.subTextColor }]}>
                                                    MEMBER SINCE {memberSinceYear}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Bottom Row: Member ID & Status */}
                                    <View style={[s.cardHeroFooter, { borderTopColor: 'rgba(212, 175, 55, 0.25)' }]}>
                                        <TouchableOpacity
                                            onPress={() => handleCopy(memberId, 'Member ID')}
                                            style={s.cardIdBox}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[s.cardIdLabel, { color: finishTheme.subTextColor }]}>MEMBER PASSPORT ID</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
                                                <Text style={[s.cardIdVal, { color: finishTheme.textColor }]}>{memberId}</Text>
                                                <Ionicons
                                                    name={copiedLabel === 'Member ID' ? 'checkmark-circle' : 'copy-outline'}
                                                    size={13}
                                                    color={finishTheme.accentColor}
                                                />
                                            </View>
                                        </TouchableOpacity>

                                        <View style={s.cardActiveStatusPill}>
                                            <View style={s.liveGreenDot} />
                                            <Text style={s.cardActiveStatusTxt}>VERIFIED</Text>
                                        </View>
                                    </View>

                                    {/* Security Ribbon */}
                                    <View style={s.cardSecRibbon}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Ionicons name="lock-closed" size={10} color={finishTheme.accentColor} />
                                            <Text style={[s.cardSecRibbonTxt, { color: finishTheme.subTextColor }]}>
                                                ESCROW 256-BIT ENCRYPTION
                                            </Text>
                                        </View>
                                        <Text style={[s.cardSecCodeTxt, { color: finishTheme.subTextColor }]}>{securityHash}</Text>
                                    </View>
                                </LinearGradient>

                                {/* Quick Passport Stats Bar (Crisp Light Porcelain) */}
                                <View style={s.quickStatsRow}>
                                    <View style={s.statBox}>
                                        <Text style={s.statBoxLbl}>LOYALTY POINTS</Text>
                                        <Text style={[s.statBoxVal, { color: '#D4AF37' }]}>
                                            {Number(points).toLocaleString()} pts
                                        </Text>
                                    </View>
                                    <View style={s.statDivider} />
                                    <View style={s.statBox}>
                                        <Text style={s.statBoxLbl}>CURRENT TIER</Text>
                                        <Text style={s.statBoxVal}>{currentTier.name}</Text>
                                    </View>
                                    <View style={s.statDivider} />
                                    <View style={s.statBox}>
                                        <Text style={s.statBoxLbl}>ESCROW STATUS</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <View style={s.liveGreenDot} />
                                            <Text style={[s.statBoxVal, { color: '#059669', fontSize: 11 }]}>Active 🟢</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => setActiveTab('qr')}
                                        style={[s.primaryActionBtn, { flex: 1.2 }]}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="qr-code" size={16} color="#0A192F" />
                                        <Text style={s.primaryActionTxt}>Show Scan QR</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleShare}
                                        style={[s.secondaryActionBtn, { flex: 0.9 }]}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="share-social-outline" size={16} color="#0A192F" />
                                        <Text style={s.secondaryActionTxt}>Share Pass</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* VIP Concierge & Wallet Quick Nav */}
                                <View style={s.quickNavRow}>
                                    <TouchableOpacity
                                        onPress={handleWhatsAppConcierge}
                                        style={s.quickNavBtn}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[s.quickNavIconCircle, { backgroundColor: '#DCFCE7' }]}>
                                            <Ionicons name="logo-whatsapp" size={15} color="#16A34A" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.quickNavTitle}>VIP Concierge</Text>
                                            <Text style={s.quickNavSub}>24/7 Priority WhatsApp Hotline</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={13} color="#94A3B8" />
                                    </TouchableOpacity>

                                    {onNavigate && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                onClose();
                                                onNavigate('wallet');
                                            }}
                                            style={s.quickNavBtn}
                                            activeOpacity={0.8}
                                        >
                                            <View style={[s.quickNavIconCircle, { backgroundColor: '#FEF9C3' }]}>
                                                <Ionicons name="wallet-outline" size={15} color="#D97706" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.quickNavTitle}>Points & Wallet</Text>
                                                <Text style={s.quickNavSub}>Redeem coins and view rewards</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={13} color="#94A3B8" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* ═════════ TAB 2: LIVE DYNAMIC QR & BARCODE VIEW (BRIGHT HIGH CONTRAST) ═════════ */}
                        {activeTab === 'qr' && (
                            <View style={{ alignItems: 'center', gap: 14 }}>
                                {/* Main QR Card */}
                                <View style={s.qrMainCard}>
                                    <View style={s.qrCardTopTitle}>
                                        <Ionicons name="shield-checkmark" size={14} color="#D4AF37" />
                                        <Text style={s.qrCardTitleTxt}>OFFICIAL SCAN IDENTIFIER</Text>
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => setShowZoomQR(true)}
                                        style={s.qrFrameWhiteBox}
                                        activeOpacity={0.9}
                                    >
                                        {qrLoading ? (
                                            <View style={s.qrSkeletonBox}>
                                                <ActivityIndicator size="large" color="#0A192F" />
                                                <Text style={s.qrLoadingTxt}>Generating Secure QR...</Text>
                                            </View>
                                        ) : qrUri ? (
                                            <>
                                                <Image
                                                    source={{ uri: qrUri }}
                                                    style={s.qrImage}
                                                    resizeMode="contain"
                                                />
                                                <View style={s.tapZoomBadge}>
                                                    <Ionicons name="expand-outline" size={11} color="#0A192F" />
                                                    <Text style={s.tapZoomBadgeTxt}>Tap to Enlarge</Text>
                                                </View>
                                            </>
                                        ) : (
                                            <Ionicons name="qr-code" size={170} color="#0A192F" />
                                        )}
                                    </TouchableOpacity>

                                    <Text style={s.qrScanPrompt}>
                                        Scan at authorized partner hubs, merchants, or delivery escrows for immediate VIP verification.
                                    </Text>

                                    {/* ── Authentic Code-39 Barcode ── */}
                                    <View style={s.barcodeBox}>
                                        <View style={s.barcodeBarsRow}>
                                            {barcodeBits.map((bit, idx) => (
                                                <View
                                                    key={idx}
                                                    style={{
                                                        width: 1.5,
                                                        height: 26,
                                                        backgroundColor: bit ? '#0A192F' : 'transparent',
                                                        marginRight: 0.4
                                                    }}
                                                />
                                            ))}
                                        </View>
                                        <Text style={s.barcodeHumanText}>* {memberId} *</Text>
                                    </View>

                                    {/* Verification Hash Stamp */}
                                    <View style={s.verifyStampBox}>
                                        <Ionicons name="lock-closed" size={12} color="#059669" />
                                        <Text style={s.verifyStampTxt}>AUTHENTICITY TOKEN: {securityHash}</Text>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={{ width: '100%', flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => handleCopy(memberId, 'Member ID')}
                                        style={[s.primaryActionBtn, { flex: 1 }]}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="copy-outline" size={15} color="#0A192F" />
                                        <Text style={s.primaryActionTxt}>Copy Member ID</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleCopy(`https://abumafhal.com/verify-pass?id=${rawUid}&code=${memberId}`, 'Verification Link')}
                                        style={[s.secondaryActionBtn, { flex: 1 }]}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="link-outline" size={15} color="#0A192F" />
                                        <Text style={s.secondaryActionTxt}>Copy Link</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* ═════════ TAB 3: PRIVILEGES & TIER EXPLORER (BRIGHT PORCELAIN) ═════════ */}
                        {activeTab === 'perks' && (
                            <View style={{ gap: 14 }}>
                                {/* Tier Status Banner */}
                                <View style={[s.tierStatusBanner, { borderColor: activePerkViewTier.lightBorder, backgroundColor: activePerkViewTier.lightBg }]}>
                                    <View style={[s.tierIconCircle, { borderColor: activePerkViewTier.color, backgroundColor: '#FFFFFF' }]}>
                                        <Ionicons name={activePerkViewTier.icon} size={22} color={activePerkViewTier.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={s.tierBannerTitle}>{activePerkViewTier.name}</Text>
                                            {activePerkViewTier.key === currentTier.key && (
                                                <View style={s.activeTierPill}>
                                                    <Text style={s.activeTierPillTxt}>YOUR TIER</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={s.tierBannerSub}>
                                            {activePerkViewTier.key === currentTier.key
                                                ? 'Active Privileges currently applied to your account'
                                                : `Requires ${activePerkViewTier.minPoints.toLocaleString()} points to unlock`}
                                        </Text>
                                    </View>
                                </View>

                                {/* Tier Explorer Switcher Row */}
                                <View style={s.tierExplorerBox}>
                                    <Text style={s.tierExplorerTitle}>EXPLORE ALL VIP TIERS:</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 4 }}>
                                        {ALL_TIERS.map(t => {
                                            const isSelected = activePerkViewTier.key === t.key;
                                            const isCurrent = currentTier.key === t.key;
                                            return (
                                                <TouchableOpacity
                                                    key={t.key}
                                                    onPress={() => setSelectedPerkTier(t.key)}
                                                    style={[
                                                        s.tierChip,
                                                        isSelected && { borderColor: t.color, backgroundColor: t.lightBg }
                                                    ]}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons
                                                        name={t.icon}
                                                        size={12}
                                                        color={isSelected ? t.color : '#64748B'}
                                                    />
                                                    <Text style={[
                                                        s.tierChipTxt,
                                                        isSelected && { color: t.color, fontWeight: '900' }
                                                    ]}>
                                                        {t.name.split(' ')[0]}
                                                    </Text>
                                                    {isCurrent && <View style={s.currentTierDot} />}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>

                                {/* Highlights Pill Grid */}
                                <View style={s.perksHighlightsRow}>
                                    <View style={s.perkHighlightCard}>
                                        <Ionicons name="cash-outline" size={17} color="#D97706" />
                                        <Text style={s.perkHighlightTitle}>Cashback</Text>
                                        <Text style={s.perkHighlightVal}>{activePerkViewTier.cashback}</Text>
                                    </View>
                                    <View style={s.perkHighlightCard}>
                                        <Ionicons name="car-outline" size={17} color="#2563EB" />
                                        <Text style={s.perkHighlightTitle}>Shipping</Text>
                                        <Text style={s.perkHighlightVal}>{activePerkViewTier.delivery}</Text>
                                    </View>
                                    <View style={s.perkHighlightCard}>
                                        <Ionicons name="shield-checkmark-outline" size={17} color="#059669" />
                                        <Text style={s.perkHighlightTitle}>Escrow</Text>
                                        <Text style={s.perkHighlightVal}>Zero Wait</Text>
                                    </View>
                                </View>

                                {/* List of Active Privileges */}
                                <View style={s.perksListBox}>
                                    <Text style={s.perksListHeader}>PRIVILEGES BREAKDOWN</Text>
                                    {activePerkViewTier.perks.map((p, idx) => (
                                        <View key={idx} style={s.perkItemRow}>
                                            <View style={[s.perkCheckCircle, { backgroundColor: activePerkViewTier.color }]}>
                                                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                                            </View>
                                            <Text style={s.perkItemTxt}>{p}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Next Tier Progress Bar */}
                                {currentTier.nextTier !== 'Max Royal Prestige' && (
                                    <View style={s.nextTierBox}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <Text style={s.nextTierLabel}>NEXT GOAL: {currentTier.nextTier.toUpperCase()}</Text>
                                            <Text style={s.nextTierPoints}>{points} / {currentTier.nextPoints} pts</Text>
                                        </View>
                                        <View style={s.progressTrack}>
                                            <View style={[s.progressFill, { width: `${Math.round(currentTier.progress * 100)}%` }]} />
                                        </View>
                                        <Text style={s.progressHint}>
                                            Earn {Math.max(0, currentTier.nextPoints - points)} more points with purchases to upgrade your VIP tier!
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>

            {/* ── 4. Fullscreen Zoom QR Modal (Store / Merchant Scan Mode) ── */}
            <Modal
                visible={showZoomQR}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowZoomQR(false)}
            >
                <View style={s.zoomOverlay}>
                    <View style={s.zoomContainer}>
                        <View style={s.zoomHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="qr-code" size={16} color="#0A192F" />
                                <Text style={s.zoomHeaderTitle}>Counter Scan Mode</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowZoomQR(false)}
                                style={s.zoomCloseBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={18} color="#0A192F" />
                            </TouchableOpacity>
                        </View>
                        <View style={s.zoomQrBox}>
                            {qrUri ? (
                                <Image source={{ uri: qrUri }} style={{ width: 260, height: 260 }} resizeMode="contain" />
                            ) : (
                                <ActivityIndicator size="large" color="#0A192F" />
                            )}
                        </View>
                        <Text style={s.zoomMemberId}>{memberId}</Text>
                        <Text style={s.zoomHint}>Present this high-brightness screen to cashier or hub agent</Text>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
};

export default VIPPassModal;

// ─── Styles (Bright, Pristine, Modern Luxury Aesthetic) ──────────────────────
const s = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)', // modern frosted backdrop blur feel
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
    },
    passContainer: {
        backgroundColor: '#FFFFFF', // pristine porcelain bright white
        borderRadius: 26,
        width: Math.min(width - 24, 395),
        maxWidth: 395,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: '#0A192F',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.16,
        shadowRadius: 28,
        elevation: 20,
        overflow: 'hidden',
        maxHeight: '92%'
    },
    passHeaderBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 13,
        backgroundColor: '#FFFFFF'
    },
    crownIconBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FEF9C3',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    headerBrandTitle: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.8
    },
    officialLiveTag: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 0.5,
        borderColor: '#86EFAC'
    },
    officialLiveTagTxt: {
        fontSize: 7.5,
        fontWeight: '900',
        color: '#16A34A',
        letterSpacing: 0.4
    },
    headerBrandSub: {
        fontSize: 8.5,
        color: '#64748B',
        fontWeight: '700',
        letterSpacing: 0.4,
        marginTop: 1
    },
    headerCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerGoldLine: {
        width: '100%',
        height: 2.5
    },

    // Tabs (Clean Light Pills)
    tabsWrap: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        padding: 4,
        marginHorizontal: 14,
        marginTop: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        borderRadius: 10
    },
    tabBtnActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#0A192F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2
    },
    tabBtnTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B'
    },
    tabBtnTxtActive: {
        color: '#0A192F',
        fontWeight: '900'
    },

    scrollContent: {
        padding: 14,
        paddingBottom: 20
    },

    // Card Finish Selector
    finishBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 2
    },
    finishBarLabel: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.5
    },
    finishPillsRow: {
        flexDirection: 'row',
        gap: 5
    },
    finishPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    finishPillTxt: {
        fontSize: 8.5,
        color: '#64748B',
        fontWeight: '700'
    },

    // Card Hero View (Bright Luxury Physical Card)
    vipCardHero: {
        borderRadius: 22,
        padding: 16,
        borderWidth: 1.5,
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#0A192F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.09,
        shadowRadius: 12,
        elevation: 4
    },
    cardWatermark: {
        position: 'absolute',
        right: -30,
        bottom: -30
    },
    cardHeroTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14
    },
    cardHeroEmblemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 7,
        borderWidth: 1
    },
    cardHeroEmblemTxt: {
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.8
    },
    chipBox: {
        width: 32,
        height: 24,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1
    },
    cardHeroUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16
    },
    cardHeroAvatarRing: {
        position: 'relative'
    },
    cardVerifiedPill: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF'
    },
    cardHeroName: {
        fontSize: 16.5,
        fontWeight: '900',
        letterSpacing: -0.2
    },
    cardRoleTag: {
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 0.5
    },
    cardRoleTagTxt: {
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    cardSinceTxt: {
        fontSize: 8.5,
        fontWeight: '700'
    },
    cardHeroFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1
    },
    cardIdBox: {
        flex: 1
    },
    cardIdLabel: {
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    cardIdVal: {
        fontSize: 14.5,
        fontWeight: '900',
        letterSpacing: 1.2
    },
    cardActiveStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#86EFAC'
    },
    liveGreenDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981'
    },
    cardActiveStatusTxt: {
        fontSize: 9,
        fontWeight: '900',
        color: '#16A34A',
        letterSpacing: 0.5
    },
    cardSecRibbon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 6,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(0, 0, 0, 0.08)'
    },
    cardSecRibbonTxt: {
        fontSize: 7.5,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    cardSecCodeTxt: {
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.5
    },

    // Quick Stats Bar (Clean White Porcelain)
    quickStatsRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    statBox: {
        flex: 1,
        alignItems: 'center'
    },
    statDivider: {
        width: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 2
    },
    statBoxLbl: {
        fontSize: 8,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.5
    },
    statBoxVal: {
        fontSize: 12,
        fontWeight: '900',
        color: '#0A192F',
        marginTop: 2
    },

    // Action Buttons
    primaryActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#D4AF37',
        paddingVertical: 12,
        borderRadius: 14,
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 5,
        elevation: 3
    },
    primaryActionTxt: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#0A192F'
    },
    secondaryActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#F1F5F9',
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    secondaryActionTxt: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0A192F'
    },

    // Quick Nav Links
    quickNavRow: {
        gap: 8,
        marginTop: 2
    },
    quickNavBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    quickNavIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center'
    },
    quickNavTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#0A192F'
    },
    quickNavSub: {
        fontSize: 9.5,
        color: '#64748B',
        marginTop: 0.5
    },

    // QR Card View
    qrMainCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: '#0A192F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3
    },
    qrCardTopTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 10
    },
    qrCardTitleTxt: {
        fontSize: 10,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.8
    },
    qrFrameWhiteBox: {
        width: 210,
        height: 210,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#0A192F',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        position: 'relative'
    },
    qrImage: {
        width: '100%',
        height: '100%'
    },
    tapZoomBadge: {
        position: 'absolute',
        bottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#CBD5E1'
    },
    tapZoomBadgeTxt: {
        fontSize: 8,
        fontWeight: '800',
        color: '#0A192F'
    },
    qrSkeletonBox: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8
    },
    qrLoadingTxt: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '700'
    },
    qrScanPrompt: {
        fontSize: 10.5,
        color: '#64748B',
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 15,
        paddingHorizontal: 6
    },
    barcodeBox: {
        width: '100%',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    barcodeBarsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '90%',
        overflow: 'hidden'
    },
    barcodeHumanText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 1.5,
        marginTop: 4,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    },
    verifyStampBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    verifyStampTxt: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#0A192F',
        letterSpacing: 0.5
    },

    // Perks Tab
    tierStatusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 18,
        borderWidth: 1.5
    },
    tierIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        shadowColor: '#0A192F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2
    },
    tierBannerTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0A192F'
    },
    tierBannerSub: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 1
    },
    activeTierPill: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 0.5,
        borderColor: '#86EFAC'
    },
    activeTierPillTxt: {
        fontSize: 7.5,
        fontWeight: '900',
        color: '#16A34A'
    },

    // Tier Explorer
    tierExplorerBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    tierExplorerTitle: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.5,
        marginBottom: 2
    },
    tierChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    tierChipTxt: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B'
    },
    currentTierDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#10B981',
        marginLeft: 2
    },

    perksHighlightsRow: {
        flexDirection: 'row',
        gap: 8
    },
    perkHighlightCard: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        gap: 2
    },
    perkHighlightTitle: {
        fontSize: 9,
        fontWeight: '700',
        color: '#64748B'
    },
    perkHighlightVal: {
        fontSize: 10,
        fontWeight: '900',
        color: '#0A192F',
        textAlign: 'center'
    },
    perksListBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        gap: 10
    },
    perksListHeader: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.8
    },
    perkItemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10
    },
    perkCheckCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1
    },
    perkItemTxt: {
        flex: 1,
        fontSize: 11.5,
        color: '#334155',
        fontWeight: '600',
        lineHeight: 16
    },
    nextTierBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    nextTierLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 0.5
    },
    nextTierPoints: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#0A192F'
    },
    progressTrack: {
        height: 6,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        overflow: 'hidden',
        marginVertical: 4
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#D4AF37',
        borderRadius: 3
    },
    progressHint: {
        fontSize: 9.5,
        color: '#64748B',
        marginTop: 2
    },

    // Zoom QR Modal
    zoomOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10, 25, 47, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    zoomContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
        width: Math.min(width - 40, 340),
        borderWidth: 2,
        borderColor: '#0A192F'
    },
    zoomHeader: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
    },
    zoomHeaderTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0A192F'
    },
    zoomCloseBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    zoomQrBox: {
        width: 260,
        height: 260,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        padding: 8
    },
    zoomMemberId: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 2,
        marginTop: 12
    },
    zoomHint: {
        fontSize: 9.5,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4
    }
});
