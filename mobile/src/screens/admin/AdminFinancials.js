import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { styles } from '../../styles/theme';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

// Simple helper for stats card
const StatCard = ({ label, value, sub, color, icon }) => (
    <View style={{ flex: 1, backgroundColor: color, borderRadius: 16, padding: 16, minWidth: 150 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4 }}>{label}</Text>
                <Text style={{ color: 'white', fontSize: 24, fontWeight: '800' }}>{value}</Text>
            </View>
            <Ionicons name={icon} size={24} color="rgba(255,255,255,0.4)" />
        </View>
        {sub && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4 }}>{sub}</Text>}
    </View>
);

export const AdminFinancials = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        totalRevenue: 0,
        platformCommission: 0,
        vendorEarnings: 0,
        pendingPayouts: 0,
        completedPayouts: 0
    });

    useEffect(() => {
        fetchFinancials();
    }, []);

    const fetchFinancials = async () => {
        setLoading(true);
        // 1. Revenue Stats
        const { data: orders } = await supabase.from('orders').select('total_amount').neq('status', 'Cancelled');
        const totalRev = orders?.reduce((s, o) => s + (o.total_amount || 0), 0) || 0;

        // 2. Payout Stats
        const { data: payouts } = await supabase.from('payouts').select('amount, status');
        const pending = payouts?.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0) || 0;
        const completed = payouts?.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0) || 0;

        const commissionRate = 0.05; // 5% example
        const commission = totalRev * commissionRate;
        const earnings = totalRev - commission;

        setData({
            totalRevenue: totalRev,
            platformCommission: commission,
            vendorEarnings: earnings,
            pendingPayouts: pending,
            completedPayouts: completed
        });
        setLoading(false);
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: 'white' }} contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.sectionTitle}>Financial Overview</Text>

            {loading ? <ActivityIndicator color="#0F172A" /> : (
                <View style={{ gap: 16 }}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <StatCard label="Total Revenue" value={`₦${(data.totalRevenue / 1000).toFixed(1)}k`} color="#0F172A" icon="cash" />
                        <StatCard label="Commission" value={`₦${(data.platformCommission / 1000).toFixed(1)}k`} color="#3B82F6" icon="pie-chart" sub="Platform Earnings (5%)" />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <StatCard label="Vendor Earnings" value={`₦${(data.vendorEarnings / 1000).toFixed(1)}k`} color="#10B981" icon="wallet" sub="Disbursable Amount" />
                        <StatCard label="Pending Payouts" value={`₦${(data.pendingPayouts / 1000).toFixed(1)}k`} color="#F59E0B" icon="time" sub="Requests to process" />
                    </View>

                    <View style={{ marginTop: 20, padding: 20, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 16, color: '#0F172A' }}>Payout Status Breakdown</Text>
                        {/* Simple Stacked Bar */}
                        <View style={{ height: 24, flexDirection: 'row', borderRadius: 12, overflow: 'hidden' }}>
                            <View style={{ flex: data.completedPayouts || 1, backgroundColor: '#10B981' }} />
                            <View style={{ flex: data.pendingPayouts || 1, backgroundColor: '#F59E0B' }} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' }} />
                                <Text style={{ fontSize: 12, color: '#64748B' }}>Paid: ₦{data.completedPayouts.toLocaleString()}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#F59E0B' }} />
                                <Text style={{ fontSize: 12, color: '#64748B' }}>Pending: ₦{data.pendingPayouts.toLocaleString()}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            )}
        </ScrollView>
    );
};
