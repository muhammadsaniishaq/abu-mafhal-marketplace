import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { UserAvatar } from '../components/UserAvatar';
import { useAppSettings } from '../context/AppSettingsContext';

// Helper to format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount).replace('NGN', '₦');
};

// Helper for Loyalty Tier calculation
const getLoyaltyInfo = (pts) => {
    const points = pts || 0;
    if (points >= 5000) {
        return { tier: 'VIP Gold', color: '#D97706', gradient: ['#F59E0B', '#D97706'], nextTier: null, currentMin: 5000, nextMin: 5000, icon: 'shield-checkmark' };
    } else if (points >= 1500) {
        return { tier: 'Gold Platinum', color: '#F59E0B', gradient: ['#FBBF24', '#F59E0B'], nextTier: 'VIP Gold', currentMin: 1500, nextMin: 5000, icon: 'trophy' };
    } else if (points >= 500) {
        return { tier: 'Silver Elite', color: '#3B82F6', gradient: ['#60A5FA', '#3B82F6'], nextTier: 'Gold Platinum', currentMin: 500, nextMin: 1500, icon: 'ribbon' };
    } else {
        return { tier: 'Bronze Club', color: '#CD7F32', gradient: ['#FDA4AF', '#CD7F32'], nextTier: 'Silver Elite', currentMin: 0, nextMin: 500, icon: 'medal' };
    }
};

const ProfilePageInner = ({ user, onLogout, onBack, onOpenVendorRegister, onOpenAdmin, onOpenVendor, onNavigate, onUpdateUser }) => {
    const [wallet, setWallet] = useState({ balance: 0, points: 0 });
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState({ totalOrders: 0, pending: 0, spend: 0 });
    const [loading, setLoading] = useState(true);
    const [vendorApp, setVendorApp] = useState(null);
    const [driverProfile, setDriverProfile] = useState(null);
    const { settings } = useAppSettings();

    const MENU_ITEMS = [
        { icon: 'chatbubbles-outline', label: 'Messages', screen: 'ConversationsScreen', badge: 'New', color: '#3B82F6', bg: '#EFF6FF', subText: 'Chat history & messages' },
        { icon: 'bag-handle-outline', label: 'My Orders', screen: 'orders', badge: '2', color: '#8B5CF6', bg: '#F5F3FF', subText: 'Track active & past orders' },
        { icon: 'heart-outline', label: 'Wishlist', screen: 'wishlist', color: '#EC4899', bg: '#FDF2F8', subText: 'Your saved favorite items' },
        { icon: 'settings-outline', label: 'Settings', screen: 'settings', color: '#64748B', bg: '#F1F5F9', subText: 'Manage account configuration' },
        { icon: 'help-circle-outline', label: 'Help & Support', screen: 'support', color: '#10B981', bg: '#ECFDF5', subText: 'Get support & contact center' },
    ];

    useEffect(() => {
        if (user) {
            fetchProfileData();
        }
    }, [user?.id]);

    const fetchProfileData = async () => {
        try {
            setLoading(true);

            // 0. REFRESH USER DATA (Role, etc.) to ensure admin status is up to date
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (userData && onUpdateUser) {
                onUpdateUser({ ...user, ...userData });
            }

            // 1. Fetch Wallet
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (walletData) {
                // Sync: Prefer Profile points for display if they are higher, to handle lag
                const displayPoints = Math.max(walletData.points || 0, userData?.mafhal_coins || 0);
                setWallet({
                    balance: walletData.balance || 0,
                    points: displayPoints
                });
            } else {
                // Fallback for missing wallet row
                setWallet({ balance: 0, points: userData?.mafhal_coins || 0 });
            }

            // 2. Fetch Orders
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (ordersData) {
                setOrders(ordersData);

                // Calculate Stats
                const totalOrders = ordersData.length;
                const pending = ordersData.filter(o => {
                    const s = o.status?.toLowerCase();
                    return s === 'pending' || s === 'processing';
                }).length;
                const spend = ordersData.reduce((sum, order) => sum + (order.total_amount || 0), 0);

                setStats({ totalOrders, pending, spend });
            }

            // 3. Fetch Vendor Application (Safe fetch)
            try {
                const { data: appData } = await supabase
                    .from('vendor_applications')
                    .select('status')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (appData) setVendorApp(appData);
            } catch (appErr) {
                console.log("Safe App Fetch Error:", appErr);
            }

            // 4. Fetch Driver Profile
            try {
                const { data: driverData } = await supabase
                    .from('drivers')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (driverData) setDriverProfile(driverData);
            } catch (driverErr) { console.log("Driver Fetch Err", driverErr); }

        } catch (error) {
            console.log("Profile Data Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // Loyalty calculation
    const loyalty = getLoyaltyInfo(wallet.points);
    const loyaltyProgress = loyalty.nextTier
        ? Math.max(0, Math.min(1, (wallet.points - loyalty.currentMin) / (loyalty.nextMin - loyalty.currentMin)))
        : 1;

    // Helper to get status pill styles
    const getStatusTag = (status) => {
        const s = status?.toLowerCase() || '';
        if (s === 'delivered') return { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' };
        if (s === 'cancelled' || s === 'failed') return { bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' };
        return { bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B' }; // Pending, processing, etc.
    };

    // Unified Premium Dashboard shortcut renderer
    const renderDashboardShortcut = () => {
        let title = '';
        let sub = '';
        let color = '#4F46E5';
        let gradientColors = ['#4F46E5', '#3730A3'];
        let iconName = 'arrow-up-circle-outline';
        let onPress = null;

        if (user?.role === 'admin' || ['muhammadsaniisyaku3@gmail.com', 'muhammadsanish0@gmail.com', 'abumafhalhub@gmail.com'].includes(user?.email)) {
            title = 'Admin Console Active';
            sub = 'Approve vendors, monitor platform states & security configurations';
            color = '#EF4444';
            gradientColors = ['#EF4444', '#B91C1C'];
            iconName = 'shield-half-outline';
            onPress = onOpenAdmin;
        } else if (user?.role === 'vendor') {
            title = 'Vendor Control Panel';
            sub = 'Manage listings, inspect active sales, update pricing & dispatch orders';
            color = '#10B981';
            gradientColors = ['#10B981', '#065F46'];
            iconName = 'storefront-outline';
            onPress = onOpenVendor;
        } else if (user?.role === 'driver') {
            title = 'Driver Services Portal';
            sub = 'Access assigned orders, routes, delivery jobs & wallets';
            color = '#8B5CF6';
            gradientColors = ['#8B5CF6', '#6D28D9'];
            iconName = 'bicycle-outline';
            onPress = () => onNavigate('DriverDashboard');
        } else {
            const isPending = vendorApp?.status === 'pending';
            const isRejected = vendorApp?.status === 'rejected';
            title = isPending ? 'Seller Verification Pending' :
                    isRejected ? 'Application Declined' :
                    'Become a Verified Seller';
            sub = isPending ? 'Your seller credentials are under review' :
                  isRejected ? 'Application failed standards. Tap to submit again' :
                  'Set up your custom storefront and start selling immediately';
            color = isPending ? '#F59E0B' : isRejected ? '#EF4444' : '#4F46E5';
            gradientColors = isPending ? ['#F59E0B', '#D97706'] : isRejected ? ['#EF4444', '#B91C1C'] : ['#4F46E5', '#3730A3'];
            iconName = isPending ? 'time-outline' : isRejected ? 'alert-circle-outline' : 'business-outline';
            onPress = onOpenVendorRegister;
        }

        if (!onPress) return null;

        return (
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onPress}
                style={{
                    marginHorizontal: 20,
                    marginTop: 14,
                    borderRadius: 16,
                    backgroundColor: 'white',
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.08,
                    shadowRadius: 12,
                    elevation: 3,
                    borderWidth: 1.5,
                    borderColor: color + '15'
                }}
            >
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                }}>
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                            shadowColor: color,
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.2,
                            shadowRadius: 6,
                            elevation: 2
                        }}
                    >
                        <Ionicons name={iconName} size={18} color="white" />
                    </LinearGradient>

                    <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                            <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>{title}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748B', lineHeight: 14 }} numberOfLines={1}>
                            {sub}
                        </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} showsVerticalScrollIndicator={false}>
            {/* PROFILE HEADER GRADIENT */}
            <LinearGradient
                colors={['#0F172A', '#1E293B', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    paddingTop: Platform.OS === 'ios' ? 50 : 35,
                    paddingBottom: 25,
                    borderBottomLeftRadius: 28,
                    borderBottomRightRadius: 28,
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Visual Glass Ring overlay backgrounds */}
                <View style={{
                    position: 'absolute',
                    top: -40,
                    right: -40,
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    backgroundColor: 'rgba(59, 130, 246, 0.04)',
                    borderWidth: 1.5,
                    borderColor: 'rgba(255,255,255,0.02)'
                }} />

                <SafeAreaView style={{ backgroundColor: 'transparent' }}>
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingHorizontal: 20,
                        paddingVertical: 4
                    }}>
                        <TouchableOpacity
                            onPress={onBack}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Ionicons name="arrow-back" size={20} color="white" />
                        </TouchableOpacity>
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>My Profile</Text>
                        <View style={{ width: 32 }} />
                    </View>
                </SafeAreaView>

                {/* PROFILE INFO - LIVE */}
                <View style={{ alignItems: 'center', marginTop: 10 }}>
                    <View style={{ position: 'relative' }}>
                        <View style={{
                            width: 74,
                            height: 74,
                            borderRadius: 37,
                            backgroundColor: '#334155',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 3,
                            borderColor: 'rgba(255,255,255,0.2)',
                            shadowColor: '#10B981',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 8,
                            overflow: 'hidden'
                        }}>
                            <UserAvatar user={user} size={74} border="#10B981" />
                        </View>
                        {/* Elegant Verified Seal badge */}
                        <View style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            backgroundColor: '#1E293B',
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 2,
                            borderColor: '#0F172A'
                        }}>
                            <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />
                        </View>
                    </View>

                    <Text style={{ color: 'white', fontSize: 17.5, fontWeight: '800', marginTop: 10 }}>
                        {user?.fullName || user?.full_name || user?.user_metadata?.full_name || 'User'}
                    </Text>

                    {(user?.username || user?.user_metadata?.username) && (
                        <View style={{
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 10,
                            marginTop: 4
                        }}>
                            <Text style={{ color: '#CBD5E1', fontSize: 11.5, fontWeight: '600' }}>
                                @{user?.username || user?.user_metadata?.username}
                            </Text>
                        </View>
                    )}

                    {/* ROLE BADGE */}
                    <View style={{
                        backgroundColor: user?.role === 'admin' ? '#EF4444' : user?.role === 'vendor' ? '#10B981' : '#3B82F6',
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 6,
                        marginTop: 8,
                        marginBottom: 4
                    }}>
                        <Text style={{ color: 'white', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                            {user?.role || 'User'}
                        </Text>
                    </View>

                    {/* CONTACT INFO SCROLL */}
                    <View style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        columnGap: 12,
                        rowGap: 4,
                        marginTop: 6,
                        paddingHorizontal: 20
                    }}>
                        {(user?.location || user?.user_metadata?.location) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="location-outline" size={12} color="#94A3B8" />
                                <Text style={{ color: '#CBD5E1', fontSize: 11.5, marginLeft: 3 }}>
                                    {user?.location || user?.user_metadata?.location}
                                </Text>
                            </View>
                        )}

                        {(user?.phoneNumber || user?.phone_number || user?.user_metadata?.phone_number || user?.phone) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="call-outline" size={12} color="#94A3B8" />
                                <Text style={{ color: '#CBD5E1', fontSize: 11.5, marginLeft: 3 }}>
                                    {user?.phoneNumber || user?.phone_number || user?.user_metadata?.phone_number || user?.phone}
                                </Text>
                            </View>
                        )}

                        {user?.email && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="mail-outline" size={12} color="#94A3B8" />
                                <Text style={{ color: '#CBD5E1', fontSize: 11.5, marginLeft: 3 }}>
                                    {user?.email}
                                </Text>
                            </View>
                        )}
                    </View>

                    {(user?.bio || user?.user_metadata?.bio) && (
                        <Text style={{
                            color: '#94A3B8',
                            fontSize: 11.5,
                            textAlign: 'center',
                            marginTop: 10,
                            paddingHorizontal: 36,
                            lineHeight: 16
                        }}>
                            {user?.bio || user?.user_metadata?.bio}
                        </Text>
                    )}

                    {/* LOYALTY TIER PROGRESS TRACKER */}
                    <View style={{
                        width: '85%',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 14,
                        padding: 12,
                        marginTop: 14,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.06)'
                    }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Ionicons name={loyalty.icon} size={14} color={loyalty.color} />
                                <Text style={{ color: 'white', fontSize: 12.5, fontWeight: '800' }}>
                                    {loyalty.tier}
                                </Text>
                            </View>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                                paddingHorizontal: 6,
                                paddingVertical: 1.5,
                                borderRadius: 6
                            }}>
                                <Ionicons name="star" size={10} color="#FBBF24" style={{ marginRight: 3 }} />
                                <Text style={{ color: '#FBBF24', fontSize: 10.5, fontWeight: '800' }}>
                                    {wallet.points} pts
                                </Text>
                            </View>
                        </View>

                        {/* Progress Bar Track */}
                        <View style={{ height: 6, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                            <LinearGradient
                                colors={loyalty.gradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    width: `${loyaltyProgress * 100}%`,
                                    height: '100%',
                                    borderRadius: 3
                                }}
                            />
                        </View>

                        {/* Progress Helper Label */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                            <Text style={{ color: '#64748B', fontSize: 9.5, fontWeight: '600' }}>
                                {loyalty.currentMin} pts
                            </Text>
                            <Text style={{ color: '#94A3B8', fontSize: 9.5, fontWeight: '600' }}>
                                {loyalty.nextTier ? `Next milestone: ${loyalty.nextTier} (${loyalty.nextMin} pts)` : 'Maximum loyalty achieved'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* BOTTOM GLOW BORDER ACCENT */}
                <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2.5,
                    backgroundColor: loyalty.color,
                    shadowColor: loyalty.color,
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.6,
                    shadowRadius: 4,
                    elevation: 3
                }} />
            </LinearGradient>

            <View style={{ paddingHorizontal: 20, marginTop: -20 }}>
                {/* GLASSMORPHIC STATS STRIP */}
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    borderRadius: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 10,
                    elevation: 2,
                    justifyContent: 'space-around',
                    alignItems: 'center'
                }}>
                    <View style={{ alignItems: 'center' }}>
                        <Ionicons name="cart-outline" size={16} color="#64748B" style={{ marginBottom: 2 }} />
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>{stats.totalOrders}</Text>
                        <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1, fontWeight: '700', textTransform: 'uppercase' }}>Orders</Text>
                    </View>
                    <View style={{ width: 1, height: 24, backgroundColor: '#E2E8F0' }} />
                    <View style={{ alignItems: 'center' }}>
                        <Ionicons name="time-outline" size={16} color="#64748B" style={{ marginBottom: 2 }} />
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>{stats.pending}</Text>
                        <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1, fontWeight: '700', textTransform: 'uppercase' }}>Pending</Text>
                    </View>
                    <View style={{ width: 1, height: 24, backgroundColor: '#E2E8F0' }} />
                    <View style={{ alignItems: 'center' }}>
                        <Ionicons name="cash-outline" size={16} color="#64748B" style={{ marginBottom: 2 }} />
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>₦{(stats.spend / 1000).toFixed(0)}k</Text>
                        <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1, fontWeight: '700', textTransform: 'uppercase' }}>Spend</Text>
                    </View>
                </View>

                {/* PREMIUM METALLIC WALLET CARD */}
                <LinearGradient
                    colors={['#4F46E5', '#3B82F6', '#06B6D4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        marginTop: 16,
                        borderRadius: 16,
                        padding: 16,
                        position: 'relative',
                        overflow: 'hidden',
                        shadowColor: '#4F46E5',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.15,
                        shadowRadius: 14,
                        elevation: 4
                    }}
                >
                    {/* Decorative abstract curves */}
                    <View style={{
                        position: 'absolute',
                        top: -50,
                        right: -30,
                        width: 120,
                        height: 120,
                        borderRadius: 60,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                    }} />
                    <View style={{
                        position: 'absolute',
                        bottom: -30,
                        left: -20,
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                    }} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                <Ionicons name="card" size={14} color="rgba(255,255,255,0.8)" />
                                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>Mafhal Pay Balance</Text>
                            </View>
                            <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>{formatCurrency(wallet.balance)}</Text>
                        </View>
                        <View style={{
                            backgroundColor: 'rgba(255,255,255,0.15)',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.2)'
                        }}>
                            <Text style={{ color: 'white', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>GOLD TIER</Text>
                        </View>
                    </View>

                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 16,
                        borderTopWidth: 1,
                        borderColor: 'rgba(255,255,255,0.1)',
                        paddingTop: 10
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="star" size={12} color="#FBBF24" />
                            <Text style={{ color: '#FBBF24', fontSize: 11.5, fontWeight: '800' }}>{wallet.points} Points Available</Text>
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={{
                                backgroundColor: 'white',
                                paddingHorizontal: 12,
                                paddingVertical: 5.5,
                                borderRadius: 8,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4
                            }}
                            onPress={() => onNavigate('wallet')}
                        >
                            <Text style={{ color: '#1E293B', fontWeight: '800', fontSize: 11.5 }}>Manage</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* DASHBOARD ACCESS SHORTCUTS */}
                {renderDashboardShortcut()}

                {/* REFERRAL CARD */}
                {settings?.enable_affiliate !== false && (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={{
                            marginTop: 12,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderRadius: 16,
                            borderWidth: 1.5,
                            borderColor: '#10B98125',
                            borderStyle: 'dashed',
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#F0FDF4'
                        }}
                        onPress={() => onNavigate('referral')}
                    >
                        <View style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            backgroundColor: '#DCFCE7',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12
                        }}>
                            <Ionicons name="gift" size={18} color="#10B981" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Refer Friends & Earn</Text>
                            <Text style={{ fontSize: 10.5, color: '#64748B', marginTop: 1 }}>Send invitations and get 500 AMC bonus coins</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color="#A7F3D0" />
                    </TouchableOpacity>
                )}

                {/* RECENT ORDERS */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 24,
                    marginBottom: 12
                }}>
                    <View style={{ width: 3.5, height: 14, borderRadius: 2, backgroundColor: '#3B82F6', marginRight: 6 }} />
                    <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#0F172A' }}>
                        Recent Orders ({orders.length})
                    </Text>
                </View>

                {loading ? (
                    <ActivityIndicator color="#0F172A" style={{ marginTop: 20 }} />
                ) : orders.length > 0 ? (
                    orders.slice(0, 3).map((order) => {
                        const tag = getStatusTag(order.status);
                        return (
                            <TouchableOpacity
                                activeOpacity={0.8}
                                key={order.id}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: 'white',
                                    marginBottom: 10,
                                    paddingVertical: 12,
                                    paddingHorizontal: 14,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.02,
                                    shadowRadius: 6,
                                    elevation: 1
                                }}
                            >
                                <View style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    backgroundColor: '#F8FAFC',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 12,
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0'
                                }}>
                                    <Ionicons name="cube-outline" size={16} color="#64748B" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                                        #{order.id.toString().slice(0, 8).toUpperCase()}
                                    </Text>
                                    <Text style={{ fontSize: 10.5, color: '#64748B', marginTop: 1 }}>
                                        {new Date(order.created_at).toLocaleDateString()} • {order.items_count || order.items?.length || 1} items
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                                        {formatCurrency(order.total_amount)}
                                    </Text>
                                    <View style={{
                                        backgroundColor: tag.bg,
                                        paddingHorizontal: 8,
                                        paddingVertical: 2.5,
                                        borderRadius: 6,
                                        marginTop: 4,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4
                                    }}>
                                        <View style={{ width: 4.5, height: 4.5, borderRadius: 2.25, backgroundColor: tag.dot }} />
                                        <Text style={{ fontSize: 8.5, fontWeight: '800', color: tag.text, textTransform: 'uppercase' }}>
                                            {order.status}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                ) : (
                    <View style={{ alignItems: 'center', padding: 20, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ color: '#94A3B8', fontSize: 12.5 }}>No recent orders found</Text>
                    </View>
                )}

                {/* SETTINGS MENU LIST - SINGLE PREMIUM CONTAINER CARD */}
                <View style={{
                    marginTop: 18,
                    backgroundColor: 'white',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.03,
                    shadowRadius: 10,
                    elevation: 2
                }}>
                    {MENU_ITEMS.map((item, i) => (
                        <View key={i}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    paddingHorizontal: 16
                                }}
                                onPress={() => item.screen ? onNavigate(item.screen) : alert('Coming Soon')}
                            >
                                <View style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 10,
                                    backgroundColor: item.bg,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 12
                                }}>
                                    <Ionicons name={item.icon} size={18} color={item.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#1E293B' }}>
                                        {item.label}
                                    </Text>
                                    <Text style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>
                                        {item.subText}
                                    </Text>
                                </View>

                                {item.badge && (
                                    <View style={{
                                        backgroundColor: '#EF4444',
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 8,
                                        marginRight: 8
                                    }}>
                                        <Text style={{ color: 'white', fontSize: 8.5, fontWeight: '800' }}>
                                            {item.badge}
                                        </Text>
                                    </View>
                                )}

                                <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                            </TouchableOpacity>
                            {i < MENU_ITEMS.length - 1 && (
                                <View style={{ height: 1, backgroundColor: '#F1F5F9', marginLeft: 62 }} />
                            )}
                        </View>
                    ))}
                </View>

                {/* LOG OUT BUTTON */}
                <View style={{ marginTop: 18, paddingBottom: 40 }}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={{
                            backgroundColor: '#FFF5F5',
                            borderRadius: 14,
                            paddingVertical: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1.5,
                            borderColor: '#FEE2E2'
                        }}
                        onPress={onLogout}
                    >
                        <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 13.5, letterSpacing: 0.5 }}>LOG OUT ACCOUNT</Text>
                        <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
};

export const ProfilePage = (props) => {
    return <ProfilePageInner {...props} />;
};
