import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { styles } from '../../styles/theme';
import { supabase } from '../../lib/supabase';

export const AdminAuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchLogs();
    }, [filter]);

    const fetchLogs = async () => {
        setLoading(true);
        let query = supabase.from('audit_logs').select('*, user:profiles(full_name)').order('created_at', { ascending: false }).limit(50);

        if (filter !== 'all') {
            query = query.eq('action', filter);
        }

        const { data } = await query;
        setLogs(data || []);
        setLoading(false);
    };

    const renderItem = ({ item }) => (
        <View style={{ backgroundColor: 'white', padding: 12, borderBottomWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B' }}>{new Date(item.created_at).getHours()}:{new Date(item.created_at).getMinutes()}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{item.action.toUpperCase().replace(/_/g, ' ')}</Text>
                <Text style={{ fontSize: 12, color: '#64748B' }}>{item.user?.full_name || 'System'} • {item.details || 'No details'}</Text>
                <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{new Date(item.created_at).toDateString()}</Text>
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 20, paddingBottom: 10 }}>
                <Text style={styles.sectionTitle}>System Audit Logs</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {['all', 'login', 'create_product', 'update_order'].map(f => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setFilter(f)}
                            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: filter === f ? '#0F172A' : '#F1F5F9' }}
                        >
                            <Text style={{ fontSize: 11, color: filter === f ? 'white' : '#64748B', fontWeight: '600', textTransform: 'capitalize' }}>{f.replace(/_/g, ' ')}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? <ActivityIndicator color="#0F172A" /> : (
                <FlatList
                    data={logs}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 40 }}>No activity recorded.</Text>}
                />
            )}
        </View>
    );
};
