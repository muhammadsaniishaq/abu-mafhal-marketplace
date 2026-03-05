import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, TextInput, Dimensions, Switch, Modal, FlatList } from 'react-native';
import { styles as themeStyles } from '../../styles/theme';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { UserAvatar } from '../../components/UserAvatar';

const { width, height } = Dimensions.get('window');

export const AdminReferrals = () => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, activity, rankings, settings
    const [stats, setStats] = useState({ totalRefs: 0, liability: 0, growthRate: '+12%' });
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
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Drill-down State
    const [selectedAmbassador, setSelectedAmbassador] = useState(null);
    const [ambassadorRefs, setAmbassadorRefs] = useState([]);
    const [loadingDrill, setLoadingDrill] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        if (!isRefreshing) setLoading(true);
        try {
            if (activeTab === 'overview') {
                const { count: totalRefs } = await supabase.from('referrals').select('*', { count: 'exact', head: true });
                const { data: coinsData } = await supabase.from('profiles').select('mafhal_coins');
                const totalLiability = coinsData?.reduce((sum, p) => sum + (p.mafhal_coins || 0), 0) || 0;

                setStats({
                    totalRefs: totalRefs || 0,
                    liability: totalLiability,
                    growthRate: '+12.5%' // Logic for growth can be added here
                });
            } else if (activeTab === 'settings') {
                const { data: settings } = await supabase.from('referral_settings').select('*').eq('id', 'default').single();
                if (settings) setReferralSettings(settings);
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
            console.error('Admin Fetch Error:', error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
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
            const { error } = await supabase
                .from('referral_settings')
                .update({
                    reward_per_referral: parseFloat(referralSettings.reward_per_referral),
                    new_user_reward: parseFloat(referralSettings.new_user_reward),
                    is_campaign_active: referralSettings.is_campaign_active
                })
                .eq('id', 'default');

            if (error) throw error;
            Alert.alert('Success', 'Global settings updated.');
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleActivitySearch = (text) => {
        setActivitySearch(text);
        if (!text) {
            setFilteredActivities(activities);
            return;
        }
        const filtered = activities.filter(act =>
            act.referrer?.full_name?.toLowerCase().includes(text.toLowerCase()) ||
            act.referred?.full_name?.toLowerCase().includes(text.toLowerCase())
        );
        setFilteredActivities(filtered);
    };

    const TabButton = ({ id, label, icon }) => (
        <TouchableOpacity
            onPress={() => setActiveTab(id)}
            style={{
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 20,
                backgroundColor: activeTab === id ? '#10B981' : 'rgba(255,255,255,0.05)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginRight: 10
            }}
        >
            <Ionicons name={icon} size={18} color={activeTab === id ? 'white' : '#94A3B8'} />
            <Text style={{ color: activeTab === id ? 'white' : '#94A3B8', fontWeight: '800', fontSize: 13 }}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
            {/* ELITE HEADER */}
            <View style={{ paddingTop: 60, paddingHorizontal: 24, paddingBottom: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <View>
                        <Text style={{ color: 'white', fontSize: 26, fontWeight: '900', letterSpacing: -1 }}>Referral Elite</Text>
                        <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '700' }}>Administrative Intelligence</Text>
                    </View>
                    <TouchableOpacity onPress={() => fetchData()} style={{ width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="refresh" size={20} color="#10B981" />
                    </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TabButton id="overview" label="Metrics" icon="analytics" />
                    <TabButton id="activity" label="Stream" icon="list" />
                    <TabButton id="rankings" label="Elite" icon="trophy" />
                    <TabButton id="settings" label="Config" icon="options" />
                </ScrollView>
            </View>

            <View style={{ flex: 1, backgroundColor: '#F8FAFC', borderTopLeftRadius: 40, borderTopRightRadius: 40, marginTop: 10 }}>
                {loading && !isRefreshing ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#0F172A" />
                        <Text style={{ marginTop: 16, color: '#94A3B8', fontWeight: '700' }}>Synchronizing Data...</Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>

                        {activeTab === 'overview' && (
                            <View>
                                <View style={{ backgroundColor: '#1E293B', padding: 24, borderRadius: 32, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 }}>
                                    <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>TOTAL CONVERSIONS</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 8 }}>
                                        <Text style={{ color: 'white', fontSize: 42, fontWeight: '900' }}>{stats.totalRefs}</Text>
                                        <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 10 }}>
                                            <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '900' }}>{stats.growthRate}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 16 }}>
                                    <View style={{ flex: 1, backgroundColor: 'white', padding: 20, borderRadius: 28, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                        <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '800' }}>LIABILITY</Text>
                                        <Text style={{ color: '#0F172A', fontSize: 20, fontWeight: '900', marginTop: 4 }}>{stats.liability.toLocaleString()} <Text style={{ fontSize: 10 }}>AMC</Text></Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: 'white', padding: 20, borderRadius: 28, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                        <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '800' }}>ACTIVE CAMPAIGNS</Text>
                                        <Text style={{ color: '#0F172A', fontSize: 20, fontWeight: '900', marginTop: 4 }}>Elite One</Text>
                                    </View>
                                </View>

                                <View style={{ marginTop: 32, backgroundColor: '#F0F9FF', padding: 24, borderRadius: 32, borderLeftWidth: 6, borderLeftColor: '#3B82F6' }}>
                                    <Text style={{ color: '#1E40AF', fontSize: 16, fontWeight: '900' }}>Intelligence Insight</Text>
                                    <Text style={{ color: '#3B82F6', fontSize: 13, marginTop: 4, lineHeight: 18 }}>Referral engagement is up by 15% this week. Consider increasing the reward for 24 hours to spark a viral loop.</Text>
                                </View>
                            </View>
                        )}

                        {activeTab === 'activity' && (
                            <View>
                                <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 4, flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                    <Ionicons name="search" size={18} color="#94A3B8" style={{ marginLeft: 16 }} />
                                    <TextInput
                                        placeholder="Filter activity..."
                                        style={{ flex: 1, height: 52, paddingHorizontal: 12, fontWeight: '600' }}
                                        value={activitySearch}
                                        onChangeText={handleActivitySearch}
                                    />
                                </View>
                                {filteredActivities.map((act, i) => (
                                    <View key={i} style={{ backgroundColor: 'white', borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                            <UserAvatar user={act.referrer} size={44} border="#E2E8F0" />
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <Text style={{ fontWeight: '900', color: '#0F172A' }}>{act.referrer?.full_name?.split(' ')[0]}</Text>
                                                    <Ionicons name="arrow-forward" size={12} color="#94A3B8" style={{ marginHorizontal: 6 }} />
                                                    <Text style={{ fontWeight: '900', color: '#0F172A' }}>{act.referred?.full_name?.split(' ')[0]}</Text>
                                                </View>
                                                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{new Date(act.created_at).toLocaleDateString()} • {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                            </View>
                                            <Text style={{ fontWeight: '900', color: '#10B981' }}>+{act.reward_amount}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        {activeTab === 'rankings' && (
                            <View>
                                <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 4, flexDirection: 'row', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                    <Ionicons name="search" size={18} color="#94A3B8" style={{ marginLeft: 16 }} />
                                    <TextInput
                                        placeholder="Find an ambassador..."
                                        style={{ flex: 1, height: 52, paddingHorizontal: 12, fontWeight: '600' }}
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                    />
                                </View>
                                {rankings.filter(u => u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())).map((u, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        onPress={() => fetchAmbassadorDetails(u)}
                                        style={{ backgroundColor: 'white', borderRadius: 28, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' }}
                                    >
                                        <View style={{ marginRight: 16, position: 'relative' }}>
                                            <UserAvatar user={u} size={50} border={i < 3 ? '#F59E0B' : '#F1F5F9'} />
                                            {i < 3 && (
                                                <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#F59E0B', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
                                                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>{i + 1}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: '900', color: '#0F172A', fontSize: 16 }}>{u.full_name}</Text>
                                            <Text style={{ fontSize: 12, color: '#94A3B8' }}>{u.referral_code}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ fontWeight: '900', color: '#10B981', fontSize: 18 }}>{u.mafhal_coins.toLocaleString()}</Text>
                                            <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '800' }}>AMC</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {activeTab === 'settings' && (
                            <View style={{ backgroundColor: 'white', borderRadius: 32, padding: 24, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 28 }}>Campaign Engine</Text>

                                <View style={{ marginBottom: 20 }}>
                                    <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '900', marginBottom: 8, letterSpacing: 1 }}>REFERRER BOUNTY (AMC)</Text>
                                    <TextInput
                                        style={{ backgroundColor: '#F8FAFC', padding: 18, borderRadius: 16, fontSize: 18, fontWeight: '900', color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' }}
                                        value={(referralSettings.reward_per_referral ?? 0).toString()}
                                        onChangeText={(val) => setReferralSettings({ ...referralSettings, reward_per_referral: val })}
                                        keyboardType="numeric"
                                    />
                                    <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Paid to the Ambassador (Referrer)</Text>
                                </View>

                                <View style={{ marginBottom: 28 }}>
                                    <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '900', marginBottom: 8, letterSpacing: 1 }}>NEW JOINER GIFT (AMC)</Text>
                                    <TextInput
                                        style={{ backgroundColor: '#F8FAFC', padding: 18, borderRadius: 16, fontSize: 18, fontWeight: '900', color: '#3B82F6', borderWidth: 1, borderColor: '#E2E8F0' }}
                                        value={(referralSettings.new_user_reward ?? 0).toString()}
                                        onChangeText={(val) => setReferralSettings({ ...referralSettings, new_user_reward: val })}
                                        keyboardType="numeric"
                                    />
                                    <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Paid to the User who joins via link</Text>
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, backgroundColor: '#F8FAFC', padding: 18, borderRadius: 24 }}>
                                    <View>
                                        <Text style={{ fontSize: 15, fontWeight: '900', color: '#0F172A' }}>Campaign Status</Text>
                                        <Text style={{ fontSize: 12, color: '#64748B' }}>Enable/Disable all referral coins</Text>
                                    </View>
                                    <Switch
                                        value={referralSettings.is_campaign_active}
                                        onValueChange={(val) => setReferralSettings({ ...referralSettings, is_campaign_active: val })}
                                        trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={updateSettings}
                                    style={{ backgroundColor: '#0F172A', padding: 22, borderRadius: 24, alignItems: 'center' }}
                                >
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>Deploy Changes</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={{ height: 60 }} />
                    </ScrollView>
                )}
            </View>

            {/* AMBASSADOR DRILL-DOWN MODAL */}
            <Modal visible={!!selectedAmbassador} animationType="slide" transparent={true}>
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.95)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, height: '85%', padding: 24 }}>
                        {selectedAmbassador && (
                            <>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                                    <View>
                                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A' }}>{selectedAmbassador.full_name}</Text>
                                        <Text style={{ color: '#10B981', fontWeight: '800' }}>Protocol Analysis</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setSelectedAmbassador(null)} style={{ width: 48, height: 48, backgroundColor: '#F1F5F9', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="close" size={28} color="#0F172A" />
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
                                    <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20 }}>
                                        <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900' }}>TOTAL COINS</Text>
                                        <Text style={{ color: '#0F172A', fontSize: 20, fontWeight: '900' }}>{selectedAmbassador.mafhal_coins}</Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20 }}>
                                        <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900' }}>REFERRALS</Text>
                                        <Text style={{ color: '#0F172A', fontSize: 20, fontWeight: '900' }}>{ambassadorRefs.length}</Text>
                                    </View>
                                </View>

                                <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 16 }}>Network Map</Text>
                                {loadingDrill ? (
                                    <ActivityIndicator color="#0F172A" style={{ marginTop: 20 }} />
                                ) : (
                                    <FlatList
                                        data={ambassadorRefs}
                                        showsVerticalScrollIndicator={false}
                                        keyExtractor={(item) => item.id}
                                        renderItem={({ item }) => (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                                <UserAvatar user={item.referred} size={40} />
                                                <View style={{ flex: 1, marginLeft: 16 }}>
                                                    <Text style={{ fontWeight: '800', color: '#1E293B' }}>{item.referred?.full_name}</Text>
                                                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                                </View>
                                                <Text style={{ fontWeight: '800', color: '#10B981' }}>+{item.reward_amount} AMC</Text>
                                            </View>
                                        )}
                                        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#94A3B8' }}>No referrals tracked for this ambassador.</Text>}
                                    />
                                )}
                            </>
                        )}
                        <TouchableOpacity
                            onPress={() => setSelectedAmbassador(null)}
                            style={{ backgroundColor: '#0F172A', padding: 20, borderRadius: 24, alignItems: 'center', marginTop: 20 }}
                        >
                            <Text style={{ color: 'white', fontWeight: '900' }}>Close Analysis</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
