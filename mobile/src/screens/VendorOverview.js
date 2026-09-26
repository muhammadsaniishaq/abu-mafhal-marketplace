import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Share,
    Alert,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const GOLD = '#D9A73A';
const GOLD_LIGHT = '#FDE68A';
const NAVY = '#0B132B';

export const VendorOverview = ({
    stats = {},
    orders = [],
    products = [],
    vendor = {},
    onSelectTab,
    onOpenAddProduct,
    onOpenCertificate,
    onViewPublicStore
}) => {
    const hours = new Date().getHours();
    const greeting = hours < 12 ? 'Good Morning' : hours < 18 ? 'Good Afternoon' : 'Good Evening';

    const earnings = Number(stats.earnings || 0);
    const totalOrders = stats.orders || orders.length || 0;
    const totalProducts = stats.products || products.length || 0;
    const followers = stats.followers || 0;

    // Detect low stock or out of stock items
    const lowStockProducts = (products || []).filter(p => {
        const s = p.stock_quantity ?? p.stock ?? 0;
        return s <= 5;
    });

    const recentOrders = (orders || []).slice(0, 3);

    const handleShareWhatsApp = async () => {
        const storeName = vendor?.business_name || vendor?.name || 'Abu Mafhal Store';
        const storeId = vendor?.user_id || vendor?.id || '';
        const storeLink = `https://abumafhal.com/shop?vendor=${storeId}`;
        const message = `Assalamu Alaikum! Shop authentic products on my official store "${storeName}" on Abu Mafhal Marketplace with nationwide delivery:\n\n${storeLink}`;
        const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                await Share.share({ message });
            }
        } catch (_) {
            await Share.share({ message });
        }
    };

    const handleCopyOrShareLink = async () => {
        const storeName = vendor?.business_name || vendor?.name || 'Abu Mafhal Store';
        const storeId = vendor?.user_id || vendor?.id || '';
        const storeLink = `https://abumafhal.com/shop?vendor=${storeId}`;
        const message = `Check out "${storeName}" on Abu Mafhal Marketplace:\n${storeLink}`;
        try {
            await Share.share({ message, title: storeName });
        } catch (e) {
            Alert.alert('Store Link', storeLink);
        }
    };

    return (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {/* Top Greeting & Live Store Banner */}
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.greetingCard}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.greetingSub}>{greeting}, Admin • Verified Merchant</Text>
                        <Text style={styles.storeTitle} numberOfLines={1}>
                            {vendor?.business_name || vendor?.name || 'Your Storefront'}
                        </Text>
                    </View>
                    <View style={styles.activePill}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeText}>ONLINE</Text>
                    </View>
                </View>

                <View style={styles.bannerDivider} />

                <View style={styles.bannerBottomRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="shield-checkmark" size={16} color={GOLD} />
                        <Text style={styles.verifiedStoreText}>👑 Admin • Verified Official Merchant</Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => onViewPublicStore ? onViewPublicStore() : onSelectTab?.('store_profile')}
                        style={styles.viewStoreBtn}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.viewStoreBtnText}>View Store</Text>
                        <Ionicons name="arrow-forward" size={12} color="#0F172A" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* Quick Store Share & Growth Section */}
            <View style={styles.shareCard}>
                <LinearGradient
                    colors={['#1E293B', '#0F172A']}
                    style={styles.shareCardInner}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={styles.shareIconBadge}>
                                <Ionicons name="sparkles" size={15} color={GOLD} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.shareHeading}>Store Growth & Promotion</Text>
                                <Text style={styles.shareSub}>Share your store link to reach direct buyers</Text>
                            </View>
                        </View>
                        <View style={styles.liveTag}>
                            <Text style={styles.liveTagTxt}>PRO ⚡</Text>
                        </View>
                    </View>

                    <View style={styles.shareActionsRow}>
                        <TouchableOpacity
                            style={[styles.shareActionBtn, { backgroundColor: '#25D366' }]}
                            onPress={handleShareWhatsApp}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="logo-whatsapp" size={16} color="white" />
                            <Text style={styles.shareBtnTxt}>WhatsApp</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.shareActionBtn, { backgroundColor: '#0E1A2E', borderColor: GOLD, borderWidth: 1 }]}
                            onPress={handleCopyOrShareLink}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="share-social" size={16} color={GOLD} />
                            <Text style={[styles.shareBtnTxt, { color: GOLD }]}>Share Store</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.shareActionBtn, { backgroundColor: '#3B82F6' }]}
                            onPress={() => onSelectTab?.('qr_card')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="qr-code" size={16} color="white" />
                            <Text style={styles.shareBtnTxt}>Store Flyer</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>

            {/* Store Health & Operational Quality Indicator */}
            <View style={styles.healthCard}>
                <View style={styles.healthItem}>
                    <Text style={styles.healthValue}>100%</Text>
                    <Text style={styles.healthLabel}>Fulfillment</Text>
                </View>
                <View style={styles.healthDivider} />
                <View style={styles.healthItem}>
                    <Text style={styles.healthValue}>5.0 ★</Text>
                    <Text style={styles.healthLabel}>Store Rating</Text>
                </View>
                <View style={styles.healthDivider} />
                <View style={styles.healthItem}>
                    <Text style={styles.healthValue}>&lt; 15 min</Text>
                    <Text style={styles.healthLabel}>Response Time</Text>
                </View>
                <View style={styles.healthDivider} />
                <View style={styles.healthItem}>
                    <Text style={[styles.healthValue, { color: '#10B981' }]}>Active ✓</Text>
                    <Text style={styles.healthLabel}>Admin Shield</Text>
                </View>
            </View>

            {/* Low Stock Warning Alert if any */}
            {lowStockProducts.length > 0 && (
                <TouchableOpacity
                    style={styles.alertCard}
                    activeOpacity={0.8}
                    onPress={() => onSelectTab?.('products')}
                >
                    <View style={styles.alertIconBox}>
                        <Ionicons name="warning" size={18} color="#D97706" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.alertTitle}>Inventory Alert</Text>
                        <Text style={styles.alertDesc}>
                            {lowStockProducts.length} {lowStockProducts.length === 1 ? 'item is' : 'items are'} low or out of stock. Tap to restock.
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#B45309" />
                </TouchableOpacity>
            )}

            {/* Core KPI Metrics Grid */}
            <View style={styles.metricsGrid}>
                {/* Total Earnings */}
                <TouchableOpacity
                    style={[styles.metricCard, { borderLeftColor: '#10B981' }]}
                    activeOpacity={0.8}
                    onPress={() => onSelectTab?.('wallet')}
                >
                    <View style={styles.metricHeader}>
                        <View style={[styles.metricIconBox, { backgroundColor: '#ECFDF5' }]}>
                            <Ionicons name="cash-outline" size={18} color="#10B981" />
                        </View>
                        <Ionicons name="arrow-forward" size={14} color="#CBD5E1" />
                    </View>
                    <Text style={styles.metricLabel}>Total Earnings</Text>
                    <Text style={styles.metricValue}>₦{earnings.toLocaleString()}</Text>
                    <Text style={styles.metricSub}>From delivered orders</Text>
                </TouchableOpacity>

                {/* Total Orders */}
                <TouchableOpacity
                    style={[styles.metricCard, { borderLeftColor: '#3B82F6' }]}
                    activeOpacity={0.8}
                    onPress={() => onSelectTab?.('orders')}
                >
                    <View style={styles.metricHeader}>
                        <View style={[styles.metricIconBox, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="cart-outline" size={18} color="#3B82F6" />
                        </View>
                        <Ionicons name="arrow-forward" size={14} color="#CBD5E1" />
                    </View>
                    <Text style={styles.metricLabel}>Total Orders</Text>
                    <Text style={styles.metricValue}>{totalOrders}</Text>
                    <Text style={styles.metricSub}>Live marketplace orders</Text>
                </TouchableOpacity>

                {/* Active Products */}
                <TouchableOpacity
                    style={[styles.metricCard, { borderLeftColor: '#8B5CF6' }]}
                    activeOpacity={0.8}
                    onPress={() => onSelectTab?.('products')}
                >
                    <View style={styles.metricHeader}>
                        <View style={[styles.metricIconBox, { backgroundColor: '#F5F3FF' }]}>
                            <Ionicons name="cube-outline" size={18} color="#8B5CF6" />
                        </View>
                        <Ionicons name="arrow-forward" size={14} color="#CBD5E1" />
                    </View>
                    <Text style={styles.metricLabel}>Products Catalog</Text>
                    <Text style={styles.metricValue}>{totalProducts}</Text>
                    <Text style={styles.metricSub}>Active items listed</Text>
                </TouchableOpacity>

                {/* Followers */}
                <TouchableOpacity
                    style={[styles.metricCard, { borderLeftColor: '#6366F1' }]}
                    activeOpacity={0.8}
                    onPress={() => onSelectTab?.('followers')}
                >
                    <View style={styles.metricHeader}>
                        <View style={[styles.metricIconBox, { backgroundColor: '#EEF2FF' }]}>
                            <Ionicons name="people-outline" size={18} color="#6366F1" />
                        </View>
                        <Ionicons name="arrow-forward" size={14} color="#CBD5E1" />
                    </View>
                    <Text style={styles.metricLabel}>Store Followers</Text>
                    <Text style={styles.metricValue}>{followers}</Text>
                    <Text style={styles.metricSub}>Real verified followers</Text>
                </TouchableOpacity>
            </View>

            {/* Quick Actions Bar */}
            <View style={styles.quickActionsSection}>
                <Text style={styles.sectionHeader}>Quick Actions</Text>
                <View style={styles.quickActionsRow}>
                    <TouchableOpacity
                        style={styles.quickActionBtn}
                        activeOpacity={0.75}
                        onPress={() => onOpenAddProduct ? onOpenAddProduct() : onSelectTab?.('products')}
                    >
                        <View style={[styles.quickActionIconBox, { backgroundColor: '#ECFDF5' }]}>
                            <Ionicons name="add-circle" size={24} color="#059669" />
                        </View>
                        <Text style={styles.quickActionLabel}>Add Product</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickActionBtn}
                        activeOpacity={0.75}
                        onPress={() => onSelectTab?.('orders')}
                    >
                        <View style={[styles.quickActionIconBox, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="receipt" size={24} color="#2563EB" />
                        </View>
                        <Text style={styles.quickActionLabel}>Fulfill Orders</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickActionBtn}
                        activeOpacity={0.75}
                        onPress={() => onSelectTab?.('wallet')}
                    >
                        <View style={[styles.quickActionIconBox, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="wallet" size={24} color="#D97706" />
                        </View>
                        <Text style={styles.quickActionLabel}>Withdraw</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickActionBtn}
                        activeOpacity={0.75}
                        onPress={() => onSelectTab?.('store_profile')}
                    >
                        <View style={[styles.quickActionIconBox, { backgroundColor: '#F3E8FF' }]}>
                            <Ionicons name="storefront" size={24} color="#9333EA" />
                        </View>
                        <Text style={styles.quickActionLabel}>Store Branding</Text>
                    </TouchableOpacity>
                </View>

                {/* Secondary Quick Action Row: Business Growth & Tools */}
                <View style={[styles.quickActionsRow, { marginTop: 12 }]}>
                    <TouchableOpacity
                        style={styles.quickActionBtn}
                        activeOpacity={0.75}
                        onPress={() => onSelectTab?.('analytics')}
                    >
                        <View style={[styles.quickActionIconBox, { backgroundColor: '#FCE7F3' }]}>
                            <Ionicons name="bar-chart" size={24} color="#EC4899" />
                        </View>
                        <Text style={styles.quickActionLabel}>Analytics</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickActionBtn}
                        activeOpacity={0.75}
                        onPress={() => onSelectTab?.('shipping')}
                    >
                        <View style={[styles.quickActionIconBox, { backgroundColor: '#FFEDD5' }]}>
                            <Ionicons name="bicycle" size={24} color="#EA580C" />
                        </View>
                        <Text style={styles.quickActionLabel}>Shipping</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickActionBtn}
                        activeOpacity={0.75}
                        onPress={() => onSelectTab?.('qr_card')}
                    >
                        <View style={[styles.quickActionIconBox, { backgroundColor: '#EDE9FE' }]}>
                            <Ionicons name="qr-code" size={24} color="#7C3AED" />
                        </View>
                        <Text style={styles.quickActionLabel}>QR Flyer</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickActionBtn}
                        activeOpacity={0.75}
                        onPress={() => onSelectTab?.('messages')}
                    >
                        <View style={[styles.quickActionIconBox, { backgroundColor: '#E0F2FE' }]}>
                            <Ionicons name="chatbubbles" size={24} color="#0284C7" />
                        </View>
                        <Text style={styles.quickActionLabel}>Inquiries</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Recent Orders Preview */}
            <View style={styles.recentOrdersSection}>
                <View style={styles.recentOrdersHeader}>
                    <Text style={styles.sectionHeader}>Recent Store Orders</Text>
                    <TouchableOpacity onPress={() => onSelectTab?.('orders')}>
                        <Text style={styles.viewAllText}>View All ({totalOrders}) →</Text>
                    </TouchableOpacity>
                </View>

                {recentOrders.length > 0 ? (
                    recentOrders.map((ord, idx) => (
                        <TouchableOpacity
                            key={ord.id || idx}
                            style={styles.recentOrderCard}
                            activeOpacity={0.8}
                            onPress={() => onSelectTab?.('orders')}
                        >
                            <View style={styles.recentOrderIcon}>
                                <Ionicons name="bag-check" size={18} color="#0F172A" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.recentOrderTitle} numberOfLines={1}>
                                    {ord.item || `Order #${(ord.id || '').slice(0, 8)}`}
                                </Text>
                                <Text style={styles.recentOrderSub}>
                                    {ord.customerName || 'Customer'} • {ord.date || 'Recent'}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.recentOrderAmount}>
                                    ₦{(ord.amount || 0).toLocaleString()}
                                </Text>
                                <View style={[styles.recentOrderStatusPill, {
                                    backgroundColor: ord.status?.toLowerCase() === 'delivered' ? '#DCFCE7' : '#FEF3C7'
                                }]}>
                                    <Text style={[styles.recentOrderStatusText, {
                                        color: ord.status?.toLowerCase() === 'delivered' ? '#16A34A' : '#D97706'
                                    }]}>
                                        {ord.status || 'Pending'}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={styles.emptyOrdersCard}>
                        <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
                        <Text style={styles.emptyOrdersText}>No orders received yet.</Text>
                        <Text style={styles.emptyOrdersSub}>
                            Add more products and share your store link on WhatsApp to start getting orders!
                        </Text>
                    </View>
                )}
            </View>

            {/* Official Certificate & Compliance Banner */}
            <TouchableOpacity
                style={styles.certificateBanner}
                activeOpacity={0.85}
                onPress={() => onOpenCertificate ? onOpenCertificate() : onSelectTab?.('store_profile')}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={styles.ribbonCircle}>
                        <Ionicons name="ribbon" size={24} color="#0F172A" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.certBannerTitle}>Official Vendor Certificate</Text>
                        <Text style={styles.certBannerSub}>
                            Download or print your verified merchant accreditation certificate.
                        </Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D9A73A" />
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 110
    },
    greetingCard: {
        borderRadius: 20,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3
    },
    greetingSub: {
        fontSize: 11.5,
        color: '#94A3B8',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    storeTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2
    },
    activePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 5
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981'
    },
    activeText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#34D399',
        letterSpacing: 0.5
    },
    bannerDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 14
    },
    bannerBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    verifiedStoreText: {
        fontSize: 12,
        color: GOLD_LIGHT,
        fontWeight: '700'
    },
    viewStoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: GOLD,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8
    },
    viewStoreBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0F172A'
    },
    shareCard: {
        marginTop: 14,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#334155'
    },
    shareCardInner: {
        padding: 16
    },
    shareIconBadge: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: 'rgba(217, 167, 58, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.4)'
    },
    shareHeading: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    shareSub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 1
    },
    liveTag: {
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        borderWidth: 1,
        borderColor: GOLD,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    liveTagTxt: {
        color: GOLD,
        fontSize: 10,
        fontWeight: '900'
    },
    shareActionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4
    },
    shareActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        borderRadius: 10
    },
    shareBtnTxt: {
        color: 'white',
        fontSize: 11.5,
        fontWeight: '800'
    },
    healthCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1
    },
    healthItem: {
        alignItems: 'center',
        flex: 1
    },
    healthValue: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#0F172A'
    },
    healthLabel: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#64748B',
        marginTop: 2
    },
    healthDivider: {
        width: 1,
        height: 22,
        backgroundColor: '#F1F5F9'
    },
    alertCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderRadius: 14,
        padding: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    alertIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center'
    },
    alertTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#92400E'
    },
    alertDesc: {
        fontSize: 11,
        color: '#B45309',
        fontWeight: '500',
        marginTop: 1
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 14,
        gap: 10
    },
    metricCard: {
        width: '48%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1
    },
    metricHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    metricIconBox: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center'
    },
    metricLabel: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '700'
    },
    metricValue: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: 2
    },
    metricSub: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '500',
        marginTop: 3
    },
    quickActionsSection: {
        marginTop: 20
    },
    sectionHeader: {
        fontSize: 14.5,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.2
    },
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1
    },
    quickActionBtn: {
        alignItems: 'center',
        flex: 1
    },
    quickActionIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6
    },
    quickActionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
        textAlign: 'center'
    },
    recentOrdersSection: {
        marginTop: 20
    },
    recentOrdersHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
    },
    viewAllText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2563EB'
    },
    recentOrderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    recentOrderIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    recentOrderTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A'
    },
    recentOrderSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    recentOrderAmount: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#10B981'
    },
    recentOrderStatusPill: {
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 6,
        marginTop: 3
    },
    recentOrderStatusText: {
        fontSize: 9.5,
        fontWeight: '800'
    },
    emptyOrdersCard: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    emptyOrdersText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#475569',
        marginTop: 8
    },
    emptyOrdersSub: {
        fontSize: 11,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 16
    },
    certificateBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 14,
        marginTop: 18,
        borderWidth: 1,
        borderColor: GOLD
    },
    ribbonCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: GOLD,
        alignItems: 'center',
        justifyContent: 'center'
    },
    certBannerTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    certBannerSub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
        lineHeight: 15
    }
});
