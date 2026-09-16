import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Alert, Modal, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { WhatsAppActionModal } from '../../components/WhatsAppActionModal';

const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

export const AdminDisputes = () => {
    const [disputes, setDisputes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDispute, setSelectedDispute] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [sendingMsg, setSendingMsg] = useState(false);

    // WhatsApp Action Modal
    const [whatsappVisible, setWhatsappVisible] = useState(false);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [whatsappUserId, setWhatsappUserId] = useState(null);
    const [whatsappRecipientName, setWhatsappRecipientName] = useState('Customer');

    useEffect(() => {
        fetchDisputes();
    }, []);

    const fetchDisputes = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('disputes')
                .select('*, profiles:user_id(full_name, email, phone, phone_number)')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Fetch disputes error:', error);
            } else {
                setDisputes(data || []);
            }
        } catch (e) {
            console.error('Disputes crash:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const openDispute = async (dispute) => {
        setSelectedDispute(dispute);
        setModalVisible(true);
        fetchMessages(dispute.id);
    };

    const fetchMessages = async (disputeId) => {
        try {
            const { data } = await supabase
                .from('dispute_messages')
                .select('*')
                .eq('dispute_id', disputeId)
                .order('created_at', { ascending: true });

            setChatMessages(data || []);
        } catch (e) {
            console.error('Fetch messages error:', e);
        }
    };

    const sendMessage = async () => {
        if (!messageText.trim()) return;
        setSendingMsg(true);

        try {
            const { data: authData } = await supabase.auth.getUser();
            const currentUserId = authData?.user?.id || null;

            const { error } = await supabase.from('dispute_messages').insert({
                dispute_id: selectedDispute.id,
                sender_id: currentUserId,
                message: messageText.trim(),
                is_admin: true
            });

            if (!error) {
                setMessageText('');
                fetchMessages(selectedDispute.id);
            } else {
                Alert.alert('Error', error.message || 'Failed to send message.');
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to send message.');
        } finally {
            setSendingMsg(false);
        }
    };

    const resolveDispute = async () => {
        Alert.alert(
            'Resolve Dispute',
            'Are you sure you want to mark this dispute as resolved?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        const { error } = await supabase.from('disputes').update({ status: 'resolved' }).eq('id', selectedDispute.id);
                        if (!error) {
                            Alert.alert('Success', 'Dispute marked as resolved.');
                            setModalVisible(false);
                            fetchDisputes();
                        } else {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }) => {
        const isResolved = item.status === 'resolved';
        const userName = item.profiles?.full_name || item.profiles?.email || 'Customer';
        const phone = item.profiles?.phone || item.profiles?.phone_number;

        return (
            <TouchableOpacity
                onPress={() => openDispute(item)}
                activeOpacity={0.7}
                style={{
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
                }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <View>
                        <Text style={{ fontWeight: '900', color: NAVY, fontSize: 14 }}>
                            Dispute #{item.id.slice(0, 8)}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                            From: <Text style={{ fontWeight: '700', color: NAVY }}>{userName}</Text>
                        </Text>
                    </View>

                    <View style={{
                        backgroundColor: isResolved ? '#DCFCE7' : 'rgba(217, 167, 58, 0.15)',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isResolved ? '#10B981' : GOLD
                    }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: isResolved ? '#166534' : GOLD, textTransform: 'uppercase' }}>
                            {isResolved ? 'RESOLVED' : 'PENDING REVIEW'}
                        </Text>
                    </View>
                </View>

                <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY, marginTop: 4 }}>
                    Reason: {item.reason || 'No reason specified'}
                </Text>

                {item.description ? (
                    <Text numberOfLines={2} style={{ fontSize: 11.5, color: '#64748B', marginTop: 3, lineHeight: 16 }}>
                        {item.description}
                    </Text>
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F8FAFC' }}>
                    <Text style={{ fontSize: 10, color: '#94A3B8' }}>
                        {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: GOLD }}>Review & Reply →</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header */}
            <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: NAVY }}>
                    Customer Disputes & Inquiries
                </Text>
                <Text style={{ color: '#64748B', fontSize: 11.5, marginTop: 2 }}>
                    Mediate and resolve disputes between buyers and sellers
                </Text>
            </View>

            {loading && !refreshing ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#64748B' }}>Loading disputes...</Text>
                </View>
            ) : (
                <FlatList
                    data={disputes}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDisputes(); }} colors={[GOLD, NAVY]} />
                    }
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50, opacity: 0.7 }}>
                            <Ionicons name="chatbubbles-outline" size={48} color="#94A3B8" />
                            <Text style={{ color: '#64748B', marginTop: 10, fontWeight: '700', fontSize: 13 }}>
                                No active customer disputes reported.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Dispute Detail Modal */}
            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                    {/* Modal Header */}
                    <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: NAVY }}>Dispute Details</Text>
                            <Text style={{ fontSize: 11, color: '#64748B' }}>
                                Order #{selectedDispute?.order_id ? selectedDispute.order_id.slice(0, 8) : 'N/A'}
                            </Text>
                        </View>
                        <TouchableOpacity 
                            onPress={() => setModalVisible(false)}
                            style={{ padding: 6, backgroundColor: '#F1F5F9', borderRadius: 10 }}
                        >
                            <Ionicons name="close" size={20} color={NAVY} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1, padding: 16 }}>
                        {/* Info Card */}
                        <View style={{ backgroundColor: '#FFFFFF', padding: 16, borderRadius: 18, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={{ fontSize: 11, color: GOLD, fontWeight: '800', textTransform: 'uppercase' }}>
                                    Dispute Reason:
                                </Text>
                                {(selectedDispute?.profiles?.phone || selectedDispute?.profiles?.phone_number) && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setWhatsappPhone(selectedDispute.profiles?.phone || selectedDispute.profiles?.phone_number);
                                            setWhatsappUserId(selectedDispute.user_id);
                                            setWhatsappRecipientName(selectedDispute.profiles?.full_name || 'Customer');
                                            setWhatsappVisible(true);
                                        }}
                                        style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    >
                                        <Ionicons name="logo-whatsapp" size={13} color="#16A34A" />
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#16A34A' }}>WhatsApp</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <Text style={{ fontSize: 15, fontWeight: '800', color: NAVY, marginBottom: 4 }}>
                                {selectedDispute?.reason}
                            </Text>
                            <Text style={{ color: '#475569', fontSize: 13, lineHeight: 18 }}>
                                {selectedDispute?.description || 'No detailed explanation provided.'}
                            </Text>
                        </View>

                        {/* Messages List */}
                        <Text style={{ fontSize: 12, fontWeight: '800', marginBottom: 10, color: '#64748B', textTransform: 'uppercase' }}>
                            Resolution Discussion:
                        </Text>

                        {chatMessages.length === 0 ? (
                            <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', marginVertical: 14 }}>
                                No messages yet. Type your admin response below.
                            </Text>
                        ) : (
                            chatMessages.map((msg, i) => (
                                <View
                                    key={i}
                                    style={{
                                        alignSelf: msg.is_admin ? 'flex-end' : 'flex-start',
                                        backgroundColor: msg.is_admin ? NAVY : '#FFFFFF',
                                        padding: 12,
                                        borderRadius: 14,
                                        maxWidth: '82%',
                                        marginBottom: 8,
                                        borderWidth: 1,
                                        borderColor: msg.is_admin ? GOLD : '#E2E8F0'
                                    }}
                                >
                                    <Text style={{ color: msg.is_admin ? '#FFFFFF' : NAVY, fontSize: 13 }}>
                                        {msg.message}
                                    </Text>
                                    <Text style={{ color: msg.is_admin ? 'rgba(217, 167, 58, 0.8)' : '#94A3B8', fontSize: 9.5, marginTop: 4, alignSelf: 'flex-end' }}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            ))
                        )}
                    </ScrollView>

                    {/* Bottom Message Input & Resolve */}
                    <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E2E8F0' }}>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                            <TextInput
                                style={{
                                    flex: 1,
                                    backgroundColor: '#F8FAFC',
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
                                    fontSize: 13,
                                    color: NAVY
                                }}
                                placeholder="Type admin response here..."
                                placeholderTextColor="#94A3B8"
                                value={messageText}
                                onChangeText={setMessageText}
                            />
                            <TouchableOpacity
                                onPress={sendMessage}
                                disabled={sendingMsg}
                                style={{
                                    backgroundColor: NAVY,
                                    paddingHorizontal: 14,
                                    borderRadius: 12,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: GOLD
                                }}
                            >
                                {sendingMsg ? <ActivityIndicator size="small" color={GOLD} /> : <Ionicons name="send" color={GOLD} size={18} />}
                            </TouchableOpacity>
                        </View>

                        {selectedDispute?.status !== 'resolved' && (
                            <TouchableOpacity
                                onPress={resolveDispute}
                                style={{
                                    backgroundColor: '#10B981',
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                                    Mark as Resolved
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

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
