import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, Text, ScrollView, ActivityIndicator, TouchableOpacity, 
    Alert, TextInput, Dimensions, Switch, Modal, FlatList, StyleSheet, 
    RefreshControl, Platform 
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { UserAvatar } from '../../components/UserAvatar';

const { width } = Dimensions.get('window');
const NAVY = '#0E1A2E';
const DEEP_NAVY = '#1E293B';
const GOLD = '#D9A73A';

export const AdminReferrals = () => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('overview'); // overview, activity, rankings, settings
    const [stats, setStats] = useState({ totalRefs: 0, liability: 0, totalAmbassadors: 0, recentCount: 0 });
    const [referralSettings, setReferralSettings] = useState({
        reward_per_referral: 500,
        new_user_reward: 200,
        is_campaign_active: true
    });
    const [activities, setActivities] = useState([]);
    const [filteredActivities, setFilteredActivities] = useState([]);
    const [rankings, setRankings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activitySearch, setActivitySearch] = useState('');

    // Drill-down State
    const [selectedAmbassador, setSelectedAmbassador] = useState(null);
    const [ambassadorRefs, setAmbassadorRefs] = useState([]);
    const [loadingDrill, setLoadingDrill] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            if (activeTab === 'overview') {
                const { count: totalRefs } = await supabase.from('referrals').select('*', { count: 'exact', head: true });
                const { data: coinsData } = await supabase.from('profiles').select('mafhal_coins');
                const totalLiability = coinsData?.reduce((sum, p) => sum + (p.mafhal_coins || 0), 0) || 0;
                const ambassadorsCount = coinsData?.filter(p => (p.mafhal_coins || 0) > 0).length || 0;

                // Recent referrals in the last 7 days
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const { count: recentRefs } = await supabase
                    .from('referrals')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', sevenDaysAgo);

                setStats({
                    totalRefs: totalRefs || 0,
                    liability: totalLiability,
                    totalAmbassadors: ambassadorsCount,
                    recentCount: recentRefs || 0
                });
            } else if (activeTab === 'settings') {
                const { data: settings } = await supabase.from('referral_settings').select('*').eq('id', 'default').maybeSingle();
                if (settings) {
                    setReferralSettings(settings);
                }
            } else if (activeTab === 'activity') {
                const { data: refs } = await supabase
                    .from('referrals')
                    .select(`
                        id,
                        reward_amount,
                        created_at,
                        referrer:referrer_id(full_name, email),
                        referred:referred_user_id(full_name, email)
                    `)
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (refs) {
                    setActivities(refs);
                    setFilteredActivities(refs);
                }
            } else if (activeTab === 'rankings') {
                const { data: ambassadors } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, mafhal_coins, referral_code, created_at')
                    .gt('mafhal_coins', 0)
                    .order('mafhal_coins', { ascending: false })
                    .limit(50);
                if (ambassadors) setRankings(ambassadors);
            }
        } catch (error) {
            console.error('Admin Referrals Fetch Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab]);

    useEffect(() => {
        setLoading(true);
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const fetchAmbassadorDetails = async (ambassador) => {
        setSelectedAmbassador(ambassador);
        setLoadingDrill(true);
        try {
            const { data: refs } = await supabase
                .from('referrals')
                .select(`
                    id,
                    reward_amount,
                    created_at,
                    referred:referred_user_id(full_name, email)
                `)
                .eq('referrer_id', ambassador.id)
                .order('created_at', { ascending: false });

            setAmbassadorRefs(refs || []);
        } catch (error) {
            console.error('Drill-down error:', error);
        } finally {
            setLoadingDrill(false);
        }
    };

    const updateSettings = async () => {
        setLoading(true);
        try {
            const payload = {
                id: 'default',
                reward_per_referral: parseFloat(referralSettings.reward_per_referral) || 0,
                new_user_reward: parseFloat(referralSettings.new_user_reward) || 0,
                is_campaign_active: referralSettings.is_campaign_active
            };

            const { error } = await supabase
                .from('referral_settings')
                .upsert(payload);

            if (error) throw error;
            Alert.alert('Updated', 'Referral settings have been saved successfully.');
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleActivitySearch = (text) => {
        setActivitySearch(text);
        if (!text.trim()) {
            setFilteredActivities(activities);
            return;
        }
        const q = text.toLowerCase();
        const filtered = activities.filter(act =>
            act.referrer?.full_name?.toLowerCase().includes(q) ||
            act.referred?.full_name?.toLowerCase().includes(q) ||
            act.referrer?.username?.toLowerCase().includes(q)
        );
        setFilteredActivities(filtered);
    };

    const TabButton = ({ id, label, icon }) => {
        const isActive = activeTab === id;
        return (
            <TouchableOpacity
                onPress={() => setActiveTab(id)}
                style={[s.tabPill, isActive && s.tabPillActive]}
                activeOpacity={0.8}
            >
                <Ionicons name={icon} size={15} color={isActive ? NAVY : '#64748B'} />
                <Text style={[s.tabPillText, isActive && s.tabPillTextActive]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View style={s.headerTopRow}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="gift" size={22} color={GOLD} />
                            <Text style={s.headerTitle}>Referrals & Rewards</Text>
                        </View>
                        <Text style={s.headerSubtitle}>Manage Mafhal Coins, ambassadors and reward campaigns</Text>
                    </View>
                    <TouchableOpacity onPress={onRefresh} style={s.refreshBtn} activeOpacity={0.8}>
                        <Ionicons name="refresh" size={18} color={NAVY} />
                    </TouchableOpacity>
                </View>

                {/* Navigation Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    <TabButton id="overview" label="Overview" icon="analytics-outline" />
                    <TabButton id="activity" label="Activity Stream" icon="list-outline" />
                    <TabButton id="rankings" label="Ambassadors" icon="trophy-outline" />
                    <TabButton id="settings" label="Settings" icon="settings-outline" />
                </ScrollView>
            </View>

            {loading && !refreshing ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={s.loadingText}>Loading referral campaign data...</Text>
                </View>
            ) : (
                <ScrollView 
                    contentContainerStyle={{ padding: 16, paddingBottom: 80 }} 
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
                >
                    {activeTab === 'overview' && (
                        <View>
                            {/* Main Hero Card */}
                            <View style={s.heroCard}>
                                <Text style={s.heroCardLabel}>TOTAL REFERRALS (CONVERSIONS)</Text>
                                <View style={s.heroStatsRow}>
                                    <Text style={s.heroNumber}>{stats.totalRefs}</Text>
                                    <View style={s.recentPill}>
                                        <Ionicons name="flash" size={12} color="#059669" />
                                        <Text style={s.recentPillText}>+{stats.recentCount} this week</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Two Column Grid */}
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                <View style={s.statBox}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="wallet-outline" size={16} color={GOLD} />
                                        <Text style={s.statBoxLabel}>REWARD COINS CIRCULATING</Text>
                                    </View>
                                    <Text style={s.statBoxValue}>{stats.liability.toLocaleString()} <Text style={{ fontSize: 11, color: '#64748B' }}>AMC</Text></Text>
                                    <Text style={s.statBoxSub}>Total coins held by customers</Text>
                                </View>

                                <View style={s.statBox}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="people-outline" size={16} color={NAVY} />
                                        <Text style={s.statBoxLabel}>ACTIVE AMBASSADORS</Text>
                                    </View>
                                    <Text style={s.statBoxValue}>{stats.totalAmbassadors}</Text>
                                    <Text style={s.statBoxSub}>Users holding reward coins</Text>
                                </View>
                            </View>

                            {/* Live Intelligence Card */}
                            <View style={s.intelligenceCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <Ionicons name="bulb-outline" size={18} color={NAVY} />
                                    <Text style={s.intelligenceTitle}>Campaign Optimization Insights</Text>
                                </View>
                                <Text style={s.intelligenceText}>
                                    Currently {stats.totalAmbassadors} ambassadors hold {stats.liability.toLocaleString()} AMC. 
                                    Increasing the referral reward in Settings can accelerate new customer acquisition.
                                </Text>
                            </View>
                        </View>
                    )}

                    {activeTab === 'activity' && (
                        <View>
                            <View style={s.searchBar}>
                                <Ionicons name="search" size={16} color={GOLD} />
                                <TextInput
                                    placeholder="Search by referrer or referee name..."
                                    placeholderTextColor="#94A3B8"
                                    style={s.searchInput}
                                    value={activitySearch}
                                    onChangeText={handleActivitySearch}
                                />
                            </View>

                            {filteredActivities.map((act, i) => (
                                <View key={act.id || i} style={s.activityCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <UserAvatar user={act.referrer} size={42} border={GOLD} />
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <Text style={s.referrerName}>{act.referrer?.full_name?.split(' ')[0] || 'User'}</Text>
                                                <Ionicons name="arrow-forward" size={12} color="#94A3B8" style={{ marginHorizontal: 6 }} />
                                                <Text style={s.referredName}>{act.referred?.full_name?.split(' ')[0] || 'User'}</Text>
                                            </View>
                                            <Text style={s.activityDate}>
                                                {new Date(act.created_at).toLocaleDateString()} • {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </View>
                                        <View style={s.rewardBadge}>
                                            <Text style={s.rewardBadgeText}>+{act.reward_amount} AMC</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}

                            {filteredActivities.length === 0 && (
                                <View style={s.emptyBox}>
                                    <Ionicons name="list-outline" size={36} color="#CBD5E1" />
                                    <Text style={s.emptyTitle}>No Activity Yet</Text>
                                    <Text style={s.emptySub}>No new referrals recorded in this period.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {activeTab === 'rankings' && (
                        <View>
                            <View style={s.searchBar}>
                                <Ionicons name="search" size={16} color={GOLD} />
                                <TextInput
                                    placeholder="Search top ambassadors..."
                                    placeholderTextColor="#94A3B8"
                                    style={s.searchInput}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            {rankings.filter(u => u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())).map((u, i) => (
                                <TouchableOpacity
                                    key={u.id || i}
                                    onPress={() => fetchAmbassadorDetails(u)}
                                    style={s.rankCard}
                                    activeOpacity={0.8}
                                >
                                    <View style={{ marginRight: 14, position: 'relative' }}>
                                        <UserAvatar user={u} size={46} border={i < 3 ? GOLD : '#E2E8F0'} />
                                        {i < 3 && (
                                            <View style={s.trophyRankBadge}>
                                                <Text style={s.trophyRankText}>{i + 1}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.ambassadorName}>{u.full_name || 'Brand Ambassador'}</Text>
                                        <Text style={s.referralCodeText}>Code: {u.referral_code || 'None'}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={s.coinsAmountText}>{(u.mafhal_coins || 0).toLocaleString()}</Text>
                                        <Text style={s.coinsUnitText}>AMC</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}

                            {rankings.length === 0 && (
                                <View style={s.emptyBox}>
                                    <Ionicons name="trophy-outline" size={36} color="#CBD5E1" />
                                    <Text style={s.emptyTitle}>No Ambassadors Found</Text>
                                    <Text style={s.emptySub}>No users with coins found matching your query.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {activeTab === 'settings' && (
                        <View style={s.settingsCard}>
                            <Text style={s.settingsTitle}>Referral Campaign Settings</Text>

                            <View style={{ marginBottom: 18 }}>
                                <Text style={s.fieldLabel}>REFERRER BOUNTY (AMC)</Text>
                                <TextInput
                                    style={s.fieldInput}
                                    value={(referralSettings.reward_per_referral ?? 0).toString()}
                                    onChangeText={(val) => setReferralSettings({ ...referralSettings, reward_per_referral: val })}
                                    keyboardType="numeric"
                                />
                                <Text style={s.fieldHelp}>Amount of Mafhal Coins the referrer receives per successful invite.</Text>
                            </View>

                            <View style={{ marginBottom: 20 }}>
                                <Text style={s.fieldLabel}>NEW USER WELCOME GIFT (AMC)</Text>
                                <TextInput
                                    style={s.fieldInput}
                                    value={(referralSettings.new_user_reward ?? 0).toString()}
                                    onChangeText={(val) => setReferralSettings({ ...referralSettings, new_user_reward: val })}
                                    keyboardType="numeric"
                                />
                                <Text style={s.fieldHelp}>Welcome bonus coins credited to newly registered users.</Text>
                            </View>

                            <View style={s.switchRow}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={s.switchTitle}>Enable Referral Campaign</Text>
                                    <Text style={s.switchSub}>Allow customers to earn and redeem coins via referral invites</Text>
                                </View>
                                <Switch
                                    value={referralSettings.is_campaign_active}
                                    onValueChange={(val) => setReferralSettings({ ...referralSettings, is_campaign_active: val })}
                                    trackColor={{ false: '#CBD5E1', true: '#FEF3C7' }}
                                    thumbColor={referralSettings.is_campaign_active ? GOLD : '#94A3B8'}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={updateSettings}
                                style={s.saveSettingsBtn}
                                activeOpacity={0.85}
                            >
                                <Text style={s.saveSettingsBtnText}>Save Campaign Settings</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* AMBASSADOR DRILL-DOWN MODAL */}
            <Modal visible={!!selectedAmbassador} animationType="slide" transparent={true}>
                <View style={s.drillModalOverlay}>
                    <View style={s.drillModalContent}>
                        {selectedAmbassador && (
                            <>
                                <View style={s.drillModalHeader}>
                                    <View>
                                        <Text style={s.drillModalTitle}>{selectedAmbassador.full_name}</Text>
                                        <Text style={s.drillModalSub}>Ambassador Referral Details</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setSelectedAmbassador(null)} style={s.closeCircleBtn}>
                                        <Ionicons name="close" size={20} color={NAVY} />
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                                    <View style={s.drillStatBox}>
                                        <Text style={s.drillStatLabel}>TOTAL COINS</Text>
                                        <Text style={s.drillStatValue}>{(selectedAmbassador.mafhal_coins || 0).toLocaleString()} AMC</Text>
                                    </View>
                                    <View style={s.drillStatBox}>
                                        <Text style={s.drillStatLabel}>TOTAL REFERRED</Text>
                                        <Text style={s.drillStatValue}>{ambassadorRefs.length}</Text>
                                    </View>
                                </View>

                                <Text style={s.networkMapTitle}>Referred Network (Network Map)</Text>
                                {loadingDrill ? (
                                    <ActivityIndicator color={GOLD} style={{ marginTop: 30 }} />
                                ) : (
                                    <FlatList
                                        data={ambassadorRefs}
                                        showsVerticalScrollIndicator={false}
                                        keyExtractor={(item) => item.id}
                                        renderItem={({ item }) => (
                                            <View style={s.networkRow}>
                                                <UserAvatar user={item.referred} size={38} />
                                                <View style={{ flex: 1, marginLeft: 12 }}>
                                                    <Text style={s.networkName}>{item.referred?.full_name || 'Referee'}</Text>
                                                    <Text style={s.networkDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                                </View>
                                                <Text style={s.networkReward}>+{item.reward_amount} AMC</Text>
                                            </View>
                                        )}
                                        ListEmptyComponent={
                                            <View style={{ padding: 30, alignItems: 'center' }}>
                                                <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>No users have registered with this ambassador's link yet.</Text>
                                            </View>
                                        }
                                    />
                                )}
                            </>
                        )}
                        <TouchableOpacity
                            onPress={() => setSelectedAmbassador(null)}
                            style={s.closeDrillBtn}
                            activeOpacity={0.85}
                        >
                            <Text style={s.closeDrillBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    header: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: NAVY
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    refreshBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    tabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    tabPillActive: {
        backgroundColor: NAVY,
        borderColor: NAVY
    },
    tabPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B'
    },
    tabPillTextActive: {
        color: GOLD,
        fontWeight: '800'
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    loadingText: {
        marginTop: 12,
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600'
    },
    heroCard: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6
    },
    heroCardLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    heroStatsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
        marginTop: 8
    },
    heroNumber: {
        color: NAVY,
        fontSize: 38,
        fontWeight: '900'
    },
    recentPill: {
        backgroundColor: '#ECFDF5',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        marginBottom: 8
    },
    recentPillText: {
        color: '#059669',
        fontSize: 12,
        fontWeight: '800'
    },
    statBox: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    statBoxLabel: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '800'
    },
    statBoxValue: {
        color: NAVY,
        fontSize: 20,
        fontWeight: '900',
        marginTop: 6
    },
    statBoxSub: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 4
    },
    intelligenceCard: {
        backgroundColor: '#FFFBEB',
        padding: 18,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    intelligenceTitle: {
        color: NAVY,
        fontSize: 14,
        fontWeight: '800'
    },
    intelligenceText: {
        color: '#475569',
        fontSize: 12,
        lineHeight: 18,
        marginTop: 4
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 13,
        color: NAVY,
        fontWeight: '600'
    },
    activityCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    referrerName: {
        fontWeight: '800',
        color: NAVY,
        fontSize: 14
    },
    referredName: {
        fontWeight: '800',
        color: GOLD,
        fontSize: 14
    },
    activityDate: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 3
    },
    rewardBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10
    },
    rewardBadgeText: {
        fontWeight: '900',
        color: '#059669',
        fontSize: 12
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginTop: 20
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY,
        marginTop: 10
    },
    emptySub: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4
    },
    rankCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    trophyRankBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: GOLD,
        borderRadius: 9,
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center'
    },
    trophyRankText: {
        color: NAVY,
        fontSize: 10,
        fontWeight: '900'
    },
    ambassadorName: {
        fontWeight: '800',
        color: NAVY,
        fontSize: 15
    },
    referralCodeText: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    coinsAmountText: {
        fontWeight: '900',
        color: GOLD,
        fontSize: 16
    },
    coinsUnitText: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '800'
    },
    settingsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    settingsTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY,
        marginBottom: 20
    },
    fieldLabel: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '800',
        marginBottom: 6,
        letterSpacing: 0.5
    },
    fieldInput: {
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 12,
        fontSize: 16,
        fontWeight: '800',
        color: NAVY,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    fieldHelp: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 4
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    switchTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY
    },
    switchSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    saveSettingsBtn: {
        backgroundColor: GOLD,
        paddingVertical: 15,
        borderRadius: 16,
        alignItems: 'center'
    },
    saveSettingsBtnText: {
        color: NAVY,
        fontWeight: '900',
        fontSize: 15
    },
    drillModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(14, 26, 46, 0.65)',
        justifyContent: 'flex-end'
    },
    drillModalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: '80%',
        padding: 20
    },
    drillModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    drillModalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: NAVY
    },
    drillModalSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    closeCircleBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    drillStatBox: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    drillStatLabel: {
        color: '#64748B',
        fontSize: 9,
        fontWeight: '800'
    },
    drillStatValue: {
        color: NAVY,
        fontSize: 16,
        fontWeight: '900',
        marginTop: 4
    },
    networkMapTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY,
        marginBottom: 12
    },
    networkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    networkName: {
        fontWeight: '700',
        color: NAVY,
        fontSize: 13
    },
    networkDate: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2
    },
    networkReward: {
        fontWeight: '800',
        color: '#059669',
        fontSize: 12
    },
    closeDrillBtn: {
        backgroundColor: NAVY,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 14
    },
    closeDrillBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14
    }
});
