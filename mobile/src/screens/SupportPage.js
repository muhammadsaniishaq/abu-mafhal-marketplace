import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { styles } from '../styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const TICKET_CATEGORIES = ['Order Issue', 'Payment', 'Technical', 'General'];

export const SupportPage = ({ user, onBack }) => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [category, setCategory] = useState('General');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user) fetchMyTickets();
    }, [user]);

    const fetchMyTickets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('support_tickets')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error && error.code !== '42P01') {
            console.error('Fetch tickets error:', error);
        } else {
            setTickets(data || []);
        }
        setLoading(false);
    };

    const handleDelete = (id) => {
        Alert.alert('Delete Ticket', 'Are you sure you want to delete this open ticket? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    const { error } = await supabase.from('support_tickets').delete().eq('id', id);
                    if (error) Alert.alert('Error', error.message);
                    else setTickets(prev => prev.filter(t => t.id !== id));
                }
            }
        ]);
    };

    const handleSubmitTicket = async () => {
        if (!subject.trim()) return Alert.alert('Error', 'Please enter a subject');
        if (!message.trim()) return Alert.alert('Error', 'Please enter your message');

        setSubmitting(true);
        const { error } = await supabase.from('support_tickets').insert([{
            user_id: user.id,
            category: category,
            subject: subject.trim(),
            message: message.trim(),
            status: 'open'
        }]);

        setSubmitting(false);

        if (error) {
            Alert.alert('Error', error.message || 'Failed to submit ticket');
        } else {
            Alert.alert('Success', 'Your support ticket has been sent. Our team will review it shortly.');
            setShowForm(false);
            setSubject('');
            setMessage('');
            setCategory('General');
            fetchMyTickets();
        }
    };

    const renderTicket = (ticket) => {
        const isOpen = ticket.status === 'open';
        return (
            <View key={ticket.id} style={{ backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>{ticket.category || 'General'}</Text>
                            </View>
                            <View style={{ backgroundColor: isOpen ? '#FEF3C7' : '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: isOpen ? '#D97706' : '#047857', textTransform: 'uppercase' }}>{ticket.status}</Text>
                            </View>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{ticket.subject}</Text>
                    </View>

                    {isOpen && (
                        <TouchableOpacity onPress={() => handleDelete(ticket.id)} style={{ padding: 4 }}>
                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 12 }}>{ticket.message}</Text>

                {ticket.admin_reply && (
                    <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#10B981' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginBottom: 4 }}>Admin Reply</Text>
                        <Text style={{ fontSize: 13, color: '#334155', lineHeight: 20 }}>{ticket.admin_reply}</Text>
                    </View>
                )}

                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: ticket.admin_reply ? 12 : 0 }}>
                    {new Date(ticket.created_at).toLocaleDateString()}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.topHeader}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={[styles.headerRow, { justifyContent: 'flex-start', gap: 16 }]}>
                        <TouchableOpacity onPress={onBack}>
                            <Ionicons name="arrow-back" size={24} color="#0F172A" />
                        </TouchableOpacity>
                        <Text style={styles.sectionTitle}>Help & Support</Text>
                    </View>
                </SafeAreaView>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                {/* Header Banner */}
                <LinearGradient colors={['#4F46E5', '#6366F1']} style={{ padding: 20, borderRadius: 20, marginBottom: 24 }}>
                    <Ionicons name="headset" size={32} color="white" style={{ marginBottom: 12 }} />
                    <Text style={{ fontSize: 20, fontWeight: '800', color: 'white', marginBottom: 6 }}>How can we help?</Text>
                    <Text style={{ fontSize: 13, color: '#E0E7FF', lineHeight: 20 }}>
                        Create a new ticket and our support team will get back to you with a resolution as soon as possible.
                    </Text>
                </LinearGradient>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>My Tickets</Text>
                    <TouchableOpacity
                        style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        onPress={() => setShowForm(true)}
                    >
                        <Ionicons name="add" size={16} color="#4F46E5" />
                        <Text style={{ color: '#4F46E5', fontWeight: '700', fontSize: 12 }}>New Ticket</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator color="#4F46E5" style={{ marginTop: 40 }} />
                ) : tickets.length > 0 ? (
                    tickets.map(renderTicket)
                ) : (
                    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: 'white', borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' }}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            <Ionicons name="file-tray-outline" size={28} color="#94A3B8" />
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 8 }}>No Tickets Yet</Text>
                        <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>You haven't submitted any support requests.</Text>
                    </View>
                )}
            </ScrollView>

            {/* NEW TICKET MODAL */}
            <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '85%' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>Create Ticket</Text>
                            <TouchableOpacity onPress={() => setShowForm(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginLeft: 4 }}>Category</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                                {TICKET_CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setCategory(cat)}
                                        style={{
                                            paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8,
                                            backgroundColor: category === cat ? '#4F46E5' : '#F1F5F9',
                                            borderWidth: 1, borderColor: category === cat ? '#4F46E5' : '#E2E8F0'
                                        }}
                                    >
                                        <Text style={{ color: category === cat ? 'white' : '#475569', fontWeight: '600', fontSize: 13 }}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginLeft: 4 }}>Subject</Text>
                            <TextInput
                                style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0F172A', marginBottom: 20 }}
                                placeholder="E.g. Issue with my recent order"
                                placeholderTextColor="#94A3B8"
                                value={subject}
                                onChangeText={setSubject}
                            />

                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginLeft: 4 }}>Message Details</Text>
                            <TextInput
                                style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0F172A', height: 160, textAlignVertical: 'top', marginBottom: 30 }}
                                placeholder="Please describe your issue in detail so we can help you faster..."
                                placeholderTextColor="#94A3B8"
                                multiline
                                value={message}
                                onChangeText={setMessage}
                            />

                            <TouchableOpacity
                                style={{ backgroundColor: '#4F46E5', padding: 18, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                                onPress={handleSubmitTicket}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Submit Ticket</Text>
                                        <Ionicons name="paper-plane" size={18} color="white" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
