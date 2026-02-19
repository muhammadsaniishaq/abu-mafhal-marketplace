import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, TextInput, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';

export const AdminSupport = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('support_tickets')
            .select('*, user:profiles(full_name, email)') // Correct relationship assuming profiles exists
            .order('created_at', { ascending: false });

        if (error && error.code !== '42P01') { // Ignore "relation does not exist" if not created yet
            Alert.alert('Error', error.message);
        } else {
            setTickets(data || []);
        }
        setLoading(false);
    };

    const handleReply = async () => {
        if (!reply.trim()) return;
        setSending(true);

        // 1. Update Ticket
        const { error } = await supabase
            .from('support_tickets')
            .update({ status: 'resolved', admin_reply: reply })
            .eq('id', selectedTicket.id);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            // 2. Notify User
            await supabase.from('notifications').insert([{
                user_id: selectedTicket.user_id,
                title: 'Support Ticket Reply',
                message: `Admin replied: ${reply}`,
                type: 'system'
            }]);

            setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'resolved', admin_reply: reply } : t));
            setReply('');
            setSelectedTicket(null);
            Alert.alert('Success', 'Reply sent and ticket resolved.');
        }
        setSending(false);
    };

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 16 }}>
                <Text style={styles.sectionTitle}>Support Tickets ({tickets.length})</Text>
            </View>

            {loading ? <ActivityIndicator color="#0F172A" /> : (
                <FlatList
                    data={tickets}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => setSelectedTicket(item)}
                            style={{ padding: 16, borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: item.status === 'open' ? 'white' : '#F8FAFC' }}
                        >
                            <View style={{ flexDirection: 'row', justifyConent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontWeight: '700', flex: 1, color: '#0F172A' }}>{item.subject}</Text>
                                <Text style={{ fontSize: 10, color: item.status === 'open' ? '#D97706' : '#10B981', fontWeight: '700', textTransform: 'uppercase' }}>{item.status}</Text>
                            </View>
                            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }} numberOfLines={2}>{item.message}</Text>
                            <Text style={{ fontSize: 10, color: '#94A3B8' }}>{item.user?.full_name} • {new Date(item.created_at).toLocaleDateString()}</Text>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Ionicons name="chatbubbles-outline" size={48} color="#E2E8F0" />
                            <Text style={{ color: '#94A3B8', marginTop: 10 }}>No support tickets yet.</Text>
                        </View>
                    }
                />
            )}

            {/* REPLY MODAL */}
            <Modal visible={!!selectedTicket} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%', padding: 20 }}>
                        {selectedTicket && (
                            <>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Ticket Details</Text>
                                    <TouchableOpacity onPress={() => setSelectedTicket(null)}>
                                        <Ionicons name="close-circle" size={28} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView>
                                    <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 4 }}>Subject</Text>
                                    <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12 }}>{selectedTicket.subject}</Text>

                                    <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 4 }}>Message from {selectedTicket.user?.full_name}</Text>
                                    <View style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8, marginBottom: 20 }}>
                                        <Text style={{ lineHeight: 22 }}>{selectedTicket.message}</Text>
                                    </View>

                                    {selectedTicket.admin_reply && (
                                        <View style={{ marginBottom: 20 }}>
                                            <Text style={{ color: '#10B981', fontSize: 12, marginBottom: 4, fontWeight: '700' }}>Your Reply</Text>
                                            <View style={{ backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8 }}>
                                                <Text style={{ color: '#166534' }}>{selectedTicket.admin_reply}</Text>
                                            </View>
                                        </View>
                                    )}

                                    {selectedTicket.status === 'open' && (
                                        <View>
                                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Reply & Resolve</Text>
                                            <TextInput
                                                style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, height: 100, textAlignVertical: 'top', marginBottom: 12 }}
                                                placeholder="Type your response..."
                                                value={reply}
                                                onChangeText={setReply}
                                                multiline
                                            />
                                            <TouchableOpacity
                                                style={{ backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center' }}
                                                onPress={handleReply}
                                                disabled={sending}
                                            >
                                                {sending ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>Send Reply</Text>}
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};
