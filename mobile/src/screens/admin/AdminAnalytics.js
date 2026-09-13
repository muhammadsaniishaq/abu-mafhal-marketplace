import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

// Stat Card (Navy & Gold Light Edition)
const EliteStatCard = ({ label, value, subValue, icon, isGold, trend, pulse }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (pulse) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.5, duration: 1200, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
                ])
            ).start();
        }
    }, [pulse]);

    return (
        <View style={{
            width: (width - 44) / 2,
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: isGold ? 'rgba(217, 167, 58, 0.4)' : '#E2E8F0',
            shadowColor: NAVY,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 6,
            elevation: 1,
        }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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
                    <Ionicons name={icon} size={18} color={isGold ? GOLD : NAVY} />
                </View>
                {trend !== undefined && trend !== null && (
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: trend >= 0 ? '#DCFCE7' : '#FEE2E2',
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        borderRadius: 8
                    }}>
                        <Ionicons name={trend >= 0 ? "arrow-up" : "arrow-down"} size={9} color={trend >= 0 ? "#16A34A" : "#DC2626"} />
                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: trend >= 0 ? "#16A34A" : "#DC2626", marginLeft: 2 }}>
                            {Math.abs(trend)}%
                        </Text>
                    </View>
                )}
            </View>
            <Text style={{ fontSize: 10.5, color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {label}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Text numberOfLines={1} style={{ fontSize: 20, color: NAVY, fontWeight: '900' }}>
                    {value}
                </Text>
                {pulse && (
                    <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: GOLD, opacity: pulseAnim }} />
                )}
            </View>
            <Text numberOfLines={1} style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 4, fontWeight: '600' }}>
                {subValue}
            </Text>
        </View>
    );
};

const CategoryDiscoveryBar = ({ label, value, total, color, icon }) => {
    const percentage = Math.min((value / (total || 1)) * 100, 100);
    return (
        <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={icon} size={15} color={color} />
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY }}>{label}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: NAVY }}>{value.toLocaleString()} kayayyaki</Text>
            </View>
            <View style={{ height: 7, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${percentage}%`, backgroundColor: color, borderRadius: 4 }} />
            </View>
        </View>
    );
};

export const AdminAnalytics = () => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isLive, setIsLive] = useState(true);
    const [stats, setStats] = useState({
        revenue: 0,
        ordersCount: 0,
        completedOrdersCount: 0,
        customersCount: 0,
        activeProductsCount: 0,
        totalProductsCount: 0,
        commission: 0,
        velocity: 0,
        recentActivity: [],
        topCategories: [],
        payoutStatus: { paid: 0, pending: 0 }
    });

    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isLive) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
                ])
            ).start();
        }
    }, [isLive]);

    useEffect(() => {
        fetchLiveAnalytics();
        const interval = setInterval(fetchLiveAnalytics, 30000); // 30s live pulse
        return () => clearInterval(interval);
    }, []);

    const fetchLiveAnalytics = async () => {
        try {
            const now = new Date();
            const hourAgo = new Date(now.getTime() - 3600000).toISOString();

            // 1. Fetch exact orders data
            const { data: allOrders } = await supabase
                .from('orders')
                .select('id, total_amount, status, created_at');

            const ordersList = allOrders || [];
            const ordersCount = ordersList.length;
            const completedOrdersCount = ordersList.filter(o => o.status === 'delivered').length;
            const revenue = ordersList.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
            const commission = Math.round(revenue * 0.05);

            // Velocity (orders placed in last hour)
            const velocity = ordersList.filter(o => new Date(o.created_at) >= new Date(hourAgo)).length;

            // 2. Fetch verified customers / profiles count
            const { count: customersCount } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            // 3. Fetch products data & category distribution
            const { data: prodsData } = await supabase
                .from('products')
                .select('id, category, is_active, status');

            const prods = prodsData || [];
            const totalProductsCount = prods.length;
            const activeProductsCount = prods.filter(p => p.is_active !== false && p.status !== 'archived').length;

            const catMap = prods.reduce((acc, p) => {
                const c = p.category || 'Kayan Kasuwa';
                acc[c] = (acc[c] || 0) + 1;
                return acc;
            }, {});

            const colorPalette = ['#0E1A2E', '#D9A73A', '#2563EB', '#10B981', '#7C3AED', '#EC4899'];
            const topCategories = Object.entries(catMap)
                .map(([name, count], index) => ({
                    name,
                    count,
                    color: colorPalette[index % colorPalette.length],
                    icon: name.toLowerCase().includes('fashion') ? 'shirt-outline' : name.toLowerCase().includes('phone') ? 'phone-portrait-outline' : 'cube-outline'
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // 4. Fetch Live Payouts
            let paidPayouts = 0;
            let pendingPayouts = 0;

            const { data: vpData } = await supabase.from('vendor_payouts').select('amount, status');
            (vpData || []).forEach(p => {
                const a = Number(p.amount || 0);
                if (p.status === 'paid' || p.status === 'completed') paidPayouts += a;
                else if (p.status === 'pending') pendingPayouts += a;
            });

            const { data: dpData } = await supabase.from('driver_payouts').select('amount, status');
            (dpData || []).forEach(p => {
                const a = Number(p.amount || 0);
                if (p.status === 'paid' || p.status === 'completed') paidPayouts += a;
                else if (p.status === 'pending') pendingPayouts += a;
            });

            // 5. Recent Activity Logs
            const { data: recentLogs } = await supabase
                .from('audit_logs')
                .select('action, created_at')
                .order('created_at', { ascending: false })
                .limit(4);

            setStats({
                revenue,
                ordersCount,
                completedOrdersCount,
                customersCount: customersCount || 0,
                activeProductsCount,
                totalProductsCount,
                commission,
                velocity,
                recentActivity: recentLogs || [],
                topCategories,
                payoutStatus: {
                    paid: paidPayouts,
                    pending: pendingPayouts
                }
            });

        } catch (err) {
            console.error('Live Analytics Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchLiveAnalytics();
    }, []);

    const formatNaira = (amount) => {
        return '₦' + Number(amount || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <ActivityIndicator size="large" color={GOLD} />
                <Text style={{ marginTop: 14, fontSize: 12, fontWeight: '800', color: '#64748B', letterSpacing: 1 }}>
                    ANA LODA BAYANAN ANALYTICS LIVE...
                </Text>
            </View>
        );
    }

    const orderSuccessRate = stats.ordersCount > 0 ? Math.round((stats.completedOrdersCount / stats.ordersCount) * 100) : 100;
    const activeProductRate = stats.totalProductsCount > 0 ? Math.round((stats.activeProductsCount / stats.totalProductsCount) * 100) : 100;
    const maxCatCount = Math.max(...stats.topCategories.map(c => c.count), 1);

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: '#F8FAFC' }}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
        >
            {/* TOP INTELLIGENCE HEADER */}
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 }}>
                                Kasuwa Intelligence
                            </Text>
                            <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', opacity: pulseAnim }} />
                        </View>
                        <Text style={{ fontSize: 11, color: GOLD, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 }}>
                            KULAWA DA BIBIYAR KASUWA A KOWANE LOKACI
                        </Text>
                    </View>
                    <TouchableOpacity 
                        onPress={onRefresh} 
                        style={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: 12, 
                            backgroundColor: 'rgba(217, 167, 58, 0.15)', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            borderWidth: 1, 
                            borderColor: 'rgba(217, 167, 58, 0.3)' 
                        }}
                    >
                        <Ionicons name="sync" size={18} color={GOLD} />
                    </TouchableOpacity>
                </View>

                {/* RECENT LIVE PULSE BAR */}
                <View style={{ marginTop: 18, backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 14, padding: 12 }}>
                    <Text style={{ fontSize: 9.5, fontWeight: '900', color: GOLD, letterSpacing: 1, marginBottom: 8 }}>
                        AYYUKAN KWANAN NAN (LIVE PULSE)
                    </Text>
                    {stats.recentActivity.length === 0 ? (
                        <Text style={{ color: '#94A3B8', fontSize: 11 }}>Babu wani aiki da aka yi kwanan nan.</Text>
                    ) : (
                        stats.recentActivity.map((log, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: i === stats.recentActivity.length - 1 ? 0 : 6 }}>
                                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: GOLD }} />
                                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                                    {(log.action || 'activity').replace(/_/g, ' ').toUpperCase()}
                                </Text>
                                <Text style={{ color: '#94A3B8', fontSize: 9.5, fontWeight: '600' }}>
                                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        ))
                    )}
                </View>
            </LinearGradient>

            {/* 4 CORE KPI METRICS */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <EliteStatCard
                    label="Kudin Shiga (Gross)"
                    value={formatNaira(stats.revenue)}
                    subValue="Dukkan cinikin kasuwa"
                    icon="cash-outline"
                    isGold={false}
                    trend={10}
                    pulse={true}
                />
                <EliteStatCard
                    label="Kason Kasuwa"
                    value={formatNaira(stats.commission)}
                    subValue="5% na ribar dandamali"
                    icon="pie-chart-outline"
                    isGold={true}
                    trend={5}
                />
                <EliteStatCard
                    label="Masu Sayayya"
                    value={stats.customersCount.toString()}
                    subValue="Masu asusu a kasuwa"
                    icon="people-outline"
                    isGold={false}
                    trend={15}
                />
                <EliteStatCard
                    label="Saurin Ciniki"
                    value={`${stats.velocity} oda/hr`}
                    subValue="Ododin awa 1 da ya wuce"
                    icon="flash-outline"
                    isGold={true}
                    pulse={stats.velocity > 0}
                />
            </View>

            {/* PAYOUT STATUS BREAKDOWN */}
            <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                padding: 18,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                shadowColor: NAVY,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 1
            }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: NAVY, marginBottom: 14 }}>
                    Biyan Kudi Ga Masu Shaguna & Direbobi
                </Text>
                <View style={{ height: 16, flexDirection: 'row', borderRadius: 8, overflow: 'hidden', backgroundColor: '#F1F5F9', marginBottom: 12 }}>
                    <View style={{ flex: Math.max(stats.payoutStatus.paid, 1), backgroundColor: '#10B981' }} />
                    <View style={{ flex: Math.max(stats.payoutStatus.pending, 0.1), backgroundColor: GOLD }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B' }}>AN BIYA (PAID)</Text>
                        <Text style={{ fontSize: 15, fontWeight: '900', color: '#10B981', marginTop: 2 }}>
                            {formatNaira(stats.payoutStatus.paid)}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B' }}>KE JIRA (PENDING)</Text>
                        <Text style={{ fontSize: 15, fontWeight: '900', color: GOLD, marginTop: 2 }}>
                            {formatNaira(stats.payoutStatus.pending)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* CATEGORY DISTRIBUTION (LIGHT THEME) */}
            <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                padding: 18,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                shadowColor: NAVY,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 1
            }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: NAVY }}>
                        Kayan Da Aka Fi Samu a Kasuwa
                    </Text>
                    <Ionicons name="trophy" size={18} color={GOLD} />
                </View>

                {stats.topCategories.length > 0 ? (
                    stats.topCategories.map((cat, i) => (
                        <CategoryDiscoveryBar
                            key={i}
                            label={cat.name}
                            value={cat.count}
                            total={maxCatCount}
                            color={cat.color}
                            icon={cat.icon}
                        />
                    ))
                ) : (
                    <Text style={{ color: '#94A3B8', textAlign: 'center', marginVertical: 14, fontSize: 12 }}>
                        Babu kayayyaki a halin yanzu.
                    </Text>
                )}
            </View>

            {/* OPERATIONAL RATIOS */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(14, 26, 46, 0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <Ionicons name="checkmark-circle-outline" color={NAVY} size={18} />
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: NAVY }}>{orderSuccessRate}%</Text>
                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '800', marginTop: 2 }}>ODAR DA AKA ISAR</Text>
                </View>

                <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.4)' }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(217, 167, 58, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <Ionicons name="cube-outline" color={GOLD} size={18} />
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: NAVY }}>{activeProductRate}%</Text>
                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '800', marginTop: 2 }}>KAYAN DA KE KASUWA</Text>
                </View>
            </View>
        </ScrollView>
    );
};
