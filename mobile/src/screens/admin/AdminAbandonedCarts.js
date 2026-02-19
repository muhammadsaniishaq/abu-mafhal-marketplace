import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { styles } from '../../styles/theme';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export const AdminAbandonedCarts = () => {
    const [carts, setCarts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCarts();
    }, []);

    const fetchCarts = async () => {
        setLoading(true);
        // Fetch active carts that haven't been recovered
        const { data, error } = await supabase
            .from('carts')
            .select('*, user:profiles(full_name, email), cart_items(count)')
            .eq('recovered', false)
            .order('created_at', { ascending: false });

        if (error) console.log(error);
        setCarts(data || []);
        setLoading(false);
    };

    const sendReminder = async (cartId) => {
        // Mock sending reminder - in real app, call Edge Function
        Alert.alert('Sending...', 'Dispatching push notification & email reminder.');

        const { error } = await supabase.from('carts').update({
            reminders_sent: 1, // increment in real DB logic
            last_reminder_sent_at: new Date()
        }).eq('id', cartId);

        if (!error) {
            Alert.alert('Success', 'Reminder sent!');
            fetchCarts();
        }
    };

    const renderItem = ({ item }) => (
        <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View>
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>{item.user?.full_name || item.user?.email || 'Guest'}</Text>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>{new Date(item.created_at).toDateString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '800', color: '#EF4444', fontSize: 16 }}>₦{item.total?.toLocaleString()}</Text>
                    <Text style={{ fontSize: 10, color: '#94A3B8' }}>{item.cart_items?.[0]?.count || 0} items</Text>
                </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="notifications" size={14} color={item.reminders_sent > 0 ? "#F59E0B" : "#CBD5E1"} />
                    <Text style={{ fontSize: 12, color: '#64748B' }}>{item.reminders_sent} Sent</Text>
                </View>
                <TouchableOpacity
                    onPress={() => sendReminder(item.id)}
                    style={{ backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                    <Ionicons name="paper-plane" color="white" size={12} />
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>Recover</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 20 }}>
                <Text style={styles.sectionTitle}>Abandoned Checkout</Text>
                <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Recover lost sales by notifying users.</Text>
            </View>

            {loading ? <ActivityIndicator color="#0F172A" /> : (
                <FlatList
                    data={carts}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.5 }}>
                            <Ionicons name="cart" size={48} color="#94A3B8" />
                            <Text style={{ marginTop: 10, color: '#94A3B8' }}>No abandoned carts found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};
