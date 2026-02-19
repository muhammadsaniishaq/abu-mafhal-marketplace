import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Alert, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';

export const AdminDisputes = () => {
    const [disputes, setDisputes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDispute, setSelectedDispute] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [chatMessages, setChatMessages] = useState([]);

    useEffect(() => {
        fetchDisputes();
    }, []);

    const fetchDisputes = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('disputes')
            .select('*, user:profiles(full_name, email)')
            .order('created_at', { ascending: false });

        if (error) console.log(error);
        setDisputes(data || []);
        setLoading(false);
    };

    const openDispute = async (dispute) => {
        setSelectedDispute(dispute);
        setModalVisible(true);
        fetchMessages(dispute.id);
    };

    const fetchMessages = async (disputeId) => {
        const { data } = await supabase.from('dispute_messages').select('*').eq('dispute_id', disputeId).order('created_at', { ascending: true });
        setChatMessages(data || []);
    };

    const sendMessage = async () => {
        if (!messageText.trim()) return;
        const { error } = await supabase.from('dispute_messages').insert({
            dispute_id: selectedDispute.id,
            sender_id: (await supabase.auth.getUser()).data.user?.id,
            message: messageText,
            is_admin: true
        });

        if (!error) {
            setMessageText('');
            fetchMessages(selectedDispute.id);
        } else {
            Alert.alert('Error', 'Failed to send');
        }
    };

    const resolveDispute = async () => {
        const { error } = await supabase.from('disputes').update({ status: 'resolved' }).eq('id', selectedDispute.id);
        if (!error) {
            Alert.alert('Success', 'Dispute Resolved');
            setModalVisible(false);
            fetchDisputes();
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity onPress={() => openDispute(item)} style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>#{item.id.slice(0, 6)}</Text>
                <View style={{ backgroundColor: item.status === 'resolved' ? '#DCFCE7' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: item.status === 'resolved' ? '#166534' : '#B45309', textTransform: 'uppercase' }}>{item.status}</Text>
                </View>
            </View>
            <Text style={{ fontSize: 12, color: '#64748B' }}>User: {item.user?.full_name || 'User'}</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#334155', marginTop: 4 }}>{item.reason}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 20 }}>
                <Text style={styles.sectionTitle}>Disputes</Text>
            </View>
            {loading ? <ActivityIndicator color="#0F172A" /> : (
                <FlatList
                    data={disputes}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 20 }}>No disputes found.</Text>}
                />
            )}

            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                    <View style={{ padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 18, fontWeight: '800' }}>Dispute Details</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1, padding: 20 }}>
                        <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 20 }}>
                            <Text style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>Order #{selectedDispute?.order_id?.slice(0, 8)}</Text>
                            <Text style={{ fontSize: 16, fontWeight: '700', marginVertical: 4 }}>{selectedDispute?.reason}</Text>
                            <Text style={{ color: '#334155' }}>{selectedDispute?.description}</Text>
                        </View>

                        <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 10, color: '#475569' }}>Messages</Text>
                        {chatMessages.map((msg, i) => (
                            <View key={i} style={{ alignSelf: msg.is_admin ? 'flex-end' : 'flex-start', backgroundColor: msg.is_admin ? '#0F172A' : 'white', padding: 12, borderRadius: 12, maxWidth: '80%', marginBottom: 8 }}>
                                <Text style={{ color: msg.is_admin ? 'white' : '#1E293B' }}>{msg.message}</Text>
                            </View>
                        ))}
                    </ScrollView>

                    <View style={{ padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#E2E8F0' }}>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                            <TextInput
                                style={{ flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8, padding: 10 }}
                                placeholder="Type a reply..."
                                value={messageText}
                                onChangeText={setMessageText}
                            />
                            <TouchableOpacity onPress={sendMessage} style={{ backgroundColor: '#0F172A', padding: 10, borderRadius: 8, justifyContent: 'center' }}>
                                <Ionicons name="send" color="white" size={20} />
                            </TouchableOpacity>
                        </View>
                        {selectedDispute?.status !== 'resolved' && (
                            <TouchableOpacity onPress={resolveDispute} style={{ backgroundColor: '#10B981', padding: 14, borderRadius: 10, alignItems: 'center' }}>
                                <Text style={{ color: 'white', fontWeight: '700' }}>Mark Resolved</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};
