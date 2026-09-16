import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, TextInput, Linking } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { WhatsAppActionModal } from '../../components/WhatsAppActionModal';

const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

export const AdminAbandonedCarts = () => {
    const [carts, setCarts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // WhatsApp Action Modal
    const [whatsappVisible, setWhatsappVisible] = useState(false);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [whatsappUserId, setWhatsappUserId] = useState(null);
    const [whatsappRecipientName, setWhatsappRecipientName] = useState('Customer');

    useEffect(() => {
        fetchCarts();
    }, []);

    const fetchCarts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('carts')
                .select('*, profiles:user_id(full_name, email, phone, phone_number), cart_items(count)')
                .eq('recovered', false)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Fetch carts error:', error);
            } else {
                setCarts(data || []);
            }
        } catch (e) {
            console.error('Abandoned carts crash:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchCarts();
    };

    const sendReminder = async (cart) => {
        try {
            const userName = cart.profiles?.full_name || 'Customer';
            const totalAmount = Number(cart.total || 0).toLocaleString();

            // 1. Insert real live in-app notification if user_id exists
            if (cart.user_id) {
                await supabase.from('notifications').insert([{
                    user_id: cart.user_id,
                    title: 'Your Cart is Waiting! 🛒',
                    message: `Hello ${userName}, you left items worth ₦${totalAmount} in your Abu Mafhal cart. Complete your checkout now before stock runs out!`,
                    type: 'system'
                }]);
            }

            // 2. Update cart record in database
            const currentCount = Number(cart.reminders_sent || 0) + 1;
            const { error: updateError } = await supabase.from('carts').update({
                reminders_sent: currentCount,
                last_reminder_sent_at: new Date().toISOString()
            }).eq('id', cart.id);

            if (!updateError) {
                Alert.alert('Reminder Sent!', `Cart reminder sent to ${userName} successfully.`);
                fetchCarts();
            } else {
                Alert.alert('Error', updateError.message);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to send cart reminder.');
        }
    };

    const markRecovered = async (cartId) => {
        try {
            const { error } = await supabase.from('carts').update({
                recovered: true,
                recovered_at: new Date().toISOString()
            }).eq('id', cartId);

            if (!error) {
                Alert.alert('Success', 'Cart marked as recovered successfully.');
                setCarts(prev => prev.filter(c => c.id !== cartId));
            }
        } catch (e) {
            console.error('Mark recovered error:', e);
        }
    };

    const filteredCarts = carts.filter(c => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const name = (c.profiles?.full_name || '').toLowerCase();
        const email = (c.profiles?.email || '').toLowerCase();
        const phone = (c.profiles?.phone || c.profiles?.phone_number || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
    });

    const formatNaira = (amount) => {
        return '₦' + Number(amount || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
    };

    const renderItem = ({ item }) => {
        const phone = item.profiles?.phone || item.profiles?.phone_number;
        const name = item.profiles?.full_name || item.profiles?.email || 'Guest Shopper';

        return (
            <View style={{
                backgroundColor: '#FFFFFF',
                padding: 16,
                borderRadius: 20,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                shadowColor: NAVY,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 1
            }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ fontWeight: '800', color: NAVY, fontSize: 14 }} numberOfLines={1}>
                            {name}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                            {item.profiles?.email || 'No email'}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                            Created: {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontWeight: '900', color: GOLD, fontSize: 17 }}>
                            {formatNaira(item.total)}
                        </Text>
                        <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B' }}>
                                {item.cart_items?.[0]?.count || 1} item(s) in cart
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Actions & Status Bar */}
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 8,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: '#F8FAFC'
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons name="notifications" size={14} color={item.reminders_sent > 0 ? GOLD : '#CBD5E1'} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: item.reminders_sent > 0 ? NAVY : '#64748B' }}>
                            {item.reminders_sent || 0} reminder(s) sent
                        </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        {phone && (
                            <TouchableOpacity
                                onPress={() => {
                                    setWhatsappPhone(phone);
                                    setWhatsappUserId(item.user_id);
                                    setWhatsappRecipientName(name);
                                    setWhatsappVisible(true);
                                }}
                                style={{
                                    backgroundColor: '#DCFCE7',
                                    paddingHorizontal: 10,
                                    paddingVertical: 7,
                                    borderRadius: 10,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}
                            >
                                <Ionicons name="logo-whatsapp" size={13} color="#16A34A" />
                                <Text style={{ color: '#16A34A', fontWeight: '800', fontSize: 11 }}>Chat</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={() => sendReminder(item)}
                            style={{
                                backgroundColor: NAVY,
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                borderRadius: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                borderWidth: 1,
                                borderColor: GOLD
                            }}
                        >
                            <Ionicons name="paper-plane-outline" color={GOLD} size={12} />
                            <Text style={{ color: GOLD, fontWeight: '800', fontSize: 11 }}>Remind</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => markRecovered(item.id)}
                            style={{
                                backgroundColor: '#F1F5F9',
                                paddingHorizontal: 8,
                                paddingVertical: 7,
                                borderRadius: 10,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="Mark as purchased"
                        >
                            <Ionicons name="checkmark-done" size={15} color="#10B981" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header */}
            <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: NAVY }}>
                    Abandoned Carts Management
                </Text>
                <Text style={{ color: '#64748B', fontSize: 11.5, marginTop: 2 }}>
                    Re-engage customers and help them complete their pending checkouts
                </Text>

                {/* Search */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginTop: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0'
                }}>
                    <Ionicons name="search" size={16} color="#94A3B8" />
                    <TextInput
                        placeholder="Search cart by customer name or phone..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{ flex: 1, marginLeft: 8, fontSize: 12.5, color: NAVY }}
                        placeholderTextColor="#94A3B8"
                    />
                </View>
            </View>

            {loading && !refreshing ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#64748B' }}>Loading abandoned carts...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredCarts}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[GOLD, NAVY]} />
                    }
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50, opacity: 0.7 }}>
                            <Ionicons name="cart-outline" size={48} color="#94A3B8" />
                            <Text style={{ marginTop: 10, color: '#64748B', fontWeight: '700', fontSize: 13 }}>
                                No abandoned carts found.
                            </Text>
                        </View>
                    }
                />
            )}

            <WhatsAppActionModal
                visible={whatsappVisible}
                phone={whatsappPhone}
                userId={whatsappUserId}
                recipientName={whatsappRecipientName}
                onClose={() => setWhatsappVisible(false)}
            />
        </View>
    );
};
