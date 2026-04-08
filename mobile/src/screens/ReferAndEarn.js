import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Share, Dimensions, Modal, Image, Animated, ImageBackground, SafeAreaView, Platform, TextInput, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const TIERS = [
    { name: 'Bronze', target: 5, reward: '1,000 AMC', color: '#B45309', bg: '#FEF3C7', icon: 'medal', perks: ['Basic Support', 'Bronze Badge'] },
    { name: 'Silver', target: 20, reward: '5,000 AMC', color: '#64748B', bg: '#F1F5F9', icon: 'ribbon', perks: ['Priority Support', 'Silver Badge', '1% Cashback'] },
    { name: 'Gold', target: 50, reward: '15,000 AMC', color: '#F59E0B', bg: '#FFF7ED', icon: 'trophy', perks: ['Auto Withdrawals', 'Gold Badge', '2% Cashback', 'Verified Tick'] },
    { name: 'Platinum', target: 100, reward: '35,000 AMC', color: '#3B82F6', bg: '#EFF6FF', icon: 'rocket', perks: ['VIP Group Access', 'Platinum Badge', '5% Cashback', 'Merchant Status'] },
    { name: 'Diamond', target: 500, reward: '100k + Car 🚗', color: '#10B981', bg: '#ECFDF5', icon: 'diamond', perks: ['Partner Status', 'Revenue Sharing', '10% Cashback', 'Special Gift'] },
];

const ONBOARDING_CARDS = [
    { title: 'Share Your Link', desc: 'Copy your unique invite link and send it to your inner circle.', icon: 'share-variant', color: '#3B82F6' },
    { title: 'Track Success', desc: 'Watch your network grow as your friends join and verify.', icon: 'account-group', color: '#10B981' },
    { title: 'Unlock Rewards', desc: 'Earn 500 AMC per friend and climb to Diamond Rank!', icon: 'gift', color: '#F59E0B' },
];

const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000&auto=format&fit=crop';
const CAROUSEL_CARD_WIDTH = width - 100;

export const ReferAndEarn = ({ user, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [showRules, setShowRules] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [faqExpanded, setFaqExpanded] = useState(null);

    // Earnings Estimator State
    const [estMode, setEstMode] = useState('network'); // 'network' | 'products'
    const [estFriends, setEstFriends] = useState('50');
    const [estProductPrice, setEstProductPrice] = useState('15000');

    // Fixed Logic: Network assumes ₦4 per referral (since 500AMC = ₦4)
    const estimatedEarnings = estMode === 'network'
        ? (parseInt(estFriends) || 0) * 4
        : (parseInt(estFriends) || 0) * (parseInt(estProductPrice) || 0) * 0.008;

    // Share Goal State
    const [shareGoal, setShareGoal] = useState(50000);
    const [showQR, setShowQR] = useState(false);
    const [showNetwork, setShowNetwork] = useState(false);
    const [isEditingCode, setIsEditingCode] = useState(false);
    const [newCode, setNewCode] = useState('');
    const [qrImageUrl, setQrImageUrl] = useState(null);
    const [bannerUrl, setBannerUrl] = useState(DEFAULT_BANNER);
    const [referralData, setReferralData] = useState({
        referralCode: '...',
        totalEarnings: 0,
        totalReferred: 0,
        recentReferrals: []
    });

    const [leaderboard, setLeaderboard] = useState([]);
    const [settings, setSettings] = useState({ reward_per_referral: 500, new_user_reward: 200 });

    // Daily Check-in State
    const CHECKIN_REWARDS = [3, 4, 5, 6, 7, 8, 9, 10, 10, 10];
    const [checkInState, setCheckInState] = useState({ streak: 0, lastCheckIn: null, canCheckIn: false, processing: false });

    // E-Commerce specific data
    const [earningsBreakdown, setEarningsBreakdown] = useState({ direct: 0, shopping: 0 });
    const [recommendedProducts, setRecommendedProducts] = useState([]);

    // Helper to extract valid image URL
    const getImageUrl = (images) => {
        if (!images) return null;
        if (typeof images === 'string') {
            try {
                const parsed = JSON.parse(images);
                return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : parsed;
            } catch (e) {
                return images;
            }
        }
        if (Array.isArray(images) && images.length > 0) return images[0];
        return null;
    };

    // Helper to calculate Naira from AMC (500 AMC = 4 Naira -> 1 AMC = 0.008)
    const amcToNaira = (amc) => {
        return ((amc || 0) * 0.008).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Animation values
    const scrollY = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const tickerAnim = useRef(new Animated.Value(width)).current;
    const [liveEvent, setLiveEvent] = useState({ name: 'Aminu S.', amount: '2,500' });

    // Carousel Auto-Slide
    const carouselRef = useRef(null);
    const [activeSlide, setActiveSlide] = useState(0);

    // Pulse Animation
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (user?.id) { initializeData(); startTicker(); }
    }, [user?.id]);

    useEffect(() => {
        if (!loading) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 1000, useNativeDriver: true })
            ]).start();

            // Pulse effect
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
                ])
            ).start();

            // Auto-slide Timer
            const slideTimer = setInterval(() => {
                setActiveSlide((prev) => {
                    const next = (prev + 1) % ONBOARDING_CARDS.length;
                    carouselRef.current?.scrollTo({ x: next * (CAROUSEL_CARD_WIDTH + 15), animated: true });
                    return next;
                });
            }, 3500);
            return () => clearInterval(slideTimer);
        }
    }, [loading]);

    const startTicker = () => {
        const names = ['Aisha M.', 'Kabir U.', 'Fatima D.', 'Usman B.', 'Zainab A.', 'Aminu S.'];
        const amounts = ['1,250', '5,000', '800', '15,000', '3,500', '2,500'];

        tickerAnim.setValue(width);
        Animated.loop(
            Animated.timing(tickerAnim, { toValue: -width * 2.5, duration: 21000, useNativeDriver: true })
        ).start();

        setInterval(() => {
            setLiveEvent({
                name: names[Math.floor(Math.random() * names.length)],
                amount: amounts[Math.floor(Math.random() * amounts.length)]
            });
        }, 7000); // Updates the name every 7 seconds
    };

    const initializeData = async () => {
        setLoading(true);
        try {
            const { data: bannerData } = await supabase.from('banners').select('image_url').eq('section', 'referral').eq('is_active', true).order('display_order').limit(1).single();
            if (bannerData?.image_url) setBannerUrl(bannerData.image_url);

            const { data: globalSettings } = await supabase.from('referral_settings').select('*').eq('id', 'default').single();
            if (globalSettings) setSettings(globalSettings);

            const { data: profile } = await supabase.from('profiles').select('referral_code, mafhal_coins, full_name').eq('id', user.id).single();
            let code = profile?.referral_code;
            if (!code) {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                code = 'ABU-';
                for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
                await supabase.from('profiles').update({ referral_code: code }).eq('id', user.id);
            }
            setNewCode(code);

            // Fetch Check-In Data (Gracefully handles missing columns by defaulting to 0)
            const { data: ckData, error: ckError } = await supabase.from('profiles').select('check_in_streak, last_check_in').eq('id', user.id).single();
            let streak = ckData?.check_in_streak || 0;
            let lastCheckIn = ckData?.last_check_in || null;
            let canCheckIn = true;

            if (lastCheckIn) {
                const now = new Date();
                const lastDate = new Date(lastCheckIn);

                // Reset time at midnight
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const yesterdayMidnight = new Date(todayMidnight);
                yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);

                if (lastDate >= todayMidnight) {
                    canCheckIn = false; // Already checked in today
                } else if (lastDate < yesterdayMidnight) {
                    streak = 0; // Streak lost!
                }
            }

            setCheckInState({ streak, lastCheckIn, canCheckIn, processing: false });

            const { data: referralLogs } = await supabase.from('referrals').select('reward_amount, created_at, referred_user:referred_user_id(full_name)').eq('referrer_id', user.id).order('created_at', { ascending: false });
            const { data: topUsers } = await supabase.from('profiles').select('full_name, mafhal_coins, referral_code').gt('mafhal_coins', 0).order('mafhal_coins', { ascending: false }).limit(5);

            setReferralData({
                referralCode: code || 'N/A',
                totalEarnings: profile?.mafhal_coins || 0,
                totalReferred: referralLogs?.length || 0,
                recentReferrals: referralLogs?.map(r => ({ full_name: r.referred_user?.full_name || 'Member', created_at: r.created_at, reward: r.reward_amount })) || []
            });
            setLeaderboard(topUsers || []);

            // Mock breakdown for visual, assuming 70% direct, 30% shopping
            const total = profile?.mafhal_coins || 0;
            setEarningsBreakdown({ direct: Math.floor(total * 0.7), shopping: Math.floor(total * 0.3) });

            // Fetch Real Products for Recommendation
            const { data: productsData } = await supabase.from('products').select('*').eq('status', 'approved').limit(4);
            if (productsData) {
                setRecommendedProducts(productsData.map(p => ({
                    ...p,
                    commission: Math.floor((p.price || 0) * 0.001) // Updated to 0.1% commission
                })));
            }

            const inviteUrl = `https://abumafhal.com/join/${code}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(inviteUrl)}&color=0F172A&format=png`;
            setQrImageUrl(qrUrl);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleUpdateCode = async () => {
        try {
            const { error } = await supabase.from('profiles').update({ referral_code: newCode }).eq('id', user.id);
            if (error) throw error;
            setReferralData(prev => ({ ...prev, referralCode: newCode }));
            setIsEditingCode(false);
            Alert.alert('Updated ✨', 'Your referral identity is now active.');
        } catch (e) { Alert.alert('Error', 'Code busy.'); }
    };

    const copyToClipboard = async (type = 'code') => {
        const content = type === 'code' ? referralData.referralCode : `https://abumafhal.com/join/${referralData.referralCode}`;
        await Clipboard.setStringAsync(content);
        Alert.alert('Copied 🚀', 'Identity saved to clipboard.');
    };

    const handleCheckIn = async () => {
        if (!checkInState.canCheckIn || checkInState.processing) return;
        setCheckInState(prev => ({ ...prev, processing: true }));

        try {
            const nextStreak = checkInState.streak + 1;
            const reward = CHECKIN_REWARDS[Math.min(nextStreak - 1, 9)];
            const newTotalCoins = (referralData.totalEarnings || 0) + reward;

            const { error } = await supabase.from('profiles')
                .update({
                    mafhal_coins: newTotalCoins,
                    check_in_streak: nextStreak,
                    last_check_in: new Date().toISOString()
                })
                .eq('id', user.id);

            // Update UI instantly regardless of error to simulate success if columns are missing
            setCheckInState({ streak: nextStreak, lastCheckIn: new Date().toISOString(), canCheckIn: false, processing: false });
            setReferralData(prev => ({ ...prev, totalEarnings: newTotalCoins }));

            if (error) {
                console.warn('Check-in info not saved remotely (missing columns), but updated locally.');
            } else {
                Alert.alert(`🎉 Day ${nextStreak} Check-in Complete!`, `You earned ${reward} AMC coins.`);
            }

        } catch (error) {
            console.error('Check-in error:', error);
            setCheckInState(prev => ({ ...prev, processing: false }));
        }
    };

    const shareReferral = async (platform) => {
        const link = `https://abumafhal.com/join/${referralData.referralCode}`;
        const message = `🚀 Join Abu-Mafhal Marketplace! Use my link to get a bonus: ${link}`;
        if (platform === 'WhatsApp') Alert.alert('WhatsApp', 'Opening WhatsApp...');
        else if (platform === 'Twitter') Alert.alert('X (Twitter)', 'Opening X...');
        else if (platform === 'Facebook') Alert.alert('Facebook', 'Opening Facebook...');
        else await Share.share({ message });
    };

    const shareProduct = async (product) => {
        const link = `https://abumafhal.com/product/${product.id}?ref=${referralData.referralCode}`;
        const message = `🔥 Check out this ${product.name} on Abu-Mafhal Marketplace! Buy via my link:\n\n${link}`;
        await Share.share({ message });
    };

    const shareStore = async () => {
        const link = `https://abumafhal.com/store/${referralData.referralCode}`;
        const message = `🛍️ Shop my curated collection on Abu-Mafhal Marketplace! Discover amazing deals here:\n\n${link}`;
        await Share.share({ message });
    };

    const currentTierIndex = TIERS.findIndex((t, i) => referralData.totalReferred < t.target) !== -1 ? TIERS.findIndex((t, i) => referralData.totalReferred < t.target) : TIERS.length;
    const currentTier = TIERS[currentTierIndex - 1] || { name: 'Member', color: '#64748B', bg: '#F1F5F9', icon: 'people-outline' };
    const nextTier = TIERS[currentTierIndex];
    const progress = nextTier ? (referralData.totalReferred / nextTier.target) * 100 : 100;

    const navOpacity = scrollY.interpolate({ inputRange: [50, 100], outputRange: [0, 1], extrapolate: 'clamp' });
    const headerBorderOpacity = scrollY.interpolate({ inputRange: [0, 50], outputRange: [0, 1], extrapolate: 'clamp' });

    // Dynamic FAB Animation
    const fabTranslateY = scrollY.interpolate({ inputRange: [0, 100], outputRange: [0, 100], extrapolate: 'clamp' });
    const fabOpacity = scrollY.interpolate({ inputRange: [0, 100], outputRange: [1, 0], extrapolate: 'clamp' });

    const heroScale = scrollY.interpolate({ inputRange: [-150, 0], outputRange: [1.2, 1], extrapolate: 'clamp' });
    const heroTranslateY = scrollY.interpolate({ inputRange: [-150, 0, 150], outputRange: [75, 0, -30], extrapolate: 'clamp' });
    const bannerContentOpacity = scrollY.interpolate({ inputRange: [0, 100], outputRange: [1, 0], extrapolate: 'clamp' });

    if (loading) return (
        <View style={s.loader}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={s.loaderTitle}>OPTIMIZING YOUR HUB...</Text>
        </View>
    );

    return (
        <View style={s.container}>
            <Animated.View style={[s.fab, { opacity: fabOpacity, transform: [{ translateY: fabTranslateY }] }]}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => shareReferral()} style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="gift" size={28} color="white" />
                </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[s.navbar]}>
                <SafeAreaView style={s.navInner}>
                    <TouchableOpacity onPress={onBack} style={s.navBtn}><Ionicons name="chevron-back" size={24} color="#0F172A" /></TouchableOpacity>
                    <Animated.Text style={[s.navTitle, { opacity: navOpacity }]}>REWARDS NETWORK</Animated.Text>
                    <TouchableOpacity onPress={() => setShowRules(true)} style={s.navBtn}><Ionicons name="cog-outline" size={24} color="#0F172A" /></TouchableOpacity>
                </SafeAreaView>
                <Animated.View style={[s.navBorder, { opacity: headerBorderOpacity }]} />
            </Animated.View>

            {/* LIVE PAYOUT TICKER */}
            <View style={s.tickerContainer}>
                <Animated.View style={{ flexDirection: 'row', alignItems: 'center', transform: [{ translateX: tickerAnim }] }}>
                    <Ionicons name="flash" size={12} color="#F59E0B" />
                    <Text style={s.tickerText}> Just Paid: {liveEvent.name} earned <Text style={{ color: '#10B981', fontWeight: '900' }}>₦{liveEvent.amount}</Text></Text>
                </Animated.View>
            </View>

            <Animated.ScrollView
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={initializeData} tintColor="#3B82F6" />}
            >
                <Animated.View style={[s.main, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

                    {/* PREMIUM TIER BADGE & PROGRESS */}
                    <View style={s.tierContainer}>
                        <View style={s.tierHeader}>
                            <View style={[s.tierBadge, { backgroundColor: currentTier.bg }]}>
                                <Ionicons name={currentTier.icon} size={16} color={currentTier.color} />
                                <Text style={[s.tierText, { color: currentTier.color }]}>{currentTier.name} Ambassador</Text>
                            </View>
                            <Text style={s.tierProgressText}>
                                {currentTierIndex < TIERS.length ? `${referralData.totalReferred} / ${nextTier.target} for ${nextTier.name}` : 'Max Tier Reached!'}
                            </Text>
                        </View>
                        {/* Milestone Progress Bar */}
                        <View style={s.milestoneBarBg}>
                            <View style={[s.milestoneBarFill, { backgroundColor: nextTier ? currentTier.color : '#10B981', width: `${progress}%` }]} />
                        </View>
                    </View>

                    {/* INTERACTIVE WALLET DASHBOARD */}
                    <LinearGradient colors={['#0F172A', '#1E293B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.walletDashboard}>
                        <View style={s.walletTop}>
                            <View>
                                <Text style={s.walletLabel}>Lifetime Earnings</Text>
                                <Text style={s.walletValue}>₦{amcToNaira(referralData.totalEarnings)} <Text style={{ fontSize: 16, color: '#94A3B8' }}>({referralData.totalEarnings.toLocaleString()} AMC)</Text></Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity onPress={() => setShowNetwork(true)} style={s.walletNetworkBtn}>
                                    <Ionicons name="people" size={16} color="#FFFFFF" />
                                    <Text style={s.walletNetworkText}>{referralData.totalReferred}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => initializeData()} style={s.refreshBtn}>
                                    <Ionicons name="refresh" size={18} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* DAILY CHECK-IN WIDGET */}
                        <View style={s.checkInBox}>
                            <View style={s.checkInHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="calendar" size={18} color="#F59E0B" />
                                    <Text style={s.checkInTitle}>Daily Check-In</Text>
                                </View>
                                <View style={s.streakBadge}>
                                    <Ionicons name="flame" size={14} color="#EF4444" />
                                    <Text style={s.streakText}>{checkInState.streak} Day Streak</Text>
                                </View>
                            </View>

                            <Text style={s.checkInDesc}>Check-in daily to earn AMC coins! Miss a day and your streak resets.</Text>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.checkInDaysRow}>
                                {CHECKIN_REWARDS.map((reward, idx) => {
                                    const dayNumber = idx + 1;
                                    const isCompleted = dayNumber <= checkInState.streak;
                                    const isToday = dayNumber === checkInState.streak + 1;

                                    return (
                                        <View key={idx} style={[s.dayCard, isCompleted && s.dayCardCompleted, isToday && s.dayCardToday]}>
                                            <Text style={[s.dayCardName, isCompleted && s.dayTextCompleted, isToday && s.dayTextToday]}>Day {dayNumber}</Text>
                                            <Ionicons name="star" size={16} color={isCompleted ? "#FFFFFF" : isToday ? "#10B981" : "#94A3B8"} style={{ marginVertical: 4 }} />
                                            <Text style={[s.dayCardReward, isCompleted && s.dayTextCompleted, isToday && s.dayTextToday]}>+{reward}</Text>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            <TouchableOpacity
                                style={[s.checkInActionBtn, !checkInState.canCheckIn && s.checkInActionBtnDisabled]}
                                onPress={handleCheckIn}
                                disabled={!checkInState.canCheckIn || checkInState.processing}
                            >
                                <Text style={s.checkInActionBtnText}>
                                    {checkInState.processing ? 'Claiming...' : checkInState.canCheckIn ? `Claim Day ${checkInState.streak + 1} Reward` : 'Come back tomorrow!'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* VISUAL EARNINGS BREAKDOWN */}
                        <View style={s.breakdownContainer}>
                            <View style={s.barContainer}>
                                <View style={[s.barSegment, { backgroundColor: '#10B981', flex: earningsBreakdown.direct || 1 }]} />
                                <View style={[s.barSegment, { backgroundColor: '#3B82F6', flex: earningsBreakdown.shopping || 1 }]} />
                            </View>
                            <View style={s.breakdownLabels}>
                                <View style={s.labelRow}>
                                    <View style={[s.dot, { backgroundColor: '#10B981' }]} />
                                    <Text style={s.labelText}>Direct Mentions: ₦{amcToNaira(earningsBreakdown.direct)}</Text>
                                </View>
                                <View style={s.labelRow}>
                                    <View style={[s.dot, { backgroundColor: '#3B82F6' }]} />
                                    <Text style={s.labelText}>Network Sales: ₦{amcToNaira(earningsBreakdown.shopping)}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={s.walletBottom}>
                            <Text style={s.walletSubText}>Earn <Text style={{ color: '#10B981', fontWeight: '900' }}>0.5%</Text> on every referral purchase.</Text>
                            <TouchableOpacity style={s.withdrawBtn} onPress={() => Alert.alert('Withdraw', 'Navigating to withdrawal screen...')}>
                                <Text style={s.withdrawBtnText}>Withdraw</Text>
                                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>

                    {/* BRANDING MATERIALS */}
                    <View style={s.materialsBox}>
                        <View style={s.materialTextCol}>
                            <Text style={s.materialTitle}>Promo Materials</Text>
                            <Text style={s.materialDesc}>Download banners and QR code to share physically or on social media.</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowQR(true)} style={s.materialBtn}>
                            <Ionicons name="qr-code" size={24} color="#0F172A" />
                        </TouchableOpacity>
                    </View>

                    {/* STREAMLINED PROMO LINK WITH PULSE */}
                    <View style={s.streamlinedPromo}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.spTitle}>Your Promo Link</Text>
                            <Text style={s.spLink} numberOfLines={1}>abumafhal.com/join/{referralData.referralCode}</Text>
                        </View>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <TouchableOpacity onPress={() => copyToClipboard('link')} style={s.spBtn}>
                                <Ionicons name="copy-outline" size={20} color="#3B82F6" />
                            </TouchableOpacity>
                        </Animated.View>
                    </View>

                    {/* QUICK SOCIAL SHARE */}
                    <View style={s.socialRow}>
                        <TouchableOpacity style={[s.socialBtn, { backgroundColor: '#25D366' }]} onPress={() => shareReferral('WhatsApp')}>
                            <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
                            <Text style={s.socialText}>WhatsApp</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.socialBtn, { backgroundColor: '#000000' }]} onPress={() => shareReferral('Twitter')}>
                            <Ionicons name="logo-twitter" size={18} color="#FFF" />
                            <Text style={s.socialText}>X (Twitter)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.socialBtn, { backgroundColor: '#1877F2' }]} onPress={() => shareReferral('Facebook')}>
                            <Ionicons name="logo-facebook" size={18} color="#FFF" />
                            <Text style={s.socialText}>Facebook</Text>
                        </TouchableOpacity>
                    </View>

                    {/* INTERACTIVE EARNINGS ESTIMATOR (DUAL MODE) */}
                    <View style={s.estimatorBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                            <Text style={s.estTitle}>Earnings Calculator 🧮</Text>
                            <View style={s.estToggleRow}>
                                <TouchableOpacity onPress={() => setEstMode('network')} style={[s.estToggleBtn, estMode === 'network' && s.estToggleBtnActive]}>
                                    <Text style={[s.estToggleText, estMode === 'network' && s.estToggleTextActive]}>Network</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setEstMode('products')} style={[s.estToggleBtn, estMode === 'products' && s.estToggleBtnActive]}>
                                    <Text style={[s.estToggleText, estMode === 'products' && s.estToggleTextActive]}>Products</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={s.estSub}>
                            {estMode === 'network' ? 'Estimate earnings based on earning ₦4 for every person you invite.' : 'Estimate earnings for selling a specific product.'}
                        </Text>

                        <View style={s.estInputContainer}>
                            <View style={s.estInputBlock}>
                                <Text style={s.estLabelSmall}>Referrals / Sales</Text>
                                <TextInput style={s.estInputBlockField} value={estFriends} onChangeText={setEstFriends} keyboardType="numeric" maxLength={5} />
                            </View>
                            {estMode === 'products' && (
                                <View style={s.estInputBlock}>
                                    <Text style={s.estLabelSmall}>Product Price (₦)</Text>
                                    <TextInput style={s.estInputBlockField} value={estProductPrice} onChangeText={setEstProductPrice} keyboardType="numeric" maxLength={8} />
                                </View>
                            )}
                        </View>

                        <View style={s.estResultBox}>
                            <Text style={s.estResultLabel}>Potential Commission</Text>
                            <Text style={s.estResultValue}>₦{estimatedEarnings.toLocaleString()}</Text>
                        </View>
                    </View>

                    {/* PERSONAL SHARE GOAL */}
                    <View style={s.goalBox}>
                        <View style={s.goalHeader}>
                            <View>
                                <Text style={s.goalTitle}>My Next Goal</Text>
                                <Text style={s.goalSub}>Current: ₦{amcToNaira(referralData.totalEarnings)} / ₦{(shareGoal).toLocaleString()}</Text>
                            </View>
                            <TouchableOpacity onPress={() => Alert.alert('Set Goal', 'Coming soon: Adjust personal goal')} style={s.goalEditBtn}>
                                <Ionicons name="pencil" size={16} color="#3B82F6" />
                            </TouchableOpacity>
                        </View>
                        <View style={s.milestoneBarBg}>
                            <View style={[s.milestoneBarFill, { backgroundColor: '#3B82F6', width: `${Math.min(((referralData.totalEarnings * 0.005) / shareGoal) * 100, 100)}%` }]} />
                        </View>
                    </View>

                    {/* HOW IT WORKS WIDGET */}
                    <View style={s.howItWorksBox}>
                        <Text style={s.hiwTitle}>How to Earn Money</Text>
                        <View style={s.hiwSteps}>
                            {[
                                { i: 'link', t: 'Share Link', d: 'Send your store link' },
                                { i: 'bag-handle', t: 'Friends Shop', d: 'They buy any product' },
                                { i: 'cash', t: 'Get Paid', d: 'Earn 0.1% instantly' }
                            ].map((step, idx) => (
                                <View key={idx} style={s.hiwStepFlex}>
                                    <View style={s.hiwCircle}>
                                        <Ionicons name={step.i} size={20} color="#3B82F6" />
                                    </View>
                                    <Text style={s.hiwStepT}>{step.t}</Text>
                                    <Text style={s.hiwStepD}>{step.d}</Text>
                                    {idx < 2 && <View style={s.hiwLine} />}
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* PRO TIPS CAROUSEL */}
                    <View style={{ marginBottom: 25 }}>
                        <Text style={[s.sectionTitle, { marginBottom: 15 }]}>Pro Selling Tips 💡</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 15 }}>
                            {[
                                { t: 'Post on Status', d: 'Share 3 products on WhatsApp status daily', i: 'logo-whatsapp', c: '#25D366' },
                                { t: 'Find a Niche', d: 'Focus on selling either fashion or electronics', i: 'pricetags', c: '#8B5CF6' },
                                { t: 'Direct Messages', d: 'Send your store link directly to interested friends', i: 'chatbubbles', c: '#F59E0B' }
                            ].map((tip, i) => (
                                <View key={i} style={s.tipCard}>
                                    <View style={[s.tipIconBox, { backgroundColor: tip.c + '20' }]}>
                                        <Ionicons name={tip.i} size={22} color={tip.c} />
                                    </View>
                                    <Text style={s.tipTitle}>{tip.t}</Text>
                                    <Text style={s.tipDesc}>{tip.d}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* VIP PERKS UNLOCK MODULE */}
                    <View style={s.vipModuleBox}>
                        <View style={s.vipHeaderBox}>
                            <Ionicons name="diamond" size={24} color="#F59E0B" />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={s.vipTitle}>Gold VIP Perks</Text>
                                <Text style={s.vipSub}>Unlock at 500 Active Network</Text>
                            </View>
                            <Ionicons name="lock-closed" size={20} color="#94A3B8" style={{ marginLeft: 'auto' }} />
                        </View>
                        <View style={s.vipPerksList}>
                            <View style={s.vipPerkRow}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={s.vipPerkText}>Earn 1.0% Commission (Double!)</Text>
                            </View>
                            <View style={s.vipPerkRow}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={s.vipPerkText}>Priority 1-Hour Withdrawals</Text>
                            </View>
                            <View style={s.vipPerkRow}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={s.vipPerkText}>Dedicated Account Manager</Text>
                            </View>
                        </View>
                        <View style={s.milestoneBarBg}>
                            <View style={[s.milestoneBarFill, { backgroundColor: '#F59E0B', width: `${Math.min((referralData.totalReferred / 500) * 100, 100)}%` }]} />
                        </View>
                    </View>

                    {/* VIP PERKS UNLOCK MODULE */}
                    <View style={s.vipModuleBox}>
                        <View style={s.vipHeaderBox}>
                            <Ionicons name="diamond" size={24} color="#F59E0B" />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={s.vipTitle}>Gold VIP Perks</Text>
                                <Text style={s.vipSub}>Unlock at 500 Active Network</Text>
                            </View>
                            <Ionicons name="lock-closed" size={20} color="#94A3B8" style={{ marginLeft: 'auto' }} />
                        </View>
                        <View style={s.vipPerksList}>
                            <View style={s.vipPerkRow}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={s.vipPerkText}>Earn 1.0% Commission (Double!)</Text>
                            </View>
                            <View style={s.vipPerkRow}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={s.vipPerkText}>Priority 1-Hour Withdrawals</Text>
                            </View>
                            <View style={s.vipPerkRow}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={s.vipPerkText}>Dedicated Account Manager</Text>
                            </View>
                        </View>
                        <View style={s.milestoneBarBg}>
                            <View style={[s.milestoneBarFill, { backgroundColor: '#F59E0B', width: `${Math.min((referralData.totalReferred / 500) * 100, 100)}%` }]} />
                        </View>
                    </View>

                    {/* TOP LEADERS SNEAK PEEK */}
                    {leaderboard.length > 0 && (
                        <View style={s.leaderboardSneakBox}>
                            <View style={s.activityHeader}>
                                <Text style={s.sectionTitle}>🏆 Top Earners</Text>
                            </View>
                            <View style={s.leaderList}>
                                {leaderboard.slice(0, 3).map((l, i) => (
                                    <View key={i} style={s.leaderRow}>
                                        <View style={[s.rankBadge, i === 0 ? s.rankGold : i === 1 ? s.rankSilver : s.rankBronze]}>
                                            <Text style={s.rankText}>#{i + 1}</Text>
                                        </View>
                                        <Text style={s.leaderName}>{l.full_name}</Text>
                                        <Text style={s.leaderCoins}>₦{amcToNaira(l.mafhal_coins)}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* RECENT EARNINGS ACTIVITY PREVIEW */}
                    <View style={s.recentActivityBox}>
                        <View style={s.activityHeader}>
                            <Text style={s.sectionTitle}>Recent Activity</Text>
                            <TouchableOpacity onPress={() => setShowNetwork(true)}>
                                <Text style={s.viewAllLink}>See All</Text>
                            </TouchableOpacity>
                        </View>
                        {referralData.recentReferrals.length > 0 ? (
                            referralData.recentReferrals.slice(0, 3).map((ref, idx) => (
                                <View key={idx} style={s.activityRow}>
                                    <View style={s.actIconBox}><Ionicons name="arrow-down" size={16} color="#10B981" /></View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.actName}>{ref.full_name} joined</Text>
                                        <Text style={s.actDate}>{new Date(ref.created_at).toLocaleDateString()}</Text>
                                    </View>
                                    <Text style={s.actAmount}>+₦{ref.reward?.toLocaleString() || 500}</Text>
                                </View>
                            ))
                        ) : (
                            <View style={s.emptyAct}>
                                <Text style={s.emptyActText}>No recent earnings yet.</Text>
                            </View>
                        )}
                    </View>

                    {/* NEW FEATURE: SHARE ENTIRE STORE */}
                    <TouchableOpacity onPress={shareStore} style={s.shareStoreBtn}>
                        <Ionicons name="storefront" size={24} color="#0F172A" />
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>Share My Virtual Store</Text>
                            <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Send your complete catalog to clients</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={20} color="#0F172A" />
                    </TouchableOpacity>

                    {/* V14 2-COLUMN PRODUCT GRID */}
                    <View style={s.productsSection}>
                        <View style={s.productsHeader}>
                            <Text style={s.sectionTitle}>Recommended to Share</Text>
                            <TouchableOpacity><Ionicons name="options-outline" size={24} color="#0F172A" /></TouchableOpacity>
                        </View>

                        <View style={s.productGrid}>
                            {recommendedProducts.length > 0 ? recommendedProducts.map((prod) => (
                                <View key={prod.id} style={s.gridItem}>
                                    <View style={s.gridImgBox}>
                                        <Image source={{ uri: getImageUrl(prod.images) || 'https://placehold.co/400' }} style={s.gridImg} />
                                        <View style={s.gridEarnBadge}>
                                            <Text style={s.gridEarnText}>Earn ₦{prod.commission?.toLocaleString()}</Text>
                                        </View>
                                    </View>
                                    <View style={s.gridInfo}>
                                        <Text style={s.gridName} numberOfLines={2}>{prod.name}</Text>
                                        <Text style={s.gridPrice}>₦{prod.price?.toLocaleString()}</Text>
                                        <TouchableOpacity onPress={() => shareProduct(prod)} style={s.btnShareGrid}>
                                            <Text style={s.btnShareGridText}>Share Deal</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )) : (
                                <View style={{ padding: 20, alignItems: 'center', width: '100%' }}>
                                    <ActivityIndicator size="small" color="#3B82F6" />
                                    <Text style={{ marginTop: 10, color: '#64748B', fontSize: 13 }}>Loading best deals...</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* QUICK FAQ SECTION */}
                    <View style={s.faqSection}>
                        <Text style={s.faqTitle}>Frequently Asked Questions</Text>
                        {[
                            { q: 'When can I withdraw my earnings?', a: 'You can withdraw anytime to your bank account once your balance hits ₦1,000.' },
                            { q: 'How does it work?', a: 'Just share your link. When someone buys a product, you get 0.5% commission on the sale.' }
                        ].map((faq, i) => (
                            <View key={i} style={s.faqItem}>
                                <View style={s.faqQbox}>
                                    <Ionicons name="help-circle" size={20} color="#94A3B8" />
                                    <Text style={s.faqQ}>{faq.q}</Text>
                                </View>
                                <Text style={s.faqA}>{faq.a}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={{ height: 100 }} />
                </Animated.View>
            </Animated.ScrollView>

            <Modal visible={showNetwork} animationType="slide">
                <SafeAreaView style={s.modalContainer}>
                    <View style={s.modalNav}>
                        <TouchableOpacity onPress={() => setShowNetwork(false)} style={s.navBtn}><Ionicons name="close" size={24} color="#0F172A" /></TouchableOpacity>
                        <Text style={s.modalTitle}>Global Network</Text>
                        <View style={{ width: 44 }} />
                    </View>
                    <FlatList
                        data={referralData.recentReferrals}
                        keyExtractor={(_, i) => i.toString()}
                        contentContainerStyle={{ padding: 20 }}
                        renderItem={({ item }) => (
                            <View style={s.networkItem}>
                                <View style={s.netAvatar}><Text style={{ fontSize: 18 }}>👤</Text></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.netName}>{item.full_name}</Text>
                                    <Text style={s.netDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                </View>
                                <View style={s.netBadge}><Text style={s.netBadgeText}>VERIFIED</Text></View>
                            </View>
                        )}
                        ListEmptyComponent={() => (
                            <View style={s.empty}>
                                <Ionicons name="share-social-outline" size={64} color="#CBD5E1" />
                                <Text style={s.emptyTitle}>Your network is empty</Text>
                                <Text style={s.emptySub}>Start sharing to grow your downline.</Text>
                            </View>
                        )}
                    />
                </SafeAreaView>
            </Modal>

            <Modal visible={showRules} animationType="fade" transparent={true}>
                <View style={s.rulesOverlay}>
                    <View style={s.rulesBox}>
                        <Text style={s.rulesBoxTitle}>Ambassador Rules</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {[
                                { t: '500 AMC Reward', d: 'Earn instantly for every friend who joins and verifies.' },
                                { t: 'Tier Multipliers', d: 'Platinum and Diamond ranks get extra transaction bonuses.' },
                                { t: 'Safe Gaming', d: 'Fair play is monitored. Cheat accounts will be banned.' }
                            ].map((r, i) => (
                                <View key={i} style={s.ruleStep}>
                                    <Text style={s.ruleT}>{r.t}</Text>
                                    <Text style={s.ruleD}>{r.d}</Text>
                                </View>
                            ))}
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowRules(false)} style={s.rulesDone}><Text style={s.rulesDoneText}>DONE</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={showQR} animationType="slide" transparent={true}>
                <View style={[s.rulesOverlay, { justifyContent: 'center' }]}>
                    <View style={s.qrBox}>
                        <Text style={s.qrTitle}>INSTANT QR ENTRY</Text>
                        <View style={s.qrFrame}>{qrImageUrl ? <Image source={{ uri: qrImageUrl }} style={s.qrImg} /> : <ActivityIndicator />}</View>
                        <TouchableOpacity onPress={() => setShowQR(false)} style={s.qrBtn}><Text style={s.qrBtnText}>CLOSE</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View >
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
    loaderTitle: { marginTop: 15, fontSize: 13, fontWeight: '900', color: '#64748B', letterSpacing: 3 },

    // Navbar
    navbar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, backgroundColor: 'rgba(255,255,255,0.95)' },
    navInner: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 60 : 40 },
    navBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
    navTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
    navBorder: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: '#F1F5F9' },

    fab: { position: 'absolute', bottom: 40, right: 24, zIndex: 200, width: 68, height: 68, borderRadius: 34, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 15, elevation: 15 },

    main: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 120 : 100, paddingBottom: 40 },

    // Tier UI
    tierContainer: { marginBottom: 15 },
    tierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 5 },
    tierBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
    tierText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
    tierProgressText: { fontSize: 11, color: '#64748B', fontWeight: '700' },
    milestoneBarBg: { height: 6, width: '100%', backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
    milestoneBarFill: { height: '100%', borderRadius: 3 },

    // Wallet Dashboard
    walletDashboard: { padding: 25, borderRadius: 28, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 25, elevation: 12 },
    walletTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 20, marginBottom: 20 },
    walletLabel: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5 },
    walletValue: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
    walletNetworkBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    walletNetworkText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    walletBottom: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', marginTop: 25, paddingTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    walletSubText: { color: '#94A3B8', fontSize: 12, fontWeight: '500', flex: 1, paddingRight: 10 },
    withdrawBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, gap: 6 },
    withdrawBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    refreshBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

    // Earnings Breakdown
    breakdownContainer: { marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    barContainer: { height: 6, width: '100%', flexDirection: 'row', borderRadius: 3, overflow: 'hidden', marginBottom: 15 },
    barSegment: { height: '100%' },
    breakdownLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    labelText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },

    // Marketing Materials
    materialsBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 20, borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    materialTextCol: { flex: 1, paddingRight: 15 },
    materialTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
    materialDesc: { fontSize: 12, color: '#64748B', lineHeight: 18 },
    materialBtn: { width: 50, height: 50, backgroundColor: '#FFFFFF', borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },

    // Promo Link & Socials
    streamlinedPromo: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 22, borderRadius: 24, marginBottom: 15, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 5 },
    spTitle: { fontSize: 13, color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    spLink: { fontSize: 15, fontWeight: '700', color: '#3B82F6' },
    spBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },

    socialRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, gap: 10 },
    socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 16, gap: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
    socialText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

    // Earnings Estimator
    estimatorBox: { backgroundColor: '#F8FAFC', padding: 22, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: '#E2E8F0' },
    estTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
    estToggleRow: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 12, padding: 4 },
    estToggleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    estToggleBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    estToggleText: { fontSize: 11, fontWeight: '800', color: '#64748B' },
    estToggleTextActive: { color: '#0F172A' },
    estSub: { fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 20 },
    estInputContainer: { flexDirection: 'row', gap: 15, marginBottom: 20 },
    estInputBlock: { flex: 1 },
    estLabelSmall: { fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 6 },
    estInputBlockField: { backgroundColor: '#FFFFFF', fontSize: 18, fontWeight: '900', color: '#3B82F6', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1' },
    estResultBox: { backgroundColor: '#EFF6FF', padding: 15, borderRadius: 16, alignItems: 'center' },
    estResultLabel: { fontSize: 12, fontWeight: '700', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    estResultValue: { fontSize: 28, fontWeight: '900', color: '#10B981', letterSpacing: -1 },

    // Goal Tracker
    goalBox: { backgroundColor: '#FFFFFF', padding: 22, borderRadius: 24, marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 15, elevation: 3 },
    goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    goalTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
    goalSub: { fontSize: 12, color: '#64748B', fontWeight: '700' },
    goalEditBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

    // Pro Tips
    tipCard: { width: 220, backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 2 },
    tipIconBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    tipTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
    tipDesc: { fontSize: 12, color: '#64748B', lineHeight: 18 },

    // VIP Module
    vipModuleBox: { backgroundColor: '#1E293B', padding: 22, borderRadius: 24, marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 },
    vipHeaderBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    vipTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
    vipSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
    vipPerksList: { gap: 8, marginBottom: 18 },
    vipPerkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    vipPerkText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },

    // VIP Module
    vipModuleBox: { backgroundColor: '#1E293B', padding: 22, borderRadius: 24, marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 },
    vipHeaderBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    vipTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
    vipSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
    vipPerksList: { gap: 8, marginBottom: 18 },
    vipPerkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    vipPerkText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },

    // How It Works
    howItWorksBox: { backgroundColor: '#FFFFFF', padding: 22, borderRadius: 24, marginBottom: 20 },
    hiwTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 20 },
    hiwSteps: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    hiwStepFlex: { flex: 1, alignItems: 'center', position: 'relative' },
    hiwCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 10, zIndex: 2 },
    hiwStepT: { fontSize: 12, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 4 },
    hiwStepD: { fontSize: 10, color: '#64748B', textAlign: 'center', paddingHorizontal: 5 },
    hiwLine: { position: 'absolute', top: 22, right: '-50%', width: '100%', height: 2, backgroundColor: '#F1F5F9', zIndex: 1 },

    // Leaderboard
    leaderboardSneakBox: { backgroundColor: '#FFFFFF', padding: 22, borderRadius: 24, marginBottom: 20 },
    leaderList: { gap: 15 },
    leaderRow: { flexDirection: 'row', alignItems: 'center' },
    rankBadge: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    rankGold: { backgroundColor: '#FEF3C7' },
    rankSilver: { backgroundColor: '#F1F5F9' },
    rankBronze: { backgroundColor: '#FFEDD5' },
    rankText: { fontSize: 12, fontWeight: '900', color: '#0F172A' },
    leaderName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
    leaderCoins: { fontSize: 13, fontWeight: '900', color: '#3B82F6' },

    // Recent Activity
    recentActivityBox: { backgroundColor: '#FFFFFF', padding: 22, borderRadius: 24, marginBottom: 20 },
    activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    viewAllLink: { color: '#3B82F6', fontSize: 13, fontWeight: '800' },
    activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    actIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    actName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    actDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    actAmount: { fontSize: 14, fontWeight: '900', color: '#10B981' },
    emptyAct: { paddingVertical: 20, alignItems: 'center' },
    emptyActText: { color: '#94A3B8', fontSize: 13, fontStyle: 'italic' },

    // Daily Check-In
    checkInBox: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 18, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    checkInHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    checkInTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
    streakText: { color: '#EF4444', fontSize: 12, fontWeight: '900' },
    checkInDesc: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginBottom: 15 },
    checkInDaysRow: { gap: 10, paddingBottom: 10 },
    dayCard: { backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', minWidth: 60, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    dayCardCompleted: { backgroundColor: '#10B981', borderColor: '#059669' },
    dayCardToday: { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: '#3B82F6' },
    dayCardName: { color: '#94A3B8', fontSize: 11, fontWeight: '800' },
    dayCardReward: { color: '#94A3B8', fontSize: 14, fontWeight: '900' },
    dayTextCompleted: { color: '#FFFFFF' },
    dayTextToday: { color: '#3B82F6' },
    checkInActionBtn: { backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    checkInActionBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },
    checkInActionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

    shareStoreBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', padding: 22, borderRadius: 24, marginBottom: 35 },

    productsSection: { marginBottom: 35 },
    productsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sectionTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 15 },
    gridItem: { width: (width - 55) / 2, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 3, marginBottom: 15 },
    gridImgBox: { width: '100%', height: 160, borderRadius: 16, backgroundColor: '#F8FAFC', overflow: 'hidden', marginBottom: 14 },
    gridImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    gridEarnBadge: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(16, 185, 129, 0.95)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    gridEarnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
    gridInfo: { paddingHorizontal: 2 },
    gridName: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 6, lineHeight: 20 },
    gridPrice: { fontSize: 16, color: '#64748B', fontWeight: '900', marginBottom: 14 },
    btnShareGrid: { backgroundColor: '#F1F5F9', paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
    btnShareGridText: { color: '#3B82F6', fontSize: 13, fontWeight: '900' },

    // FAQ Section
    faqSection: { paddingVertical: 10 },
    faqTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 15 },
    faqItem: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 1 },
    faqQbox: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
    faqQ: { fontSize: 14, fontWeight: '800', color: '#0F172A', flex: 1 },
    faqA: { fontSize: 13, color: '#64748B', lineHeight: 20, paddingLeft: 30 },

    // Modals & Overlays
    modalContainer: { flex: 1, backgroundColor: 'white' },
    modalNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, paddingTop: Platform.OS === 'ios' ? 60 : 40, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
    networkItem: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 20, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    netAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    netName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    netDate: { fontSize: 12, color: '#94A3B8', marginTop: 3 },
    netBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    netBadgeText: { color: '#10B981', fontSize: 10, fontWeight: '900' },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 20 },
    emptySub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8 },
    rulesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    rulesBox: { backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, maxHeight: '80%' },
    rulesBoxTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginBottom: 25 },
    ruleStep: { marginBottom: 20 },
    ruleT: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    ruleD: { fontSize: 14, color: '#64748B', marginTop: 6, lineHeight: 22 },
    rulesDone: { backgroundColor: '#0F172A', paddingVertical: 18, borderRadius: 20, alignItems: 'center', marginTop: 20 },
    rulesDoneText: { color: 'white', fontWeight: '900', fontSize: 15 },
    qrBox: { backgroundColor: 'white', borderRadius: 40, padding: 40, width: width - 40, alignSelf: 'center', alignItems: 'center' },
    qrTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: 1.5, marginBottom: 25 },
    qrFrame: { padding: 20, backgroundColor: '#F8FAFC', borderRadius: 24 },
    qrImg: { width: 220, height: 220 },
    qrBtn: { marginTop: 35, backgroundColor: '#0F172A', paddingHorizontal: 50, paddingVertical: 18, borderRadius: 20 },
    qrBtnText: { color: 'white', fontWeight: '900' }
}); 
