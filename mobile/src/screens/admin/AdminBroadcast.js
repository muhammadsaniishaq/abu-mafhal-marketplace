import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';

export const AdminBroadcast = () => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [history, setHistory] = useState([]);
    const [target, setTarget] = useState('all'); // all, vendors, customers

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        // Mock history for now, or create a 'broadcasts' table if needed
        // For now we just show successful sends in this session or fetching notifications sent by admin
        const { data } = await supabase.from('notifications').select('*').eq('type', 'system').limit(10).order('created_at', { ascending: false });
        if (data) setHistory(data);
    };

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            Alert.alert('Error', 'Please enter a title and message.');
            return;
        }

        Alert.alert('Confirm Broadcast', `Send to ${target.toUpperCase()} users?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Send',
                onPress: async () => {
                    setSending(true);

                    try {
                        // 1. Fetch Target Users
                        let query = supabase.from('profiles').select('id');
                        if (target === 'vendors') query = query.eq('role', 'vendor');
                        else if (target === 'customers') query = query.eq('role', 'customer');

                        const { data: users, error } = await query;

                        if (error || !users) throw new Error('Could not fetch target users');

                        // 2. Prepare Notifications Batch
                        // Supabase insert allows array. If too large, might need chunking.
                        // For MVP, we limit batch size or just do it.
                        const notifications = users.map(u => ({
                            user_id: u.id,
                            title: title,
                            message: message,
                            type: 'system',
                            is_read: false
                        }));

                        // 3. Insert in Chunks (safety)
                        const chunkSize = 100;
                        for (let i = 0; i < notifications.length; i += chunkSize) {
                            const chunk = notifications.slice(i, i + chunkSize);
                            await supabase.from('notifications').insert(chunk);
                        }

                        Alert.alert('Success', `Broadcast sent to ${users.length} users.`);
                        setTitle('');
                        setMessage('');
                        fetchHistory();

                    } catch (e) {
                        Alert.alert('Error', e.message);
                    } finally {
                        setSending(false);
                    }
                }
            }
        ]);
    };

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 20 }}>
                <Text style={styles.sectionTitle}>Send Broadcast</Text>

                <Text style={localStyles.label}>Target Audience</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                    {['all', 'vendors', 'customers'].map(t => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => setTarget(t)}
                            style={[localStyles.chip, target === t && localStyles.activeChip]}
                        >
                            <Text style={{ color: target === t ? 'white' : '#64748B', fontWeight: '600', textTransform: 'capitalize' }}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={localStyles.label}>Title</Text>
                <TextInput
                    style={localStyles.input}
                    placeholder="e.g. System Maintenance"
                    value={title}
                    onChangeText={setTitle}
                />

                <Text style={localStyles.label}>Message</Text>
                <TextInput
                    style={[localStyles.input, { height: 100, textAlignVertical: 'top' }]}
                    placeholder="Type your message here..."
                    value={message}
                    onChangeText={setMessage}
                    multiline
                />

                <TouchableOpacity
                    style={{ backgroundColor: '#0F172A', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 }}
                    onPress={handleSend}
                    disabled={sending}
                >
                    {sending ? <ActivityIndicator color="white" /> : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="paper-plane" size={20} color="white" />
                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Send Broadcast</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <View style={{ padding: 20, borderTopWidth: 1, borderColor: '#F1F5F9', flex: 1 }}>
                <Text style={{ fontWeight: '700', marginBottom: 12, color: '#64748B' }}>Recent Broadcasts</Text>
                <FlatList
                    data={history}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                            <Text style={{ fontWeight: '600' }}>{item.title}</Text>
                            <Text style={{ fontSize: 12, color: '#64748B' }} numberOfLines={1}>{item.message}</Text>
                            <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>{new Date(item.created_at).toLocaleDateString()}</Text>
                        </View>
                    )}
                />
            </View>
        </View>
    );
};

const localStyles = {
    label: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, fontSize: 14 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    activeChip: { backgroundColor: '#0F172A', borderColor: '#0F172A' }
};
