import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, Image,
    ActivityIndicator, StatusBar, StyleSheet, TextInput,
    RefreshControl, Platform, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { UserAvatar } from '../components/UserAvatar';

const BRAND = {
    navy: '#0A192F',
    navyMid: '#0E2340',
    gold: '#E5A93C',
    goldDark: '#A07820',
    emerald: '#10B981',
    emeraldLight: '#ECFDF5',
    sky: '#0284C7',
    skyLight: '#E0F2FE',
    slate: '#64748B',
    slateDark: '#0F172A',
    slateLight: '#F8FAFC',
    border: '#E2E8F0',
    danger: '#EF4444',
};

export const ConversationsScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'stores' | 'support'

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        getCurrentUser();

        // Subscribe to real-time incoming messages to update conversations live!
        const channel = supabase
            .channel('public:conversations_live')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                () => {
                    if (currentUser) {
                        fetchConversations(currentUser.id, true);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id]);

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUser(user);
            fetchConversations(user.id);
        } else {
            setLoading(false);
        }
    };

    const fetchConversations = async (userId, silent = false) => {
        if (!silent) setLoading(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (data && !error) {
                const groups = {};

                data.forEach(msg => {
                    const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
                    if (!groups[partnerId]) {
                        groups[partnerId] = {
                            partnerId,
                            lastMessage: msg,
                            unreadCount: 0
                        };
                    }
                });

                const partnerIds = Object.keys(groups);
                if (partnerIds.length > 0) {
                    const [profRes, storeRes] = await Promise.all([
                        supabase.from('profiles').select('id, full_name, business_name, avatar_url, role, is_online').in('id', partnerIds),
                        supabase.from('stores').select('user_id, name, logo').in('user_id', partnerIds)
                    ]);

                    const profiles = profRes.data || [];
                    const stores = storeRes.data || [];

                    // Merge store data into profile data for the UI
                    profiles.forEach(p => {
                        const s = stores.find(st => st.user_id === p.id);
                        if (groups[p.id]) {
                            groups[p.id].partnerProfile = {
                                ...p,
                                business_name: s?.name || p.business_name,
                                avatar_url: s?.logo || p.avatar_url
                            };
                        }
                    });
                }

                const list = Object.values(groups);
                setConversations(list);
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
            }
        } catch (error) {
            console.log('Error fetching conversations:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        if (currentUser) fetchConversations(currentUser.id, true);
        else getCurrentUser();
    };

    const formatTimestamp = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Filter conversations by tab and search
    const filteredConversations = conversations.filter(item => {
        const profile = item.partnerProfile || {};
        const name = (profile.business_name || profile.full_name || 'Merchant').toLowerCase();
        const lastText = (item.lastMessage?.message || '').toLowerCase();
        const query = searchQuery.toLowerCase();

        const matchesSearch = name.includes(query) || lastText.includes(query);
        if (!matchesSearch) return false;

        if (activeTab === 'stores') {
            return profile.role === 'vendor' || profile.role === 'seller';
        }
        if (activeTab === 'support') {
            return profile.role === 'admin' || profile.role === 'support' || name.includes('support') || name.includes('admin');
        }
        return true;
    });

    const renderItem = ({ item }) => {
        const profile = item.partnerProfile || { full_name: 'Verified Merchant', avatar_url: null };
        const msg = item.lastMessage;
        const displayName = profile.business_name || profile.full_name || 'Marketplace Seller';
        const isSupport = profile.role === 'admin' || displayName.toLowerCase().includes('support');
        const isMe = msg.sender_id === currentUser?.id;
        const timeStr = formatTimestamp(msg.created_at);

        return (
            <TouchableOpacity
                style={s.convCard}
                onPress={() => navigation.navigate('ChatScreen', {
                    vendorId: item.partnerId,
                    vendorName: displayName,
                    vendorAvatar: profile.avatar_url,
                    vendorRole: profile.role || (isSupport ? 'Admin' : 'Vendor')
                })}
                activeOpacity={0.7}
            >
                {/* Avatar with Live Indicator */}
                <View style={s.avatarContainer}>
                    {profile.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
                    ) : (
                        <View style={[s.avatarFallback, isSupport && { backgroundColor: BRAND.navy }]}>
                            <Ionicons
                                name={isSupport ? "shield-checkmark" : "storefront"}
                                size={22}
                                color={isSupport ? BRAND.gold : BRAND.sky}
                            />
                        </View>
                    )}
                    <View style={[s.onlineDot, !profile.is_online && !isSupport && s.offlineDot]} />
                </View>

                {/* Conversation Details */}
                <View style={s.convInfo}>
                    <View style={s.convHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                            <Text numberOfLines={1} style={s.partnerName}>{displayName}</Text>
                            {isSupport ? (
                                <View style={s.supportBadge}>
                                    <Text style={s.supportBadgeTxt}>SUPPORT</Text>
                                </View>
                            ) : (
                                <Ionicons name="checkmark-circle" size={14} color={BRAND.sky} />
                            )}
                        </View>
                        <Text style={s.timestampTxt}>{timeStr}</Text>
                    </View>

                    <View style={s.messagePreviewRow}>
                        <Text style={s.previewTxt} numberOfLines={1}>
                            {isMe ? <Text style={{ color: BRAND.sky, fontWeight: '700' }}>You: </Text> : ''}
                            {msg.message_type === 'image' ? '📷 Photo Attachment' : msg.message}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor={BRAND.navy} translucent />

            {/* ── LUXURY HEADER ── */}
            <View style={s.headerWrap}>
                <View style={s.headerTopRow}>
                    <TouchableOpacity
                        style={s.backBtn}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.headerTitle}>Messages & Inquiries</Text>
                        <Text style={s.headerSubtitle}>Real-time Seller & Support Chat</Text>
                    </View>

                    <TouchableOpacity
                        style={s.supportQuickBtn}
                        onPress={() => navigation.navigate('ChatScreen', {
                            vendorId: 'admin',
                            vendorName: 'Abu Mafhal Official Support',
                            vendorRole: 'Admin'
                        })}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="headset" size={18} color={BRAND.navy} />
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={s.searchBarBox}>
                    <Ionicons name="search" size={16} color={BRAND.gold} />
                    <TextInput
                        placeholder="Search chats, merchants, messages..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={s.searchInput}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
                            <Ionicons name="close-circle" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Tabs */}
                <View style={s.tabsRow}>
                    <TouchableOpacity
                        style={[s.tabPill, activeTab === 'all' && s.tabPillActive]}
                        onPress={() => setActiveTab('all')}
                    >
                        <Text style={[s.tabTxt, activeTab === 'all' && s.tabTxtActive]}>
                            All ({conversations.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.tabPill, activeTab === 'stores' && s.tabPillActive]}
                        onPress={() => setActiveTab('stores')}
                    >
                        <Ionicons
                            name="storefront-outline"
                            size={12}
                            color={activeTab === 'stores' ? BRAND.navy : '#94A3B8'}
                            style={{ marginRight: 3 }}
                        />
                        <Text style={[s.tabTxt, activeTab === 'stores' && s.tabTxtActive]}>
                            Stores
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.tabPill, activeTab === 'support' && s.tabPillActive]}
                        onPress={() => setActiveTab('support')}
                    >
                        <Ionicons
                            name="shield-checkmark-outline"
                            size={12}
                            color={activeTab === 'support' ? BRAND.navy : '#94A3B8'}
                            style={{ marginRight: 3 }}
                        />
                        <Text style={[s.tabTxt, activeTab === 'support' && s.tabTxtActive]}>
                            Support
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── CONVERSATIONS LIST ── */}
            {loading && !refreshing ? (
                <View style={s.loadingBox}>
                    <ActivityIndicator size="large" color={BRAND.navy} />
                    <Text style={s.loadingTxt}>Loading conversations...</Text>
                </View>
            ) : (
                <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                    <FlatList
                        data={filteredConversations}
                        keyExtractor={item => item.partnerId}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 40 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.gold} colors={[BRAND.gold]} />
                        }
                        ListEmptyComponent={
                            <View style={s.emptyBox}>
                                <View style={s.emptyIconWrap}>
                                    <Ionicons name="chatbubbles-outline" size={44} color={BRAND.gold} />
                                </View>
                                <Text style={s.emptyTitle}>No Conversations Found</Text>
                                <Text style={s.emptySubtitle}>
                                    {searchQuery
                                        ? 'No chats match your search query.'
                                        : 'You haven\'t started chatting with any seller yet. Browse our store and chat directly with verified merchants!'}
                                </Text>
                                <TouchableOpacity
                                    style={s.browseShopBtn}
                                    onPress={() => navigation.navigate('Main', { screen: 'shop' })}
                                    activeOpacity={0.8}
                                >
                                    <Text style={s.browseShopBtnTxt}>Explore Products & Chat</Text>
                                </TouchableOpacity>
                            </View>
                        }
                    />
                </Animated.View>
            )}
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    headerWrap: {
        backgroundColor: BRAND.navy,
        paddingTop: Platform.OS === 'ios' ? 48 : (StatusBar.currentHeight || 24) + 8,
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        elevation: 6,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    headerSubtitle: {
        fontSize: 10.5,
        color: '#94A3B8',
        marginTop: 1,
    },
    supportQuickBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: BRAND.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBarBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 40,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 12.5,
        color: BRAND.slateDark,
        paddingVertical: 0,
    },
    tabsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    tabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tabPillActive: {
        backgroundColor: BRAND.gold,
    },
    tabTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#CBD5E1',
    },
    tabTxtActive: {
        color: BRAND.navy,
    },

    // Conversation Cards
    convCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        position: 'relative',
        marginRight: 12,
    },
    avatarImg: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: BRAND.skyLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 11,
        height: 11,
        borderRadius: 6,
        backgroundColor: BRAND.emerald,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    offlineDot: {
        backgroundColor: '#CBD5E1',
    },
    convInfo: {
        flex: 1,
    },
    convHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 3,
    },
    partnerName: {
        fontSize: 14.5,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    supportBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    supportBadgeTxt: {
        fontSize: 8.5,
        fontWeight: '900',
        color: BRAND.goldDark,
    },
    timestampTxt: {
        fontSize: 10.5,
        color: BRAND.slate,
        fontWeight: '500',
    },
    messagePreviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    previewTxt: {
        fontSize: 12.5,
        color: BRAND.slate,
        flex: 1,
        paddingRight: 8,
    },

    // Loading & Empty States
    loadingBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingTxt: {
        fontSize: 12,
        color: BRAND.slate,
        fontWeight: '600',
        marginTop: 8,
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingTop: 60,
    },
    emptyIconWrap: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: BRAND.slateDark,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 12,
        color: BRAND.slate,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
    },
    browseShopBtn: {
        marginTop: 18,
        backgroundColor: BRAND.navy,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BRAND.gold,
    },
    browseShopBtnTxt: {
        fontSize: 12.5,
        fontWeight: '800',
        color: BRAND.gold,
    },
});
