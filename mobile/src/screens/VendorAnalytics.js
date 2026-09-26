import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');
const GOLD = '#D9A73A';
const NAVY = '#0B132B';

export const VendorAnalytics = ({
    orders = [],
    products = [],
    stats = {},
    vendor = {},
    onBack,
    onSelectTab
}) => {
    // 1. Calculate Real Analytics from Orders
    const analytics = useMemo(() => {
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const sevenDaysMs = 7 * oneDayMs;
        const thirtyDaysMs = 30 * oneDayMs;

        let todaySales = 0;
        let weekSales = 0;
        let monthSales = 0;
        let lifetimeSales = 0;

        let deliveredCount = 0;
        let cancelledCount = 0;
        let activeCount = 0;

        // Days of week tracking (past 7 days)
        const dayBuckets = [
            { label: 'Sun', amount: 0 },
            { label: 'Mon', amount: 0 },
            { label: 'Tue', amount: 0 },
            { label: 'Wed', amount: 0 },
            { label: 'Thu', amount: 0 },
            { label: 'Fri', amount: 0 },
            { label: 'Sat', amount: 0 }
        ];

        // Product sales aggregation
        const prodSalesMap = new Map();

        orders.forEach(ord => {
            const rawDate = ord.raw_date ? new Date(ord.raw_date).getTime() : now;
            const diff = now - rawDate;
            const amt = Number(ord.amount || ord.price || 0);
            const status = (ord.status || 'pending').toLowerCase();

            if (status === 'delivered') {
                lifetimeSales += amt;
                deliveredCount++;

                if (diff <= oneDayMs) todaySales += amt;
                if (diff <= sevenDaysMs) weekSales += amt;
                if (diff <= thirtyDaysMs) monthSales += amt;

                // Day of week bucket
                const dayIdx = new Date(rawDate).getDay();
                if (dayBuckets[dayIdx]) {
                    dayBuckets[dayIdx].amount += amt;
                }
            } else if (status === 'cancelled') {
                cancelledCount++;
            } else {
                activeCount++;
            }

            // Group by item
            const prodKey = ord.item || 'Store Product';
            const current = prodSalesMap.get(prodKey) || {
                name: prodKey,
                image: ord.image,
                units: 0,
                revenue: 0
            };
            current.units += Number(ord.quantity || 1);
            current.revenue += amt;
            prodSalesMap.set(prodKey, current);
        });

        const totalOrders = orders.length;
        const aov = deliveredCount > 0 ? Math.round(lifetimeSales / deliveredCount) : 0;
        const completionRate = totalOrders > 0
            ? Math.round((deliveredCount / totalOrders) * 100)
            : 100;

        // Top products sorted by revenue
        const topProducts = Array.from(prodSalesMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Find max bucket for bar chart scale
        const maxBucketAmt = Math.max(...dayBuckets.map(b => b.amount), 1000);

        return {
            todaySales,
            weekSales,
            monthSales,
            lifetimeSales,
            deliveredCount,
            cancelledCount,
            activeCount,
            totalOrders,
            aov,
            completionRate,
            dayBuckets,
            maxBucketAmt,
            topProducts
        };
    }, [orders]);

    // 2. Export PDF Report
    const handleExportAnalyticsPdf = async () => {
        try {
            const storeName = vendor?.business_name || vendor?.name || 'Abu Mafhal Merchant';
            const htmlContent = `
                <html>
                    <head>
                        <style>
                            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 24px; color: #0F172A; }
                            .header { border-bottom: 2px solid #D9A73A; padding-bottom: 12px; margin-bottom: 20px; }
                            .title { font-size: 24px; font-weight: 900; color: #0F172A; margin: 0; }
                            .sub { font-size: 13px; color: #64748B; margin-top: 4px; }
                            .metrics { display: flex; justify-content: space-between; margin-bottom: 24px; }
                            .metric-card { flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; margin-right: 10px; background: #F8FAFC; }
                            .metric-card:last-child { margin-right: 0; }
                            .m-label { font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: 700; }
                            .m-val { font-size: 20px; font-weight: 900; color: #0F172A; margin-top: 4px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                            th, td { border: 1px solid #E2E8F0; padding: 10px; text-align: left; font-size: 13px; }
                            th { background: #0F172A; color: white; font-weight: 700; }
                            .delivered { color: #16A34A; font-weight: bold; }
                            .pending { color: #D97706; font-weight: bold; }
                            .footer { margin-top: 30px; font-size: 11px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1 class="title">${storeName}</h1>
                            <div class="sub">Store Performance & Sales Intelligence Report • Generated: ${new Date().toLocaleString()}</div>
                        </div>

                        <div class="metrics">
                            <div class="metric-card">
                                <div class="m-label">Total Revenue</div>
                                <div class="m-val">₦${analytics.lifetimeSales.toLocaleString()}</div>
                            </div>
                            <div class="metric-card">
                                <div class="m-label">Past 30 Days</div>
                                <div class="m-val">₦${analytics.monthSales.toLocaleString()}</div>
                            </div>
                            <div class="metric-card">
                                <div class="m-label">Total Orders</div>
                                <div class="m-val">${analytics.totalOrders}</div>
                            </div>
                            <div class="metric-card">
                                <div class="m-label">Completion Rate</div>
                                <div class="m-val">${analytics.completionRate}%</div>
                            </div>
                        </div>

                        <h3>Top-Selling Products</h3>
                        <table>
                            <tr><th>Product Name</th><th>Units Sold</th><th>Total Revenue (₦)</th></tr>
                            ${analytics.topProducts.map(p => `
                                <tr>
                                    <td>${p.name}</td>
                                    <td>${p.units}</td>
                                    <td>₦${p.revenue.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </table>

                        <div class="footer">
                            Official Abu Mafhal Marketplace Merchant Analytics • Verified Secure System
                        </div>
                    </body>
                </html>
            `;
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (err) {
            console.error('PDF export error:', err);
            Alert.alert('Error', 'Could not export analytics report.');
        }
    };

    return (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {/* Header Strip with PDF Export */}
            <View style={styles.topHeader}>
                <View>
                    <Text style={styles.screenTitle}>Sales Analytics</Text>
                    <Text style={styles.screenSub}>Real-time store performance & intelligence</Text>
                </View>

                <TouchableOpacity
                    onPress={handleExportAnalyticsPdf}
                    style={styles.exportBtn}
                    activeOpacity={0.8}
                >
                    <Ionicons name="download-outline" size={16} color="#0F172A" />
                    <Text style={styles.exportBtnText}>Export PDF</Text>
                </TouchableOpacity>
            </View>

            {/* Lifetime Revenue Hero Card */}
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.heroLabel}>Total Gross Earnings</Text>
                    <View style={styles.growthBadge}>
                        <Ionicons name="trending-up" size={13} color="#10B981" />
                        <Text style={styles.growthBadgeText}>Live Sales</Text>
                    </View>
                </View>

                <Text style={styles.heroValue}>₦{analytics.lifetimeSales.toLocaleString()}</Text>

                <View style={styles.heroDivider} />

                {/* Sub-Periods Strip */}
                <View style={styles.periodsRow}>
                    <View style={styles.periodItem}>
                        <Text style={styles.periodLabel}>Today</Text>
                        <Text style={styles.periodVal}>₦{analytics.todaySales.toLocaleString()}</Text>
                    </View>
                    <View style={styles.periodDivider} />
                    <View style={styles.periodItem}>
                        <Text style={styles.periodLabel}>Past 7 Days</Text>
                        <Text style={styles.periodVal}>₦{analytics.weekSales.toLocaleString()}</Text>
                    </View>
                    <View style={styles.periodDivider} />
                    <View style={styles.periodItem}>
                        <Text style={styles.periodLabel}>Past 30 Days</Text>
                        <Text style={styles.periodVal}>₦{analytics.monthSales.toLocaleString()}</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* 3 Core Quality KPI Cards */}
            <View style={styles.kpiRow}>
                {/* Average Order Value */}
                <View style={styles.kpiCard}>
                    <View style={[styles.kpiIconBox, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="pricetag" size={16} color="#2563EB" />
                    </View>
                    <Text style={styles.kpiCardLabel}>Avg. Order Value</Text>
                    <Text style={styles.kpiCardVal}>₦{analytics.aov.toLocaleString()}</Text>
                </View>

                {/* Fulfillment Rate */}
                <View style={styles.kpiCard}>
                    <View style={[styles.kpiIconBox, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="shield-checkmark" size={16} color="#059669" />
                    </View>
                    <Text style={styles.kpiCardLabel}>Fulfillment Rate</Text>
                    <Text style={[styles.kpiCardVal, { color: '#059669' }]}>{analytics.completionRate}%</Text>
                </View>

                {/* Total Orders */}
                <View style={styles.kpiCard}>
                    <View style={[styles.kpiIconBox, { backgroundColor: '#FDF4FF' }]}>
                        <Ionicons name="bag-check" size={16} color="#C026D3" />
                    </View>
                    <Text style={styles.kpiCardLabel}>Total Delivered</Text>
                    <Text style={styles.kpiCardVal}>{analytics.deliveredCount}</Text>
                </View>
            </View>

            {/* Weekly Revenue Bar Chart */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                    <Text style={styles.sectionTitle}>Weekly Revenue Distribution</Text>
                    <Text style={styles.sectionSub}>By day of week</Text>
                </View>

                <View style={styles.chartContainer}>
                    {analytics.dayBuckets.map((bucket, idx) => {
                        const barHeight = Math.max(
                            8,
                            Math.round((bucket.amount / analytics.maxBucketAmt) * 90)
                        );
                        const isHighest = bucket.amount === analytics.maxBucketAmt && bucket.amount > 0;

                        return (
                            <View key={idx} style={styles.barCol}>
                                <View style={styles.barTrack}>
                                    <View
                                        style={[
                                            styles.barFill,
                                            {
                                                height: barHeight,
                                                backgroundColor: isHighest ? GOLD : '#3B82F6'
                                            }
                                        ]}
                                    />
                                </View>
                                <Text style={styles.barLabel}>{bucket.label}</Text>
                                <Text style={styles.barVal} numberOfLines={1}>
                                    {bucket.amount > 0 ? `₦${Math.round(bucket.amount / 1000)}k` : '0'}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Top Selling Products */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                    <Text style={styles.sectionTitle}>Top-Selling Products</Text>
                    <Text style={styles.sectionSub}>Ranked by store revenue</Text>
                </View>

                {analytics.topProducts.length > 0 ? (
                    analytics.topProducts.map((prod, idx) => (
                        <View key={idx} style={styles.topProdRow}>
                            <View style={styles.rankCircle}>
                                <Text style={styles.rankText}>#{idx + 1}</Text>
                            </View>

                            <Image
                                source={{ uri: prod.image || 'https://placehold.co/60' }}
                                style={styles.prodThumb}
                                resizeMode="cover"
                            />

                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.topProdName} numberOfLines={1}>
                                    {prod.name}
                                </Text>
                                <Text style={styles.topProdUnits}>
                                    {prod.units} {prod.units === 1 ? 'unit' : 'units'} sold
                                </Text>
                            </View>

                            <Text style={styles.topProdRevenue}>
                                ₦{prod.revenue.toLocaleString()}
                            </Text>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="bar-chart-outline" size={32} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No product sales yet</Text>
                        <Text style={styles.emptySub}>Sales rankings will appear here as orders complete.</Text>
                    </View>
                )}
            </View>

            {/* Order Status Breakdown */}
            <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Orders Status Breakdown</Text>

                <View style={styles.statusBreakdownGrid}>
                    <View style={[styles.statusBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                        <Text style={[styles.statusBoxNum, { color: '#059669' }]}>{analytics.deliveredCount}</Text>
                        <Text style={styles.statusBoxLabel}>Delivered</Text>
                    </View>

                    <View style={[styles.statusBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                        <Text style={[styles.statusBoxNum, { color: '#2563EB' }]}>{analytics.activeCount}</Text>
                        <Text style={styles.statusBoxLabel}>In Progress</Text>
                    </View>

                    <View style={[styles.statusBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                        <Text style={[styles.statusBoxNum, { color: '#DC2626' }]}>{analytics.cancelledCount}</Text>
                        <Text style={styles.statusBoxLabel}>Cancelled</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 110
    },
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
    },
    screenTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.3
    },
    screenSub: {
        fontSize: 11.5,
        color: '#64748B',
        marginTop: 2
    },
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: GOLD,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10
    },
    exportBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A'
    },
    heroCard: {
        borderRadius: 20,
        padding: 18,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3
    },
    heroLabel: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    growthBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    growthBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#34D399'
    },
    heroValue: {
        fontSize: 32,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -1,
        marginTop: 6
    },
    heroDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 14
    },
    periodsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    periodItem: {
        flex: 1,
        alignItems: 'center'
    },
    periodLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '600'
    },
    periodVal: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
        marginTop: 2
    },
    periodDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)'
    },
    kpiRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
        marginTop: 14
    },
    kpiCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    kpiIconBox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8
    },
    kpiCardLabel: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '700'
    },
    kpiCardVal: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: 2
    },
    sectionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    sectionCardHeader: {
        marginBottom: 14
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A'
    },
    sectionSub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 1
    },
    chartContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 140,
        paddingTop: 10,
        paddingHorizontal: 4
    },
    barCol: {
        alignItems: 'center',
        flex: 1
    },
    barTrack: {
        height: 95,
        width: 22,
        justifyContent: 'flex-end',
        alignItems: 'center'
    },
    barFill: {
        width: 14,
        borderRadius: 7
    },
    barLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
        marginTop: 6
    },
    barVal: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94A3B8',
        marginTop: 1
    },
    topProdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9'
    },
    rankCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    rankText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B'
    },
    prodThumb: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginLeft: 8,
        backgroundColor: '#F1F5F9'
    },
    topProdName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A'
    },
    topProdUnits: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1
    },
    topProdRevenue: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#10B981'
    },
    statusBreakdownGrid: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12
    },
    statusBox: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1
    },
    statusBoxNum: {
        fontSize: 18,
        fontWeight: '900'
    },
    statusBoxLabel: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '700',
        marginTop: 2
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 20
    },
    emptyText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
        marginTop: 6
    },
    emptySub: {
        fontSize: 11,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 2
    }
});
