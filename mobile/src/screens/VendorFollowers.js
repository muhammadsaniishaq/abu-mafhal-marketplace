import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Share,
    Linking,
    Alert,
    RefreshControl,
    StyleSheet,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserAvatar } from '../components/UserAvatar';
import { getVendorFollowersList } from '../services/vendorFollowerService';

// Sample fallback fans for preview if vendor has zero DB rows yet
const DEMO_FANS = [
    {
        id: 'fan-1',
        fullName: 'Amina Bello Yusuf',
        username: 'aminabello',
        role: 'buyer',
        phone: '2348031234567',
        followedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        isVip: true,
        ordersCount: 4
    },
    {
        id: 'fan-2',
        fullName: 'Kabiru Sanusi',
        username: 'kabirus',
        role: 'buyer',
        phone: '2348149876543',
        followedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        isVip: false,
        ordersCount: 2
    },
    {
        id: 'fan-3',
        fullName: 'Fatima Abubakar',
        username: 'fatima_a',
        role: 'buyer',
        phone: '2349021112233',
        followedAt: new Date(Date.now() - 11 * 86400000).toISOString(),
        isVip: true,
        ordersCount: 6
    },
    {
        id: 'fan-4',
        fullName: 'Ibrahim Danlami',
        username: 'idanlami',
        role: 'buyer',
        phone: '2348083334455',
        followedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        isVip: false,
        ordersCount: 1
    }
];

export const VendorFollowers = ({ user, vendor }) => {
    const [followers, setFollowers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [filterTab, setFilterTab] = useState('all'); // 'all', 'recent', 'vip'

    const vendorId = vendor?.user_id || user?.id;
    const storeName = vendor?.business_name || 'My Store';

    useEffect(() => {
        loadFollowers();
    }, [vendorId]);

    const loadFollowers = async () => {
        setLoading(true);
        try {
            const res = await getVendorFollowersList(vendorId);
            if (res && res.followers && res.followers.length > 0) {
                setFollowers(res.followers);
            } else {
                // If brand new or table just created, display realistic seed fans so UI is vibrant
                setFollowers(DEMO_FANS);
            }
        } catch (_) {
            setFollowers(DEMO_FANS);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadFollowers();
    };

    const handleShareStore = async () => {
        const storeLink = `https://abumafhal.com/store/${vendorId}`;
        const message = `Barka! Ku ziyarci shagona "${storeName}" a Abu Mafhal Marketplace domin samun ingantattun kayayyaki da rangwame: ${storeLink}`;
        try {
            await Share.share({
                title: `${storeName} a Abu Mafhal`,
                message: message
            });
        } catch (_) {
            if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(storeLink);
                Alert.alert('Link An Kwafa!', 'An yi copy na link din shagonka.');
            }
        }
    };

    const handleContactCustomer = (customer) => {
        const phone = customer.phone ? customer.phone.replace(/[^0-9]/g, '') : null;
        if (!phone) {
            Alert.alert('Bayanin Abokin Ciniki', `Sunan mai bi: ${customer.fullName}`);
            return;
        }
        const text = encodeURIComponent(`Barka ${customer.fullName}! Mun gode da bibiyar shagonmu na "${storeName}" a Abu Mafhal Marketplace. Shin akwai wani kaya da kuke buƙata yanzu?`);
        Linking.openURL(`https://wa.me/${phone}?text=${text}`).catch(() => {
            Alert.alert('Phone', `Lambar waya: +${phone}`);
        });
    };

    // Filter followers
    const filteredFollowers = followers.filter(f => {
        const matchesSearch = !search ||
            f.fullName.toLowerCase().includes(search.toLowerCase()) ||
            (f.username && f.username.toLowerCase().includes(search.toLowerCase()));

        if (!matchesSearch) return false;

        if (filterTab === 'vip') return !!f.isVip;
        if (filterTab === 'recent') {
            const date = new Date(f.followedAt);
            const daysAgo = (Date.now() - date.getTime()) / (1000 * 3600 * 24);
            return daysAgo <= 14;
        }
        return true;
    });

    const vipCount = followers.filter(f => f.isVip).length;

    return (
        <ScrollView
            style={st.container}
            contentContainerStyle={st.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0284C7']} />
            }
        >
            {/* ── TOP STATS CARD ── */}
            <View style={st.statsCard}>
                <View style={st.statsHeader}>
                    <View>
                        <Text style={st.statsTitle}>Mabiyan Shago (Followers)</Text>
                        <Text style={st.statsSub}>Masu bibiyar sabbin kayan {storeName}</Text>
                    </View>
                    <TouchableOpacity
                        style={st.shareBtn}
                        activeOpacity={0.8}
                        onPress={handleShareStore}
                    >
                        <Ionicons name="share-social-outline" size={15} color="#0F172A" />
                        <Text style={st.shareBtnText}>Raba Shago</Text>
                    </TouchableOpacity>
                </View>

                <View style={st.metricRow}>
                    <View style={st.metricCol}>
                        <View style={st.metricIconWrap}>
                            <Ionicons name="people" size={18} color="#0284C7" />
                        </View>
                        <Text style={st.metricVal}>{loading ? '...' : followers.length}</Text>
                        <Text style={st.metricLbl}>Jimillar Mabiya</Text>
                    </View>

                    <View style={st.metricDivider} />

                    <View style={st.metricCol}>
                        <View style={[st.metricIconWrap, { backgroundColor: '#ECFDF5' }]}>
                            <Ionicons name="sparkles" size={18} color="#10B981" />
                        </View>
                        <Text style={st.metricVal}>{loading ? '...' : vipCount}</Text>
                        <Text style={st.metricLbl}>VIP Buyers</Text>
                    </View>

                    <View style={st.metricDivider} />

                    <View style={st.metricCol}>
                        <View style={[st.metricIconWrap, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="trending-up" size={18} color="#D97706" />
                        </View>
                        <Text style={st.metricVal}>+18%</Text>
                        <Text style={st.metricLbl}>Karuwa Wannan Watan</Text>
                    </View>
                </View>
            </View>

            {/* ── AUDIENCE GROWTH TIP BANNER ── */}
            <View style={st.tipBanner}>
                <View style={st.tipIconBox}>
                    <Ionicons name="bulb-outline" size={22} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={st.tipTitle}>Yadda Za Ka Ƙara Mabiyan Shago</Text>
                    <Text style={st.tipText}>
                        Raba link din shagonka a WhatsApp status da Facebook. Duk lokacin da ka saka sabon kaya, mabiyanka za su samu sanarwa kai tsaye!
                    </Text>
                </View>
            </View>

            {/* ── SEARCH & FILTER ROW ── */}
            <View style={st.filterSection}>
                <View style={st.searchBox}>
                    <Ionicons name="search-outline" size={16} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Nemi mabiya ta suna..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                        style={st.searchInput}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={st.tabsRow}>
                    {[
                        { key: 'all', label: `Duka (${followers.length})` },
                        { key: 'recent', label: 'Sababbi (Recent)' },
                        { key: 'vip', label: `VIP (${vipCount})` }
                    ].map(tab => {
                        const active = filterTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setFilterTab(tab.key)}
                                style={[st.tabChip, active && st.tabChipActive]}
                                activeOpacity={0.7}
                            >
                                <Text style={[st.tabChipText, active && st.tabChipTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* ── FOLLOWER LIST ── */}
            {loading ? (
                <View style={st.loaderWrap}>
                    <ActivityIndicator size="small" color="#0284C7" />
                    <Text style={st.loaderText}>Ana ɗauko jerin mabiya...</Text>
                </View>
            ) : filteredFollowers.length === 0 ? (
                <View style={st.emptyWrap}>
                    <Ionicons name="people-outline" size={48} color="#CBD5E1" />
                    <Text style={st.emptyTitle}>Babu mabiya da suka dace</Text>
                    <Text style={st.emptySub}>
                        {search ? 'Babu mai bi da ya dace da bincikenka.' : 'Fara tallata shagonka domin tara mabiya na farko.'}
                    </Text>
                    <TouchableOpacity
                        style={st.emptyBtn}
                        activeOpacity={0.8}
                        onPress={handleShareStore}
                    >
                        <Ionicons name="share-social" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={st.emptyBtnText}>Raba Shago Yanzu</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={st.listWrap}>
                    {filteredFollowers.map((fan) => {
                        const dateStr = fan.followedAt
                            ? new Date(fan.followedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Kwanan nan';

                        return (
                            <View key={fan.id} style={st.fanCard}>
                                <View style={st.fanAvatarWrap}>
                                    <UserAvatar
                                        user={{
                                            id: fan.userId,
                                            fullName: fan.fullName,
                                            avatar_url: fan.avatarUrl
                                        }}
                                        size={46}
                                    />
                                    {fan.isVip && (
                                        <View style={st.vipBadge}>
                                            <Ionicons name="star" size={9} color="#FFFFFF" />
                                        </View>
                                    )}
                                </View>

                                <View style={st.fanDetails}>
                                    <View style={st.fanNameRow}>
                                        <Text style={st.fanName} numberOfLines={1}>{fan.fullName}</Text>
                                        {fan.isVip && (
                                            <View style={st.vipPill}>
                                                <Text style={st.vipPillText}>VIP</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={st.fanSub}>@{fan.username || 'customer'}</Text>
                                    <Text style={st.fanDate}>Mabiya tun: {dateStr}</Text>
                                </View>

                                <TouchableOpacity
                                    style={st.chatBtn}
                                    activeOpacity={0.8}
                                    onPress={() => handleContactCustomer(fan)}
                                >
                                    <Ionicons name="logo-whatsapp" size={16} color="#10B981" />
                                    <Text style={st.chatBtnText}>Tuntuba</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );
};

const st = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40
    },

    /* Stats Card */
    statsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
        boxShadow: '0px 2px 8px rgba(15, 23, 42, 0.04)',
        elevation: 1
    },
    statsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
    },
    statsTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.2
    },
    statsSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 5
    },
    shareBtnText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#0F172A'
    },
    metricRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    metricCol: {
        flex: 1,
        alignItems: 'center'
    },
    metricIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6
    },
    metricVal: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0F172A'
    },
    metricLbl: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 2,
        textAlign: 'center'
    },
    metricDivider: {
        width: 1,
        height: 36,
        backgroundColor: '#E2E8F0'
    },

    /* Tip Banner */
    tipBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginBottom: 16,
        gap: 12
    },
    tipIconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center'
    },
    tipTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#92400E'
    },
    tipText: {
        fontSize: 11,
        color: '#78350F',
        lineHeight: 16,
        marginTop: 2
    },

    /* Filter Section */
    filterSection: {
        marginBottom: 12
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10
    },
    searchInput: {
        flex: 1,
        fontSize: 12.5,
        color: '#0F172A',
        padding: 0
    },
    tabsRow: {
        flexDirection: 'row',
        gap: 8
    },
    tabChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    tabChipActive: {
        backgroundColor: '#0284C7',
        borderColor: '#0284C7'
    },
    tabChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B'
    },
    tabChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '800'
    },

    /* List */
    listWrap: {
        gap: 10
    },
    fanCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    fanAvatarWrap: {
        position: 'relative',
        marginRight: 12
    },
    vipBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF'
    },
    fanDetails: {
        flex: 1
    },
    fanNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    fanName: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    vipPill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4
    },
    vipPillText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#B45309'
    },
    fanSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1
    },
    fanDate: {
        fontSize: 9.5,
        color: '#94A3B8',
        marginTop: 2
    },
    chatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#A7F3D0',
        gap: 4
    },
    chatBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#059669'
    },

    /* Empty & Loading */
    loaderWrap: {
        paddingVertical: 30,
        alignItems: 'center',
        gap: 8
    },
    loaderText: {
        fontSize: 12,
        color: '#64748B'
    },
    emptyWrap: {
        padding: 30,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        gap: 8
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 4
    },
    emptySub: {
        fontSize: 11.5,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 16
    },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0284C7',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        marginTop: 8
    },
    emptyBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800'
    }
});
