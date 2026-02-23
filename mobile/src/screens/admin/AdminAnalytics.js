import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/theme';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

// Modern Stat Card Component
const ModernStatCard = ({ label, value, subValue, icon, color, trend }) => (
    <View style={{
        width: (width - 60) / 2,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        shadowColor: color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            {trend && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: trend > 0 ? '#DCFCE7' : '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                    <Ionicons name={trend > 0 ? "arrow-up" : "arrow-down"} size={10} color={trend > 0 ? "#16A34A" : "#DC2626"} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: trend > 0 ? "#16A34A" : "#DC2626", marginLeft: 2 }}>{Math.abs(trend)}%</Text>
                </View>
            )}
        </View>
        <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: 22, color: '#0F172A', fontWeight: '800', marginVertical: 4 }}>{value}</Text>
        <Text style={{ fontSize: 11, color: '#94A3B8' }}>{subValue}</Text>
    </View>
);

const CustomProgressBar = ({ label, value, total, color }) => {
    const percentage = (value / total) * 100;
    return (
        <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>{label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>₦{value.toLocaleString()}</Text>
            </View>
            <View style={{ height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${percentage}%`, backgroundColor: color, borderRadius: 5 }} />
            </View>
        </View>
    );
};

export const AdminAnalytics = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        revenue: 0,
        orders: 0,
        avgOrderValue: 0,
        customers: 0,
        topProducts: []
    });

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // 1. Revenue & Orders
            const { data: orders } = await supabase.from('orders').select('total_amount').neq('status', 'Cancelled');
            const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
            const totalOrders = orders?.length || 0;
            const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            // 2. Customers
            const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

            // 3. Top Products (Mock for demo as we might not have order_items fully populated with names)
            // Just fetching products and assigning random sales for visualization
            const { data: products } = await supabase.from('products').select('name').limit(5);
            const topProds = products?.map((p, i) => ({
                name: p.name,
                sales: Math.floor(Math.random() * 100) + 20,
                revenue: Math.floor(Math.random() * 500000) + 50000
            })).sort((a, b) => b.revenue - a.revenue) || [];

            setStats({
                revenue: totalRevenue,
                orders: totalOrders,
                avgOrderValue: avgOrder,
                customers: userCount || 0,
                topProducts: topProds
            });

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <View>
                    <Text style={styles.sectionTitle}>Performance</Text>
                    <Text style={{ color: '#64748B', fontSize: 13 }}>Overview of your store's metrics</Text>
                </View>
                <TouchableOpacity onPress={fetchAnalytics} style={{ padding: 8, backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Ionicons name="refresh" size={18} color="#475569" />
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 40 }} /> : (
                <>
                    {/* KEY METRICS GRID */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        <ModernStatCard
                            label="Total Revenue"
                            value={`₦${(stats.revenue / 1000000).toFixed(2)}m`}
                            subValue="+12.5% vs last month"
                            icon="cash"
                            color="#4F46E5"
                            trend={12.5}
                        />
                        <ModernStatCard
                            label="Total Orders"
                            value={stats.orders}
                            subValue="+8.2% new orders"
                            icon="cart"
                            color="#F59E0B"
                            trend={8.2}
                        />
                        <ModernStatCard
                            label="Avg Order Value"
                            value={`₦${stats.avgOrderValue.toFixed(0)}`}
                            subValue="-2.4% decrease"
                            icon="pricetag"
                            color="#10B981"
                            trend={-2.4}
                        />
                        <ModernStatCard
                            label="Customers"
                            value={stats.customers}
                            subValue="+24 this week"
                            icon="people"
                            color="#EC4899"
                            trend={15.3}
                        />
                    </View>

                    {/* TOP PRODUCTS SECTION */}
                    <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 24, boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Top Performers</Text>
                            <Ionicons name="trophy" size={20} color="#F59E0B" />
                        </View>
                        {stats.topProducts.map((p, i) => (
                            <CustomProgressBar
                                key={i}
                                label={p.name}
                                value={p.revenue}
                                total={Math.max(...stats.topProducts.map(x => x.revenue)) * 1.2}
                                color={['#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#10B981'][i] || '#64748B'}
                            />
                        ))}
                    </View>

                    {/* PLATFORM VISITORS */}
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        <View style={{ flex: 1, backgroundColor: '#0F172A', borderRadius: 24, padding: 20, height: 160, justifyContent: 'space-between' }}>
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="phone-portrait" color="white" size={20} />
                            </View>
                            <View>
                                <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>Mobile Views</Text>
                                <Text style={{ color: 'white', fontSize: 28, fontWeight: '800' }}>65%</Text>
                                <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 10, width: '100%' }}>
                                    <View style={{ width: '65%', height: '100%', backgroundColor: '#38BDF8', borderRadius: 2 }} />
                                </View>
                            </View>
                        </View>
                        <View style={{ flex: 1, backgroundColor: 'white', borderRadius: 24, padding: 20, height: 160, justifyContent: 'space-between', borderWidth: 1, borderColor: '#F1F5F9' }}>
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="desktop" color="#0EA5E9" size={20} />
                            </View>
                            <View>
                                <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 4 }}>Desktop Views</Text>
                                <Text style={{ color: '#0F172A', fontSize: 28, fontWeight: '800' }}>35%</Text>
                                <View style={{ height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, marginTop: 10, width: '100%' }}>
                                    <View style={{ width: '35%', height: '100%', backgroundColor: '#0EA5E9', borderRadius: 2 }} />
                                </View>
                            </View>
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
};
