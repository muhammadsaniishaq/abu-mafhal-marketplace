import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Linking, Alert, Clipboard, Dimensions, Platform, Animated, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
// import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export const TrackOrderPage = ({ navigation, route }) => {
    const { order } = route.params || {};
    const [driver, setDriver] = useState(null);

    useEffect(() => {
        const fetchDriver = async () => {
            if (order?.driver_id) {
                const { data, error } = await supabase
                    .from('drivers')
                    .select('*')
                    .eq('id', order.driver_id)
                    .single();

                if (data) setDriver(data);
            }
        };
        fetchDriver();
    }, [order]);

    if (!order) {
        return (
            <View style={localStyles.center}>
                <Text style={{ color: '#64748B' }}>Order information missing.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                    <Text style={{ color: '#0F172A', fontWeight: '700' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const STEPS = [
        { key: 'pending', title: 'Order Placed', desc: 'We have received your order.', icon: 'document-text', time: order.created_at },
        { key: 'processing', title: 'Processing', desc: 'Seller is packing your items.', icon: 'cube' },
        { key: 'shipped', title: 'On the Way', desc: 'Driver is heading to you.', icon: 'bicycle' },
        { key: 'delivered', title: 'Delivered', desc: 'Package arrived safely.', icon: 'checkmark-circle' },
    ];

    const getCurrentStepIndex = () => {
        const status = order.status?.toLowerCase() || 'pending';
        if (status === 'cancelled') return -1;
        return STEPS.findIndex(s => s.key === status);
    };

    const currentStep = getCurrentStepIndex();
    const isCancelled = order.status === 'cancelled';

    const handleCopyID = () => {
        Clipboard.setString(order.id);
        Alert.alert("Copied", "Order ID copied to clipboard.");
    };

    const handleCallDriver = () => {
        if (driver?.phone) Linking.openURL(`tel:${driver.phone}`);
        else Alert.alert("Wait", "No driver assigned yet.");
    };

    const handleCancelOrder = () => {
        Alert.alert("Cancel Order?", "Are you sure you want to cancel this order?", [
            { text: "No", style: "cancel" },
            {
                text: "Yes, Cancel",
                style: "destructive",
                onPress: () => Alert.alert("Request Sent", "Cancellation request sent to admin.")
            }
        ]);
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="light-content" />

            {/* 1. MAP HEADER AREA */}
            <View style={{ height: 320, width: '100%', position: 'absolute', top: 0 }}>
                <Image
                    source={{ uri: 'https://img.freepik.com/free-vector/city-map-navigation-interface_1017-6644.jpg?w=1060' }}
                    style={{ width: '100%', height: '100%', opacity: 0.9 }}
                    resizeMode="cover"
                />
                <View
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)' }}
                />

                {/* Header Nav */}
                <View style={{ position: 'absolute', top: Platform.OS === 'android' ? 50 : 60, left: 20, zIndex: 10 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.glassBtn}>
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Tracking Info Overlay */}
                <View style={{ position: 'absolute', top: 120, left: 20, right: 20 }}>
                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', opacity: 0.8, letterSpacing: 1 }}>TRACKING ID</Text>
                    <TouchableOpacity onPress={handleCopyID} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', letterSpacing: 1 }}>#{order.id.split('-')[0].toUpperCase()}</Text>
                        <Ionicons name="copy-outline" size={18} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isCancelled ? '#EF4444' : '#10B981', marginRight: 8 }} />
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 12, textTransform: 'uppercase' }}>
                            {isCancelled ? 'Order Cancelled' : `Est. Delivery: ${new Date(new Date().setDate(new Date().getDate() + 2)).toLocaleDateString()}`}
                        </Text>
                    </View>
                </View>
            </View>

            {/* 2. MAIN CONTENT (Scrollable) */}
            <ScrollView contentContainerStyle={{ paddingTop: 280, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

                {/* DRIVER CARD (If Assigned) */}
                {driver ? (
                    <View style={localStyles.driverCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Image source={{ uri: driver.photo_url || 'https://placehold.co/100' }} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#F1F5F9', marginRight: 16 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>{driver.name}</Text>
                                <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600' }}>{driver.vehicle_plate_number} • {driver.vehicle_type}</Text>
                            </View>
                            <TouchableOpacity onPress={handleCallDriver} style={localStyles.callBtn}>
                                <Ionicons name="call" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : !isCancelled && (
                    <View style={localStyles.driverCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#F1F5F9', marginRight: 16, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="bicycle" size={24} color="#CBD5E1" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>Assigning Driver...</Text>
                                <Text style={{ fontSize: 13, color: '#64748B' }}>We are looking for a nearby rider.</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* TIMELINE */}
                <View style={{ paddingHorizontal: 24, paddingVertical: 10 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 24 }}>Order Timeline</Text>

                    {STEPS.map((step, index) => {
                        const isActive = isCancelled ? false : index <= currentStep;
                        const isCurrent = index === currentStep;
                        const isLast = index === STEPS.length - 1;

                        return (
                            <View key={step.key} style={{ flexDirection: 'row', minHeight: 80 }}>
                                {/* Line & Dot */}
                                <View style={{ alignItems: 'center', marginRight: 20, width: 24 }}>
                                    <View style={{
                                        width: 28, height: 28, borderRadius: 14,
                                        backgroundColor: isActive ? '#0F172A' : '#F1F5F9',
                                        alignItems: 'center', justifyContent: 'center',
                                        borderWidth: 2, borderColor: isActive ? '#0F172A' : '#E2E8F0',
                                        zIndex: 10
                                    }}>
                                        <Ionicons name={step.icon} size={14} color={isActive ? 'white' : '#94A3B8'} />
                                    </View>
                                    {!isLast && (
                                        <View style={{ width: 2, flex: 1, backgroundColor: isActive && !isCurrent ? '#0F172A' : '#E2E8F0', marginVertical: 4 }} />
                                    )}
                                </View>

                                {/* Content */}
                                <View style={{ flex: 1, paddingBottom: 32 }}>
                                    <Text style={{ fontSize: 15, fontWeight: isActive ? '800' : '600', color: isActive ? '#0F172A' : '#94A3B8' }}>{step.title}</Text>
                                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 20 }}>{step.desc}</Text>
                                    {step.time && <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{new Date(step.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* ORDER SUMMARY PREVIEW */}
                <View style={{ marginHorizontal: 24, backgroundColor: 'white', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={{ fontWeight: '700', color: '#0F172A' }}>Order Amount</Text>
                        <Text style={{ fontWeight: '800', color: '#0F172A' }}>₦{(order.total_amount || 0).toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={{ fontWeight: '700', color: '#64748B' }}>Items</Text>
                        <Text style={{ fontWeight: '700', color: '#64748B' }}>{order.order_items?.length || 1} Items</Text>
                    </View>
                    <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4 }}>
                        <Text style={{ color: '#3B82F6', fontWeight: '800', fontSize: 13 }}>View Invoice</Text>
                    </TouchableOpacity>
                </View>

                {/* CANCEL BUTTON */}
                {order.status === 'pending' && !isCancelled && (
                    <TouchableOpacity onPress={handleCancelOrder} style={{ margin: 24, marginTop: 10, padding: 16, backgroundColor: '#FEE2E2', borderRadius: 16, alignItems: 'center' }}>
                        <Text style={{ color: '#EF4444', fontWeight: '800' }}>Cancel Order</Text>
                    </TouchableOpacity>
                )}

            </ScrollView>
        </View>
    );
};

const localStyles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    glassBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    driverCard: {
        marginHorizontal: 20,
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 24,
        marginBottom: 24,
        boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',
    },
    callBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',
    }
});
