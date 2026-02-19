import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { styles } from '../../styles/theme';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export const AdminReferrals = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalRefs: 0, liability: 0 });
    const [topUsers, setTopUsers] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        // Note: Real implementation would need a more complex query or multiple queries
        // Assuming profiles has 'mafhal_coins' and 'referral_count' (or similar)

        // 1. Fetch Top Users
        const { data: users } = await supabase
            .from('profiles')
            .select('full_name, mafhal_coins, email') // Assuming these columns exist
            .order('mafhal_coins', { ascending: false })
            .limit(10);

        // 2. Mock aggregate stats for demo if no aggregations available
        const totalCoins = users?.reduce((sum, u) => sum + (u.mafhal_coins || 0), 0) || 0;

        setStats({
            totalRefs: 1240, // Mock
            liability: totalCoins // Each coin worth N1?
        });
        setTopUsers(users || []);
        setLoading(false);
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: 'white' }} contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.sectionTitle}>Referral Manager</Text>

            {loading ? <ActivityIndicator color="#0F172A" /> : (
                <>
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                        <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>Active Referrals</Text>
                            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A' }}>{stats.totalRefs}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>Coin Liability</Text>
                            <Text style={{ fontSize: 24, fontWeight: '800', color: '#F59E0B' }}>{stats.liability}</Text>
                        </View>
                    </View>

                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 }}>Top Ambassadors</Text>
                    {topUsers.map((u, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                            <View style={{ width: 30, height: 30, backgroundColor: i < 3 ? '#FEF3C7' : '#F1F5F9', borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Text style={{ fontWeight: '700', color: i < 3 ? '#D97706' : '#64748B' }}>#{i + 1}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '600', color: '#1E293B' }}>{u.full_name || u.email || 'User'}</Text>
                            </View>
                            <Text style={{ fontWeight: '700', color: '#F59E0B' }}>{u.mafhal_coins || 0} AMC</Text>
                        </View>
                    ))}

                    <View style={{ marginTop: 30, backgroundColor: '#0F172A', borderRadius: 16, padding: 20 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <Ionicons name="megaphone" color="white" size={24} />
                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Double Bonus Campaign</Text>
                        </View>
                        <Text style={{ color: '#94A3B8', marginBottom: 20 }}>Boost referral rewards for all users by 2x.</Text>
                        <TouchableOpacity style={{ backgroundColor: '#3B82F6', padding: 12, borderRadius: 8, alignItems: 'center' }}>
                            <Text style={{ color: 'white', fontWeight: '700' }}>Start Campaign</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </ScrollView>
    );
};
