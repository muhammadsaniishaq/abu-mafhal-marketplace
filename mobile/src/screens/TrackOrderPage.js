import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Image, Linking,
    Alert, StatusBar, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const AM_LOGO = require('../../assets/am_logo.png');

const TIMELINE_STEPS = [
    { key: 'confirmed', label: 'Order Confirmed', sub: 'Your order has been placed successfully', time: '9 Sep, 10:24 AM' },
    { key: 'processing', label: 'Processing', sub: 'Your order is being prepared', time: '9 Sep, 1:15 PM' },
    { key: 'shipped', label: 'Shipped', sub: 'Your order has been dispatched', time: '10 Sep, 9:40 AM' },
    { key: 'out_for_delivery', label: 'Out for Delivery', sub: 'Your order is out for delivery', time: '--' },
    { key: 'delivered', label: 'Delivered', sub: 'Your order has been delivered', time: '--' }
];

export const TrackOrderPage = ({ navigation, route, onBack, order: propOrder }) => {
    const order = propOrder || route?.params?.order;
    const goBack = onBack || (() => navigation?.goBack());

    const orderNumber = order?.id ? `#AMF${order.id.slice(0, 6).toUpperCase()}` : '#AMF128736';
    const orderDate = order?.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '9 Sep 2026';

    const currentStatus = (order?.status || 'shipped').toLowerCase();
    
    // Determine active index
    let activeStep = 2; // Default shipped as in screenshot
    if (currentStatus === 'pending' || currentStatus === 'confirmed') activeStep = 0;
    else if (currentStatus === 'processing') activeStep = 1;
    else if (currentStatus === 'shipped') activeStep = 2;
    else if (currentStatus === 'out_for_delivery' || currentStatus === 'dispatched') activeStep = 3;
    else if (currentStatus === 'delivered') activeStep = 4;

    const firstItem = order?.order_items?.[0] || order?.items?.[0] || {
        name: 'Wireless Earbuds',
        desc: 'Premium Sound, Long Battery Life',
        price: order?.total_amount || 25000,
        qty: 1,
        vendor: 'Mafhal Electronics',
        image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=300&auto=format&fit=crop'
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar backgroundColor="#0A192F" barStyle="light-content" />

            {/* Top Dark Navy Header */}
            <View style={{
                backgroundColor: '#0A192F',
                paddingTop: 48,
                paddingHorizontal: 16,
                paddingBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <TouchableOpacity onPress={goBack} style={{ padding: 6 }}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Image source={AM_LOGO} style={{ width: 34, height: 34, resizeMode: 'contain' }} />
                    <View>
                        <Text style={{ color: '#00D2FF', fontSize: 16, fontWeight: '900', letterSpacing: 0.6 }}>
                            ABU <Text style={{ color: '#38BDF8' }}>MAFHAL</Text>
                        </Text>
                        <Text style={{ color: '#94A3B8', fontSize: 7, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                            Your Marketplace, Your Choice.
                        </Text>
                    </View>
                </View>

                <TouchableOpacity style={{ padding: 6 }}>
                    <Ionicons name="notifications-outline" size={22} color="white" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}>
                {/* Header Title & Order ID Badge */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <View>
                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0A192F', letterSpacing: -0.5 }}>
                            Order Tracking
                        </Text>
                        <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '500', marginTop: 2 }}>
                            Track your order in real time
                        </Text>
                    </View>

                    <View style={{
                        backgroundColor: '#F1F5F9',
                        borderRadius: 14,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                    }}>
                        <Text style={{ fontSize: 18 }}>📦</Text>
                        <View>
                            <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0A192F' }}>
                                Order {orderNumber}
                            </Text>
                            <Text style={{ fontSize: 9.5, color: '#64748B', fontWeight: '600' }}>
                                Placed on {orderDate}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Product Summary Mini-Card */}
                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 20,
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.04,
                    shadowRadius: 10,
                    elevation: 2,
                }}>
                    <Image
                        source={{ uri: firstItem.image || 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=300&auto=format&fit=crop' }}
                        style={{ width: 68, height: 68, borderRadius: 14, backgroundColor: '#F1F5F9', marginRight: 12 }}
                    />
                    <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                            {firstItem.name || 'Wireless Earbuds'}
                        </Text>
                        <Text numberOfLines={1} style={{ fontSize: 11, color: '#64748B', marginTop: 1, marginBottom: 4 }}>
                            {firstItem.desc || 'Premium Sound, Long Battery Life'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: '#0F172A' }}>
                                ₦{Number(firstItem.price || 25000).toLocaleString()}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>
                                Qty: {firstItem.qty || 1}
                            </Text>
                        </View>
                        <TouchableOpacity style={{ marginTop: 2 }}>
                            <Text style={{ fontSize: 11, color: '#0284C7', fontWeight: '700' }}>
                                View Product &gt;
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: '600' }}>From</Text>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#0A192F' }}>
                                    {firstItem.vendor || 'Mafhal Electronics'}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={12} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Vertical Timeline Progression */}
                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 20,
                    padding: 18,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                }}>
                    {TIMELINE_STEPS.map((step, idx) => {
                        const isDone = idx <= activeStep;
                        const isLast = idx === TIMELINE_STEPS.length - 1;
                        return (
                            <View key={step.key} style={{ flexDirection: 'row', minHeight: 48 }}>
                                {/* Icon & connecting line */}
                                <View style={{ alignItems: 'center', width: 28, marginRight: 12 }}>
                                    <View style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 11,
                                        backgroundColor: isDone ? '#10B981' : 'transparent',
                                        borderWidth: isDone ? 0 : 2,
                                        borderColor: '#CBD5E1',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 2,
                                    }}>
                                        {isDone && <Ionicons name="checkmark" size={13} color="white" />}
                                    </View>
                                    {!isLast && (
                                        <View style={{
                                            width: 2,
                                            flex: 1,
                                            backgroundColor: isDone && idx < activeStep ? '#10B981' : '#E2E8F0',
                                            marginVertical: 2,
                                        }} />
                                    )}
                                </View>

                                {/* Texts */}
                                <View style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 13.5, fontWeight: isDone ? '800' : '600', color: isDone ? '#0F172A' : '#94A3B8' }}>
                                            {step.label}
                                        </Text>
                                        <Text style={{ fontSize: 11, color: isDone ? '#64748B' : '#CBD5E1', fontWeight: '600' }}>
                                            {step.time}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                                        {step.sub}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Estimated Delivery Box */}
                <View style={{
                    backgroundColor: '#ECFDF5',
                    borderRadius: 20,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: '#A7F3D0',
                    gap: 14
                }}>
                    <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        backgroundColor: '#D1FAE5',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Ionicons name="car-outline" size={26} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Estimated Delivery
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#064E3B', marginTop: 1 }}>
                            Tomorrow, 11 Sep 2026
                        </Text>
                        <Text style={{ fontSize: 11, color: '#047857', fontWeight: '500', marginTop: 1 }}>
                            Between 9:00 AM - 6:00 PM
                        </Text>
                    </View>
                </View>

                {/* Live Rider Tracking Card (Map Visualizer) */}
                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 20,
                    overflow: 'hidden',
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                }}>
                    {/* Rider Info Header */}
                    <View style={{
                        padding: 14,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottomWidth: 1,
                        borderBottomColor: '#F1F5F9',
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: '#0A192F',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Ionicons name="bicycle" size={20} color="#38BDF8" />
                            </View>
                            <View>
                                <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>
                                    Your Rider
                                </Text>
                                <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>
                                    On the way to your location
                                </Text>
                            </View>
                        </View>

                        <View style={{
                            backgroundColor: '#F0F9FF',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: '#BAE6FD',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5
                        }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#0284C7' }} />
                            <Text style={{ color: '#0284C7', fontSize: 11, fontWeight: '800' }}>
                                Live Tracking
                            </Text>
                        </View>
                    </View>

                    {/* Stylized Map Canvas */}
                    <View style={{ height: 130, backgroundColor: '#E2E8F0', position: 'relative', overflow: 'hidden' }}>
                        {/* Map Grid Pattern background */}
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=600&auto=format&fit=crop' }}
                            style={{ width: '100%', height: '100%', opacity: 0.25 }}
                        />

                        {/* Simulated Route Line */}
                        <View style={{
                            position: 'absolute',
                            left: 70,
                            top: 60,
                            width: 160,
                            height: 4,
                            backgroundColor: '#0284C7',
                            borderRadius: 2,
                            transform: [{ rotate: '-8deg' }]
                        }} />

                        {/* Delivery Vehicle Icon on Map */}
                        <View style={{
                            position: 'absolute',
                            left: 60,
                            top: 46,
                            backgroundColor: '#0A192F',
                            padding: 6,
                            borderRadius: 10,
                            borderWidth: 2,
                            borderColor: 'white',
                            shadowColor: '#000',
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 3
                        }}>
                            <Ionicons name="car" size={18} color="white" />
                        </View>

                        {/* Destination House Icon on Map */}
                        <View style={{
                            position: 'absolute',
                            right: 70,
                            top: 38,
                            backgroundColor: '#0A192F',
                            padding: 6,
                            borderRadius: 10,
                            borderWidth: 2,
                            borderColor: 'white',
                            shadowColor: '#000',
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 3
                        }}>
                            <Ionicons name="home" size={16} color="white" />
                        </View>

                        {/* Re-center Target Button */}
                        <TouchableOpacity style={{
                            position: 'absolute',
                            right: 12,
                            bottom: 12,
                            backgroundColor: 'white',
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000',
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 2
                        }}>
                            <Ionicons name="locate-outline" size={18} color="#0284C7" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Need Help? Contact Support Button */}
                <TouchableOpacity
                    onPress={() => Linking.openURL('https://wa.me/2348101234567')}
                    style={{
                        backgroundColor: '#0A192F',
                        borderRadius: 16,
                        paddingVertical: 15,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        shadowColor: '#0A192F',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 3
                    }}
                >
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color="white" />
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>
                        Need Help? Contact Support &gt;
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};
