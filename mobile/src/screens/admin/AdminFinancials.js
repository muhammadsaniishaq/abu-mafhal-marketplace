import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Navy and Gold Light Aesthetic Palette
const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

const StatCard = ({ label, value, sub, icon, isGold, tag }) => (
    <View style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: isGold ? 'rgba(217, 167, 58, 0.4)' : '#E2E8F0',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 4 }}>
                <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    {label}
                </Text>
                <Text style={{ color: NAVY, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                    {value}
                </Text>
            </View>
            <View style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: isGold ? 'rgba(217, 167, 58, 0.15)' : 'rgba(14, 26, 46, 0.06)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: isGold ? 'rgba(217, 167, 58, 0.3)' : 'transparent'
            }}>
                <Ionicons name={icon} size={19} color={isGold ? GOLD : NAVY} />
            </View>
        </View>
        {sub && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                {tag && (
                    <View style={{ backgroundColor: 'rgba(217, 167, 58, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: GOLD }}>{tag}</Text>
                    </View>
                )}
                <Text style={{ color: '#64748B', fontSize: 10.5, fontWeight: '600' }}>{sub}</Text>
            </View>
        )}
    </View>
);

export const AdminFinancials = () => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState({
        totalRevenue: 0,
        platformCommission: 0,
        vendorEarnings: 0,
        pendingPayouts: 0,
        completedPayouts: 0,
        totalOrdersCount: 0
    });

    useEffect(() => {
        fetchFinancials();
    }, []);

    const fetchFinancials = async () => {
        try {
            // 1. Try consolidated financial stats via RPC
            let totalRevenue = 0;
            let platformCommission = 0;
            let vendorEarnings = 0;
            let pendingPayouts = 0;
            let completedPayouts = 0;
            let totalOrdersCount = 0;

            const { data: finStats, error: rpcError } = await supabase.rpc('get_admin_financial_stats');

            if (!rpcError && finStats) {
                totalRevenue = Number(finStats.total_revenue || 0);
                platformCommission = Number(finStats.platform_commission || 0);
                vendorEarnings = Number(finStats.vendor_earnings || 0);
                pendingPayouts = Number(finStats.pending_payouts_total || 0);
                completedPayouts = Number(finStats.completed_payouts_total || 0);
            } else {
                // Robust direct queries fallback
                const { data: ordersData } = await supabase
                    .from('orders')
                    .select('total_amount, status');

                if (ordersData && ordersData.length > 0) {
                    totalOrdersCount = ordersData.length;
                    totalRevenue = ordersData.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
                    // 5% standard marketplace platform commission
                    platformCommission = Math.round(totalRevenue * 0.05);
                    vendorEarnings = Math.max(0, totalRevenue - platformCommission);
                }

                // Vendor payouts calculation
                const { data: vpData } = await supabase
                    .from('vendor_payouts')
                    .select('amount, status');

                if (vpData && vpData.length > 0) {
                    vpData.forEach(p => {
                        const amt = Number(p.amount || 0);
                        if (p.status === 'paid' || p.status === 'completed') completedPayouts += amt;
                        else if (p.status === 'pending') pendingPayouts += amt;
                    });
                }

                // Driver payouts calculation
                const { data: dpData } = await supabase
                    .from('driver_payouts')
                    .select('amount, status');

                if (dpData && dpData.length > 0) {
                    dpData.forEach(p => {
                        const amt = Number(p.amount || 0);
                        if (p.status === 'paid' || p.status === 'completed') completedPayouts += amt;
                        else if (p.status === 'pending') pendingPayouts += amt;
                    });
                }
            }

            setData({
                totalRevenue,
                platformCommission,
                vendorEarnings,
                pendingPayouts,
                completedPayouts,
                totalOrdersCount
            });
        } catch (err) {
            console.error("Admin Financials Fetch Error:", err);
            Alert.alert('Bayanin Kudi', 'Ba a iya loda cikakkun bayanan kudi ba. Duba layin sadarwa.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchFinancials();
    };

    const formatNaira = (amount) => {
        return '₦' + Number(amount || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
    };

    const totalPayoutVolume = (data.completedPayouts + data.pendingPayouts) || 1;
    const completedPct = Math.round((data.completedPayouts / totalPayoutVolume) * 100);

    return (
        <ScrollView 
            style={{ flex: 1, backgroundColor: '#F8FAFC' }} 
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[GOLD, NAVY]} />}
        >
            {/* TOP HERO CARD */}
            <LinearGradient
                colors={[NAVY, '#162235']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    borderRadius: 22,
                    padding: 20,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(217, 167, 58, 0.35)',
                    shadowColor: NAVY,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 10,
                    elevation: 3
                }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                        <Text style={{ color: GOLD, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }}>
                            KUDADEN KASUWA (LIVE)
                        </Text>
                    </View>
                    <TouchableOpacity 
                        onPress={handleRefresh}
                        style={{
                            width: 32, 
                            height: 32, 
                            borderRadius: 10, 
                            backgroundColor: 'rgba(217, 167, 58, 0.15)', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: 'rgba(217, 167, 58, 0.3)'
                        }}
                    >
                        <Ionicons name="refresh" size={16} color={GOLD} />
                    </TouchableOpacity>
                </View>

                <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700' }}>Cikakkun Kudaden Shiga (Gross Revenue)</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 4 }}>
                    {formatNaira(data.totalRevenue)}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '700' }}>Rabon Kasuwa (Commission)</Text>
                        <Text style={{ color: GOLD, fontSize: 16, fontWeight: '900', marginTop: 2 }}>{formatNaira(data.platformCommission)}</Text>
                    </View>
                    <View style={{ width: 1, height: 28, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '700' }}>Kudin Dillalai (Vendor Share)</Text>
                        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 2 }}>{formatNaira(data.vendorEarnings)}</Text>
                    </View>
                </View>
            </LinearGradient>

            {loading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#64748B' }}>Ana lissafa kudaden kasuwa...</Text>
                </View>
            ) : (
                <View style={{ gap: 12 }}>
                    {/* STAT CARDS 2x2 */}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <StatCard 
                            label="Kudin Shiga" 
                            value={formatNaira(data.totalRevenue)} 
                            icon="cash-outline" 
                            isGold={false} 
                            sub="Duka cinikin da aka yi"
                        />
                        <StatCard 
                            label="Kason Kasuwa" 
                            value={formatNaira(data.platformCommission)} 
                            icon="pie-chart-outline" 
                            isGold={true} 
                            tag="5% Take"
                            sub="Ribar dandamali"
                        />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <StatCard 
                            label="Kudin Yan Kasuwa" 
                            value={formatNaira(data.vendorEarnings)} 
                            icon="wallet-outline" 
                            isGold={false} 
                            sub="Hakkin masu shaguna"
                        />
                        <StatCard 
                            label="Biyan da ke Jira" 
                            value={formatNaira(data.pendingPayouts)} 
                            icon="hourglass-outline" 
                            isGold={true} 
                            tag="Pending"
                            sub="Bukatar amincewa"
                        />
                    </View>

                    {/* PAYOUT BREAKDOWN BAR */}
                    <View style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 20,
                        padding: 18,
                        marginTop: 6,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        shadowColor: NAVY,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 6,
                        elevation: 1
                    }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ fontSize: 13, fontWeight: '900', color: NAVY }}>
                                Matsayin Biyan Kudade (Payout Ratio)
                            </Text>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: GOLD }}>
                                {completedPct}% An Biya
                            </Text>
                        </View>

                        {/* Progress Bar */}
                        <View style={{ height: 14, flexDirection: 'row', borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F5F9' }}>
                            <View style={{ flex: Math.max(data.completedPayouts, 1), backgroundColor: '#10B981' }} />
                            <View style={{ flex: Math.max(data.pendingPayouts, 0.1), backgroundColor: GOLD }} />
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' }} />
                                <View>
                                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>Wadanda Aka Biya</Text>
                                    <Text style={{ fontSize: 13, color: NAVY, fontWeight: '900', marginTop: 1 }}>{formatNaira(data.completedPayouts)}</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD }} />
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>Wadanda Ke Jira</Text>
                                    <Text style={{ fontSize: 13, color: GOLD, fontWeight: '900', marginTop: 1 }}>{formatNaira(data.pendingPayouts)}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            )}
        </ScrollView>
    );
};
