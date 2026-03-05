import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const StatCard = ({ label, value, icon, color }) => (
    <View style={localStyles.statCard}>
        <View style={{ alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon} size={16} color={color} />
            </View>
        </View>
        <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '800', marginTop: 4 }}>{value}</Text>
    </View>
);

export const VendorOverview = ({ stats }) => {
    return (
        <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 16 }}>Store Performance</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <StatCard label="Earnings" value={`₦${stats.earnings?.toLocaleString()}`} icon="cash-outline" color="#10B981" />
                <StatCard label="Orders" value={stats.orders} icon="cart-outline" color="#3B82F6" />
                <StatCard label="Products" value={stats.products} icon="cube-outline" color="#8B5CF6" />
                <StatCard label="Store Views" value={stats.views} icon="eye-outline" color="#F59E0B" />
            </View>

            {/* Quick Actions / Tips */}
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 24, marginBottom: 16 }}>Grow Your Sales</Text>

            <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                    <Ionicons name="megaphone-outline" size={24} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>Boost Your Store</Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4, lineHeight: 18 }}>Get premium placement on the homepage to reach more buyers.</Text>
                </View>
            </View>
        </View>
    );
};

const localStyles = StyleSheet.create({
    statCard: {
        width: '48%',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        boxShadow: '0px 4px 10px rgba(0,0,0,0.02)',
        elevation: 1
    }
});
