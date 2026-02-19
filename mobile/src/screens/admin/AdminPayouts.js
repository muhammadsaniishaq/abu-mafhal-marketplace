import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';

export const AdminPayouts = () => {
    const [payouts, setPayouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPayout, setSelectedPayout] = useState(null);
    const [adminNote, setAdminNote] = useState('');

    useEffect(() => {
        fetchPayouts();
    }, []);

    const fetchPayouts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('payouts')
            .select('*, vendor:profiles(full_name, email)') // Assuming 'vendor' is the FK alias or relation name
            .order('created_at', { ascending: false });

        if (error) {
            // Handle case where relation might be named differently automatically
            console.log(error);
        }
        setPayouts(data || []);
        setLoading(false);
    };

    const updateStatus = async (status) => {
        const { error } = await supabase
            .from('payouts')
            .update({ status, admin_note: adminNote })
            .eq('id', selectedPayout.id);

        if (!error) {
            setPayouts(prev => prev.map(p => p.id === selectedPayout.id ? { ...p, status } : p));
            Alert.alert('Success', `Payout marked as ${status}`);
            setSelectedPayout(null);
            setAdminNote('');
        } else {
            Alert.alert('Error', error.message);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            onPress={() => setSelectedPayout(item)}
            style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>₦{item.amount?.toLocaleString()}</Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: item.status === 'paid' ? '#DCFCE7' : item.status === 'pending' ? '#FEF3C7' : '#F1F5F9' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: item.status === 'paid' ? '#166534' : item.status === 'pending' ? '#D97706' : '#64748B' }}>{item.status?.toUpperCase()}</Text>
                </View>
            </View>
            <Text style={{ fontSize: 14, color: '#334155' }}>{item.vendor?.full_name || 'Vendor'}</Text>
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>{item.bank_name} • {item.account_number}</Text>
            <Text style={{ fontSize: 10, color: '#CBD5E1', marginTop: 4 }}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 20 }}>
                <Text style={styles.sectionTitle}>Vendor Payouts</Text>
            </View>

            {loading ? <ActivityIndicator color="#0F172A" /> : (
                <FlatList
                    data={payouts}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingHorizontal: 20 }}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 20 }}>No payout requests.</Text>}
                />
            )}

            <Modal visible={!!selectedPayout} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
                        {selectedPayout && (
                            <>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Pxayout Request</Text>
                                    <TouchableOpacity onPress={() => setSelectedPayout(null)}>
                                        <Ionicons name="close" size={24} color="#0F172A" />
                                    </TouchableOpacity>
                                </View>

                                <View style={{ backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 20 }}>
                                    <Text style={{ color: '#64748B', fontSize: 12 }}>Amount</Text>
                                    <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 10 }}>₦{selectedPayout.amount?.toLocaleString()}</Text>

                                    <Text style={{ color: '#64748B', fontSize: 12 }}>Bank Details</Text>
                                    <Text style={{ fontWeight: '600' }}>{selectedPayout.bank_name}</Text>
                                    <Text style={{ fontWeight: '600' }}>{selectedPayout.account_number}</Text>
                                    <Text style={{ fontWeight: '600' }}>{selectedPayout.account_name}</Text>
                                </View>

                                <Text style={{ marginBottom: 8, fontWeight: '600' }}>Admin Note (Optional)</Text>
                                <TextInput
                                    style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, marginBottom: 20 }}
                                    placeholder="Transaction ID / Reason"
                                    value={adminNote}
                                    onChangeText={setAdminNote}
                                />

                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                                    <TouchableOpacity
                                        onPress={() => updateStatus('rejected')}
                                        style={{ flex: 1, padding: 14, backgroundColor: '#FEF2F2', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FCA5A5' }}
                                    >
                                        <Text style={{ color: '#DC2626', fontWeight: '700' }}>Reject</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => updateStatus('paid')}
                                        style={{ flex: 1, padding: 14, backgroundColor: '#0F172A', borderRadius: 12, alignItems: 'center' }}
                                    >
                                        <Text style={{ color: 'white', fontWeight: '700' }}>Mark as Paid</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};
