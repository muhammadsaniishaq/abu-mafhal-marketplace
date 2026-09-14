import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const StatCard = ({ label, value, icon, color, onPress }) => {
    const CardWrap = onPress ? TouchableOpacity : View;
    return (
        <CardWrap
            style={localStyles.statCard}
            activeOpacity={onPress ? 0.75 : 1}
            onPress={onPress}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={icon} size={17} color={color} />
                </View>
                {onPress && (
                    <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
                )}
            </View>
            <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700' }}>{label}</Text>
            <Text style={{ color: '#0F172A', fontSize: 17, fontWeight: '900', marginTop: 3 }}>{value}</Text>
        </CardWrap>
    );
};

export const VendorOverview = ({ stats, onSelectTab }) => {
    return (
        <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>Store Performance</Text>
                <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Live Metrics</Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <StatCard
                    label="Earnings"
                    value={`₦${Number(stats.earnings || 0).toLocaleString()}`}
                    icon="cash-outline"
                    color="#10B981"
                    onPress={() => onSelectTab && onSelectTab('wallet')}
                />
                <StatCard
                    label="Orders"
                    value={stats.orders || 0}
                    icon="cart-outline"
                    color="#3B82F6"
                    onPress={() => onSelectTab && onSelectTab('orders')}
                />
                <StatCard
                    label="Products"
                    value={stats.products || 0}
                    icon="cube-outline"
                    color="#8B5CF6"
                    onPress={() => onSelectTab && onSelectTab('products')}
                />
                <StatCard
                    label="Followers"
                    value={stats.followers || 0}
                    icon="people-outline"
                    color="#6366F1"
                    onPress={() => onSelectTab && onSelectTab('followers')}
                />
            </View>

            {/* Store Profile Branding Quick Card */}
            <TouchableOpacity
                style={{
                    backgroundColor: '#0A192F',
                    borderRadius: 20,
                    padding: 16,
                    marginTop: 14,
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: '#D4AF37',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 3
                }}
                activeOpacity={0.85}
                onPress={() => onSelectTab && onSelectTab('store_profile')}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(212, 175, 55, 0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D4AF37' }}>
                        <Ionicons name="storefront" size={22} color="#FDE68A" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFF' }}>Store Profile & Cover</Text>
                            <View style={{ backgroundColor: '#D4AF37', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 9, fontWeight: '900', color: '#0A192F' }}>EDIT</Text>
                            </View>
                        </View>
                        <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 2 }}>
                            Set your Cover Banner, Logo, Store Name & Bio to look professional.
                        </Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#D4AF37" />
            </TouchableOpacity>

            {/* Quick Actions / Tips */}
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 10, marginBottom: 12 }}>
                Grow Your Business
            </Text>

            <TouchableOpacity
                style={localStyles.actionCard}
                activeOpacity={0.8}
                onPress={() => onSelectTab && onSelectTab('followers')}
            >
                <View style={[localStyles.actionIconBox, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="people" size={22} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={localStyles.actionTitle}>Store Followers</Text>
                    <Text style={localStyles.actionSub}>Engage your audience, send product updates, and reward loyal buyers.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={localStyles.actionCard}>
                <View style={[localStyles.actionIconBox, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="megaphone-outline" size={22} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={localStyles.actionTitle}>Boost Your Store</Text>
                    <Text style={localStyles.actionSub}>Get premium placement on the homepage to reach more active buyers across Nigeria.</Text>
                </View>
            </View>
        </View>
    );
};

const localStyles = StyleSheet.create({
    statCard: {
        width: '48%',
        backgroundColor: '#FFFFFF',
        padding: 14,
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        boxShadow: '0px 2px 6px rgba(15, 23, 42, 0.03)',
        elevation: 1
    },
    actionCard: {
        backgroundColor: '#FFFFFF',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 12
    },
    actionIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    actionTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    actionSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
        lineHeight: 15
    }
});
