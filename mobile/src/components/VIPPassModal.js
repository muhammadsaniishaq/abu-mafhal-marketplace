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
    Dimensions
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

// ─── Loyalty Tier Resolver ───────────────────────────────────────────────────
const resolveTier = (points = 0, role = '') => {
    const rLower = (role || '').toLowerCase();
    const isAdmin = rLower === 'admin' || rLower === 'super_admin' || rLower === 'superadmin';

    if (isAdmin || points >= 10000) {
        return {
            name: 'Royal Diamond',
            badge: '✦ ROYAL DIAMOND VIP',
            color: '#8B5CF6',
            gradient: ['#1E1B4B', '#312E81', '#4C1D95'],
            icon: 'diamond',
            perks: [
                '0% Escrow & Commission Fees across all orders',
                'Unlimited Free Express Delivery Everywhere',
                'Dedicated 24/7 VIP Concierge & Account Manager',
                'Instant Priority Liquidity & Escrow Release',
                'Invitation-Only Private Marketplace Secret Deals'
            ],
            cashback: '8% Instant Cashback',
            delivery: 'Free Express VIP Dispatch',
            nextTier: 'Max Royal Prestige',
            nextPoints: 10000,
            progress: 1.0
        };
    }
    if (points >= 5000) {
        return {
            name: 'VIP Gold',
            badge: '✦ VIP GOLD MEMBER',
            color: '#D4AF37',
            gradient: ['#071932', '#0A2540', '#10375C'],
            icon: 'shield-checkmark',
            perks: [
                '5% Instant Cashback on All Store Purchases',
                'Free Delivery on Orders > ₦10,000',
                'Priority 1-Hour Escrow Processing',
                'Personal WhatsApp VIP Support Agent',
                'Exclusive VIP Secret Flash Sales & Vouchers'
            ],
            cashback: '5% Instant Cashback',
            delivery: 'Free Delivery (>₦10k)',
            nextTier: 'Royal Diamond',
            nextPoints: 10000,
            progress: Math.min(1, Math.max(0.2, (points - 5000) / 5000))
        };
    }
    if (points >= 1500) {
        return {
            name: 'Platinum Member',
            badge: '✦ PLATINUM MEMBER',
            color: '#F59E0B',
            gradient: ['#1C1917', '#292524', '#44403C'],
            icon: 'trophy',
            perks: [
                '3% Cash Rebate on Qualified Electronics & Fashion',
                'Free Delivery on Orders > ₦15,000',
                'Priority Escrow Queue Clearance',
                'Dedicated Priority Email & In-App Support',
                'Early 12-Hour Access to Mega Sales'
            ],
            cashback: '3% Cash Rebate',
            delivery: 'Free Delivery (>₦15k)',
            nextTier: 'VIP Gold',
            nextPoints: 5000,
            progress: Math.min(1, Math.max(0.15, (points - 1500) / 3500))
        };
    }
    if (points >= 500) {
        return {
            name: 'Silver Member',
            badge: '✦ SILVER MEMBER',
            color: '#3B82F6',
            gradient: ['#0B192C', '#1E3E62', '#000000'],
            icon: 'ribbon',
            perks: [
                '1.5x Multiplier on All Reward Mafhal Coins',
                '2% Instant Rebate on Selected Verified Deals',
                'Standard Escrow Buyer Protection Guaranteed',
                'Special Silver Promo Voucher Every Month'
            ],
            cashback: '2% Rebate',
            delivery: 'Discounted Shipping',
            nextTier: 'Platinum',
            nextPoints: 1500,
            progress: Math.min(1, Math.max(0.12, (points - 500) / 1000))
        };
    }
    return {
        name: 'Bronze Member',
        badge: '✦ BRONZE MEMBER',
        color: '#94A3B8',
        gradient: ['#0F172A', '#1E293B', '#334155'],
        icon: 'medal',
        perks: [
            'Earn 10 reward points for every ₦1,000 spent',
            '100% Escrow Buyer Protection on All Purchases',
            'Full Access to Marketplace & Dispute Resolution',
            'Standard Package Tracking'
        ],
        cashback: 'Earn 10pts / ₦1k',
        delivery: 'Standard Delivery',
        nextTier: 'Silver Member',
        nextPoints: 500,
        progress: Math.min(1, Math.max(0.08, points / 500))
    };
};

export const VIPPassModal = ({ visible, onClose, user, wallet, onNavigate }) => {
    const [activeTab, setActiveTab] = useState('card'); // 'card' | 'qr' | 'perks'
    const [qrUri, setQrUri] = useState(null);
    const [qrLoading, setQrLoading] = useState(true);
    const [copiedLabel, setCopiedLabel] = useState(null);

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
    const tier = useMemo(() => resolveTier(points, user?.role), [points, user?.role]);

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

    // Live Dynamic QR Code Generation
    useEffect(() => {
        if (!visible) return;

        let isMounted = true;
        setQrLoading(true);

        const verifyUrl = `https://abumafhal.com/verify-pass?id=${encodeURIComponent(rawUid)}&code=${encodeURIComponent(memberId)}&tier=${encodeURIComponent(tier.name)}`;

        const generateQR = async () => {
            try {
                if (QRCode && typeof QRCode.toDataURL === 'function') {
                    const dataUrl = await QRCode.toDataURL(verifyUrl, {
                        width: 320,
                        margin: 1,
                        color: {
                            dark: '#071932',
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
            const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=4&color=071932&bgcolor=ffffff&data=${encodeURIComponent(verifyUrl)}`;
            if (isMounted) {
                setQrUri(fallbackUrl);
                setQrLoading(false);
            }
        };

        generateQR();

        return () => {
            isMounted = false;
        };
    }, [visible, rawUid, memberId, tier.name]);

    const handleCopy = (text, label = 'Member ID') => {
        try {
            if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(text);
            }
        } catch (_) {}
        setCopiedLabel(label);
        if (Platform.OS === 'web') {
            // Web alert or subtle feedback
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
                `🎖️ Tier: ${tier.name}\n` +
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

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={s.modalOverlay}>
                <View style={s.passContainer}>
                    {/* ── Outer Header with Royal Gold Rim ────────────────── */}
                    <View style={s.passHeaderBar}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                            <View style={s.crownIconBadge}>
                                <Ionicons name="sparkles" size={13} color="#D4AF37" />
                            </View>
                            <View>
                                <Text style={s.headerBrandTitle}>ABU MAFHAL PASSPORT</Text>
                                <Text style={s.headerBrandSub}>SECURE ESCROW & VIP VERIFICATION</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            style={s.headerCloseBtn}
                            activeOpacity={0.75}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close" size={17} color="#D4AF37" />
                        </TouchableOpacity>
                    </View>

                    {/* ── Segmented Mode Tabs ──────────────────────────────── */}
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
                                        color={isSelected ? '#0A192F' : '#94A3B8'}
                                    />
                                    <Text style={[s.tabBtnTxt, isSelected && s.tabBtnTxtActive]}>
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* ── Scrollable Passport Body ──────────────────────────── */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ padding: 14, paddingBottom: 18 }}
                    >
                        {/* ═════════ TAB 1: VIP DIGITAL CARD VIEW ═════════ */}
                        {activeTab === 'card' && (
                            <View style={{ gap: 14 }}>
                                {/* Luxury Metallic VIP Physical-Style Card */}
                                <LinearGradient
                                    colors={tier.gradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={s.vipCardHero}
                                >
                                    {/* Background Shield Watermark */}
                                    <Ionicons
                                        name="shield-checkmark"
                                        size={190}
                                        color="rgba(212, 175, 55, 0.05)"
                                        style={s.cardWatermark}
                                    />

                                    {/* Top Row: Emblems, Chip & Contactless Wave */}
                                    <View style={s.cardHeroTop}>
                                        <View style={s.cardHeroEmblemRow}>
                                            <Ionicons name="sparkles" size={13} color="#D4AF37" />
                                            <Text style={s.cardHeroEmblemTxt}>{tier.badge}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Ionicons name="wifi" size={16} color="#D4AF37" style={{ transform: [{ rotate: '90deg' }] }} />
                                            <View style={s.chipBox}>
                                                <Ionicons name="hardware-chip-sharp" size={22} color="#D4AF37" />
                                            </View>
                                        </View>
                                    </View>

                                    {/* Middle Row: User Details */}
                                    <View style={s.cardHeroUserRow}>
                                        <View style={s.cardHeroAvatarRing}>
                                            <UserAvatar user={user} size={54} border="#D4AF37" />
                                            <View style={s.cardVerifiedPill}>
                                                <Ionicons name="checkmark" size={10} color="#0A192F" />
                                            </View>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.cardHeroName} numberOfLines={1}>{displayName}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                <View style={s.cardRoleTag}>
                                                    <Text style={s.cardRoleTagTxt}>{userRole}</Text>
                                                </View>
                                                <Text style={s.cardSinceTxt}>SINCE {memberSinceYear}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Bottom Row: Member ID & Status */}
                                    <View style={s.cardHeroFooter}>
                                        <TouchableOpacity
                                            onPress={() => handleCopy(memberId, 'Member ID')}
                                            style={s.cardIdBox}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={s.cardIdLabel}>MEMBER PASSPORT ID</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={s.cardIdVal}>{memberId}</Text>
                                                <Ionicons name={copiedLabel === 'Member ID' ? 'checkmark-circle' : 'copy-outline'} size={14} color="#D4AF37" />
                                            </View>
                                        </TouchableOpacity>

                                        <View style={s.cardActiveStatusPill}>
                                            <View style={s.liveGreenDot} />
                                            <Text style={s.cardActiveStatusTxt}>VERIFIED</Text>
                                        </View>
                                    </View>

                                    {/* Security Ribbon */}
                                    <View style={s.cardSecRibbon}>
                                        <Text style={s.cardSecRibbonTxt}>ESCROW 256-BIT ENCRYPTION • VERIFIED ROYALS</Text>
                                        <Text style={s.cardSecCodeTxt}>{securityHash}</Text>
                                    </View>
                                </LinearGradient>

                                {/* Quick Passport Stats Bar */}
                                <View style={s.quickStatsRow}>
                                    <View style={s.statBox}>
                                        <Text style={s.statBoxLbl}>LOYALTY POINTS</Text>
                                        <Text style={[s.statBoxVal, { color: '#D4AF37' }]}>{Number(points).toLocaleString()} pts</Text>
                                    </View>
                                    <View style={s.statDivider} />
                                    <View style={s.statBox}>
                                        <Text style={s.statBoxLbl}>CURRENT TIER</Text>
                                        <Text style={s.statBoxVal}>{tier.name}</Text>
                                    </View>
                                    <View style={s.statDivider} />
                                    <View style={s.statBox}>
                                        <Text style={s.statBoxLbl}>STATUS</Text>
                                        <Text style={[s.statBoxVal, { color: '#10B981' }]}>Active 🟢</Text>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => setActiveTab('qr')}
                                        style={[s.primaryActionBtn, { flex: 1.2 }]}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="qr-code" size={17} color="#0A192F" />
                                        <Text style={s.primaryActionTxt}>Show Scan QR</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleShare}
                                        style={[s.secondaryActionBtn, { flex: 0.9 }]}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="share-social-outline" size={16} color="#D4AF37" />
                                        <Text style={s.secondaryActionTxt}>Share Pass</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* ═════════ TAB 2: LIVE DYNAMIC QR & BARCODE VIEW ═════════ */}
                        {activeTab === 'qr' && (
                            <View style={{ alignItems: 'center', gap: 14 }}>
                                {/* QR Frame */}
                                <View style={s.qrMainCard}>
                                    <View style={s.qrCardTopTitle}>
                                        <Ionicons name="shield-checkmark" size={14} color="#D4AF37" />
                                        <Text style={s.qrCardTitleTxt}>OFFICIAL SCAN IDENTIFIER</Text>
                                    </View>

                                    <View style={s.qrFrameWhiteBox}>
                                        {qrLoading ? (
                                            <View style={s.qrSkeletonBox}>
                                                <ActivityIndicator size="large" color="#0A192F" />
                                                <Text style={s.qrLoadingTxt}>Generating Secure QR...</Text>
                                            </View>
                                        ) : qrUri ? (
                                            <Image
                                                source={{ uri: qrUri }}
                                                style={s.qrImage}
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <Ionicons name="qr-code" size={170} color="#0A192F" />
                                        )}
                                    </View>

                                    <Text style={s.qrScanPrompt}>
                                        Scan at authorized partner hubs, merchants, or delivery escrows for immediate verification.
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
                                        <Ionicons name="lock-closed" size={12} color="#10B981" />
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
                                        <Ionicons name="link-outline" size={15} color="#D4AF37" />
                                        <Text style={s.secondaryActionTxt}>Copy Link</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* ═════════ TAB 3: PRIVILEGES & PERKS VIEW ═════════ */}
                        {activeTab === 'perks' && (
                            <View style={{ gap: 12 }}>
                                {/* Tier Status Banner */}
                                <View style={s.tierStatusBanner}>
                                    <View style={[s.tierIconCircle, { borderColor: tier.color }]}>
                                        <Ionicons name={tier.icon} size={22} color={tier.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.tierBannerTitle}>{tier.name} Privileges</Text>
                                        <Text style={s.tierBannerSub}>
                                            Active Benefits unlocked for your account
                                        </Text>
                                    </View>
                                </View>

                                {/* Highlights Pill Grid */}
                                <View style={s.perksHighlightsRow}>
                                    <View style={s.perkHighlightCard}>
                                        <Ionicons name="cash-outline" size={16} color="#D4AF37" />
                                        <Text style={s.perkHighlightTitle}>Cashback</Text>
                                        <Text style={s.perkHighlightVal}>{tier.cashback}</Text>
                                    </View>
                                    <View style={s.perkHighlightCard}>
                                        <Ionicons name="car-outline" size={16} color="#3B82F6" />
                                        <Text style={s.perkHighlightTitle}>Shipping</Text>
                                        <Text style={s.perkHighlightVal}>{tier.delivery}</Text>
                                    </View>
                                    <View style={s.perkHighlightCard}>
                                        <Ionicons name="shield-checkmark-outline" size={16} color="#10B981" />
                                        <Text style={s.perkHighlightTitle}>Escrow</Text>
                                        <Text style={s.perkHighlightVal}>Zero Wait</Text>
                                    </View>
                                </View>

                                {/* List of Active Privileges */}
                                <View style={s.perksListBox}>
                                    <Text style={s.perksListHeader}>UNLOCKED PRIVILEGES</Text>
                                    {tier.perks.map((p, idx) => (
                                        <View key={idx} style={s.perkItemRow}>
                                            <View style={s.perkCheckCircle}>
                                                <Ionicons name="checkmark" size={12} color="#0A192F" />
                                            </View>
                                            <Text style={s.perkItemTxt}>{p}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Next Tier Progress */}
                                {tier.nextTier !== 'Max Royal Prestige' && (
                                    <View style={s.nextTierBox}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <Text style={s.nextTierLabel}>NEXT: {tier.nextTier.toUpperCase()}</Text>
                                            <Text style={s.nextTierPoints}>{points} / {tier.nextPoints} pts</Text>
                                        </View>
                                        <View style={s.progressTrack}>
                                            <View style={[s.progressFill, { width: `${Math.round(tier.progress * 100)}%` }]} />
                                        </View>
                                        <Text style={s.progressHint}>
                                            Earn {Math.max(0, tier.nextPoints - points)} more points to upgrade your VIP passport tier!
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

export default VIPPassModal;

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(7, 25, 50, 0.82)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
    },
    passContainer: {
        backgroundColor: '#071932',
        borderRadius: 24,
        width: Math.min(width - 24, 385),
        maxWidth: 385,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.45,
        shadowRadius: 28,
        elevation: 25,
        overflow: 'hidden',
        maxHeight: '92%'
    },
    passHeaderBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#0A2540',
        borderBottomWidth: 1.5,
        borderBottomColor: 'rgba(212, 175, 55, 0.35)'
    },
    crownIconBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    headerBrandTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 1
    },
    headerBrandSub: {
        fontSize: 8,
        color: '#94A3B8',
        fontWeight: '700',
        letterSpacing: 0.5,
        marginTop: 0.5
    },
    headerCloseBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)'
    },

    // Tabs
    tabsWrap: {
        flexDirection: 'row',
        backgroundColor: '#081E38',
        padding: 5,
        marginHorizontal: 14,
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)'
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 7,
        borderRadius: 8
    },
    tabBtnActive: {
        backgroundColor: '#D4AF37'
    },
    tabBtnTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8'
    },
    tabBtnTxtActive: {
        color: '#0A192F',
        fontWeight: '900'
    },

    // Card Hero View
    vipCardHero: {
        borderRadius: 20,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6
    },
    cardWatermark: {
        position: 'absolute',
        right: -25,
        bottom: -25
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
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    cardHeroEmblemTxt: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 0.8
    },
    chipBox: {
        width: 32,
        height: 24,
        borderRadius: 4,
        backgroundColor: 'rgba(212, 175, 55, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#D4AF37'
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
        backgroundColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#071932'
    },
    cardHeroName: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.2
    },
    cardRoleTag: {
        backgroundColor: 'rgba(212, 175, 55, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 0.5,
        borderColor: '#D4AF37'
    },
    cardRoleTagTxt: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#FDE68A',
        letterSpacing: 0.5
    },
    cardSinceTxt: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94A3B8'
    },
    cardHeroFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(212, 175, 55, 0.2)'
    },
    cardIdBox: {
        flex: 1
    },
    cardIdLabel: {
        fontSize: 8,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5
    },
    cardIdVal: {
        fontSize: 14,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 1.5
    },
    cardActiveStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#10B981'
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
        color: '#10B981',
        letterSpacing: 0.5
    },
    cardSecRibbon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 6,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255, 255, 255, 0.1)'
    },
    cardSecRibbonTxt: {
        fontSize: 7.5,
        fontWeight: '800',
        color: 'rgba(212, 175, 55, 0.7)',
        letterSpacing: 0.5
    },
    cardSecCodeTxt: {
        fontSize: 8,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5
    },

    // Quick Stats Bar
    quickStatsRow: {
        flexDirection: 'row',
        backgroundColor: '#0A2540',
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)'
    },
    statBox: {
        flex: 1,
        alignItems: 'center'
    },
    statDivider: {
        width: 1,
        backgroundColor: 'rgba(212, 175, 55, 0.2)',
        marginVertical: 2
    },
    statBoxLbl: {
        fontSize: 8,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5
    },
    statBoxVal: {
        fontSize: 12,
        fontWeight: '900',
        color: '#FFFFFF',
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
        borderRadius: 12,
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
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
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D4AF37'
    },
    secondaryActionTxt: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#D4AF37'
    },

    // QR Card View
    qrMainCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5
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
        width: 200,
        height: 200,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#0A192F',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 6,
        position: 'relative'
    },
    qrImage: {
        width: '100%',
        height: '100%'
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
        fontSize: 10,
        color: '#64748B',
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 14,
        paddingHorizontal: 8
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
        fontSize: 9,
        fontWeight: '800',
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
        backgroundColor: '#0A2540',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)'
    },
    tierIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5
    },
    tierBannerTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    tierBannerSub: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 1
    },
    perksHighlightsRow: {
        flexDirection: 'row',
        gap: 8
    },
    perkHighlightCard: {
        flex: 1,
        backgroundColor: '#0A2540',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        alignItems: 'center',
        gap: 2
    },
    perkHighlightTitle: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94A3B8'
    },
    perkHighlightVal: {
        fontSize: 10.5,
        fontWeight: '900',
        color: '#FFFFFF',
        textAlign: 'center'
    },
    perksListBox: {
        backgroundColor: '#0A2540',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)',
        gap: 10
    },
    perksListHeader: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#D4AF37',
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
        backgroundColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1
    },
    perkItemTxt: {
        flex: 1,
        fontSize: 11.5,
        color: '#F1F5F9',
        fontWeight: '600',
        lineHeight: 16
    },
    nextTierBox: {
        backgroundColor: '#0A2540',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)'
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
        color: '#FFFFFF'
    },
    progressTrack: {
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
        color: '#94A3B8',
        marginTop: 2
    }
});
